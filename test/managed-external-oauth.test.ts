import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {managedOAuthFixture} from './managedOAuthFixtures.js';
import {consoleServices} from '../src/consoleServices.js';
import {consolePeople} from '../src/consolePeople.js';
it('maps verified exact external pairs to assigned UUIDs and fences registry changes during asynchronous verification',async()=>{
 const f=await managedOAuthFixture();const keys=await generateKeyPair('RS256');const jwk={...await exportJWK(keys.publicKey),kid:'synthetic',alg:'RS256'};
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);let pause=true;
 const jwks=createServer(async(_req,res)=>{if(pause){entered();await gate;}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({keys:[jwk]}));});jwks.listen(0,'127.0.0.1');await once(jwks,'listening');const address=jwks.address();if(!address||typeof address==='string')throw Error('listener');
 try{
  const issuer='https://issuer.example.org/tenant',subject='registered-subject',id=randomUUID();f.store.commit('host','test.external','instance',s=>{s.people={proofs:[],external:[{id,issuer,subject,label:'Synthetic external',active:true}]};});
  f.config.auth={mode:'oauth',oauth:{issuer,audience:'synthetic',jwksUri:`http://127.0.0.1:${address.port}/jwks`,principalClaim:'https://id.example.org/sub',requiredScopes:['gateway.read']}};
  const sign=(sub:string)=>new SignJWT({'https://id.example.org/sub':sub,scope:'gateway.read gateway.references gateway.request'}).setProtectedHeader({alg:'RS256',kid:'synthetic'}).setIssuer(issuer).setAudience('synthetic').setExpirationTime('5m').sign(keys.privateKey);
  const token=await sign(subject),pending=f.mcp(token);await started;consolePeople(f.store).externalChange(f.session,{id,active:false,confirmed:true});consolePeople(f.store).externalChange(f.session,{id,active:true,confirmed:true});pause=false;release();expect((await pending).status).toBe(401);
  expect((await f.mcp(token)).status).toBe(200);expect((await f.mcp(await sign('other-subject'))).status).toBe(401);
  const call=async()=>{const response=await fetch(f.base+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'list_services',arguments:{}}})});return response.text();};
  expect(await call()).not.toContain('Synthetic assigned service');consoleServices(f.store).state.services.synthetic!.assignments.push(id);f.store.state.config!.services.synthetic.access.users.push(id);consoleServices(f.store).publish();expect(await call()).toContain('Synthetic assigned service');
  consolePeople(f.store).externalChange(f.session,{id,active:false,confirmed:true});expect((await f.mcp(token)).status).toBe(401);
  f.store.state.people!.external[0]!.active=true;f.store.state.people!.external[0]!.issuer='https://other.example.org/tenant';expect((await f.mcp(token)).status).toBe(401);
 }finally{release();await new Promise<void>(r=>jwks.close(()=>r()));await f.close();}
});
