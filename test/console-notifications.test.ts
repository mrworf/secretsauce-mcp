import { describe, it, expect, vi } from 'vitest';
import { createServer } from 'node:tls';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConsoleNotifications, sendSmtp } from '../src/consoleNotifications.js';
import { ConsolePeople } from '../src/consolePeople.js';
import { managedFixture } from './consoleManagementFixtures.js';
const config = { host: 'smtp.example.org', port: 465, sender: 'console@example.org', username: 'synthetic-user', password: 'synthetic-mail-secret' };
function recent(f: ReturnType<typeof managedFixture>, action: string) { f.store.state.sessions[0]!.recent = { action, expires: Date.now() + 300000 }; }
function apply(f: ReturnType<typeof managedFixture>, n: ConsoleNotifications, c = config, clearCredential = false) { n.save(f.session, { base: n.state.revision, generation: n.state.draft?.generation ?? 0, settings: c, clearCredential }); const r = n.review(f.session); recent(f, 'notifications.apply'); n.apply(f.session, { review: r.review, confirmed: true }); }
describe('bounded optional SMTP', () => {
    it('Owner draft/apply is scoped and write-only; replaces/deletes credentials and disables delivery; other roles and malformed input denied', async () => { const f = managedFixture(); try {
        const n = new ConsoleNotifications(f.store);
        n.save(f.session, { base: 0, generation: 0, settings: config });
        expect(n.state.applied).toBeUndefined();
        expect(JSON.stringify(n.read(f.session))).not.toContain(config.password);
        const r = n.review(f.session);
        expect(() => n.apply(f.session, { review: r.review, confirmed: true })).toThrow(/Confirm/);
        recent(f, 'notifications.apply');
        n.apply(f.session, { review: r.review, confirmed: true });
        expect(n.state.applied!.password).toBe(config.password);expect(()=>n.apply(f.session,{review:r.review,confirmed:true})).toThrow(/Stale/);expect(()=>n.save(f.session,{base:999,generation:0,settings:config})).toThrow(/Stale/);recent(f,'notifications.test');await expect(n.test(f.session,{recipient:'bad\r\nrecipient',confirmed:true})).rejects.toThrow(/Invalid/);
        apply(f, n, { ...config, password: '' }, true);
        expect(n.state.applied!.password).toBe('');
        expect(n.read(f.session).applied!.credentialVersion).toBe(2);
        apply(f, n, { ...config, enabled: false } as typeof config);
        expect(await n.send('security', 'person@example.org', 'safe notice')).toEqual({ status: 'manual' });
        for (const role of ['Administrator', 'Auditor', 'Member'] as const) {
            f.store.state.users[0]!.role = role;
            expect(() => n.save(f.session, { base: n.state.revision, generation: 0, settings: config })).toThrow(/Forbidden/);
        }
        f.store.state.users[0]!.role = 'Owner';
        for (const c of [{ ...config, host: 'smtp.example.org/path' }, { ...config, port: 0 }, { ...config, sender: 'a@example.org\r\nBcc: b@example.org' }, { ...config, password: 'bad\nsecret' }, { ...config, extra: true },{...config,enabled:'yes'},{...config,username:'bad\nusername'},{...config,port:65536}])
            expect(() => n.save(f.session, { base: n.state.revision, generation: 0, settings: c })).toThrow(/Invalid/);
    }
    finally {
        f.close();
    } });
    it('delivery failure is sanitized and cannot alter identity/recovery or block gateway; concurrency bounded and audit gate enforced', async () => { const f = managedFixture(); try {
        const n = new ConsoleNotifications(f.store);
        apply(f, n);
        n.transport = async () => { throw Error('unsafe raw downstream SMTP body ' + config.password); };
        recent(f, 'notifications.test');
        expect(await n.test(f.session, { recipient: 'person@example.org', confirmed: true })).toEqual({ status: 'failed' });
        expect(JSON.stringify(n.read(f.session))).not.toContain(config.password);
        expect(JSON.stringify(n.read(f.session))).not.toContain('unsafe');
        expect(f.store.state.users[0]!.enrolled).not.toBe(false);
        f.manager.access(f.session, { id: 'baseline', user: f.session.userId, action: 'grant', confirmed: true });
        expect(() => f.manager.admit(f.session.userId, 'baseline')).not.toThrow();
        const releases: (() => void)[] = [];
        n.transport = vi.fn(() => new Promise<void>(r => releases.push(r)));
        const occupied = Array.from({ length: 4 }, () => n.send('security', 'person@example.org', 'safe'));
        expect(await n.send('security', 'person@example.org', 'safe')).toEqual({ status: 'capacity' });
        expect(n.transport).toHaveBeenCalledTimes(4);
        for (const release of releases)
            release();
        await Promise.all(occupied);
        const transport = vi.fn(async () => { });
        n.transport = transport;
        f.store.journal.degraded = true;
        await expect(n.send('security', 'person@example.org', 'safe')).rejects.toThrow();
        expect(transport).not.toHaveBeenCalled();
    }
    finally {
        f.close();
    } });
    it('public reset gives identical known/unknown responses without waiting for delayed SMTP, uniformly rejects new audit admission failure', async () => { const f = managedFixture(); try {
        const p = new ConsolePeople(f.store);
        let finish!: () => void;
        p.resetDelivery = () => new Promise<void>(r => { finish = r; });
        const known = await p.requestPassword({ email: 'owner@example.org' });
        expect(known).toEqual(await p.requestPassword({ email: 'unknown@example.org' }));
        finish();
        const start = vi.spyOn(f.store.journal, 'start').mockImplementation(() => { throw Error('synthetic disk failure'); });
        await expect(p.requestPassword({ email: 'owner@example.org' })).rejects.toThrow();
        await expect(p.requestPassword({ email: 'unknown@example.org' })).rejects.toThrow();
        start.mockRestore();
        f.store.journal.degraded = true;
        await expect(p.requestPassword({ email: 'owner@example.org' })).rejects.toThrow(/Recovery unavailable/);
        await expect(p.requestPassword({ email: 'unknown@example.org' })).rejects.toThrow(/Recovery unavailable/);
    }
    finally {
        f.close();
    } });
    it('uses actual synthetic local TLS SMTP with validated certificate, rejects unsafe reply and absolute slow-drip deadline', async () => { const dir = mkdtempSync(join(tmpdir(), 'smtp-test-')); execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key'), '-out', join(dir, 'cert'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' }); const cert = readFileSync(join(dir, 'cert')); let mode = 'ok'; const sockets = new Set<import('node:tls').TLSSocket>(); const server = createServer({ key: readFileSync(join(dir, 'key')), cert }, socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => { }); if (mode === 'slow') {
        const timer = setInterval(() => socket.write('220-drip\r\n'), 500);
        socket.on('close', () => clearInterval(timer));
        return;
    } socket.write(mode === 'bad' ? '500 synthetic unsafe detail\r\n' : '220 hello\r\n'); let buffer = '', data = false; socket.on('data', chunk => { buffer += chunk; while (buffer.includes('\r\n')) {
        const i = buffer.indexOf('\r\n'), line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (data) {
            if (line === '.') {
                data = false;
                socket.write('250 sent\r\n');
            }
            continue;
        }
        if (line.startsWith('EHLO'))
            socket.write('250-local\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH'))
            socket.write('235 auth\r\n');
        else if (line.startsWith('MAIL') || line.startsWith('RCPT'))
            socket.write('250 accepted\r\n');
        else if (line === 'DATA') {
            data = true;
            socket.write('354 data\r\n');
        }
    } }); }); try {
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const local = { ...config, host: 'localhost', port: (server.address() as import('node:net').AddressInfo).port };
        await expect(sendSmtp(local, 'person@example.org', 'manual synthetic link https://console.example.org/console#synthetic', { ca: cert })).resolves.toBeUndefined();
        mode = 'bad';
        await expect(sendSmtp(local, 'person@example.org', 'safe', { ca: cert })).rejects.toThrow(/Delivery failed/);
        mode = 'slow';
        const started = Date.now();
        await expect(sendSmtp(local, 'person@example.org', 'safe', { ca: cert })).rejects.toThrow(/Delivery failed/);
        expect(Date.now() - started).toBeLessThan(6000);
    }
    finally {
        for (const s of sockets)
            s.destroy();
        await new Promise<void>(r => server.close(() => r()));
        rmSync(dir, { recursive: true, force: true });
    } }, 10000);
});
