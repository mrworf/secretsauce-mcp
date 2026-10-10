import { expect, it, vi } from 'vitest';
import { totp } from '../src/consoleCrypto.js';
import { consoleAuthentication } from '../src/consoleAuthentication.js';
import { managedOAuthFixture } from './managedOAuthFixtures.js';
import { ConsoleStore } from '../src/consoleStore.js';
import { GatewayRuntime } from '../src/runtime.js';
import { createGatewayServer } from '../src/server.js';

it('Owner reviews a scoped draft, requires recent MFA and publishes one coherent authentication revision without replacing runtime resources',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),current=a.current(),broker=f.runtime.capabilities.tokenBroker,pool=f.runtime.secretRuntime.pool,limiter=f.runtime.capabilities.serviceRequestLimiter;
  a.save(f.session,{base:0,generation:0,settings:{...current,mcpPath:'/gateway'}});expect(f.config.server.mcpPath).toBe('/mcp');const review=a.review(f.session,{});expect(review.scope).toEqual(['MCP authentication','OAuth resource origin','MCP path']);expect(()=>a.apply(f.session,{review:review.review,confirmed:true})).toThrow('Confirm password');
  f.store.recentCheck(f.session,'authentication.apply','A novel lengthy passphrase 2026',totp(f.enrolled.seed));a.apply(f.session,{review:review.review,confirmed:true});expect(f.config.server.mcpPath).toBe('/gateway');expect(a.state.revision).toBe(1);expect(f.runtime.builtinOAuth.authenticationGeneration).toBe(1);expect(f.runtime.capabilities.tokenBroker).toBe(broker);expect(f.runtime.secretRuntime.pool).toBe(pool);expect(f.runtime.capabilities.serviceRequestLimiter).toBe(limiter);
  expect(()=>a.apply(f.session,{review:review.review,confirmed:true})).toThrow('Stale');
 }finally{await f.close();}
});

it('bounds settings and preserves valid OAuth scope syntax, namespaced principals and long refresh lifetimes',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),current=a.current();
  const invalid=[{resource:'http://mcp.example.org'},{resource:'https://mcp.example.org/mcp'},{mcpPath:'/console'},{mcpPath:'/mcp/../oauth'},{mcpPath:'/%2fmcp'},{extra:true}];for(const patch of invalid)expect(()=>a.save(f.session,{base:0,generation:0,settings:{...current,...patch}})).toThrow('Invalid');
  const external={mode:'oauth',issuer:'https://issuer.example.org/tenant',audience:'synthetic',jwksUri:'https://issuer.example.org/jwks',requiredScopes:['https://api.example.org/read','gateway.read'],principalClaim:'https://id.example.org/sub'};
  a.save(f.session,{base:0,generation:0,settings:{...current,authentication:external}});expect(a.state.draft!.settings.authentication).toEqual(external);
  for(const authentication of [{...external,requiredScopes:['scope with space']},{...external,requiredScopes:['quote"scope']},{...external,principalClaim:'subject\n'},{...external,issuer:'https://user:pass@issuer.example.org'},{mode:'bearer',token:'Bearer synthetic'}])expect(()=>a.save(f.session,{base:0,generation:1,settings:{...current,authentication}})).toThrow('Invalid');
  if(current.authentication.mode!=='builtin_oauth')throw Error('mode');a.save(f.session,{base:0,generation:1,settings:{...current,authentication:{...current.authentication,refreshTokenIdleTtlMs:31536000000*2,refreshTokenMaxTtlMs:31536000000*3}}});
 }finally{await f.close();}
});

it('rejects stale dependency reviews, unauthorized roles, confirmation failures and audit outages',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),current=a.current();a.save(f.session,{base:0,generation:0,settings:current});const review=a.review(f.session,{});f.store.recentCheck(f.session,'authentication.apply','A novel lengthy passphrase 2026',totp(f.enrolled.seed));
  expect(()=>a.apply(f.session,{review:review.review,confirmed:false})).toThrow('Confirm');f.store.state.users[0]!.authorizationGeneration=1;expect(()=>a.apply(f.session,{review:review.review,confirmed:true})).toThrow('Stale');
  for(const role of ['Administrator','Auditor','Member'] as const){f.store.state.users[0]!.role=role;expect(()=>a.save(f.session,{base:0,generation:1,settings:current})).toThrow('Forbidden');}
  f.store.state.users[0]!.role='Owner';f.store.journal.degraded=true;expect(()=>a.save(f.session,{base:0,generation:1,settings:current})).toThrow('Sensitive');
 }finally{await f.close();}
});

it('keeps legacy bearer write-only and signing material stable across mode changes and encrypted restart',async()=>{
 const f=await managedOAuthFixture();let restarted:ConsoleStore|undefined,runtime:GatewayRuntime|undefined;
 try{
  const a=consoleAuthentication(f.store),current=a.current();if(f.config.auth.mode!=='builtin_oauth')throw Error('mode');const key=f.config.auth.builtinOAuth.signingPrivateKeyPem;
  const issued=await(await f.exchange(await f.code())).json();const {readFileSync,writeFileSync}=await import('node:fs');const oldSnapshot=readFileSync(f.directory+'/oauth-refresh.json','utf8');
  f.store.recentCheck(f.session,'authentication.apply','A novel lengthy passphrase 2026',totp(f.enrolled.seed,Date.now()+30000));
  a.save(f.session,{base:0,generation:0,settings:{...current,authentication:{mode:'bearer',token:'synthetic-shared-value'}}});let r=a.review(f.session,{});expect(JSON.stringify(r)).not.toContain('synthetic-shared-value');a.apply(f.session,{review:r.review,confirmed:true});expect(f.config.auth.mode).toBe('bearer');expect(JSON.stringify(a.read(f.session))).not.toContain('synthetic-shared-value');
  a.save(f.session,{base:1,generation:0,settings:{...current,authentication:{mode:'bearer',token:''}}});expect(a.state.draft!.settings.authentication).toMatchObject({token:'synthetic-shared-value'});
  a.save(f.session,{base:1,generation:1,settings:current});r=a.review(f.session,{});a.apply(f.session,{review:r.review,confirmed:true});if(f.config.auth.mode!=='builtin_oauth')throw Error('mode');expect(f.config.auth.builtinOAuth.signingPrivateKeyPem).toBe(key);
  writeFileSync(f.directory+'/oauth-refresh.json',oldSnapshot);
  await new Promise<void>(resolve=>f.server.close(()=>resolve()));await f.runtime.close();f.store.close();restarted=new ConsoleStore(f.directory,f.keyFile);runtime=new GatewayRuntime(restarted.state.config!);const server=createGatewayServer(restarted.state.config!,{consoleStore:restarted,runtime,closeRuntimeOnServerClose:false});expect(runtime.builtinOAuth.authenticationGeneration).toBe(2);const grant=[...runtime.builtinOAuth.state.refreshGrants.values()][0]!;expect(grant.authenticationGeneration).toBe(0);expect(()=>runtime!.builtinOAuth.assertGrant(f.session.userId,grant.id,0)).toThrow('authorization unavailable');server.listen(0,'127.0.0.1');const {once}=await import('node:events');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw Error('listener');expect((await fetch(`http://127.0.0.1:${address.port}/oauth/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:issued.refresh_token,client_id:f.authorization.client_id})})).status).toBe(400);if(restarted.state.config!.auth.mode!=='builtin_oauth')throw Error('mode');expect(restarted.state.config!.auth.builtinOAuth.signingPrivateKeyPem).toBe(key);server.close();
 }finally{await runtime?.close();restarted?.close();await f.close();}
});

it('normal managed startup ignores stale configured snapshot paths and retains hash-only refresh continuity',async()=>{
 const f=await managedOAuthFixture();let app:Awaited<ReturnType<typeof import('../src/server.js').startServer>>|undefined;
 try{
  const issued=await (await f.exchange(await f.code())).json() as {refresh_token:string};
  f.store.commit('host','test.stale_path','instance',s=>{if(s.config!.auth.mode!=='builtin_oauth')throw Error('mode');s.config!.auth.builtinOAuth.refreshTokenStoreFile='/missing/stale-snapshot.json';s.config!.server.port=0;});
  await new Promise<void>(resolve=>f.server.close(()=>resolve()));await f.runtime.close();f.store.close();
  vi.stubEnv('CONSOLE_STORAGE_DIR',f.directory);vi.stubEnv('CONSOLE_KEY_FILE',f.keyFile);
  const {startServer}=await import('../src/server.js');app=await startServer(f.config);expect(app.runtime.builtinOAuth.state.refreshGrants.size).toBe(1);
  const address=app.server.address();if(!address||typeof address==='string')throw Error('listener');const response=await fetch(`http://127.0.0.1:${address.port}/oauth/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:issued.refresh_token,client_id:f.authorization.client_id})});expect(response.status).toBe(200);
  const {readFileSync}=await import('node:fs');expect(readFileSync(f.directory+'/oauth-refresh.json','utf8')).not.toContain(issued.refresh_token);
 }finally{await app?.close();vi.unstubAllEnvs();await f.close();}
});

it('imports authentication only as an explicit inactive draft without reading imported source paths',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),before=f.config.auth;
  f.store.commit('host','test.proposal','instance',s=>{s.managed!.migrationGlobals={auth:{mode:'oauth',oauth:{issuer:'https://issuer.example.org/tenant',audience:'synthetic',principal_claim:'https://id.example.org/sub',required_scopes:['gateway.read']}},server:{resource:'https://mcp.example.org',mcp_path:'/gateway'}};});
  expect(()=>a.importProposal(f.session,{confirmed:false})).toThrow('Confirm');a.importProposal(f.session,{confirmed:true});expect(a.state.draft!.settings.authentication).toMatchObject({mode:'oauth',principalClaim:'https://id.example.org/sub'});expect(f.config.auth).toBe(before);expect(f.config.server.mcpPath).toBe('/mcp');
 }finally{await f.close();}
});

it('publishes committed settings even when audit completion is uncertain and protects HTTP writes with CSRF/current roles',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),settings=a.current(),headers={cookie:'__Host-ss-console='+f.login.token,origin:'https://console.example.org','content-type':'application/json','x-console-csrf':f.login.csrf};
  const post=(extra:Record<string,string>={})=>fetch(f.base+'/console/api/authentication/save',{method:'POST',headers:{...headers,...extra},body:JSON.stringify({base:0,generation:0,settings})});
  expect((await fetch(f.base+'/console/api/authentication')).status).toBe(401);expect((await post({origin:'https://other.example.org'})).status).toBe(403);expect((await post({'x-console-csrf':'wrong'})).status).toBe(403);expect((await post()).status).toBe(200);
  a.save(f.session,{base:0,generation:1,settings:{...settings,mcpPath:'/gateway'}});const review=a.review(f.session,{});f.store.recentCheck(f.session,'authentication.apply','A novel lengthy passphrase 2026',totp(f.enrolled.seed));const original=f.store.journal.finish.bind(f.store.journal);const fault=vi.spyOn(f.store.journal,'finish').mockImplementation((...args)=>{if(args[2]==='authentication.apply')throw Error('synthetic completion failure');return original(...args);});expect(()=>a.apply(f.session,{review:review.review,confirmed:true})).toThrow('uncertain');fault.mockRestore();expect(f.config.server.mcpPath).toBe('/gateway');expect(a.state.revision).toBe(1);expect(f.runtime.builtinOAuth.authenticationGeneration).toBe(1);
 }finally{await f.close();}
});

it('fences shared bearer admission waiting for its MCP body when Owner applies a new authentication revision',async()=>{
 const f=await managedOAuthFixture();try{
  const a=consoleAuthentication(f.store),current=a.current();f.store.recentCheck(f.session,'authentication.apply','A novel lengthy passphrase 2026',totp(f.enrolled.seed));
  a.save(f.session,{base:0,generation:0,settings:{...current,authentication:{mode:'bearer',token:'synthetic-shared-value'}}});let review=a.review(f.session,{});a.apply(f.session,{review:review.review,confirmed:true});
  const {request}=await import('node:http');let finish!:()=>void;const pending=new Promise<number>((resolve,reject)=>{const req=request(f.base+'/mcp',{method:'POST',headers:{authorization:'Bearer synthetic-shared-value',accept:'application/json, text/event-stream','content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});req.on('error',reject);req.write('{"jsonrpc":"2.0",');finish=()=>req.end('"id":1,"method":"tools/list"}');});await new Promise<void>(r=>setTimeout(r,30));
  a.save(f.session,{base:1,generation:0,settings:current});review=a.review(f.session,{});a.apply(f.session,{review:review.review,confirmed:true});finish();expect(await pending).toBe(401);
 }finally{await f.close();}
});
