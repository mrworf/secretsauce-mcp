import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac } from 'node:crypto';
import { equal, randomSecret } from './consoleCrypto.js';
export interface OperationRecord {
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
    constructor(path: string, private key: Buffer, private fault?: (phase?: string) => void) { this.path = path; try {
        if (existsSync(path)) {
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
            }
        }
    }
    catch {
        this.degraded = true;
    } }
    private mac(record: OperationRecord, previous: string) { return createHmac('sha256', this.key).update(previous + '\n' + JSON.stringify(record)).digest('hex'); }
    append(record: OperationRecord): void { if (this.degraded)
        throw new Error('Durable audit unavailable'); let fd: number | undefined; try {
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
    } }
    start(actor: string, action: string, target: string, revision = 0): string { const id = randomSecret(); this.append({ id, actor, action, target, revision, time: Date.now(), phase: 'start' }); return id; }
    finish(id: string, actor: string, action: string, target: string, revision = 0, result: 'success' | 'failed' = 'success'): void { this.append({ id, actor, action, target, revision, result, time: Date.now(), phase: 'complete' }); }
    status(id: string): 'unknown' | 'uncertain' | 'success' | 'failed' { const list = this.#records.filter(r => r.id === id); const done = list.findLast(r => r.phase === 'complete'); return done?.result ?? (list.length ? 'uncertain' : 'unknown'); }
    actorFor(id: string): string | undefined { return this.#records.find(r => r.id === id)?.actor; }
}
