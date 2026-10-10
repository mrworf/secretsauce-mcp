import { describe,it,expect } from 'vitest';
import { managedFixture } from './consoleManagementFixtures.js';
import { previewPolicy } from '../src/policyPreview.js';
import { evaluatePolicy } from '../src/policy.js';
import { resolveDestinationTarget } from '../src/urlValidation.js';
import { literalExactPath,literalPathPrefix } from '../src/basicPolicy.js';
import { normalizeManagedService,serviceDraft } from '../src/config.js';
describe('advanced authoring and bounded zero-I/O preview',()=>{
 it('round trips advanced fields and explains runtime priority, deny and canonical target',async()=>{
  const f=managedFixture();try{
   const s=f.manager.state.services.baseline!;s.assignments=[f.session.userId];s.applied!.access={users:s.assignments};
   s.applied!.policy={mode:'deny',rules:[{id:'first',effect:'allow',priority:5,methods:['GET'],hosts:['^api\\.example\\.org$'],paths:[literalExactPath('/a')],reason:'Allowed exact',binary_response:{scan:false,max_size:'unlimited'}},{id:'deny',effect:'deny',priority:5,methods:['GET'],hosts:[],paths:[literalPathPrefix('/a')],reason:'Denied tied rule',secretlint:{enabled:false}}]};
   const service=normalizeManagedService('baseline',s.applied!,{}),target=resolveDestinationTarget(service,undefined,{path:'/a'});
   const r=await previewPolicy(f.manager,f.session,{id:'baseline',identity:f.session.userId,source:'applied',method:'GET',path:'/a'});
   expect(r.policyAllowed).toBe(evaluatePolicy(service,target,'GET').allowed);expect(r.matchedRule).toBe('deny');expect(r.canonicalTarget).toBe('https://api.example.org/a');expect(r.notice).toContain('No downstream');
   expect(serviceDraft(service).policy?.rules.map(r=>r.paths)).toEqual(s.applied!.policy.rules.map(r=>r.paths));
  }finally{f.close();}
 });
 it('handles stable same-effect ties, unmatched default and ineligible identity',async()=>{const f=managedFixture();try{const s=f.manager.state.services.baseline!;s.assignments=[f.session.userId];s.applied!.policy={mode:'deny',rules:[{id:'a',effect:'allow',priority:1,methods:['GET'],hosts:[],paths:['^/ok$']},{id:'b',effect:'allow',priority:1,methods:['GET'],hosts:[],paths:['^/ok$']}]};const input={id:'baseline',identity:f.session.userId,source:'applied',method:'get',path:'/ok'};expect((await previewPolicy(f.manager,f.session,input)).matchedRule).toBe('a');expect((await previewPolicy(f.manager,f.session,{...input,path:'/okay'})).allowed).toBe(false);expect((await previewPolicy(f.manager,f.session,{...input,identity:'owner@example.org'})).eligible).toBe(false);}finally{f.close();}});
 it('rejects external input and secret-bearing target safely',async()=>{const f=managedFixture();try{const input={id:'baseline',identity:f.session.userId,source:'applied',method:'GET',path:'/'};for(const change of [{method:'GET\r\nsecret'},{path:'/%2fsecret'},{path:undefined,url:'https://user:secret@api.example.org/'},{source:'unknown'},{path:'x'.repeat(9000)}])await expect(previewPolicy(f.manager,f.session,{...input,...change})).rejects.toThrow(/preview:|destination:/);expect(f.manager.save(f.session,{id:'baseline',base:0,generation:0,service:f.manager.state.services.baseline!.applied})).toHaveProperty('generation',1);expect(()=>f.manager.save(f.session,{id:'baseline',base:0,generation:1,service:{...f.manager.state.services.baseline!.applied,policy:{mode:'deny',rules:[{id:'bad',effect:'deny',priority:0,paths:['['],hosts:[],methods:[]}]}}})).toThrow('Invalid regular expression');}finally{f.close();}});
 it('bounds catastrophic regex without changing source',async()=>{const f=managedFixture();try{f.manager.state.services.baseline!.applied!.policy={mode:'deny',rules:[{id:'bad',effect:'deny',priority:0,methods:[],hosts:[],paths:['^(a+)+$']}]};await expect(previewPolicy(f.manager,f.session,{id:'baseline',identity:f.session.userId,source:'applied',method:'GET',path:'/'+ 'a'.repeat(100)+'!'})).resolves.toBeDefined();f.manager.state.services.baseline!.applied!.policy!.rules[0]!.paths=['^/(a+)+$'];await expect(previewPolicy(f.manager,f.session,{id:'baseline',identity:f.session.userId,source:'applied',method:'GET',path:'/'+ 'a'.repeat(100)+'!'})).rejects.toThrow('bounded deadline');}finally{f.close();}});
});
