import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import { normalizeManagedService } from './config.js';
import { ConsoleServices, ServiceManagementError } from './consoleServices.js';
import type { ConsoleSession } from './consoleStore.js';
const schema = z.object({ id: z.string().min(1).max(1024), identity: z.string().min(1).max(1024), source: z.enum(['applied','draft']),
  destination: z.string().min(1).max(1024).optional(), method: z.string().regex(/^[A-Za-z]{1,24}$/), path: z.string().max(8192).optional(), url: z.string().max(8192).optional(),
}).strict().refine(v => (v.path === undefined) !== (v.url === undefined));
let occupied = 0;
export async function previewPolicy(manager: ConsoleServices, session: ConsoleSession, input: unknown) {
  manager.actor(session);
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ServiceManagementError('preview: Select service, identity, applied/draft source, method and exactly one path or URL.');
  const data = parsed.data, entry = Object.hasOwn(manager.state.services,data.id) ? manager.state.services[data.id] : undefined;
  const fingerprint=manager.fingerprint(data.id);
  if(data.url){try{const url=new URL(data.url);if(url.username||url.password||url.hash)throw Error();}catch{throw new ServiceManagementError('destination: Use a valid URL without userinfo or fragment.');}}
  const draft = data.source === 'draft' ? entry?.draft?.content : entry?.applied;
  if (!draft) throw new ServiceManagementError('source: Selected configuration is unavailable.');
  // No saved credential values are read or sent to the worker.
  let service;
  try { service = normalizeManagedService(data.id, draft, Object.fromEntries((draft.credentials??[]).map(c=>[c.id,'preview-placeholder']))); }
  catch { throw new ServiceManagementError('source: Complete destination and policy fields before preview.'); }
  const eligible = () => { const local=manager.store.state.users.find(u=>u.id===data.identity), external=manager.store.state.people?.external.find(e=>e.id===data.identity);
    const current=Object.hasOwn(manager.state.services,data.id)?manager.state.services[data.id]:undefined;
    return Boolean((local?.active && local.enrolled!==false && local.role!=='Auditor' || external?.active) && current?.lifecycle==='Active' && current.assignments.includes(data.identity)); };
  if (occupied>=4) throw new ServiceManagementError('preview: Busy. Try again after current previews finish.');
  occupied++;
  try {
    const result = await new Promise<Record<string,unknown>>((resolve,reject)=>{
      const worker=new Worker(new URL('../dist/policyPreviewWorker.js',import.meta.url),{workerData:{service,input:data},resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8}});
      const timer=setTimeout(()=>{void worker.terminate();reject(new ServiceManagementError('preview: Regex evaluation exceeded its bounded deadline. Shorten target or review expressions.'));},1000);
      worker.once('message',result=>{clearTimeout(timer);void worker.terminate();result.error?reject(new ServiceManagementError(result.error)):resolve(result);});
      worker.once('error',()=>{clearTimeout(timer);void worker.terminate();reject(new ServiceManagementError('preview: Evaluation unavailable. Reload and retry.'));});
    });
    if(manager.fingerprint(data.id)!==fingerprint)throw new ServiceManagementError('source: Configuration or dependencies changed. Reload and preview again.');
    manager.actor(session); // Role/session and eligibility may change during the bounded work.
    return { ...result, eligible: eligible(), allowed: eligible() && result.allowed===true, policyAllowed: result.allowed,
      source: data.source, reason: eligible()?result.reason:'Current identity or service access is not eligible.', notice:'No downstream request is sent. Preview is not an execution grant.' };
  } finally { occupied--; }
}
