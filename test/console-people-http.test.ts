import { randomUUID } from 'node:crypto';
import { consoleNotifications } from '../src/consoleNotifications.js';
import { describe, it, expect, vi } from 'vitest';
import { once } from 'node:events';
import { request } from 'node:http';
import { managedFixture } from './consoleManagementFixtures.js';
import { createGatewayServer } from '../src/server.js';
import { GatewayRuntime } from '../src/runtime.js';
import { consolePeople } from '../src/consolePeople.js';
import { consoleServices } from '../src/consoleServices.js';
import { totp } from '../src/consoleCrypto.js';
import type { AuthContext } from '../src/types.js';
async function fixture() { const f = managedFixture(); const runtime = new GatewayRuntime(f.cfg); const server = createGatewayServer(f.cfg, { consoleStore: f.store, runtime, closeRuntimeOnServerClose: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = (server.address() as import('node:net').AddressInfo).port; const base = 'http://127.0.0.1:' + port; const headers = { cookie: '__Host-ss-console=' + f.token, origin: 'https://console.example.org', 'content-type': 'application/json', 'x-console-csrf': f.csrf }; return { ...f, runtime, server, base, port, headers, get: (path: string) => fetch(base + '/console/api/' + path, { headers }), post: (path: string, data: unknown, extra = {}) => fetch(base + '/console/api/' + path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(data) }), async close() { await new Promise<void>(r => server.close(() => r())); await runtime.close(); f.close(); } }; }
describe('direct people HTTP/MCP boundaries', () => {
    it.each(['Owner', 'Administrator', 'Auditor', 'Member'] as const)('enforces %s allowed and forbidden management cells; assignments separate from execution', async (role) => {
        const f = await fixture();
        try {
            const manager = consoleServices(f.store);
            manager.access(f.session, { id: 'baseline', user: f.session.userId, action: 'grant', confirmed: true });
            const target = { ...structuredClone(f.store.state.users[0]!), id: randomUUID(), email: 'eligible@example.org', role: 'Member' as const };
            f.store.state.users.push(target);
            f.store.state.users[0]!.role = role;
            expect((await f.get('services')).status).toBe(200);
            for (const path of ['people', 'instance', 'notifications'])
                expect((await f.get(path)).status).toBe(role === 'Member' ? 403 : 200);
            expect((await f.get('services/baseline')).status).toBe(role === 'Member' ? 403 : 200);
            expect((await f.get('activity')).status).toBe(200);
            const mutations: [
                string,
                unknown
            ][] = [['people/invite', { email: 'new@example.org', role: 'Member', confirmed: true }], ['people/external', { issuer: 'https://issuer.example.org', subject: 's', label: 'External', confirmed: true }], ['notifications/save', { credentialVersion: 0, base: 0, generation: 0, settings: { host: 'smtp.example.org', port: 465, sender: 'console@example.org', username: '', password: '' } }]];
            for (const [path, data] of mutations)
                expect((await f.post(path, data)).status).toBe(role === 'Owner' ? 200 : 403);
            if (role !== 'Owner') {
                const n = consoleNotifications(f.store); n.transport=async()=>{throw Error('synthetic delivery failure');};
                const settings = { host: 'smtp.example.org', port: 465, sender: 'console@example.org', username: '', password: '' };
                const review = randomUUID();
                f.store.state.notifications = { revision: 0, applied: settings, draft: { base: 0, generation: 1, actor: f.session.userId, settings }, review: { id: review, base: 0, generation: 1, actor: f.session.userId }, deliveries: [] };
                const cells: [
                    string,
                    unknown,
                    string
                ][] = [['people/change', { id: target.id, role: 'Member', active: false, confirmed: true }, 'people.change'], ['people/recovery', { id: target.id, purpose: 'factor', channel: 'in_person', verified: true, confirmed: true }, 'people.recovery'], ['people/revoke', { id: target.id, confirmed: true }, 'people.revoke'], ['people/external-change', { id: target.id, active: false, confirmed: true }, 'people.change'], ['notifications/delete', {revision:0,credentialVersion:0,confirmed:true}, 'notifications.delete'], ['notifications/review', {}, 'notifications.apply'], ['notifications/apply', { review, confirmed: true }, 'notifications.apply'], ['notifications/test', { recipient: 'test@example.org', confirmed: true }, 'notifications.test']];
                for (const [path, data, action] of cells) {
                    f.store.state.sessions[0]!.recent = { action, expires: Date.now() + 300000 };
                    expect((await f.post(path, data)).status).toBe(role === 'Administrator' && path === 'people/recovery' ? 200 : 403);
                }
            }
            const cfgsave = { id: 'baseline', base: manager.state.revision, generation: 0, service: manager.state.services.baseline!.applied };
            expect((await f.post('service/save', cfgsave)).status).toBe(['Owner', 'Administrator'].includes(role) ? 200 : 403);
            // Administrator successfully restricted this target through MFA reset above.
            expect((await f.post('service/access', { id: 'baseline', user: target.id, action: 'grant', confirmed: true })).status).toBe(role === 'Owner' ? 200 : role === 'Administrator' ? 400 : 403);
            const identity = consolePeople(f.store).state.external[0]?.id;
            if (role === 'Owner')
                expect((await f.post('service/access', { id: 'baseline', user: identity, action: 'grant', confirmed: true })).status).toBe(200);
            const auth: AuthContext = { subject: f.session.userId, mode: 'bearer', scopes: ['gateway.read', 'gateway.references', 'gateway.request'] };
            expect(() => manager.admit('unassigned-synthetic', 'baseline')).toThrow();
            if (role === 'Auditor')
                expect(() => f.runtime.capabilities.tokenBroker.issueTokens(auth, { service: 'baseline', access_ids: ['gateway_access'], reason: 'matrix' })).toThrow();
            else
                expect(f.runtime.capabilities.tokenBroker.issueTokens(auth, { service: 'baseline', access_ids: ['gateway_access'], reason: 'matrix' }).tokens).toHaveLength(1);
            expect((await fetch(f.base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', cookie: f.headers.cookie }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).status).toBe(401);
        }
        finally {
            await f.close();
        }
    });
    it('harmless GET, origin/CSRF/malformed proof controls, capability restriction and invitation parallel completion', async () => { const f = await fixture(); try {
        const r = await (await f.post('people/invite', { email: 'member@example.org', role: 'Member', confirmed: true })).json();
        const proof = Object.fromEntries(new URLSearchParams(new URL(r.link).hash.slice(1)));
        const revision = f.store.state.revision;
        const preview = await fetch(f.base + '/console#' + new URLSearchParams(proof));
        expect(preview.headers.get('cache-control')).toBe('no-store');
        expect(preview.headers.get('referrer-policy')).toBe('no-referrer');
        expect(f.store.state.revision).toBe(revision);
        expect((await f.post('link/preview', proof, { cookie: '' })).status).toBe(200);
        expect((await f.post('people/invite', { email: 'other@example.org', role: 'Member', confirmed: true }, { origin: 'https://evil.example.org' })).status).toBe(403);
        expect((await f.post('people/invite', { email: 'other@example.org', role: 'Member', confirmed: true }, { 'x-console-csrf': 'wrong' })).status).toBe(403);
        expect((await f.post('link/begin', { ...proof, password: 'short' })).status).toBe(400);
        const e = await (await f.post('link/begin', { ...proof, password: 'Synthetic invited long passphrase 2026' }, { cookie: '' })).json();
        const attempts = await Promise.all([1, 2].map(() => f.post('link/complete', { ...proof, code: totp(e.seed, Date.now()), saved: true }, { cookie: '' })));
        expect(attempts.map(r => r.status).sort()).toEqual([200, 400]);
        expect((await f.post('people/invite', { ...proof }, { cookie: '' })).status).toBe(401);
    }
    finally {
        await f.close();
    } });
    it('current authority/expiry after body wait prevents effects; real broker invalidation survives completion uncertainty', async () => {
        const f = await fixture();
        try {
            const manager = consoleServices(f.store), p = consolePeople(f.store);
            manager.access(f.session, { id: 'baseline', user: f.session.userId, action: 'grant', confirmed: true });
            const auth: AuthContext = { subject: f.session.userId, mode: 'bearer', scopes: ['gateway.read', 'gateway.references', 'gateway.request'] };
            const broker = f.runtime.capabilities.tokenBroker;
            const reference = broker.issueTokens(auth, { service: 'baseline', access_ids: ['gateway_access'], reason: 'check' }).tokens[0]!.token;
            p.resetDelivery=async()=>{};await p.requestPassword({email:'owner@example.org'});expect(p.state.proofs).toHaveLength(1);const finish = vi.spyOn(f.store.journal, 'finish').mockImplementation(() => { throw Error('synthetic completion loss'); });
            expect(() => f.store.changePassword(f.session, 'A novel lengthy passphrase 2026', totp(f.store.state.users[0]!.seed, Date.now() + 30000), 'A replacement lengthy passphrase 2026', Date.now() + 30000)).toThrow(/uncertain/);
            finish.mockRestore();
            expect(() => broker.validateServiceReferenceUse(auth, { service: 'baseline' }, reference)).toThrow();
            expect(f.store.session(f.token)).toBeUndefined();expect(p.state.proofs).toHaveLength(0);
        }
        finally {
            await f.close();
        }
    });
    it('body-wait session expiry rejects management mutation at authoritative confirmation time', async () => { const f = await fixture(); try {
        const payload = JSON.stringify({ email: 'new@example.org', role: 'Member', confirmed: true });
        let outgoing: ReturnType<typeof request>;
        let started!: () => void;
        const waiting = new Promise<void>(r => { started = r; });
        f.server.prependListener('request', req => req.on('newListener', name => { if (name === 'data')
            queueMicrotask(started); }));
        const result = new Promise<number>((resolve, reject) => { outgoing = request({ host: '127.0.0.1', port: f.port, path: '/console/api/people/invite', method: 'POST', headers: { ...f.headers, 'content-length': Buffer.byteLength(payload) } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); }); outgoing.on('error', reject); outgoing.write(payload.slice(0, 10)); });
        await waiting;
        f.clock.mockReturnValue(Date.now() + 1800000);
        outgoing!.end(payload.slice(10));
        expect(await result).not.toBe(200);
        expect(f.store.state.users).toHaveLength(1);
    }
    finally {
        await f.close();
    } });
});

it('external disable/re-enable changes current eligibility and revokes real broker references without activating modes',async()=>{const f=await fixture();try{const p=consolePeople(f.store),manager=consoleServices(f.store);const r=p.register(f.session,{issuer:'https://issuer.example.org',subject:'external-1',label:'Explicit external',confirmed:true});f.store.state.users[0]!.role='Administrator';manager.access(f.session,{id:'baseline',user:r.id,action:'grant',confirmed:true});f.store.state.users[0]!.role='Owner';const auth:AuthContext={subject:r.id,mode:'bearer',scopes:['gateway.read','gateway.references','gateway.request']},broker=f.runtime.capabilities.tokenBroker;const ref=broker.issueTokens(auth,{service:'baseline',access_ids:['gateway_access'],reason:'registry'}).tokens[0]!.token;expect(()=>p.externalChange(f.session,{id:r.id,active:'yes',confirmed:true})).toThrow();expect(()=>p.externalChange(f.session,{id:f.session.userId,active:false,confirmed:true})).toThrow();p.externalChange(f.session,{id:r.id,active:false,confirmed:true});expect(()=>manager.admit(r.id,'baseline')).toThrow();expect(()=>broker.validateServiceReferenceUse(auth,{service:'baseline'},ref)).toThrow();expect(()=>manager.access(f.session,{id:'baseline',user:r.id,action:'grant',confirmed:true})).toThrow();expect(p.state.external[0]!.authorizationGeneration).toBe(1);p.externalChange(f.session,{id:r.id,active:true,confirmed:true});expect(()=>manager.admit(r.id,'baseline')).not.toThrow();expect(()=>broker.validateServiceReferenceUse(auth,{service:'baseline'},ref)).toThrow();expect(broker.issueTokens(auth,{service:'baseline',access_ids:['gateway_access'],reason:'fresh'}).tokens).toHaveLength(1);expect(f.cfg.auth.mode).toBe('bearer');}finally{await f.close();}});
