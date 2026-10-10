import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';
import { ConsoleStore } from '../src/consoleStore.js';
import { ConsoleJournal } from '../src/consoleJournal.js';
import { totp, validatePassword } from '../src/consoleCrypto.js';
import { fixture, setup } from './consoleFixtures.js';
describe('host-authorized durable setup', () => {
    it('requires proof and complete MFA; persists encrypted Owner/recovery verifiers across restart', () => {
        const f = fixture();
        try {
            expect(() => f.store.beginSetup({ proof: 'invented', name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' })).toThrow();
            const e = setup(f);
            const disk = readFileSync(f.store.file, 'utf8');
            for (const secret of [e.seed, e.token, e.backupMaterial, ...e.recoveryCodes, 'A novel lengthy passphrase 2026'])
                expect(disk).not.toContain(secret);
            expect(f.store.state.users[0]!.role).toBe('Owner');
            expect(f.store.state.users[0]!.recoveryHashes).toHaveLength(10);
            f.store.close();
            const reopened = new ConsoleStore(f.directory, f.keyFile);
            expect(reopened.state.initialized).toBe(true);
            expect(reopened.state.users[0]!.seed).toBe(e.seed);
            reopened.close();
        }
        finally {
            f.close();
        }
    });
    it('rejects expired/reissued/replayed/cross-instance proofs and incomplete setup', () => {
        const a = fixture(), b = fixture();
        try {
            const first = a.store.issueProof('https://console.example.org', 0);
            const second = a.store.issueProof('https://console.example.org', 1);
            const input = { name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' };
            expect(() => a.store.beginSetup({ ...input, proof: first }, 2)).toThrow();
            expect(() => b.store.beginSetup({ ...input, proof: second }, 2)).toThrow();
            expect(() => a.store.beginSetup({ ...input, proof: second }, 1800001)).toThrow();
            const proof = a.store.issueProof(input.origin);
            const e = a.store.beginSetup({ ...input, proof });
            expect(() => a.store.beginSetup({ ...input, proof })).toThrow();
            expect(a.store.state.initialized).toBe(false);
            expect(() => a.store.completeSetup(e.token, '000000', true)).toThrow();
            expect(() => a.store.completeSetup(e.token, totp(e.seed), false)).toThrow();
            a.store.completeSetup(e.token, totp(e.seed), true);
            expect(() => a.store.completeSetup(e.token, totp(e.seed), true)).toThrow();
        }
        finally {
            a.close();
            b.close();
        }
    });
    it('bounds proof/MFA attempts and validates every setup field', () => {
        const f = fixture();
        try {
            const proof = f.store.issueProof('https://console.example.org');
            const good = { proof, name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' };
            for (const change of [{ name: '' }, { name: 'x'.repeat(101) }, { origin: 'http://console.example.org' }, { origin: 'https://attacker.example.org' }, { email: 'not-email' }, { password: 'short' }])
                expect(() => f.store.beginSetup({ ...good, ...change })).toThrow();
            const e = f.store.beginSetup(good);
            for (let n = 0; n < 10; n++)
                expect(() => f.store.completeSetup(e.token, 'bad', true)).toThrow();
            expect(() => f.store.completeSetup(e.token, totp(e.seed), true)).toThrow();
        }
        finally {
            f.close();
        }
    });
    it('only one concurrent enrollment completion succeeds', async () => {
        const f = fixture();
        try {
            const proof = f.store.issueProof('https://console.example.org');
            const e = f.store.beginSetup({ proof, name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' });
            const results = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => f.store.completeSetup(e.token, totp(e.seed), true))));
            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        }
        finally {
            f.close();
        }
    });
    it('accepts long passwords without composition rules and rejects known compromised values', () => {
        expect(() => validatePassword('a varied 15char')).not.toThrow();
        expect(() => validatePassword('long simple words '.repeat(8))).not.toThrow();
        for (const p of ['passwordpassword', '123456789012345', 'x'.repeat(15), 'short', undefined])
            expect(() => validatePassword(p)).toThrow();
    });
    it('fails safely on missing keys, corrupted state, missing managed state and simultaneous writers', () => {
        const f = fixture();
        try {
            expect(() => new ConsoleStore(f.directory, f.keyFile)).toThrow();
            f.store.close();
            expect(() => new ConsoleStore(f.directory, join(f.directory, 'missing'))).toThrow();
            writeFileSync(f.store.file, 'corrupted');
            expect(() => new ConsoleStore(f.directory, f.keyFile)).toThrow();
            rmSync(f.store.file);
            expect(() => new ConsoleStore(f.directory, f.keyFile)).toThrow();
        }
        finally {
            f.close();
        }
    });
    it('does not commit setup when durable audit/state write fails; authenticates journal history', () => {
        let fail = false;
        const f = fixture({ faultAudit: () => {
                if (fail)
                    throw new Error('ENOSPC');
            } });
        try {
            f.store.issueProof('https://console.example.org');
            fail = true;
            expect(() => f.store.beginSetup({ proof: 'wrong', name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' })).toThrow();
            expect(f.store.state.initialized).toBe(false);
            expect(f.store.journal.degraded).toBe(true);
        }
        finally {
            f.close();
        }
        const g = fixture();
        try {
            const id = g.store.journal.start('actor', 'test', 'instance');
            expect(g.store.journal.status(id)).toBe('uncertain');
            const reopened = new ConsoleJournal(g.store.journal.path, g.store.key);
            expect(reopened.status(id)).toBe('uncertain');
            writeFileSync(g.store.journal.path, readFileSync(g.store.journal.path, 'utf8').replace('"test"', '"evil"'));
            expect(new ConsoleJournal(g.store.journal.path, g.store.key).degraded).toBe(true);
        }
        finally {
            g.close();
        }
    });
});
import { EventEmitter } from 'node:events';
import { handleConsoleRequest } from '../src/consoleHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
async function http(store: ConsoleStore, path: string, method = 'GET', body?: unknown, origin = 'https://console.example.org', contentType = 'application/json') {
    const request = new EventEmitter() as IncomingMessage;
    Object.assign(request, { url: path, method, headers: { origin, 'content-type': contentType }, pause: () => undefined });
    let status = 0, text = '';
    const response = { setHeader: () => undefined, writeHead: (s: number) => { status = s; }, end: (v: string) => { text = v; } } as unknown as ServerResponse;
    const pending = handleConsoleRequest(store, request, response);
    if (body !== undefined) {
        request.emit('data', Buffer.from(JSON.stringify(body)));
        request.emit('end');
    }
    await pending;
    return { status, text };
}
describe('setup HTTP boundary', () => {
    it('GET cannot consume a proof; trusted-origin JSON POST enrollment works and errors do not echo secrets', async () => {
        const f = fixture();
        try {
            const proof = f.store.issueProof('https://console.example.org');
            expect((await http(f.store, '/console/api/status')).status).toBe(200);
            expect(f.store.state.proof?.hash).toBeTruthy();
            const body = { proof, name: 'Example', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' };
            const rejected = await http(f.store, '/console/api/setup/begin', 'POST', body, 'https://attacker.example.org');
            expect(rejected.status).toBe(403);
            expect(rejected.text).not.toContain(proof);
            expect((await http(f.store, '/console/api/setup/begin', 'POST', body, undefined, 'text/plain')).status).toBe(400);
            const enrolled = await http(f.store, '/console/api/setup/begin', 'POST', body);
            expect(enrolled.status).toBe(200);
            const e = JSON.parse(enrolled.text);
            expect(e.qr).toMatch(/^data:image\/png/);
            expect((await http(f.store, '/console/api/setup/complete', 'POST', { token: e.token, code: totp(e.seed), saved: true })).status).toBe(200);
        }
        finally {
            f.close();
        }
    });
});
import { vi } from 'vitest';
it('fails closed when writer liveness cannot be established', () => {
    const f = fixture();
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('Permission uncertain'), { code: 'EPERM' }); });
    try {
        expect(() => new ConsoleStore(f.directory, f.keyFile)).toThrow('ownership');
    }
    finally {
        kill.mockRestore();
        f.close();
    }
});
it('first audit append requires directory durability, not only file flush', () => {
    const f = fixture();
    try {
        const journal = new ConsoleJournal(join(f.directory, 'new.chain'), f.store.key, phase => {
            if (phase === 'directory')
                throw new Error('directory fsync failure');
        });
        expect(() => journal.start('host', 'setup', 'instance')).toThrow('Durable');
        expect(journal.degraded).toBe(true);
    }
    finally {
        f.close();
    }
});
it('bounds source/global HTTP admissions before creating unbounded denial audit', async () => {
    const f = fixture();
    try {
        f.store.issueProof('https://console.example.org');
        for (let i = 0; i < 30; i++)
            await http(f.store, '/console/api/setup/begin', 'POST', {});
        const size = readFileSync(f.store.journal.path, 'utf8').length;
        expect((await http(f.store, '/console/api/setup/begin', 'POST', {})).status).toBe(429);
        expect(readFileSync(f.store.journal.path, 'utf8').length).toBe(size);
    }
    finally {
        f.close();
    }
});
