import { projectCredentialService, credentialIdentity } from './consoleCredentialState.js';
import { captureConfigurationRevision } from './consoleHistory.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { managedDraftSchema, normalizeManagedService, serviceDraft, type ManagedServiceDraft } from './config.js';
import { sanitizeAuditText } from './auditSanitizer.js';
import { digest } from './consoleCrypto.js';
import { ConsoleStore, type ConsoleSession } from './consoleStore.js';
import type { GatewayConfig, ServiceConfig } from './types.js';

export type ServiceLifecycle = 'Draft' | 'Active' | 'Disabled' | 'Archived';
export interface ManagedCredential { value: string; version: number; changed: number; missing?: true; generation?: number; actor?: string; mutation?: string; historical?: boolean; changeAction?: 'set' | 'replace' | 'clear'; reconciledMutation?: string; previousChange?: { changeAction?: 'set' | 'replace' | 'clear'; actor?: string; changed: number; historical?: boolean } }
export interface ImportedIdentity { subject: string; index?: number; target?: { localId: string } | { issuer: string; externalSubject: string } }
export interface ManagedService {
  recoveryReviewRequired?:boolean;
  lifecycle: ServiceLifecycle;
  applied?: ManagedServiceDraft;
  draft?: { content: ManagedServiceDraft; base: number; generation: number; missingMappings?: string[]; importedIdentities?: ImportedIdentity[]; settings?: { name: string } };
  values: Record<string, ManagedCredential>;
  assignments: string[];
  review?: { id: string; actor: string; fingerprint: string; candidate: ManagedServiceDraft; base: number; draftGeneration: number; settings?: { name: string }; exceptions: string[] };
}
export interface ManagedConfiguration { history?: import("./consoleHistory.js").ConfigurationRevision[]; migrationGlobals?: Record<string,unknown>; protection?: import("./consoleProtection.js").ProtectionState; revision: number; services: Record<string, ManagedService> }
function own<T>(values: Record<string, T>, key: string): T | undefined { return Object.hasOwn(values, key) ? values[key] : undefined; }
const idSchema = z.string().min(1).max(1024).regex(/^[^\u0000-\u001f\u007f]+$/);
const newIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/);
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
    if (!store.state.config || store.state.config === runtimeConfig) { const { managedAdmission: _admission, ...persisted } = runtimeConfig; store.state.config = structuredClone(persisted); }
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
    const s = own(this.state.services, id);
    return digest(JSON.stringify({ revision: this.state.revision, lifecycle: s?.lifecycle, draftGeneration: s?.draft?.generation, assignments: s?.assignments,
      values: Object.entries(s?.values ?? {}).map(([key, v]) => [key, v.version]),
      users: this.store.state.users.map(u => ({ id: u.id, role: u.role, active: u.active, enrolled:u.enrolled, authorizationGeneration:u.authorizationGeneration??0 })), external:this.store.state.people?.external.map(e=>({id:e.id,issuer:e.issuer,subject:e.subject,active:e.active,authorizationGeneration:e.authorizationGeneration??0})) }));
  }
  readiness(id: string) {
    const s = own(this.state.services, id)!;
    const missing = (c?: ManagedServiceDraft) => (c?.credentials ?? []).some(v => !own(s.values, v.id)?.value);
    let activationBlocker: string | null = null;
    const candidate = s.draft?.content ?? s.applied;
    if (this.mappingIssues(id).length) activationBlocker = 'Resolve identity mapping first';
    else if (!candidate) activationBlocker = 'Complete configuration first';
    else if (missing(candidate)) activationBlocker = 'Set credential values first';
    else try { normalizeManagedService(id, candidate, Object.fromEntries(Object.entries(s.values).map(([key,v]) => [key,v.value]))); }
    catch { activationBlocker = 'Complete configuration first'; }
    return { readiness: s.applied && missing(s.applied) ? 'Value missing' : !s.applied ? 'Not configured' : 'Configured', activationBlocker };
  }
  list(session: ConsoleSession) {
    const user = this.store.authorize(session, 'own');
    if (user.role === 'Member') return { revision: this.state.revision, writable: false, eligible: [], services: Object.entries(this.state.services).filter(([,s]) => s.lifecycle === 'Active' && s.assignments.includes(user.id)).map(([id,s]) => ({ id, name: s.applied?.name ?? id, description: s.applied?.description ?? '', lifecycle: s.lifecycle, assignmentCount: 1, appliedRevision: this.state.revision, hasDraft: false, readiness: this.readiness(id).readiness, exceptions: [] })) };
    return { revision: this.state.revision, writable: ['Owner', 'Administrator'].includes(user.role) && !session.restricted && !this.store.journal.degraded && !this.store.externalAudit?.degraded,
      eligible: this.store.state.users.filter(u => u.active && u.enrolled !== false && u.role !== 'Auditor').map(u => ({ id: u.id, email: u.email, role: u.role })).concat((this.store.state.people?.external??[]).filter(e=>e.active).map(e=>({id:e.id,email:e.label,role:'External' as typeof user.role,issuer:e.issuer,externalSubject:e.subject}))).concat(this.runtimeConfig.auth.mode==='bearer'?[{id:'bearer-dev',email:'Shared legacy bearer (no console access)',role:'External' as typeof user.role}]:[]),
      services: Object.entries(this.state.services).map(([id, s]) => ({ id, name: s.applied?.name ?? s.draft?.content.name ?? id, description: s.applied?.description ?? s.draft?.content.description ?? '', assignmentCount: s.assignments.length, lifecycle: s.lifecycle, appliedRevision: this.state.revision, hasDraft: Boolean(s.draft), ...this.readiness(id), fingerprint: this.fingerprint(id), exceptions: s.applied ? exceptions(s.applied) : [] })) };
  }
  detail(session: ConsoleSession, id: unknown) {
    this.actor(session); const key = this.parse(idSchema, id); const s = own(this.state.services, key);
    if (!s) throw new ServiceManagementError('Service unavailable. Reload Services.');
    return { id: key, revision: this.state.revision, lifecycle: s.lifecycle, applied: s.applied, draft: s.draft,
      mappingFingerprint: this.fingerprint(key), mappingIssues: this.mappingIssues(key), assignments: s.assignments, credentials: Object.entries(s.values).map(([id, v]) => ({ id, available: !v.missing && Boolean(v.value), version: v.version, ...this.credentialAttribution(v), confirmation: this.credentialConfirmation(key,id), inUse: this.credentialInUse(s,id), appliedUse: Boolean(s.applied?.credentials?.some(c=>c.id===id)) })),
      exceptions: s.applied ? exceptions(s.applied) : [], activity: this.store.journal.entries().filter(e => e.target === key).map(e => ({ action: e.action, time: e.time, result: e.result, revision: e.revision, details: e.details })) };
  }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const p = schema.safeParse(value); if (!p.success) throw new ServiceManagementError('Invalid service input. Check field types and supported settings.'); return p.data; }
  save(session: ConsoleSession, input: unknown) {
    const actor = this.actor(session, true); const data = this.parse(saveSchema, input);
    validateDraftBounds(data.service);
    const current = own(this.state.services, data.id);
    if (!current && !newIdSchema.safeParse(data.id).success) throw new ServiceManagementError('Invalid new service identifier. Use 1–80 letters, numbers, dots, underscores or hyphens, starting with a letter or number.');
    if (data.base !== this.state.revision || data.generation !== (current?.draft?.generation ?? 0)) throw this.stale(session, data.id);
    // Field permissions are checked again at review/apply, even in mixed drafts.
    if (data.settings && actor.role !== 'Owner') throw new Error('Forbidden.');
    if (current?.lifecycle === 'Archived') throw new ServiceManagementError('Service archived. Unarchive to Disabled before editing.');
    const operation = this.store.commit(actor.id, 'service.draft_save', data.id, state => {
      const m = state.managed!; let s = own(m.services, data.id); if (!s) { s = { lifecycle: 'Draft', values: {}, assignments: [] }; Object.defineProperty(m.services, data.id, { value: s, enumerable: true, configurable: true, writable: true }); }
      s.draft = { ...(s.draft?.missingMappings?.length?{missingMappings:s.draft.missingMappings}:{}), ...(s.draft?.importedIdentities?{importedIdentities:s.draft.importedIdentities}:{}), content: data.service, base: data.base, generation: data.generation + 1, ...(data.settings ? { settings: data.settings } : {}) }; delete s.review;
    });
    return { operation, status: 'saved', generation: own(this.state.services, data.id)!.draft!.generation, revision: this.state.revision };
  }
  mappingTarget(target: ImportedIdentity['target']): string | undefined {
    if (!target) return;
    if ('localId' in target) return this.store.state.users.find(u=>u.id===target.localId && u.active && u.enrolled!==false && u.role!=='Auditor')?.id;
    return this.store.state.people?.external.find(e=>e.active && e.issuer===target.issuer && e.subject===target.externalSubject)?.id;
  }
  mappingIssues(id: string) {
    const draft=own(this.state.services,id)?.draft;
    const records=draft?.importedIdentities??(draft?.missingMappings??[]).map(subject=>({subject} as ImportedIdentity));
    return records.filter(r=>(draft?.missingMappings??[]).includes(r.subject)||!this.mappingTarget(r.target)).map(r=>({
      subject:r.subject, source:'services['+JSON.stringify(id)+'].access.users'+(r.index===undefined?'':'['+r.index+']'),
      affectedServices:Object.entries(this.state.services).filter(([,s])=>(s.draft?.importedIdentities??s.draft?.missingMappings?.map(subject=>({subject}))??[]).some(v=>v.subject===r.subject)).map(([key,s])=>({id:key,name:s.draft?.content.name??s.applied?.name??key})),
    }));
  }
  resolveMappings(session: ConsoleSession, input: unknown) {
    const actor=this.actor(session,true);
    const importedSubject=z.string().min(1).max(1024);
    const target=z.union([z.object({localId:importedSubject}).strict(),z.object({issuer:z.string().url().max(2048),externalSubject:importedSubject}).strict()]);
    const data=this.parse(z.object({id:idSchema,base:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),fingerprint:z.string().length(64),mappings:z.array(z.object({subject:importedSubject,target}).strict()).min(1).max(512)}).strict(),input);
    const service=own(this.state.services,data.id),draft=service?.draft;
    if(!draft||service.lifecycle==='Archived')throw new ServiceManagementError('Mapping unavailable. Open a current imported service draft.');
    if(data.base!==this.state.revision||data.generation!==draft.generation||data.fingerprint!==this.fingerprint(data.id))throw this.stale(session,data.id);
    const issues=this.mappingIssues(data.id),seen=new Set<string>();
    for(const m of data.mappings){
      if(seen.has(m.subject)||!issues.some(i=>i.subject===m.subject))throw new ServiceManagementError('mappings: Choose each listed unresolved subject only once.');
      seen.add(m.subject);
      if(!this.mappingTarget(m.target))throw new ServiceManagementError('mappings: Select an enrolled eligible local account or registered exact issuer/subject. Refresh eligible accounts before retrying.');
    }
    const operation=this.store.commit(actor.id,'service.import_mapping',data.id,state=>{
      // Admission and commit are synchronous; still check live identity dependencies at the mutation boundary.
      this.actor(session,true);
      if(data.fingerprint!==this.fingerprint(data.id)||data.mappings.some(m=>!this.mappingTarget(m.target)))throw this.stale(session,data.id);
      const d=state.managed!.services[data.id]!.draft!;
      d.importedIdentities??=(d.missingMappings??[]).map(subject=>({subject}));
      for(const m of data.mappings){
        const records=d.importedIdentities.filter(r=>r.subject===m.subject);
        const previous=records.flatMap(r=>r.target?['localId' in r.target?r.target.localId:this.store.state.people?.external.find(e=>e.issuer===(r.target as {issuer:string}).issuer&&e.subject===(r.target as {externalSubject:string}).externalSubject)?.id].filter((v):v is string=>Boolean(v)):[]);
        for(const r of records)r.target=m.target;
        if(!service.applied&&d.content.access)for(const old of previous)if(!d.importedIdentities.some(r=>this.mappingTarget(r.target)===old))d.content.access.users=d.content.access.users.filter(id=>id!==old);
        if(!service.applied){d.content.access??={users:[]};const id=this.mappingTarget(m.target)!;if(!d.content.access.users.includes(id))d.content.access.users.push(id);}
      }
      d.missingMappings=(d.missingMappings??[]).filter(subject=>!seen.has(subject));d.generation++;d.base=this.state.revision;delete state.managed!.services[data.id]!.review;
    });
    return {operation,status:'mapping saved',remaining:this.mappingIssues(data.id).length,generation:this.state.services[data.id]!.draft!.generation,revision:this.state.revision};
  }
  private stale(session: ConsoleSession, id: string): ServiceManagementError {
    return new ServiceManagementError('Stale review or dependencies. Compare current and proposed configuration, reload, save and review again.', own(this.state.services, id) ? this.detail(session, id) : { revision: this.state.revision });
  }
  private candidate(session: ConsoleSession, id: string) {
    const actor = this.actor(session, true); const s = own(this.state.services, id); const draft = s?.draft;
    if (!s || !draft) throw new ServiceManagementError('Save a service draft before review.');
    if(this.mappingIssues(id).length)throw new ServiceManagementError('mappings: Import has unresolved identities. Open Resolve identity mappings to choose an eligible account for each listed subject.');
    if (s.lifecycle === 'Archived') throw new ServiceManagementError('Service archived. Unarchive to Disabled before review.');
    if (draft.settings && actor.role !== 'Owner') throw new Error('Forbidden.');
    if (draft.base !== this.state.revision) throw this.stale(session, id);
    const grants = draft.content.access?.users ?? [];
    // Existing services never replay draft assignment snapshots.
    if (s.applied && JSON.stringify(grants) !== JSON.stringify(s.assignments)) throw new ServiceManagementError('Access changed. Reload current assignments; use the immediate Access action.');
    if (!s.applied||s.recoveryReviewRequired) for (const grant of grants) {
      if (!this.store.state.users.some(u => u.id === grant && u.active && u.enrolled !== false && u.role !== 'Auditor') && !this.store.state.people?.external.some(e=>e.id===grant&&e.active) && !(grant==='bearer-dev'&&this.runtimeConfig.auth.mode==='bearer')) throw new ServiceManagementError('Access target no longer eligible. Select an active enrolled identity and review again.');
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
    if(c.s.recoveryReviewRequired&&c.actor.role!=='Owner')throw new ServiceManagementError('Only an Owner may review a recovered service before its first reactivation.');
    const risks = exceptions(c.draft.content);if(c.s.recoveryReviewRequired)risks.push('Recovered service: reviewed current credentials, policy and access'); const review = { id: randomUUID(), actor: c.actor.id, fingerprint: this.fingerprint(id), candidate: c.draft.content, base: this.state.revision, draftGeneration: c.draft.generation, exceptions: risks, ...(c.draft.settings ? { settings: c.draft.settings } : {}) };
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
      const m = state.managed!, s = m.services[data.id]!;delete s.recoveryReviewRequired;
      s.applied = structuredClone(review.candidate); s.assignments = [...(c.s.applied ? c.s.assignments : review.candidate.access?.users ?? [])];
      s.applied.access = { users: s.assignments }; s.lifecycle = 'Active'; delete s.draft; delete s.review;
      state.config!.services = { ...state.config!.services, [data.id]: c.service }; m.revision++;
      if (review.settings) state.name = review.settings.name;
      captureConfigurationRevision(state,c.actor.id,'Service configuration applied');
    }); } finally { if (own(this.state.services, data.id)?.draft === undefined) { this.invalidate(data.id); this.publish(); } }
    return { operation, status: 'applied', revision: this.state.revision };
  }
  credentialAttribution(value: ManagedCredential) {
    const metadata = value.mutation && this.store.uncertainCredentialMutations.has(value.mutation) ? value.previousChange : value;
    return {changeAction:metadata?.changeAction??null,changed:metadata?.actor?metadata.changed:null,changedBy:metadata?.actor?(metadata.historical?'Historical account '+metadata.actor:this.store.state.users.find(u=>u.id===metadata.actor)?.email??'Former account '+metadata.actor):'Unknown'};
  }
  credentialInUse(s: ManagedService, key: string): boolean { return [s.applied,s.draft?.content,s.review?.candidate].some(c=>c?.credentials?.some(v=>v.id===key)); }
  credentialConfirmation(id: string, key: string): string { return digest(JSON.stringify({id,key,fingerprint:this.fingerprint(id),record:own(own(this.state.services,id)?.values??{},key)?.version,revision:this.store.state.revision})); }
  credential(session: ConsoleSession, input: unknown) {
    const actor = this.actor(session,true);
    const data=this.parse(z.object({id:idSchema,credential:idSchema,action:z.enum(['create','replace','delete']),value:z.string().min(1).max(16384).optional(),confirmation:z.string().regex(/^[a-f0-9]{64}$/).optional(),confirmed:z.literal(true)}).strict(),input);
    const s=own(this.state.services,data.id);if(!s)throw new ServiceManagementError('Service unavailable. Save a draft first.');
    const previous=own(s.values,data.credential),inUse=this.credentialInUse(s,data.credential);
    if(previous && !data.confirmation || data.confirmation!==undefined && data.confirmation!==this.credentialConfirmation(data.id,data.credential))throw new ServiceManagementError('Credential changed. Reload its current state and confirm again.');
    if(data.action==='create' ? Boolean(previous?.value) : !previous)throw new ServiceManagementError('Credential availability changed. Reload its current metadata.');
    if(data.action==='create'&&!newIdSchema.safeParse(data.credential).success&&!inUse)throw new ServiceManagementError('Invalid new credential identifier.');
    if(data.action==='delete'){if(data.value!==undefined)throw new ServiceManagementError('Delete does not accept a value.');if(inUse&&!previous?.value)return {status:'already cleared',revision:this.state.revision};}
    else if(!data.value||data.value.trim()!==data.value||/[\r\n\0]/.test(data.value)||/^(Bearer|Basic)\s/i.test(data.value))throw new ServiceManagementError('Use a canonical credential value without protocol prefix, surrounding whitespace or control characters.');
    if(this.store.state.v<5)this.store.commit(actor.id,'credential.format_upgrade','instance',state=>{state.v=5;});
    const changeAction=data.action==='delete'?'clear':previous?.value?'replace':'set';
    const generation=this.store.state.revision+1,version=(previous?.version??0)+1,mutation=randomUUID(),changed=Date.now();
    let operation:string;
    try {operation=this.store.commit(actor.id,'credential.mutate',data.id,state=>{
      this.actor(session,true);state.v=Math.max(state.v,5) as typeof state.v;
      const target=state.managed!.services[data.id]!;
      if(data.action==='delete'&&!inUse)delete target.values[data.credential];
      else Object.defineProperty(target.values,data.credential,{value:{value:data.action==='delete'?'':data.value!,...(data.action==='delete'?{missing:true}:{}),version,generation,changed,changeAction,actor:actor.id,mutation,...(previous?{previousChange:{changed:previous.changed,...(previous.changeAction?{changeAction:previous.changeAction}:{}),...(previous.actor?{actor:previous.actor}:{}),...(previous.historical?{historical:true}:{})}}:{})},writable:true,enumerable:true,configurable:true});
      delete target.review;state.managed!.revision++;projectCredentialService(state,data.id);
    },{credential: sanitizeAuditText(data.credential,data.value?[data.value]:[]),credentialAction:data.action==='delete'?(inUse?'clear':'delete'):previous?.value?'replace':'set',credentialIdentity:credentialIdentity(data.id,data.credential),credentialVersion:generation,mutation});}
    catch(error){this.store.uncertainCredentialMutations.add(mutation);throw error;}
    finally {if(this.store.journal.entries().some(r=>r.phase==='start'&&r.details?.mutation===mutation)){if(s.applied?.credentials?.some(c=>c.id===data.credential))this.invalidate(data.id);this.publish();}}
    return {operation,status:data.action==='delete'?(inUse?'value cleared; key retained':'key deleted'):'success',revision:this.state.revision};
  }
  access(session: ConsoleSession, input: unknown) {
    const actor = this.actor(session, true);
    const data = this.parse(z.object({ id: idSchema, user: z.string().min(1).max(254), action: z.enum(['grant', 'remove']), fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(), confirmed: z.literal(true) }).strict(), input);
    const s = own(this.state.services, data.id); if (!s?.applied) throw new ServiceManagementError('Activate the service with reviewed initial grants first.');
    if (data.fingerprint !== undefined && data.fingerprint !== this.fingerprint(data.id)) throw new ServiceManagementError('Stale access confirmation. Reload current assignments and confirm again.');
    const user = this.store.state.users.find(u => u.id === data.user);
    if (data.action === 'grant' && (!user?.active || user.enrolled === false || user.role === 'Auditor') && !this.store.state.people?.external.some(e=>e.id===data.user&&e.active) && !(data.user==='bearer-dev'&&this.runtimeConfig.auth.mode==='bearer')) throw new ServiceManagementError('Access target no longer eligible. Select an active enrolled identity.');
    if (data.action === 'grant' ? s.assignments.includes(data.user) : !s.assignments.includes(data.user)) throw new ServiceManagementError('Assignment changed. Reload current access.');
    const base = this.state.revision; let operation: string;
    try { operation = this.store.commit(actor.id, 'service.access_' + data.action, data.id, state => {
      const m = state.managed!, target = m.services[data.id]!;
      target.assignments = data.action === 'grant' ? [...target.assignments, data.user] : target.assignments.filter(v => v !== data.user);
      target.applied!.access = { users: target.assignments };if(target.recoveryReviewRequired&&target.draft){target.draft.content.access={users:[...target.assignments]};target.draft.missingMappings=(target.draft.missingMappings??[]).filter(v=>target.assignments.includes(v));target.draft.base=m.revision+1;target.draft.generation++;delete target.review;}
      const active = own(state.config!.services, data.id); if (active) active.access = { users: target.assignments };
      m.revision++;
    }, { identity: data.user }); } finally { if (this.state.revision !== base) { if (data.action === 'remove') this.invalidate(data.id, data.user); this.publish(); } }
    return { operation, status: 'success', revision: this.state.revision };
  }
  lifecycle(session: ConsoleSession, input: unknown) {
    const actor = this.actor(session, true);
    const data = this.parse(z.object({ id: idSchema, action: z.enum(['disable', 'archive', 'unarchive']), fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(), confirmed: z.literal(true) }).strict(), input);
    const s = own(this.state.services, data.id); if (!s) throw new ServiceManagementError('Service unavailable. Reload Services.');
    if (data.fingerprint !== undefined && data.fingerprint !== this.fingerprint(data.id)) throw this.stale(session, data.id);
    if (data.action === 'unarchive' && s.lifecycle !== 'Archived') throw new ServiceManagementError('Only an Archived service can be unarchived.');
    if (data.action === 'disable' && s.lifecycle === 'Archived') throw new ServiceManagementError('Service archived. Unarchive returns it to Disabled.');
    const base = this.state.revision; let operation: string;
    try { operation = this.store.commit(actor.id, 'service.' + data.action, data.id, state => {
      const m = state.managed!; m.services[data.id]!.lifecycle = data.action === 'archive' ? 'Archived' : 'Disabled';
      delete state.config!.services[data.id]; m.revision++;
    }); } finally { if (this.state.revision !== base) { this.invalidate(data.id); this.publish(); } }
    return { operation, status: 'success', revision: this.state.revision };
  }
  admit(subject: string, id: string): void {
    if(!this.store.storageReliable||this.store.journal.degraded)throw new Error('Credential state unavailable.');
    if(this.store.mutationsBlocked())throw new Error('Instance recovery maintenance.');
    const service = own(this.state.services, id);
    if (service?.applied?.credentials?.some(c=>!own(service.values,c.id)?.value))throw new Error('Required credential value missing.');
    if (!service || service.lifecycle !== 'Active' || !service.assignments.includes(subject)) throw new Error('Current service access unavailable.');
    const external = this.store.state.people?.external.find(e=>e.id===subject);if(external&&!external.active)throw new Error('Current identity is not eligible.');
    const local = this.store.state.users.find(u => u.id === subject);
    if (local && (!local.active || local.enrolled === false || local.role === 'Auditor')) throw new Error('Current identity is not eligible.');
  }
  publish(): void {
    // One synchronous pointer swap; the existing broker/limiter/scanner resources survive.
    this.runtimeConfig.services = this.store.state.config!.services;
    if(this.store.state.config!.responseProtection)this.runtimeConfig.responseProtection=this.store.state.config!.responseProtection;
    this.runtimeConfig.admittedRevision = this.state.revision;
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

export function validateDraftBounds(draft: ManagedServiceDraft): void {
  if (JSON.stringify(draft).length > 262144 || (draft.policy?.rules.length ?? 0)>200) throw new ServiceManagementError('policy: Configuration exceeds bounded size or 200 rules.');
  for (const r of draft.policy?.rules??[]) for (const field of ['hosts','paths'] as const) {
    if(r[field].length>100) throw new ServiceManagementError('policy.'+field+': At most 100 expressions per rule.');
    for(const pattern of r[field]) { if(pattern.length>2048) throw new ServiceManagementError('policy.'+field+': Expression exceeds 2048 characters.');try {new RegExp(pattern);}catch {throw new ServiceManagementError('policy.'+field+': Invalid regular expression.');} }
  }
}
