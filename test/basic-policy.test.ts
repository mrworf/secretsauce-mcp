import { describe, it, expect } from 'vitest';
import { literalPathPrefix } from '../src/basicPolicy.js';
import { normalizeManagedService } from '../src/config.js';
import { resolveDestinationTarget } from '../src/urlValidation.js';
import { evaluatePolicy } from '../src/policy.js';
describe('guided literal path prefix with canonical backend policy',()=>{
 it('permits literal metacharacter prefix and descendants, rejects regex-like alternatives',()=>{
  const service=normalizeManagedService('example',{name:'Example',no_auth:true,destinations:[{id:'primary',base_url:'https://api.example.org'}],policy:{mode:'deny',rules:[{id:'prefix',effect:'allow',priority:1,methods:['GET'],hosts:[],paths:[literalPathPrefix('/v1.0/[item]')]}]}},{});
  const decision=(path:string)=>evaluatePolicy(service,resolveDestinationTarget(service,'primary',{path}),'GET');
  expect(decision('/v1.0/[item]').allowed).toBe(true);expect(decision('/v1.0/[item]/child').allowed).toBe(true);expect(decision('/v1x0/i').allowed).toBe(false);expect(decision('/v1.0/item').allowed).toBe(false);expect(evaluatePolicy(service,resolveDestinationTarget(service,'primary',{path:'/v1.0/[item]'}),'POST').allowed).toBe(false);
 });
 it('keeps regex punctuation literal rather than changing policy matching',()=>{
  for(const prefix of ['/a+b','/a(b)','/a{2}','/a|b','/a$','/a^b','/a?b','/a*b']){const regex=new RegExp(literalPathPrefix(prefix));expect(regex.test(prefix+'/next')).toBe(true);expect(regex.test('/unrelated')).toBe(false);}
 });
});
