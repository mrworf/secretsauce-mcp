import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { decrypt, digest, encrypt, equal, newSeed, passwordHash, passwordMatches, randomSecret, totp, validatePassword } from './consoleCrypto.js';
import { ConsoleJournal } from './consoleJournal.js';
import type { AuditSink } from './audit.js';
import type { GatewayConfig } from './types.js';
import { hydrateManagedConfig } from './config.js';
import type { ManagedConfiguration } from './consoleServices.js';
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
    managed?: ManagedConfiguration;
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
export { atomicFile } from './consolePersistence.js';
import { atomicFile } from './consolePersistence.js';
export function trustedOrigin(value: unknown): string {
    if (typeof value !== 'string')
        throw new Error('Use a trusted HTTPS origin.');
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash)
        throw new Error('Use a trusted HTTPS origin.');
    return u.origin;
}
export class ConsoleStore {
    state: ConsoleState;
    storageReliable = true;
    externalAudit: AuditSink | undefined;
    readonly journal: ConsoleJournal;
    readonly file: string;
    readonly key: Buffer;
    #lock: string;
    #closed = false;
    constructor(readonly directory: string, keyFile: string, options: {
        config?: GatewayConfig;
        faultAudit?: () => void;
        faultState?: (phase?: string) => void;
    } = {}) {
        this.key = readConsoleKey(keyFile);
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
            if (this.state.config) hydrateManagedConfig(this.state.config);
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
    private faultState: ((phase?: string) => void) | undefined;
    save(next: ConsoleState): void {
        if (!this.storageReliable)
            throw new Error('Identity storage unavailable.');
        try {
            atomicFile(this.file, encrypt(next, this.key), this.faultState);
            this.state = next;
        }
        catch {
            this.storageReliable = false;
            throw new Error('Identity storage unavailable.');
        }
    }
    commit(actor: string, action: string, target: string, change: (state: ConsoleState) => void): string {
        if (this.externalAudit?.degraded)
            throw new Error('Durable audit unavailable');
        const id = this.journal.start(actor, action, target, this.state.revision);
        const next = structuredClone(this.state);
        try {
            change(next);
        }
        catch (error) {
            try {
                this.journal.finish(id, actor, action, target, this.state.revision, 'failed');
            }
            catch {
                throw new ConsoleOperationError(id, 'Operation completion is uncertain.');
            }
            throw error;
        }
        next.revision++;
        try {
            this.save(next);
            this.journal.finish(id, actor, action, target, next.revision);
            return id;
        }
        catch {
            throw new ConsoleOperationError(id, this.storageReliable ? 'Operation completion is uncertain.' : 'Identity storage unavailable; operation completion is uncertain.');
        }
    }
    close(): void {
        if (!this.#closed) {
            this.#closed = true;
            rmSync(this.#lock, { force: true });
        }
    }
    issueProof(origin: string, now = Date.now()): string {
        if (this.state.initialized)
            throw new Error('Already initialized');
        const value = randomSecret();
        this.commit('host', 'setup.proof', 'instance', s => { s.origin = trustedOrigin(origin); s.proof = { hash: digest(value), expires: now + 1800000, attempts: 0 }; delete s.enrollment; });
        return value;
    }
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
    private verify(user: ConsoleUser | undefined, password: unknown, code: unknown, now: number): number {
        if (!this.storageReliable)
            throw new Error('Identity storage unavailable.');
        if (user?.blockedUntil && user.blockedUntil > now)
            throw new Error('Sign-in details were not accepted. Wait before trying again.');
        const validPassword = typeof password === 'string' && password.length <= 4096 && passwordMatches(password, user?.password ?? dummyPassword);
        let counter = -1;
        if (user && typeof code === 'string' && /^\d{6}$/.test(code))
            for (const offset of [-1, 0, 1]) {
                const candidate = Math.floor(now / 30000) + offset;
                if (candidate > user.lastCounter && equal(totp(user.seed, candidate * 30000), code))
                    counter = candidate;
            }
        if (!user?.active || user.blockedUntil > now || !validPassword || counter < 0) {
            if (user && user.blockedUntil <= now) {
                const next = structuredClone(this.state);
                const target = next.users.find(u => u.id === user.id)!;
                target.attempts++;
                if (target.attempts >= 5) {
                    target.blockedUntil = now + 60000;
                    target.attempts = 0;
                }
                this.save(next);
            }
            throw new Error('Sign-in details were not accepted. Check your password and use a fresh authenticator code.');
        }
        return counter;
    }
    login(email: unknown, password: unknown, code: unknown, now = Date.now()): {
        token: string;
        csrf: string;
        restricted: boolean;
    } {
        if (!this.state.initialized || typeof email !== 'string' || email.length > 254)
            throw new Error('Sign-in details were not accepted.');
        const user = this.state.users.find(u => u.email === email.toLowerCase());
        const counter = this.verify(user, password, code, now);
        const token = randomSecret(), csrf = randomSecret();
        const restricted = this.journal.degraded || this.externalAudit?.degraded === true;
        const update = (s: ConsoleState) => {
            const target = s.users.find(u => u.id === user!.id)!;
            target.lastCounter = counter;
            target.attempts = 0;
            target.blockedUntil = 0;
            s.sessions = s.sessions.filter(session => session.created + 43200000 > now && session.lastSeen + 1800000 > now);
            if (s.sessions.length >= 500 || s.sessions.filter(x => x.userId === target.id).length >= 10)
                throw new Error('Session limit reached. Sign out of an existing session.');
            s.sessions.push({ id: randomUUID(), userId: target.id, hash: digest(token), csrf, created: now, lastSeen: now, restricted });
        };
        if (restricted) {
            const next = structuredClone(this.state);
            update(next);
            this.save(next);
        }
        else
            this.commit(user!.id, 'identity.login', user!.id, update);
        return { token, csrf, restricted };
    }
    session(token: string | undefined, now = Date.now()): ConsoleSession | undefined {
        if (!token || token.length > 128 || !this.storageReliable)
            return undefined;
        const session = this.state.sessions.find(s => equal(s.hash, digest(token)));
        const user = this.state.users.find(u => u.id === session?.userId);
        if (!session || !user?.active || session.created + 43200000 <= now || session.lastSeen + 1800000 <= now)
            return undefined;
        if (now - session.lastSeen >= 1000) {
            const next = structuredClone(this.state);
            next.sessions.find(s => s.id === session.id)!.lastSeen = now;
            this.save(next);
            return this.state.sessions.find(s => s.id === session.id);
        }
        return session;
    }
    authorize(session: ConsoleSession, capability: 'own' | 'configuration' | 'identity' | 'instance', now = Date.now()): ConsoleUser {
        const current = this.state.sessions.find(s => s.id === session.id);
        const user = this.state.users.find(u => u.id === current?.userId);
        if (!current || current.created + 43200000 <= now || current.lastSeen + 1800000 <= now || !user?.active)
            throw new Error('Sign in again.');
        if (!can(user.role, capability))
            throw new Error('Forbidden.');
        return user;
    }
    requireSensitive(session: ConsoleSession): ConsoleUser {
        const user = this.authorize(session, 'own');
        if (this.state.sessions.find(s => s.id === session.id)?.restricted || this.journal.degraded || this.externalAudit?.degraded === true || !this.storageReliable)
            throw new Error('Sensitive actions unavailable. Sign in again after host storage repair.');
        return user;
    }
    logout(session: ConsoleSession): void { const next = structuredClone(this.state); next.sessions = next.sessions.filter(s => s.id !== session.id); this.save(next); }
    ownSessions(session: ConsoleSession, now = Date.now()) { const user = this.authorize(session, 'own', now); return this.state.sessions.filter(s => s.userId === user.id && s.created + 43200000 > now && s.lastSeen + 1800000 > now).map(s => ({ id: s.id, current: s.id === session.id, created: s.created, lastSeen: s.lastSeen, restricted: s.restricted, expires: Math.min(s.created + 43200000, s.lastSeen + 1800000) })); }
    recentCheck(session: ConsoleSession, action: unknown, password: unknown, code: unknown, now = Date.now()): void {
        const user = this.requireSensitive(session);
        if (typeof action !== 'string' || !/^[a-z][a-z0-9_.-]{0,63}$/.test(action))
            throw new Error('Invalid action.');
        const counter = this.verify(user, password, code, now);
        this.requireSensitive(session);
        this.commit(user.id, 'identity.reauthenticate', user.id, s => { const u = s.users.find(u => u.id === user.id)!; u.lastCounter = counter; u.attempts = 0; s.sessions.find(x => x.id === session.id)!.recent = { action, expires: now + 300000 }; });
    }
    requireRecent(session: ConsoleSession, action: string, now = Date.now()): void {
        this.requireSensitive(session);
        const current = this.state.sessions.find(s => s.id === session.id);
        if (!current?.recent || current.recent.action !== action || current.recent.expires <= now)
            throw new Error('Confirm password and a fresh authenticator code for this action.');
    }
    revokeOther(session: ConsoleSession, target: unknown): string {
        const user = this.requireSensitive(session);
        if (typeof target !== 'string')
            throw new Error('Invalid session.');
        const other = this.state.sessions.find(s => s.id === target);
        if (!other || other.userId !== user.id || other.id === session.id)
            throw new Error('Forbidden.');
        return this.commit(user.id, 'identity.session_revoke', target, s => { s.sessions = s.sessions.filter(x => x.id !== target); });
    }
    changePassword(session: ConsoleSession, password: unknown, code: unknown, replacement: unknown, now = Date.now()): string { const user = this.requireSensitive(session); validatePassword(replacement); const counter = this.verify(user, password, code, now); const hash = passwordHash(replacement); this.requireSensitive(session); return this.commit(user.id, 'identity.password_change', user.id, s => { const u = s.users.find(u => u.id === user.id)!; u.password = hash; u.lastCounter = counter; u.attempts = 0; s.sessions = s.sessions.filter(x => x.userId !== user.id); }); }
    assertUserChange(id: string, nextRole: HumanRole, active: boolean): void {
        const user = this.state.users.find(u => u.id === id);
        if (user?.active && user.role === 'Owner' && (!active || nextRole !== 'Owner') && this.state.users.filter(u => u.active && u.role === 'Owner').length <= 1)
            throw new Error('The last active Owner must remain enrolled.');
    }
}
const dummyPassword = passwordHash('Non-user timing mitigation credential');
export function can(role: HumanRole, capability: 'own' | 'configuration' | 'identity' | 'instance'): boolean { return capability === 'own' || (capability === 'configuration' && ['Owner', 'Administrator', 'Auditor'].includes(role)) || (capability === 'identity' && role === 'Owner') || (capability === 'instance' && ['Owner', 'Administrator', 'Auditor'].includes(role)); }
export class ConsoleOperationError extends Error {
    constructor(readonly operation: string, message: string) { super(message + ' Inspect operation status before retrying.'); this.name = 'ConsoleOperationError'; }
}
export function readConsoleKey(keyFile: string): Buffer { const value = readFileSync(keyFile, 'utf8').trim(); if (!/^[a-fA-F0-9]{64}$/.test(value) || statSync(keyFile).mode & 0o077)
    throw new Error('Protected encryption material required'); return Buffer.from(value, 'hex'); }
export function loadManagedConfig(directory: string, keyFile: string): GatewayConfig { try {
    if (!existsSync(join(directory, 'managed')))
        throw new Error('Managed marker missing');
    const state = decrypt<ConsoleState>(readFileSync(join(directory, 'state.enc'), 'utf8'), readConsoleKey(keyFile));
    if (state.v !== 1 || !state.config)
        throw new Error('Managed configuration missing');
    return hydrateManagedConfig(state.config);
}
catch {
    throw new Error('Managed storage unavailable; repair storage and key before restarting.');
} }
