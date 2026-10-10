import {totp} from '../src/consoleCrypto.js';
import {it,expect} from 'vitest';
import {matchesOAuthRedirect} from '../src/oauthRedirect.js';
import {setOAuthClientMetadataTestFetch} from '../src/oauthClientMetadata.js';
import {managedOAuthFixture} from './managedOAuthFixtures.js';
it('matches only ephemeral loopback ports while preserving exact host/path/query and all non-loopback redirects',()=>{
 expect(matchesOAuthRedirect('http://127.0.0.1/callback/synthetic','http://127.0.0.1:41234/callback/synthetic')).toBe(true);expect(matchesOAuthRedirect('http://[::1]/callback','http://[::1]:41234/callback')).toBe(true);
 for(const uri of ['http://localhost:41234/callback/synthetic','http://127.0.0.2:41234/callback/synthetic','https://127.0.0.1:41234/callback/synthetic','http://127.0.0.1:41234/callback/other','http://127.0.0.1:41234/callback/synthetic?extra=1','http://user@127.0.0.1:41234/callback/synthetic','http://127.0.0.1:41234/callback/synthetic#fragment','malformed'])expect(matchesOAuthRedirect('http://127.0.0.1/callback/synthetic',uri)).toBe(false);
 expect(matchesOAuthRedirect('https://client.example.org/callback','https://client.example.org:444/callback')).toBe(false);
});
it('authorizes Codex-shaped CIMD callback with its selected port and rejects cross-callback redirects before consent',async()=>{
 const f=await managedOAuthFixture();try{
  setOAuthClientMetadataTestFetch(async()=>new Response(JSON.stringify({client_id:f.authorization.client_id,client_name:'Synthetic Codex-shaped client',redirect_uris:['http://127.0.0.1/callback/synthetic']}),{headers:{'content-type':'application/json'}}));
  for(const [redirect_uri,status] of [['http://127.0.0.1:41234/callback/synthetic',200],['http://127.0.0.1:41234/callback/other',400],['http://localhost:41234/callback/synthetic',400]] as const){const response=await f.request('/oauth/authorize?'+new URLSearchParams({...f.authorization,redirect_uri}));expect(response.status).toBe(status);expect((await response.text()).includes('name="password"')).toBe(status===200);}
  const redirect_uri='http://127.0.0.1:41234/callback/synthetic';f.authorization.redirect_uri=redirect_uri;const negative=await f.authorize({redirect_uri});expect(negative.status).toBe(302);const negativeCode=new URL(negative.headers.get('location')!).searchParams.get('code')!;expect((await f.request('/oauth/token',{grant_type:'authorization_code',code:negativeCode,client_id:f.authorization.client_id,redirect_uri:'http://127.0.0.1:41235/callback/synthetic',code_verifier:'x'.repeat(43)})).status).toBe(400);const authorized=await f.authorize({redirect_uri,code:totp(f.enrolled.seed,Date.now()+30000)});expect(authorized.status).toBe(302);const callback=new URL(authorized.headers.get('location')!);expect(callback.port).toBe('41234');expect(callback.pathname).toBe('/callback/synthetic');const exchanged=await f.request('/oauth/token',{grant_type:'authorization_code',code:callback.searchParams.get('code')!,client_id:f.authorization.client_id,redirect_uri,code_verifier:'x'.repeat(43)});expect(exchanged.status).toBe(200);
 }finally{await f.close();}
});
