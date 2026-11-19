import { randomUUID } from 'node:crypto';
import { LineCounter,parseDocument,stringify } from 'yaml';
import { z } from 'zod';
import { rawConfigSchema,validateMigrationGlobals,normalizeManagedService, type ManagedServiceDraft } from './config.js';
import { consoleProtection,boundConfiguration,validateProtection,bundledProtection,type ProtectionCatalogs } from './consoleProtection.js';
import { ConsoleServices,ServiceManagementError,validateDraftBounds } from './consoleServices.js';
import type { ConsoleSession } from './consoleStore.js';
const id=z.string().min(1).max(1024),mapping=z.union([z.object({subject:id,localId:id}).strict(),z.object({subject:id,issuer:z.string().url(),externalSubject:id}).strict()]);
const schema=z.object({base:z.number().int().nonnegative(),gateway:z.string().max(262144),secretlint:z.string().max(131072),sensitiveNames:z.string().max(131072),mappings:z.array(mapping).max(0).default([]),credentials:z.array(z.object({service:id,credential:id,value:z.string().min(1).max(16384)}).strict()).max(512),confirmed:z.literal(true)}).strict();
export function parseMigrationYaml(source:string,label:string):unknown {
  if(Buffer.byteLength(source)>262144)throw new ServiceManagementError(label+': Source exceeds 256KiB.');
  const counter=new LineCounter(),doc=parseDocument(source,{lineCounter:counter,prettyErrors:false,uniqueKeys:true});
  if(doc.errors.length){const position=counter.linePos(doc.errors[0]!.pos[0]);throw new ServiceManagementError(label+': Invalid YAML at line '+position.line+', column '+position.col+'.');}
  let raw;try{raw=doc.toJS({maxAliasCount:0});}catch{throw new ServiceManagementError(label+': YAML aliases or unsupported structures are not accepted.');}boundConfiguration(raw,label);return raw;
}
function safePath(parts:PropertyKey[]){return parts.map(v=>typeof v==='number'?String(v):/^[a-zA-Z0-9_-]{1,80}$/.test(String(v))?String(v):'field').join('.');}
export function importConfiguration(manager:ConsoleServices,session:ConsoleSession,input:unknown){
 const actor=manager.actor(session,true),p=schema.safeParse(input);if(!p.success)throw new ServiceManagementError('import: Check source lengths, retired mappings (must be empty), write-only credentials and confirmation.');const d=p.data;
 if(d.base!==manager.state.revision)throw new ServiceManagementError('Stale import. Reload current configuration and validate again.');
 const raw=parseMigrationYaml(d.gateway,'gateway');if(raw&&typeof raw==='object'&&'services' in raw&&raw.services&&typeof raw.services==='object'&&Object.hasOwn(raw.services,'__proto__'))throw new ServiceManagementError('gateway.services: Unsupported service identifier.');const result=rawConfigSchema.safeParse(raw);
 if(!result.success){const issue=result.error.issues[0]!;const suffix=issue.code==='unrecognized_keys'?'.'+issue.keys.filter(k=>/^[a-zA-Z0-9_-]{1,80}$/.test(k)).join('.') : '';throw new ServiceManagementError('gateway.'+safePath(issue.path)+suffix+': Invalid or unsupported field.');}
 const config=result.data;try{validateMigrationGlobals(config);}catch(error){const path=(error as {diagnostics?:Array<{path?:string}>}).diagnostics?.[0]?.path;throw new ServiceManagementError('gateway.'+(path?.replace(/[^a-zA-Z0-9_.\[\]-]/g,'')??'settings')+': Invalid global setting or trust URL.');}if(actor.role!=='Owner'){const baseline=rawConfigSchema.parse({...currentGlobalConfiguration(manager),services:config.services});for(const key of ['server','auth','tokens','limits','logging','audit'] as const)if(JSON.stringify(config[key])!==JSON.stringify(baseline[key]))throw new ServiceManagementError('gateway.'+key+': Owner permission required for changed instance proposals. Export current configuration and retain those fields for an Administrator service/scanner import.');}const defaults=bundledProtection();const catalogs:ProtectionCatalogs={secretlint:d.secretlint.trim()?parseMigrationYaml(d.secretlint,'secretlint'):defaults.secretlint,sensitiveNames:d.sensitiveNames.trim()?parseMigrationYaml(d.sensitiveNames,'sensitiveNames'):defaults.sensitiveNames};validateProtection(catalogs);
 const values=new Map<string,string>();for(const c of d.credentials){const service=Object.hasOwn(config.services,c.service)?config.services[c.service]:undefined;if(!service?.credentials.some(v=>v.id===c.credential)||values.has(JSON.stringify([c.service,c.credential]))||c.value.trim()!==c.value||/[\r\n\0]/.test(c.value)||/^(Bearer|Basic)\s/i.test(c.value))throw new ServiceManagementError('credentials: Supply each declared canonical value once, without protocol prefix or control characters.');values.set(JSON.stringify([c.service,c.credential]),c.value);}
 const reservedIds=new Set(Object.keys(manager.state.services));
 const names=new Set(Object.entries(manager.state.services).flatMap(([key,s])=>[s.applied?.name,s.draft?.content.name,s.applied?.name??s.draft?.content.name??s.displayName??key].filter((n):n is string=>typeof n==='string')));
 const drafts:Array<{id:string;sourceId:string;content:ManagedServiceDraft;missingCredentials:string[]}>=[];
 for(const [key,source] of Object.entries(config.services)){
  if(!key.length||key.length>1024||/[\u0000-\u001f\u007f]/.test(key))throw new ServiceManagementError('gateway.services.field: Invalid legacy service identifier.');
  let target=key;if(reservedIds.has(target))target='import-'+randomUUID();
  if(reservedIds.has(target))throw new ServiceManagementError('Import identity collision. Reload Services before retrying.');reservedIds.add(target);
  let name=source.name;if(names.has(name)){const prefix='Imported '+source.name;name=prefix;let suffix=2;while(names.has(name)&&suffix<=names.size+2)name=prefix+' ('+(suffix++)+')';}
  if(name.length>200)throw new ServiceManagementError('gateway.services.field: Imported service name exceeds 200 characters. Shorten the source name before importing.');names.add(name);
  const content:ManagedServiceDraft={...source,name,credentials:source.credentials.map(({source:ignored,...c})=>c),access:{users:[]}};
  const missingCredentials=source.credentials.filter(c=>!values.has(JSON.stringify([key,c.id]))).map(c=>c.id);
  validateDraftBounds(content);try{normalizeManagedService(target,content,Object.fromEntries(source.credentials.map(c=>[c.id,'migration-placeholder'])));}catch{throw new ServiceManagementError('gateway.services.field: Invalid destination, credential placement or policy.');}
  drafts.push({id:target,sourceId:key,content,missingCredentials});
 }
 const sourceRevision=manager.store.state.revision;const mutation=randomUUID();let operation:string;try{operation=manager.store.commit(actor.id,'configuration.import','configuration',state=>{
  const m=state.managed!;if(sourceRevision!==manager.store.state.revision||d.base!==m.revision||drafts.some(d=>Object.hasOwn(m.services,d.id)))throw new ServiceManagementError('Stale import. Reload Services before retrying.');manager.actor(session,true);state.v=Math.max(state.v,7) as typeof state.v;m.migrationGlobals={server:config.server,auth:config.auth,tokens:config.tokens,limits:config.limits,logging:config.logging,audit:config.audit};
  m.protection??={applied:bundledProtection()};m.protection.draft={content:catalogs,base:m.revision,generation:(m.protection.draft?.generation??0)+1};delete m.protection.review;
  for(const draft of drafts){const s:import('./consoleServices.js').ManagedService={lifecycle:'Draft',displayName:draft.content.name!,values:{},assignments:[]};Object.defineProperty(m.services,draft.id,{value:s,writable:true,enumerable:true,configurable:true});
   for(const c of config.services[draft.sourceId]!.credentials){const value=values.get(JSON.stringify([draft.sourceId,c.id]));if(value!==undefined)Object.defineProperty(s.values,c.id,{value:{value,version:1,generation:manager.store.state.revision+1,changed:Date.now(),changeAction:'set',actor:actor.id,mutation},writable:true,enumerable:true,configurable:true});}
   s.draft={content:draft.content,base:m.revision,generation:1};
  }
 },{mutation});}catch(error){manager.store.uncertainCredentialMutations.add(mutation);throw error;}
 return {operation,status:'drafts imported',services:drafts.map(({id,sourceId,content,missingCredentials})=>({id,sourceId,name:content.name,missingMappingCount:0,missingCredentials})),reserved:'Endpoint, authentication, tokens, operating limits, logging and audit source fields are preserved for their Settings controls; import does not activate them. Clients must reconnect after separately reviewed endpoint or authentication identity changes.',notice:'Managed applied state remains authoritative. Imported paths/environment names are never read; Every imported service is separate and initially has no access assignments. Existing services and credentials remain unchanged. Review each draft and shared catalogs separately.'};
}
export function exportConfiguration(manager:ConsoleServices,session:ConsoleSession){
 const actor=manager.actor(session);manager.store.requireSensitive(session);
 const globals=currentGlobalConfiguration(manager);
 const services=Object.fromEntries(Object.entries(manager.state.services).filter(([,s])=>s.applied).map(([id,s])=>[id,{...s.applied,access:{users:[]},credentials:(s.applied!.credentials??[]).map(c=>({...c,source:{kind:'env',name:'MIGRATION_CREDENTIAL_REQUIRED'}}))}]));
 const protection=consoleProtection(manager).read(session).applied;
 const operation=manager.store.commit(actor.id,'configuration.export','configuration',()=>{});
 return {operation,inactiveImportedGlobals:manager.state.migrationGlobals??null,gateway:stringify({...globals,services}),secretlint:stringify(protection.secretlint),sensitiveNames:stringify(protection.sensitiveNames),missingSecretMaterial:true,notice:'Sanitized configuration only. Secret values, live access, identities, lifecycle, sessions and grants are excluded. This is not a restore archive. Migration source globals may be preserved but inactive; current Settings remain authoritative.'};
}

export function currentGlobalConfiguration(manager:ConsoleServices):Record<string,unknown>{
 const config=manager.runtimeConfig;function snake(value:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(value).map(([key,v])=>{const unit=key.endsWith('Ms')?'ms':key.endsWith('Bytes')?'b':undefined;const name=key.replace(/OAuth/g,'Oauth').replace(/Ms$|Bytes$/g,'').replace(/[A-Z]/g,c=>'_'+c.toLowerCase());return [name,unit?String(v)+unit:v&&typeof v==='object'&&!Array.isArray(v)?snake(v as Record<string,unknown>):v];}));}
 const auth=config.auth.mode==='oauth'?{mode:'oauth',oauth:snake(config.auth.oauth as unknown as Record<string,unknown>)}:config.auth.mode==='bearer'?{mode:'bearer',bearer:{token_env:'MIGRATION_GATEWAY_TOKEN_REQUIRED'}}:{mode:'builtin_oauth',builtin_oauth:{issuer:config.auth.builtinOAuth.issuer,admin_username_env:'MIGRATION_USERNAME_REQUIRED',admin_password_hash_env:'MIGRATION_PASSWORD_HASH_REQUIRED',signing_key_file:'MIGRATION_SIGNING_KEY_REQUIRED',access_token_ttl:config.auth.builtinOAuth.accessTokenTtlMs+'ms',authorization_code_ttl:config.auth.builtinOAuth.authorizationCodeTtlMs+'ms',refresh_token_idle_ttl:config.auth.builtinOAuth.refreshTokenIdleTtlMs+'ms',refresh_token_max_ttl:config.auth.builtinOAuth.refreshTokenMaxTtlMs+'ms',...(config.auth.builtinOAuth.refreshTokenStoreFile?{refresh_token_store_file:config.auth.builtinOAuth.refreshTokenStoreFile}:{}),allowed_clients:config.auth.builtinOAuth.allowedClients,required_scopes:config.auth.builtinOAuth.requiredScopes,login_rate_limit:snake(config.auth.builtinOAuth.loginRateLimit as unknown as Record<string,unknown>)}};
 return {server:{listen:config.server.listen,mcp_path:config.server.mcpPath,allow_insecure_oauth_http:config.server.allowInsecureOAuthHttp,...(config.server.resource?{resource:config.server.resource}:{})},auth,tokens:snake(config.tokens as unknown as Record<string,unknown>),limits:snake(config.limits as unknown as Record<string,unknown>),logging:config.logging,audit:{...(config.audit.file?{file:config.audit.file}:{}),memory_events:config.audit.memoryEvents}};
}
