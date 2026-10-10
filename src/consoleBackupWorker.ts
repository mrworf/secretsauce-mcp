import {parentPort,workerData} from 'node:worker_threads';
import {createRecoveryPayload,sealRecoveryArchive,verifySealedArchive} from './consoleBackupArchive.js';
const {state,audit,key,recoveryPoint,hostTime}=workerData;
const started=performance.now();
try{const assembledAt=hostTime+Math.floor(performance.now()-started),payload=createRecoveryPayload(state,audit,workerData.keyId,recoveryPoint,assembledAt),archive=sealRecoveryArchive(payload,key);verifySealedArchive(archive,key);parentPort!.postMessage({archive});}catch{parentPort!.postMessage({failed:true});}
