import { describe, it, expect } from 'vitest';
import { ConsolePeople } from '../src/consolePeople.js';
import { digest, totp } from '../src/consoleCrypto.js';
import { managedFixture } from './consoleManagementFixtures.js';
const password = 'A different lengthy passphrase 2026';
function value(link: string) { return Object.fromEntries(new URLSearchParams(new URL(link).hash.slice(1))); }
function recent(f: ReturnType<typeof managedFixture>, action: string) { f.store.state.sessions[0]!.recent = { action, expires: Date.now() + 300000 }; }
describe('people lifecycle', () => {
    it('invites predetermined four roles with hash-only proofs, harmless preview, fresh factors and single completion', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        for (const role of ['Owner', 'Administrator', 'Auditor', 'Member']) {
            const r = p.invite(f.session, { email: 'invited-' + role.toLowerCase() + '@example.org', role, confirmed: true });
            const proof = value(r.link);
            const before = JSON.stringify(f.store.state);
            expect(p.preview(proof).role).toBe(role);
            expect(JSON.stringify(f.store.state)).toBe(before);
            expect(f.store.state.people!.proofs.find(v => v.target === r.id)!.hash).toBe(digest(proof.proof!));
            expect(JSON.stringify(f.store.state)).not.toContain(proof.proof);
            expect(() => f.store.login('invited-' + role.toLowerCase() + '@example.org', password, '123456')).toThrow();
            const e = p.begin({ ...proof, password });
            expect(() => p.begin({ ...proof, password })).toThrow(/already started/);
            expect(() => p.complete({ ...proof, code: '000000', saved: false })).toThrow();expect(() => p.complete({ ...proof, code: '000000', saved: true })).toThrow();
            p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true });
            expect(() => p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true })).toThrow();
            expect(f.store.state.users.find(u => u.id === r.id)!.enrolled).toBe(true);
            expect(p.list(f.session).users.find(u => u.id === r.id)!.status).toBe('Active');
        }
    }
    finally {
        f.close();
    } });
    it('denies malformed inputs, wrong binding, replay, expired/reissued/revoked proofs and stored factor disclosure', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        for (const bad of [{ email: 'bad', role: 'Member', confirmed: true }, { email: 'm@example.org', role: 'Root', confirmed: true }, { email: 'm@example.org', role: 'Member', confirmed: false }])
            expect(() => p.invite(f.session, bad)).toThrow();
        const r = p.invite(f.session, { email: 'm@example.org', role: 'Member', confirmed: true }), proof = value(r.link);
        expect(() => p.invite(f.session, { email: 'm@example.org', role: 'Member', confirmed: true })).toThrow();
        expect(() => p.preview({ ...proof, purpose: 'factor' })).toThrow();
        expect(() => p.preview({ ...proof, target: f.session.userId })).toThrow();
        expect(() => p.preview(proof, r.expires)).toThrow();
        const instance=f.store.state.id;f.store.state.id='different-instance';expect(()=>p.preview(proof)).toThrow();f.store.state.id=instance;f.store.state.securityGeneration = 1;
        expect(() => p.preview(proof)).toThrow();
        f.store.state.securityGeneration = 0;
        for(const patch of [{id:f.session.userId},{action:'accept'},{confirmed:false}])expect(()=>p.invitation(f.session,{id:r.id,action:'reissue',confirmed:true,...patch})).toThrow();const next = p.invitation(f.session, { id: r.id, action: 'reissue', confirmed: true });
        expect(() => p.preview(proof)).toThrow();
        const e = p.begin({ ...value(next.link!), password });
        expect(JSON.stringify(p.list(f.session))).not.toContain(e.seed);
        p.invitation(f.session, { id: r.id, action: 'revoke', confirmed: true });
        expect(() => p.preview(value(next.link!))).toThrow();
    }
    finally {
        f.close();
    } });
    it('checks current role, recent proof, enrolled replacement and last-Owner concurrency', async () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        recent(f, 'people.change');
        const owner = f.session.userId;
        expect(() => p.change(f.session, { id: owner, role: 'Member', active: true, confirmed: true })).toThrow(/last active Owner/);
        const r = p.invite(f.session, { email: 'second@example.org', role: 'Owner', confirmed: true });
        expect(() => p.change(f.session, { id: r.id, role: 'Owner', active: true, confirmed: true })).toThrow(/enrollment/);
        const proof = value(r.link), e = p.begin({ ...proof, password });
        p.complete({ ...proof, code: totp(e.seed, Date.now()), saved: true });
        f.clock.mockReturnValue(Date.now()+30000);const secondLogin=f.store.login('second@example.org',password,totp(e.seed,Date.now()));const secondSession=f.store.session(secondLogin.token)!;recent(f,'people.account');f.store.state.sessions.find(s=>s.id===secondSession.id)!.recent={action:'people.account',expires:Date.now()+300000};const results=await Promise.allSettled([[f.session,owner],[secondSession,r.id]].map(([session,target])=>Promise.resolve().then(()=>p.updateAccount(session as typeof f.session,{id:target,revision:f.store.state.users.find(u=>u.id===target)!.authorizationGeneration??0,role:'Member',confirmed:true}))));
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(f.store.state.users.filter(u => u.role === 'Owner' && u.active && u.enrolled !== false)).toHaveLength(1);
        expect(f.store.session(f.token)).toBeUndefined();
    }
    finally {
        f.close();
    } });
    it('registers exact issuer-subject only; no email linking or authentication activation; external eligible assignments', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        const mode = f.cfg.auth.mode;
        const r = p.register(f.session, { issuer: 'https://issuer.example.org', subject: 'subject-1', label: 'Explicit registry', confirmed: true });
        expect(f.manager.list(f.session).eligible.some(u => u.id === r.id)).toBe(true);
        f.manager.access(f.session, { id: 'baseline', user: r.id, action: 'grant', confirmed: true });
        expect(f.cfg.auth.mode).toBe(mode);
        expect(f.store.state.users.some(u => u.id === r.id)).toBe(false);
        for (const bad of [{ issuer: 'https://issuer.example.org', subject: 'subject-1', label: 'Duplicate', confirmed: true }, { email: 'm@example.org', confirmed: true }, { issuer: 'http://issuer.example.org', subject: 'subject', label: 'Unsafe', confirmed: true }, { issuer: 'https://issuer.example.org/#frag', subject: 's', label: 'Unsafe', confirmed: true },{issuer:'https://user:pass@issuer.example.org',subject:'s',label:'Unsafe',confirmed:true},{issuer:'https://issuer.example.org?query=yes',subject:'s',label:'Unsafe',confirmed:true},{issuer:'https://issuer.example.org',subject:'',label:'Subject',confirmed:true},{issuer:'https://issuer.example.org',subject:'bad\nsubject',label:'Subject',confirmed:true},{issuer:'https://issuer.example.org',subject:'other',label:'',confirmed:true}])
            expect(() => p.register(f.session, bad)).toThrow();
    }
    finally {
        f.close();
    } });
    it('enforces four-role direct permission matrix and audit admission, revokes references after uncertain commit', () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        for (const role of ['Administrator', 'Auditor', 'Member'] as const) {
            f.store.state.users[0]!.role = role;
            for (const call of [() => p.invite(f.session, { email: 'm@example.org', role: 'Member', confirmed: true }), () => p.register(f.session, { issuer: 'https://issuer.example.org', subject: 's', label: 'S', confirmed: true }), () => p.revoke(f.session, { id: f.session.userId, confirmed: true })])
                expect(call).toThrow(/Forbidden/);
            if (role === 'Member') {
                expect(() => p.list(f.session)).toThrow();
                expect(f.manager.list(f.session).services).toHaveLength(0);
            }
            else
                expect(p.list(f.session).writable).toBe(false);
        }
        f.store.state.users[0]!.role = 'Owner';
        f.store.journal.degraded = true;
        expect(() => p.invite(f.session, { email: 'm@example.org', role: 'Member', confirmed: true })).toThrow();
    }
    finally {
        f.close();
    } });
});
