import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConsoleStore } from '../src/consoleStore.js';
import { totp } from '../src/consoleCrypto.js';
export function fixture(options: ConstructorParameters<typeof ConsoleStore>[2] = {}, keyHex = 'ab'.repeat(32)) { const directory = mkdtempSync(join(tmpdir(), 'console-test-')); const keyFile = join(directory, 'key'); writeFileSync(keyFile, keyHex, { mode: 0o600 }); const store = new ConsoleStore(directory, keyFile, options); return { directory, keyFile, store, close: () => { store.close(); rmSync(directory, { recursive: true, force: true }); } }; }
export function setup(f: ReturnType<typeof fixture>, time = Date.now()) { const proof = f.store.issueProof('https://console.example.org', time); const e = f.store.beginSetup({ proof, name: 'Example instance', origin: 'https://console.example.org', email: 'owner@example.org', password: 'A novel lengthy passphrase 2026' }, time); f.store.completeSetup(e.token, totp(e.seed, time), true, time); return e; }
