import {reviewSettings,applySettings,settingsState,discardSettings,SettingsError} from './consoleSettings.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import {consoleRestore,RestoreError} from './consoleRestore.js';
import {MAX_ARCHIVE_BYTES} from './consoleBackupArchive.js';
import {consoleBackups,BackupError} from './consoleBackups.js';
import { consoleOperations,OperatingError } from './consoleOperations.js';
import { consoleEvidence, EvidenceError } from './consoleEvidence.js';
import { consoleAuthentication, AuthenticationSettingsError } from './consoleAuthentication.js';
import { connectedClients, revokeClient, ClientManagementError } from './consoleClients.js';
import { configurationHistory,useConfigurationRevision } from './consoleHistory.js';
import { importConfiguration,exportConfiguration } from './consoleMigration.js';
import { consoleProtection } from './consoleProtection.js';
import { previewPolicy } from './policyPreview.js';
import { consoleNotifications, NotificationError } from './consoleNotifications.js';
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
        if(store.mutationsBlocked()&&!['/console/api/status','/console/api/logout','/console/api/restore/status','/console/api/restore/enroll-begin','/console/api/restore/enroll-complete'].includes(path??'')){reply(503,{message:'Instance recovery maintenance. Ordinary sensitive actions are unavailable; inspect restricted recovery status or use protected host repair.'});return;}
        const cookie = request.headers.cookie;
        const matches = typeof cookie === 'string' ? cookie.split(';').map(c => c.trim()).filter(c => c.startsWith('__Host-ss-console=')) : [];
        const token = matches.length === 1 ? matches[0]!.slice('__Host-ss-console='.length) : undefined;
        const session = store.session(token);
        if (request.method === 'GET' && path === '/console/api/status') {
            const user = session ? store.authorize(session, 'own') : undefined;
            reply(200, { initialized: store.state.initialized, ...(store.state.recovery?{recovery:{phase:store.state.recovery.phase,notice:store.state.recovery.notice,...(session&&user?{initiatorLabel:store.state.recovery.initiatorLabel,nominee:store.state.users.filter(u=>u.id===store.state.recovery!.nominee).map(u=>({id:u.id,email:u.email,role:u.role}))[0],authenticationReactivationRequired:store.state.recovery.authenticationReactivationRequired}: {})}}:{}), ...(!store.state.initialized&&store.state.restoreProof?{restoreAvailable:true}:{}), ...(!store.state.initialized ? { origin: store.state.origin } : {}), ...(session && user ? { csrf: session.csrf, user: { id: user.id, email: user.email, role: user.role }, name: store.state.name, degraded: store.journal.degraded || store.externalAudit?.degraded === true, restricted: session.restricted, sessions: store.ownSessions(session), mfa: 'Authenticator app enrolled', expires: Math.min(session.created + 43200000, session.lastSeen + 1800000) } : {}) });
            return;
        }
        if(request.method==='GET'&&path==='/console/api/backups'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,consoleBackups(store).read(session));return;}
        if(request.method==='GET'&&(path==='/console/api/limits'||path==='/console/api/health')){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,path==='/console/api/limits'?consoleOperations(store).read(session):consoleOperations(store).health(session));return;}
        if(request.method==='GET'&&path==='/console/api/authentication'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,consoleAuthentication(store).read(session));return;}
        if(request.method==='GET'&&path==='/console/api/clients'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,connectedClients(store,session));return;}
        if(request.method==='GET'&&path==='/console/api/notifications'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,consoleNotifications(store).read(session));return;}
        if(request.method==='GET'&&path==='/console/api/activity'){if(!session){reply(401,{message:'Sign in again.'});return;}const values:Record<string,unknown>=Object.create(null);const query=new URL(request.url!,'https://console.example.org').searchParams;for(const [key,value] of query){if(Object.hasOwn(values,key))throw new EvidenceError('Duplicate activity filter.');values[key]=['from','to','offset','limit'].includes(key)?Number(value):value;}reply(200,consoleEvidence(store).query(session,values));return;}
        if(request.method==='GET'&&path==='/console/api/retention'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,consoleEvidence(store).readRetention(session));return;}
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
        if(request.method==='GET'&&path==='/console/api/settings/state'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,settingsState(store,session));return;}
        if(request.method==='GET'&&path==='/console/api/configuration/history'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,configurationHistory(consoleServices(store),session));return;}
        if(request.method==='GET'&&path==='/console/api/protection'){if(!session){reply(401,{message:'Sign in again.'});return;}reply(200,consoleProtection(consoleServices(store)).read(session));return;}
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
        if(path==='/console/api/restore/preview'){
            if(store.state.initialized){if(!session){reply(401,{message:'Sign in again.'});return;}if(typeof request.headers['x-console-csrf']!=='string'||!equal(request.headers['x-console-csrf'],session.csrf)){reply(403,{message:'Reload this page before submitting.'});return;}const actor=store.requireSensitive(session);if(actor.role!=='Owner')throw new RestoreError('Forbidden.');store.requireRecent(session,'restore.start');}
            else consoleRestore(store).admitHostUpload(request.headers['x-console-restore-proof']);
            reply(200,await consoleRestore(store).preview(session,async()=>{const d=JSON.parse((await readBoundedBody(request,MAX_ARCHIVE_BYTES+65536,30000)).toString());if(!store.state.initialized){if(!d||typeof d!=='object'||Array.isArray(d)||Object.hasOwn(d,'proof'))throw new RestoreError('Host proof is supplied only through the protected upload header.');d.proof=request.headers['x-console-restore-proof'];}return d;}));return;
        }
        const data = JSON.parse((await readBoundedBody(request, 131072, 5000)).toString());
        if (!data || Array.isArray(data) || typeof data !== 'object')
            throw new Error('Invalid input.');
        if(path==='/console/api/restore/cancel'&&!store.state.initialized){reply(200,consoleRestore(store).cancel(undefined,data));return;}
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
        if(path?.startsWith('/console/api/link/')||path==='/console/api/reset/request'||path==='/console/api/factor/recover')consolePeople(store).attempt(source,data.target??data.email,path!);
        if(path==='/console/api/restore/status'){reply(200,consoleRestore(store).status(data));return;}
        if(path==='/console/api/restore/enroll-begin'){const r=consoleRestore(store).beginEnrollment(data),qr=await QRCode.toDataURL('otpauth://totp/SecretSauce?secret='+r.seed+'&issuer=SecretSauce');consoleRestore(store).confirmEnrollmentAuthority(data.continuation);reply(200,{...r,qr});return;}
        if(path==='/console/api/restore/enroll-complete'){reply(200,consoleRestore(store).completeEnrollment(data));return;}
        if(path==='/console/api/restore/start'&&!store.state.initialized){reply(200,await consoleRestore(store).start(undefined,data));return;}
        if(path === '/console/api/factor/recover'){reply(200,consolePeople(store).replaceFactor(undefined,data));return;}
        if(path === '/console/api/reset/request'){reply(200,await consolePeople(store).requestPassword(data));return;}
        if(path === '/console/api/link/password'){reply(200,consolePeople(store).resetPassword(data));return;}
        if(path === '/console/api/link/preview'){reply(200,consolePeople(store).preview(data));return;}
        if(path === '/console/api/link/begin'){const r=consolePeople(store).begin(data);const qr=await QRCode.toDataURL('otpauth://totp/SecretSauce?secret='+r.seed+'&issuer=SecretSauce');consolePeople(store).confirmEnrollmentAuthority({purpose:data.purpose,target:data.target,proof:data.proof});reply(200,{...r,qr});return;}
        if(path === '/console/api/link/complete'){reply(200,consolePeople(store).complete(data));return;}
        if (path === '/console/api/login') {
            const result = store.login(data.email, data.password, data.code, Date.now(), data.kind??'totp');
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
        if(path==='/console/api/restore/start'){reply(200,await consoleRestore(store).start(session,data));return;}
        if(path==='/console/api/restore/cancel'){reply(200,consoleRestore(store).cancel(session,data));return;}
        if(path==='/console/api/backups/acknowledge'){reply(200,consoleBackups(store).acknowledgeUnknown(session,data));return;}
        if(path==='/console/api/backups/save'){reply(200,consoleBackups(store).save(session,data));return;}
        if(path==='/console/api/backups/review'){reply(200,consoleBackups(store).review(session,data));return;}
        if(path==='/console/api/backups/apply'){reply(200,consoleBackups(store).apply(session,data));return;}
        if(path==='/console/api/backups/material-generate'){reply(200,consoleBackups(store).generateMaterial(session,data));return;}
        if(path==='/console/api/backups/material-replace'){reply(200,consoleBackups(store).replaceMaterial(session,data));return;}
        if(path==='/console/api/backups/start'){reply(200,await consoleBackups(store).start(session,data));return;}
        if(path==='/console/api/backups/material'){reply(200,consoleBackups(store).initializeMaterial(session,data));return;}
        if(path==='/console/api/backups/download'){const r=consoleBackups(store).download(session,data);response.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+r.filename+'"','content-length':r.size});response.end(r.archive);return;}
        if(path==='/console/api/limits/save'){reply(200,consoleOperations(store).save(session,data));return;}
        if(path==='/console/api/limits/review'){reply(200,consoleOperations(store).review(session,data));return;}
        if(path==='/console/api/limits/apply'){reply(200,consoleOperations(store).apply(session,data));return;}
        if(path==='/console/api/activity/detail'){reply(200,consoleEvidence(store).detail(session,data));return;}
        if(path==='/console/api/evidence/export'){reply(200,consoleEvidence(store).export(session,data));return;}
        if(path==='/console/api/retention/save'){reply(200,consoleEvidence(store).saveRetention(session,data));return;}
        if(path==='/console/api/retention/review'){reply(200,consoleEvidence(store).reviewRetention(session,data));return;}
        if(path==='/console/api/retention/apply'){reply(200,consoleEvidence(store).applyRetention(session,data));return;}
        if(path==='/console/api/settings/discard'){reply(200,discardSettings(store,session,data));return;}
        if(path==='/console/api/settings/review'){reply(200,reviewSettings(store,session,data));return;}
        if(path==='/console/api/settings/apply'){reply(200,applySettings(store,session,data));return;}
        if(path?.startsWith('/console/api/authentication/')){const a=consoleAuthentication(store);if(path==='/console/api/authentication/save'){reply(200,a.save(session,data));return;}if(path==='/console/api/authentication/import-proposal'){reply(200,a.importProposal(session,data));return;}if(path==='/console/api/authentication/review'){reply(200,a.review(session,data));return;}if(path==='/console/api/authentication/apply'){reply(200,a.apply(session,data));return;}}
        if(path==='/console/api/client/revoke'){reply(200,revokeClient(store,session,data));return;}
        if(path==='/console/api/configuration/history-draft'){reply(200,useConfigurationRevision(consoleServices(store),session,data));return;}
        if(path==='/console/api/configuration/import'){reply(200,importConfiguration(consoleServices(store),session,data));return;}
        if(path==='/console/api/configuration/export'){if(Object.keys(data).length)throw new ServiceManagementError('export: No input fields supported.');reply(200,exportConfiguration(consoleServices(store),session));return;}
        if(path?.startsWith('/console/api/protection/')){const p=consoleProtection(consoleServices(store));if(path==='/console/api/protection/save'){reply(200,p.save(session,data));return;}if(path==='/console/api/protection/review'){reply(200,p.review(session,data));return;}if(path==='/console/api/protection/apply'){reply(200,p.apply(session,data));return;}}
        if(path==='/console/api/notifications/save'){reply(200,consoleNotifications(store).save(session,data));return;}
        if(path==='/console/api/notifications/delete'){reply(200,consoleNotifications(store).deleteCredential(session,data));return;}
        if(path==='/console/api/notifications/review'){if(Object.keys(data).length)throw new NotificationError('Invalid SMTP input.');reply(200,consoleNotifications(store).review(session));return;}
        if(path==='/console/api/notifications/apply'){reply(200,consoleNotifications(store).apply(session,data));return;}
        if(path==='/console/api/notifications/test'){reply(200,await consoleNotifications(store).test(session,data));return;}
        if(path==='/console/api/people/external-change'){reply(200,consolePeople(store).externalChange(session,data));return;}
        if(path==='/console/api/people/recovery-cancel'){reply(200,consolePeople(store).cancelReset(session,data));return;}
        if(path==='/console/api/people/recovery'){consolePeople(store).attempt(source,data.id,'assisted-'+(data.purpose==='factor'?'factor':'password'));reply(200,consolePeople(store).assist(session,data));return;}
        if(path==='/console/api/factor/replace'){consolePeople(store).attempt(source,session.userId,'factor');reply(200,consolePeople(store).replaceFactor(session,data));return;}
        if(path==='/console/api/people/invite'){reply(200,consolePeople(store).invite(session,data));return;}
        if(path==='/console/api/people/invitation'){reply(200,consolePeople(store).invitation(session,data));return;}
        if(path==='/console/api/people/account'){reply(200,await consolePeople(store).updateAccount(session,data));return;}
        if(path==='/console/api/people/change'){reply(200,consolePeople(store).change(session,data));return;}
        if(path==='/console/api/people/revoke'){reply(200,consolePeople(store).revoke(session,data));return;}
        if(path==='/console/api/people/external'){reply(200,consolePeople(store).register(session,data));return;}
        if (path?.startsWith('/console/api/service/')) {
            const manager = consoleServices(store);
            if (path === '/console/api/service/preview') { reply(200, await previewPolicy(manager, session, data)); return; }
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
        if (error instanceof RestoreError) {reply(error.message==='Forbidden.'?403:400,{message:error.message});return;}
        if (error instanceof BackupError || error instanceof OperatingError) {reply(400,{message:error.message});return;}
        if (error instanceof EvidenceError) {reply(400,{message:error.message});return;}
        if (error instanceof AuthenticationSettingsError) {reply(400,{message:error.message});return;}
        if (error instanceof ClientManagementError) {reply(400,{message:error.message});return;}
        if (error instanceof SettingsError || error instanceof NotificationError) {reply(400,{message:error.message});return;}
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
