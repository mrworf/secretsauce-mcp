import { z } from 'zod';
import { ConsoleStore, type ConsoleSession } from './consoleStore.js';
import { BuiltinOAuthRuntime } from './builtinOAuth.js';
const runtimes=new WeakMap<ConsoleStore,BuiltinOAuthRuntime>();
export function bindConsoleClients(store:ConsoleStore,runtime:BuiltinOAuthRuntime):void {runtimes.set(store,runtime);}
export class ClientManagementError extends Error {}
export function connectedClients(store:ConsoleStore,session:ConsoleSession) {
 const user=store.authorize(session,'own'), runtime=runtimes.get(store);
 const writable=user.role!=='Auditor'&&store.storageReliable&&!session.restricted&&!store.journal.degraded&&!store.externalAudit?.degraded;
 const config=store.state.config,origin=config?.server.resource??store.state.origin;
 return {connection:{resourceOrigin:origin,mcpUrl:origin+(config?.server.mcpPath??'/mcp'),...(config?.auth.mode==='builtin_oauth'?{issuerOrigin:config.auth.builtinOAuth.issuer}:{}),canConnect:user.role!=='Auditor'},writable,mode:store.state.config?.auth.mode??'builtin_oauth',clients:runtime?[...runtime.state.refreshGrants.values()].filter(g=>g.subject===user.id&&runtime.eligible(g.subject,g.authorizationGeneration,g.authenticationGeneration)&&!runtime.revoked(g.id)&&g.expiresAt>Date.now()&&g.idleExpiresAt>Date.now()).map(g=>({id:g.id,client:g.clientId,scopes:g.scopes,created:g.createdAt,expires:Math.min(g.idleExpiresAt,g.expiresAt)})):[]};
}
export function revokeClient(store:ConsoleStore,session:ConsoleSession,input:unknown) {
 const user=store.requireSensitive(session);if(user.role==='Auditor')throw new Error('Forbidden.');
 const parsed=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{22}$/),confirmed:z.literal(true)}).strict().safeParse(input);
 if(!parsed.success)throw new ClientManagementError('Invalid client revocation. Confirm the selected client.');
 const runtime=runtimes.get(store),grant=runtime?.state.refreshGrants.get(parsed.data.id);
 if(!runtime||!grant||grant.subject!==user.id||runtime.revoked(grant.id))throw new Error('Forbidden.');
 return {status:'success',operation:runtime.revokeManagedGrant(user.id,grant.id),notice:'Client revoked immediately. Other clients remain authorized; affected temporary references must be reacquired.'};
}
