import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { consoleNotifications } from './consoleNotifications.js';
import { LoginAttemptLimiter } from './loginAttemptLimiter.js';
import { digest, equal, newSeed, passwordHash, passwordMatches, randomSecret, totp, validatePassword } from './consoleCrypto.js';
import { ConsoleStore, type ConsoleSession, type ConsoleState, type ConsoleUser, type HumanRole } from './consoleStore.js';
export type ProofPurpose = 'invite' | 'password' | 'factor' | 'host';
export interface IdentityProof {
    hash: string;
    purpose: ProofPurpose;
    target: string;
    instance: string;
    generation: number;
    expires: number;
    attempts: number;
    issuer?: string;
    version?: 2;
    targetGeneration?: number;
    issuerGeneration?: number;
    issuerRole?: HumanRole;
    seed?: string;
    password?: string;
    recoveryHashes?: string[];
    begun?: boolean;
}
export interface ExternalIdentity {
    authorizationGeneration?: number;
    id: string;
    issuer: string;
    subject: string;
    label: string;
    active: boolean;
}
export interface PeopleState {
    proofs: IdentityProof[];
    external: ExternalIdentity[];
}
const roles = z.enum(['Owner', 'Administrator', 'Auditor', 'Member']);
const emailSchema = z.string().max(254).regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,188}[A-Za-z0-9])?$/).transform(v => v.toLowerCase());
const id = z.string().uuid();
export class PeopleError extends Error {
}
export class ConsolePeople {
    private attempts = new LoginAttemptLimiter({ windowMs: 60000, perSource: 30, perAccount: 20, global: 300, initialLockoutMs: 60000, maxLockoutMs: 300000, maxEntries: 1000 });
    resetDelivery?: (email: string, link: string) => Promise<void>;
    constructor(readonly store: ConsoleStore) { }
    attempt(source: string, target: unknown, purpose: string) { const account = purpose + ':' + digest(typeof target === 'string' ? target.slice(0, 254) : 'unknown'); if (!this.attempts.check(source, account).allowed)
        throw new PeopleError('Too many recovery attempts. Wait before trying again.'); this.attempts.recordFailure(source, account); }
    get state(): PeopleState { return this.store.state.people ?? { proofs: [], external: [] }; }
    private init(s: ConsoleState) { return s.people ??= { proofs: [], external: [] }; }
    private parse<T>(schema: z.ZodType<T>, value: unknown): T { const r = schema.safeParse(value); if (!r.success)
        throw new PeopleError('Invalid account input. Check the labeled fields.'); return r.data; }
    private owner(session: ConsoleSession, action?: string, now = Date.now()) { const actor = this.store.authorize(session, 'identity', now); this.store.requireSensitive(session); if (action)
        this.store.requireRecent(session, action, now); return actor; }
    private mutate(actor: string, action: string, target: string, change: (s: ConsoleState) => void, invalidate = false) { const revision = this.store.state.revision; try {
        return this.store.commit(actor, action, target, s => { change(s); if(invalidate){const u=s.users.find(u=>u.id===target)??s.people?.external.find(e=>e.id===target);if(u)u.authorizationGeneration=(u.authorizationGeneration??0)+1;} });
    }
    finally {
        if (invalidate && (this.store.state.revision !== revision || !this.store.storageReliable))
            this.store.invalidateUser(target);
    } }
    private resetActor(session: ConsoleSession, target: ConsoleUser | undefined, now: number) {
        const actor = this.store.requireSensitive(session);
        if (!['Owner', 'Administrator'].includes(actor.role) || (actor.role === 'Administrator' && target?.role === 'Owner')) throw new Error('Forbidden.');
        this.store.requireRecent(session, 'people.recovery', now);
        if (target?.id === actor.id) throw new PeopleError('Use your own account verification or host recovery.');
        return actor;
    }
    private newProof(purpose: ProofPurpose, target: string, now: number, issuer?: string) { const value = randomSecret(); return { value, proof: { hash: digest(value), purpose, target, instance: this.store.state.id, generation: this.store.state.securityGeneration ?? 0, expires: now + (purpose === 'invite' ? 259200000 : 1800000), attempts: 0, version: 2, targetGeneration: this.store.state.users.find(u => u.id === target)?.authorizationGeneration ?? 0, ...(issuer ? { issuer, issuerGeneration: this.store.state.users.find(u => u.id === issuer)?.authorizationGeneration ?? 0, issuerRole: this.store.state.users.find(u => u.id === issuer)!.role } : {}) } satisfies IdentityProof }; }
    private install(s: ConsoleState, p: IdentityProof) { const state = this.init(s); state.proofs = state.proofs.filter(v => v.target !== p.target); state.proofs.push(p); }
    private link(value: string, p: IdentityProof) { return { link: this.store.state.origin + '/console#' + new URLSearchParams({ purpose: p.purpose, target: p.target, proof: value }).toString(), expires: p.expires, delivery: 'manual', status: 'Pending enrollment' }; }
    list(session: ConsoleSession) { const actor = this.store.authorize(session, 'configuration'); return { writable: actor.role === 'Owner' && !session.restricted && !this.store.journal.degraded && !this.store.externalAudit?.degraded, users: this.store.state.users.map(u => ({ id: u.id, email: u.email, role: u.role, active: u.active, enrolled: u.enrolled !== false, status: u.enrolled === false ? (this.state.proofs.some(p => p.target === u.id && p.purpose === 'invite') ? 'Invited' : 'Recovery required') : u.active ? 'Active' : 'Disabled', canResetPassword: !session.restricted && !this.store.journal.degraded && ['Owner','Administrator'].includes(actor.role) && u.id !== actor.id && (actor.role === 'Owner' || u.role !== 'Owner') && u.active && u.enrolled !== false, invitation: this.state.proofs.find(p => p.target === u.id)?.expires })), external: this.state.external.map(e => ({ ...e })), recommendation: 'Keep a second enrolled Owner for recovery continuity.' }; }
    invite(session: ConsoleSession, input: unknown, now = Date.now()) { const actor = this.owner(session); const data = this.parse(z.object({ email: emailSchema, role: roles, confirmed: z.literal(true) }).strict(), input); if (this.store.state.users.some(u => u.email === data.email))
        throw new PeopleError('An account already uses this contact. Reissue its pending invitation or inspect account status.'); if (this.store.state.users.length >= 1000)
        throw new PeopleError('Account capacity reached.'); const target = randomUUID(), p = this.newProof('invite', target, now, actor.id); const operation = this.mutate(actor.id, 'identity.invite', target, s => { s.users.push({ id: target, email: data.email, role: data.role, active: false, enrolled: false, password: '', seed: '', lastCounter: -1, recoveryHashes: [], attempts: 0, blockedUntil: 0 }); this.install(s, p.proof); }); const result = { operation, id: target, ...this.link(p.value, p.proof) }; void consoleNotifications(this.store).send('invitation', data.email, result.link).catch(() => { }); return result; }
    invitation(session: ConsoleSession, input: unknown, now = Date.now()) { const actor = this.owner(session); const data = this.parse(z.object({ id, action: z.enum(['reissue', 'revoke']), confirmed: z.literal(true) }).strict(), input); const user = this.store.state.users.find(u => u.id === data.id); if (!user || user.enrolled !== false || user.password !== '')
        throw new PeopleError('No pending invitation.'); const p = this.newProof('invite', user.id, now, actor.id); const operation = this.mutate(actor.id, 'identity.invitation_' + data.action, user.id, s => { this.init(s).proofs = this.init(s).proofs.filter(v => v.target !== user.id); if (data.action === 'reissue')
        this.install(s, p.proof); }); if (data.action === 'reissue')
        void consoleNotifications(this.store).send('invitation', user.email, this.link(p.value, p.proof).link).catch(() => { }); return { operation, ...(data.action === 'reissue' ? this.link(p.value, p.proof) : { status: 'Revoked' }) }; }
    private proof(input: unknown, now: number) { const d = this.parse(z.object({ purpose: z.enum(['invite', 'password', 'factor', 'host']), target: id, proof: z.string().min(20).max(128) }).strict(), input); const p = this.state.proofs.find(p => p.target === d.target && p.purpose === d.purpose); if (p && !equal(p.hash, digest(d.proof)) && p.attempts < 10)
        this.mutate('capability', 'identity.proof_rejected', p.target, s => { this.init(s).proofs.find(v => v.target === p.target && v.purpose === p.purpose)!.attempts++; }); if (!p || p.instance !== this.store.state.id || p.generation !== (this.store.state.securityGeneration ?? 0) || p.expires <= now || p.attempts >= 10 || !equal(p.hash, digest(d.proof)))
        throw new PeopleError('Link invalid or expired. Ask the authorized issuer to reissue it.'); const user = this.store.state.users.find(u => u.id === p.target); if (!user || (p.purpose !== 'invite' && !user.active))
        throw new PeopleError('Link invalid or expired.'); if (p.purpose === 'password' && (p.version !== 2 || p.targetGeneration !== (user.authorizationGeneration ?? 0) || user.enrolled === false)) throw new PeopleError('Link invalid or expired. Ask the authorized issuer to reissue it.');
        if (p.issuer && !this.store.state.users.some(u => u.id === p.issuer && u.active && u.enrolled !== false && (p.version === 2 ? u.role === p.issuerRole && (u.authorizationGeneration ?? 0) === p.issuerGeneration && (u.role === 'Owner' || (u.role === 'Administrator' && user.role !== 'Owner' && p.purpose === 'password')) : u.role === 'Owner')))
        throw new PeopleError('Recovery issuer no longer authorized. Ask a current Owner or host operator.'); return { p, user, d }; }
    preview(input: unknown, now = Date.now()) { const { p, user } = this.proof(input, now); return { email: user.email, role: user.role, purpose: p.purpose, expires: p.expires, status: 'Restricted enrollment only' }; }
    begin(input: unknown, now = Date.now()) { const data = this.parse(z.object({ purpose: z.enum(['invite', 'factor', 'host']), target: id, proof: z.string().min(20).max(128), password: z.string().max(4096) }).strict(), input); const { p, user } = this.proof({ purpose: data.purpose, target: data.target, proof: data.proof }, now); if (p.begun)
        throw new PeopleError('Enrollment already started. Reissue if the fresh material was lost.'); validatePassword(data.password); const seed = newSeed(), recovery = Array.from({ length: 10 }, () => randomSecret()); this.mutate(p.issuer ?? 'capability', 'identity.enrollment_begin', user.id, s => { const target = this.init(s).proofs.find(v => v.hash === p.hash)!; target.seed = seed; target.password = passwordHash(data.password); target.recoveryHashes = recovery.map(digest); target.begun = true; }); return { seed, recoveryCodes: recovery, expires: p.expires }; }
    complete(input: unknown, now = Date.now()) { const data = this.parse(z.object({ purpose: z.enum(['invite', 'factor', 'host']), target: id, proof: z.string().min(20).max(128), code: z.string().regex(/^\d{6}$/), saved: z.literal(true) }).strict(), input); const { p, user } = this.proof({ purpose: data.purpose, target: data.target, proof: data.proof }, now); if (!p.begun || !p.seed || !p.password || !p.recoveryHashes)
        throw new PeopleError('Begin fresh enrollment first.'); if (!equal(totp(p.seed, now), data.code)) {
        this.mutate('capability', 'identity.enrollment_rejected', user.id, s => { this.init(s).proofs.find(v => v.hash === p.hash)!.attempts++; });
        throw new PeopleError('Authenticator code was not accepted.');
    } return { operation: this.mutate(p.issuer ?? 'capability', 'identity.enrollment_complete', user.id, s => { const u = s.users.find(v => v.id === user.id)!; u.password = p.password!; u.seed = p.seed!; u.recoveryHashes = p.recoveryHashes!; u.lastCounter = Math.floor(now / 30000); u.active = true; u.enrolled = true; u.attempts = 0; u.blockedUntil = 0; s.sessions = s.sessions.filter(v => v.userId !== u.id); this.init(s).proofs = this.init(s).proofs.filter(v => v.target !== u.id); }, true), status: 'Enrollment complete. Sign in with a fresh authenticator code.' }; }
    change(session: ConsoleSession, input: unknown, now = Date.now()) { const data = this.parse(z.object({ id, role: roles, active: z.boolean(), confirmed: z.literal(true) }).strict(), input); const actor = this.owner(session, 'people.change', now), u = this.store.state.users.find(u => u.id === data.id); if (!u)
        throw new PeopleError('Account unavailable.'); if (data.active && u.enrolled === false)
        throw new PeopleError('Fresh enrollment is required before activation.'); this.store.assertUserChange(u.id, data.role, data.active); return { operation: this.mutate(actor.id, 'identity.change', u.id, s => { const target = s.users.find(v => v.id === u.id)!; target.role = data.role; target.active = data.active; s.sessions = s.sessions.filter(v => v.userId !== u.id); this.init(s).proofs = this.init(s).proofs.filter(v => v.target !== u.id); }, true), status: 'Role and access changed immediately; sessions and client grants revoked.' }; }
    revoke(session: ConsoleSession, input: unknown, now = Date.now()) { const actor = this.owner(session, 'people.revoke', now), data = this.parse(z.object({ id, confirmed: z.literal(true) }).strict(), input); if (!this.store.state.users.some(u => u.id === data.id))
        throw new PeopleError('Account unavailable.'); return { operation: this.mutate(actor.id, 'identity.access_revoke', data.id, s => { s.sessions = s.sessions.filter(v => v.userId !== data.id); }, true), status: 'Sessions and client grants revoked.' }; }
    async requestPassword(input: unknown) {
        const data = this.parse(z.object({ email: emailSchema }).strict(), input);
        if (this.store.journal.degraded || this.store.externalAudit?.degraded || !this.store.storageReliable)
            throw new PeopleError('Recovery unavailable. Ask the host operator to repair durable storage.');
        this.store.commit('contact', 'identity.reset_request', 'contact', () => { });
        const notifications = consoleNotifications(this.store);
        const delivery = this.resetDelivery ?? (notifications.state.applied ? ((email: string, link: string) => notifications.send('password', email, link).then(() => { })) : undefined);
        const user = this.store.state.users.find(u => u.email === data.email && u.active && u.enrolled !== false);
        // No SMTP means an Owner must verify the person and deliberately issue a manual link.
        if (user && delivery) {
            try {
                const p = this.newProof('password', user.id, Date.now());
                this.mutate('contact', 'identity.password_reset_issue', user.id, s => this.install(s, p.proof));
                void delivery(user.email, this.link(p.value, p.proof).link).catch(() => { });
            }
            catch { /* instructions never claim issuance/delivery success */ }
        }
        return { status: 'If this account can receive email, instructions were requested. Otherwise contact an Owner through your established trusted channel.' };
    }
    resetPassword(input: unknown, now = Date.now()) {
        const data = this.parse(z.object({ purpose: z.literal('password'), target: id, proof: z.string().min(20).max(128), password: z.string().max(4096), kind: z.enum(['totp', 'recovery']), factor: z.string().min(1).max(128) }).strict(), input);
        const { p, user } = this.proof({ purpose: data.purpose, target: data.target, proof: data.proof }, now);
        validatePassword(data.password);
        if (user.blockedUntil > now) throw new PeopleError('Factor verification was not accepted. Wait before trying again.');
        let counter = -1;
        const recoveryIndex = data.kind === 'recovery' ? user.recoveryHashes.findIndex(h => equal(h, digest(data.factor))) : -1;
        if (data.kind === 'totp' && /^\d{6}$/.test(data.factor)) for (const offset of [-1, 0, 1]) {
            const c = Math.floor(now / 30000) + offset;
            if (c > user.lastCounter && equal(totp(user.seed, c * 30000), data.factor)) counter = c;
        }
        if (data.kind === 'totp' ? counter < 0 : recoveryIndex < 0) {
            this.mutate('capability', 'identity.password_factor_rejected', user.id, s => {
                const u = s.users.find(v => v.id === user.id)!;
                this.init(s).proofs.find(v => v.hash === p.hash)!.attempts++;
                if (++u.attempts >= 5) { u.blockedUntil = now + 60000; u.attempts = 0; }
            });
            throw new PeopleError('Factor verification was not accepted. Use a fresh authenticator code or unused recovery code.');
        }
        const hash = passwordHash(data.password);
        return { operation: this.mutate(p.issuer ?? 'contact', 'identity.password_reset', user.id, s => {
            this.proof({ purpose: data.purpose, target: data.target, proof: data.proof }, now);
            const u = s.users.find(v => v.id === user.id)!;
            u.password = hash; u.attempts = 0; u.blockedUntil = 0;
            if (counter >= 0) u.lastCounter = counter;
            if (recoveryIndex >= 0) u.recoveryHashes.splice(recoveryIndex, 1);
            s.sessions = s.sessions.filter(v => v.userId !== user.id);
            this.init(s).proofs = this.init(s).proofs.filter(v => v.target !== user.id);
        }, true), status: 'Password changed. MFA remains required. Sign in again; all prior sessions and client grants revoked.' };
    }
    assist(session: ConsoleSession, input: unknown, now = Date.now()) { const data = this.parse(z.object({ id, purpose: z.enum(['password', 'factor']), channel: z.enum(['in_person', 'known_phone', 'established_contact']), verified: z.literal(true), confirmed: z.literal(true) }).strict(), input); const user = this.store.state.users.find(u => u.id === data.id); const actor = data.purpose === 'password' ? this.resetActor(session, user, now) : this.owner(session, 'people.recovery', now); if (data.id === actor.id)
        throw new PeopleError('Use your password and existing factor or a recovery code for your own account; host recovery is available if locked out.'); if (!user || !user.active || user.password === '' || (data.purpose === 'password' && user.enrolled === false))
        throw new PeopleError('Recovery target unavailable.'); const p = this.newProof(data.purpose, user.id, now, actor.id); const revision = this.store.state.revision; let operation: string; try {
        operation = this.store.commit(actor.id, 'identity.' + data.purpose + '_reset_' + (this.state.proofs.some(v=>v.target===user.id)?'reissue':'issue'), user.id, s => { const u = s.users.find(v => v.id === user.id)!; if (data.purpose === 'factor') { u.authorizationGeneration=(u.authorizationGeneration??0)+1; u.enrolled = false; s.sessions = s.sessions.filter(v => v.userId !== user.id); } this.install(s, p.proof); }, { channel: data.channel });
    }
    finally {
        if (data.purpose === 'factor' && (this.store.state.revision !== revision || !this.store.storageReliable))
            this.store.invalidateUser(user.id);
    } void consoleNotifications(this.store).send(data.purpose, user.email, this.link(p.value,p.proof).link).catch(() => {}); return { operation, ...this.link(p.value, p.proof), status: data.purpose === 'factor' ? 'Restricted until fresh password and authenticator enrollment.' : 'Password reset authorized; existing MFA remains required.' }; }
    replaceFactor(session: ConsoleSession | undefined, input: unknown, now = Date.now()) { let value = input; let user: ConsoleUser | undefined; if (session)
        user = this.store.requireSensitive(session);
    else {
        const publicData = this.parse(z.object({ email: emailSchema, password: z.string().max(4096), factor: z.string().min(1).max(128), kind: z.enum(['totp', 'recovery']), confirmed: z.literal(true) }).strict(), input);
        user = this.store.state.users.find(u => u.email === publicData.email && u.active && u.enrolled !== false);
        const { email: _email, ...rest } = publicData;
        value = rest;
    } if (!user || !user.active || user.enrolled === false)
        throw new PeopleError('Factor verification was not accepted.'); const data = this.parse(z.object({ password: z.string().max(4096), factor: z.string().min(1).max(128), kind: z.enum(['totp', 'recovery']), confirmed: z.literal(true) }).strict(), value); if (user.blockedUntil > now)
        throw new PeopleError('Factor verification was not accepted. Wait before trying again.'); const validPassword = passwordMatches(data.password, user.password); let counter = -1; const recoveryIndex = data.kind === 'recovery' ? user.recoveryHashes.findIndex(h => equal(h, digest(data.factor))) : -1; if (data.kind === 'totp' && /^\d{6}$/.test(data.factor))
        for (const offset of [-1, 0, 1]) {
            const c = Math.floor(now / 30000) + offset;
            if (c > user.lastCounter && equal(totp(user.seed, c * 30000), data.factor))
                counter = c;
        } if (!validPassword || (data.kind === 'totp' ? counter < 0 : recoveryIndex < 0)) {
        this.mutate(user.id, 'identity.factor_rejected', user.id, s => { const u = s.users.find(v => v.id === user.id)!; u.attempts++; if (u.attempts >= 5) {
            u.blockedUntil = now + 60000;
            u.attempts = 0;
        } });
        throw new PeopleError('Factor verification was not accepted. Use password and a fresh factor or unused recovery code.');
    } const p = this.newProof('factor', user.id, now); if (session)
        this.store.requireSensitive(session); return { operation: this.mutate(user.id, 'identity.factor_replace', user.id, s => { const u = s.users.find(v => v.id === user.id)!; if (recoveryIndex >= 0)
            u.recoveryHashes.splice(recoveryIndex, 1); if (counter >= 0)
            u.lastCounter = counter; u.enrolled = false; u.attempts = 0; s.sessions = s.sessions.filter(v => v.userId !== user.id); this.install(s, p.proof); }, true), ...this.link(p.value, p.proof), status: 'Restricted until fresh enrollment. Previous sessions and client grants revoked.' }; }
    hostRecovery(target: unknown, now = Date.now()) { const selected = this.parse(id, target); const user = this.store.state.users.find(u => u.id === selected && u.role === 'Owner' && u.password !== ''); if (!user)
        throw new PeopleError('Select an existing enrolled Owner identity.'); if (this.store.journal.degraded || this.store.externalAudit?.degraded || !this.store.storageReliable)
        throw new PeopleError('Repair durable audit storage before host recovery.'); const p = this.newProof('host', user.id, now); return { operation: this.mutate('host', 'identity.host_recovery', user.id, s => { const u = s.users.find(v => v.id === user.id)!; u.active = true; u.enrolled = false; s.sessions = s.sessions.filter(v => v.userId !== u.id); this.install(s, p.proof); }, true), ...this.link(p.value, p.proof), status: 'Host-authorized restricted Owner reenrollment.' }; }
    externalChange(session: ConsoleSession, input: unknown) { const actor = this.owner(session); const data = this.parse(z.object({ id, active: z.boolean(), confirmed: z.literal(true) }).strict(), input); if (!this.state.external.some(e => e.id === data.id))
        throw new PeopleError('Registered identity unavailable.'); return { operation: this.mutate(actor.id, 'identity.external_change', data.id, s => { this.init(s).external.find(e => e.id === data.id)!.active = data.active; }, true), status: 'Registry eligibility changed immediately; authentication mode is unchanged.' }; }
    register(session: ConsoleSession, input: unknown) { const actor = this.owner(session); const data = this.parse(z.object({ issuer: z.string().url().max(2048), subject: z.string().min(1).max(254).regex(/^[^\u0000-\u001f\u007f]+$/), label: z.string().trim().min(1).max(100), confirmed: z.literal(true) }).strict(), input); const url = new URL(data.issuer); if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
        throw new PeopleError('Use an exact canonical HTTPS issuer and explicit subject.'); if(this.state.external.length>=1000)throw new PeopleError('Registry capacity reached.'); if (this.state.external.some(v => v.issuer === data.issuer && v.subject === data.subject))
        throw new PeopleError('Issuer and subject pair already registered.'); const target = randomUUID(); return { operation: this.mutate(actor.id, 'identity.external_register', target, s => { this.init(s).external.push({ id: target, issuer: data.issuer, subject: data.subject, label: data.label, active: true }); }), id: target, status: 'Registered only. Authentication mode and console access are unchanged.' }; }
}
const managers = new WeakMap<ConsoleStore, ConsolePeople>();
export function consolePeople(store: ConsoleStore) { let p = managers.get(store); if (!p) {
    p = new ConsolePeople(store);
    managers.set(store, p);
} return p; }
