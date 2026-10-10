import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync, statSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac } from 'node:crypto';
import { atomicFile } from './consolePersistence.js';
import { equal, randomSecret } from './consoleCrypto.js';
export interface ManagementDetails {
    channel?: string; credential?: string; credentialVersion?: number; identity?: string; grant?: string; grantExpires?: number }
export interface OperationRecord {
    details?: ManagementDetails;
    id: string;
    phase: 'start' | 'complete' | 'recovery';
    actor: string;
    action: string;
    target: string;
    time: number;
    revision: number;
    result?: 'success' | 'failed';
}
export class ConsoleJournal {
    #head = '';
    #records: OperationRecord[] = [];
    degraded = false;
    readonly path: string;
    constructor(path: string, private key: Buffer, private fault?: (phase?: string) => void) {
        this.path = path;
        try {
            this.recoverRetention();
            if (existsSync(path) && statSync(path).size > 64 * 1024 * 1024) throw new Error('Audit capacity exceeded');
            if (existsSync(path)) {
                const checkpoint = readFileSync(path + '.head', 'utf8');
                let trusted = 0;
                const text = readFileSync(path, 'utf8');
                if (text && !text.endsWith('\n'))
                    throw new Error('Incomplete audit');
                for (const line of text.trim().split('\n').filter(Boolean)) {
                    const item = JSON.parse(line);
                    const mac = this.mac(item.record, this.#head);
                    if (item.previous !== this.#head || !equal(mac, item.mac))
                        throw new Error('Audit integrity failure');
                    this.#head = mac;
                    this.#records.push(item.record);
                    if (mac === checkpoint)
                        trusted = this.#records.length;
                }
                if (this.#head !== checkpoint) {
                    this.#records = this.#records.slice(0, trusted);
                    throw new Error('Audit checkpoint mismatch');
                }
            }
            else if (existsSync(path + '.head'))
                throw new Error('Audit history missing');
            this.append({ id: randomSecret(), phase: 'recovery', actor: 'system', action: 'audit.restart_verified', target: 'Prior outage interval or lost evidence may be unknown; durable append verified.', time: Date.now(), revision: 0 });
        }
        catch {
            this.degraded = true;
        }
    }
    private mac(record: OperationRecord, previous: string) { return createHmac('sha256', this.key).update(previous + '\n' + JSON.stringify(record)).digest('hex'); }
    append(record: OperationRecord): void {
        if (this.degraded)
            throw new Error('Durable audit unavailable');
        let fd: number | undefined;
        try {
            this.fault?.('append');
            if (this.#records.length >= 100000 || (existsSync(this.path) && statSync(this.path).size >= 64 * 1024 * 1024)) throw new Error('Audit capacity exceeded');
            const mac = this.mac(record, this.#head);
            const data = Buffer.from(JSON.stringify({ previous: this.#head, record, mac }) + '\n');
            fd = openSync(this.path, 'a', 0o600);
            let offset = 0;
            while (offset < data.length) {
                const n = writeSync(fd, data, offset);
                if (n <= 0)
                    throw new Error('No write progress');
                offset += n;
            }
            fsyncSync(fd);
            const directory = openSync(dirname(this.path), 'r');
            try {
                this.fault?.('directory');
                fsyncSync(directory);
            }
            finally {
                closeSync(directory);
            }
            this.fault?.('checkpoint');
            atomicFile(this.path + '.head', mac);
            this.#head = mac;
            this.#records.push(record);
        }
        catch {
            this.degraded = true;
            throw new Error('Durable audit unavailable');
        }
        finally {
            if (fd !== undefined)
                closeSync(fd);
        }
    }
    start(actor: string, action: string, target: string, revision = 0, details?: ManagementDetails): string { const id = randomSecret(); this.append({ id, actor, action, target, revision, time: Date.now(), phase: 'start', ...(details ? { details } : {}) }); return id; }
    finish(id: string, actor: string, action: string, target: string, revision = 0, result: 'success' | 'failed' = 'success', details?: ManagementDetails): void { this.append({ id, actor, action, target, revision, result, time: Date.now(), phase: 'complete', ...(details ? { details } : {}) }); }
    status(id: string): 'unknown' | 'uncertain' | 'success' | 'failed' { const list = this.#records.filter(r => r.id === id); const done = list.findLast(r => r.phase === 'complete'); return done?.result ?? (list.length ? 'uncertain' : 'unknown'); }
    verifyEventDigests(values: string[]): boolean { return JSON.stringify(this.#records.filter(r => r.action === 'audit.event').map(r => r.target)) === JSON.stringify(values); }
    entries(): OperationRecord[] { return this.#records.map(r => ({ ...r })); }
    verify(): boolean {
        try {
            if (this.degraded || statSync(this.path).size > 64 * 1024 * 1024) return false;
            let head = '';
            const records: OperationRecord[] = [];
            const deadline=performance.now()+2000;
            const text = readFileSync(this.path, 'utf8');
            if (!text.endsWith('\n')) throw new Error('Incomplete audit');
            for (const line of text.trim().split('\n').filter(Boolean)) {
                const item = JSON.parse(line), mac = this.mac(item.record, head);
                if (item.previous !== head || !equal(mac, item.mac)) throw new Error('Audit integrity failure');
                head = mac; records.push(item.record);
                if(records.length>100000||(records.length%256===0&&performance.now()>deadline))throw new Error('Audit verification capacity');
            }
            if (head !== this.#head || head !== readFileSync(this.path + '.head','utf8') || JSON.stringify(records) !== JSON.stringify(this.#records)) throw new Error('Audit checkpoint mismatch');
            return true;
        } catch { this.degraded = true; return false; }
    }
    retentionCandidates(cutoff: number): OperationRecord[] {
        const finished = new Set(this.#records.filter(r => r.phase === 'complete').map(r => r.id));
        const unfinished = new Set(this.#records.filter(r => r.phase === 'start' && !finished.has(r.id)).map(r => r.id));
        return this.#records.filter(r => r.time < cutoff && !unfinished.has(r.id) && !(r.details?.grantExpires && r.details.grantExpires > Date.now()) && r.action !== 'audit.retention');
    }
    compact(cutoff: number, actor: string, gatewayRaw?: string): number {
        if (!this.verify()) throw new Error('Durable audit unavailable');
        const candidates = this.retentionCandidates(cutoff), removed = new Set(candidates);
        const kept = this.#records.filter(r => !removed.has(r));
        const oldHead = this.#head;
        kept.push({id:randomSecret(),phase:'complete',actor,action:'audit.retention',target:JSON.stringify({cutoff,deleted:candidates.length,previousHead:oldHead}),time:Date.now(),revision:0,result:'success'});
        let head = '';
        const chain = kept.map(record => { const previous=head; head=this.mac(record,previous); return JSON.stringify({previous,record,mac:head})+'\n'; }).join('');
        // An authenticated, fsynced redo record makes all chain/checkpoint/raw replacements recoverable.
        const data = JSON.stringify({chain,head,...(gatewayRaw === undefined ? {} : {gatewayRaw})});
        const mac = createHmac('sha256',this.key).update(data).digest('hex');
        try { atomicFile(this.path+'.retention',JSON.stringify({data,mac})); this.fault?.('retention-prepared'); this.recoverRetention(); this.#records=kept;this.#head=head; }
        catch { this.degraded=true;throw new Error('Retention completion is uncertain; repair host storage and restart.'); }
        return candidates.length;
    }
    private recoverRetention(): void {
        const pending=this.path+'.retention';
        if(!existsSync(pending))return;
        if(statSync(pending).size>128*1024*1024)throw new Error('Invalid retention checkpoint');
        const envelope=JSON.parse(readFileSync(pending,'utf8'));
        if(typeof envelope.data!=='string'||!equal(createHmac('sha256',this.key).update(envelope.data).digest('hex'),envelope.mac))throw new Error('Invalid retention checkpoint');
        const payload=JSON.parse(envelope.data);
        if(typeof payload.chain!=='string'||typeof payload.head!=='string')throw new Error('Invalid retention checkpoint');
        if(payload.gatewayRaw!==undefined){if(!this.path.endsWith('.chain')||typeof payload.gatewayRaw!=='string')throw new Error('Invalid retention checkpoint');atomicFile(this.path.slice(0,-6),payload.gatewayRaw);}
        atomicFile(this.path,payload.chain); this.fault?.('retention-chain'); atomicFile(this.path+'.head',payload.head);
        rmSync(pending);const directory=openSync(dirname(pending),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
    }
    actorFor(id: string): string | undefined { return this.#records.find(r => r.id === id)?.actor; }
}
