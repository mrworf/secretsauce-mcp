import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { validateSecretlintConfig, resolveSecretlintRules, type SecretlintConfig } from './secretlintConfig.js';
import { validateSensitiveNameConfig, resolveSensitiveNameConfig, SensitiveNameMatcher, type SensitiveNameConfig } from './sensitiveNames.js';
import { ConsoleServices, ServiceManagementError } from './consoleServices.js';
import type { ConsoleSession } from './consoleStore.js';
export interface ProtectionCatalogs { secretlint: unknown; sensitiveNames: unknown }
export interface EffectiveProtection { secretlint: SecretlintConfig; sensitiveNames: SensitiveNameConfig }
export interface ProtectionState { applied: ProtectionCatalogs; draft?: { content: ProtectionCatalogs; base: number; generation: number }; review?: { id: string; actor: string; fingerprint: string; generation: number; effective: EffectiveProtection } }
export function bundledProtection(): ProtectionCatalogs {
  return { secretlint: parse(readFileSync(new URL('../config/secretlint.yaml',import.meta.url),'utf8')), sensitiveNames: parse(readFileSync(new URL('../config/sensitive-names.yaml',import.meta.url),'utf8')) };
}
export function catalogsFromEffective(c: EffectiveProtection): ProtectionCatalogs {
  return { secretlint: {version:1,mode:c.secretlint.mode,limits:{max_unique_secrets:c.secretlint.limits.maxUniqueSecrets,timeout:c.secretlint.limits.timeoutMs+'ms'},rules:c.secretlint.rules},
    sensitiveNames:{version:1,mode:c.sensitiveNames.mode,allow_patterns:c.sensitiveNames.allowPatterns,patterns:c.sensitiveNames.patterns} };
}
export function boundConfiguration(value: unknown, path='configuration', depth=0, budget={nodes:0}): void {
  if(++budget.nodes>20000 || depth>24)throw new ServiceManagementError(path+': Configuration exceeds depth/node budget.');
  if(typeof value==='string'&&value.length>16384)throw new ServiceManagementError(path+': Field exceeds size limit.');
  if(Array.isArray(value)&&value.length>512)throw new ServiceManagementError(path+': Collection exceeds 512 entries.');
  if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))boundConfiguration(v,path+'.'+(/^[a-zA-Z0-9_-]{1,80}$/.test(key)?key:'field'),depth+1,budget);
}
export function validateProtection(input: unknown): { content: ProtectionCatalogs; effective: EffectiveProtection } {
  boundConfiguration(input,'responseProtection');
  const result=z.object({secretlint:z.unknown(),sensitiveNames:z.unknown()}).strict().safeParse(input);
  if(!result.success)throw new ServiceManagementError('responseProtection: Supply both supported catalogs only.');
  try {
    const configured=validateSecretlintConfig(result.data.secretlint),names=validateSensitiveNameConfig(result.data.sensitiveNames),bundled=bundledProtection();
    const defaults=validateSecretlintConfig(bundled.secretlint),defaultNames=validateSensitiveNameConfig(bundled.sensitiveNames);
    if(configured.rules.length>100 || configured.limits.timeoutMs<1 || configured.limits.timeoutMs>30000)throw new ServiceManagementError('secretlint.limits.timeout: Use 1ms–30s; at most 100 rules.');
    // Options remain lossless. Bound and compile explicit custom expression strings, never execute them here.
    function regexes(value:unknown,key=''){if(typeof value==='string'&& (key==='regex'||key==='patterns')){if(value.length>2048)throw new ServiceManagementError('secretlint.rules.options: Pattern exceeds 2048 characters.');const match=/^\/(.*)\/([a-z]*)$/.exec(value);new RegExp(match?.[1]??value,match?.[2]??'');}else if(Array.isArray(value))for(const v of value)regexes(v,key);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))regexes(v,k);}
    for(const r of configured.rules)regexes(r.options);
    const effective={secretlint:{...configured,rules:resolveSecretlintRules(configured,defaults.rules)},sensitiveNames:resolveSensitiveNameConfig(names,defaultNames)};
    new SensitiveNameMatcher(effective.sensitiveNames); // Prepare before the commit.
    return {content:structuredClone(result.data),effective};
  } catch(error) {
    if(error instanceof ServiceManagementError)throw error;
    const diagnostics=(error as {diagnostics?:Array<{path?:string}>}).diagnostics;
    throw new ServiceManagementError('responseProtection.'+(diagnostics?.[0]?.path?.replace(/[^a-zA-Z0-9_.\[\]-]/g,'')??'catalog')+': Invalid or unsupported catalog field/regular expression.');
  }
}
export class ConsoleProtection {
  constructor(readonly manager:ConsoleServices){if(!manager.state.protection)manager.state.protection={applied:manager.runtimeConfig.responseProtection?catalogsFromEffective(manager.runtimeConfig.responseProtection):bundledProtection()};}
  get state(){return this.manager.state.protection!;}
  read(session:ConsoleSession){this.manager.actor(session);const v=validateProtection(this.state.applied);return {revision:this.manager.state.revision,applied:this.state.applied,draft:this.state.draft,effective:v.effective,source:'Settings → Response protection',writable:['Owner','Administrator'].includes(this.manager.actor(session).role)&&!session.restricted&&!this.manager.store.journal.degraded&&!this.manager.store.externalAudit?.degraded};}
  save(session:ConsoleSession,input:unknown){const actor=this.manager.actor(session,true);const p=z.object({base:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),catalogs:z.unknown()}).strict().safeParse(input);if(!p.success)throw new ServiceManagementError('responseProtection: Invalid draft input.');const d=p.data,v=validateProtection(d.catalogs);if(d.base!==this.manager.state.revision||d.generation!==(this.state.draft?.generation??0))throw new ServiceManagementError('Stale response protection. Reload and review again.');const operation=this.manager.store.commit(actor.id,'protection.save','response-protection',s=>{s.managed!.protection!.draft={content:v.content,base:d.base,generation:d.generation+1};delete s.managed!.protection!.review;});return {operation,status:'saved'};}
  review(session:ConsoleSession,input:unknown){const actor=this.manager.actor(session,true);if(!z.object({}).strict().safeParse(input).success)throw new ServiceManagementError('responseProtection: Invalid review input.');const d=this.state.draft;if(!d||d.base!==this.manager.state.revision)throw new ServiceManagementError('Stale or missing response protection draft.');const v=validateProtection(d.content),id=randomUUID(),fingerprint=this.manager.fingerprint('response-protection');const operation=this.manager.store.commit(actor.id,'protection.review','response-protection',s=>{s.managed!.protection!.review={id,actor:actor.id,fingerprint,generation:d.generation,effective:v.effective};});return {operation,review:id,current:this.state.applied,proposed:d.content,effective:v.effective,exception:'Shared scanner changes affect all services. Reduced scanning is a security exception; scanning is best-effort and cannot stop every encoded reflection.'};}
  apply(session:ConsoleSession,input:unknown){const actor=this.manager.actor(session,true);const p=z.object({review:z.string().uuid(),acknowledged:z.literal(true)}).strict().safeParse(input);if(!p.success)throw new ServiceManagementError('responseProtection: Acknowledge shared scanning impact.');const d=this.state.draft,r=this.state.review;if(!d||!r||r.id!==p.data.review||r.actor!==actor.id||r.generation!==d.generation||r.fingerprint!==this.manager.fingerprint('response-protection')||d.base!==this.manager.state.revision)throw new ServiceManagementError('Stale response protection. Reload and review again.');const prepared=validateProtection(d.content);const base=this.manager.state.revision;let operation;try{operation=this.manager.store.commit(actor.id,'protection.apply','response-protection',s=>{s.managed!.protection!.applied=prepared.content;delete s.managed!.protection!.draft;delete s.managed!.protection!.review;s.config!.responseProtection=prepared.effective;s.managed!.revision++;});}finally{if(base!==this.manager.state.revision){this.manager.publish();}}return {operation,status:'applied',revision:this.manager.state.revision};}
}
const managers=new WeakMap<ConsoleServices,ConsoleProtection>();
export function consoleProtection(manager:ConsoleServices){let p=managers.get(manager);if(!p){p=new ConsoleProtection(manager);managers.set(manager,p);}return p;}
