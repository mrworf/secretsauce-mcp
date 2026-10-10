import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { decrypt, digest, encrypt, equal, newSeed, passwordHash, randomSecret, totp, validatePassword } from './consoleCrypto.js';
import { ConsoleJournal } from './consoleJournal.js';
import type { GatewayConfig } from './types.js';
export type HumanRole = 'Owner' | 'Administrator' | 'Auditor' | 'Member';
export interface ConsoleUser {
    id: string;
    email: string;
    role: HumanRole;
    active: boolean;
    password: string;
    seed: string;
    lastCounter: number;
    recoveryHashes: string[];
    attempts: number;
    blockedUntil: number;
}
export interface ConsoleSession {
    id: string;
    userId: string;
    hash: string;
    csrf: string;
    created: number;
    lastSeen: number;
    restricted: boolean;
    recent?: {
        action: string;
        expires: number;
    };
}
export interface ConsoleState {
    v: 1;
    id: string;
    revision: number;
    initialized: boolean;
    origin: string;
    name: string;
    config?: GatewayConfig;
    users: ConsoleUser[];
    sessions: ConsoleSession[];
    proof?: {
        hash: string;
        expires: number;
        attempts: number;
    };
    enrollment?: {
        hash: string;
        expires: number;
        attempts: number;
        seed: string;
        email: string;
        password: string;
        name: string;
        origin: string;
        recovery: string[];
        backup: string;
    };
    backupHash?: string;
}
export function atomicFile(path: string, value: string): void { const temp = path + '.pending'; let fd: number | undefined; try {
    fd = openSync(temp, 'w', 0o600);
    writeFileSync(fd, value);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, path);
    const directory = openSync(join(path, '..'), 'r');
    try {
        fsyncSync(directory);
    }
    finally {
        closeSync(directory);
    }
}
finally {
    if (fd !== undefined)
        closeSync(fd);
} }
export function trustedOrigin(value: unknown): string { if (typeof value !== 'string')
    throw new Error('Use a trusted HTTPS origin.'); const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash)
    throw new Error('Use a trusted HTTPS origin.'); return u.origin; }
export class ConsoleStore {
    state: ConsoleState;
    readonly journal: ConsoleJournal;
    readonly file: string;
    readonly key: Buffer;
    #lock: string;
    #closed = false;
    constructor(readonly directory: string, keyFile: string, options: {
        config?: GatewayConfig;
        faultAudit?: () => void;
        faultState?: () => void;
    } = {}) {
        this.key = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'hex');
        if (this.key.length !== 32 || statSync(keyFile).mode & 0o077)
            throw new Error('Protected encryption material required');
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        this.#lock = join(directory, 'writer.lock');
        if (existsSync(this.#lock)) {
            const pid = Number(readFileSync(this.#lock, 'utf8'));
            let live = false;
            try {
                process.kill(pid, 0);
                live = true;
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
                    throw new Error('Writer ownership could not be established');
            }
            if (live)
                throw new Error('One writable application instance required');
            rmSync(this.#lock);
        }
        writeFileSync(this.#lock, String(process.pid), { flag: 'wx', mode: 0o600 });
        this.file = join(directory, 'state.enc');
        try {
            if (existsSync(join(directory, 'managed')) && !existsSync(this.file))
                throw new Error('Managed state missing');
            this.state = existsSync(this.file) ? decrypt<ConsoleState>(readFileSync(this.file, 'utf8'), this.key) : { v: 1, id: randomUUID(), revision: 0, initialized: false, origin: '', name: '', users: [], sessions: [], ...(options.config ? { config: options.config } : {}) };
            if (this.state.v !== 1 || !Array.isArray(this.state.users) || !Array.isArray(this.state.sessions))
                throw new Error('Invalid managed state');
            this.journal = new ConsoleJournal(join(directory, 'audit.chain'), this.key, options.faultAudit);
            this.faultState = options.faultState;
            if (!existsSync(this.file)) {
                this.save(this.state);
                atomicFile(join(directory, 'managed'), '1');
            }
        }
        catch {
            rmSync(this.#lock, { force: true });
            throw new Error('Managed storage unavailable; repair storage and key before restarting.');
        }
    }
    private faultState: (() => void) | undefined;
    save(next: ConsoleState): void { this.faultState?.(); atomicFile(this.file, encrypt(next, this.key)); this.state = next; }
    commit(actor: string, action: string, target: string, change: (state: ConsoleState) => void): string { const id = this.journal.start(actor, action, target, this.state.revision); const next = structuredClone(this.state); change(next); next.revision++; this.save(next); this.journal.finish(id, actor, action, target, next.revision); return id; }
    close(): void { if (!this.#closed) {
        this.#closed = true;
        rmSync(this.#lock, { force: true });
    } }
    issueProof(origin: string, now = Date.now()): string { if (this.state.initialized)
        throw new Error('Already initialized'); const value = randomSecret(); this.commit('host', 'setup.proof', 'instance', s => { s.origin = trustedOrigin(origin); s.proof = { hash: digest(value), expires: now + 1800000, attempts: 0 }; delete s.enrollment; }); return value; }
    beginSetup(input: {
        proof: unknown;
        name: unknown;
        origin: unknown;
        email: unknown;
        password: unknown;
    }, now = Date.now()) {
        if (this.state.initialized)
            throw new Error('Setup unavailable');
        const proof = this.state.proof;
        if (!proof || proof.expires <= now || proof.attempts >= 10 || typeof input.proof !== 'string' || !equal(proof.hash, digest(input.proof))) {
            if (proof)
                this.commit('host', 'setup.rejected', 'instance', s => { s.proof!.attempts++; });
            throw new Error('Setup proof invalid or expired. Ask the host operator to reissue it.');
        }
        const origin = trustedOrigin(input.origin);
        if (origin !== this.state.origin)
            throw new Error('Use the host-authorized origin.');
        if (typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.length > 100)
            throw new Error('Instance name must contain 1–100 characters.');
        if (typeof input.email !== 'string' || !/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(input.email))
            throw new Error('Enter a valid email address.');
        validatePassword(input.password);
        const seed = newSeed(), token = randomSecret(), recovery = Array.from({ length: 10 }, () => randomSecret()), backup = randomSecret();
        const email = input.email.toLowerCase();
        const password = passwordHash(input.password);
        const name = input.name.trim();
        this.commit('host', 'setup.enrollment', 'instance', s => { delete s.proof; s.enrollment = { hash: digest(token), expires: now + 1800000, attempts: 0, seed, email, password, name, origin, recovery, backup }; });
        return { token, seed, recoveryCodes: recovery, backupMaterial: backup, expires: now + 1800000 };
    }
    completeSetup(token: unknown, code: unknown, saved: unknown, now = Date.now()): string {
        const e = this.state.enrollment;
        if (this.state.initialized || !e || e.expires <= now || e.attempts >= 10 || typeof token !== 'string' || !equal(e.hash, digest(token)))
            throw new Error('Enrollment expired. Ask the host operator to reissue setup.');
        if (saved !== true)
            throw new Error('Save recovery codes and independent backup material first.');
        if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !equal(totp(e.seed, now), code)) {
            this.commit('host', 'setup.code_rejected', 'instance', s => { s.enrollment!.attempts++; });
            throw new Error('Authenticator code was not accepted.');
        }
        return this.commit('host', 'setup.complete', 'instance', s => { s.users = [{ id: randomUUID(), email: e.email, role: 'Owner', active: true, password: e.password, seed: e.seed, lastCounter: Math.floor(now / 30000), recoveryHashes: e.recovery.map(digest), attempts: 0, blockedUntil: 0 }]; s.name = e.name; s.origin = e.origin; s.backupHash = digest(e.backup); s.initialized = true; delete s.enrollment; delete s.proof; });
    }
}
