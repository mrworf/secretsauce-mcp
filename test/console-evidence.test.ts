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
describe('scoped operating evidence',()=>{
 it('combines retained gateway events with sanitized management operations and exact filters',()=>{
  const f=fixture();f.cfg.audit.file=join(f.directory,'gateway.jsonl');const sink=new AuditSink(f.cfg);sink.bindConsole(f.store);
  try{sink.record({type:'service_request',request_id:'request-1',subject:f.session.userId,service:'baseline',destination:'primary',access_ids:[],internal_reference_ids:[],method:'GET',target_host:'api.example.org',target_path:'/safe',policy_decision:'deny',matched_policy_rule:'deny-rule',request_timestamp:new Date(Date.now()).toISOString(),request_duration_ms:1,tls_verify:true,secret_tokenization_count:0});
   const q=consoleEvidence(f.store).query(f.session,{service:'baseline',result:'deny',requestId:'request-1'});expect(q.entries).toHaveLength(1);expect(q.verified).toBe(true);expect(q.entries[0]?.reason).toBe('deny-rule');
   const start=f.store.journal.start(f.session.userId,'synthetic.uncertain','baseline',17);expect(consoleEvidence(f.store).query(f.session,{result:'uncertain'}).entries[0]).toMatchObject({operation:start,revision:17});
   for(const bad of [{from:2,to:1},{limit:101},{actor:'bad\nlabel'},{offset:-1},{unknown:true},{result:'invented'}])expect(()=>consoleEvidence(f.store).query(f.session,bad)).toThrow();
  }finally{sink.close();}
 });
 it('Members read only own acting identity and cannot use target matching or foreign direct filters/details/exports',()=>{
  const f=fixture(),other=f.store.journal.start('foreign','identity.change',f.session.userId);
  f.store.state.users[0]!.role='Member';
  const e=consoleEvidence(f.store);expect(e.query(f.session).entries.some(x=>x.operation===other)).toBe(false);
  expect(()=>e.query(f.session,{actor:'foreign'})).toThrow('Forbidden');expect(()=>e.query(f.session,{service:'baseline'})).toThrow('Forbidden');expect(()=>e.detail(f.session,{id:'operation:'+other})).toThrow('Forbidden');expect(()=>e.export(f.session,{kind:'activity'})).toThrow('Forbidden');
 });
 it('exports bounded exact filters and strips injected controls/query secrets; role changes and restricted sessions deny',()=>{
  const f=fixture(),e=consoleEvidence(f.store);f.manager.state.services.baseline!.values.test={value:'synthetic-business-secret',version:1,changed:Date.now()};
  f.store.journal.start(f.session.userId,'synthetic.log','synthetic-business-secret\nhttps://api.example.org/path?token=synthetic-business-secret#proof sec_synthetic');
  const text=JSON.stringify(e.export(f.session,{kind:'activity',filters:{action:'synthetic.log'}}));expect(text).not.toContain('synthetic-business-secret');expect(text).not.toContain('?token');expect(text).not.toContain('sec_synthetic');expect(text).toContain('[REDACTED]');
  expect(e.query(f.session,{action:'evidence.export'}).entries).toHaveLength(1);
  for(const kind of ['access','configuration','version'])expect(e.export(f.session,{kind}).kind).toBe(kind);
  expect(()=>e.export(f.session,{kind:'wrong'})).toThrow();expect(()=>e.export(f.session,{kind:'version',raw:true})).toThrow();
  f.session.restricted=true;expect(()=>e.export(f.session,{kind:'version'})).toThrow('Sensitive');f.session.restricted=false;f.store.journal.degraded=true;expect(()=>e.export(f.session,{kind:'version'})).toThrow('Sensitive');
 });
 it('bounds large retained export to one snapshot/500 rows and sanitizes filters; rechecks changed role at admission',()=>{const f=fixture(),e=consoleEvidence(f.store);const operations=Array.from({length:10000},(_,i)=>({id:'synthetic-'+i,phase:'complete' as const,actor:f.session.userId,action:'synthetic.bulk',target:'baseline',time:Date.now()-i,revision:1,result:'success' as const}));const snapshot=vi.spyOn(f.store.journal,'entries').mockReturnValue(operations);const verified=vi.spyOn(f.store.journal,'verify').mockReturnValue(true);const start=performance.now();const result=e.export(f.session,{kind:'activity',filters:{action:'synthetic.bulk'}});expect((result.report as {entries:unknown[]}).entries).toHaveLength(500);expect(snapshot).toHaveBeenCalledTimes(1);expect(performance.now()-start).toBeLessThan(2000);snapshot.mockRestore();verified.mockRestore();f.manager.state.services.baseline!.values.test={value:'synthetic-business-secret',version:1,changed:Date.now()};expect(JSON.stringify(e.export(f.session,{kind:'activity',filters:{actor:'synthetic-business-secret'}}))).not.toContain('synthetic-business-secret');const admit=vi.spyOn(f.store.journal,'start').mockImplementation(()=>{f.store.state.users[0]!.role='Member';return 'synthetic-operation';});expect(()=>e.export(f.session,{kind:'access'})).toThrow('Forbidden');admit.mockRestore();});
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
