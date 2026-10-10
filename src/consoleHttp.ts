import type { IncomingMessage, ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import { consolePeople, PeopleError } from './consolePeople.js';
import { readBoundedBody } from './httpBody.js';
import { consolePage, consoleScript, consoleStyle } from './consolePage.js';
import { LoginAttemptLimiter } from './loginAttemptLimiter.js';
const limiters = new WeakMap<ConsoleStore, LoginAttemptLimiter>();
import { equal } from './consoleCrypto.js';
import { consoleServices, ServiceManagementError } from './consoleServices.js';
import { ConsoleOperationError, ConsoleStore } from './consoleStore.js';
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
    try {
        const cookie = request.headers.cookie;
        const matches = typeof cookie === 'string' ? cookie.split(';').map(c => c.trim()).filter(c => c.startsWith('__Host-ss-console=')) : [];
        const token = matches.length === 1 ? matches[0]!.slice('__Host-ss-console='.length) : undefined;
        const session = store.session(token);
        if (request.method === 'GET' && path === '/console/api/status') {
            const user = session ? store.authorize(session, 'own') : undefined;
            reply(200, { initialized: store.state.initialized, ...(!store.state.initialized ? { origin: store.state.origin } : {}), ...(session && user ? { csrf: session.csrf, user: { id: user.id, email: user.email, role: user.role }, name: store.state.name, degraded: store.journal.degraded || store.externalAudit?.degraded === true, restricted: session.restricted, sessions: store.ownSessions(session), mfa: 'Authenticator app enrolled', expires: Math.min(session.created + 43200000, session.lastSeen + 1800000) } : {}) });
            return;
        }
        if (request.method === 'GET' && path === '/console/api/people') { if(!session){reply(401,{message:'Sign in again.'});return;} reply(200,consolePeople(store).list(session));return; }
        if (request.method === 'GET' && path === '/console/api/instance') {
            if (!session) {
                reply(401, { message: 'Sign in again.' });
                return;
            }
            store.authorize(session, 'instance');
            reply(200, { name: store.state.name, status: (store.journal.degraded || store.externalAudit?.degraded) ? 'degraded' : 'ready', diagnostic: (store.journal.degraded || store.externalAudit?.degraded) ? 'Durable audit unavailable. Repair host storage and restart.' : store.storageReliable ? 'Storage available.' : 'Identity storage unavailable.' });
            return;
        }
        if (request.method === 'GET' && path?.startsWith('/console/api/operations/')) {
            if (!session) {
                reply(401, { message: 'Sign in again.' });
                return;
            }
            store.authorize(session, 'own');
            const id = path.slice('/console/api/operations/'.length);
            const actor = store.journal.actorFor(id) ?? store.externalAudit?.operationActor(id);
            const user = store.authorize(session, 'own');
            if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || (actor !== user.id && actor !== user.email))
                throw new Error('Forbidden.');
            reply(200, { operation: id, status: store.journal.status(id) === 'unknown' ? store.externalAudit?.operationStatus(id) ?? 'unknown' : store.journal.status(id) });
            return;
        }
        if (request.method === 'GET' && (path === '/console/api/services' || path?.startsWith('/console/api/services/'))) {
            if (!session) { reply(401, { message: 'Sign in again.' }); return; }
            const manager = consoleServices(store);
            reply(200, path === '/console/api/services' ? manager.list(session) : manager.detail(session, decodeURIComponent(path!.slice('/console/api/services/'.length)))); return;
        }
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
        const data = JSON.parse((await readBoundedBody(request, 131072, 5000)).toString());
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
        if(path === '/console/api/link/preview'){reply(200,consolePeople(store).preview(data));return;}
        if(path === '/console/api/link/begin'){const r=consolePeople(store).begin(data);reply(200,{...r,qr:await QRCode.toDataURL('otpauth://totp/SecretSauce?secret='+r.seed+'&issuer=SecretSauce')});return;}
        if(path === '/console/api/link/complete'){reply(200,consolePeople(store).complete(data));return;}
        if (path === '/console/api/login') {
            const result = store.login(data.email, data.password, data.code);
            response.setHeader('set-cookie', '__Host-ss-console=' + result.token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
            reply(200, { status: 'success', csrf: result.csrf, restricted: result.restricted });
            return;
        }
        if (!session) {
            reply(401, { message: 'Sign in again.' });
            return;
        }
        if (typeof request.headers['x-console-csrf'] !== 'string' || !equal(request.headers['x-console-csrf'], session.csrf)) {
            reply(403, { message: 'Reload this page before submitting.' });
            return;
        }
        if(path==='/console/api/people/invite'){reply(200,consolePeople(store).invite(session,data));return;}
        if(path==='/console/api/people/invitation'){reply(200,consolePeople(store).invitation(session,data));return;}
        if(path==='/console/api/people/change'){reply(200,consolePeople(store).change(session,data));return;}
        if(path==='/console/api/people/revoke'){reply(200,consolePeople(store).revoke(session,data));return;}
        if(path==='/console/api/people/external'){reply(200,consolePeople(store).register(session,data));return;}
        if (path?.startsWith('/console/api/service/')) {
            const manager = consoleServices(store);
            if (path === '/console/api/service/credential') { reply(200, manager.credential(session, data)); return; }
            if (path === '/console/api/service/access') { reply(200, manager.access(session, data)); return; }
            if (path === '/console/api/service/lifecycle') { reply(200, manager.lifecycle(session, data)); return; }
            if (path === '/console/api/service/save') { reply(200, manager.save(session, data)); return; }
            if (path === '/console/api/service/review') { reply(200, manager.review(session, data)); return; }
            if (path === '/console/api/service/apply') { reply(200, manager.apply(session, data)); return; }
        }
        if (path === '/console/api/logout') {
            try {
                store.logout(session);
            }
            finally {
                response.setHeader('set-cookie', '__Host-ss-console=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
            }
            reply(200, { status: 'success' });
            return;
        }
        if (path === '/console/api/session/revoke') {
            reply(200, { status: 'success', operation: store.revokeOther(session, data.id) });
            return;
        }
        if (path === '/console/api/reauthenticate') {
            store.recentCheck(session, data.action, data.password, data.code);
            reply(200, { status: 'success', expires: Date.now() + 300000 });
            return;
        }
        if (path === '/console/api/password') {
            let operation: string;
            try {
                operation = store.changePassword(session, data.password, data.code, data.replacement);
            }
            catch (error) {
                if (error instanceof ConsoleOperationError)
                    response.setHeader('set-cookie', '__Host-ss-console=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
                throw error;
            }
            response.setHeader('set-cookie', '__Host-ss-console=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
            reply(200, { status: 'success', operation });
            return;
        }
        reply(404, { message: 'Not found.' });
    }
    catch (error) {
        if (error instanceof PeopleError) { reply(400,{message:error.message});return; }
        if (error instanceof ServiceManagementError) {
            reply(error.comparison ? 409 : 400, { message: error.message, ...(error.comparison ? { comparison: error.comparison } : {}) }); return;
        }
        if (error instanceof ConsoleOperationError) {
            reply(503, { message: error.message, operation: error.operation, status: 'uncertain' });
            return;
        }
        reply(error instanceof Error && error.message === 'Forbidden.' ? 403 : (store.journal.degraded || store.externalAudit?.degraded || !store.storageReliable) ? 503 : 400, { message: (store.journal.degraded || store.externalAudit?.degraded) ? 'Durable audit unavailable. Ask the host operator to repair storage.' : error instanceof Error && /^(Use |Setup |Enrollment |Instance name |Enter a valid|Authenticator code |Save recovery|Sign-in |Sign in |Sensitive actions |Session limit |Confirm password|Forbidden)/.test(error.message) ? error.message : 'Request was not accepted.' });
    }
}
