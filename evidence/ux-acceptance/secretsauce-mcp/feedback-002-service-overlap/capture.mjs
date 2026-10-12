import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConsoleStore } from '/work/dist/consoleStore.js';
import { totp } from '/work/dist/consoleCrypto.js';
import { validateConfig } from '/work/dist/config.js';
import { createGatewayServer } from '/work/dist/server.js';
import { consoleServices } from '/work/dist/consoleServices.js';
const directory=mkdtempSync(join(tmpdir(),'console-services-browser-'));
const evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/qa/secretsauce-mcp/milestone11');mkdirSync(evidence,{recursive:true});
const savedNow=Date.now;let clock=savedNow();Date.now=()=>clock;
let store,gateway,server,browser;const checks=[];let setupMilliseconds;
try{
 process.env.AUDIT_STORAGE_DIR=join(directory,'audit');const key=join(directory,'console.key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
 const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'BROWSER_SYNTHETIC'}},services:{example:{name:'Baseline example',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],access:{users:[]},policy:{mode:'deny',rules:[]}}}},{BROWSER_SYNTHETIC:'synthetic-browser-gateway'});
 store=new ConsoleStore(join(directory,'console'),key,{config:cfg});gateway=createGatewayServer(cfg,{consoleStore:store});
 server=createServer({key:readFileSync(join(directory,'tls.key')),cert:readFileSync(join(directory,'tls.crt'))},(req,res)=>gateway.emit('request',req,res));server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://console.example.org:'+server.address().port;
 const password='Synthetic browser long passphrase 2026';const proof=store.issueProof(origin,clock-30000);const enrolled=store.beginSetup({proof,name:'Example instance',origin,email:'owner@example.org',password},clock-30000);store.completeSetup(enrolled.token,totp(enrolled.seed,clock-30000),true,clock-30000);
 browser=await chromium.launch({headless:true,executablePath:'/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--host-resolver-rules=MAP console.example.org 127.0.0.1','--no-proxy-server']});const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900},locale:'en-US',timezoneId:'UTC',colorScheme:'light',reducedMotion:'reduce'});const page=await context.newPage();const failures=[];page.on('pageerror',e=>failures.push(e.message));
 async function keyboardTo(target){const locator=typeof target==='string'?page.locator(target):target;for(let i=0;i<150;i++){if(await locator.evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Keyboard target unreachable');}
 async function type(selector,value){await keyboardTo(selector);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);}
 async function press(label){await keyboardTo(page.getByRole('button',{name:label,exact:true}));await page.keyboard.press('Enter');}
 async function select(selector,value){await keyboardTo(selector);const options=await page.locator(selector+' option').evaluateAll(os=>os.map(o=>o.value));await page.keyboard.press('Home');for(let i=0;i<options.indexOf(value);i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');}
 async function bounded(){if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow');}
 async function shot(name){await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,mask:[page.locator('input[type=password]')]});}
 async function narrow(name){await page.setViewportSize({width:320,height:800});await bounded();await shot(name+'-320');await page.setViewportSize({width:1280,height:900});}
 await page.goto(origin+'/console');await type('#email','owner@example.org');await type('#password',password);await type('#code',totp(enrolled.seed,clock));await press('Sign in');await expect(page.getByRole('heading',{name:'Services',exact:true})).toBeVisible();

 const observations=[];
 async function capture(step){for(const width of [1280,320]){await page.setViewportSize({width,height:900});await page.screenshot({path:join(evidence,'screenshots',step+'-'+width+'.png'),fullPage:true});observations.push({step,width,geometry:await page.locator('.steps').evaluate(e=>({list:e.getBoundingClientRect().toJSON(),items:[...e.children].map(li=>({text:li.textContent,box:li.getBoundingClientRect().toJSON(),marker:getComputedStyle(li,'::marker').content})),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}))});}await page.setViewportSize({width:1280,height:900});}
 await press('Add service');await capture('details');await page.locator('#service-id').fill('sample');await page.locator('#service-name').fill('Sample service');await press('Continue');await capture('destination');await page.locator('#destination-url-0').fill('https://api.example.org');await press('Continue');await capture('authentication');
 writeFileSync(join(evidence,'observations.json'),JSON.stringify({browserVersion:browser.version(),observations},null,2));
}finally{Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});}
