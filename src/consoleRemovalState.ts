import {randomUUID} from 'node:crypto';
import type {ConsoleState} from './consoleStore.js';
import type {ManagedService} from './consoleServices.js';
import type {ManagedServiceDraft} from './config.js';

/** One-way owned-state boundary: fresh identities never inherit stale deletion authority. */
export function initializeRemovalIdentities(state:ConsoleState):void {
 if(state.v<8)return;
 for(const service of Object.values(state.managed?.services??{})){
  service.incarnation??=randomUUID();
  for(const value of Object.values(service.values))value.incarnation??=randomUUID();
 }
}
export function upgradeRemovalState(state:ConsoleState):void {
 state.v=Math.max(state.v,8) as ConsoleState['v'];initializeRemovalIdentities(state);
 for(const record of state.managed?.history??[])record.serviceIncarnations??=Object.fromEntries(Object.keys(record.services).flatMap(id=>Object.hasOwn(state.managed!.services,id)?[[id,state.managed!.services[id]!.incarnation!]]:[]));
}
export function removalIntent(service:ManagedService, candidate:ManagedServiceDraft):Array<{id:string;incarnation:string}> {
 const remaining=new Set((candidate.credentials??[]).map(c=>c.id));
 const prior=new Set([...(service.applied?.credentials??[]),...(service.draft?.content.credentials??[])].map(c=>c.id));
 const intents=new Map((service.draft?.removedCredentials??[]).map(c=>[c.id,c]));
 for(const id of prior)if(!remaining.has(id)&&Object.hasOwn(service.values,id)){
  const value=service.values[id]!;if(value.incarnation&&!intents.has(id))intents.set(id,{id,incarnation:value.incarnation});
 }
 const result=[...intents.values()].filter(c=>!remaining.has(c.id));
 if(result.length>100)throw Error('Too many pending credential removals. Apply or discard existing changes first.');
 return result;
}
export function removalEffects(service:ManagedService):string[]{
 const remaining=new Set((service.draft?.content.credentials??[]).map(c=>c.id));
 return (service.draft?.removedCredentials??[]).filter(c=>!remaining.has(c.id)&&Object.hasOwn(service.values,c.id)&&service.values[c.id]!.incarnation===c.incarnation).map(c=>c.id);
}

export function validateRemovalIdentities(state:ConsoleState):void {
 if(state.v<8)return;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const deleted=state.managed?.lastServiceDeletion;if(deleted&&(state.v<9||!uuid.test(deleted.incarnation)||!uuid.test(deleted.mutation)))throw Error('Invalid service deletion outcome');
 for(const service of Object.values(state.managed?.services??{})){
  if(!uuid.test(service.incarnation??'')||Object.values(service.values).some(v=>!uuid.test(v.incarnation??'')))throw Error('Invalid service dependency identity');
  const intents=service.draft?.removedCredentials??[];
  if(intents.length>100||new Set(intents.map(c=>c.id)).size!==intents.length||intents.some(c=>!uuid.test(c.incarnation)||!c.id||c.id.length>1024))throw Error('Invalid credential removal intent');
 }
}
