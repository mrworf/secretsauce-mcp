import {describe,it,expect,vi} from 'vitest';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import ts from 'typescript';
import {managedFixture} from './consoleManagementFixtures.js';
import {ConsoleStore} from '../src/consoleStore.js';
import {projectRecoveryState} from '../src/consoleBackupArchive.js';
import {validateRecoveryDomains} from '../src/consoleBackupSchema.js';

describe('saved proposal dependency fencing',()=>{
 it('rejects stale save/discard after recreation without invalidating a different draft',()=>{const f=managedFixture();try{
 const m=f.manager,base=m.state.revision,service={name:'First proposal'};
 m.save(f.session,{id:'first',base,generation:0,service});m.save(f.session,{id:'second',base,generation:0,service});
 const stale={id:'first',base,generation:1,confirmed:true};m.discard(f.session,stale);
 expect(()=>m.save(f.session,{id:'first',base,generation:0,service})).toThrow('Stale');
 const generation=m.detail(f.session,'first').generation;expect(generation).toBe(2);
 m.save(f.session,{id:'first',base,generation,service:{name:'Replacement proposal'}});
 expect(()=>m.discard(f.session,stale)).toThrow('Stale');expect(()=>m.save(f.session,{id:'first',base,generation:1,service})).toThrow('Stale');
 expect(()=>m.save(f.session,{id:'second',base,generation:1,service})).not.toThrow();
 m.lifecycle(f.session,{id:'first',action:'archive',confirmed:true});const archived=m.detail(f.session,'first');const before=structuredClone(m.state.services.first);m.discard(f.session,{id:'first',base:archived.revision,generation:archived.generation,confirmed:true});expect(m.state.services.first!.draft).toBeUndefined();expect(m.state.services.first).toMatchObject({lifecycle:'Archived',values:before!.values,assignments:before!.assignments});
 }finally{f.close();}});
 it('preserves portable identity metadata and rejects invalid retained generations',()=>{const f=managedFixture();try{
 f.manager.save(f.session,{id:'first',base:0,generation:0,service:{name:'Retained label'}});f.manager.discard(f.session,{id:'first',base:0,generation:1,confirmed:true});
 const snapshot=projectRecoveryState(f.store.state);expect(snapshot.managed.services.first).toMatchObject({displayName:'Retained label',proposalGeneration:2});expect(()=>validateRecoveryDomains(snapshot)).not.toThrow();snapshot.managed.services.first!.proposalGeneration=-1;expect(()=>validateRecoveryDomains(snapshot)).toThrow();
 }finally{f.close();}});
 it('reports uncertain completion and reads durable discarded state on restart',()=>{const f=managedFixture();try{
 f.manager.save(f.session,{id:'first',base:0,generation:0,service:{name:'Retained label'}});f.store.commit(f.session.userId,'service.proposal_format_upgrade','instance',state=>{state.v=6;});
 const finish=vi.spyOn(f.store.journal,'finish').mockImplementation(()=>{throw Error('synthetic completion failure');});expect(()=>f.manager.discard(f.session,{id:'first',base:0,generation:1,confirmed:true})).toThrow('uncertain');finish.mockRestore();f.store.close();const reopened=new ConsoleStore(f.directory,f.keyFile);expect(reopened.state.managed!.services.first).toMatchObject({displayName:'Retained label',proposalGeneration:2});expect(reopened.state.managed!.services.first!.draft).toBeUndefined();reopened.close();
 }finally{f.close();}});
 it('reaches the pinned prior reader and rejects v6 without modifying the envelope',()=>{const f=managedFixture(),old=resolve('dist/consoleStore-m47-old.js');try{
 f.manager.save(f.session,{id:'first',base:0,generation:0,service:{name:'Retained label'}});f.manager.discard(f.session,{id:'first',base:0,generation:1,confirmed:true});f.store.close();const before=readFileSync(f.store.file,'utf8');writeFileSync(old,ts.transpileModule(readFileSync('test/fixtures/m47/consoleStore-v5.ts.txt','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 const result=execFileSync(process.execPath,['--input-type=module','-e',`import {ConsoleStore} from ${JSON.stringify('file://'+old)};console.log('reader reached');try{new ConsoleStore(process.argv[1],process.argv[2]);process.exit(9);}catch(e){if(!e.message.includes('Managed storage unavailable'))throw e;console.log('unsupported format rejected');}`,f.directory,f.keyFile],{encoding:'utf8'});expect(result).toContain('reader reached');expect(result).toContain('unsupported format rejected');expect(readFileSync(f.store.file,'utf8')).toBe(before);
 }finally{rmSync(old,{force:true});f.close();}});
});
