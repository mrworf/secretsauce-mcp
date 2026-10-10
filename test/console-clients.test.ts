import { expect, it, vi } from 'vitest';
import { totp } from '../src/consoleCrypto.js';
import { connectedClients, revokeClient } from '../src/consoleClients.js';
import { ConsoleStore } from '../src/consoleStore.js';
import { GatewayRuntime } from '../src/runtime.js';
import { createGatewayServer } from '../src/server.js';
import { managedOAuthFixture } from './managedOAuthFixtures.js';

it('lists own clients, rejects foreign selectors and confirmed-input failures, and revokes one durable client without removing another',async()=>{
 const f=await managedOAuthFixture();try{
  const first=await(await f.exchange(await f.code())).json();
  const secondConsent=await f.authorize({code:totp(f.enrolled.seed,Date.now()+30000)});expect(secondConsent.status).toBe(302);const code=new URL(secondConsent.headers.get('location')!).searchParams.get('code')!;const second=await(await f.exchange(code)).json();
  const listed=connectedClients(f.store,f.session);expect(listed.clients).toHaveLength(2);expect(JSON.stringify(listed)).not.toContain(first.refresh_token);expect(JSON.stringify(listed)).not.toContain(first.access_token);
  const grant=f.runtime.builtinOAuth.state.refreshGrants.get(listed.clients[0]!.id)!;
  for(const input of [{id:grant.id,confirmed:false},{id:'malformed',confirmed:true},{id:grant.id,confirmed:true,extra:true}])expect(()=>revokeClient(f.store,f.session,input)).toThrow('Invalid client');
  grant.subject='foreign';expect(connectedClients(f.store,f.session).clients).toHaveLength(1);expect(()=>revokeClient(f.store,f.session,{id:grant.id,confirmed:true})).toThrow('Forbidden');grant.subject=f.session.userId;
  const result=revokeClient(f.store,f.session,{id:grant.id,confirmed:true});expect(result.status).toBe('success');expect(connectedClients(f.store,f.session).clients).toHaveLength(1);
  expect((await f.mcp(first.access_token)).status).toBe(401);expect((await f.refresh(first.refresh_token)).status).toBe(400);expect((await f.mcp(second.access_token)).status).toBe(200);expect((await f.refresh(second.refresh_token)).status).toBe(200);
  expect(()=>revokeClient(f.store,f.session,{id:grant.id,confirmed:true})).toThrow('Forbidden');
 }finally{await f.close();}
});

it('enforces same-origin CSRF ownership and read-only restrictions at client HTTP routes',async()=>{
 const f=await managedOAuthFixture();try{
  await f.exchange(await f.code());const id=connectedClients(f.store,f.session).clients[0]!.id;
  const headers={cookie:'__Host-ss-console='+f.login.token,origin:'https://console.example.org','content-type':'application/json','x-console-csrf':f.login.csrf};
  const post=(extra:Record<string,string>={})=>fetch(f.base+'/console/api/client/revoke',{method:'POST',headers:{...headers,...extra},body:JSON.stringify({id,confirmed:true})});
  expect((await fetch(f.base+'/console/api/clients')).status).toBe(401);expect((await post({origin:'https://other.example.org'})).status).toBe(403);expect((await post({'x-console-csrf':'wrong'})).status).toBe(403);
  f.store.state.users[0]!.role='Auditor';expect(connectedClients(f.store,f.session).writable).toBe(false);expect((await post()).status).toBe(403);
  f.store.state.users[0]!.role='Owner';f.store.state.sessions[0]!.restricted=true;expect((await post()).status).toBe(400);
  f.store.state.sessions[0]!.restricted=false;expect((await post()).status).toBe(200);
 }finally{await f.close();}
});

it('durable tombstone denies old snapshot authority after uncertain revocation completion and normal reload',async()=>{
 const f=await managedOAuthFixture();let restarted:ConsoleStore|undefined,runtime:GatewayRuntime|undefined;
 try{
  const issued=await(await f.exchange(await f.code())).json();const grant=connectedClients(f.store,f.session).clients[0]!;
  const oldGrants=new Map(f.runtime.builtinOAuth.state.refreshGrants);
  const original=f.store.journal.finish.bind(f.store.journal);const fault=vi.spyOn(f.store.journal,'finish').mockImplementation((...args)=>{if(args[2]==='oauth.grant_revoke')throw Error('synthetic completion failure');return original(...args);});
  expect(()=>revokeClient(f.store,f.session,{id:grant.id,confirmed:true})).toThrow('uncertain');fault.mockRestore();expect((await f.mcp(issued.access_token)).status).toBe(401);
  // Simulate an older hash-only snapshot surviving the secondary-file write; encrypted authority remains revoked.
  await new Promise<void>(r=>f.server.close(()=>r()));await f.runtime.close();f.store.close();
  restarted=new ConsoleStore(f.directory,f.keyFile);runtime=new GatewayRuntime(restarted.state.config!);const server=createGatewayServer(restarted.state.config!,{consoleStore:restarted,runtime,closeRuntimeOnServerClose:false});
  runtime.builtinOAuth.state.refreshGrants=oldGrants;expect(()=>runtime!.builtinOAuth.assertGrant(f.session.userId,grant.id,0)).toThrow('authorization unavailable');
  server.close();
 }finally{await runtime?.close();restarted?.close();await f.close();}
});

it('capacity validation leaves grant and references unchanged before a durable revocation transition',async()=>{
 const f=await managedOAuthFixture();try{
  const issued=await(await f.exchange(await f.code())).json();const grant=connectedClients(f.store,f.session).clients[0]!;
  f.config.limits.maxRefreshTokenRecords=1;f.store.state.revokedOAuthGrants=[{id:'unrelated',expires:Date.now()+60000}];
  expect(()=>revokeClient(f.store,f.session,{id:grant.id,confirmed:true})).toThrow('capacity');expect(f.runtime.builtinOAuth.state.refreshGrants.has(grant.id)).toBe(true);expect((await f.mcp(issued.access_token)).status).toBe(200);
  f.store.storageReliable=false;expect(connectedClients(f.store,f.session).writable).toBe(false);
 }finally{await f.close();}
});

it.each(['issue','refresh'] as const)('single-grant revocation fences %s while token signing waits',async(kind)=>{
 const {SignJWT}=await import('jose');const f=await managedOAuthFixture();const c=await f.code();let token='';if(kind==='refresh')token=(await(await f.exchange(c)).json()).refresh_token;
 const original=SignJWT.prototype.sign;let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const spy=vi.spyOn(SignJWT.prototype,'sign').mockImplementation(async function(...args){entered();await gate;return original.apply(this,args);});
 try{const pending=kind==='issue'?f.exchange(c):f.refresh(token);await started;const grant=connectedClients(f.store,f.session).clients[0]!;revokeClient(f.store,f.session,{id:grant.id,confirmed:true});release();expect((await pending).status).toBe(400);}finally{release();spy.mockRestore();await f.close();}
});

it('audit outage prevents client revocation before state and live grant change',async()=>{
 const f=await managedOAuthFixture();try{await f.exchange(await f.code());const id=connectedClients(f.store,f.session).clients[0]!.id;f.store.journal.degraded=true;expect(connectedClients(f.store,f.session).writable).toBe(false);expect(()=>revokeClient(f.store,f.session,{id,confirmed:true})).toThrow('Sensitive actions');expect(f.runtime.builtinOAuth.state.refreshGrants.has(id)).toBe(true);}finally{await f.close();}
});

it('durable revocation intent fences restart when both pre-rename state save and refresh snapshot write fail',async()=>{
 const f=await managedOAuthFixture();let restarted:ConsoleStore|undefined,runtime:GatewayRuntime|undefined;
 try{
  await f.exchange(await f.code());const grant=connectedClients(f.store,f.session).clients[0]!;
  const oldGrants=new Map(f.runtime.builtinOAuth.state.refreshGrants);
  (f.store as unknown as {faultState:(phase?:string)=>void}).faultState=(phase)=>{if(phase==='before-rename')throw Error('synthetic state failure');};
  const auth=f.config.auth;if(auth.mode!=='builtin_oauth')throw Error('mode');const originalPath=auth.builtinOAuth.refreshTokenStoreFile!;
  auth.builtinOAuth.refreshTokenStoreFile=f.directory+'/missing-parent-is-file/refresh.json';const {writeFileSync}=await import('node:fs');writeFileSync(f.directory+'/missing-parent-is-file','synthetic obstruction');
  expect(()=>revokeClient(f.store,f.session,{id:grant.id,confirmed:true})).toThrow('uncertain');expect(f.store.state.revokedOAuthGrants??[]).toHaveLength(0);expect(f.store.storageReliable).toBe(false);
  auth.builtinOAuth.refreshTokenStoreFile=originalPath;
  await new Promise<void>(r=>f.server.close(()=>r()));await f.runtime.close();f.store.close();
  restarted=new ConsoleStore(f.directory,f.keyFile);runtime=new GatewayRuntime(restarted.state.config!);const server=createGatewayServer(restarted.state.config!,{consoleStore:restarted,runtime,closeRuntimeOnServerClose:false});runtime.builtinOAuth.state.refreshGrants=oldGrants;
  expect(runtime.builtinOAuth.revoked(grant.id)).toBe(true);expect(()=>runtime!.builtinOAuth.assertGrant(f.session.userId,grant.id,0)).toThrow('authorization unavailable');server.close();
 }finally{await runtime?.close();restarted?.close();await f.close();}
});
