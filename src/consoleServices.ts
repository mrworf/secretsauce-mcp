import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { managedDraftSchema, normalizeManagedService, serviceDraft, type ManagedServiceDraft } from './config.js';
import { digest } from './consoleCrypto.js';
import { ConsoleStore, type ConsoleSession } from './consoleStore.js';
import type { GatewayConfig, ServiceConfig } from './types.js';

export type ServiceLifecycle = 'Draft' | 'Active' | 'Disabled' | 'Archived';
export interface ManagedCredential { value: string; version: number; changed: number }
export interface ManagedService {
  lifecycle: ServiceLifecycle;
  applied?: ManagedServiceDraft;
  draft?: { content: ManagedServiceDraft; base: number; generation: number; settings?: { name: string } };
  values: Record<string, ManagedCredential>;
  assignments: string[];
  review?: { id: string; actor: string; fingerprint: string; candidate: ManagedServiceDraft; base: number; draftGeneration: number; settings?: { name: string }; exceptions: string[] };
}
export interface ManagedConfiguration { revision: number; services: Record<string, ManagedService> }
const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/);
const saveSchema = z.object({ id: idSchema, base: z.number().int().nonnegative(), generation: z.number().int().nonnegative(), service: managedDraftSchema, settings: z.object({ name: z.string().trim().min(1).max(100) }).strict().optional() }).strict();
const reviewSchema = z.object({ id: idSchema }).strict();
const applySchema = z.object({ id: idSchema, review: z.string().uuid(), acknowledgments: z.array(z.string()).max(200) }).strict();
export class ServiceManagementError extends Error {
  constructor(message: string, readonly comparison?: unknown) { super(message); }
}
export class ConsoleServices {
  prepareFault?: () => void;
  invalidate: (service: string, subject?: string) => void = () => {};
  constructor(readonly store: ConsoleStore, readonly runtimeConfig: GatewayConfig = store.state.config!) {
    if (!runtimeConfig) throw new Error('Managed configuration missing');
    if (!store.state.managed) {
      store.state.managed = { revision: 0, services: Object.fromEntries(Object.values(runtimeConfig.services).map(s => [s.id, {
        lifecycle: 'Active', applied: serviceDraft(s), assignments: [...s.access.users],
        values: Object.fromEntries(s.credentials.map(c => [c.id, { value: c.secret, version: 1, changed: Date.now() }])),
      }])) };
    }
    this.publish();
  }
  get state(): ManagedConfiguration { return this.store.state.managed!; }
  actor(session: ConsoleSession, write = false) {
    const user = this.store.authorize(session, 'configuration');
    if (write) { this.store.requireSensitive(session); if (!['Owner', 'Administrator'].includes(user.role)) throw new Error('Forbidden.'); }
    return user;
  }
  fingerprint(id: string): string {
    const s = this.state.services[id];
    return digest(JSON.stringify({ revision: this.state.revision, lifecycle: s?.lifecycle, assignments: s?.assignments,
      values: Object.entries(s?.values ?? {}).map(([key, v]) => [key, v.version]),
      users: this.store.state.users.map(u => ({ id: u.id, role: u.role, active: u.active })) }));
  }
  list(session: ConsoleSession) {
    const user = this.actor(session);
    return { revision: this.state.revision, writable: ['Owner', 'Administrator'].includes(user.role) && !session.restricted && !this.store.journal.degraded && !this.store.externalAudit?.degraded,
      eligible: this.store.state.users.filter(u => u.active && u.role !== 'Auditor').map(u => ({ id: u.id, email: u.email, role: u.role })),
      services: Object.entries(this.state.services).map(([id, s]) => ({ id, name: s.applied?.name ?? s.draft?.content.name ?? id, lifecycle: s.lifecycle, appliedRevision: this.state.revision, hasDraft: Boolean(s.draft), exceptions: s.applied ? exceptions(s.applied) : [] })) };
  }
  detail(session: ConsoleSession, id: unknown) {
    this.actor(session); const key = this.parse(idSchema, id); const s = this.state.services[key];
    if (!s) throw new ServiceManagementError('Service unavailable. Reload Services.');
    return { id: key, revision: this.state.revision, lifecycle: s.lifecycle, applied: s.applied, draft: s.draft,
      assignments: s.assignments, credentials: Object.entries(s.values).map(([id, v]) => ({ id, available: true, version: v.version, changed: v.changed })),
      exceptions: s.applied ? exceptions(s.applied) : [], activity: this.store.journal.entries().filter(e => e.target === key).map(e => ({ action: e.action, time: e.time, result: e.result, revision: e.revision })) };
  }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const p = schema.safeParse(value); if (!p.success) throw new ServiceManagementError('Invalid service input. Check field types and supported settings.'); return p.data; }
  save(session: ConsoleSession, input: unknown) {
    const actor = this.actor(session, true); const data = this.parse(saveSchema, input);
    const current = this.state.services[data.id];
    if (data.base !== this.state.revision || data.generation !== (current?.draft?.generation ?? 0)) throw this.stale(session, data.id);
    // Field permissions are checked again at review/apply, even in mixed drafts.
    if (data.settings && actor.role !== 'Owner') throw new Error('Forbidden.');
    if (current?.lifecycle === 'Archived') throw new ServiceManagementError('Service archived. Unarchive to Disabled before editing.');
    const operation = this.store.commit(actor.id, 'service.draft_save', data.id, state => {
      const m = state.managed!; const s = m.services[data.id] ??= { lifecycle: 'Draft', values: {}, assignments: [] };
      s.draft = { content: data.service, base: data.base, generation: data.generation + 1, ...(data.settings ? { settings: data.settings } : {}) }; delete s.review;
    });
    return { operation, status: 'saved', generation: this.state.services[data.id]!.draft!.generation, revision: this.state.revision };
  }
  private stale(session: ConsoleSession, id: string): ServiceManagementError {
    return new ServiceManagementError('Stale review or dependencies. Compare current and proposed configuration, reload, save and review again.', this.state.services[id] ? this.detail(session, id) : { revision: this.state.revision });
  }
  private candidate(session: ConsoleSession, id: string) {
    const actor = this.actor(session, true); const s = this.state.services[id]; const draft = s?.draft;
    if (!s || !draft) throw new ServiceManagementError('Save a service draft before review.');
    if (s.lifecycle === 'Archived') throw new ServiceManagementError('Service archived. Unarchive to Disabled before review.');
    if (draft.settings && actor.role !== 'Owner') throw new Error('Forbidden.');
    if (draft.base !== this.state.revision) throw this.stale(session, id);
    const grants = draft.content.access?.users ?? [];
    // Existing services never replay draft assignment snapshots.
    if (s.applied && JSON.stringify(grants) !== JSON.stringify(s.assignments)) throw new ServiceManagementError('Access changed. Reload current assignments; use the immediate Access action.');
    if (!s.applied) for (const grant of grants) {
      if (!this.store.state.users.some(u => u.id === grant && u.active && u.role !== 'Auditor')) throw new ServiceManagementError('Access target no longer eligible. Select an active enrolled identity and review again.');
    }
    let normalized: ServiceConfig;
    try { normalized = normalizeManagedService(id, draft.content, Object.fromEntries(Object.entries(s.values).map(([key, v]) => [key, v.value]))); }
    catch { throw new ServiceManagementError('Service incomplete or invalid. Check destination, authentication value availability, placement and policy.'); }
    for (const d of normalized.destinations) {
      const url = new URL(d.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search || d.schemes.some(v => !['http', 'https'].includes(v))) throw new ServiceManagementError('Invalid destination. Use HTTP or HTTPS without userinfo, query or fragment.');
    }
    this.prepareFault?.();
    return { actor, service: normalized, draft, s };
  }
  review(session: ConsoleSession, input: unknown) {
    const { id } = this.parse(reviewSchema, input); const c = this.candidate(session, id);
    const risks = exceptions(c.draft.content); const review = { id: randomUUID(), actor: c.actor.id, fingerprint: this.fingerprint(id), candidate: c.draft.content, base: this.state.revision, draftGeneration: c.draft.generation, exceptions: risks, ...(c.draft.settings ? { settings: c.draft.settings } : {}) };
    const operation = this.store.commit(c.actor.id, 'service.review', id, state => { state.managed!.services[id]!.review = review; });
    return { operation, review: review.id, scope: { services: [id], settings: c.draft.settings ? ['instance.name'] : [] }, base: review.base,
      current: c.s.applied ?? null, proposed: review.candidate, settings: review.settings, grants: c.s.applied ? [] : c.draft.content.access?.users ?? [], exceptions: risks,
      disruption: 'Affected service references are invalidated. Already-dispatched work may complete with admitted protection. Trusted administrators control destinations; response scanning is best-effort.' };
  }
  apply(session: ConsoleSession, input: unknown) {
    const data = this.parse(applySchema, input); const c = this.candidate(session, data.id); const review = c.s.review;
    if (!review || review.id !== data.review || review.actor !== c.actor.id || review.fingerprint !== this.fingerprint(data.id) || review.draftGeneration !== c.draft.generation || review.base !== this.state.revision) throw this.stale(session, data.id);
    if (review.exceptions.some(r => !data.acknowledgments.includes(r)) || data.acknowledgments.some(r => !review.exceptions.includes(r))) throw new ServiceManagementError('Acknowledge each listed security exception before apply.');
    let operation: string;
    try { operation = this.store.commit(c.actor.id, 'service.apply', data.id, state => {
      const m = state.managed!, s = m.services[data.id]!;
      s.applied = structuredClone(review.candidate); s.assignments = [...(c.s.applied ? c.s.assignments : review.candidate.access?.users ?? [])];
      s.applied.access = { users: s.assignments }; s.lifecycle = 'Active'; delete s.draft; delete s.review;
      state.config!.services = { ...state.config!.services, [data.id]: c.service }; m.revision++;
      if (review.settings) state.name = review.settings.name;
    }); } finally { if (this.state.services[data.id]?.draft === undefined) { this.invalidate(data.id); this.publish(); } }
    return { operation, status: 'applied', revision: this.state.revision };
  }
  publish(): void {
    // One synchronous pointer swap; the existing broker/limiter/scanner resources survive.
    this.runtimeConfig.services = this.store.state.config!.services;
  }
}
export function exceptions(draft: ManagedServiceDraft): string[] {
  const result = new Set<string>();
  if (draft.policy?.mode === 'allow') result.add('Default allow: unmatched requests are allowed');
  if (draft.tls?.verify === false) result.add('Service TLS verification disabled');
  for (const d of draft.destinations ?? []) {
    if (d.base_url?.startsWith('http:') || d.schemes?.includes('http')) result.add('Cleartext HTTP: ' + (d.id ?? d.name ?? 'destination'));
    if ((d.tls?.verify ?? draft.tls?.verify) === false) result.add('TLS verification disabled: ' + (d.id ?? d.name ?? 'destination'));
    if (d.hosts?.some(h => 'suffix' in h || 'regex' in h)) result.add('Broad destination matching: ' + (d.id ?? d.name ?? 'destination'));
  }
  for (const r of draft.policy?.rules ?? []) if (r.secretlint || r.binary_response?.scan === false) result.add('Reduced response scanning: ' + r.id);
  return [...result];
}
const managers = new WeakMap<ConsoleStore, ConsoleServices>();
export function consoleServices(store: ConsoleStore): ConsoleServices { let m = managers.get(store); if (!m) { m = new ConsoleServices(store); managers.set(store, m); } return m; }
export function bindConsoleServices(store: ConsoleStore, config: GatewayConfig): ConsoleServices { const m = new ConsoleServices(store, config); managers.set(store, m); return m; }
