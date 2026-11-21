import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { managedFixture } from './consoleManagementFixtures.js';
import { consoleEvidence } from '../src/consoleEvidence.js';
import { AuditSink } from '../src/audit.js';
import { ConsoleJournal } from '../src/consoleJournal.js';
const fixtures:ReturnType<typeof managedFixture>[]=[];
afterEach(()=>{for(const f of fixtures.splice(0))f.close();});
function fixture(){const f=managedFixture();fixtures.push(f);return f;}
async function complete(e:ReturnType<typeof consoleEvidence>,session:ReturnType<typeof fixture>['session'],input:unknown){let text='';await e.writeActivity(session,input,new AbortController().signal,async chunk=>{text+=chunk;});return JSON.parse(text);}
describe('scoped operating evidence',()=>{
 it('combines retained gateway events with sanitized management operations and exact filters',()=>{
  const f=fixture();f.cfg.audit.file=join(f.directory,'gateway.jsonl');const sink=new AuditSink(f.cfg);sink.bindConsole(f.store);
  try{sink.record({type:'service_request',request_id:'request-1',subject:f.session.userId,service:'baseline',destination:'primary',access_ids:[],internal_reference_ids:[],method:'GET',target_host:'api.example.org',target_path:'/safe',policy_decision:'deny',matched_policy_rule:'deny-rule',request_timestamp:new Date(Date.now()).toISOString(),request_duration_ms:1,tls_verify:true,secret_tokenization_count:0});
   const q=consoleEvidence(f.store).query(f.session,{service:'baseline',result:'deny',requestId:'request-1'});expect(q.entries).toHaveLength(1);expect(q.verified).toBe(true);expect(q.entries[0]?.reason).toBe('deny-rule');
   const start=f.store.journal.start(f.session.userId,'synthetic.uncertain','baseline',17);expect(consoleEvidence(f.store).query(f.session,{result:'uncertain'}).entries[0]).toMatchObject({operation:start,revision:17});
   for(const bad of [{from:2,to:1},{limit:101},{actor:'bad\nlabel'},{offset:-1},{unknown:true},{result:'invented'}])expect(()=>consoleEvidence(f.store).query(f.session,bad)).toThrow();
  }finally{sink.close();}
 });
 it('adds the current email to authorized local Activity rows without relabeling imported actors or exports',async()=>{
  const f=fixture(),e=consoleEvidence(f.store),actor=f.store.state.users[0]!;
  const id=f.store.journal.start(actor.id,'synthetic.actor','baseline');
  const unknown=f.store.journal.start('external-actor','synthetic.actor','baseline');
  const local=e.query(f.session,{action:'synthetic.actor'}).entries.find(row=>row.operation===id)!;
  expect(local).toMatchObject({actor:actor.id,actorEmail:actor.email});
  expect(e.detail(f.session,{id:local.id}).entry).toMatchObject({actor:actor.id,actorEmail:actor.email});
  expect(e.query(f.session,{action:'synthetic.actor'}).entries.find(row=>row.operation===unknown)).not.toHaveProperty('actorEmail');
  const report=await complete(e,f.session,{kind:'activity',filters:{action:'synthetic.actor'}});
  expect(JSON.stringify(report)).not.toContain(actor.email);
  const row={...local,id:'imported-actor',provenance:'imported' as const};
  delete (row as {actorEmail?:string}).actorEmail;
  vi.spyOn(e as unknown as {rows():unknown},'rows').mockReturnValue({verified:true,entries:[row]});
  expect(e.query(f.session).entries[0]).not.toHaveProperty('actorEmail');
 });
 it('Members read only own acting identity and cannot use target matching or foreign direct filters/details/exports',()=>{
  const f=fixture(),other=f.store.journal.start('foreign','identity.change',f.session.userId);
  f.store.state.users[0]!.role='Member';
  const e=consoleEvidence(f.store);expect(e.query(f.session).entries.some(x=>x.operation===other)).toBe(false);
  expect(()=>e.query(f.session,{actor:'foreign'})).toThrow('Forbidden');expect(()=>e.query(f.session,{service:'baseline'})).toThrow('Forbidden');expect(()=>e.detail(f.session,{id:'operation:'+other})).toThrow('Forbidden');expect(()=>e.export(f.session,{kind:'activity'})).toThrow('Forbidden');
 });
 it('exports bounded exact filters and strips injected controls/query secrets; role changes and restricted sessions deny',async()=>{
  const f=fixture(),e=consoleEvidence(f.store);f.manager.state.services.baseline!.values.test={value:'synthetic-business-secret',version:1,changed:Date.now()};
  f.store.journal.start(f.session.userId,'synthetic.log','synthetic-business-secret\nhttps://api.example.org/path?token=synthetic-business-secret#proof sec_synthetic');
  const text=JSON.stringify(await complete(e,f.session,{kind:'activity',filters:{action:'synthetic.log'}}));expect(text).not.toContain('synthetic-business-secret');expect(text).not.toContain('?token');expect(text).not.toContain('sec_synthetic');expect(text).toContain('[REDACTED]');
  expect(e.query(f.session,{action:'evidence.export'}).entries).toHaveLength(1);
  for(const kind of ['access','configuration','version'])expect(e.export(f.session,{kind}).kind).toBe(kind);
  expect(()=>e.export(f.session,{kind:'wrong'})).toThrow();expect(()=>e.export(f.session,{kind:'version',raw:true})).toThrow();
  f.session.restricted=true;expect(()=>e.export(f.session,{kind:'version'})).toThrow('Sensitive');f.session.restricted=false;f.store.journal.degraded=true;expect(()=>e.export(f.session,{kind:'version'})).toThrow('Sensitive');
 });
 it('exports the complete retained snapshot beyond500 rows and sanitizes filters; rechecks changed role at admission',async()=>{const f=fixture(),e=consoleEvidence(f.store);const operations=Array.from({length:10000},(_,i)=>({id:'synthetic-'+i,phase:'complete' as const,actor:f.session.userId,action:'synthetic.bulk',target:'baseline',time:Date.now()-i,revision:1,result:'success' as const}));const snapshot=vi.spyOn(f.store.journal,'entries').mockReturnValue(operations);const verified=vi.spyOn(f.store.journal,'verify').mockReturnValue(true);const start=performance.now();const result=await complete(e,f.session,{kind:'activity',filters:{action:'synthetic.bulk'}});expect((result.report as {entries:unknown[]}).entries).toHaveLength(10000);expect(snapshot).toHaveBeenCalledTimes(1);expect(performance.now()-start).toBeLessThan(2000);snapshot.mockReturnValue(operations.slice(0,500).map(v=>({...v,action:'x'.repeat(2048),target:'y'.repeat(2048)})));expect(Buffer.byteLength(JSON.stringify(await complete(e,f.session,{kind:'activity'})))).toBeGreaterThan(2*1024*1024);snapshot.mockRestore();verified.mockRestore();f.manager.state.services.baseline!.values.test={value:'synthetic-business-secret',version:1,changed:Date.now()};expect(JSON.stringify(await complete(e,f.session,{kind:'activity',filters:{actor:'synthetic-business-secret'}}))).not.toContain('synthetic-business-secret');const admit=vi.spyOn(f.store.journal,'start').mockImplementation(()=>{f.store.state.users[0]!.role='Member';return 'synthetic-operation';});expect(()=>e.export(f.session,{kind:'access'})).toThrow('Forbidden');admit.mockRestore();});
 it('Auditor has evidence exports and retention reads but no retention mutations',()=>{const f=fixture(),e=consoleEvidence(f.store);f.store.state.users[0]!.role='Auditor';expect(e.export(f.session,{kind:'version'})).toHaveProperty('report');expect(e.readRetention(f.session).writable).toBe(false);expect(()=>e.saveRetention(f.session,{days:1,base:f.store.state.revision,generation:0})).toThrow('Forbidden');});
 it('detects changed disk evidence and blocks exports without silently repairing',()=>{const f=fixture(),e=consoleEvidence(f.store);writeFileSync(f.store.journal.path,readFileSync(f.store.journal.path,'utf8').replace('setup.proof','setup.forge'));expect(e.query(f.session).verified).toBe(false);expect(f.store.journal.degraded).toBe(true);expect(()=>e.export(f.session,{kind:'version'})).toThrow();});
});
describe('reviewed attributed retention',()=>{
 it('defaults365days; validates atomic draft/review/apply and deletes only expired complete evidence',()=>{
  const f=fixture(),e=consoleEvidence(f.store);expect(e.retention.days).toBe(365);
  const old=Date.now()-400*86400000;
  f.store.journal.append({id:'old-complete',actor:f.session.userId,action:'synthetic.old',target:'baseline',time:old,revision:0,phase:'complete',result:'success'});
  f.store.journal.append({id:'old-uncertain',actor:f.session.userId,action:'synthetic.waiting',target:'baseline',time:old,revision:0,phase:'start'});
  f.store.journal.append({id:'old-revocation',actor:f.session.userId,action:'oauth.grant_revoke',target:'identity',time:old,revision:0,phase:'complete',details:{grant:'synthetic-grant',grantExpires:Date.now()+86400000}});
  for(const days of [0,-1,36501,1.5,'1'])expect(()=>e.saveRetention(f.session,{days,base:f.store.state.revision,generation:0})).toThrow();
  e.saveRetention(f.session,{days:30,base:f.store.state.revision,generation:0});const r=e.reviewRetention(f.session,{});expect(r.recordsToDelete).toBe(1);e.applyRetention(f.session,{review:r.review,confirmed:true});
  expect(e.retention.days).toBe(30);expect(f.store.journal.entries().some(r=>r.id==='old-complete')).toBe(false);expect(f.store.journal.status('old-uncertain')).toBe('uncertain');expect(f.store.journal.entries().some(r=>r.id==='old-revocation')).toBe(true);expect(f.store.journal.verify()).toBe(true);expect(f.store.journal.entries().some(r=>r.action==='audit.retention')).toBe(true);
  expect(()=>e.applyRetention(f.session,{review:r.review,confirmed:true})).toThrow('Stale');
 });
 it('stale review or role change rejects; background retention fails closed during outage',()=>{const f=fixture(),e=consoleEvidence(f.store);e.saveRetention(f.session,{days:1,base:f.store.state.revision,generation:0});const r=e.reviewRetention(f.session,{});f.store.commit(f.session.userId,'synthetic.change','instance',()=>{});expect(()=>e.applyRetention(f.session,{review:r.review,confirmed:true})).toThrow('Stale');f.store.state.users[0]!.role='Administrator';expect(()=>e.reviewRetention(f.session,{})).toThrow('Forbidden');f.store.journal.degraded=true;expect(()=>e.sweep()).toThrow('audit');});
 it.each(['retention-prepared','retention-chain'])('recovers signed compaction after interrupted %s without losing receipt or live intent',phase=>{const f=fixture(),path=join(f.directory,'isolated.chain');const j=new ConsoleJournal(path,f.store.key,p=>{if(p===phase)throw Error('synthetic disk failure');});j.append({id:'expired',phase:'complete',actor:'actor',action:'synthetic.old',target:'baseline',time:0,revision:0,result:'success'});expect(()=>j.compact(1,'actor')).toThrow('uncertain');const recovered=new ConsoleJournal(path,f.store.key);expect(recovered.degraded).toBe(false);expect(recovered.entries().some(r=>r.id==='expired')).toBe(false);expect(recovered.entries().some(r=>r.action==='audit.retention')).toBe(true);expect(recovered.verify()).toBe(true);});
 it('retains gateway raw records and matching digests across restart',()=>{const f=fixture();f.cfg.audit.file=join(f.directory,'gateway.jsonl');let sink=new AuditSink(f.cfg);sink.record({type:'tool_invocation',subject:f.session.userId,tool:'list_services',outcome:'allow',timestamp:new Date().toISOString()});const removed=sink.retain(Date.now()+1,'owner');expect(removed).toBeGreaterThan(0);sink.close();sink=new AuditSink(f.cfg);try{expect(sink.degraded).toBe(false);expect(sink.evidence().verified).toBe(true);}finally{sink.close();}});
});

describe('bounded Activity chip predicates',()=>{
 function seeded(){const f=fixture(),e=consoleEvidence(f.store);vi.spyOn(f.store.journal,'entries').mockReturnValue(['alpha','alphabet','Beta','literal.*'].map((action,i)=>({id:'chip-'+i,phase:'complete' as const,actor:i===2?'foreign':f.session.userId,action,target:i===3?'instance':'baseline',time:1000+i,revision:1,result:'success' as const})));vi.spyOn(f.store.journal,'verify').mockReturnValue(true);return {f,e};}
 const c=(field:string,comparison:string,value:string)=>({field,comparison,value});
 it('ORs inclusions, vetoes exclusions, ANDs fields/context/time, preserves literals, order and missing inverses',()=>{const {f,e}=seeded();const query=(chips:unknown[],extra={})=>e.query(f.session,{chips,...extra}).entries.map(r=>r.action);
  expect(query([c('action','equals','alpha'),c('action','contains','bet')])).toEqual(['alphabet','alpha']);
  const chips=[c('action','contains','alpha'),c('action','notEquals','alphabet'),c('service','equals','baseline')];expect(query(chips)).toEqual(['alpha']);expect(query([...chips].reverse())).toEqual(['alpha']);
  expect(query([c('action','contains','alpha'),c('action','notContains','alp')])).toEqual([]);
  expect(query([c('action','contains','.*')])).toEqual(['literal.*']);expect(query([c('action','contains','beta')])).toEqual([]);
  expect(query([c('requestId','contains','x')])).toEqual([]);expect(query([c('requestId','notContains','x')])).toHaveLength(4);
  expect(query([c('service','notEquals','baseline')],{contextService:'baseline'})).toEqual([]);
  expect(query([],{from:1001,to:1001})).toEqual(['alphabet']);expect(query([],{to:1000})).toEqual(['alpha']);
  expect(()=>e.detail(f.session,{id:'operation:chip-3',filters:{contextService:'baseline'}})).toThrow('Forbidden');
 });
 it('validates exact results, legacy conflicts, duplicate pairs and all input bounds without normalization',()=>{const {f,e}=seeded();for(const chips of [[c('unknown','equals','x')],[c('action','regex','x')],[c('action','equals','')],[c('action','equals','a\n')],[c('action','equals','x'.repeat(1025))],[c('result','equals','Success')],[c('result','notEquals','invented')],[c('action','equals','x'),c('action','notContains','x')],Array.from({length:33},(_,i)=>c('action','equals',String(i)))])expect(()=>e.query(f.session,{chips})).toThrow('Invalid evidence input');
  expect(()=>e.query(f.session,{action:'alpha',chips:[c('action','contains','a')]})).toThrow();expect(()=>e.query(f.session,{from:NaN})).toThrow();expect(()=>e.query(f.session,{from:2,to:1})).toThrow();
  expect(e.query(f.session,{chips:Array.from({length:32},(_,i)=>c('action','equals',String(i)))}).total).toBe(0);
  expect(e.query(f.session,{chips:[c('action','equals','alpha'),c('action','equals','Alpha'),c('actor','equals','alpha')]}).total).toBe(0);
  expect(e.query(f.session,{chips:[c('result','contains','succ')]}).total).toBe(4);expect(e.query(f.session,{action:'alpha'}).total).toBe(1);
 });
 it('keeps Member actor outside Boolean logic and refuses exact foreign actor/unassigned contexts',()=>{const {f,e}=seeded();f.store.state.users[0]!.role='Member';f.manager.state.services.baseline!.assignments=[f.session.userId];expect(e.query(f.session,{chips:[c('actor','notEquals','nobody')]}).total).toBe(3);for(const filters of [{chips:[c('actor','equals','foreign')]},{chips:[c('service','equals','other')]},{contextService:'other'}])expect(()=>e.query(f.session,filters)).toThrow('Forbidden');expect(()=>e.detail(f.session,{id:'operation:chip-2',filters:{chips:[c('actor','contains','foreign')]}})).toThrow('Forbidden');expect(()=>e.export(f.session,{kind:'activity'})).toThrow('Forbidden');});
 it('exports all current scoped predicates independent of offset and sanitizes nested values',async()=>{const {f,e}=seeded();f.manager.state.services.baseline!.values.test={value:'synthetic-secret-chip',version:1,changed:Date.now()};const filters={contextService:'baseline',chips:[c('action','notEquals','synthetic-secret-chip')],offset:1};const r=await complete(e,f.session,{kind:'activity',filters});expect(JSON.stringify(r)).not.toContain('synthetic-secret-chip');expect(r.report).toMatchObject({total:3,startOffset:0,truncated:false,entries:[{action:'Beta'},{action:'alphabet'},{action:'alpha'}]});});
 it('counts predicate work in the same aggregate two-second budget',()=>{const {f,e}=seeded();let reads=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>++reads<=2?0:2001);try{expect(()=>e.query(f.session,{chips:[c('action','contains','a')]})).toThrow('bounded work limit');}finally{clock.mockRestore();}});
});

describe('complete bounded Activity response',()=>{
 function bulk(){const f=fixture(),e=consoleEvidence(f.store);vi.spyOn(f.store.journal,'entries').mockReturnValue(Array.from({length:700},(_,i)=>({id:'large-'+i,phase:'complete' as const,actor:f.session.userId,action:'bulk.'+'x'.repeat(2048),target:'baseline'+'y'.repeat(2048),time:1000+i,revision:1,result:'success' as const})));vi.spyOn(f.store.journal,'verify').mockReturnValue(true);return {f,e};}
 it('streams a complete >2MiB snapshot ignoring page, one row at a time, with audited completion',async()=>{const {f,e}=bulk(),chunks:string[]=[];await e.writeActivity(f.session,{kind:'activity',filters:{offset:600,limit:25}},new AbortController().signal,async s=>{chunks.push(s);});const text=chunks.join(''),r=JSON.parse(text);expect(Buffer.byteLength(text)).toBeGreaterThan(2*1024*1024);expect(r.report.entries).toHaveLength(700);expect(r.report).toMatchObject({startOffset:0,total:700,truncated:false});expect(r.report.filters).not.toHaveProperty('offset');expect(Math.max(...chunks.map(x=>x.length))).toBeLessThan(10000);expect(f.store.journal.status(r.operation)).toBe('success');});
 it('cancels without valid closing framing and releases the single export slot',async()=>{const {f,e}=bulk(),controller=new AbortController(),chunks:string[]=[];await expect(e.writeActivity(f.session,{kind:'activity'},controller.signal,async s=>{chunks.push(s);if(chunks.length===3)controller.abort();})).rejects.toThrow('canceled');expect(()=>JSON.parse(chunks.join(''))).toThrow();await expect(e.writeActivity(f.session,{kind:'activity',filters:{action:'absent'}},new AbortController().signal,async()=>{})).resolves.toBeUndefined();});
 it('rejects concurrent output, revocation after an await and deadline expiry without a complete document',async()=>{const {f,e}=bulk();let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});let started!:()=>void;const ready=new Promise<void>(r=>{started=r;});const chunks:string[]=[];const first=e.writeActivity(f.session,{kind:'activity'},new AbortController().signal,async s=>{chunks.push(s);if(chunks.length===1){started();await gate;}});await ready;await expect(e.writeActivity(f.session,{kind:'activity'},new AbortController().signal,async()=>{})).rejects.toThrow('already running');f.store.state.users[0]!.role='Member';release();await expect(first).rejects.toThrow();expect(()=>JSON.parse(chunks.join(''))).toThrow();f.store.state.users[0]!.role='Owner';let timed=false;const clock=vi.spyOn(performance,'now').mockImplementation(()=>timed?30001:0);try{await expect(e.writeActivity(f.session,{kind:'activity'},new AbortController().signal,async()=>{timed=true;})).rejects.toThrow('bounded delivery');}finally{clock.mockRestore();}});
 it('rejects invalid input, forbidden role and missing contextual identity before release',async()=>{const {f,e}=bulk();for(const input of [{kind:'activity',extra:true},{kind:'activity',filters:{limit:101}},{kind:'activity',filters:{contextService:'missing'}}])await expect(e.writeActivity(f.session,input,new AbortController().signal,async()=>{throw Error('output must not start');})).rejects.toThrow();f.store.state.users[0]!.role='Member';await expect(e.writeActivity(f.session,{kind:'activity'},new AbortController().signal,async()=>{})).rejects.toThrow('Forbidden');});
});
