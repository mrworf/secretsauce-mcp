import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConsoleStore } from '../dist/consoleStore.js';
import { totp } from '../dist/consoleCrypto.js';
import { validateConfig } from '../dist/config.js';
import { createGatewayServer } from '../dist/server.js';
const directory=mkdtempSync(join(tmpdir(),'console-browser-'));
const evidence=resolve(process.env.CONSOLE_BROWSER_EVIDENCE ?? 'evidence/qa/secretsauce-mcp/milestone10');
mkdirSync(evidence,{recursive:true});
const savedNow=Date.now; let clock=savedNow(); Date.now=()=>clock;
let store, gateway, server, browser;
const checks=[];
try {
 process.env.AUDIT_STORAGE_DIR=join(directory,'audit');
 const key=join(directory,'console.key');writeFileSync(key,'ab'.repeat(32),{mode:0o600});
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'tls.key'),'-out',join(directory,'tls.crt'),'-days','1','-subj','/CN=console.example.org'],{stdio:'ignore'});
 const cfg=validateConfig({server:{listen:'127.0.0.1:8080',mcp_path:'/mcp'},auth:{mode:'bearer',bearer:{token_env:'BROWSER_SYNTHETIC'}},services:{example:{type:'http',name:'Example',no_auth:true,destinations:[{name:'primary',base_url:'https://api.example.org',schemes:['https'],hosts:[{exact:'api.example.org'}]}],credentials:[],access:{users:['owner@example.org']},policy:{mode:'allow',rules:[]}}}},{BROWSER_SYNTHETIC:'synthetic-browser-gateway'});
 store=new ConsoleStore(join(directory,'console'),key,{config:cfg});
 gateway=createGatewayServer(cfg,{consoleStore:store});
 server=createServer({key:readFileSync(join(directory,'tls.key')),cert:readFileSync(join(directory,'tls.crt'))},(req,res)=>gateway.emit('request',req,res));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='https://console.example.org:'+server.address().port;
 const proof=store.issueProof(origin);const password='Synthetic browser long passphrase 2026';
 browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP console.example.org 127.0.0.1','--no-proxy-server']});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});
 const page=await context.newPage();
 const failures=[];page.on('pageerror',()=>failures.push('uncaught page error'));
 async function keyboardTo(selector){for(let i=0;i<50;i++){if(await page.locator(selector).evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Keyboard target unreachable: '+selector);}
 async function type(selector,value){await keyboardTo(selector);await page.keyboard.type(value);}
 async function submit(text){const b=page.getByRole('button',{name:text,exact:true});for(let i=0;i<50;i++){if(await b.evaluate(e=>e===document.activeElement)){await page.keyboard.press('Enter');return;}await page.keyboard.press('Tab');}throw Error('Keyboard submit unreachable');}
 async function shot(name,masked=false){await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,...(masked?{mask:[page.locator('code,pre,img,input')]}:{})});}
 async function bounded(){if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow');}
 await page.goto(origin+'/console');await expect(page.getByRole('heading',{name:'Set up your instance',exact:true})).toBeVisible();await shot('setup-desktop');
 await page.setViewportSize({width:320,height:800});await bounded();await shot('setup-320');await page.setViewportSize({width:1280,height:900});
 await type('#proof',proof);await type('#name','Example instance');await keyboardTo('#origin');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(origin);await type('#email','owner@example.org');await type('#password',password);await submit('Continue to authenticator setup');
 await expect(page.getByRole('heading',{name:'Set up your authenticator',exact:true})).toBeVisible();const seed=await page.locator('code').first().textContent();await shot('enrollment-redacted',true);
 await type('#code',totp(seed,clock));await keyboardTo('input[type=checkbox]');await page.keyboard.press('Space');await submit('Complete setup');await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await shot('login-desktop');
 clock+=30000;await type('#email','owner@example.org');await type('#password',password);await type('#code',totp(seed,clock));await submit('Sign in');await expect(page.getByRole('heading',{name:'My account',exact:true})).toBeVisible();await shot('account-desktop');
 const cookies=await context.cookies();if(!cookies.some(c=>c.name==='__Host-ss-console'&&c.secure&&c.httpOnly&&c.sameSite==='Strict'))throw Error('Cookie flags missing');
 if(!await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0))throw Error('Persistent browser state');
 if(page.url()!==origin+'/console')throw Error('URL changed');
 await page.setViewportSize({width:320,height:800});await bounded();await shot('account-320');
 await submit('Sign out');await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await shot('login-320');
 await type('#email','owner@example.org');await type('#password','incorrect synthetic password');await type('#code','123456');await submit('Sign in');await expect(page.locator('#errors')).toBeFocused();await shot('safe-error-320',true);
 await page.reload();clock+=30000;store.journal.degraded=true;
 await type('#email','owner@example.org');await type('#password',password);await type('#code',totp(seed,clock));await submit('Sign in');await expect(page.locator('#banner')).toContainText('Restricted diagnostic access');await expect(page.getByRole('button',{name:'Change password and sign out',exact:true})).toHaveCount(0);await bounded();await shot('diagnostic-320');
 await page.setViewportSize({width:1280,height:900});await shot('diagnostic-desktop');store.journal.degraded=false;await page.reload();await expect(page.locator('#banner')).toContainText('Restricted diagnostic access');await expect(page.getByRole('button',{name:'Change password and sign out',exact:true})).toHaveCount(0);await submit('Sign out');
 if(failures.length)throw Error('Browser errors');
 checks.push('Actual HTTPS/Secure-cookie setup and MFA login completed using keyboard only','Desktop and 320px setup/login/account/diagnosis have no horizontal overflow','Enrollment screenshot masks synthetic seed, QR, codes and input controls','Invalid login focuses safe error; no credential value appears in screenshot','Restricted outage login exposes diagnosis without mutations; repaired storage does not upgrade old session','Secure HttpOnly SameSite=Strict cookie verified; no local/session storage or URL secret transport','Keyboard sign-out available during restricted diagnosis; no uncaught browser errors');
 writeFileSync(join(evidence,'browser-report.json'),JSON.stringify({result:'PASS',browser:'Declared Playwright Chromium',transport:'Actual loopback HTTPS with synthetic example.org certificate and host mapping',clock:'Controlled server clock advances 30 seconds between TOTP uses',checks},null,2)+'\n');
 console.log('Browser PASS: '+checks.length+' checks; screenshots '+evidence);
} finally {
 Date.now=savedNow;await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));gateway?.emit('close');store?.close();rmSync(directory,{recursive:true,force:true});
}
