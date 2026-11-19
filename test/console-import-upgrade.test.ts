import {it,expect,vi} from 'vitest';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import ts from 'typescript';
import {managedFixture} from './consoleManagementFixtures.js';
import {ConsoleStore} from '../src/consoleStore.js';
import {importConfiguration} from '../src/consoleMigration.js';
import {retireLegacyImportMappings} from '../src/consoleImportState.js';
it('rejects v7 using the actual pinned v6 reader without replacing its envelope',()=>{const f=managedFixture(),old=resolve('dist/consoleStore-m48-old.js');try{
 importConfiguration(f.manager,f.session,{base:0,gateway:'auth: {mode: bearer, bearer: {token_env: UNREAD}}\nservices: {new: {name: New, no_auth: true, destinations: [{id: primary, base_url: \"https://api.example.org\"}]}}',secretlint:'',sensitiveNames:'',credentials:[],confirmed:true});f.store.close();const before=readFileSync(f.store.file,'utf8');writeFileSync(old,ts.transpileModule(readFileSync('test/fixtures/m48/consoleStore-v6.ts.txt','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 const result=execFileSync(process.execPath,['--input-type=module','-e',`import {ConsoleStore} from ${JSON.stringify('file://'+old)};console.log('reader reached');try{new ConsoleStore(process.argv[1],process.argv[2]);process.exit(9);}catch(e){if(!e.message.includes('Managed storage unavailable'))throw e;console.log('unsupported format rejected');}`,f.directory,f.keyFile],{encoding:'utf8'});expect(result).toContain('unsupported format rejected');expect(readFileSync(f.store.file,'utf8')).toBe(before);
 }finally{rmSync(old,{force:true});f.close();}});
it('does not repeat retirement or remove selections made after metadata retirement',()=>{const f=managedFixture();try{
 const s=f.manager.state.services.baseline!;s.draft={content:structuredClone(s.applied!),base:0,generation:1,missingMappings:['old']};retireLegacyImportMappings(f.manager.state);const first=structuredClone(s);retireLegacyImportMappings(f.manager.state);expect(s).toEqual(first);
 }finally{f.close();}});
it('fails closed before legacy upgrade admission and exposes uncertain durable retirement on restart',()=>{const f=managedFixture();try{
 f.manager.save(f.session,{id:'legacy',base:0,generation:0,service:{name:'Legacy'}});f.store.commit(f.session.userId,'fixture.legacy','legacy',s=>{s.managed!.services.legacy!.draft!.missingMappings=['old'];});f.store.close();
 const diagnostic=new ConsoleStore(f.directory,f.keyFile,{faultAudit:()=>{throw Error('synthetic unavailable');}});expect(diagnostic.journal.degraded).toBe(true);expect(diagnostic.state.managed!.services.legacy!.draft!.missingMappings).toEqual(['old']);expect(()=>diagnostic.requireSensitive(f.session)).toThrow();diagnostic.close();
 const reopened=new ConsoleStore(f.directory,f.keyFile);expect(reopened.state.managed!.services.legacy!.draft!.missingMappings).toBeUndefined();expect(reopened.state.managed!.services.legacy!.importAccessReset).toBe(true);reopened.close();
 }finally{f.close();}});
