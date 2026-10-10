import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { describe, it, expect, vi } from 'vitest';
import { managedFixture } from './consoleManagementFixtures.js';
import { GatewayRuntime } from '../src/runtime.js';
import { executeServiceRequest } from '../src/gateway.js';
import { getService } from '../src/registry.js';
import { createGatewayServer } from '../src/server.js';
import { consoleServices } from '../src/consoleServices.js';
import type { AuthContext } from '../src/types.js';
async function downstream(secret: string) {
 let count = 0; let finish: (() => void) | undefined; let called: (() => void) | undefined;
 const admitted = new Promise<void>(r => { called = r; });
 const server = createServer((_req,res) => { count++; finish = () => res.end(secret); called?.(); });
 server.listen(0,'127.0.0.1'); await once(server,'listening'); const a = server.address(); if (!a || typeof a === 'string') throw Error('Listener missing');
 return { url: 'http://127.0.0.1:'+a.port, admitted, finish: () => finish?.(), count: () => count, close: () => new Promise<void>(r => server.close(()=>r())) };
}
function configure(f: ReturnType<typeof managedFixture>, url = 'https://api.example.org', credential = false, id = 'service') {
 const user = f.store.state.users[0]!.id;
 const save = () => f.manager.save(f.session, { id, base: f.manager.state.revision, generation: f.manager.state.services[id]?.draft?.generation ?? 0, service: { name: 'Managed example', no_auth: !credential, destinations: [{ id: 'primary', base_url: url }], credentials: credential ? [{ id: 'key', usage: { kind: 'header', name: 'X-Api-Key', enforce: true } }] : [], access: { users: [user] }, policy: { mode: 'allow', rules: [] } } });
 save(); if (credential) { f.manager.credential(f.session,{id,credential:'key',action:'create',value:'synthetic-original-secret',confirmed:true}); save(); }
 const r = f.manager.review(f.session,{id});f.manager.apply(f.session,{id,review:r.review,acknowledgments:r.exceptions});
 return user;
}
function runtime(f: ReturnType<typeof managedFixture>) {
 const r = new GatewayRuntime(f.cfg); r.auditSink.bindConsole(f.store);
 f.manager.invalidate = (service,subject) => r.capabilities.tokenBroker.revoke(service,subject);
 f.cfg.managedAdmission = (subject,service) => f.manager.admit(subject,service);
 return r;
}
const auth = (subject: string): AuthContext => ({subject,mode:'bearer',scopes:['gateway.read','gateway.references','gateway.request']});
describe('immediate managed credentials, access and lifecycle', () => {
 it('keeps values write-only with versions, rejects dependencies and requires explicit confirmation for all external action fields', async () => {
  const f=managedFixture();try {
   configure(f,'https://api.example.org',true);const detail=f.manager.detail(f.session,'service');expect(detail.credentials).toMatchObject([{id:'key',version:1,available:true}]);expect(JSON.stringify(detail)).not.toContain('synthetic-original');
   f.manager.credential(f.session,{id:'service',credential:'key',action:'replace',value:'synthetic-new-secret',confirmed:true});expect(f.cfg.services.service!.credentials[0]!.secret).toBe('synthetic-new-secret');expect(f.manager.detail(f.session,'service').credentials[0]!.version).toBe(2);expect(f.store.journal.entries().findLast(e=>e.action==='credential.replace')?.details).toEqual({credential:'key',credentialVersion:2});
   expect(()=>f.manager.credential(f.session,{id:'service',credential:'key',action:'delete',confirmed:true})).toThrow('dependencies');
   f.manager.credential(f.session,{id:'service',credential:'unused',action:'create',value:'synthetic-unused',confirmed:true});f.manager.credential(f.session,{id:'service',credential:'unused',action:'delete',confirmed:true});
   for(const patch of [{confirmed:false},{value:''},{value:'Bearer synthetic'},{value:' value'},{value:'value\n'},{value:123},{extra:true},{credential:'../invalid'},{action:'reveal'}])expect(()=>f.manager.credential(f.session,{id:'service',credential:'key',action:'replace',value:'valid-synthetic',confirmed:true,...patch})).toThrow();
   expect(()=>f.manager.credential(f.session,{id:'service',credential:'missing',action:'replace',value:'valid',confirmed:true})).toThrow('availability');
   f.store.state.users[0]!.role='Auditor';expect(()=>f.manager.credential(f.session,{id:'service',credential:'key',action:'replace',value:'valid',confirmed:true})).toThrow('Forbidden');
  }finally{f.close();}
 });
 it('disables and archives immediately, unarchives Disabled, requires fresh review and rejects stale grants', async()=>{
  const f=managedFixture();const user=configure(f);const r=runtime(f);try{
   const broker=r.capabilities.tokenBroker;const token=broker.issueTokens(auth(user),{service:'service',access_ids:['gateway_access'],reason:'check'}).tokens[0]!.token;
   f.manager.lifecycle(f.session,{id:'service',action:'disable',confirmed:true});expect(()=>getService(f.cfg,'service',auth(user))).toThrow();expect(()=>broker.validateServiceReferenceUse(auth(user),{service:'service'},token)).toThrow();
   f.manager.lifecycle(f.session,{id:'service',action:'archive',confirmed:true});f.manager.lifecycle(f.session,{id:'service',action:'unarchive',confirmed:true});expect(f.manager.detail(f.session,'service').lifecycle).toBe('Disabled');expect(f.cfg.services.service).toBeUndefined();
   expect(()=>f.manager.review(f.session,{id:'service'})).toThrow('Save');
   const old=f.manager.state.services.service!.applied!;f.manager.save(f.session,{id:'service',base:f.manager.state.revision,generation:0,service:old});const reviewed=f.manager.review(f.session,{id:'service'});
   f.manager.access(f.session,{id:'service',user,action:'remove',confirmed:true});expect(()=>f.manager.apply(f.session,{id:'service',review:reviewed.review,acknowledgments:reviewed.exceptions})).toThrow();expect(f.manager.state.services.service!.assignments).toEqual([]);
   for(const patch of [{confirmed:false},{action:'enable'},{id:'absent'},{extra:true}])expect(()=>f.manager.lifecycle(f.session,{id:'service',action:'disable',confirmed:true,...patch})).toThrow();
   for(const patch of [{confirmed:false},{action:'all'},{user:'absent'},{extra:true}])expect(()=>f.manager.access(f.session,{id:'service',user,action:'grant',confirmed:true,...patch})).toThrow();
   f.store.state.users[0]!.role='Auditor';expect(()=>broker.issueTokens(auth(user),{service:'service',access_ids:['gateway_access'],reason:'check'})).toThrow();
  }finally{await r.close();f.close();}
 });
 it('does not implicitly grant role-based execution; initial review cannot replay a newly ineligible identity',()=>{
  const f=managedFixture();try{
   const user=f.store.state.users[0]!.id;expect(()=>getService(f.cfg,'baseline',auth(user))).toThrow();
   f.manager.save(f.session,{id:'new',base:0,generation:0,service:{name:'New',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[user]},policy:{mode:'allow',rules:[]}}});const review=f.manager.review(f.session,{id:'new'});
   f.store.state.users[0]!.role='Member';expect(()=>f.manager.apply(f.session,{id:'new',review:review.review,acknowledgments:review.exceptions})).toThrow('Forbidden');expect(f.cfg.services.new).toBeUndefined();
   f.store.state.users[0]!.role='Owner';f.store.state.users[0]!.active=false;expect(()=>f.manager.apply(f.session,{id:'new',review:review.review,acknowledgments:review.exceptions})).toThrow();expect(f.cfg.services.new).toBeUndefined();
  }finally{f.close();}
 });
 it('rotates during dispatched work, protects the admitted old secret, prevents revived references and preserves occupied capacity/unaffected state',async()=>{
  const f=managedFixture();const d=await downstream('synthetic-original-secret');f.cfg.limits.maxServiceRequestsInflight=1;f.cfg.limits.maxServiceRequestsInflightPerSubject=1;f.cfg.limits.maxServiceRequestsInflightPerService=1;const user=configure(f,d.url,true);const r=runtime(f);try{
   const broker=r.capabilities.tokenBroker;const ref=broker.issueTokens(auth(user),{service:'service',access_ids:['key'],reason:'check'}).tokens[0]!.token;
   const pending=executeServiceRequest(f.cfg,auth(user),{service:'service',method:'GET',path:'/',headers:{'X-Api-Key':ref},reason:'check'},r);await d.admitted;
   const limiter=r.capabilities.serviceRequestLimiter;f.manager.credential(f.session,{id:'service',credential:'key',action:'replace',value:'synthetic-replacement-secret',confirmed:true});
   expect(r.capabilities.serviceRequestLimiter).toBe(limiter);expect(()=>broker.validateTokenUse(auth(user),{service:'service'},ref)).toThrow();
   const newRef=broker.issueTokens(auth(user),{service:'service',access_ids:['key'],reason:'check'}).tokens[0]!.token;
   await expect(executeServiceRequest(f.cfg,auth(user),{service:'service',method:'GET',path:'/',headers:{'X-Api-Key':newRef},reason:'check'},r)).rejects.toThrow('capacity');expect(d.count()).toBe(1);
   const before=broker.stats();d.finish();const response=await pending;expect(response.body).not.toContain('synthetic-original-secret');expect(response.secret_tokenized).toBe(true);expect(broker.stats()).toEqual(before);expect(()=>broker.validateResponseSecretUse(auth(user),'service',response.body!)).toThrow();
   expect(r.auditSink.events.some(e=>e.type==='service_request'&&'admitted_revision' in e)).toBe(true);
  }finally{d.finish();await r.close();await d.close();f.close();}
 });
 it('revoke during dispatched work preserves protection and cannot allocate new usable response references',async()=>{
  const f=managedFixture();const d=await downstream('synthetic-original-secret');const user=configure(f,d.url,true);const r=runtime(f);try{
   const broker=r.capabilities.tokenBroker;const ref=broker.issueTokens(auth(user),{service:'service',access_ids:['key'],reason:'check'}).tokens[0]!.token;
   const pending=executeServiceRequest(f.cfg,auth(user),{service:'service',method:'GET',path:'/',headers:{'X-Api-Key':ref},reason:'check'},r);await d.admitted;
   f.manager.access(f.session,{id:'service',user,action:'remove',confirmed:true});d.finish();const result=await pending;expect(result.body).not.toContain('synthetic-original-secret');expect(broker.stats().configured).toBe(0);expect(broker.stats().responseSecrets).toBe(0);await expect(executeServiceRequest(f.cfg,auth(user),{service:'service',method:'GET',path:'/',headers:{'X-Api-Key':ref},reason:'check'},r)).rejects.toThrow();expect(d.count()).toBe(1);
  }finally{d.finish();await r.close();await d.close();f.close();}
 });
 it.each(['unchanged','rotate','revoke','apply'] as const)('a valid POST waiting for body bytes rechecks %s before downstream dispatch',async action=>{
  const f=managedFixture();const d=await downstream('safe');configure(f,d.url,true);
  // Explicit existing external subject fixture: bearer compatibility carries no console authority.
  f.manager.state.services.service!.assignments.push('bearer-dev');f.manager.state.services.service!.applied!.access!.users=[...f.manager.state.services.service!.assignments];f.store.state.config!.services.service!.access.users=[...f.manager.state.services.service!.assignments];
  const rt=new GatewayRuntime(f.cfg);const server=createGatewayServer(f.cfg,{consoleStore:f.store,runtime:rt,closeRuntimeOnServerClose:false});server.listen(0,'127.0.0.1');await once(server,'listening');const a=server.address();if(!a||typeof a==='string')throw Error('listener');const m=consoleServices(f.store);
  const ref=rt.capabilities.tokenBroker.issueTokens(auth('bearer-dev'),{service:'service',access_ids:['key'],reason:'queue test'}).tokens[0]!.token;
  let observed: (()=>void)|undefined;const firstBytes=new Promise<void>(r=>{observed=r;});server.on('request',req=>req.on('newListener',name=>{if(name==='data')queueMicrotask(()=>observed?.());}));
  try{
   const payload=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'service_request',arguments:{service:'service',method:'GET',path:'/',headers:{'X-Api-Key':ref},reason:'check'}}});let outgoing: ReturnType<typeof request>;
   const completion=new Promise<string>((resolve,reject)=>{outgoing=request({host:'127.0.0.1',port:a.port,path:'/mcp',method:'POST',headers:{authorization:'Bearer synthetic-bearer','content-type':'application/json',accept:'application/json, text/event-stream','content-length':Buffer.byteLength(payload)}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve(body));});outgoing.on('error',reject);outgoing.write(payload.slice(0,20));});
   await firstBytes;
   if(action==='rotate')m.credential(f.session,{id:'service',credential:'key',action:'replace',value:'synthetic-replaced',confirmed:true});
   if(action==='revoke')m.access(f.session,{id:'service',user:'bearer-dev',action:'remove',confirmed:true});
   if(action==='apply'){const next=structuredClone(m.state.services.service!.applied!);next.policy={mode:'deny',rules:[]};m.save(f.session,{id:'service',base:m.state.revision,generation:0,service:next});const review=m.review(f.session,{id:'service'});m.apply(f.session,{id:'service',review:review.review,acknowledgments:review.exceptions});}
   outgoing!.end(payload.slice(20));if(action==='unchanged'){await d.admitted;d.finish();}const body=await completion;if(action==='unchanged'){expect(body).toContain('status_code');expect(d.count()).toBe(1);}else{expect(body).toContain('isError');expect(body).toMatch(/(reference|Current service access unavailable|policy)/i);expect(d.count()).toBe(0);}
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rt.close();await d.close();f.close();}
 });
 it('prototype-like identifiers are own records and forged lookups never select inherited services or credentials',()=>{
  const f=managedFixture();try{
   expect(()=>f.manager.detail(f.session,'constructor')).toThrow('unavailable');expect(()=>getService(f.cfg,'toString')).toThrow('Unknown');expect(()=>f.manager.credential(f.session,{id:'constructor',credential:'toString',action:'replace',value:'synthetic',confirmed:true})).toThrow('unavailable');
   for(const id of ['constructor','toString']){configure(f,'https://api.example.org',false,id);expect(Object.hasOwn(f.manager.state.services,id)).toBe(true);expect(f.manager.detail(f.session,id).lifecycle).toBe('Active');}
   f.manager.credential(f.session,{id:'constructor',credential:'toString',action:'create',value:'synthetic-prototype-safe',confirmed:true});expect(f.manager.detail(f.session,'constructor').credentials).toMatchObject([{id:'toString',version:1}]);expect(()=>f.manager.credential(f.session,{id:'constructor',credential:'valueOf',action:'replace',value:'synthetic',confirmed:true})).toThrow('availability');f.manager.lifecycle(f.session,{id:'constructor',action:'disable',confirmed:true});f.manager.credential(f.session,{id:'constructor',credential:'toString',action:'replace',value:'synthetic-disabled-value',confirmed:true});expect(f.manager.detail(f.session,'constructor').credentials[0]!.version).toBe(2);f.manager.access(f.session,{id:'constructor',user:f.store.state.users[0]!.id,action:'remove',confirmed:true});expect(f.cfg.services.constructor).toBe(Object.prototype.constructor);expect(Object.hasOwn(f.cfg.services,'constructor')).toBe(false);
  }finally{f.close();}
 });
 it('preserves existing namespace and underscore identifiers through detail, draft apply and credential rotation',()=>{
  const id='_legacy/service:v1', credential='_key/one';
  const f=managedFixture(cfg=>{cfg.services[id]={...structuredClone(cfg.services.baseline!),id,credentials:[{id:credential,usage:{kind:'query',name:'key',enforce:false},source:{kind:'env',name:'EXAMPLE'},secret:'synthetic-legacy-value'}]};});
  try{const detail=f.manager.detail(f.session,id);expect(detail.applied?.credentials?.[0]?.id).toBe(credential);f.manager.credential(f.session,{id,credential,action:'replace',value:'synthetic-rotated',confirmed:true});f.manager.save(f.session,{id,base:f.manager.state.revision,generation:0,service:detail.applied});const review=f.manager.review(f.session,{id});f.manager.apply(f.session,{id,review:review.review,acknowledgments:review.exceptions});expect(f.cfg.services[id]!.credentials[0]!.secret).toBe('synthetic-rotated');expect(f.manager.detail(f.session,id).applied?.credentials?.[0]?.id).toBe(credential);}finally{f.close();}
 });
 it('durable apply with a failed completion reports uncertainty but publishes the committed revision for reconciliation',()=>{
  const f=managedFixture();try{
   f.manager.save(f.session,{id:'new',base:0,generation:0,service:{name:'New',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[]}}});const review=f.manager.review(f.session,{id:'new'});const finish=vi.spyOn(f.store.journal,'finish').mockImplementation(()=>{throw Error('completion unavailable');});expect(()=>f.manager.apply(f.session,{id:'new',review:review.review,acknowledgments:[]})).toThrow('uncertain');finish.mockRestore();expect(f.cfg.services.new?.name).toBe('New');expect(f.manager.detail(f.session,'new').lifecycle).toBe('Active');
  }finally{f.close();}
 });
});
