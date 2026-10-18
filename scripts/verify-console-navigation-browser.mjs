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
const directory=mkdtempSync(join(tmpdir(),'advanced-browser-')),evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/ux-acceptance/secretsauce-mcp/milestone33');mkdirSync(evidence,{recursive:true});
const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;let store,gateway,server,browser;const checks=[],errors=[];const password='Synthetic browser long passphrase 2026';
try{
process.env.AUDIT_STORAGE_DIR=join(directory,'audit');const key=join(directory,'key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'SYNTHETIC'}},services:{baseline:{name:'Assigned example',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[]}}}},{SYNTHETIC:'synthetic-browser-gateway'});
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


await page.getByRole('link',{name:'Open Assigned example',exact:true}).click();
await page.getByRole('button',{name:'Access',exact:true}).click();await expect(page).toHaveURL(/tab=Access/);await page.goBack();await expect(page.getByRole('heading',{name:'Connections',exact:true})).toBeVisible();await page.goForward();await expect(page.getByRole('heading',{name:'People who can use this service'})).toBeVisible();
await page.getByRole('button',{name:'Configuration',exact:true}).click();await page.locator('#service-description').fill('Preserved in memory');await page.getByRole('link',{name:'Advanced',exact:true}).click();const exact=await page.locator('#advanced-json').inputValue();await page.locator('#advanced-json').fill(exact+'  ');await page.goBack();await expect(page.locator('#service-description')).toHaveValue('Preserved in memory');await page.goForward();await expect(page.locator('#advanced-json')).toHaveValue(exact+'  ');
await page.getByRole('link',{name:'Guided',exact:true}).click();await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.locator('#service-edit-state')).toContainText('Saved draft');await page.getByRole('link',{name:'Destinations',exact:true}).click();await page.reload();await expect(page.locator('#destination-url-0')).toBeVisible();await expect(page).toHaveURL(/edit=1/);
await page.goto(origin+'/console?service=baseline&tab=Overview');await page.getByRole('button',{name:'Configuration',exact:true}).click();await page.locator('#service-name').fill('Keep this name');await page.goBack();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Stay',exact:true}).click();await expect(page.locator('#service-name')).toHaveValue('Keep this name');
await page.getByRole('button',{name:'Back to Services',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();await page.goto(origin+'/console?service=baseline&edit=2&mode=guided');await expect(page.locator('#authentication-mode')).toBeVisible();await page.goto(origin+'/console?service=baseline&edit=bad');await expect(page.locator('#errors')).toContainText('Unknown configuration');await page.goto(origin+'/console?service=baseline&tab=Access');await expect(page.getByRole('heading',{name:'People who can use this service'})).toBeVisible();
checks.push('Actual Back/Forward preserves tab, section and safe edits; deep links and refresh restore saved location; dirty Stay and Discard work; malformed section has explicit error.');
store.state.users[0].role='Auditor';await page.goto(origin+'/console?service=baseline&tab=Configuration&section=2&mode=guided');await expect(page.getByRole('heading',{name:'Authentication',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Destinations',exact:true}).click();await page.goBack();await expect(page.getByRole('heading',{name:'Authentication',exact:true})).toBeVisible();
store.state.users[0].role='Member';await page.goto(origin+'/console?service=baseline&edit=2');await expect(page.locator('#authentication-mode')).toHaveCount(0);checks.push('Auditor readonly history and Member cannot inspect editor.');
store.state.users[0].role='Owner';await page.goto(origin+'/console?service=baseline&edit=3&mode=guided');
if(!await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&!JSON.stringify(history.state).includes('Preserved')))throw Error('Persistent editing state');
if(errors.length)throw Error('Browser runtime errors: '+errors.join(';'));writeFileSync(join(evidence,'browser-report.json'),JSON.stringify({result:'PASS',checks},null,2)+'\n');console.log('Service navigation browser PASS');
}finally{Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});}
