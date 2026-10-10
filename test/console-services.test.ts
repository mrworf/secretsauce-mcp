import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fixture, setup } from './consoleFixtures.js';
import { totp } from '../src/consoleCrypto.js';
import { ConsoleServices } from '../src/consoleServices.js';
import { validateConfig, serviceDraft, normalizeManagedService } from '../src/config.js';
import { TokenBroker } from '../src/tokens.js';
import { AuditSink } from '../src/audit.js';
import { ConsoleStore } from '../src/consoleStore.js';
const draft = () => ({ name: 'Example service', no_auth: true, destinations: [{ id: 'primary', base_url: 'https://api.example.org', hosts: [{ exact: 'api.example.org' }] }], credentials: [], access: { users: [] }, policy: { mode: 'allow' as const, rules: [] } });
import { managedFixture } from './consoleManagementFixtures.js';

function save(f: ReturnType<typeof managedFixture>, service: unknown = draft(), settings?: unknown) { return f.manager.save(f.session, { id: 'new', base: f.manager.state.revision, generation: f.manager.state.services.new?.draft?.generation ?? 0, service, ...(settings ? { settings } : {}) }); }
function apply(f: ReturnType<typeof managedFixture>) { const r = f.manager.review(f.session, { id: 'new' }); return f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions }); }
describe('managed service drafts and scoped publication', () => {
 it('saves incomplete non-executing work, reviews exact sanitized scope and activates no-auth without restart', () => {
  const f = managedFixture(); try {
   save(f, { name: 'Incomplete' }); expect(f.cfg.services.new).toBeUndefined(); expect(() => f.manager.review(f.session, { id: 'new' })).toThrow('incomplete');
   const d = draft(); d.access.users.push(f.store.state.users[0]!.id as never); save(f, d);
   const r = f.manager.review(f.session, { id: 'new' }); expect(r.scope).toEqual({ services: ['new'], settings: [] }); expect(r.base).toBe(0); expect(r.grants).toEqual(d.access.users);
   expect(() => f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: [] })).toThrow('Acknowledge');
   const result = f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions }); expect(result.revision).toBe(1); expect(f.cfg.services.new?.access.users).toEqual(d.access.users); const sink = new AuditSink(f.cfg); try { expect(new TokenBroker(f.cfg, undefined, sink).issueTokens({subject: d.access.users[0]!,mode:'bearer',scopes:[]}, {service:'new',access_ids:['gateway_access'],reason:'Activation verification'}).tokens).toHaveLength(1); } finally { sink.close(); } expect(f.manager.detail(f.session, 'new').draft).toBeUndefined();
   const bytes = readFileSync(f.store.file, 'utf8'); expect(bytes).not.toContain('Example service');
  } finally { f.close(); }
 });
 it('strict external inputs reject unknown/source/value fields, bad base/generation/IDs and malformed complete configurations', () => {
  const f = managedFixture(); try {
   for (const service of [{ ...draft(), unknown: true }, { ...draft(), credentials: [{ id: 'a', usage: { kind: 'header' }, secret: 'synthetic' }] }, { ...draft(), destinations: [{ base_url: 'https://api.example.org', bad: true }] }]) expect(() => save(f, service)).toThrow('Invalid');
   for (const patch of [{ id: '../bad' }, { base: -1 }, { generation: -1 }, { extra: true }]) expect(() => f.manager.save(f.session, { id: 'new', base: 0, generation: 0, service: draft(), ...patch })).toThrow();
   for (const destinations of [[{ id: 'one', base_url: 'ftp://api.example.org' }], [{ id: 'one', base_url: 'https://user:pass@api.example.org' }], [{ id: 'one', base_url: 'https://api.example.org', hosts: [{ regex: '[' }] }], [{ id: 'one', base_url: 'https://api.example.org', ports: [0] }]]) { try { save(f, { ...draft(), destinations }); expect(() => apply(f)).toThrow(); } catch(e) { expect(e).toBeInstanceOf(Error); } }
  } finally { f.close(); }
 });
 it('rejects stale base/review, demotion and mixed Owner settings without partial mutation', () => {
  const f = managedFixture(); try {
   save(f, draft(), { name: 'Changed instance' }); const r = f.manager.review(f.session, { id: 'new' });
   f.store.state.users[0]!.role = 'Administrator'; expect(() => f.manager.apply(f.session, { id: 'new', review: r.review, acknowledgments: r.exceptions })).toThrow('Forbidden'); expect(f.store.state.name).not.toBe('Changed instance'); expect(f.cfg.services.new).toBeUndefined();
   expect(() => save(f, draft(), { name: 'Smuggled' })).toThrow('Forbidden'); f.store.state.users[0]!.role = 'Owner';
   save(f); const prior = f.manager.review(f.session, { id: 'new' }); save(f, { ...draft(), name: 'Later' }); expect(() => f.manager.apply(f.session, { id: 'new', review: prior.review, acknowledgments: prior.exceptions })).toThrow('Stale');
   apply(f); expect(() => f.manager.save(f.session, { id: 'new', base: 0, generation: 0, service: draft() })).toThrow('Stale');
   f.store.state.users[0]!.role = 'Member'; expect(f.manager.list(f.session)).toMatchObject({ writable: false, eligible: [] });
  } finally { f.close(); }
 });
 it('preparation failure retains prior configuration; lost successful response reconciles status and state', () => {
  const f = managedFixture(); try {
   save(f); f.manager.prepareFault = () => { throw Error('Interrupted candidate preparation'); }; expect(() => apply(f)).toThrow('Interrupted'); expect(f.cfg.services.new).toBeUndefined(); expect(f.manager.state.revision).toBe(0);
   f.manager.prepareFault = undefined; const r = apply(f); expect(f.store.journal.status(r.operation)).toBe('success'); expect(f.store.journal.actorFor(r.operation)).toBe(f.session.userId); expect(f.manager.detail(f.session, 'new').lifecycle).toBe('Active'); expect(() => f.manager.apply(f.session, { id: 'new', review: '00000000-0000-4000-8000-000000000000', acknowledgments: [] })).toThrow('Save');
  } finally { f.close(); }
 });
 it('roundtrips multiple destinations, TLS inheritance/override, all matching and placement forms and advanced policy on encrypted restart', () => {
  const f = managedFixture(); try {
   const raw = { ...draft(), no_auth: false, tls: { verify: false }, destinations: [
    { id: 'exact', base_url: 'https://api.example.org:8443/base', schemes: ['https'], ports: [8443], hosts: [{ exact: 'api.example.org' }] },
    { id: 'suffix', base_url: 'http://private.example.org', schemes: ['http'], ports: [80], hosts: [{ suffix: '.example.org' }], tls: { verify: true } },
    { id: 'regex', base_url: 'https://other.example.org', hosts: [{ regex: '^other\\.example\\.org$' }], tls: { verify: false } },
   ], credentials: ['header','query','body','custom'].map((kind,i) => ({ id: 'credential'+i, usage: { kind, name: 'X-Api-Key', prefix: 'Bearer ', suffix: ';end', enforce: kind === 'header' } })), policy: { mode: 'deny' as const, rules: [{ id: 'rule', effect: 'allow' as const, priority: 7, methods: ['GET'], hosts: ['^api\\.'], paths: ['^/base'], reason: 'Example', secretlint: { enabled: false as const }, binary_response: { scan: false, max_size: 'unlimited' } }] } };
   const values = Object.fromEntries(raw.credentials.map(c => [c.id, 'synthetic-value-'+c.id]));
   const normalized = normalizeManagedService('variants', raw, values); const projected = serviceDraft(normalized); expect(projected.destinations?.[0]?.tls).toBeUndefined(); expect(projected.destinations?.[1]?.tls?.verify).toBe(true); expect(projected.policy).toEqual(raw.policy); expect(projected.credentials).toEqual(raw.credentials);
   f.store.commit('host','fixture.variants','variants', s => { s.config!.services.variants = normalized; }); f.store.close();
   const restart = new ConsoleStore(f.directory, f.keyFile); expect(restart.state.config!.services.variants!.destinations[2]!.hosts[0]).toMatchObject({ type: 'regex', regex: /^other\.example\.org$/ }); restart.close();
   expect(JSON.stringify(projected)).not.toContain('synthetic-value');
   expect(() => normalizeManagedService('bad', { ...raw, credentials: [{ id: 'a', usage: { kind: 'query', enforce: true } }] }, { a: 'x' })).toThrow();
  } finally { f.close(); }
 });
});
