// Comparison only: never rewrite saved literals or policy/catalog array ordering.
export function settingsComparable(value: unknown, path = ''): unknown {
  if (path === 'secretlint.limits.timeout' && typeof value === 'string') {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
    if (match) return Number(match[1]) * (({ms:1,s:1000,m:60000,h:3600000,d:86400000} as Record<string,number>)[match[2]!]!);
  }
  if (Array.isArray(value)) return value.map((v,i)=>settingsComparable(v,path+'.'+i));
  if (value && typeof value === 'object') {
    let source = value as Record<string,unknown>;
    if(path==='secretlint')source={mode:'extend',rules:[],limits:{max_unique_secrets:100,timeout:'5s'},...source};
    if(path==='secretlint.limits')source={max_unique_secrets:100,timeout:'5s',...source};
    if(path==='sensitiveNames')source={mode:'extend',patterns:[],allow_patterns:[],...source};
    return Object.fromEntries(Object.keys(source).sort().map(key=>[key,settingsComparable(source[key],path?path+'.'+key:key)]));
  }
  return value;
}
export function settingsEqual(a:unknown,b:unknown,path=''):boolean {return JSON.stringify(settingsComparable(a,path))===JSON.stringify(settingsComparable(b,path));}
export const settingsEqualityScript=[settingsComparable,settingsEqual].map(fn=>fn.toString()).join('\n');
