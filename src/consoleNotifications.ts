import { connect, type TLSSocket, type ConnectionOptions } from 'node:tls';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ConsoleStore, type ConsoleSession } from './consoleStore.js';
export interface SmtpSettings {
    enabled?: boolean;
    host: string;
    port: number;
    sender: string;
    username: string;
    password: string;
}
export interface NotificationState {
    revision: number;
    credentialVersion?: number;
    applied?: SmtpSettings;
    draft?: {
        settings: SmtpSettings;
        base: number;
        generation: number;
        actor: string;
        credentialVersion?: number;
    };
    review?: {
        id: string;
        actor: string;
        generation: number;
        base: number;
    };
    deliveries: {
        kind: string;
        time: number;
        revision?: number;
        credentialVersion?: number;
        status: 'queued' | 'delivered' | 'failed' | 'manual' | 'capacity';
    }[];
}
const address = z.string().max(254).regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,188}[A-Za-z0-9])?$/);
const settings = z.object({ enabled: z.boolean().default(true), host: z.string().min(1).max(253).regex(/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/), port: z.number().int().min(1).max(65535), sender: address, username: z.string().max(254).regex(/^[^\r\n\0]*$/), password: z.string().max(16384).regex(/^[^\r\n\0]*$/) }).strict();
export class NotificationError extends Error {
}
// Implicit TLS is mandatory. SMTP text/errors are bounded and never exposed to callers.
export async function sendSmtp(config: SmtpSettings, recipient: string, body: string, options: Pick<ConnectionOptions, 'ca'> = {}) {
    if (!settings.safeParse(config).success || !address.safeParse(recipient).success || body.length > 16384 || /[\r\n]/.test(recipient))
        throw new NotificationError('Delivery failed. Check SMTP settings and established contact.');
    const socket: TLSSocket = connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true, ...options });
    socket.setTimeout(5000, () => socket.destroy(new Error('SMTP deadline')));
    const deadline = setTimeout(() => socket.destroy(new Error('SMTP deadline')), 5000);
    let buffer = '', total = 0;
    const replies: string[] = [];
    let waiting: ((value: string) => void) | undefined, failed: ((err: Error) => void) | undefined, broken = false;
    socket.on('data', data => { total += data.length; if (total > 16384) {
        socket.destroy(new Error('SMTP capacity'));
        return;
    } buffer += data.toString('utf8'); let newline; while ((newline = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (!/^\d{3}[- ]/.test(line)) {
            socket.destroy(new Error('SMTP syntax'));
            return;
        }
        if (line[3] === ' ') {
            if (waiting) {
                const fn = waiting;
                waiting = undefined;
                failed = undefined;
                fn(line.slice(0, 3));
            }
            else
                replies.push(line.slice(0, 3));
        }
    } });
    socket.on('error', () => { broken = true; failed?.(new NotificationError('Delivery failed. Check SMTP connectivity and credentials.')); });
    socket.on('close', () => { broken = true; failed?.(new NotificationError('Delivery failed. Check SMTP connectivity and credentials.')); });
    const read = () => new Promise<string>((resolve, reject) => { if (replies.length) {
        resolve(replies.shift()!);
        return;
    } if (broken) {
        reject(new NotificationError('Delivery failed.'));
        return;
    } waiting = resolve; failed = reject; });
    const command = async (text: string, expected: string) => { socket.write(text + '\r\n'); if (await read() !== expected)
        throw new NotificationError('Delivery failed. Check SMTP settings and established contact.'); };
    try {
        if (await read() !== '220')
            throw new NotificationError('Delivery failed.');
        await command('EHLO console.example.org', '250');
        if (config.username || config.password)
            await command('AUTH PLAIN ' + Buffer.from('\0' + config.username + '\0' + config.password).toString('base64'), '235');
        await command('MAIL FROM:<' + config.sender + '>', '250');
        await command('RCPT TO:<' + recipient + '>', '250');
        await command('DATA', '354');
        const safe = body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
        await command('From: ' + config.sender + '\r\nTo: ' + recipient + '\r\nSubject: SecretSauce account notification\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + safe + '\r\n.', '250');
        socket.write('QUIT\r\n');
    }
    finally {
        clearTimeout(deadline);
        socket.destroy();
    }
}
export class ConsoleNotifications {
    transport: (settings: SmtpSettings, recipient: string, body: string) => Promise<void> = sendSmtp;
    private occupied = 0;
    constructor(readonly store: ConsoleStore) { }
    get state(): NotificationState { return this.store.state.notifications ?? { revision: 0, deliveries: [] }; }
    private init(s: typeof this.store.state) { return s.notifications ??= { revision: 0, deliveries: [] }; }
    private owner(session: ConsoleSession, action?: string) { const actor = this.store.authorize(session, 'identity'); this.store.requireSensitive(session); if (action)
        this.store.requireRecent(session, action); return actor; }
    private parse<T>(schema: z.ZodType<T>, input: unknown): T { const r = schema.safeParse(input); if (!r.success)
        throw new NotificationError('Invalid SMTP input. Use a hostname, TLS port and valid sender/contact address.'); return r.data; }
    private safe(c: SmtpSettings | undefined) { return c ? { enabled: c.enabled !== false, host: c.host, port: c.port, sender: c.sender, username: c.username, credentialAvailable: Boolean(c.password), credentialVersion: this.state.credentialVersion ?? 0 } : undefined; }
    read(session: ConsoleSession) { this.store.authorize(session, 'instance'); return { revision: this.state.revision, credentialVersion: this.state.credentialVersion ?? 0, applied: this.safe(this.state.applied), draft: this.state.draft ? { settings: this.safe(this.state.draft.settings), base: this.state.draft.base, generation: this.state.draft.generation } : undefined, deliveries: this.state.deliveries }; }
    save(session: ConsoleSession, input: unknown) { const actor = this.owner(session); const data = this.parse(z.object({ base: z.number().int().nonnegative(), generation: z.number().int().nonnegative(), settings: settings, credentialVersion: z.number().int().nonnegative() }).strict(), input); if (data.credentialVersion !== (this.state.credentialVersion ?? 0) || data.base !== this.state.revision || data.generation !== (this.state.draft?.generation ?? 0))
        throw new NotificationError('Stale SMTP draft. Reload settings and review again.'); const c = { ...data.settings, password: data.settings.password || (this.state.draft?.credentialVersion === data.credentialVersion ? this.state.draft.settings.password : '') || this.state.applied?.password || '' }; return { operation: this.store.commit(actor.id, 'notification.draft_save', 'smtp', s => { const state = this.init(s); state.draft = { settings: c, base: data.base, generation: data.generation + 1, actor: actor.id, credentialVersion: data.credentialVersion }; delete state.review; }), status: 'Draft saved; applied delivery is unchanged.' }; }
    review(session: ConsoleSession) { const actor = this.owner(session); const d = this.state.draft; if (!d || d.base !== this.state.revision || d.credentialVersion !== (this.state.credentialVersion ?? 0))
        throw new NotificationError('Save a current SMTP draft first.'); const review = { id: randomUUID(), actor: actor.id, base: this.state.revision, generation: d.generation }; return { operation: this.store.commit(actor.id, 'notification.review', 'smtp', s => { this.init(s).review = review; }), review: review.id, scope: ['smtp'], current: this.safe(this.state.applied), proposed: this.safe(d.settings) }; }
    apply(session: ConsoleSession, input: unknown) { const actor = this.owner(session, 'notifications.apply'); const d = this.parse(z.object({ review: z.string().uuid(), confirmed: z.literal(true) }).strict(), input), r = this.state.review, draft = this.state.draft; if (!r || !draft || draft.credentialVersion !== (this.state.credentialVersion ?? 0) || r.id !== d.review || r.actor !== actor.id || r.base !== this.state.revision || draft.base !== r.base || draft.generation !== r.generation)
        throw new NotificationError('Stale SMTP review. Reload and review again.'); return { operation: this.store.commit(actor.id, 'notification.apply', 'smtp', s => { const state = this.init(s); if (draft.settings.password !== (state.applied?.password ?? ''))
            state.credentialVersion = (state.credentialVersion ?? 0) + 1; state.applied = draft.settings; state.revision++; delete state.draft; delete state.review; }), status: 'Applied SMTP settings. Delivery is separate from enrollment.' }; }
    deleteCredential(session: ConsoleSession, input: unknown) {
        const actor = this.owner(session, 'notifications.delete');
        const d = this.parse(z.object({ revision: z.number().int().nonnegative(), credentialVersion: z.number().int().nonnegative(), confirmed: z.literal(true) }).strict(), input);
        if (d.revision !== this.state.revision || d.credentialVersion !== (this.state.credentialVersion ?? 0))
            throw new NotificationError('Stale SMTP credential confirmation. Reload Email settings and confirm the current version.');
        if (!this.state.applied?.password && !this.state.draft?.settings.password)
            return { status: 'SMTP credential already absent.' };
        if (this.state.applied?.password && this.state.applied.enabled !== false)
            throw new NotificationError('Enabled SMTP depends on this credential. Disable email delivery in Settings, save, review and apply, then delete the credential separately.');
        return { operation: this.store.commit(actor.id, 'notification.credential_delete', 'smtp', s => {
            const state = this.init(s);
            if (state.applied) state.applied.password = '';
            if (state.draft) state.draft.settings.password = '';
            state.credentialVersion = (state.credentialVersion ?? 0) + 1;
            state.revision++;
            delete state.review;
        }), status: 'SMTP credential deleted. Non-secret settings retained; reload and review any draft edits.' };
    }
    async test(session: ConsoleSession, input: unknown) { this.owner(session, 'notifications.test'); const d = this.parse(z.object({ recipient: address, confirmed: z.literal(true) }).strict(), input); const result = await this.send('test', d.recipient, 'Synthetic or authorized SMTP test. This message does not enroll or authenticate anyone.'); this.owner(session); return result; }
    async send(kind: string, recipient: string, body: string) { if (!['test', 'invitation', 'password', 'security', 'backup', 'audit'].includes(kind) || !address.safeParse(recipient).success || body.length > 16384)
        throw new NotificationError('Invalid notification input.'); const config = this.state.applied; if (!config || config.enabled === false)
        return { status: 'manual' }; if (this.occupied >= 4)
        return { status: 'capacity' }; const revision = this.state.revision, credentialVersion = this.state.credentialVersion ?? 0; this.occupied++; let status: 'delivered' | 'failed' | 'manual' = 'failed'; try {
        this.store.commit('system', 'notification.admit', 'smtp', s => { const state = this.init(s); state.deliveries = state.deliveries.slice(-19); state.deliveries.push({ kind, time: Date.now(), status: 'queued', revision, credentialVersion }); });
        try {
            if (!this.store.storageReliable || this.state.revision !== revision || (this.state.credentialVersion ?? 0) !== credentialVersion || !this.state.applied || this.state.applied.enabled === false) status = 'manual';
            else {
                await this.transport(structuredClone(config), recipient, body);
                status = 'delivered';
            }
        }
        catch {
            status = 'failed';
        }
        this.store.commit('system', 'notification.complete', 'smtp', s => { const state = this.init(s); state.deliveries = state.deliveries.slice(-19); state.deliveries.push({ kind, time: Date.now(), status, revision, credentialVersion }); });
        return { status };
    }
    finally {
        this.occupied--;
    } }
}
const managers = new WeakMap<ConsoleStore, ConsoleNotifications>();
export function consoleNotifications(store: ConsoleStore) { let n = managers.get(store); if (!n) {
    n = new ConsoleNotifications(store);
    managers.set(store, n);
} return n; }

export { settings as smtpSettingsSchema };
