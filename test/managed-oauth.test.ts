import { expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { request } from 'node:http';
import { managedOAuthFixture } from './managedOAuthFixtures.js';

it('replay revokes the family, old access JWTs and subject references before a new MCP admission',async()=>{
 const f=await managedOAuthFixture();try{
  const issued=await (await f.exchange(await f.code())).json();
  const subject=f.store.state.users[0]!.id;f.store.state.managed!.services.synthetic!.assignments=[subject];f.config.services.synthetic!.access.users=[subject];
  const broker=f.runtime.capabilities.tokenBroker,auth={subject,scopes:[],mode:'builtin_oauth' as const};
  const reference=broker.issueTokens(auth,{service:'synthetic',destination:'primary',access_ids:['gateway_access'],reason:'Synthetic replay coverage'}).tokens[0]!.token;
  const context=broker.responseContext(auth,'synthetic');
  const invalidate=vi.spyOn(f.runtime.builtinOAuth,'invalidateSubject');
  const next=await f.refresh(issued.refresh_token);expect(next.status).toBe(200);const rotated=await next.json();expect((await f.mcp(rotated.access_token)).status).toBe(200);
  expect((await f.refresh(issued.refresh_token)).status).toBe(400);expect(invalidate).toHaveBeenCalledWith(subject);
  expect(()=>broker.validateServiceReferenceUse(auth,{service:'synthetic',destination:'primary'},reference)).toThrow();
  const completed=context.issueOrReuseResponseSecret(auth,'synthetic','synthetic protected bytes');expect(()=>broker.validateResponseSecretUse(auth,'synthetic',completed.token)).toThrow();
  expect((await f.mcp(issued.access_token)).status).toBe(401);expect((await f.mcp(rotated.access_token)).status).toBe(401);expect((await f.refresh(rotated.refresh_token)).status).toBe(400);
 }finally{await f.close();}
});

it.each(['issue','refresh'] as const)('fences %s suspended in signing when authentication settings change',async(kind)=>{
 const f=await managedOAuthFixture();const c=await f.code();let token='';if(kind==='refresh')token=(await (await f.exchange(c)).json()).refresh_token;
 const original=SignJWT.prototype.sign;let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const spy=vi.spyOn(SignJWT.prototype,'sign').mockImplementation(async function(...args){entered();await gate;return original.apply(this,args);});
 try{const pending=kind==='issue'?f.exchange(c):f.refresh(token);await started;f.runtime.builtinOAuth.authenticationGeneration++;release();expect((await pending).status).toBe(400);}finally{release();spy.mockRestore();await f.close();}
});

it('denies MCP authenticated before its body wait when the durable grant is revoked',async()=>{
 const f=await managedOAuthFixture();try{
  const issued=await (await f.exchange(await f.code())).json();
  let finish!:()=>void;const result=new Promise<number>((resolve,reject)=>{
   const req=request(f.base+'/mcp',{method:'POST',headers:{authorization:'Bearer '+issued.access_token,accept:'application/json, text/event-stream','content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});req.on('error',reject);req.write('{"jsonrpc":"2.0",');finish=()=>req.end('"id":1,"method":"tools/list"}');
  });
  await new Promise<void>(r=>setTimeout(r,30));f.runtime.builtinOAuth.state.refreshGrants.clear();finish();expect(await result).toBe(401);
 }finally{await f.close();}
});

it.each([{scope:'gateway.admin'},{redirect_uri:'https://other.example.org/callback'},{client_id:'https://other.example.org/metadata'},{resource:'https://other.example.org'},{code_challenge_method:'plain'}])('rejects invalid managed authorization context %j without credential collection',async(extra)=>{
 const f=await managedOAuthFixture();try{const r=await f.request('/oauth/authorize?'+new URLSearchParams({...f.authorization,...extra}));expect(r.status).toBe(400);expect(await r.text()).not.toContain('name="password"');}finally{await f.close();}
});

it('requires the one-use challenge and trusted Origin before MFA verification',async()=>{
 const f=await managedOAuthFixture();try{
  const user=f.store.state.users[0]!,counter=user.lastCounter;
  const rejected=await f.request('/oauth/authorize',{...f.authorization,consent:'yes',username:user.email,password:'A novel lengthy passphrase 2026',code:'000000',consent_challenge:'missing'},{origin:'https://other.example.org'});
  expect(rejected.status).toBe(400);expect(f.store.state.users[0]!.lastCounter).toBe(counter);expect(f.runtime.builtinOAuth.state.authorizationCodes.size).toBe(0);
 }finally{await f.close();}
});
