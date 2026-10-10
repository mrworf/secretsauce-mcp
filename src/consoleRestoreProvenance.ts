import {digest} from './consoleCrypto.js';
import {sanitizeAuditText} from './auditSanitizer.js';
import type {AuditRecoveryDomain,RecoveryPayload} from './consoleBackupArchive.js';
import type {ConsoleState} from './consoleStore.js';
export interface ImportedAudit {
 instance:string;archive:string;recoveryPoint:number;domain:'management'|'gateway';data:AuditRecoveryDomain;
 secrets:string[];
 lastEvidenceTime:number;
 entries:Array<{id:string;operation?:string;time:number;actor:string;service:string;action:string;result:string;requestId?:string;revision:number;reason:string}>;
}
export function recoverySecrets(s:ConsoleState|RecoveryPayload['state']):string[]{const cfg=s.config as ConsoleState['config'],managed=s.managed as ConsoleState['managed'],notifications=s.notifications as ConsoleState['notifications'];return [...Object.values(cfg?.services??{}).flatMap(v=>v.credentials.map(c=>c.secret)),...Object.values(managed?.services??{}).flatMap(v=>Object.values(v.values).map(c=>c.value)),notifications?.applied?.password??''].filter(Boolean);}
export function importedAudit(payload:RecoveryPayload,archive:string,currentSecrets:string[]):ImportedAudit[]{
 const deadline=performance.now()+2000,secrets=[...new Set([...currentSecrets,...recoverySecrets(payload.state)])],result:ImportedAudit[]=[];
 const sources=[...(payload.state.importedAudit??[]),...Object.entries(payload.audit).map(([domain,data])=>({instance:payload.state.id,archive,recoveryPoint:payload.manifest.recoveryPoint,domain:domain as 'management'|'gateway',data,secrets}))];
 for(const source of sources){const {domain,data}=source,sourceSecrets=[...new Set([...source.secrets,...secrets])],safe=(s:unknown)=>sanitizeAuditText(String(s??''),sourceSecrets).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,2048);if(performance.now()>deadline)throw Error('Imported audit work deadline');
  const prior=result.find(d=>d.domain===domain&&d.data.identity===data.identity&&d.data.chain.split('\n')[0]===data.chain.split('\n')[0]);
  if(prior&&prior.data.chain.startsWith(data.chain))continue;
  if(prior&&!data.chain.startsWith(prior.data.chain))throw Error('Conflicting imported audit ancestry; inspect source archive.');
  const records=data.chain.trim().split('\n').map(v=>JSON.parse(v).record as Record<string,unknown>);if(records.some(r=>!r||typeof r.id!=='string'||typeof r.actor!=='string'||typeof r.action!=='string'||typeof r.target!=='string'||!['start','complete','recovery'].includes(String(r.phase))||!Number.isFinite(r.time)||!Number.isSafeInteger(r.revision)||Number(r.revision)<0))throw Error('Invalid archived audit record');const done=new Map(records.filter(r=>r.phase==='complete').map(r=>[r.id,r])),started=new Set(records.filter(r=>r.phase==='start').map(r=>r.id));
  const entries:ImportedAudit['entries']=records.filter(r=>r.action!=='audit.event'&&(r.phase!=='complete'||!started.has(r.id))).map(r=>({id:'operation:'+safe(r.id),operation:safe(r.id),time:Number(r.time),actor:safe(r.actor),service:Object.hasOwn((payload.state.managed as NonNullable<ConsoleState['managed']>).services,String(r.target))?safe(r.target):'',action:safe(r.action),result:safe(done.get(r.id)?.result??(r.phase==='start'?'uncertain':r.result??'success')),revision:Number(r.revision),reason:safe(r.target)}));
  for(const line of data.events?.trim().split('\n').filter(Boolean)??[]){const e=JSON.parse(line) as Record<string,unknown>;entries.push({id:'gateway:'+digest(JSON.stringify(e)),time:Date.parse(String(e.timestamp??e.request_timestamp)),actor:safe(e.subject),service:safe(e.service),action:safe(e.tool??e.type),result:safe(e.error_code?(e.policy_decision==='deny'?'deny':'error'):e.outcome??e.policy_decision??'success'),...(typeof e.request_id==='string'?{requestId:safe(e.request_id)}:{}),revision:Number(e.admitted_revision??0),reason:safe(e.error_message??e.error_code??e.matched_policy_rule??e.reason)});}
  if(entries.some(e=>!Number.isFinite(e.time)||!Number.isSafeInteger(e.revision)||e.revision<0))throw Error('Invalid archived evidence record');const lastEvidenceTime=records.reduce((n,r)=>Math.max(n,Number(r.time)),entries.reduce((n,e)=>Math.max(n,e.time),0));if(!Number.isFinite(lastEvidenceTime))throw Error('Invalid archived evidence time');
  const item:ImportedAudit={instance:prior?.instance??source.instance,archive:prior?.archive??source.archive,recoveryPoint:source.recoveryPoint,domain,data,lastEvidenceTime,secrets:[...new Set(sourceSecrets)],entries};if(prior)result[result.indexOf(prior)]=item;else result.push(item);
 }
 if(performance.now()>deadline)throw Error('Imported audit work deadline');if(result.length>32||result.reduce((n,v)=>n+v.entries.length,0)>100000||Buffer.byteLength(JSON.stringify(result))>64*1024*1024)throw Error('Imported audit capacity reached; inspect retained source evidence.');return result;
}
