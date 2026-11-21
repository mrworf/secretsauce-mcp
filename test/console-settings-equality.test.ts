import {expect,it} from 'vitest';
import {settingsComparable,settingsEqual} from '../src/consoleSettingsEquality.js';
it('compares only domain-equivalent catalog units/defaults and object order without mutation',()=>{
 const a={secretlint:{version:1,limits:{timeout:'5s'}},sensitiveNames:{version:1}},before=structuredClone(a);
 expect(settingsEqual(a,{sensitiveNames:{version:1,mode:'extend',patterns:[],allow_patterns:[]},secretlint:{mode:'extend',version:1,rules:[],limits:{max_unique_secrets:100,timeout:'5000ms'}}})).toBe(true);expect(a).toEqual(before);
 expect(settingsEqual({x:1,y:2},{y:2,x:1})).toBe(true);
 for(const [a,b] of [[{regex:'a'},{regex:'A'}],[{id:'a'},{id:'A'}],[{options:{timeout:'5s'}},{options:{timeout:'5000ms'}}],[['a','b'],['b','a']],[{a:''},{}],[{x:0},{x:false}]])expect(settingsEqual(a,b)).toBe(false);
 expect(settingsComparable({secretlint:{limits:{timeout:'5seconds'}}})).toMatchObject({secretlint:{limits:{timeout:'5seconds'}}});
 expect(Object.hasOwn(settingsComparable(JSON.parse('{"__proto__":{"x":1}}')) as object,'__proto__')).toBe(true);expect(({} as {x?:number}).x).toBeUndefined();
});
