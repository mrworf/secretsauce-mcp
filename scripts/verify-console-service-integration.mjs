// Current M25–34 local acceptance; each actual browser fixture gets independent evidence.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(process.env.CONSOLE_BROWSER_EVIDENCE_DIR??'evidence/ux-acceptance/secretsauce-mcp/milestone34'),checks=[];
mkdirSync(root,{recursive:true});
for(const name of ['import-recovery','lifecycle','focused-service','destinations','credential-clear','credential-dialogs','policy-dialogs','service-help','navigation','credential-recovery']){
 try{execFileSync(process.execPath,['scripts/verify-console-'+name+'-browser.mjs'],{env:{...process.env,CONSOLE_BROWSER_EVIDENCE_DIR:join(root,name)},stdio:['ignore','pipe','pipe']});checks.push({suite:name,result:'PASS'});console.log(name+' PASS');}
 catch(e){writeFileSync(join(root,'failed-suite.log'),e.stderr??'Suite failed; no output');checks.push({suite:name,result:'FAIL'});writeFileSync(join(root,'integration-report.json'),JSON.stringify({checks},null,2));throw Error(name+' failed; inspect isolated evidence');}
}
writeFileSync(join(root,'integration-report.json'),JSON.stringify({result:'PASS',checks,scope:'Sequential actual HTTPS browser suites plus one joined import/mapping/Guided-Advanced/value/policy/review/apply/lifecycle/encrypted-recovery browser journey; representative exact advanced fields survive the chain. Local protocol tests and Docker additionally validate actual recovered dispatch. Real external clients not exercised.'},null,2));
