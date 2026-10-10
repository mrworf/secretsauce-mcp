import type { IncomingMessage, ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import { readBoundedBody } from './httpBody.js';
import { consolePage, consoleScript, consoleStyle } from './consolePage.js';
import { LoginAttemptLimiter } from './loginAttemptLimiter.js';
const limiters = new WeakMap<ConsoleStore, LoginAttemptLimiter>();
import { ConsoleStore } from './consoleStore.js';
export function isConsoleRequest(request: IncomingMessage): boolean { return request.url?.split('?')[0] === '/console' || Boolean(request.url?.startsWith('/console/')); }
export async function handleConsoleRequest(store: ConsoleStore, request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const path = request.url?.split('?')[0];
    const reply = (status: number, data: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(data)); };
    if (request.method === 'GET' && path === '/console') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(consolePage);
        return;
    }
    if (request.method === 'GET' && path === '/console/style.css') {
        response.writeHead(200, { 'content-type': 'text/css' });
        response.end(consoleStyle);
        return;
    }
    if (request.method === 'GET' && path === '/console/app.js') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end(consoleScript);
        return;
    }
    if (request.method === 'GET' && path === '/console/api/status') {
        reply(200, { initialized: store.state.initialized, ...(!store.state.initialized ? { origin: store.state.origin } : {}) });
        return;
    }
    try {
        if (request.method !== 'POST') {
            reply(404, { message: 'Not found.' });
            return;
        }
        if (!store.state.origin || request.headers.origin !== store.state.origin) {
            reply(403, { message: 'Trusted origin required.' });
            return;
        }
        let limiter = limiters.get(store);
        if (!limiter) {
            limiter = new LoginAttemptLimiter({ windowMs: 60000, perSource: 30, perAccount: 100, global: 300, initialLockoutMs: 60000, maxLockoutMs: 300000, maxEntries: 1000 });
            limiters.set(store, limiter);
        }
        const source = request.socket?.remoteAddress ?? 'local';
        if (!limiter.check(source, 'console').allowed) {
            reply(429, { message: 'Too many attempts. Wait before trying again.' });
            return;
        }
        limiter.recordFailure(source, 'console');
        if (request.headers['content-type'] !== 'application/json')
            throw new Error('Use JSON input.');
        const data = JSON.parse((await readBoundedBody(request, 16384, 5000)).toString());
        if (!data || Array.isArray(data) || typeof data !== 'object')
            throw new Error('Invalid input.');
        if (path === '/console/api/setup/begin') {
            const r = store.beginSetup(data);
            const uri = 'otpauth://totp/SecretSauce:' + encodeURIComponent(store.state.enrollment!.email) + '?secret=' + r.seed + '&issuer=SecretSauce';
            reply(200, { ...r, qr: await QRCode.toDataURL(uri) });
            return;
        }
        if (path === '/console/api/setup/complete') {
            const id = store.completeSetup(data.token, data.code, data.saved);
            reply(200, { status: 'success', operation: id });
            return;
        }
        reply(404, { message: 'Not found.' });
    }
    catch (error) {
        reply(store.journal.degraded ? 503 : 400, { message: store.journal.degraded ? 'Durable audit unavailable. Ask the host operator to repair storage.' : error instanceof Error && /^(Use |Setup |Enrollment |Instance name |Enter a valid|Authenticator code |Save recovery)/.test(error.message) ? error.message : 'Request was not accepted.' });
    }
}
