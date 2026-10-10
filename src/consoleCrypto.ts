import { readFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export const randomSecret = () => randomBytes(32).toString('base64url');
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export function equal(a: string, b: string): boolean { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newSeed(): string { return Array.from(randomBytes(32), n => alphabet[n % 32]).join(''); }
export function totp(seed: string, time = Date.now()): string {
    let bits = '';
    for (const c of seed) {
        const i = alphabet.indexOf(c);
        if (i < 0)
            throw new Error('Invalid factor');
        bits += i.toString(2).padStart(5, '0');
    }
    const key = Buffer.from(bits.match(/.{8}/g)!.map(s => parseInt(s, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
    const mac = createHmac('sha1', key).update(counter).digest();
    const offset = mac[19]! & 15;
    return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
export function passwordHash(value: string): string { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(value, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 }).toString('hex'); }
export function passwordMatches(value: string, stored: string): boolean { const [salt, hash] = stored.split(':'); return Boolean(salt && hash && equal(scryptSync(value, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 }).toString('hex'), hash)); }
// Local rejection list; intentionally no password transmission to an external service.
const compromised = new Set([...readFileSync(new URL('../resources/compromised-passwords.txt', import.meta.url), 'utf8').split(/\r?\n/).map(s => s.toLowerCase()), 'passwordpassword', 'password123456789', '123456789012345', '1234567890123456', 'qwertyuiopasdfgh', 'letmeinletmeinletmein', 'correct horse battery staple', 'thisisapassword', 'iloveyouiloveyou', 'password1234567890', 'welcome123456789']);
export function validatePassword(value: unknown): asserts value is string { if (typeof value !== 'string' || [...value].length < 15 || [...value].length > 1024 || compromised.has(value.toLowerCase()) || /^(.)\1+$/.test(value))
    throw new Error('Use a password of 15–1024 characters that is not a common compromised value.'); }
export function encrypt(value: unknown, key: Buffer): string { const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, nonce); const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]); return JSON.stringify({ v: 1, n: nonce.toString('base64'), t: cipher.getAuthTag().toString('base64'), d: data.toString('base64') }); }
export function decrypt<T>(value: string, key: Buffer): T { const e = JSON.parse(value); if (e.v !== 1)
    throw new Error('Unsupported state'); const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(e.n, 'base64')); cipher.setAuthTag(Buffer.from(e.t, 'base64')); return JSON.parse(Buffer.concat([cipher.update(Buffer.from(e.d, 'base64')), cipher.final()]).toString()); }
