import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function retainedWriterPids(consoleDirectory,auditDirectory){
 const names=readdirSync(auditDirectory);if(names.length>128)throw Error('Bounded audit directory required');
 const files=[join(consoleDirectory,'writer.lock'),...names.filter(n=>n.endsWith('.writer')).map(n=>join(auditDirectory,n))],pids=[];
 for(const file of files){if(!existsSync(file))continue;if(statSync(file).size>16)throw Error('Invalid writer ownership metadata');const text=readFileSync(file,'utf8').trim();if(!/^[1-9][0-9]*$/.test(text))throw Error('Invalid writer ownership metadata');const pid=Number(text);if(!Number.isSafeInteger(pid)||pid>4096)throw Error('Writer PID requires quiesced host repair');if(pid===process.pid||pid===1)throw Error('Writer PID collides with live launcher; quiesced host repair required');pids.push(pid);}
 return pids;
}
export function advancePastWriters(pids,spawnShort=()=>spawnSync('/bin/sh',['-c','exit 0'])){
 const maximum=Math.max(0,...pids);if(maximum===0)return;
 for(let i=0;i<4096;i++){const child=spawnShort();if(child.error||child.status!==0||!Number.isInteger(child.pid))throw Error('Could not establish child PID ownership');if(child.pid>=maximum)return;}
 throw Error('Bounded writer PID recovery exhausted');
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [command,...args]=process.argv.slice(2);if(command!=='node'||args.length===0)throw Error('Supported Node application invocation required');advancePastWriters(retainedWriterPids(process.env.CONSOLE_STORAGE_DIR,process.env.AUDIT_STORAGE_DIR));const child=spawn(command,args,{stdio:'inherit'});for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('error',()=>{console.error('Application launch unavailable.');process.exitCode=78;});child.on('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGTERM'?143:1);});}
 catch(error){console.error('Single-instance startup unavailable; inspect stable mounts and writer ownership from a quiesced host.');if(error.message.startsWith('Writer ')||error.message.startsWith('Could not establish')||error.message.startsWith('Bounded '))console.error(error.message);process.exitCode=78;}
}
