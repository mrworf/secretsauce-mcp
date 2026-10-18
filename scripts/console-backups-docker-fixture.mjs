// Disposable synthetic backup acceptance fixture. No credentials/proofs/bodies are printed.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {ConsoleStore,readConsoleKey,loadManagedConfig} from '/app/dist/consoleStore.js';
import {validateConfig} from '/app/dist/config.js';
import {totp,encrypt} from '/app/dist/consoleCrypto.js';
import {GatewayRuntime} from '/app/dist/runtime.js';
import {createGatewayServer} from '/app/dist/server.js';
import {consoleBackups} from '/app/dist/consoleBackups.js';
import {verifyRecoveryArchiveInWorker} from '/app/dist/consoleBackupExecutor.js';
const mode=process.argv[2],origin='https://console.example.org',password='Synthetic Docker backup lengthy passphrase 2026';
try{
 if(mode==='seed'){
 const cfg=validateConfig({server:{listen:'0.0.0.0:8080',resource:origin},audit:{file:'/audit/gateway.jsonl'},auth:{mode:'bearer',bearer:{token_env:'SYNTHETIC'}},services:Object.fromEntries(Array.from({length:100},(_,i)=>['service'+i,{name:'Synthetic '+i,destinations:[{id:'primary',base_url:'https://api.example.org'}],credentials:[{id:'key',source:{kind:'env',name:'KEY'},usage:{kind:'header',name:'X-Api-Key'}}],access:{users:[]},policy:{mode:'allow',rules:[]}}]))},{SYNTHETIC:'synthetic-docker-bearer',KEY:'synthetic-retained-business-value'});
 const store=new ConsoleStore('/state','/keys/console.key',{config:cfg}),now=Date.now()-60000,setup=store.beginSetup({proof:store.issueProof(origin,now),name:'Docker backup acceptance',origin,email:'owner@example.org',password},now);store.completeSetup(setup.token,totp(setup.seed,now),true,now);store.commit('host','fixture.assign','instance',s=>{for(const service of Object.values(s.config.services))service.access.users=[s.users[0].id];});writeFileSync('/state/fixture.enc',encrypt({material:setup.backupMaterial},readConsoleKey('/keys/console.key')),{mode:0o600});store.close();console.log('PASS synthetic encrypted source seeded');
 }else if(mode==='serve'){
 const store=new ConsoleStore('/state','/keys/console.key',{config:loadManagedConfig('/state','/keys/console.key')}),runtime=new GatewayRuntime(store.state.config),server=createGatewayServer(store.state.config,{runtime,consoleStore:store,closeRuntimeOnServerClose:false}),backups=consoleBackups(store);
 if(!existsSync('/control/workload.seeded')){for(let i=0;i<10000;i++)runtime.auditSink.record({type:'service_request',request_id:'retained-'+i,subject:store.state.users[0].id,service:'service'+(i%100),destination:'primary',access_ids:[],internal_reference_ids:[],method:'GET',target_host:'api.example.org',target_path:'/synthetic',policy_decision:'allow',request_timestamp:new Date().toISOString(),request_duration_ms:1,tls_verify:true,secret_tokenization_count:0});assert.equal(runtime.auditSink.degraded,false);writeFileSync('/control/workload.seeded','complete');}
 backups.fault=phase=>{if(existsSync('/control/phase')&&readFileSync('/control/phase','utf8')===phase){writeFileSync('/control/reached',phase);process.kill(process.pid,'SIGKILL');}};
 server.listen(8080,'0.0.0.0');const close=()=>{server.close();runtime.close().finally(()=>{store.close();process.exit(0);});};process.on('SIGTERM',close);process.on('SIGINT',close);
 }else if(mode==='verify'){
 let input='';for await(const chunk of process.stdin)input+=chunk;const {material,wrong}=JSON.parse(input),archive=readFileSync('/cipher/archive.ssbackup','utf8');
 if(wrong){await assert.rejects(verifyRecoveryArchiveInWorker(archive,material));console.log('PASS clean host rejects wrong material');}
 else{const p=await verifyRecoveryArchiveInWorker(archive,material);assert.equal(Object.keys(p.state.config.services).length,process.env.M34_CREDENTIAL_RECOVERY==='1'?99:100);if(process.env.M34_CREDENTIAL_RECOVERY==='1'){const v=p.state.managed.services.service1.values.key;assert.equal(v.missing,true);assert.equal(v.value,'');assert(v.generation>0);assert.equal(p.manifest.credentials.find(c=>c.service==='service1').generation,v.generation);}assert.equal(p.manifest.credentials.length,100);assert(p.audit.gateway&&p.manifest.auditBoundary.find(x=>x.domain==='gateway').records>=10000);assert.equal(p.state.gatewayAuditIdentity,p.audit.gateway.identity);assert(!JSON.stringify(p).includes('synthetic-docker-bearer'));assert(!Object.hasOwn(p.state,'sessions'));assert(!Object.hasOwn(p.state.users[0],'seed'));console.log('PASS clean host verifies complete archive with independent material only');}
 }
}catch(e){console.error('Backup Docker fixture failed at '+mode+' ('+e.name+'); credentials, proofs and bodies omitted');process.exitCode=1;}
