import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { createLogger } from "./logger.js";
import type { GatewayConfig } from "./types.js";
import { randomBytes } from 'node:crypto';
import { ConsoleJournal } from './consoleJournal.js';
import { atomicFile, type ConsoleStore } from './consoleStore.js';
import { digest, randomSecret } from './consoleCrypto.js';
import { GatewayError } from './errors.js';
import { sanitizeAuditEvent } from "./auditSanitizer.js";

export interface ReferenceIssuedAuditEvent {
  type: "reference_issued";
  subject: string;
  service: string;
  destination: string;
  access_ids: string[];
  internal_reference_ids: string[];
  reason: string;
  timestamp: string;
}

export interface ServiceRequestAuditEvent {
  type: "service_request";
  request_id: string;
  subject: string;
  service: string;
  destination: string;
  access_ids: string[];
  internal_reference_ids: string[];
  method: string;
  target_host: string;
  target_path: string;
  policy_decision: "allow" | "deny";
  matched_policy_rule?: string;
  downstream_status_code?: number;
  request_timestamp: string;
  request_duration_ms: number;
  tls_verify: boolean;
  secret_tokenization_count: number;
  secret_rule_ids?: string[];
  response_internal_reference_ids?: string[];
  binary_scan_bypassed?: boolean;
  error_code?: string;
  error_message?: string;
}

export interface InvalidOpaqueResponseReferencesAuditEvent {
  type: "invalid_opaque_response_references";
  request_id: string;
  subject: string;
  service: string;
  destination: string;
  warnings: Array<{ prefix: "gref" | "sec"; reason: "unknown" | "expired" | "wrong_subject" | "wrong_service"; count: number }>;
  timestamp: string;
}

export interface ToolInvocationAuditEvent {
  type: "tool_invocation";
  subject: string;
  tool: "list_services" | "describe_service_policy" | "get_gateway_service_references" | "service_request" | "explain_denial";
  outcome: "allow" | "deny" | "error";
  service?: string;
  request_id?: string;
  error_code?: string;
  timestamp: string;
}

export type AuditEvent = ReferenceIssuedAuditEvent | ServiceRequestAuditEvent | ToolInvocationAuditEvent | InvalidOpaqueResponseReferencesAuditEvent;

export interface AuditFileOperations {
  ensureDirectory(path: string): void;
  open(path: string): number;
  write(fd: number, buffer: Uint8Array, offset: number, length: number): number;
  close(fd: number): void;
  sync?(fd: number): void;
}

const defaultFileOperations: AuditFileOperations = {
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
  open: (path) => openSync(path, "a", 0o600),
  write: (fd, buffer, offset, length) => writeSync(fd, buffer, offset, length),
  close: (fd) => closeSync(fd),
  sync: (fd) => fsyncSync(fd),
};

export class AuditSink {
  readonly #events: AuditEvent[] = [];
  readonly #logger;
  #fd: number | undefined;
  #degraded = false;
  #closed = false;
  #writer: SharedAuditWriter | undefined;
  #console: ConsoleStore | undefined;
  readonly file: string;

  constructor(
    readonly config: GatewayConfig,
    private readonly fileOperations: AuditFileOperations = defaultFileOperations,
  ) {
    this.#logger = createLogger(config.logging);
    this.file = resolve(config.audit.file ?? join(process.env.AUDIT_STORAGE_DIR ?? "data", "gateway.jsonl"));
    this.initializeFile();
    try { if (!this.#degraded) { this.#writer = acquireAuditWriter(this.file); if(this.fileOperations===defaultFileOperations){this.fileOperations.close(this.#fd!);this.#fd=this.fileOperations.open(this.file);} } } catch { this.markDegraded("open"); }
  }

  get events(): readonly AuditEvent[] {
    return this.#events;
  }

  get degraded(): boolean {
    return this.#closed || this.#degraded || this.#writer?.journal.degraded === true || this.#console?.journal.degraded === true || this.#console?.storageReliable === false;
  }

  get closed(): boolean {
    return this.#closed;
  }

  clear(): void {
    this.#events.length = 0;
  }

  record(event: AuditEvent): AuditEvent {
    const sanitizedEvent = sanitizeAuditEvent(event, this.config);
    this.#events.push(sanitizedEvent);
    const capacity = this.config.audit.memoryEvents;
    if (this.#events.length > capacity) this.#events.splice(0, this.#events.length - capacity);
    if (this.#fd === undefined || this.#closed || this.#degraded) return sanitizedEvent;
    this.writeRecord(Buffer.from(`${JSON.stringify(sanitizedEvent)}\n`, "utf8"));
    if (!this.#degraded && this.#writer) try { this.#writer.journal.append({id:randomSecret(),phase:'complete',actor:'system',action:'audit.event',target:digest(JSON.stringify(sanitizedEvent)),time:Date.now(),revision:0,result:'success'}); } catch { this.markDegraded('write'); }
    return sanitizedEvent;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#writer) { releaseAuditWriter(this.file, this.#writer); this.#writer=undefined; }
    const fd = this.#fd;
    this.#fd = undefined;
    if (fd === undefined) return;
    try {
      this.fileOperations.close(fd);
    } catch {
      this.markDegraded("close");
    }
  }

  bindConsole(store: ConsoleStore): void { this.#console=store; store.externalAudit=this; }

  admit(action: string, actor: string, target: string, operation?: string): string {
    if(this.degraded || this.#closed || !this.#writer || !this.fileOperations.sync) throw new GatewayError('audit_unavailable','Sensitive action unavailable: durable audit could not be recorded.',operation);
    const metadata=sanitizeAuditEvent({type:"reference_issued",subject:actor,reason:target,service:"",destination:"",access_ids:[],internal_reference_ids:[],timestamp:""},this.config) as ReferenceIssuedAuditEvent;
    actor=metadata.subject;target=metadata.reason;
    const id=operation ?? randomSecret();
    try {this.#writer.journal.append({id,phase:'start',actor,action,target,time:Date.now(),revision:this.#console?.state.revision??0});return id;}
    catch {this.markDegraded('write');throw new GatewayError('audit_unavailable','Sensitive action unavailable: durable audit could not be recorded.',id);}
  }
  complete(id:string,actor:string,action:string,target:string,result:'success'|'failed'='success'):void {
    if(this.degraded || !this.#writer)throw new GatewayError('audit_unavailable','Operation completion is uncertain. Inspect operation status before taking another action.',id);
    const metadata=sanitizeAuditEvent({type:"reference_issued",subject:actor,reason:target,service:"",destination:"",access_ids:[],internal_reference_ids:[],timestamp:""},this.config) as ReferenceIssuedAuditEvent;
    actor=metadata.subject;target=metadata.reason;
    try{this.#writer.journal.finish(id,actor,action,target,this.#console?.state.revision??0,result);}catch{this.markDegraded('write');throw new GatewayError('audit_unavailable','Operation completion is uncertain. Inspect operation status before taking another action.',id);}
  }
  operationActor(id:string):string|undefined{return this.#writer?.journal.actorFor(id);}
  operationStatus(id:string):'unknown'|'uncertain'|'success'|'failed'{return this.#writer?.journal.status(id)??'unknown';}

  evidence(): { operations: import('./consoleJournal.js').OperationRecord[]; events: AuditEvent[]; verified: boolean } {
    const journal=this.#writer?.journal;
    if(!journal) return {operations:[],events:[],verified:false};
    let events:AuditEvent[]=[];let verified=journal.verify();
    try { if(statSync(this.file).size>64*1024*1024)throw new Error('Audit capacity');const raw=readFileSync(this.file,'utf8');if(raw&&!raw.endsWith('\n'))throw new Error('Audit incomplete');const deadline=performance.now()+2000;for(const line of raw.trim().split('\n').filter(Boolean)){events.push(JSON.parse(line));if(events.length>100000||(events.length%256===0&&performance.now()>deadline))throw new Error('Audit query capacity');}verified=verified&&journal.verifyEventDigests(events.map(e=>digest(JSON.stringify(e))));if(!verified)this.markDegraded('write'); }
    catch {this.markDegraded('write');verified=false;}
    return {operations:journal.entries().filter(r=>r.action!=='audit.event'),events,verified};
  }
  retentionImpact(cutoff:number):number {return this.#writer?.journal.retentionCandidates(cutoff).length??0;}
  retain(cutoff:number,actor:string):number {
    if(this.degraded||this.fileOperations!==defaultFileOperations||!this.#writer||this.#writer.refs>1)throw new Error('Durable audit unavailable');
    const evidence=this.evidence();if(!evidence.verified)throw new Error('Durable audit unavailable');
    const remove=new Set(this.#writer.journal.retentionCandidates(cutoff).filter(r=>r.action==='audit.event').map(r=>r.target));
    const raw=evidence.events.filter(e=>!remove.has(digest(JSON.stringify(e)))).map(e=>JSON.stringify(e)+'\n').join('');
    this.fileOperations.close(this.#fd!);this.#fd=undefined;
    try {const count=this.#writer.journal.compact(cutoff,actor,raw);this.#fd=this.fileOperations.open(this.file);return count;}
    catch {this.markDegraded('write');throw new Error('Retention completion is uncertain.');}
  }
  private initializeFile(): void {
    const path = this.file;
    try {
      this.fileOperations.ensureDirectory(dirname(path));
      if(existsSync(path)&&statSync(path).size>64*1024*1024)throw new Error("Audit capacity exhausted");
      this.#fd = this.fileOperations.open(path);
      if (this.fileOperations === defaultFileOperations) { fsyncSync(this.#fd); const dir = openSync(dirname(path), "r"); try { fsyncSync(dir); } finally { closeSync(dir); } }
    } catch {
      this.markDegraded("open");
    }
  }

  private writeRecord(record: Uint8Array): void {
    const fd = this.#fd;
    if (fd === undefined) return;
    try {
      if(this.fileOperations===defaultFileOperations&&statSync(this.file).size+record.length>64*1024*1024)throw new Error("Audit capacity exhausted");
      let offset = 0;
      while (offset < record.length) {
        const written = this.fileOperations.write(fd, record, offset, record.length - offset);
        if (!Number.isInteger(written) || written <= 0) throw new Error("Audit write made no progress.");
        offset += written;
      }
      this.fileOperations.sync?.(fd);
    } catch {
      this.markDegraded("write");
    }
  }

  private markDegraded(operation: "open" | "write" | "close"): void {
    this.#degraded = true;
    this.#logger.error("audit.write_failed", { operation });
  }
}

const fallbackAuditEvents: AuditEvent[] = [];

export function getAuditEvents(sink?: AuditSink): readonly AuditEvent[] {
  return sink?.events ?? fallbackAuditEvents;
}

export function clearAuditEvents(sink?: AuditSink): void {
  if (sink !== undefined) sink.clear();
  else fallbackAuditEvents.length = 0;
}

export function audit(event: AuditEvent, sink?: AuditSink): AuditEvent {
  if (sink !== undefined) return sink.record(event);
  const sanitizedEvent = sanitizeAuditEvent(event);
  fallbackAuditEvents.push(sanitizedEvent);
  if (fallbackAuditEvents.length > 1000) fallbackAuditEvents.splice(0, fallbackAuditEvents.length - 1000);
  return sanitizedEvent;
}

export function referenceIssuedAuditEvent(input: ReferenceIssuedAuditEvent, sink?: AuditSink): ReferenceIssuedAuditEvent {
  return audit(input, sink) as ReferenceIssuedAuditEvent;
}

interface SharedAuditWriter {journal:ConsoleJournal;refs:number;lock:string;}
const writers=new Map<string,SharedAuditWriter>();
function acquireAuditWriter(file:string):SharedAuditWriter {
  const existing=writers.get(file);if(existing){existing.refs++;return existing;}
  const lock=file+'.writer';
  if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));try{process.kill(pid,0);throw new Error('Audit writer already active');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}rmSync(lock);}
  writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});
  try {
    const keyFile=file+'.key',chain=file+'.chain',marker=file+'.managed';
    if(existsSync(marker)&&(!existsSync(keyFile)||!existsSync(chain)))throw new Error('Audit integrity material missing');
    if(!existsSync(keyFile))atomicFile(keyFile,randomBytes(32).toString('hex'));
    const key=Buffer.from(readFileSync(keyFile,'utf8').trim(),'hex');if(key.length!==32 || statSync(keyFile).mode & 0o077)throw new Error('Audit integrity material invalid');
    const journal=new ConsoleJournal(chain,key);if(journal.degraded)throw new Error('Audit integrity failure');
    const raw=readFileSync(file,'utf8');const lines=raw.trim().split('\n').filter(Boolean);
    if(!existsSync(marker)) {journal.start('host','audit.initialize','instance');for(const line of lines){JSON.parse(line);journal.append({id:randomSecret(),phase:'complete',actor:'system',action:'audit.event',target:digest(JSON.stringify(JSON.parse(line))),time:Date.now(),revision:0,result:'success'});}atomicFile(marker,'1');}
    else if(!journal.verifyEventDigests(lines.map(line=>digest(JSON.stringify(JSON.parse(line))))))throw new Error('Audit event integrity failure');
    const writer={journal,refs:1,lock};writers.set(file,writer);return writer;
  } catch(error){rmSync(lock,{force:true});throw error;}
}
function releaseAuditWriter(file:string,writer:SharedAuditWriter):void {writer.refs--;if(writer.refs<=0){writers.delete(file);rmSync(writer.lock,{force:true});}}
