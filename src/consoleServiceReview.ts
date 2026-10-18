// Presentation only: callers supply the existing sanitized review read model.
export interface ReviewChange { path: string[]; kind: 'added'|'removed'|'changed'; before?: unknown; after?: unknown }
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
        if(a.length&&b.length&&!equal(ak,bk))rows.push({path:[...path,'Order'],kind:'changed',before:ak,after:bk});
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
export const consoleServiceReviewScript=String.raw`
const reviewChanges=${reviewChanges.toString()};
const reviewSection=${reviewSection.toString()};
const reviewSectionOrder=['Details','Allowed servers','Authentication','Request rules','Secret detection','Additional configuration'];
function reviewValue(parent,value){
 if(value===null||typeof value!=='object'){const n=el('code',typeof value==='string'?JSON.stringify(value):String(value));n.className='review-literal';parent.append(n);return;}
 const entries=Object.entries(value);if(!entries.length){parent.append(el('code',Array.isArray(value)?'[]':'{}'));return;}
 const list=el('dl');list.className='review-values';for(const [key,child] of entries){const term=el('dt',Array.isArray(value)?'Item '+(Number(key)+1):key);const detail=el('dd');reviewValue(detail,child);list.append(term,detail);}parent.append(list);
}
function renderReviewChanges(parent,review){
 if(review.current===null)parent.append(el('p','No active configuration yet'));
 const rows=reviewChanges(review.current,review.proposed);
 if(!rows.length){parent.append(el('p','No configuration changes'));return;}
 const legend=el('p');legend.className='review-legend';for(const [kind,label]of [['added','+ Added'],['removed','− Removed'],['changed','~ Changed']]){const tag=el('span',label);tag.className='review-'+kind;legend.append(tag);}parent.append(legend);
 for(const section of reviewSectionOrder){const group=rows.filter(r=>reviewSection(r.path[0]??'')===section);if(!group.length)continue;const area=el('section');area.className='review-section';area.append(el('h2',section));for(const row of group){const card=el('article');card.className='review-diff';card.append(el('h3',row.path.map((key,i)=>i===0?humanLabel(key):key).join(' › ')||'Configuration'));const pair=el('div');pair.className='review-pair';for(const side of ['before','after']){const cell=el('div');cell.className='review-cell review-'+row.kind;cell.append(el('strong',side==='before'?'Before':'After'),el('span',{added:'+ Added',removed:'− Removed',changed:'~ Changed'}[row.kind]));if(Object.hasOwn(row,side))reviewValue(cell,row[side]);else{const marker=el('em',side==='before'?'Not configured':'Removed');marker.className='review-absence';cell.append(marker);}pair.append(cell);}card.append(pair);area.append(card);}parent.append(area);}
 parent.append(el('p','Other settings are unchanged. View the full proposal in New settings.'));
}
function serviceReviewTabs(parent,review){const tabs=el('div');tabs.className='review-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Configuration review');const panels=[];const buttons=[];for(const [i,name]of ['Changes','New settings'].entries()){const b=action(tabs,name,()=>select(i));b.id='review-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','review-panel-'+i);const panel=el('section');panel.id='review-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);panel.tabIndex=0;panels.push(panel);buttons.push(b);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;select(next);buttons[next].focus();};}function select(i){buttons.forEach((b,n)=>{b.setAttribute('aria-selected',String(i===n));b.tabIndex=i===n?0:-1;panels[n].hidden=i!==n;});}parent.append(tabs,...panels);renderReviewChanges(panels[0],review);renderConfig(panels[1],'New settings',review.proposed);select(0);}
`;
export const consoleServiceReviewStyle=String.raw`
.review-tabs{display:flex;gap:6px;border-bottom:1px solid #d9dde1;margin:24px 0 18px}.review-tabs button{border:0;border-radius:0;background:transparent;color:#53606d;padding:12px 20px}.review-tabs button[aria-selected=true]{color:#954b22;border-bottom:3px solid #c66a38;background:#fff6ef}.review-legend{display:flex;flex-wrap:wrap;gap:10px}.review-legend span{padding:5px 10px;border-radius:5px}#content .review-section{margin:24px 0;padding:0;border:0;background:transparent}.review-section h2{font-size:1.15rem;margin:0 0 12px}.review-diff{border:1px solid #dce0e4;border-radius:10px;background:white;overflow:hidden;margin:12px 0}.review-diff h3{font-size:1rem;padding:14px 18px;margin:0;overflow-wrap:anywhere}.review-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.review-cell{padding:16px 18px;min-width:0;overflow-wrap:anywhere}.review-cell+ .review-cell{border-left:1px solid #e0dfdb}.review-cell>strong{display:block;font-size:.8rem;text-transform:uppercase;color:#59616b}.review-cell>span{display:block;font-size:.8rem;margin:6px 0 12px}.review-added{background:#eaf5ed;color:#235e37}.review-removed{background:#fceeed;color:#953a36}.review-changed{background:#fff6df;color:#79551a}.review-literal{color:#28323c;white-space:pre-wrap;overflow-wrap:anywhere}.review-values{margin:8px 0}.review-values dt{font-weight:600;overflow-wrap:anywhere;margin-top:8px}.review-values dd{margin:3px 0 10px;min-width:0;overflow-wrap:anywhere}.review-values .review-values{border-left:2px solid #dde2e6;padding-left:12px}.review-absence{display:block}.review-new-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.review-new-grid>article{padding:20px;border:1px solid #dce0e4;background:white;border-radius:10px;min-width:0}.review-new-grid h2{font-size:1.1rem;margin:0 0 12px}#content>[role=tabpanel]{border:0;padding:0;background:transparent}#content>[role=tabpanel][hidden]{display:none}@media(max-width:700px){.review-pair,.review-new-grid{grid-template-columns:minmax(0,1fr)}.review-cell+ .review-cell{border-left:0;border-top:1px solid #e0dfdb}.review-tabs button{padding:12px 10px;overflow-wrap:anywhere;min-width:0}}
`;
