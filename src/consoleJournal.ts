import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac } from 'node:crypto';
import { atomicFile } from './consolePersistence.js';
import { equal, randomSecret } from './consoleCrypto.js';
export interface ManagementDetails {
    channel?: string; credential?: string; credentialVersion?: number; identity?: string }
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
    actorFor(id: string): string | undefined { return this.#records.find(r => r.id === id)?.actor; }
}
