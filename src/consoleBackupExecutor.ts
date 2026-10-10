import {Worker} from 'node:worker_threads';
import {MAX_ARCHIVE_BYTES,type RecoveryState,type RecoveryPayload} from './consoleBackupArchive.js';
let occupied=0;
async function execute(input:unknown):Promise<unknown>{
 if(occupied)throw Error('Backup verification worker capacity');occupied++;
 let worker:Worker|undefined;
 try{worker=new Worker(new URL('../dist/consoleBackupWorker.js',import.meta.url),{workerData:input,resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:16,stackSizeMb:4}});const live=worker;
 return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Backup worker deadline')),30000);const fail=()=>{clearTimeout(timer);reject(Error('Backup worker failed'));};live.once('error',fail);live.once('exit',code=>{if(code!==0)fail();});live.once('message',value=>{clearTimeout(timer);if(!value||value.failed)reject(Error('Backup worker failed'));else resolve(value);});});
 }finally{await worker?.terminate();occupied--;}
}
export async function encryptBackupInWorker(input:{state:RecoveryState;audit:RecoveryPayload['audit'];key:string;keyId:string;recoveryPoint:number}):Promise<{archive:string}>{const result=await execute({...input,kind:'seal',hostTime:Date.now()}) as {archive?:unknown};if(typeof result.archive!=='string'||Buffer.byteLength(result.archive)>MAX_ARCHIVE_BYTES)throw Error('Backup worker output invalid');return {archive:result.archive};}
// M17 must hold ConsoleBackups.acquireJob('restore') around preview/decryption and installation.
export async function verifyRecoveryArchiveInWorker(archive:unknown,material:unknown):Promise<RecoveryPayload>{if(typeof archive!=='string'||Buffer.byteLength(archive)>MAX_ARCHIVE_BYTES||typeof material!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(material))throw Error('Invalid archive or material');const result=await execute({kind:'open',archive,material}) as {payload:RecoveryPayload};if(!result.payload)throw Error('Backup worker output invalid');return result.payload;}
