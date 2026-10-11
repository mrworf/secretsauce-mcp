import { describe, it, expect, vi } from 'vitest';
import { ConsolePeople } from '../src/consolePeople.js';
import { totp, passwordMatches } from '../src/consoleCrypto.js';
import { managedFixture } from './consoleManagementFixtures.js';
const password='Synthetic target lengthy passphrase 2026';
const replacement='Synthetic replacement passphrase 2026';
const value=(link:string)=>Object.fromEntries(new URLSearchParams(new URL(link).hash.slice(1)));
function setup() {
 const f=managedFixture(), p=new ConsolePeople(f.store);
 const add=(role='Member')=>{const r=p.invite(f.session,{email:(role==='Owner'?'second-owner':role.toLowerCase())+'@example.org',role,confirmed:true});const proof=value(r.link),e=p.begin({...proof,password});p.complete({...proof,code:totp(e.seed,Date.now()),saved:true});return {id:r.id,...e};};
 const recent=()=>{f.store.state.sessions.find(s=>s.id===f.session.id)!.recent={action:'people.recovery',expires:Date.now()+300000};};
 const issue=(id:string,purpose='password')=>p.assist(f.session,{id,purpose,channel:'known_phone',verified:true,confirmed:true});
 return {...f,p,add,recent,issue};
}
describe('separate assisted password reset',()=>{
 it.each(['Owner','Administrator'] as const)('%s reset matrix, no extra administration and strict inputs',role=>{const f=setup();try{
  const users=['Owner','Administrator','Auditor','Member'].map(r=>f.add(r));f.store.state.users[0]!.role=role;f.recent();
  for(const m of users){if(role==='Administrator'&&f.store.state.users.find(u=>u.id===m.id)!.role==='Owner'){expect(()=>f.issue(m.id)).toThrow(/Forbidden/);continue;}
   const before=f.store.state.users.find(u=>u.id===m.id)!;const r=f.issue(m.id);expect(f.store.state.users.find(u=>u.id===m.id)).toEqual(before);expect(f.p.preview(value(r.link)).purpose).toBe('password');
  }
  expect(()=>f.issue(f.session.userId)).toThrow();
  const m=users[3]!;for(const patch of [{contact:'other@example.org'},{verified:false},{confirmed:false},{channel:'new_phone'},{purpose:'login'}])expect(()=>f.p.assist(f.session,{id:m.id,purpose:'password',channel:'known_phone',verified:true,confirmed:true,...patch})).toThrow();
  f.store.state.users.find(u=>u.id===m.id)!.active=false;expect(()=>f.issue(m.id)).toThrow();
  if(role==='Administrator')expect(()=>f.p.invite(f.session,{email:'new@example.org',role:'Member',confirmed:true})).toThrow(/Forbidden/);
  for(const denied of ['Member','Auditor'] as const){f.store.state.users[0]!.role=denied;expect(()=>f.issue(users[1]!.id)).toThrow(/Forbidden/);}
 }finally{f.close();}});
 it.each(['totp','recovery'] as const)('requires current %s, preserves factor and revokes access only on completion',kind=>{const f=setup();try{
  const m=f.add();f.clock.mockReturnValue(Date.now()+30000);const login=f.store.login('member@example.org',password,totp(m.seed,Date.now()));f.clock.mockReturnValue(Date.now()+30000);f.recent();const invalidate=vi.fn();f.store.invalidateUser=invalidate;
  const proof=value(f.issue(m.id).link);expect(f.store.session(login.token)).toBeDefined();expect(invalidate).not.toHaveBeenCalled();
  for(const bad of [{},{kind,factor:'bad'},{kind:'password',factor:'123456'}])expect(()=>f.p.resetPassword({...proof,password:replacement,...bad})).toThrow();
  const factor=kind==='totp'?totp(m.seed,Date.now()):m.recoveryCodes[0];f.p.resetPassword({...proof,password:replacement,kind,factor});const u=f.store.state.users.find(u=>u.id===m.id)!;
  expect(u.seed).toBe(m.seed);expect(u.recoveryHashes).toHaveLength(kind==='recovery'?9:10);expect(passwordMatches(replacement,u.password)).toBe(true);expect(passwordMatches(password,u.password)).toBe(false);expect(f.store.session(login.token)).toBeUndefined();expect(invalidate).toHaveBeenCalledWith(m.id);
  expect(()=>f.p.resetPassword({...proof,password:replacement,kind,factor})).toThrow();const audit=JSON.stringify(f.store.journal.entries());for(const secret of [proof.proof!,replacement,m.seed,factor!])expect(audit).not.toContain(secret);
 }finally{f.close();}});
 it('rejects old proof semantics and issuer/target drift, but not natural issuer session expiry',()=>{const f=setup();try{
  const m=f.add();f.recent();let proof=value(f.issue(m.id).link),p=f.store.state.people!.proofs[0]!;delete p.version;expect(()=>f.p.preview(proof)).toThrow();
  proof=value(f.issue(m.id).link);const issuer=f.store.state.users[0]!;issuer.authorizationGeneration=(issuer.authorizationGeneration??0)+1;expect(()=>f.p.preview(proof)).toThrow();
  proof=value(f.issue(m.id).link);f.store.state.users.find(u=>u.id===m.id)!.authorizationGeneration!++;expect(()=>f.p.preview(proof)).toThrow();
  proof=value(f.issue(m.id).link);f.store.state.sessions=[];expect(f.p.preview(proof).purpose).toBe('password');f.p.resetPassword({...proof,password:replacement,kind:'recovery',factor:m.recoveryCodes[0]});
 }finally{f.close();}});
 it('blocks audit admission and invalidates live references on uncertain password completion',()=>{const f=setup();try{
  const m=f.add();f.recent();const proof=value(f.issue(m.id).link);f.store.journal.degraded=true;expect(()=>f.p.resetPassword({...proof,password:replacement,kind:'recovery',factor:m.recoveryCodes[0]})).toThrow();expect(passwordMatches(password,f.store.state.users.find(u=>u.id===m.id)!.password)).toBe(true);f.store.journal.degraded=false;
  const invalidate=vi.fn();f.store.invalidateUser=invalidate;vi.spyOn(f.store.journal,'finish').mockImplementation(()=>{throw Error('synthetic');});expect(()=>f.p.resetPassword({...proof,password:replacement,kind:'recovery',factor:m.recoveryCodes[0]})).toThrow(/uncertain/);expect(invalidate).toHaveBeenCalledWith(m.id);
 }finally{f.close();}});
});
