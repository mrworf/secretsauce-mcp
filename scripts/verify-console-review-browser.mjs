import { createHash } from 'node:crypto';
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
const directory=mkdtempSync(join(tmpdir(),'advanced-browser-')),evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/ux-acceptance/secretsauce-mcp/milestone35/final');mkdirSync(evidence,{recursive:true});
const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;let store,gateway,server,browser;const checks=[],errors=[];const password='Synthetic browser long passphrase 2026';
try{
process.env.AUDIT_STORAGE_DIR=join(directory,'audit');const key=join(directory,'key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'SYNTHETIC'}},services:{baseline:{name:'Container manager',description:'Container API',no_auth:false,credentials:[{id:'api_key',usage:{kind:'header',name:'X-API-Key',prefix:'',suffix:'',enforce:true},source:{kind:'env',name:'EXAMPLE_KEY'}}],destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[{id:'old',effect:'deny',priority:1000,methods:['POST'],paths:['/api/legacy/settings'],reason:'Block legacy settings'}]}}}},{SYNTHETIC:'synthetic-browser-gateway',EXAMPLE_KEY:'synthetic-only-sensitive-value'});
store=new ConsoleStore(join(directory,'console'),key,{config:cfg});gateway=createGatewayServer(cfg,{consoleStore:store});server=createServer({key:readFileSync(join(directory,'tls.key')),cert:readFileSync(join(directory,'tls.crt'))},(req,res)=>gateway.emit('request',req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://console.example.org:'+server.address().port;
const proof=store.issueProof(origin,clock-30000),setup=store.beginSetup({proof,name:'Example instance',origin,email:'owner@example.org',password},clock-30000);store.completeSetup(setup.token,totp(setup.seed,clock-30000),true,clock-30000);
browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP console.example.org 127.0.0.1','--no-proxy-server']});
async function context(){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1031}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};}
async function keyTo(page,target){const locator=typeof target==='string'?page.locator(target):target;for(let i=0;i<160;i++){if(await locator.evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Keyboard target unreachable: '+locator.toString());}
async function type(page,selector,value){await keyTo(page,selector);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);}
async function press(page,label){await keyTo(page,page.getByRole('button',{name:label,exact:true}));await page.keyboard.press('Enter');}
async function select(page,selector,value){await keyTo(page,selector);const options=await page.locator(selector+' option').evaluateAll(os=>os.map(o=>o.value));await page.keyboard.press('Home');for(let i=0;i<options.indexOf(value);i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');}
async function shot(page,name){await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,mask:[page.locator('input[type=password]'),page.locator('img')]});}
async function narrow(page,name){await page.setViewportSize({width:390,height:844});await shot(page,name+'-390');await page.setViewportSize({width:320,height:800});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow: '+name);await shot(page,name+'-320');await page.setViewportSize({width:1440,height:1031});}
async function text200(page,name){await page.setViewportSize({width:320,height:800});await page.evaluate(()=>{window.textSizes=[...document.querySelectorAll('body *')].map(n=>[n,n.style.fontSize,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,,size] of window.textSizes)n.style.fontSize=(size*2)+'px';});const issues=await page.evaluate(()=>{const bad=[];if(document.documentElement.scrollWidth>innerWidth)bad.push('document');const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||!n.parentElement.checkVisibility()||n.parentElement.closest('textarea,pre,script,style,.skip:not(:focus)'))continue;const r=document.createRange();r.selectNodeContents(n);for(const box of r.getClientRects())if(box.width&&(box.left< -1||box.right>innerWidth+1))bad.push(n.parentElement.tagName);}return bad;});if(issues.length)throw Error('200% text overflow: '+issues.join(','));await shot(page,name+'-320-text200');await page.evaluate(()=>{for(const [n,size] of window.textSizes)n.style.fontSize=size;delete window.textSizes;});await page.setViewportSize({width:1440,height:1031});}
async function login(page,email,seed){await page.goto(origin+'/console');await type(page,'#email',email);await type(page,'#password',password);await type(page,'#code',totp(seed,clock));await press(page,'Sign in');await expect(page.getByRole('heading',{name:'Services',exact:true})).toBeVisible();}


const owner=await context();await login(owner.page,'owner@example.org',setup.seed);const page=owner.page;const manager=consoleServices(store),session=store.state.sessions.find(s=>s.userId===store.state.users[0].id);



await page.goto(origin+'/console?service=baseline&edit=0&mode=guided');
await page.locator('#service-description').fill('Manage containers and view server health');
await page.getByRole('link',{name:'Advanced',exact:true}).click();
const proposed=JSON.parse(await page.locator('#advanced-json').inputValue());
proposed.destinations[0].base_url='https://containers.example.org';proposed.destinations[0].hosts=[{exact:'containers.example.org'}];
proposed.policy.rules=[{id:'settings',effect:'deny',priority:1000,methods:['POST','PUT','CUSTOM'],paths:['^/api/settings(?:/.*)?$'],reason:'Protect server settings',binary_response:{scan:false,max_size:'1kb'}}];
await page.locator('#advanced-json').fill(JSON.stringify(proposed,null,2));await page.getByRole('button',{name:'Return to guided forms',exact:true}).click();
await page.getByRole('button',{name:'Review & apply',exact:true}).click();
await expect(page.getByRole('tab')).toHaveText(['New settings','Changes']);
await expect(page.getByRole('tab',{name:'New settings',exact:true})).toHaveAttribute('aria-selected','true');
await expect(page.locator('#review-panel-1')).toContainText('Manage containers and view server health');
const snapshot=JSON.stringify(store.state.managed);
await page.getByRole('tab',{name:'New settings',exact:true}).focus();await page.keyboard.press('ArrowRight');
await expect(page.getByRole('tab',{name:'Changes',exact:true})).toBeFocused();await expect(page.locator('#review-panel-1')).toBeVisible();
await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'New settings',exact:true})).toBeFocused();
await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'Changes',exact:true})).toBeFocused();
await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'New settings',exact:true})).toBeFocused();await expect(page.locator('#review-panel-0')).toBeVisible();
await page.keyboard.press('End');await expect(page.locator('#review-panel-1')).toBeVisible();
if(snapshot!==JSON.stringify(store.state.managed))throw Error('Tabs mutated review');
await shot(page,'changes-desktop');await narrow(page,'changes');await text200(page,'changes');
await page.getByRole('tab',{name:'New settings',exact:true}).click();
const rendered=await page.locator('#review-panel-0 code').allTextContents();const expected=[];function leaves(v){if(v===null||typeof v!=='object'){expected.push(typeof v==='string'?JSON.stringify(v):String(v));return;}if(!Object.keys(v).length){expected.push(Array.isArray(v)?'[]':'{}');return;}for(const child of Object.values(v))leaves(child);}leaves(store.state.managed.services.baseline.review.candidate);if(JSON.stringify(rendered.sort())!==JSON.stringify(expected.sort()))throw Error('Complete proposal lost or invented literal values');
await expect(page.locator('#review-panel-1')).not.toContainText('X-API-Key');
await expect(page.locator('#review-panel-0')).toContainText('CUSTOM');await expect(page.locator('#review-panel-0')).toContainText('false');await expect(page.locator('#review-panel-0')).toContainText('^/api/settings(?:/.*)?$');
await shot(page,'new-desktop');await narrow(page,'new');await text200(page,'new');
if(snapshot!==JSON.stringify(store.state.managed))throw Error('New settings mutated review');
if((await page.locator('body').innerText()).includes('synthetic-only-sensitive-value'))throw Error('Review exposed credential');
await page.getByRole('button',{name:'Back to edit',exact:true}).click();await expect(page.locator('#service-edit-state')).not.toContainText('Unsaved');
checks.push('Guided saved draft reaches New settings first; all four keyboard navigation keys follow visible tab order; keyboard tabs are read-only and preserve exact bound server review; returning to edit does not dirty.');
// Existing apply checks stay authoritative after tab navigation.
await page.getByRole('button',{name:'Review & apply',exact:true}).click();
await page.getByRole('button',{name:'Approve changes',exact:true}).click();
const bound=store.state.managed.services.baseline.review;
await page.locator('.service-approval input[type=checkbox]').check();store.state.managed.revision++;
await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.approval-status')).toContainText('Stale');await page.getByRole('button',{name:'Close',exact:true}).click();
store.state.managed.revision--;store.state.users[0].role='Auditor';
let denied=false;try{manager.review(session,{id:'baseline'});}catch{denied=true;}if(!denied)throw Error('Read-only review allowed');store.state.users[0].role='Owner';
checks.push('Guided plus Advanced exact custom methods/regex/binary options retained in both views; stale apply and Auditor review rejected.');
// Isolated rendering boundaries do not perform writes or leak secret-bearing storage.
await page.evaluate(()=>{renderReview({...serviceEditor.detail,review:'synthetic',current:null,proposed:{name:'New service',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}]},scope:{services:['baseline'],settings:[]},base:0,grants:[],exceptions:[],disruption:''});});
await expect(page.locator('#review-panel-1')).toContainText('No active configuration yet');
await page.evaluate(()=>{const data={name:'Same',no_auth:true};renderReview({review:'synthetic',current:data,proposed:data,scope:{services:['baseline'],settings:[]},base:0,grants:[],exceptions:[],disruption:''});});await expect(page.locator('#review-panel-1')).toContainText('No configuration changes');await page.getByRole('tab',{name:'New settings'}).click();await expect(page.locator('#review-panel-0')).toContainText('Same');
if(!await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0))throw Error('Persistent review storage');
checks.push('No-baseline additions/no-change full proposal reachable; no browser persistent review state.');
await page.evaluate(()=>{const proposed=JSON.parse('{"name":"Typed boundary","custom":{"mode":false,"__proto__":0,"constructor":null,"empty":"","array":[],"object":{},"text":"Removed","ordered":["second","first"]}}');renderReview({review:'synthetic',current:{name:'Typed boundary'},proposed,scope:{services:['baseline'],settings:[]},base:0,grants:[],exceptions:[],disruption:''});});
await page.getByRole('tab',{name:'New settings'}).click();const typed=await page.locator('#review-panel-0').innerText();for(const literal of ['mode','__proto__','constructor','false','0','null','""','[]','{}','"Removed"','"second", "first"'])if(!typed.includes(literal))throw Error('Typed proposal lost literal');
checks.push('Renderer boundary preserves typed false/zero/null/empty collections/text markers, exact custom own-property names and array order.');

if(errors.length)throw Error('Browser runtime errors: '+errors.join(';'));writeFileSync(join(evidence,'browser-report.json'),JSON.stringify({result:'PASS',checks},null,2)+'\n');console.log('Service review browser PASS');
}finally{Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});}
