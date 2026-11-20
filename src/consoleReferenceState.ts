import {randomUUID} from 'node:crypto';
import type {ConsoleState} from './consoleStore.js';
import type {ManagedService,ManagedConfiguration} from './consoleServices.js';
export function publicReference(id:string,service:ManagedService):string{return service.reference??id;}
export function referenceClaims(managed:ManagedConfiguration):Map<string,string>{
 const claims=new Map<string,string>();for(const [id,s] of Object.entries(managed.services))for(const key of [publicReference(id,s),s.draft?.content.mcp_reference]){if(key===undefined)continue;const owner=claims.get(key);if(owner!==undefined&&owner!==id)throw Error('MCP service reference is already in use.');claims.set(key,id);}return claims;
}
export function checkReference(managed:ManagedConfiguration,id:string,key:string):void{const owner=referenceClaims(managed).get(key);if(owner!==undefined&&owner!==id)throw Error('MCP service reference is already in use. Choose another reference.');}
export function retiredReferences(managed:ManagedConfiguration):Set<string>{return new Set((managed.history??[]).flatMap(h=>Object.entries(h.services).map(([id,s])=>s.mcp_reference??id)));}
export function initializeReferenceState(state:ConsoleState):void{if(state.v<10)return;for(const [id,s] of Object.entries(state.managed?.services??{}))s.reference??=id;}
export function upgradeReferenceState(state:ConsoleState):void{if(state.v<10)for(const [id,s] of Object.entries(state.managed?.services??{})){const proof=(state.managed?.history??[]).filter(h=>s.incarnation&&h.serviceIncarnations?.[id]===s.incarnation);if(proof.length){s.legacyEvidenceThrough=Date.now();s.legacyEvidenceAfter=Math.min(...proof.map(h=>h.time));}}state.v=Math.max(state.v,10) as ConsoleState['v'];initializeReferenceState(state);}
export function validateReferenceState(state:ConsoleState):void{
 if(state.v<10)return;const m=state.managed;if(!m)return;
 for(const s of Object.values(m.services))if(typeof s.reference!=='string'||!s.reference.length||s.reference.length>1024||/[\u0000-\u001f\u007f]/.test(s.reference))throw Error('Invalid service reference state');
 referenceClaims(m);
}
export function allocateManagedIdentity(managed:ManagedConfiguration,preferred:string):string{return Object.hasOwn(managed.services,preferred)?'service-'+randomUUID():preferred;}
