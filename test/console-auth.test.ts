import { describe, it, expect } from 'vitest';
import { ConsoleStore, type HumanRole, can } from '../src/consoleStore.js';
import { totp, digest } from '../src/consoleCrypto.js';
import { fixture, setup } from './consoleFixtures.js';
const start = 1800000000000;
function enrolled() { const f = fixture(); const e = setup(f, start); return { ...f, e }; }
describe('durable MFA identity and current permissions', () => {
    it('requires password plus fresh TOTP; rejects replay including concurrent attempts and survives restart', async () => { const f = enrolled(); try {
        expect(() => f.store.login('owner@example.org', 'wrong', totp(f.e.seed, start + 30000), start + 30000)).toThrow();
        expect(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start), start)).toThrow();
        const outcomes = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 30000))));
        expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const result = (outcomes.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<ReturnType<ConsoleStore['login']>>).value;
        expect(f.store.state.sessions[0]!.hash).toBe(digest(result.token));
        f.store.close();
        const reopened = new ConsoleStore(f.directory, f.keyFile);
        expect(reopened.session(result.token, start + 31000)).toBeTruthy();
        expect(() => reopened.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 31000)).toThrow();
        reopened.close();
    }
    finally {
        f.close();
    } });
    it('bounds account attempts, invalid and disabled identities, bad OTP/input, and fixed session expiry', () => { const f = enrolled(); try {
        for (const input of [[undefined, 'x', '123456'], ['owner@example.org', null, '123456'], ['unknown@example.org', 'x', 'x'], ['owner@example.org', 'x', {}]])
            expect(() => f.store.login(...input as [
                unknown,
                unknown,
                unknown
            ], start + 30000)).toThrow();
        for (let i = 0; i < 5; i++)
            expect(() => f.store.login('owner@example.org', 'wrong', '123456', start + 30000)).toThrow();
        expect(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 30000)).toThrow();
        const result = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 120000), start + 120000);
        expect(f.store.session(result.token, start + 120001)).toBeTruthy();
        expect(f.store.session('forged', start + 120001)).toBeUndefined();
        expect(f.store.session(result.token, start + 120000 + 1800000)).toBeUndefined();
        const session = f.store.state.sessions[0]!;
        session.lastSeen = start + 43200000;
        expect(f.store.session(result.token, start + 120000 + 43200000)).toBeUndefined();
    }
    finally {
        f.close();
    } });
    it('owns session revocation and password change invalidates every prior session', () => { const f = enrolled(); try {
        const a = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 30000);
        const b = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 60000), start + 60000);
        const current = f.store.session(a.token, start + 60000)!;
        expect(f.store.ownSessions(current, start + 60000)).toHaveLength(2);
        expect(() => f.store.revokeOther(current, current.id)).toThrow();
        expect(() => f.store.revokeOther(current, 'unknown')).toThrow();
        f.store.revokeOther(current, f.store.session(b.token, start + 60000)!.id);
        expect(f.store.session(b.token, start + 60000)).toBeUndefined();
        expect(() => f.store.changePassword(current, 'wrong', totp(f.e.seed, start + 90000), 'new valid password phrase', start + 90000)).toThrow();
        f.store.changePassword(current, 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 90000), 'new valid password phrase', start + 90000);
        expect(f.store.session(a.token, start + 90000)).toBeUndefined();
        expect(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 120000), start + 120000)).toThrow();
        expect(f.store.login('owner@example.org', 'new valid password phrase', totp(f.e.seed, start + 120000), start + 120000)).toBeTruthy();
    }
    finally {
        f.close();
    } });
    it('recent verification is action-bound and expires at five minutes', () => { const f = enrolled(); try {
        const login = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 30000);
        const s = f.store.session(login.token, start + 60000)!;
        expect(() => f.store.requireRecent(s, 'backup.restore', start + 60000)).toThrow();
        f.store.recentCheck(s, 'backup.restore', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 60000), start + 60000);
        expect(() => f.store.requireRecent(s, 'backup.restore', start + 60001)).not.toThrow();
        expect(() => f.store.requireRecent(s, 'identity.change', start + 60001)).toThrow();
        expect(() => f.store.requireRecent(s, 'backup.restore', start + 360000)).toThrow();
    }
    finally {
        f.close();
    } });
    it('enforces each fixed role independently of UI and protects last enrolled Owner', () => { const f = enrolled(); try {
        for (const role of ['Owner', 'Administrator', 'Auditor', 'Member'] as HumanRole[]) {
            const u = f.store.state.users[0]!;
            u.role = role;
            const login = f.store.login(u.email, 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000 + 30000 * (['Owner', 'Administrator', 'Auditor', 'Member'].indexOf(role))), start + 30000 + 30000 * (['Owner', 'Administrator', 'Auditor', 'Member'].indexOf(role)));
            const s = f.store.state.sessions.find(x => x.hash === digest(login.token))!;
            expect(f.store.authorize(s, 'own').role).toBe(role);
            expect(can(role, 'identity')).toBe(role === 'Owner');
            if (role === 'Member')
                expect(() => f.store.authorize(s, 'instance')).toThrow('Forbidden');
            else
                expect(f.store.authorize(s, 'instance')).toBeTruthy();
        }
        const owner = f.store.state.users[0]!;
        owner.role = 'Owner';
        expect(() => f.store.assertUserChange(owner.id, 'Member', true)).toThrow();
        expect(() => f.store.assertUserChange(owner.id, 'Owner', false)).toThrow();
        owner.active = false;
        expect(f.store.session('anything')).toBeUndefined();
    }
    finally {
        f.close();
    } });
    it('creates reliable restricted diagnosis only; never upgrades after repair and unsafe storage prevents login', () => { const f = enrolled(); try {
        f.store.journal.degraded = true;
        const r = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 30000), start + 30000);
        const s = f.store.session(r.token, start + 30000)!;
        expect(s.restricted).toBe(true);
        expect(() => f.store.revokeOther(s, 'x')).toThrow();
        f.store.journal.degraded = false;
        expect(() => f.store.requireSensitive(s)).toThrow();
        f.store.logout(s);
        expect(f.store.session(r.token, start + 30000)).toBeUndefined();
        f.store.storageReliable = false;
        expect(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(f.e.seed, start + 60000), start + 60000)).toThrow('storage');
    }
    finally {
        f.close();
    } });
});
