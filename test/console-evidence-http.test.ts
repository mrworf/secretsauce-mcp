import {describe,it,expect} from 'vitest';
import {once} from 'node:events';
import {managedFixture} from './consoleManagementFixtures.js';
import {createGatewayServer} from '../src/server.js';
import {GatewayRuntime} from '../src/runtime.js';
describe('operating evidence direct HTTP boundaries',()=>{
 it('validates GET filters/detail/export/retention, current Member scope, Origin and CSRF',async()=>{
  const f=managedFixture(),runtime=new GatewayRuntime(f.cfg),server=createGatewayServer(f.cfg,{runtime,consoleStore:f.store,closeRuntimeOnServerClose:false});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+(server.address() as import('node:net').AddressInfo).port+'/console/api/',headers={cookie:'__Host-ss-console='+f.token,origin:'https://console.example.org','content-type':'application/json','x-console-csrf':f.csrf};
  const get=(path:string)=>fetch(base+path,{headers}),post=(path:string,data:unknown,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(data)});
  try{
   const id=f.store.journal.start(f.session.userId,'synthetic.action','baseline',12);
   expect((await get('activity?service=baseline&action=synthetic.action&limit=1')).status).toBe(200);
   for(const query of ['limit=0','from=2&to=1','actor=a&actor=b','unknown=x','__proto__=x','actor=%0A','offset=100001'])expect((await get('activity?'+query)).status,query).toBe(400);
   expect((await post('activity/detail',{id:'operation:'+id})).status).toBe(200);expect((await post('activity/detail',{id:'foreign'})).status).toBe(403);
   expect((await post('evidence/export',{kind:'activity'})).status).toBe(200);expect((await post('evidence/export',{kind:'activity'},{origin:'https://evil.example.org'})).status).toBe(403);expect((await post('evidence/export',{kind:'activity'},{'x-console-csrf':'wrong'})).status).toBe(403);
   expect((await get('retention')).status).toBe(200);expect((await post('retention/save',{days:30,base:f.store.state.revision,generation:0})).status).toBe(200);
   f.store.state.users[0]!.role='Member';expect((await get('activity')).status).toBe(200);expect((await get('activity?actor=foreign')).status).toBe(403);expect((await get('retention')).status).toBe(403);expect((await post('evidence/export',{kind:'activity'})).status).toBe(403);
  }finally{await new Promise<void>(r=>server.close(()=>r()));await runtime.close();f.close();}
 });
});
