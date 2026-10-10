import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {retainedWriterPids,advancePastWriters} from '../scripts/docker-launcher.mjs';
describe('bounded Docker namespace PID recovery',()=>{
 it('reads only bounded writer PID metadata and reaps short children before application PID allocation',()=>{const dir=mkdtempSync(join(tmpdir(),'launcher-'));try{mkdirSync(join(dir,'audit'));writeFileSync(join(dir,'writer.lock'),'20');writeFileSync(join(dir,'audit','gateway.jsonl.writer'),'30');writeFileSync(join(dir,'audit','unrelated'),'not a lock');expect(retainedWriterPids(dir,join(dir,'audit'))).toEqual([20,30]);let calls=0;advancePastWriters([30],()=>({pid:++calls+20,status:0}));expect(calls).toBe(10);}finally{rmSync(dir,{recursive:true,force:true});}});
 it.each(['0','-1','1','9999999','invalid','22\nextra','2'.repeat(17)])('rejects invalid/unbounded/colliding writer metadata %s without clearing it',value=>{const dir=mkdtempSync(join(tmpdir(),'launcher-'));try{mkdirSync(join(dir,'audit'));writeFileSync(join(dir,'writer.lock'),value);expect(()=>retainedWriterPids(dir,join(dir,'audit'))).toThrow();}finally{rmSync(dir,{recursive:true,force:true});}});
 it('rejects failed child allocation and bounded exhaustion',()=>{expect(()=>advancePastWriters([20],()=>({status:1,pid:30}))).toThrow();let count=0;expect(()=>advancePastWriters([20],()=>({status:0,pid:++count%10}))).toThrow();expect(count).toBe(4096);});
});
