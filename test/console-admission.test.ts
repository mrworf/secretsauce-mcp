import { once } from 'node:events';
import { createServer } from 'node:http';
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, vi } from 'vitest';
import { AuditSink } from '../src/audit.js';
import { validateConfig } from '../src/config.js';
import { createGatewayServer, startServer } from '../src/server.js';
import { executeServiceRequest } from '../src/gateway.js';
import { createRequestDependencies } from '../src/requestDependencies.js';
import { fixture, setup } from './consoleFixtures.js';
import { ConsoleStore } from '../src/consoleStore.js';
import { totp } from '../src/consoleCrypto.js';
import type { AuthContext } from '../src/types.js';
const actor: AuthContext = { subject: 'owner@example.org', mode: 'bearer', scopes: ['gateway.read', 'gateway.references', 'gateway.request'] };
function config(url: string, file?: string) { return validateConfig({ server: { listen: '127.0.0.1:8080', mcp_path: '/mcp' }, auth: { mode: 'bearer', bearer: { token_env: 'TEST_BEARER' } }, ...(file ? { audit: { file } } : {}), services: { example: { type: 'http', name: 'Example', no_auth: true, destinations: [{ name: 'primary', base_url: url, schemes: ['http'], hosts: [{ exact: '127.0.0.1' }] }], credentials: [], access: { users: ['owner@example.org'] }, policy: { mode: 'allow', rules: [] } } } }, { TEST_BEARER: 'synthetic-gateway-bearer' }); }
async function downstream(onCall?: () => void) {
    let count = 0;
    const server = createServer((_req, res) => { count++; onCall?.(); res.end('example response'); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Expected listener');
    return { url: 'http://127.0.0.1:' + address.port, count: () => count, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}
async function listen(server: ReturnType<typeof createGatewayServer>) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const a = server.address();
    if (!a || typeof a === 'string')
        throw new Error('Expected listener');
    return 'http://127.0.0.1:' + a.port;
}
describe('mandatory durable admission and outages', () => {
    it('default YAML runtime uses persistent audit; failed admission prevents new/existing reference effects and downstream I/O', async () => {
        const d = await downstream();
        const cfg = config(d.url);
        const dep = createRequestDependencies(cfg);
        try {
            expect(dep.auditSink.file).toContain('gateway.jsonl');
            const issue = dep.capabilities.tokenBroker.issueTokens(actor, { service: 'example', access_ids: ['gateway_access'], reason: 'synthetic request' });
            const reference = issue.tokens[0]!.token;
            const admitted = await executeServiceRequest(cfg, actor, { service: 'example', method: 'GET', path: '/', service_reference: reference, reason: 'synthetic request' }, dep);
            expect(d.count()).toBe(1);
            expect(dep.auditSink.operationStatus(admitted.request_id)).toBe('success');
            const admission = vi.spyOn(dep.auditSink, 'admit').mockImplementation(() => { throw new Error('Synthetic disk full'); });
            await expect(executeServiceRequest(cfg, actor, { service: 'example', method: 'GET', path: '/', service_reference: reference, reason: 'synthetic request' }, dep)).rejects.toThrow();
            expect(() => dep.capabilities.tokenBroker.issueTokens(actor, { service: 'example', access_ids: ['gateway_access'], reason: 'synthetic request' })).toThrow();
            expect(d.count()).toBe(1);
            admission.mockRestore();
        }
        finally {
            dep.auditSink.close();
            await dep.secretRuntime.pool.close();
            await d.close();
        }
    });
    it('actual fsync/write failure blocks reference issuance before effect without exposing path or credentials', () => {
        const dir = mkdtempSync(join(tmpdir(), 'gateway-admit-fault-'));
        const cfg = config('http://127.0.0.1:1', join(dir, 'audit.jsonl'));
        let fail = false;
        const sink = new AuditSink(cfg, { ensureDirectory: p => mkdirSync(p, { recursive: true }), open: p => openSync(p, 'a', 0o600), write: (fd, b, o, n) => {
                if (fail)
                    throw new Error('ENOSPC synthetic credential');
                return writeSync(fd, b, o, n);
            }, sync: fsyncSync, close: closeSync });
        try {
            sink.admit('before', 'actor', 'instance');
            fail = true;
            sink.record({ type: 'tool_invocation', tool: 'list_services', subject: 'actor', outcome: 'allow', timestamp: new Date().toISOString() });
            expect(sink.degraded).toBe(true);
            expect(() => sink.admit('after', 'actor', 'instance')).toThrow('durable audit');
        }
        finally {
            sink.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('leaves already dispatched work uncertain when completion recording fails; restart preserves status with no retry', async () => {
        let sink: AuditSink | undefined;
        const d = await downstream(() => { vi.spyOn(sink!, 'complete').mockImplementation(() => { throw new Error('Completion unavailable'); }); });
        const dir = mkdtempSync(join(tmpdir(), 'gateway-uncertain-'));
        const cfg = config(d.url, join(dir, 'audit.jsonl'));
        const dep = createRequestDependencies(cfg);
        sink = dep.auditSink;
        try {
            const ref = dep.capabilities.tokenBroker.issueTokens(actor, { service: 'example', access_ids: ['gateway_access'], reason: 'synthetic request' }).tokens[0]!.token;
            await expect(executeServiceRequest(cfg, actor, { service: 'example', method: 'GET', path: '/', service_reference: ref, reason: 'synthetic request' }, dep)).rejects.toThrow('Completion');
            expect(d.count()).toBe(1);
            const starts = readFileSync(sink.file + '.chain', 'utf8').trim().split('\n').map(l => JSON.parse(l).record).filter(r => r.action === 'service.dispatch' && r.phase === 'start');
            const id = starts[0].id;
            expect(sink.operationStatus(id)).toBe('uncertain');
            sink.close();
            const reopened = new AuditSink(cfg);
            expect(reopened.degraded).toBe(false);
            expect(reopened.operationStatus(id)).toBe('uncertain');
            expect(d.count()).toBe(1);
            reopened.close();
        }
        finally {
            vi.restoreAllMocks();
            sink.close();
            await dep.secretRuntime.pool.close();
            await d.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('outage preserves existing role-scoped reads and safe diagnostic login, blocks mutations, logout works, and fresh login is required after repair', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000030000);
        const f = fixture();
        const cfg = config('http://127.0.0.1:1');
        const server = createGatewayServer(cfg, { consoleStore: f.store });
        const base = await listen(server);
        try {
            const e = setup(f, 1800000000000);
            f.store.journal.degraded = true;
            const result = await fetch(base + '/console/api/login', { method: 'POST', headers: { origin: 'https://console.example.org', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.org', password: 'A novel lengthy passphrase 2026', code: totp(e.seed) }) });
            expect(result.status).toBe(200);
            const json = await result.json() as {
                csrf: string;
            };
            const cookie = result.headers.get('set-cookie')!.split(';')[0]!;
            expect((await fetch(base + '/health')).status).toBe(503);
            expect(await (await fetch(base + '/health')).json()).toEqual({ status: 'not_ready' });
            expect((await fetch(base + '/console/api/instance', { headers: { cookie } })).status).toBe(200);
            f.store.journal.degraded = false;
            expect((await fetch(base + '/console/api/password', { method: 'POST', headers: { cookie, origin: 'https://console.example.org', 'content-type': 'application/json', 'x-console-csrf': json.csrf }, body: JSON.stringify({ password: 'A novel lengthy passphrase 2026', code: '123456', replacement: 'a valid changed password phrase' }) })).status).toBe(400);
            expect((await fetch(base + '/console/api/logout', { method: 'POST', headers: { cookie, origin: 'https://console.example.org', 'content-type': 'application/json', 'x-console-csrf': json.csrf }, body: '{}' })).status).toBe(200);
            clock.mockReturnValue(1800000060000);
            expect(f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(e.seed))).toMatchObject({ restricted: false });
            f.store.storageReliable = false;
            expect(() => f.store.login('owner@example.org', 'A novel lengthy passphrase 2026', totp(e.seed))).toThrow('storage');
        }
        finally {
            clock.mockRestore();
            server.close();
            f.close();
        }
    });
    it('checks integrity after restart and fails closed on key loss, JSONL changes or competing writer ownership', () => {
        const dir = mkdtempSync(join(tmpdir(), 'gateway-integrity-'));
        const cfg = config('http://127.0.0.1:1', join(dir, 'audit.jsonl'));
        const sink = new AuditSink(cfg);
        try {
            sink.record({ type: 'tool_invocation', tool: 'list_services', subject: 'actor', outcome: 'allow', timestamp: new Date().toISOString() });
            sink.close();
            writeFileSync(sink.file, readFileSync(sink.file, 'utf8').replace('"actor"', '"different"'));
            const modified = new AuditSink(cfg);
            expect(modified.degraded).toBe(true);
            modified.close();
            rmSync(sink.file + '.key');
            const lost = new AuditSink(cfg);
            expect(lost.degraded).toBe(true);
            expect(() => lost.admit('test', 'actor', 'instance')).toThrow();
            lost.close();
        }
        finally {
            sink.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
it('runtime construction failure releases managed writer ownership for a safe retry', async () => {
    const cfg = config('http://127.0.0.1:1');
    const f = fixture({ config: cfg });
    f.store.close();
    const oldDir = process.env.CONSOLE_STORAGE_DIR, oldKey = process.env.CONSOLE_KEY_FILE;
    process.env.CONSOLE_STORAGE_DIR = f.directory;
    process.env.CONSOLE_KEY_FILE = f.keyFile;
    try {
        const corrupt = new ConsoleStore(f.directory, f.keyFile);
        corrupt.commit('host', 'fixture.invalid_runtime', 'instance', s => { s.config!.limits = undefined as never; });
        corrupt.close();
        await expect(startServer(cfg)).rejects.toThrow();
        const retry = new ConsoleStore(f.directory, f.keyFile);
        expect(retry.state.initialized).toBe(false);
        retry.close();
    }
    finally {
        if (oldDir === undefined)
            delete process.env.CONSOLE_STORAGE_DIR;
        else
            process.env.CONSOLE_STORAGE_DIR = oldDir;
        if (oldKey === undefined)
            delete process.env.CONSOLE_KEY_FILE;
        else
            process.env.CONSOLE_KEY_FILE = oldKey;
        f.close();
    }
});
it('durable operation metadata applies credential/opaque suppression while retaining safe actor attribution', () => { const cfg = config('http://127.0.0.1:1'); const sink = new AuditSink(cfg); try {
    const safe = sink.admit('test', 'owner@example.org', 'instance');
    expect(sink.operationActor(safe)).toBe('owner@example.org');
    const unsafe = sink.admit('test', 'gref_synthetic_sensitive_reference', 'Authorization: Basic YWJjOmRlZg==');
    sink.complete(unsafe, 'gref_synthetic_sensitive_reference', 'test', 'Authorization: Basic YWJjOmRlZg==');
    const disk = readFileSync(sink.file + '.chain', 'utf8');
    expect(disk).not.toContain('gref_synthetic_sensitive_reference');
    expect(disk).not.toContain('YWJjOmRlZg==');
}
finally {
    sink.close();
} });
it('rejects another live-process writer lock and shares one authenticated writer across local sinks', () => { const dir = mkdtempSync(join(tmpdir(), 'gateway-writer-')); const cfg = config('http://127.0.0.1:1', join(dir, 'audit.jsonl')); const file = cfg.audit.file!; try {
    writeFileSync(file + '.writer', String(process.pid), { mode: 0o600 });
    const refused = new AuditSink(cfg);
    expect(refused.degraded).toBe(true);
    expect(() => refused.admit('test', 'actor', 'instance')).toThrow();
    refused.close();
    rmSync(file + '.writer');
    const first = new AuditSink(cfg), second = new AuditSink(cfg);
    const a = first.admit('first', 'actor', 'instance');
    second.complete(a, 'actor', 'first', 'instance');
    expect(first.operationStatus(a)).toBe('success');
    first.close();
    expect(second.degraded).toBe(false);
    second.close();
    const restart = new AuditSink(cfg);
    expect(restart.operationStatus(a)).toBe('success');
    restart.close();
}
finally {
    rmSync(dir, { recursive: true, force: true });
} });
