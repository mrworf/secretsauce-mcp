import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportPKCS8, generateKeyPair } from 'jose';
import { validateConfig } from '../src/config.js';
import { hashBuiltinOAuthPassword } from '../src/builtinOAuth.js';
import { GatewayRuntime } from '../src/runtime.js';
import { createGatewayServer } from '../src/server.js';
import { setOAuthClientMetadataTestFetch } from '../src/oauthClientMetadata.js';
import { fixture, setup } from './consoleFixtures.js';
import { totp } from '../src/consoleCrypto.js';
export async function managedOAuthFixture() {
  const f=fixture();const enrolled=setup(f,Date.now()-60000);
  const login=f.store.login('owner@example.org','A novel lengthy passphrase 2026',totp(enrolled.seed,Date.now()-30000),Date.now()-30000);const session=f.store.session(login.token)!;
  const keys=await generateKeyPair('RS256',{extractable:true});const keyFile=join(f.directory,'signing.pem');writeFileSync(keyFile,await exportPKCS8(keys.privateKey));
  const config=validateConfig({server:{resource:'https://mcp.example.org',listen:'127.0.0.1:8080'},auth:{mode:'builtin_oauth',builtin_oauth:{issuer:'https://mcp.example.org',admin_username_env:'NAME',admin_password_hash_env:'HASH',signing_key_file:keyFile,allowed_clients:['https://client.example.org'],required_scopes:['gateway.read','gateway.references','gateway.request']}},services:{synthetic:{name:"Synthetic assigned service",no_auth:true,destinations:[{id:"primary",base_url:"https://api.example.org"}],credentials:[],access:{users:[]},policy:{mode:"allow",rules:[]}}}},{NAME:'legacy',HASH:hashBuiltinOAuthPassword('synthetic unused legacy',undefined,1000)});
  f.store.commit('host','test.config','instance',s=>{s.config=config;});
  const runtime=new GatewayRuntime(config);const server=createGatewayServer(config,{runtime,consoleStore:f.store,closeRuntimeOnServerClose:false});server.listen(0,'127.0.0.1');await once(server,'listening');const a=server.address();if(!a||typeof a==='string')throw Error('listener');const base=`http://127.0.0.1:${a.port}`;
  setOAuthClientMetadataTestFetch(async()=>new Response(JSON.stringify({client_id:'https://client.example.org/metadata',client_name:'Synthetic client',redirect_uris:['https://client.example.org/callback']}),{status:200,headers:{'content-type':'application/json'}}));
  const verifier='x'.repeat(43);const authorization={response_type:'code',client_id:'https://client.example.org/metadata',redirect_uri:'https://client.example.org/callback',scope:'gateway.read gateway.references gateway.request',state:'state',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),resource:'https://mcp.example.org'};
  async function request(path:string,body?:Record<string,string>,headers:Record<string,string>={}) {return fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{...(body?{'content-type':'application/x-www-form-urlencoded'}:{}),...headers},...(body?{body:new URLSearchParams(body)}:{})});}
  async function authorize(extra:Record<string,string>={}) {const page=await request('/oauth/authorize?'+new URLSearchParams(authorization));const html=await page.text();const challenge=/name="consent_challenge" value="([^"]+)"/.exec(html)![1]!;return request('/oauth/authorize',{...authorization,username:'owner@example.org',password:'A novel lengthy passphrase 2026',code:totp(enrolled.seed),consent:'yes',consent_challenge:challenge,...extra},{origin:'https://mcp.example.org'});}
  async function code() {const r=await authorize();if(r.status!==302)throw Error('synthetic consent failed');return new URL(r.headers.get('location')!).searchParams.get('code')!;}
  const exchange=(c:string)=>request('/oauth/token',{grant_type:'authorization_code',code:c,client_id:authorization.client_id,redirect_uri:authorization.redirect_uri,code_verifier:verifier});
  const refresh=(token:string)=>request('/oauth/token',{grant_type:'refresh_token',refresh_token:token,client_id:authorization.client_id});
  const mcp=(token:string)=>fetch(base+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token,accept:'application/json, text/event-stream','content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
  return {...f,session,login,config,runtime,server,base,enrolled,authorization,request,authorize,code,exchange,refresh,mcp,async close(){setOAuthClientMetadataTestFetch(undefined);await new Promise<void>(r=>server.close(()=>r()));await runtime.close();f.close();}};
}
