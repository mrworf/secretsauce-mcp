import { describe, it, expect, vi } from 'vitest';
import { ConsolePeople } from '../src/consolePeople.js';
import { totp } from '../src/consoleCrypto.js';
import { managedFixture } from './consoleManagementFixtures.js';
const password = 'A different lengthy passphrase 2026';
const value = (link: string) => Object.fromEntries(new URLSearchParams(new URL(link).hash.slice(1)));
function recent(f: ReturnType<typeof managedFixture>, action = 'people.recovery') { f.store.state.sessions[0]!.recent = { action, expires: Date.now() + 300000 }; }
function member(f: ReturnType<typeof managedFixture>, p: ConsolePeople) { const r = p.invite(f.session, { email: 'member@example.org', role: 'Member', confirmed: true }); const proof = value(r.link), e = p.begin({ ...proof, password }); p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true }); return { id: r.id, seed: e.seed, codes: e.recoveryCodes }; }
describe('bounded account recovery', () => {
    it('Owner verifies established channel; restricts immediately, revokes sessions/references and rechecks issuer before activation', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store), m = member(f, p);
        const invalidated: string[] = [];
        f.store.invalidateUser = id => invalidated.push(id);
        f.clock.mockReturnValue(Date.now() + 30000);
        const l = f.store.login('member@example.org', password, totp(m.seed, Date.now()));
        recent(f);
        const r = p.assist(f.session, { id: m.id, purpose: 'factor', channel: 'known_phone', verified: true, confirmed: true });
        expect(f.store.session(l.token)).toBeUndefined();
        expect(invalidated).toEqual([m.id]);
        expect(() => f.store.login('member@example.org', password, totp(m.seed, Date.now() + 30000))).toThrow();
        const proof = value(r.link), e = p.begin(proof);
        f.store.state.users[0]!.role = 'Administrator';
        expect(() => p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true })).toThrow(/issuer/);
        f.store.state.users[0]!.role = 'Owner';
        p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true });
        expect(f.store.state.users.find(u => u.id === m.id)!.seed).not.toBe(m.seed);
        expect(JSON.stringify(f.store.journal.entries())).not.toContain(proof.proof);
        expect(f.store.journal.entries().some(e => e.details?.channel === 'known_phone')).toBe(true);
    }
    finally {
        f.close();
    } });
    it('password reset is nonenumerating, retains MFA and cannot be used to enroll factors', async () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store), m = member(f, p);
        expect(await p.requestPassword({ email: 'absent@example.org' })).toEqual(await p.requestPassword({ email: 'member@example.org' }));
        expect(f.store.state.people!.proofs).toHaveLength(0);
        recent(f);
        expect(() => p.assist(f.session, { id: f.session.userId, purpose: 'factor', channel: 'in_person', verified: true, confirmed: true })).toThrow(/own account/);
        const r = p.assist(f.session, { id: m.id, purpose: 'password', channel: 'established_contact', verified: true, confirmed: true }), proof = value(r.link);
        expect(f.store.state.users.find(u => u.id === m.id)!.enrolled).toBe(true);
        expect(() => p.begin({ ...proof, password })).toThrow();
        expect(() => p.resetPassword({ ...proof, password: 'A reset lengthy passphrase 2026' })).toThrow();
        p.resetPassword({ ...proof, password: 'A reset lengthy passphrase 2026', kind: 'recovery', factor: m.codes[0] });
        const u = f.store.state.users.find(u => u.id === m.id)!;
        expect(u.seed).toBe(m.seed);
        expect(u.enrolled).toBe(true);
        expect(() => p.resetPassword({ ...proof, password })).toThrow();
        await expect(p.requestPassword({ email: 'bad' })).rejects.toThrow();
    }
    finally {
        f.close();
    } });
    it('password plus unused recovery code works without session; concurrent code use once; password alone/stale TOTP rejected', async () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store), m = member(f, p);
        for (const bad of [{ email: 'member@example.org', password, factor: 'wrong', kind: 'recovery', confirmed: true }, { email: 'member@example.org', password: 'wrong', factor: m.codes[0], kind: 'recovery', confirmed: true }, { email: 'member@example.org', password, factor: totp(m.seed, Date.now()), kind: 'totp', confirmed: true }, { email: 'member@example.org', password, confirmed: true }])
            expect(() => p.replaceFactor(undefined, bad)).toThrow();
        const input = { email: 'member@example.org', password, factor: m.codes[0], kind: 'recovery', confirmed: true };
        const race = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => p.replaceFactor(undefined, input))));
        expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const r = (race.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<ReturnType<ConsolePeople['replaceFactor']>>).value;
        const proof = value(r.link), e = p.begin({ ...proof, password });
        p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true });
        expect(() => p.replaceFactor(undefined, input)).toThrow();
        expect(f.store.state.users.find(u => u.id === m.id)!.recoveryHashes).toHaveLength(10);
    }
    finally {
        f.close();
    } });
    it('harmless preview, parallel completion, expiry, wrong purpose/target/generation and host proof loss/reissue', async () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        const host = p.hostRecovery(f.session.userId), proof = value(host.link);
        const before = f.store.state.revision;
        p.preview(proof);
        expect(f.store.state.revision).toBe(before);
        expect(() => p.preview(proof, host.expires)).toThrow();
        expect(() => p.preview({ ...proof, purpose: 'invite' })).toThrow();
        f.store.state.securityGeneration = 1;
        expect(() => p.preview(proof)).toThrow();
        f.store.state.securityGeneration = 0;
        const next = p.hostRecovery(f.session.userId);
        expect(() => p.preview(proof)).toThrow();
        const valid = value(next.link), e = p.begin({ ...valid, password });
        const race = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => p.complete({ ...valid, code: totp(e.seed, Date.now()), saved: true }))));
        expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(f.store.state.users[0]!.role).toBe('Owner');
        expect(f.store.state.users[0]!.enrolled).toBe(true);
    }
    finally {
        f.close();
    } });
    it('rejects stale session/recent proof, malformed assistance, throttling, audit outage; committed uncertain invalidation still happens', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store), m = member(f, p);
        const good = { id: m.id, purpose: 'factor', channel: 'in_person', verified: true, confirmed: true };
        expect(() => p.assist(f.session, good)).toThrow(/Confirm/);
        recent(f);
        for (const bad of [{ ...good, verified: false }, { ...good, channel: 'identity_document' }, { ...good, id: 'wrong' }, { ...good, purpose: 'login' }])
            expect(() => p.assist(f.session, bad)).toThrow();
        f.store.state.sessions[0]!.recent!.expires = Date.now();
        expect(() => p.assist(f.session, good)).toThrow();
        recent(f);
        f.store.journal.degraded = true;
        expect(() => p.assist(f.session, good)).toThrow();
        expect(() => p.hostRecovery(f.session.userId)).toThrow();
        f.store.journal.degraded = false;
        for (let i = 0; i < 20; i++)
            p.attempt('synthetic-source', 'target', 'factor');
        expect(() => p.attempt('different-source', 'target', 'factor')).toThrow(/Too many/);
        expect(p.hostRecovery(f.session.userId)).toHaveProperty('link');
    }
    finally {
        f.close();
    } });
    it('completion audit failure cannot prevent committed recovery revocation', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store), m = member(f, p);
        recent(f);
        const invalidate = vi.fn();
        f.store.invalidateUser = invalidate;
        const finish = f.store.journal.finish.bind(f.store.journal);
        vi.spyOn(f.store.journal, 'finish').mockImplementation((...args) => { if(args[2]==='identity.factor_reset_issue')throw Error('synthetic completion outage');return finish(...args); });
        expect(() => p.assist(f.session, { id: m.id, purpose: 'factor', channel: 'in_person', verified: true, confirmed: true })).toThrow(/uncertain/);
        expect(f.store.state.users.find(u => u.id === m.id)!.enrolled).toBe(false);
        expect(invalidate).toHaveBeenCalledWith(m.id);
    }
    finally {
        f.close();
    } });
});

it('positive password plus fresh existing TOTP permits only restricted fresh-factor enrollment',()=>{const f=managedFixture();try{const p=new ConsolePeople(f.store),m=member(f,p);const now=Date.now()+30000;const r=p.replaceFactor(undefined,{email:'member@example.org',password,factor:totp(m.seed,now),kind:'totp',confirmed:true},now);expect(f.store.state.users.find(u=>u.id===m.id)!.enrolled).toBe(false);expect(f.store.state.users.find(u=>u.id===m.id)!.authorizationGeneration).toBeGreaterThan(0);const proof=value(r.link),e=p.begin({...proof,password},now);p.complete({...proof,code:totp(e.seed,now),saved:true},now);expect(f.store.state.users.find(u=>u.id===m.id)!.seed).not.toBe(m.seed);}finally{f.close();}});

it('bounds target, source and global attempt buckets while protected host recovery stays available',()=>{const f=managedFixture();try{const target=new ConsolePeople(f.store);for(let i=0;i<20;i++)target.attempt('source-'+i,'target','factor');expect(()=>target.attempt('new-source','target','factor')).toThrow(/Too many/);const source=new ConsolePeople(f.store);for(let i=0;i<30;i++)source.attempt('source','target-'+i,'factor');expect(()=>source.attempt('source','new-target','factor')).toThrow(/Too many/);const global=new ConsolePeople(f.store);for(let i=0;i<300;i++)global.attempt('source-'+i,'target-'+i,'factor');expect(()=>global.attempt('new-source','new-target','factor')).toThrow(/Too many/);expect(global.hostRecovery(f.session.userId)).toHaveProperty('link');}finally{f.close();}});
