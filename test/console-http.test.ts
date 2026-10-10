import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it, expect, vi } from 'vitest';
import { handleConsoleRequest } from '../src/consoleHttp.js';
import { totp } from '../src/consoleCrypto.js';
import { fixture, setup } from './consoleFixtures.js';
import type { ConsoleStore, HumanRole } from '../src/consoleStore.js';
async function request(store: ConsoleStore, path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) { const req = new EventEmitter() as IncomingMessage; Object.assign(req, { url: path, method, headers: { origin: 'https://console.example.org', 'content-type': 'application/json', ...headers }, pause: () => undefined }); let status = 0, text = ''; const output: Record<string, string> = {}; const res = { setHeader: (k: string, v: string) => { output[k] = v; }, writeHead: (s: number, h: Record<string, string>) => { status = s; Object.assign(output, h); }, end: (v: string) => { text = v; } } as unknown as ServerResponse; const running = handleConsoleRequest(store, req, res); if (body !== undefined) {
    req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
} await running; return { status, body: JSON.parse(text), headers: output }; }
describe('console HTTP sessions and direct authorization', () => {
    it('accepts password/TOTP only, sets protected cookie, checks CSRF/Origin and can locally sign out', async () => { const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000030000); const f = fixture(); try {
        const enrollment = setup(f, 1800000000000);
        expect((await request(f.store, '/console/api/login', 'POST', { email: 'owner@example.org', password: 'wrong', code: '123456' })).status).toBe(400);
        expect((await request(f.store, '/console/api/status', 'GET', undefined, { authorization: 'Bearer fake' })).body.user).toBeUndefined();
        const login = await request(f.store, '/console/api/login', 'POST', { email: 'owner@example.org', password: 'A novel lengthy passphrase 2026', code: totp(enrollment.seed) });
        expect(login.status).toBe(200);
        expect(login.headers['set-cookie']).toContain('HttpOnly; Secure; SameSite=Strict');
        const cookie = login.headers['set-cookie']!.split(';')[0]!;
        expect((await request(f.store, '/console/api/status', 'GET', undefined, { cookie })).body.user.role).toBe('Owner');
        expect((await request(f.store, '/console/api/logout', 'POST', {}, { cookie })).status).toBe(403);
        expect((await request(f.store, '/console/api/logout', 'POST', {}, { cookie, 'x-console-csrf': login.body.csrf, origin: 'https://attacker.example.org' })).status).toBe(403);
        expect((await request(f.store, '/console/api/logout', 'POST', {}, { cookie, 'x-console-csrf': login.body.csrf })).status).toBe(200);
        expect((await request(f.store, '/console/api/status', 'GET', undefined, { cookie })).body.user).toBeUndefined();
        expect((await request(f.store, '/console/api/status', 'GET', undefined, { cookie: '__Host-ss-console=forged' })).body.user).toBeUndefined();
    }
    finally {
        clock.mockRestore();
        f.close();
    } });
    it('enforces current role on direct instance requests and scopes operation status', async () => { const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000030000); const f = fixture(); try {
        const e = setup(f, 1800000000000);
        const l = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(e.seed), Date.now());
        const cookie = '__Host-ss-console=' + l.token;
        for (const role of ['Owner', 'Administrator', 'Auditor', 'Member'] as HumanRole[]) {
            f.store.state.users[0]!.role = role;
            expect((await request(f.store, '/console/api/instance', 'GET', undefined, { cookie })).status).toBe(role === 'Member' ? 403 : 200);
        }
        const own = f.store.journal.start(f.store.state.users[0]!.id, 'action', 'self');
        const other = f.store.journal.start('another-actor', 'action', 'self');
        expect((await request(f.store, '/console/api/operations/' + own, 'GET', undefined, { cookie })).body.status).toBe('uncertain');
        expect((await request(f.store, '/console/api/operations/' + other, 'GET', undefined, { cookie })).status).toBe(403);
        expect((await request(f.store, '/console/api/operations/not-an-id', 'GET', undefined, { cookie })).status).toBe(403);
    }
    finally {
        clock.mockRestore();
        f.close();
    } });
    it('does not let sessions revoke another account or replace password without current factor', async () => { const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000030000); const f = fixture(); try {
        const e = setup(f, 1800000000000);
        const l = f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(e.seed));
        const headers = { cookie: '__Host-ss-console=' + l.token, 'x-console-csrf': l.csrf };
        const other = { ...f.store.state.sessions[0]!, id: 'other-session', userId: 'other-user', hash: 'other' };
        f.store.state.sessions.push(other);
        expect((await request(f.store, '/console/api/session/revoke', 'POST', { id: other.id }, headers)).status).toBe(403);
        expect((await request(f.store, '/console/api/password', 'POST', { replacement: 'valid new password words' }, headers)).status).toBe(400);
        expect((await request(f.store, '/console/api/reauthenticate', 'POST', { action: [], password: 'x', code: '123456' }, headers)).status).toBe(400);
    }
    finally {
        clock.mockRestore();
        f.close();
    } });
});
it('rechecks authoritative expiry after body upload rather than trusting earlier session lookup',async()=>{const time=1800000030000;const clock=vi.spyOn(Date,'now').mockReturnValue(time);const f=fixture();try{const e=setup(f,time-30000);const l=f.store.login('owner@example.org','A novel lengthy passphrase 2026',totp(e.seed));const session=f.store.state.sessions[0]!;const end=time+43200000;session.lastSeen=end-1000;clock.mockReturnValue(end-1000);const req=new EventEmitter() as IncomingMessage;Object.assign(req,{url:'/console/api/password',method:'POST',headers:{origin:'https://console.example.org','content-type':'application/json',cookie:'__Host-ss-console='+l.token,'x-console-csrf':l.csrf},pause:()=>undefined});let status=0;const res={setHeader:()=>undefined,writeHead:(s:number)=>{status=s;},end:()=>undefined} as unknown as ServerResponse;const pending=handleConsoleRequest(f.store,req,res);clock.mockReturnValue(end);req.emit('data',Buffer.from(JSON.stringify({password:'A novel lengthy passphrase 2026',code:totp(e.seed,end),replacement:'a new valid password phrase'})));req.emit('end');await pending;expect(status).toBe(400);expect(()=>f.store.authorize(session,'own')).toThrow('Sign in');expect(f.store.state.sessions).toHaveLength(1);}finally{clock.mockRestore();f.close();}});
