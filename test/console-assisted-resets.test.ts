import { describe, it, expect, vi } from 'vitest';
import { ConsoleStore, loadManagedConfig } from '../src/consoleStore.js';
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

describe('separate assisted Authenticator reset',()=>{
 it.each(['Owner','Administrator'] as const)('%s completes MFA without password and recovers both lost in order',role=>{const f=setup();try{
  const m=f.add();f.store.state.users[0]!.role=role;f.recent();const old=f.store.state.users.find(u=>u.id===m.id)!;const proof=value(f.issue(m.id,'factor').link),u=f.store.state.users.find(u=>u.id===m.id)!;
  expect(u.seed).toBe('');expect(u.recoveryHashes).toEqual([]);expect(u.enrolled).toBe(false);expect(u.password).toBe(old.password);expect(()=>f.issue(m.id,'password')).toThrow();
  expect(()=>f.p.begin({...proof,password:replacement})).toThrow(/does not change/);expect(()=>f.p.resetPassword({...proof,password:replacement,kind:'recovery',factor:m.recoveryCodes[0]})).toThrow();
  const e=f.p.begin(proof);f.p.complete({...proof,code:totp(e.seed,Date.now()),saved:true});const done=f.store.state.users.find(u=>u.id===m.id)!;expect(done.password).toBe(old.password);expect(done.seed).not.toBe(m.seed);expect(done.enrolled).toBe(true);
  const next=value(f.issue(m.id).link);f.p.resetPassword({...next,password:replacement,kind:'recovery',factor:e.recoveryCodes[0]});expect(passwordMatches(replacement,f.store.state.users.find(u=>u.id===m.id)!.password)).toBe(true);
 }finally{f.close();}});
 it('requires eligible current roles and issuer generation, preserves restriction on expiry/cancel/reissue',()=>{const f=setup();try{
  const m=f.add();f.store.state.users[0]!.role='Administrator';f.recent();let r=f.issue(m.id,'factor'),proof=value(r.link);
  f.store.state.users.find(u=>u.id===m.id)!.role='Owner';expect(()=>f.p.preview(proof)).toThrow();f.store.state.users.find(u=>u.id===m.id)!.role='Member';
  expect(()=>f.p.preview(proof,r.expires)).toThrow();expect(f.store.state.users.find(u=>u.id===m.id)!.enrolled).toBe(false);
  for(const bad of [{purpose:'invite'},{confirmed:false},{contact:'other@example.org'}])expect(()=>f.p.cancelReset(f.session,{id:m.id,purpose:'factor',confirmed:true,...bad})).toThrow();
  f.p.cancelReset(f.session,{id:m.id,purpose:'factor',confirmed:true});expect(()=>f.p.preview(proof)).toThrow();expect(f.store.state.users.find(u=>u.id===m.id)!.enrolled).toBe(false);
  r=f.issue(m.id,'factor');proof=value(r.link);const issuer=f.store.state.users[0]!;issuer.authorizationGeneration=(issuer.authorizationGeneration??0)+1;expect(()=>f.p.begin(proof)).toThrow();
  proof=value(f.issue(m.id,'factor').link);f.store.state.sessions=[];const e=f.p.begin(proof);f.p.complete({...proof,code:totp(e.seed,Date.now()),saved:true});expect(f.store.state.users.find(u=>u.id===m.id)!.enrolled).toBe(true);
 }finally{f.close();}});
 it('legacy combined recovery can only be reissued, never consumed under new semantics',()=>{const f=setup();try{
  const m=f.add();f.recent();const proof=value(f.issue(m.id,'factor').link);const p=f.store.state.people!.proofs[0]!;delete p.version;delete p.assisted;delete f.store.state.users.find(u=>u.id===m.id)!.assistedFactorPending;
  expect(()=>f.p.begin({...proof,password})).toThrow();const next=value(f.issue(m.id,'factor').link);expect(()=>f.p.preview(proof)).toThrow();expect(f.p.preview(next).requiresPassword).toBe(false);
 }finally{f.close();}});
 it('atomically retains an enrolled Owner across competing MFA restrictions and role changes',async()=>{const f=setup();try{
  const o=f.add('Owner');f.clock.mockReturnValue(Date.now()+30000);const login=f.store.login('second-owner@example.org',password,totp(o.seed,Date.now())),session=f.store.session(login.token)!;f.recent();f.store.state.sessions.find(s=>s.id===session.id)!.recent={action:'people.recovery',expires:Date.now()+300000};
  const race=await Promise.allSettled([[f.session,o.id],[session,f.session.userId]].map(([session,id])=>Promise.resolve().then(()=>f.p.assist(session as typeof f.session,{id,purpose:'factor',channel:'in_person',verified:true,confirmed:true}))));expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(f.store.state.users.filter(u=>u.active&&u.enrolled!==false&&u.role==='Owner')).toHaveLength(1);
  f.store.state.sessions.find(s=>s.id===f.session.id)!.recent={action:'people.change',expires:Date.now()+300000};expect(()=>f.p.change(f.session,{id:f.session.userId,role:'Administrator',active:true,confirmed:true})).toThrow(/last active Owner/);
 }finally{f.close();}});
 it('rejects disabled, invited, unreviewed and external targets and serializes completion replay',async()=>{const f=setup();try{
  const m=f.add();f.recent();const u=f.store.state.users.find(u=>u.id===m.id)!;u.active=false;expect(()=>f.issue(m.id,'factor')).toThrow();f.store.state.users.find(u=>u.id===m.id)!.active=true;f.store.state.users.find(u=>u.id===m.id)!.enrolled=false;expect(()=>f.issue(m.id,'factor')).toThrow();f.store.state.users.find(u=>u.id===m.id)!.enrolled=true;
  const invite=f.p.invite(f.session,{email:'pending@example.org',role:'Member',confirmed:true});expect(()=>f.issue(invite.id,'factor')).toThrow();const e=f.p.register(f.session,{issuer:'https://issuer.example.org',subject:'synthetic',label:'External',confirmed:true});expect(()=>f.issue(e.id,'factor')).toThrow();
  const proof=value(f.issue(m.id,'factor').link),fresh=f.p.begin(proof);const race=await Promise.allSettled([1,2].map(()=>Promise.resolve().then(()=>f.p.complete({...proof,code:totp(fresh.seed,Date.now()),saved:true}))));expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 }finally{f.close();}});
});

it('version-2 managed startup retains reset authority and rejects unavailable enrollment material',()=>{const f=setup();let restarted:ConsoleStore|undefined;try{const m=f.add();f.recent();const proof=value(f.issue(m.id,'factor').link);expect(f.store.state.v).toBe(2);expect(loadManagedConfig(f.directory,f.keyFile).auth.mode).toBe('bearer');f.store.close();restarted=new ConsoleStore(f.directory,f.keyFile);const p=new ConsolePeople(restarted);expect(p.preview(proof).requiresPassword).toBe(false);expect(()=>p.confirmEnrollmentAuthority({...proof,proof:'wrong-proof-0000000000000000'})).toThrow();p.confirmEnrollmentAuthority(proof);restarted.journal.degraded=true;expect(()=>p.confirmEnrollmentAuthority(proof)).toThrow();}finally{restarted?.close();f.close();}});

it('a failed first format migration never admits an MFA restriction intent',()=>{const f=setup();let restarted:ConsoleStore|undefined;try{const m=f.add();f.recent();(f.store as unknown as {faultState:(phase?:string)=>void}).faultState=phase=>{if(phase==='before-rename')throw Error('synthetic migration failure');};expect(()=>f.issue(m.id,'factor')).toThrow(/uncertain/);expect(f.store.journal.entries().some(r=>r.action==='identity.factor_reset_issue')).toBe(false);f.store.close();restarted=new ConsoleStore(f.directory,f.keyFile);expect(restarted.state.users.find(u=>u.id===m.id)!.enrolled).toBe(true);expect(restarted.state.users.find(u=>u.id===m.id)!.seed).toBe(m.seed);}finally{restarted?.close();f.close();}});
