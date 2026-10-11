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
const directory=mkdtempSync(join(tmpdir(),'people-browser-')),evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/qa/secretsauce-mcp/milestone19');mkdirSync(evidence,{recursive:true});
const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;let store,gateway,server,browser;const checks=[],errors=[];const password='Synthetic browser long passphrase 2026';
try{
process.env.AUDIT_STORAGE_DIR=join(directory,'audit');const key=join(directory,'key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'SYNTHETIC'}},services:{baseline:{name:'Assigned example',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[]}}}},{SYNTHETIC:'synthetic-browser-gateway'});
store=new ConsoleStore(join(directory,'console'),key,{config:cfg});gateway=createGatewayServer(cfg,{consoleStore:store});server=createServer({key:readFileSync(join(directory,'tls.key')),cert:readFileSync(join(directory,'tls.crt'))},(req,res)=>gateway.emit('request',req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://console.example.org:'+server.address().port;
const proof=store.issueProof(origin,clock-30000),setup=store.beginSetup({proof,name:'Example instance',origin,email:'owner@example.org',password},clock-30000);store.completeSetup(setup.token,totp(setup.seed,clock-30000),true,clock-30000);
browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP console.example.org 127.0.0.1','--no-proxy-server']});
async function context(){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};}
async function keyTo(page,target){const locator=typeof target==='string'?page.locator(target):target;for(let i=0;i<160;i++){if(await locator.evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Keyboard target unreachable');}
async function type(page,selector,value){await keyTo(page,selector);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);}
async function press(page,label){await keyTo(page,page.getByRole('button',{name:label,exact:true}));await page.keyboard.press('Enter');}
async function select(page,selector,value){await keyTo(page,selector);const options=await page.locator(selector+' option').evaluateAll(os=>os.map(o=>o.value));await page.keyboard.press('Home');for(let i=0;i<options.indexOf(value);i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');}
async function shot(page,name){await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,mask:[page.locator('input[type=password]'),page.locator('code'),page.locator('pre'),page.locator('img')]});}
async function narrow(page,name){await page.setViewportSize({width:320,height:800});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow: '+name);await shot(page,name+'-320');await page.setViewportSize({width:1280,height:900});}
async function login(page,email,seed){await page.goto(origin+'/console');await type(page,'#email',email);await type(page,'#password',password);await type(page,'#code',totp(seed,clock));await press(page,'Sign in');await expect(page.getByRole('heading',{name:'Services',exact:true})).toBeVisible();}

async function reflow(page,name){for(const width of [1280,320]){await page.setViewportSize({width,height:900});for(const zoom of [1,2]){await page.evaluate(z=>{const elements=[...document.querySelectorAll('h1,h2,p,label,button,input,select,code,pre')];const sizes=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));elements.forEach((e,i)=>{e.style.fontSize=(sizes[i]*z)+'px';});},zoom);const overflow=await page.evaluate(()=>{const bad=[];if(document.documentElement.scrollWidth>innerWidth+1)bad.push('document');for(const e of document.querySelectorAll('h1,h2,p,label,button,code')){if(!e.getClientRects().length)continue;const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.left< -1||b.right>innerWidth+1)bad.push(e.tagName);}}return bad;});if(overflow.length)throw Error('Text overflow '+name+' '+width+' '+zoom+' '+overflow.join(','));}await page.evaluate(()=>{document.documentElement.style.fontSize='';for(const e of document.querySelectorAll('[style]'))e.style.fontSize='';});}await page.setViewportSize({width:1280,height:900});checks.push('Document and text-range reflow at desktop/320px and 200% text: '+name);}
const owner=await context();await login(owner.page,'owner@example.org',setup.seed);const page=owner.page;
await press(page,'Settings');clock+=30000;
await type(page,'#smtp-host','smtp.example.org');await type(page,'#smtp-sender','console@example.org');await type(page,'#smtp-password','synthetic-browser-smtp');await press(page,'Save SMTP draft');await expect(page.locator('#banner')).toContainText('SMTP draft saved');
async function apply(){clock+=30000;await press(page,'Review SMTP draft');await type(page,'#notifications-apply-password',password);await type(page,'#notifications-apply-code',totp(setup.seed,clock));await press(page,'Confirm and continue');await expect(page.locator('#banner')).toContainText('SMTP settings applied');}
async function confirmDelete(){clock+=30000;await type(page,'#notifications-delete-password',password);await type(page,'#notifications-delete-code',totp(setup.seed,clock));await press(page,'Confirm and continue');}
await apply();await expect(page.locator('#smtp-clear')).toHaveCount(0);const revision=store.state.notifications.revision;
await press(page,'Delete SMTP credential');await reflow(page,'delete-confirmation');await shot(page,'delete-confirmation');await press(page,'Cancel');if(store.state.notifications.revision!==revision)throw Error('Cancel mutated state');await expect(page.getByRole('button',{name:'Delete SMTP credential',exact:true})).toBeFocused();
await press(page,'Delete SMTP credential');await confirmDelete();await expect(page.getByRole('alert')).toContainText('Disable email delivery');if(!store.state.notifications.applied.password)throw Error('Enabled delete removed value');
await press(page,'Settings');await keyTo(page,'#smtp-enabled');await page.keyboard.press('Space');await press(page,'Save SMTP draft');await expect(page.locator('#banner')).toContainText('SMTP draft saved');await apply();if(!store.state.notifications.applied.password||store.state.notifications.applied.enabled!==false)throw Error('Disable lost configuration');
await press(page,'Delete SMTP credential');await confirmDelete();await expect(page.locator('#banner')).toContainText('SMTP credential deleted');if(store.state.notifications.applied.password!=='')throw Error('Value retained');await expect(page.locator('#smtp-host')).toHaveValue('smtp.example.org');await expect(page.getByRole('button',{name:'Delete SMTP credential',exact:true})).toHaveCount(0);await reflow(page,'deleted-settings');await shot(page,'deleted-settings');
if(!await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0))throw Error('Stored browser material');
checks.push('Actual HTTPS keyboard save/review/apply; enabled dependency rejected; disable retains credential; cancel unchanged with focus return; independent delete retains configuration; secret field blank and browser storage empty');
if(errors.length)throw Error('Browser runtime errors');writeFileSync(join(evidence,'smtp-deletion-browser-report.json'),JSON.stringify({result:'PASS',transport:'Actual HTTPS loopback using example.org mapping',checks},null,2)+'\n');console.log('M19 SMTP deletion browser PASS');
}finally{Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});}
