import { chromium,expect } from '@playwright/test';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { ConsoleStore } from '../dist/consoleStore.js';
import { totp } from '../dist/consoleCrypto.js';
import { validateConfig } from '../dist/config.js';
import { createGatewayServer } from '../dist/server.js';
import { consolePeople } from '../dist/consolePeople.js';
import { consoleNotifications } from '../dist/consoleNotifications.js';
import { consoleServices } from '../dist/consoleServices.js';
const directory=mkdtempSync(join(tmpdir(),'advanced-browser-')),evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/ux-acceptance/secretsauce-mcp/milestone27');mkdirSync(evidence,{recursive:true});
const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;let store,gateway,server,browser;const checks=[],errors=[];const password='Synthetic browser long passphrase 2026';
try{
process.env.AUDIT_STORAGE_DIR=join(directory,'audit');const key=join(directory,'key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'SYNTHETIC'}},services:{baseline:{name:'Assigned example',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[]}}}},{SYNTHETIC:'synthetic-browser-gateway'});
store=new ConsoleStore(join(directory,'console'),key,{config:cfg});gateway=createGatewayServer(cfg,{consoleStore:store});server=createServer({key:readFileSync(join(directory,'tls.key')),cert:readFileSync(join(directory,'tls.crt'))},(req,res)=>gateway.emit('request',req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://console.example.org:'+server.address().port;
const proof=store.issueProof(origin,clock-30000),setup=store.beginSetup({proof,name:'Example instance',origin,email:'owner@example.org',password},clock-30000);store.completeSetup(setup.token,totp(setup.seed,clock-30000),true,clock-30000);
browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP console.example.org 127.0.0.1','--no-proxy-server']});
async function context(){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};}
async function keyTo(page,target){const locator=typeof target==='string'?page.locator(target):target;for(let i=0;i<160;i++){if(await locator.evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Keyboard target unreachable: '+locator.toString());}
async function type(page,selector,value){await keyTo(page,selector);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);}
async function press(page,label){await keyTo(page,page.getByRole('button',{name:label,exact:true}));await page.keyboard.press('Enter');}
async function select(page,selector,value){await keyTo(page,selector);const options=await page.locator(selector+' option').evaluateAll(os=>os.map(o=>o.value));await page.keyboard.press('Home');for(let i=0;i<options.indexOf(value);i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');}
async function shot(page,name){await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,mask:[page.locator('input[type=password]'),page.locator('img')]});}
async function narrow(page,name){await page.setViewportSize({width:320,height:800});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow: '+name);await shot(page,name+'-320');await page.setViewportSize({width:1280,height:900});}
async function login(page,email,seed){await page.goto(origin+'/console');await type(page,'#email',email);await type(page,'#password',password);await type(page,'#code',totp(seed,clock));await press(page,'Sign in');await expect(page.getByRole('heading',{name:'Services',exact:true})).toBeVisible();}


const owner=await context();await login(owner.page,'owner@example.org',setup.seed);const page=owner.page;const manager=consoleServices(store),session=store.state.sessions.find(s=>s.userId===store.state.users[0].id);

await page.getByRole('link',{name:'Open Assigned example',exact:true}).click();
await expect(page.getByRole('heading',{name:'Connections',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Request policy',exact:true})).toBeVisible();await expect(page.getByText('Effective configuration values',{exact:true})).toHaveCount(0);await shot(page,'overview-desktop');await narrow(page,'overview');
store.commit('host','fixture.draft','services',state=>{const entry=state.managed.services.baseline;entry.draft={base:state.managed.revision,generation:1,content:structuredClone(entry.applied)};entry.draft.content.name='Pending name';});
await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByRole('heading',{name:'Saved changes are waiting for review',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Assigned example',exact:true})).toBeVisible();checks.push('Overview groups actual applied configuration independently from pending name; no flattened duplicate.');
store.state.users[0].role='Auditor';await page.reload();await page.getByRole('link',{name:'Open Assigned example',exact:true}).click();await page.getByRole('button',{name:'Configuration',exact:true}).click();await expect(page.getByRole('navigation',{name:'Configuration sections'})).toBeVisible();await expect(page.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Authentication',exact:true}).click();await expect(page.getByRole('heading',{name:'Authentication',exact:true})).toBeVisible();checks.push('Auditor has focused readable sections and no mutation affordances.');
store.state.users[0].role='Owner';store.commit('host','fixture.empty','services',state=>{delete state.managed.services.baseline.applied;state.managed.services.baseline.lifecycle='Draft';});await page.reload();await page.getByRole('link',{name:'Open Pending name',exact:true}).click();await expect(page.getByText('No configuration is in use. This service cannot run yet.',{exact:true})).toBeVisible();checks.push('Draft-only service never claims current executable configuration.');
await page.route('**/console/api/services/baseline',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Synthetic failure'})}));await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.locator('#errors')).not.toBeEmpty();await page.unroute('**/console/api/services/baseline');checks.push('Load failure surfaces error rather than empty success.');
if(errors.length)throw Error('Browser runtime errors: '+errors.join(';'));writeFileSync(join(evidence,'browser-report.json'),JSON.stringify({result:'PASS',checks},null,2)+'\n');console.log('Focused service browser PASS');
}finally{Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});}
