import {Worker} from 'node:worker_threads';
import type {RecoveryState,RecoveryPayload} from './consoleBackupArchive.js';
export async function encryptBackupInWorker(input:{state:RecoveryState;audit:RecoveryPayload['audit'];key:string;keyId:string;recoveryPoint:number}):Promise<{archive:string}> {
 const worker=new Worker(new URL('../dist/consoleBackupWorker.js',import.meta.url),{workerData:{...input,hostTime:Date.now()},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
 try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Backup worker deadline')),30000);const fail=()=>{clearTimeout(timer);reject(Error('Backup worker failed'));};worker.once('error',fail);worker.once('exit',code=>{if(code!==0)fail();});worker.once('message',value=>{clearTimeout(timer);if(value.failed||typeof value.archive!=='string')reject(Error('Backup worker failed'));else resolve({archive:value.archive});});});}finally{await worker.terminate();}
}
