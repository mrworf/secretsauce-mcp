import {digest} from './consoleCrypto.js';
import {consoleBackups} from './consoleBackups.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sanitizeAuditText } from './auditSanitizer.js';
import { ConsoleStore, type ConsoleSession } from './consoleStore.js';
import { consoleServices } from './consoleServices.js';
import { PACKAGE_VERSION } from './version.js';
export class EvidenceError extends Error {}
const label=z.string().min(1).max(1024).refine(v=>!/[\u0000-\u001f\u007f]/.test(v));
const filters=z.object({from:z.number().int().nonnegative().optional(),to:z.number().int().nonnegative().optional(),actor:label.optional(),service:label.optional(),action:label.optional(),result:z.enum(['success','failed','uncertain','allow','deny','error']).optional(),requestId:label.optional(),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict().refine(v=>v.from===undefined||v.to===undefined||v.from<=v.to);
export type EvidenceFilter=z.input<typeof filters>;
export interface EvidenceEntry {id:string;operation?:string;time:number;actor:string;service:string;action:string;result:string;requestId?:string;revision:number;reason:string;provenance:'local'|'imported';sourceInstance?:string;sourceArchive?:string;recoveryPoint?:number;}
export interface RetentionState {days:number;draft?:{days:number;base:number;generation:number;baseDays?:number};review?:{id:string;actor:string;base:number;generation:number;cutoff:number;impact:number;};}
function parse<T>(schema:z.ZodType<T>,input:unknown):T {if(input&&typeof input==='object'&&(Object.hasOwn(input,'__proto__')||Object.hasOwn(input,'constructor')||Object.hasOwn(input,'prototype')))throw new EvidenceError('Invalid evidence input.');const p=schema.safeParse(input);if(!p.success)throw new EvidenceError('Invalid evidence input. Check filters, bounds and supported fields.');return p.data;}
export function evidenceSanitizer(store:ConsoleStore):(value:string)=>string {
 const secrets=[...Object.values(store.state.config?.services??{}).flatMap(s=>s.credentials.map(c=>c.secret)),...Object.values(store.state.managed?.services??{}).flatMap(s=>Object.values(s.values).map(v=>v.value)),store.state.notifications?.applied?.password??''].filter(Boolean);
 return value=>sanitizeAuditText(value,secrets).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/https?:\/\/[^\s]+/g,url=>{try{const u=new URL(url);u.username='';u.password='';u.search='';u.hash='';return u.toString();}catch{return '[invalid URL]';}}).slice(0,2048);
}
export function safeEvidenceText(store:ConsoleStore,value:string):string{return evidenceSanitizer(store)(value);}
export class ConsoleEvidence {
 constructor(readonly store:ConsoleStore){}
 get retention():RetentionState{return this.store.state.retention??{days:365};}
 private expiredImported(cutoff:number){return (this.store.state.importedAudit??[]).filter(d=>d.lastEvidenceTime<cutoff&&d.entries.every(e=>e.time<cutoff&&e.result!=='uncertain'));}
 private importedImpact(cutoff:number){return this.expiredImported(cutoff).reduce((n,d)=>n+d.entries.length,0);}
 private rows():{entries:EvidenceEntry[];verified:boolean}{
  const deadline=performance.now()+2000;
  const gateway=this.store.externalAudit?.evidence(),verified=this.store.journal.verify()&&(gateway?.verified??true);
  const journalEntries=this.store.journal.entries();
  const operations=[...journalEntries,...(gateway?.operations??[])];
  const done=new Map(operations.filter(r=>r.phase==='complete').map(r=>[r.id,r]));
  const started=new Set(operations.filter(r=>r.phase==='start').map(r=>r.id));
  const entries:EvidenceEntry[]=operations.filter(r=>r.phase!=='complete'||!started.has(r.id)).map(r=>{
   const completion=done.get(r.id);return {id:'operation:'+r.id,operation:r.id,time:r.time,actor:r.actor,service:Object.hasOwn(this.store.state.managed?.services??{},r.target)?r.target:'',action:r.action,result:completion?.result??(r.phase==='start'?'uncertain':r.result??'success'),revision:r.revision,reason:r.target,provenance:'local'};
  });
  for(const [index,event] of (gateway?.events??[]).entries()){
   const e=event as unknown as Record<string,unknown>;
   entries.push({id:'gateway:'+digest(JSON.stringify(event)),time:Date.parse(String(e.timestamp??e.request_timestamp)),actor:String(e.subject??''),service:String(e.service??''),action:String(e.tool??e.type),result:String(e.error_code?(e.policy_decision==='deny'?'deny':'error'):e.outcome??e.policy_decision??'success'),...(typeof e.request_id==='string'?{requestId:e.request_id}:{}),revision:typeof e.admitted_revision==='number'?e.admitted_revision:0,reason:String(e.error_message??e.error_code??e.matched_policy_rule??e.reason??''),provenance:'local'});
  }
  const localIds=new Set([...journalEntries.map(e=>this.store.journal.identity()+':operation:'+e.id),...(gateway?.operations??[]).map(e=>(this.store.state.gatewayAuditIdentity??'')+':operation:'+e.id),...(gateway?.events??[]).map(e=>(this.store.state.gatewayAuditIdentity??'')+':gateway:'+digest(JSON.stringify(e)))]);
  const importedIds=new Set<string>();for(const d of this.store.state.importedAudit??[])for(const e of d.entries){const key=d.data.identity+':'+e.id;if(localIds.has(key)||importedIds.has(key))continue;importedIds.add(key);entries.push({...e,id:'imported:'+key,provenance:'imported',sourceInstance:d.instance,sourceArchive:d.archive,recoveryPoint:d.recoveryPoint});}
  if(entries.length>100000||performance.now()>deadline)throw new EvidenceError('Evidence scan reached its bounded work limit. Narrow retained storage with reviewed retention.');
  return {entries:entries.sort((a,b)=>b.time-a.time),verified};
 }
 private select(session:ConsoleSession,input:unknown){
  const user=this.store.authorize(session,'own'),f=parse(filters,input);
  if(user.role==='Member'&&f.actor&&f.actor!==user.id)throw new Error('Forbidden.');
  if(user.role==='Member'&&f.service){const service=Object.hasOwn(this.store.state.managed?.services??{},f.service)?this.store.state.managed!.services[f.service]:undefined;if(!service?.assignments.includes(user.id))throw new Error('Forbidden.');}
  const rows=this.rows(),matches=rows.entries.filter(e=>(user.role!=='Member'||e.actor===user.id)&&(f.from===undefined||e.time>=f.from)&&(f.to===undefined||e.time<=f.to)&&(!f.actor||e.actor===f.actor)&&(!f.service||e.service===f.service)&&(!f.action||e.action===f.action)&&(!f.result||e.result===f.result)&&(!f.requestId||e.requestId===f.requestId));
  return {user,f,matches,verified:rows.verified};
 }
 private sanitize(entries:EvidenceEntry[],safe:(value:string)=>string){return entries.map(e=>({...e,actor:safe(e.actor),service:safe(e.service),action:safe(e.action),reason:safe(e.reason),...(e.requestId?{requestId:safe(e.requestId)}:{})}));}
 query(session:ConsoleSession,input:unknown={}){
  const {user,f,matches,verified}=this.select(session,input),safe=evidenceSanitizer(this.store);
  return {scope:user.role==='Member'?'Own activity':'Instance activity',verified,entries:this.sanitize(matches.slice(f.offset,f.offset+f.limit),safe),total:matches.length,next:f.offset+f.limit<matches.length?f.offset+f.limit:null,retentionDays:this.retention.days,recovery:this.store.state.recovery?{phase:this.store.state.recovery.phase,recoveryPoint:this.store.state.recovery.recoveryPoint,installedAt:this.store.state.recovery.installedAt??null,notice:this.store.state.recovery.notice,unknownInterval:this.store.state.recovery.unknownInterval}:undefined,exportable:user.role!=='Member'&&!session.restricted&&!this.store.journal.degraded&&!this.store.externalAudit?.degraded};
 }
 detail(session:ConsoleSession,input:unknown){const d=parse(z.object({id:label,filters:filters.default({offset:0,limit:50})}).strict(),input);const q=this.select(session,d.filters),item=q.matches.find(e=>e.id===d.id);if(!item)throw new Error('Forbidden.');return {scope:q.user.role==='Member'?'Own activity':'Instance activity',entry:this.sanitize([item],evidenceSanitizer(this.store))[0],verified:q.verified};}
 export(session:ConsoleSession,input:unknown){
  const actor=this.store.requireSensitive(session);if(actor.role==='Member')throw new Error('Forbidden.');
  const data=parse(z.object({kind:z.enum(['activity','access','configuration','version']),filters:filters.default({offset:0,limit:50})}).strict(),input);
  const operation=this.store.journal.start(actor.id,'evidence.export',data.kind,this.store.state.revision);
  this.store.requireSensitive(session);this.store.authorize(session,'instance');
  const safe=evidenceSanitizer(this.store);
  let report:unknown;
  if(data.kind==='activity'){const q=this.select(session,data.filters);report={entries:this.sanitize(q.matches.slice(data.filters.offset,data.filters.offset+500),safe),bounded:true,maximumRows:500,truncated:q.matches.length>data.filters.offset+500,filters:Object.fromEntries(Object.entries(data.filters).map(([key,value])=>[key,typeof value==='string'?safe(value):value]))};}
  else if(data.kind==='access'){report={users:this.store.state.users.map(u=>({id:safe(u.id),contact:safe(u.email),role:u.role,active:u.active,enrolled:u.enrolled!==false})),external:(this.store.state.people?.external??[]).map(e=>({id:safe(e.id),label:safe(e.label),active:e.active})),services:Object.entries(this.store.state.managed?.services??{}).map(([id,s])=>({id:safe(id),lifecycle:s.lifecycle,assignments:s.assignments.map(safe)}))};}
  else if(data.kind==='configuration'){const manager=consoleServices(this.store);report={revision:manager.state.revision,services:manager.list(session).services.map(s=>({id:safe(s.id),name:safe(s.name),lifecycle:s.lifecycle,exceptions:s.exceptions.map(e=>safe(e))})),limits:this.store.state.config?.limits,retentionDays:this.retention.days,authenticationMode:this.store.state.config?.auth.mode,responseProtectionSource:'Settings',backup:consoleBackups(this.store).health(),restore:{phase:this.store.state.recovery?.phase??'not restored',recoveryPoint:this.store.state.recovery?.recoveryPoint??null,importedDomains:this.store.state.importedAudit?.length??0,notice:this.store.state.recovery?.notice??'Whole-instance recovery requires independent material and current Owner or protected host authority.'}};}
  else report={version:PACKAGE_VERSION,instance:this.store.state.id,backup:consoleBackups(this.store).health(),restore:{phase:this.store.state.recovery?.phase??'not restored',recoveryPoint:this.store.state.recovery?.recoveryPoint??null}};
  const result={operation,kind:data.kind,report};if(Buffer.byteLength(JSON.stringify(result))>2*1024*1024){this.store.journal.finish(operation,actor.id,'evidence.export',data.kind,this.store.state.revision,'failed');throw new EvidenceError('Export exceeds 2 MiB. Narrow the scope.');}
  this.store.requireSensitive(session);this.store.journal.finish(operation,actor.id,'evidence.export',data.kind,this.store.state.revision);return result;
 }
 retentionImpact(cutoff:number){return this.store.journal.retentionCandidates(cutoff).length+(this.store.externalAudit?.retentionImpact(cutoff)??0)+this.importedImpact(cutoff);}
 readRetention(session:ConsoleSession){const actor=this.store.authorize(session,'instance');return {...this.retention,revision:this.store.state.revision,writable:actor.role==='Owner'&&!session.restricted&&!this.store.journal.degraded&&!this.store.externalAudit?.degraded};}
 private owner(session:ConsoleSession){const actor=this.store.requireSensitive(session);if(actor.role!=='Owner')throw new Error('Forbidden.');return actor;}
 saveRetention(session:ConsoleSession,input:unknown){const actor=this.owner(session),d=parse(z.object({days:z.number().int().min(1).max(36500),base:z.number().int().nonnegative(),generation:z.number().int().nonnegative()}).strict(),input);if(d.base!==this.store.state.revision||d.generation!==(this.retention.draft?.generation??0))throw new EvidenceError('Stale retention draft. Reload and review again.');const operation=this.store.commit(actor.id,'retention.save','audit',s=>{s.retention={days:this.retention.days,draft:{...d,base:d.base+1,generation:d.generation+1,baseDays:this.retention.days}};});return {operation,status:'saved'};}
 reviewRetention(session:ConsoleSession,input:unknown){const actor=this.owner(session);parse(z.object({}).strict(),input);const draft=this.retention.draft;if(!draft)throw new EvidenceError('Save a retention draft first.');if(draft.base!==this.store.state.revision)throw new EvidenceError('Stale retention draft. Save again before review.');const cutoff=Date.now()-draft.days*86400000,impact=this.store.journal.retentionCandidates(cutoff).length+(this.store.externalAudit?.retentionImpact(cutoff)??0)+this.importedImpact(cutoff),id=randomUUID();const operation=this.store.commit(actor.id,'retention.review','audit',s=>{s.retention!.review={id,actor:actor.id,base:this.store.state.revision+1,generation:draft.generation,cutoff,impact};});return {operation,review:id,currentDays:this.retention.days,proposedDays:draft.days,cutoff,recordsToDelete:impact,notice:'Expired evidence will be deleted. Unresolved operations and live revocation intents remain. Imported source segments are deleted only when wholly expired with no unresolved outcomes; their source/head receipt stays in local audit. Keep independently protected external copies against hostile host alteration and host loss.'};}
 applyRetention(session:ConsoleSession,input:unknown){const actor=this.owner(session),d=parse(z.object({review:z.string().uuid(),confirmed:z.literal(true)}).strict(),input),r=this.retention.review,draft=this.retention.draft;if(!r||!draft||r.id!==d.review||r.actor!==actor.id||r.base!==this.store.state.revision||r.generation!==draft.generation)throw new EvidenceError('Stale retention review. Reload and review again.');const operation=this.store.commit(actor.id,'retention.apply','audit',s=>{s.retention={days:draft.days};});this.sweep(actor.id,r.cutoff);return {operation,status:'applied',days:draft.days};}
 sweep(actor='system',cutoff=Date.now()-this.retention.days*86400000):number {if(this.store.mutationsBlocked()||this.store.journal.degraded||this.store.externalAudit?.degraded||!this.store.storageReliable)throw new Error('Durable audit unavailable');const count=this.store.journal.retentionCandidates(cutoff).length+(this.store.externalAudit?.retentionImpact(cutoff)??0)+this.importedImpact(cutoff);if(!count)return 0;const operation=this.store.journal.start(actor,'retention.delete','audit',this.store.state.revision);let deleted=0;try{for(const d of this.expiredImported(cutoff)){this.store.commit(actor,'audit.retention','Imported source '+d.instance+' archive '+d.archive+' domain '+d.domain+' identity '+d.data.identity+' head '+d.data.head+' expired rows '+d.entries.length,s=>{s.importedAudit=s.importedAudit!.filter(v=>v.domain!==d.domain||v.data.identity!==d.data.identity||v.data.head!==d.data.head);});deleted+=d.entries.length;}deleted+=this.store.externalAudit?.retain(cutoff,actor)??0;deleted+=this.store.journal.compact(cutoff,actor);this.store.journal.finish(operation,actor,'retention.delete','audit',this.store.state.revision);return deleted;}catch{throw new EvidenceError('Retention completion is uncertain. Inspect activity after host repair.');}}
}
const managers=new WeakMap<ConsoleStore,ConsoleEvidence>();
export function consoleEvidence(store:ConsoleStore){let e=managers.get(store);if(!e){e=new ConsoleEvidence(store);managers.set(store,e);}return e;}
