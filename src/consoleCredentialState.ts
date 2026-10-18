import { normalizeManagedService } from './config.js';
import { digest } from './consoleCrypto.js';
import type { ConsoleState } from './consoleStore.js';

/** Rebuild only the owned runtime projection. Missing credentials never become no-auth. */
export function projectCredentialService(state: ConsoleState, id: string): void {
  const s = state.managed!.services[id]!;
  delete state.config!.services[id];
  if (s.lifecycle !== 'Active' || !s.applied || s.recoveryReviewRequired) return;
  if ((s.applied.credentials ?? []).some(c => !Object.hasOwn(s.values,c.id) || !s.values[c.id]!.value)) return;
  const config = normalizeManagedService(id, s.applied, Object.fromEntries(Object.entries(s.values).flatMap(([key,v]) => v.value ? [[key,v.value]] : [])));
  Object.defineProperty(state.config!.services,id,{value:config,writable:true,enumerable:true,configurable:true});
}
export function credentialIdentity(service: string, key: string): string { return digest(JSON.stringify([service,key])); }
