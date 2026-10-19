// Presentation only: callers supply the existing sanitized review read model.
export interface ReviewChange { path: string[]; kind: 'added'|'removed'|'changed'; order?: true; before?: unknown; after?: unknown }
export function reviewChanges(before: unknown, after: unknown): ReviewChange[] {
  const rows: ReviewChange[]=[];
  const equal=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
  const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function walk(a:unknown,b:unknown,path:string[],hasA=true,hasB=true):void {
    if(hasA&&hasB&&equal(a,b))return;
    if(!hasA||!hasB){rows.push({path,kind:hasA?'removed':'added',...(hasA?{before:a}:{}),...(hasB?{after:b}:{})});return;}
    if(object(a)&&object(b)){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],[...path,key],Object.hasOwn(a,key),Object.hasOwn(b,key));return;}
    if(Array.isArray(a)&&Array.isArray(b)){
      const key=(v:unknown):string|undefined=>object(v)?typeof v.id==='string'?v.id:typeof v.name==='string'?v.name:undefined:undefined;
      const ak=a.map(key),bk=b.map(key);
      if(ak.every(v=>v!==undefined)&&bk.every(v=>v!==undefined)&&new Set(ak).size===a.length&&new Set(bk).size===b.length){
        const am=new Map(ak.map((k,i)=>[k,a[i]])),bm=new Map(bk.map((k,i)=>[k,b[i]]));
        for(const k of new Set([...ak,...bk]))walk(am.get(k),bm.get(k),[...path,String(k)],am.has(k),bm.has(k));
        if(a.length&&b.length&&(a.length>1||b.length>1)&&!equal(ak,bk))rows.push({path:[...path,'Order'],kind:'changed',order:true,before:ak,after:bk});
        return;
      }
      // Anonymous list ordering is semantic: retain the complete ordered values.
    }
    rows.push({path,kind:'changed',before:a,after:b});
  }
  if(before===null&&object(after)){for(const k of Object.keys(after))walk(undefined,after[k],[k],false,true);}else walk(before,after,[]);
  return rows;
}
export function reviewSection(key:string):string {
  if(['type','name','description','api_docs_url'].includes(key))return 'Details';
  if(['destinations','tls'].includes(key))return 'Allowed servers';
  if(['credentials','no_auth'].includes(key))return 'Authentication';
  if(['policy','access'].includes(key))return 'Request rules';
  if(['response','secretlint','sensitive_names','sensitiveNames','response_protection'].includes(key))return 'Secret detection';
  return 'Additional configuration';
}
// Resolve list labels against both snapshots; never guess an ordinal for a missing identity.
export function reviewChangeTitle(row: ReviewChange, review: {current: any; proposed: any}, label: (key:string)=>string=(key)=>key): string {
 const path=row.path;
 const find=(items: any[],id:string|undefined)=>{const index=items.findIndex(v=>(v.id??v.name)===id);return index<0?undefined:{item:items[index],index};};
 if(path[0]==='destinations'){
  if(row.order)return 'Server order';
  const before=find(review.current?.destinations??[],path[1]),after=find(review.proposed?.destinations??[],path[1]);
  const match=row.kind==='removed'?before:after??before;
  const name=match?'Server '+(match.index+1)+' · '+(match.item.base_url??path[1]):'Server '+(path[1]??'configuration');
  return name+(path.length>2?' · '+path.slice(2).map(label).join(' › '):'');
 }
 if(path[0]==='policy'&&path[1]==='rules'){
  if(row.order)return 'Request rule order';
  const before=find(review.current?.policy?.rules??[],path[2]),after=find(review.proposed?.policy?.rules??[],path[2]);
  const match=row.kind==='removed'?before:after??before;
  return 'Rule '+(match?match.index+1:'')+' · '+(match?.item.reason||path[2]||'configuration')+(path.length>3?' · '+path.slice(3).map(label).join(' › '):'');
 }
 return path.map((key,i)=>i===0||['tls','policy','usage','binary_response'].includes(path[i-1]??'')?label(key):key).join(' › ')||'Configuration';
}
export const consoleServiceReviewScript=String.raw`
const reviewChanges=${reviewChanges.toString()};
const reviewSection=${reviewSection.toString()};
const reviewChangeTitle=${reviewChangeTitle.toString()};
const reviewSectionOrder=['Details','Allowed servers','Authentication','Request rules','Secret detection','Additional configuration'];
function reviewFieldLabel(key){const labels={destinations:'Servers',base_url:'Server address',id:'Identifier',name:'Name',type:'Type',description:'Description',api_docs_url:'API documentation',schemes:'Allowed schemes',hosts:'Host matching',ports:'Allowed ports',tls:'Server certificate',verify:'Verify certificate',no_auth:'No downstream authentication',credentials:'Credentials',usage:'Send credential',kind:'Placement',prefix:'Text before value',suffix:'Text after value',enforce:'Replace matching caller header',policy:'Request policy',mode:'Default action',rules:'Rules',access:'Initial access configuration',users:'Users',methods:'HTTP methods',paths:'Paths',reason:'Explanation',effect:'Action',priority:'Priority',binary_response:'Binary responses',scan:'Scan response',max_size:'Maximum scan size',secretlint:'Secret detection',disabled_rules:'Disabled rules',enabled:'Enabled',exact:'Exact match',regex:'Regular expression'};return Object.hasOwn(labels,key)?labels[key]:key;}
function reviewValue(parent,value){
 if(value===null||typeof value!=='object'){const n=el('code',typeof value==='string'?JSON.stringify(value):String(value));n.className='review-literal';parent.append(n);return;}
 const entries=Object.entries(value);if(!entries.length){parent.append(el('code',Array.isArray(value)?'[]':'{}'));return;}
 if(Array.isArray(value)&&value.every(v=>v===null||typeof v!=='object')){const line=el('div');line.className='review-inline-values';value.forEach((v,i)=>{if(i)line.append(document.createTextNode(', '));reviewValue(line,v);});parent.append(line);return;}
 const list=el('dl');list.className='review-values';for(const [key,child] of entries){const term=el('dt',Array.isArray(value)?'Item '+(Number(key)+1):key);const detail=el('dd');reviewValue(detail,child);list.append(term,detail);}parent.append(list);
}
function reviewChangeValue(cell,value,known){if(Array.isArray(value)&&value.length&&value.every(v=>v&&typeof v==='object'&&Object.keys(v).every(k=>['exact','suffix','regex'].includes(k)))){const list=el('dl');list.className='review-change-fields';value.forEach((host,i)=>{for(const [key,literal]of Object.entries(host)){list.append(el('dt','Host '+(i+1)+' · '+({exact:'Exact match',suffix:'Host suffix',regex:'Regular expression'}[key])));const dd=el('dd');reviewValue(dd,literal);list.append(dd);}});cell.append(list);return;}if(value&&typeof value==='object'&&!Array.isArray(value)){const list=el('dl');list.className='review-change-fields';for(const [key,v]of Object.entries(value)){const dt=el('dt',known?reviewFieldLabel(key):key),dd=el('dd');reviewValue(dd,v);list.append(dt,dd);}cell.append(list);}else reviewValue(cell,value);}
function renderReviewChanges(parent,review){
 if(review.current===null)parent.append(el('p','No active configuration yet'));
 const rows=reviewChanges(review.current,review.proposed);
 if(!rows.length){parent.append(el('p','No configuration changes'));return;}
 const legend=el('p');legend.className='review-legend';for(const [kind,label]of [['added','+ Added'],['removed','− Removed'],['changed','~ Changed']]){const tag=el('span',label);tag.className='review-'+kind;legend.append(tag);}parent.append(legend);
 for(const section of reviewSectionOrder){const group=rows.filter(r=>reviewSection(r.path[0]??'')===section);if(!group.length)continue;const area=el('section');area.className='review-section';area.append(el('h2',section));const used=new Set();for(const row of group){if(used.has(row))continue;let added;if(row.kind==='removed'&&row.path[0]==='policy'&&row.path[1]==='rules'&&row.path.length===3){added=group.find(r=>!used.has(r)&&r.kind==='added'&&r.path.length===3&&r.path[0]==='policy'&&r.path[1]==='rules');if(added)used.add(added);}
 const card=el('article');card.className='review-diff';card.append(el('h3',added?'Request rules · One removed, one added':reviewChangeTitle(row,review,reviewFieldLabel)));const pair=el('div');pair.className='review-pair';for(const side of ['before','after']){const item=added&&side==='after'?added:row,kind=item.kind;const cell=el('div');cell.className='review-cell review-'+kind;cell.append(el('strong',side==='before'?'Before':'After'),el('span',{added:'+ Added',removed:'− Removed',changed:'~ Changed'}[kind]));if(Object.hasOwn(item,side))reviewChangeValue(cell,item[side],['policy','destinations','credentials','tls'].includes(row.path[0]));else{const marker=el('em',side==='before'?'Not configured':'Removed');marker.className='review-absence';cell.append(marker);}if(added)cell.append(el('em',side==='before'?'Removed from new settings':'Not configured before'));pair.append(cell);}card.append(pair);area.append(card);}parent.append(area);}
 parent.append(el('p','Other settings are unchanged. View the full proposal in New settings.'));
}
function renderReviewProposal(parent,review){
 parent.append(el('p','The complete proposed configuration, grouped by section. Credential values are never shown.'));
 const grid=el('div');grid.className='review-new-grid';
 function row(list,label,value){const term=el('dt',label),detail=el('dd');reviewValue(detail,value);list.append(term,detail);}
 function rows(list,object,labels){for(const [key,value]of Object.entries(object))row(list,Object.hasOwn(labels,key)?labels[key]:key,value);}
 function group(card,title){card.append(el('h3',title));const list=el('dl');list.className='review-proposal-fields';card.append(list);return list;}
 for(const section of reviewSectionOrder){const entries=Object.entries(review.proposed).filter(([key])=>reviewSection(key)===section);if(!entries.length)continue;const card=el('article');card.append(el('h2',section));let list=el('dl');list.className='review-proposal-fields';card.append(list);
 for(const [key,value]of entries){
  if(key==='destinations'&&Array.isArray(value)&&value.length){value.forEach((destination,i)=>{const fields=group(card,'Server '+(i+1));for(const [k,v]of Object.entries(destination)){
   if(k==='hosts'&&Array.isArray(v)&&v.length){v.forEach((host,j)=>{for(const [match,literal]of Object.entries(host))row(fields,'Host '+(j+1)+' · '+({exact:'Exact match',suffix:'Host suffix',regex:'Regular expression'}[match]||match),literal);});}
   else if(k==='tls'&&v&&Object.hasOwn(v,'verify'))row(fields,'Verify server certificate · override',v.verify);
   else row(fields,reviewFieldLabel(k),v);
  }});continue;}
  if(key==='tls'&&value&&Object.hasOwn(value,'verify')){row(list,'Verify server certificate · service default',value.verify);continue;}
  if(key==='policy'&&value&&typeof value==='object'){for(const [k,v]of Object.entries(value)){if(k==='rules'&&Array.isArray(v)&&v.length){v.forEach((rule,i)=>{const fields=group(card,'Rule '+(i+1)+(rule.reason?' · '+rule.reason:''));for(const [rk,rv]of Object.entries(rule)){if(rk==='binary_response'&&rv&&typeof rv==='object'){for(const [bk,bv]of Object.entries(rv))row(fields,'Binary response · '+reviewFieldLabel(bk),bv);}else row(fields,reviewFieldLabel(rk),rv);}});}else row(list,k==='mode'?'When no rule matches':reviewFieldLabel(k),v);}continue;}
  if(key==='credentials'&&Array.isArray(value)&&value.length){value.forEach((credential,i)=>{const fields=group(card,'Credential '+(i+1));for(const [k,v]of Object.entries(credential)){if(k==='usage'&&v&&typeof v==='object')rows(fields,v,{kind:'Send credential in',name:'Header or parameter name',prefix:'Text before value',suffix:'Text after value',enforce:'Replace matching caller header'});else row(fields,reviewFieldLabel(k),v);}});continue;}
  if(key==='access'&&value&&Object.hasOwn(value,'users')){row(list,'Initial access configuration · users',value.users);continue;}
  row(list,reviewFieldLabel(key),value);
 }grid.append(card);}parent.append(grid);
}
function serviceReviewTabs(parent,review){const tabs=el('div');tabs.className='review-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Configuration review');const panels=[];const buttons=[];for(const [i,name]of ['New settings','Changes'].entries()){const b=action(tabs,name,()=>select(i));b.id='review-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','review-panel-'+i);const panel=el('section');panel.id='review-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);panel.tabIndex=0;panels.push(panel);buttons.push(b);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;select(next);buttons[next].focus();};}function select(i){buttons.forEach((b,n)=>{b.setAttribute('aria-selected',String(i===n));b.tabIndex=i===n?0:-1;panels[n].hidden=i!==n;});}parent.append(tabs,...panels);renderReviewProposal(panels[0],review);renderReviewChanges(panels[1],review);select(0);}
`;
export const consoleServiceReviewStyle=String.raw`
.review-tabs{display:flex;gap:6px;border-bottom:1px solid #d9dde1;margin:24px 0 18px}.review-tabs button{border:0;border-radius:0;background:transparent;color:#53606d;padding:12px 20px}.review-tabs button[aria-selected=true]{color:#954b22;border-bottom:3px solid #c66a38;background:#fff6ef}.review-legend{display:flex;flex-wrap:wrap;gap:10px}.review-legend span{padding:5px 10px;border-radius:5px}#content .review-section{margin:24px 0;padding:0;border:0;background:transparent}.review-section h2{font-size:1.15rem;margin:0 0 12px}.review-diff{border:1px solid #dce0e4;border-radius:10px;background:white;overflow:hidden;margin:12px 0}.review-diff h3{font-size:1rem;padding:14px 18px;margin:0;overflow-wrap:anywhere}.review-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.review-cell{padding:12px 18px;min-width:0;overflow-wrap:anywhere}.review-cell+ .review-cell{border-left:1px solid #e0dfdb}.review-cell>strong{display:block;font-size:.8rem;text-transform:uppercase;color:#59616b}.review-cell>span{display:block;font-size:.8rem;margin:4px 0 8px}.review-added{background:#eaf5ed;color:#235e37}.review-removed{background:#fceeed;color:#953a36}.review-changed{background:#fff6df;color:#79551a}.review-literal{color:#28323c;white-space:pre-wrap;overflow-wrap:anywhere}.review-change-fields{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:7px 14px;font-size:.85rem;margin:8px 0}.review-change-fields dt{overflow-wrap:anywhere;color:#53606d}.review-change-fields dd{min-width:0;margin:0;overflow-wrap:anywhere}.review-change-fields .review-values{border:0;padding:0;display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:4px 8px}.review-change-fields .review-values dt,.review-change-fields .review-values dd{margin:0;font-weight:400}.review-values{margin:8px 0}.review-values dt{font-weight:600;overflow-wrap:anywhere;margin-top:8px}.review-values dd{margin:3px 0 10px;min-width:0;overflow-wrap:anywhere}.review-values .review-values{border-left:2px solid #dde2e6;padding-left:12px}.review-absence{display:block}.review-new-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.review-new-grid>article{padding:20px;border:1px solid #dce0e4;background:white;border-radius:10px;min-width:0}.review-proposal-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:10px 18px;margin:0}.review-proposal-fields dt{font-size:.85rem;color:#53606d;overflow-wrap:anywhere}.review-proposal-fields dd{margin:0;min-width:0;overflow-wrap:anywhere}.review-new-grid{align-items:start}.review-new-grid h3{font-size:.95rem;margin:18px 0 12px;overflow-wrap:anywhere}.review-new-grid h2{font-size:1.1rem;margin:0 0 12px}#content>[role=tabpanel]{border:0;padding:0;background:transparent}#content>[role=tabpanel][hidden]{display:none}@media(max-width:700px){.review-pair,.review-new-grid,.review-proposal-fields,.review-change-fields,.review-change-fields .review-values{grid-template-columns:minmax(0,1fr)}.review-proposal-fields{gap:5px}.review-proposal-fields dd{margin-bottom:10px}.review-cell+ .review-cell{border-left:0;border-top:1px solid #e0dfdb}.review-tabs button{padding:12px 10px;overflow-wrap:anywhere;min-width:0}}
`;

export const serviceApprovalStyle = `
.approval-summary{background:#fff9ee;border:1px solid #ead7b2;border-radius:12px;padding:20px 24px;margin:24px 0}.approval-summary h2{margin-top:0}.approval-summary p:last-child{color:#5d6368;font-size:.9rem}.approval-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;margin-top:20px}.service-approval{width:min(640px,calc(100vw - 40px));max-width:none;max-height:calc(100dvh - 40px);box-sizing:border-box;border:1px solid #d7dce0;border-radius:16px;padding:28px;overflow:auto;color:#242b30;background:white}.service-approval::backdrop{background:#1d293a66}.service-approval h2{margin:0 0 14px}.service-approval p,.service-approval span{overflow-wrap:anywhere}.service-approval form{border:0;padding:0;margin:0;max-width:none;box-shadow:none;background:transparent}.approval-risk{display:flex!important;align-items:flex-start;gap:12px;background:#fff9ee;border:1px solid #ead7b2;padding:15px;border-radius:10px;margin:12px 0;line-height:1.5}.approval-risk input{width:18px!important;min-width:18px;height:18px;margin:3px 0 0!important;accent-color:#a4491b}.approval-risk span{min-width:0}.approval-risk{font-size:14px}.approval-risk-detail{display:block;font-size:13px;font-weight:400;color:#526171;margin-top:6px}.service-approval p{font-size:14px}.service-approval h2{font-size:23px}.service-approval button:disabled{background:#f1f4f7;color:#64748b;border-color:#cbd5e1;opacity:1;cursor:default}.approval-summary h2{font-size:17px}.approval-status{color:#5d6368;font-size:.9rem}.service-approval button{white-space:normal;overflow-wrap:anywhere}.service-approval h2:focus{outline:2px solid #a4491b;outline-offset:4px}@media(max-width:600px){.service-approval{padding:20px;width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.approval-risk{padding:12px}.approval-actions button{flex:1;min-width:0}.approval-summary{padding:18px}}
`;
