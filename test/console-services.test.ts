import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fixture, setup } from './consoleFixtures.js';
import { totp } from '../src/consoleCrypto.js';
import { ConsoleServices } from '../src/consoleServices.js';
import { validateConfig, serviceDraft, normalizeManagedService } from '../src/config.js';
import { TokenBroker } from '../src/tokens.js';
import { AuditSink } from '../src/audit.js';
import { ConsoleStore } from '../src/consoleStore.js';
const draft = () => ({ name: 'Example service', no_auth: true, destinations: [{ id: 'primary', base_url: 'https://api.example.org', hosts: [{ exact: 'api.example.org' }] }], credentials: [], access: { users: [] }, policy: { mode: 'allow' as const, rules: [] } });
import { managedFixture } from './consoleManagementFixtures.js';

function save(f: ReturnType<typeof managedFixture>, service: unknown = draft(), settings?: unknown) { return f.manager.save(f.session, { id: 'new', base: f.manager.state.revision, generation: f.manager.state.services.new?.draft?.generation ?? 0, service, ...(settings ? { settings } : {}) }); }
function apply(f: ReturnType<typeof managedFixture>) { const r = f.manager.review(f.session, { id: 'new' }); return f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions }); }
describe('managed service drafts and scoped publication', () => {
 it('saves incomplete non-executing work, reviews exact sanitized scope and activates no-auth without restart', () => {
  const f = managedFixture(); try {
   save(f, { name: 'Incomplete' }); expect(f.cfg.services.new).toBeUndefined(); expect(() => f.manager.review(f.session, { id: 'new' })).toThrow('incomplete');
   const d = draft(); d.access.users.push(f.store.state.users[0]!.id as never); save(f, d);
   const r = f.manager.review(f.session, { id: 'new' }); expect(r.scope).toEqual({ services: ['new'], settings: [] }); expect(r.base).toBe(0); expect(r.grants).toEqual(d.access.users);
   expect(() => f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: [] })).toThrow('Acknowledge');
   const result = f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions }); expect(result.revision).toBe(1); expect(f.cfg.services.new?.access.users).toEqual(d.access.users); const sink = new AuditSink(f.cfg); try { expect(new TokenBroker(f.cfg, undefined, sink).issueTokens({subject: d.access.users[0]!,mode:'bearer',scopes:[]}, {service:'new',access_ids:['gateway_access'],reason:'Activation verification'}).tokens).toHaveLength(1); } finally { sink.close(); } expect(f.manager.detail(f.session, 'new').draft).toBeUndefined();
   const bytes = readFileSync(f.store.file, 'utf8'); expect(bytes).not.toContain('Example service');
  } finally { f.close(); }
 });
 it('strict external inputs reject unknown/source/value fields, bad base/generation/IDs and malformed complete configurations', () => {
  const f = managedFixture(); try {
   for (const service of [{ ...draft(), unknown: true }, { ...draft(), credentials: [{ id: 'a', usage: { kind: 'header' }, secret: 'synthetic' }] }, { ...draft(), destinations: [{ base_url: 'https://api.example.org', bad: true }] }]) expect(() => save(f, service)).toThrow('Invalid');
   for (const patch of [{ id: '../bad' }, { base: -1 }, { generation: -1 }, { extra: true }]) expect(() => f.manager.save(f.session, { id: 'new', base: 0, generation: 0, service: draft(), ...patch })).toThrow();
   for (const destinations of [[{ id: 'one', base_url: 'ftp://api.example.org' }], [{ id: 'one', base_url: 'https://user:pass@api.example.org' }], [{ id: 'one', base_url: 'https://api.example.org', hosts: [{ regex: '[' }] }], [{ id: 'one', base_url: 'https://api.example.org', ports: [0] }]]) { try { save(f, { ...draft(), destinations }); expect(() => apply(f)).toThrow(); } catch(e) { expect(e).toBeInstanceOf(Error); } }
  } finally { f.close(); }
 });
 it('rejects stale base/review, demotion and mixed Owner settings without partial mutation', () => {
  const f = managedFixture(); try {
   save(f, draft(), { name: 'Changed instance' }); const r = f.manager.review(f.session, { id: 'new' });
   f.store.state.users[0]!.role = 'Administrator'; expect(() => f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions })).toThrow('Forbidden'); expect(f.store.state.name).not.toBe('Changed instance'); expect(f.cfg.services.new).toBeUndefined();
   expect(() => save(f, draft(), { name: 'Smuggled' })).toThrow('Forbidden'); f.store.state.users[0]!.role = 'Owner';
   save(f); const prior = f.manager.review(f.session, { id: 'new' }); save(f, { ...draft(), name: 'Later' }); expect(() => f.manager.apply(f.session, { id: 'new', review: prior.review, acknowledgments: prior.exceptions })).toThrow('Stale');
   apply(f); expect(() => f.manager.save(f.session, { id: 'new', base: 0, generation: 0, service: draft() })).toThrow('Stale');
   f.store.state.users[0]!.role = 'Member'; expect(f.manager.list(f.session)).toMatchObject({ writable: false, eligible: [] });
  } finally { f.close(); }
 });
 it('preparation failure retains prior configuration; lost successful response reconciles status and state', () => {
  const f = managedFixture(); try {
   save(f); f.manager.prepareFault = () => { throw Error('Interrupted candidate preparation'); }; expect(() => apply(f)).toThrow('Interrupted'); expect(f.cfg.services.new).toBeUndefined(); expect(f.manager.state.revision).toBe(0);
   f.manager.prepareFault = undefined; const r = apply(f); expect(f.store.journal.status(r.operation)).toBe('success'); expect(f.store.journal.actorFor(r.operation)).toBe(f.session.userId); expect(f.manager.detail(f.session, 'new').lifecycle).toBe('Active'); expect(() => f.manager.apply(f.session, { id: 'new', review: '00000000-0000-4000-8000-000000000000', acknowledgments: [] })).toThrow('Save');
  } finally { f.close(); }
 });
 it('roundtrips multiple destinations, TLS inheritance/override, all matching and placement forms and advanced policy on encrypted restart', () => {
  const f = managedFixture(); try {
   const raw = { ...draft(), no_auth: false, tls: { verify: false }, destinations: [
    { id: 'exact', base_url: 'https://api.example.org:8443/base', schemes: ['https'], ports: [8443], hosts: [{ exact: 'api.example.org' }] },
    { id: 'suffix', base_url: 'http://private.example.org', schemes: ['http'], ports: [80], hosts: [{ suffix: '.example.org' }], tls: { verify: true } },
    { id: 'regex', base_url: 'https://other.example.org', hosts: [{ regex: '^other\\.example\\.org$' }], tls: { verify: false } },
   ], credentials: ['header','query','body','custom'].map((kind,i) => ({ id: 'credential'+i, usage: { kind, name: 'X-Api-Key', prefix: 'Bearer ', suffix: ';end', enforce: kind === 'header' } })), policy: { mode: 'deny' as const, rules: [{ id: 'rule', effect: 'allow' as const, priority: 7, methods: ['GET'], hosts: ['^api\\.'], paths: ['^/base'], reason: 'Example', secretlint: { enabled: false as const }, binary_response: { scan: false, max_size: 'unlimited' } }] } };
   const values = Object.fromEntries(raw.credentials.map(c => [c.id, 'synthetic-value-'+c.id]));
   const normalized = normalizeManagedService('variants', raw, values); const projected = serviceDraft(normalized); expect(projected.destinations?.[0]?.tls).toBeUndefined(); expect(projected.destinations?.[1]?.tls?.verify).toBe(true); expect(projected.policy).toEqual(raw.policy); expect(projected.credentials).toEqual(raw.credentials);
   f.store.commit('host','fixture.variants','variants', s => { s.config!.services.variants = normalized; }); f.store.close();
   const restart = new ConsoleStore(f.directory, f.keyFile); expect(restart.state.config!.services.variants!.destinations[2]!.hosts[0]).toMatchObject({ type: 'regex', regex: /^other\.example\.org$/ }); restart.close();
   expect(JSON.stringify(projected)).not.toContain('synthetic-value');
   expect(() => normalizeManagedService('bad', { ...raw, credentials: [{ id: 'a', usage: { kind: 'query', enforce: true } }] }, { a: 'x' })).toThrow();
  } finally { f.close(); }
 });
});

it('rejects invalid friendly destination row values atomically while preserving exact ordering',()=>{const f=managedFixture();try{const service=structuredClone(f.manager.state.services.baseline!.applied!);service.destinations![0]!.schemes=['https','http'];service.destinations![0]!.ports=[443,8443];f.manager.save(f.session,{id:'baseline',base:0,generation:0,service});expect(f.manager.state.services.baseline!.draft!.content.destinations![0]!.ports).toEqual([443,8443]);for(const modify of [(s:any)=>s.destinations[0].ports=[0],(s:any)=>s.destinations[0].ports=[65536],(s:any)=>s.destinations[0].schemes=['']]){const bad=structuredClone(service);modify(bad);expect(()=>f.manager.save(f.session,{id:'baseline',base:0,generation:1,service:bad})).toThrow();expect(f.manager.state.services.baseline!.draft!.generation).toBe(1);}const malformed=structuredClone(service);malformed.destinations![0]!.hosts=[{regex:'['}];f.manager.save(f.session,{id:'baseline',base:0,generation:1,service:malformed});expect(()=>f.manager.review(f.session,{id:'baseline'})).toThrow();expect(f.manager.state.revision).toBe(0);}finally{f.close();}});

it('lists independent lifecycle, pending changes and readiness without leaking values or Member drafts',()=>{const f=managedFixture();try{
 const s=f.manager.state.services.baseline!;s.assignments=[f.session.userId];s.draft={base:0,generation:1,content:{...s.applied!,name:'Proposed name'}};
 expect(f.manager.list(f.session).services[0]).toMatchObject({lifecycle:'Active',hasDraft:true,readiness:'Configured',activationBlocker:null});
 s.applied!.no_auth=false;s.applied!.credentials=[{id:'key',usage:{kind:'header',name:'X-Key'}}];s.draft.content=structuredClone(s.applied!);
 expect(f.manager.list(f.session).services[0]).toMatchObject({lifecycle:'Active',hasDraft:true,readiness:'Value missing',activationBlocker:'Set credential values first'});
 s.values.key={value:'synthetic-private-value',version:1,changed:Date.now()};expect(JSON.stringify(f.manager.list(f.session))).not.toContain('synthetic-private-value');expect(f.manager.list(f.session).services[0]).toMatchObject({readiness:'Configured',activationBlocker:null});
 s.draft.missingMappings=['old'];expect(f.manager.list(f.session).services[0]).toMatchObject({activationBlocker:'Resolve identity mapping first'});
 f.store.state.users[0]!.role='Auditor';expect(f.manager.list(f.session).writable).toBe(false);
 f.store.state.users[0]!.role='Member';expect(f.manager.list(f.session).services[0]).toMatchObject({hasDraft:false});expect(f.manager.list(f.session).services[0]).not.toHaveProperty('activationBlocker');s.assignments=[];expect(f.manager.list(f.session).services).toHaveLength(0);
}finally{f.close();}});

it('binds lifecycle confirmations to current dependencies and retains archive/restore review safeguards',()=>{const f=managedFixture();try{
 const input={id:'baseline',action:'disable',confirmed:true,fingerprint:f.manager.fingerprint('baseline')};
 f.manager.save(f.session,{id:'baseline',base:0,generation:0,service:draft()});expect(()=>f.manager.lifecycle(f.session,input)).toThrow('Stale');expect(f.manager.state.services.baseline!.lifecycle).toBe('Active');
 for(const fingerprint of ['invalid',17,'a'.repeat(65)])expect(()=>f.manager.lifecycle(f.session,{...input,fingerprint})).toThrow('Invalid');
 for(const role of ['Auditor','Member'] as const){f.store.state.users[0]!.role=role;expect(()=>f.manager.lifecycle(f.session,{...input,fingerprint:undefined})).toThrow('Forbidden');}f.store.state.users[0]!.role='Administrator';
 f.manager.lifecycle(f.session,{...input,fingerprint:f.manager.fingerprint('baseline')});expect(f.manager.state.services.baseline!.lifecycle).toBe('Disabled');expect(f.cfg.services.baseline).toBeUndefined();
 f.manager.lifecycle(f.session,{...input,action:'archive',fingerprint:f.manager.fingerprint('baseline')});expect(f.manager.state.services.baseline!.draft).toBeDefined();expect(f.manager.state.services.baseline!.applied).toBeDefined();expect(()=>f.manager.review(f.session,{id:'baseline'})).toThrow('archived');
 f.manager.lifecycle(f.session,{...input,action:'unarchive',fingerprint:f.manager.fingerprint('baseline')});expect(f.manager.state.services.baseline!.lifecycle).toBe('Disabled');expect(f.cfg.services.baseline).toBeUndefined();expect(()=>f.manager.lifecycle(f.session,{...input,action:'enable'})).toThrow('Invalid');
 expect(()=>f.manager.review(f.session,{id:'baseline'})).toThrow('Stale');expect(f.store.journal.entries().some(e=>e.action==='service.archive')).toBe(true);
}finally{f.close();}});

it('preserves exact destination references and inheritance through authorized drafts and requires current exception review',()=>{const f=managedFixture();try{
 const service={...draft(),tls:{verify:false},destinations:[{name:'_legacy/primary:v1',base_url:'https://api.example.org/base',schemes:['https','http'],ports:[443,8443],hosts:[{exact:'api.example.org'},{suffix:'.example.org'},{regex:'^api[0-9]+\\.example\\.org$'}]},{id:'constructor',base_url:'http://internal.example.org',tls:{verify:true}}]};
 f.store.state.users[0]!.role='Administrator';save(f,service);expect(f.manager.state.services.new!.draft!.content.destinations).toEqual(service.destinations);expect(f.cfg.services.new).toBeUndefined();
 const review=f.manager.review(f.session,{id:'new'});expect(review.exceptions.length).toBeGreaterThan(0);expect(()=>f.manager.apply(f.session,{id:'new',review:review.review,acknowledgments:[]})).toThrow('Acknowledge');
 f.store.state.users[0]!.role='Auditor';expect(f.manager.detail(f.session,'new').draft!.content.destinations).toEqual(service.destinations);expect(()=>save(f,service)).toThrow('Forbidden');f.store.state.users[0]!.role='Member';expect(()=>f.manager.detail(f.session,'new')).toThrow('Forbidden');expect(()=>save(f,service)).toThrow('Forbidden');
 f.store.state.users[0]!.role='Owner';apply(f);expect(f.cfg.services.new!.destinations[0]).toMatchObject({id:'_legacy/primary:v1',tls:{verify:false},tlsInherited:true});expect(f.cfg.services.new!.destinations[1]).toMatchObject({id:'constructor',tls:{verify:true},tlsInherited:false});
 expect(()=>f.manager.save(f.session,{id:'new',base:0,generation:1,service})).toThrow('Stale');
}finally{f.close();}});

it('keeps authored rule literals and custom method ordering in drafts and rejects malformed protection without replacing the draft',()=>{
 const f=managedFixture();try{
  const service=structuredClone(f.manager.state.services.baseline!.applied!);
  const rule={id:'constructor',effect:'deny' as const,priority:2000,methods:['GET','PROPFIND','POST'],hosts:['^api\\.example\\.org$'],paths:['^/v1\\.0/\\[item\\]$','/api/users.*'],reason:'Protect accounts',secretlint:{enabled:false as const},binary_response:{scan:false,max_size:'unlimited'}};
  service.policy={mode:'allow',rules:[rule]};
  f.manager.save(f.session,{id:'baseline',base:0,generation:0,service});
  expect(f.manager.state.services.baseline!.draft!.content.policy!.rules).toEqual([rule]);
  for(const change of [(r:any)=>r.paths=['['],(r:any)=>r.priority=1.5,(r:any)=>r.binary_response={scan:'invalid',max_size:'100kb'},(r:any)=>r.secretlint={disabled_rules:[]}]){
   const bad=structuredClone(service);change(bad.policy!.rules[0]);expect(()=>f.manager.save(f.session,{id:'baseline',base:0,generation:1,service:bad})).toThrow();
   expect(f.manager.state.services.baseline!.draft!.generation).toBe(1);expect(f.manager.state.services.baseline!.draft!.content.policy!.rules).toEqual([rule]);
  }
  expect(f.manager.state.services.baseline!.applied!.policy).not.toEqual(service.policy);
 }finally{f.close();}
});

it('binds confirmed execution access to current dependencies without changing drafts or lifecycle',()=>{const f=managedFixture();try{
 const id='baseline',user=f.session.userId;const command={id,user,action:'grant',fingerprint:f.manager.fingerprint(id),confirmed:true};
 for(const patch of [{fingerprint:'invalid'},{confirmed:false},{user:''},{unexpected:true}])expect(()=>f.manager.access(f.session,{...command,...patch})).toThrow('Invalid');
 f.store.state.users[0]!.authorizationGeneration=(f.store.state.users[0]!.authorizationGeneration??0)+1;expect(()=>f.manager.access(f.session,command)).toThrow('Stale access');expect(f.manager.state.services.baseline!.assignments).toEqual([]);
 for(const role of ['Auditor','Member'] as const){f.store.state.users[0]!.role=role;expect(()=>f.manager.access(f.session,{...command,fingerprint:f.manager.fingerprint(id)})).toThrow('Forbidden');}
 f.store.state.users[0]!.role='Administrator';const before=structuredClone(f.manager.state.services.baseline!.draft);f.manager.access(f.session,{...command,fingerprint:f.manager.fingerprint(id)});expect(f.manager.state.services.baseline!.assignments).toEqual([user]);expect(f.cfg.services.baseline!.access.users).toEqual([user]);expect(f.manager.state.services.baseline!.draft).toEqual(before);
 expect(()=>f.manager.access(f.session,command)).toThrow('Stale');expect(()=>f.manager.access(f.session,{...command,user:'absent',fingerprint:f.manager.fingerprint(id)})).toThrow('eligible');
 f.manager.access(f.session,{...command,action:'remove',fingerprint:f.manager.fingerprint(id)});expect(f.manager.state.services.baseline!.assignments).toEqual([]);expect(f.cfg.services.baseline!.access.users).toEqual([]);expect(f.manager.state.services.baseline!.lifecycle).toBe('Active');
 save(f,{...draft(),access:{users:[user]}});expect(f.manager.state.services.new!.assignments).toEqual([]);expect(()=>f.manager.access(f.session,{...command,id:'new',fingerprint:f.manager.fingerprint('new')})).toThrow('reviewed initial');expect(f.cfg.services.new).toBeUndefined();
}finally{f.close();}});
