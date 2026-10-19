// Presentation only. The original exception strings remain the acknowledgment keys.
export function serviceExceptionLabel(risk: string, proposed: any): string {
 const destinations: any[]=proposed.destinations??[];
 const label=(d:any,i:number)=>{let address='Server address unavailable';try{const u=new URL(d.base_url);address=u.protocol+'//'+u.host+u.pathname;}catch{}return 'Server '+(i+1)+' · '+address;};
 const https=(d:any)=>d.schemes?.includes('https')??d.base_url?.startsWith('https:');
 const affected=(predicate:(d:any)=>boolean)=>destinations.map((d,i)=>({d,i})).filter(({d})=>predicate(d)).map(({d,i})=>label(d,i)).join('; ');
 if(risk==='Service TLS verification disabled'){
  const servers=affected(d=>d.tls?.verify===undefined&&https(d));
  return 'Service default: HTTPS server certificate verification is off. '+(servers?'Inherited by '+servers+'. Their identity will not be verified.':'No current HTTPS server inherits this default. It applies to servers without an override.');
 }
 for(const [prefix,kind] of [['TLS verification disabled: ','tls'],['Cleartext HTTP: ','http'],['Broad destination matching: ','broad']]){
  const matches=destinations.map((d,i)=>({d,i})).filter(({d})=>risk===prefix+(d.id??d.name??'destination')&&(kind==='tls'?(d.tls?.verify??proposed.tls?.verify)===false:kind==='http'?(d.base_url?.startsWith('http:')||d.schemes?.includes('http')):d.hosts?.some((h:any)=>Object.hasOwn(h,'suffix')||Object.hasOwn(h,'regex'))));
  if(!matches.length)continue;
  return matches.map(({d,i})=>{
   const server=label(d,i);
   if(kind==='http')return 'Unencrypted HTTP is allowed — '+server+'. HTTP requests and credentials are sent without transport encryption.';
   if(kind==='broad')return 'Broad server matching — '+server+'. Host suffix or regular expression rules allow more than one exact hostname.';
   return 'Server certificate verification is off — '+server+(d.tls?.verify===false?' overrides the service default.':' inherits the service default.')+(https(d)?' HTTPS requests will not verify the server’s identity.':' This applies if HTTPS is used; current allowed requests use HTTP.');
  }).join(' ');
 }
 if(risk==='Default allow: unmatched requests are allowed')return 'Default access is Allow. Requests that match no request rule are allowed.';
 if(risk.startsWith('Reduced response scanning: ')){
  const id=risk.slice('Reduced response scanning: '.length),index=(proposed.policy?.rules??[]).findIndex((r:any)=>r.id===id),rule=proposed.policy?.rules?.[index];
  return 'Reduced secret detection — Rule '+(index+1)+(rule?.reason?' · '+rule.reason:'')+'. Some checks on data returned by this service are disabled.';
 }
 if(risk==='Recovered service: reviewed current credentials, policy and access')return 'Recovered service: confirm you have reviewed its current credentials, request rules and who can use it.';
 return risk;
}
export const consoleServiceApprovalScript=String.raw`
const serviceExceptionLabel=${serviceExceptionLabel.toString()};
function serviceApprovalFooter(parent,review,editor){
 const summary=el('section');summary.className='approval-summary';summary.append(el('h2','Security exceptions'));
 if(review.exceptions.length){const list=el('ul');list.className='approval-exceptions';for(const risk of review.exceptions)list.append(el('li',serviceExceptionLabel(risk,review.proposed)));summary.append(list);}else summary.append(el('p','No security exceptions in these changes.'));
 parent.append(summary);
 const footer=el('div');footer.className='approval-actions';parent.append(footer);action(footer,'Back to edit',()=>renderEditor(editor.reviewReturnStep??3));action(footer,'Back to Services',()=>leaveEditor(()=>services()));
 const approve=action(footer,'Approve changes',()=>openServiceApproval(review,editor,approve));approve.className='';if(editor.approvalUncertain){approve.disabled=true;serviceApprovalStatusLink(footer,editor);}
}
function serviceApprovalStatusLink(parent,editor){action(parent,'Inspect current configuration',async()=>{try{await api('services/'+encodeURIComponent(editor.id));editor.approvalUncertain=false;editorDirty=false;serviceEditor=null;servicesSnapshot=await api('services');await serviceDetail(editor.id,'Configuration');banner.textContent='Current configuration loaded. Review it before preparing any new changes.';}catch(e){showError('Current status could not be verified. '+e.message);}});}
function openServiceApproval(review,editor,opener){
 const d=el('dialog');d.className='service-approval';d.setAttribute('aria-labelledby','service-approval-title');
 const title=el('h2','Approve changes');title.id='service-approval-title';title.tabIndex=-1;
 d.append(title,el('p','This will apply changes and make this the active configuration.'),el('p',(review.proposed.name||editor.id)+' · Reviewed revision '+review.base));
 const f=el('form');d.append(f);const checks=[];
 if(review.exceptions.length){f.append(el('p','Before changes can be applied, please review and acknowledge the following:'));for(const risk of review.exceptions){const label=el('label');label.className='approval-risk';const n=el('input');n.type='checkbox';const text=serviceExceptionLabel(risk,review.proposed),separator=text.includes(' — ')?' — ':'. ',at=text.indexOf(separator),copy=el('span');copy.append(el('strong',at<0?text:text.slice(0,at)));if(at>=0){const detail=el('span',text.slice(at+separator.length));detail.className='approval-risk-detail';copy.append(detail);}label.append(n,copy);f.append(label);checks.push({n,risk});}}
 const status=el('p');status.className='approval-status';status.setAttribute('role','status');f.append(status);const buttons=el('div');buttons.className='approval-actions';f.append(buttons);let pending=false,submitted=false;
 const scroll=window.scrollY;function close(){if(pending)return;d.close();d.remove();window.scrollTo(0,scroll);if(opener.isConnected)opener.focus({preventScroll:true});}
 const cancel=action(buttons,'Cancel',close),confirm=button(buttons,'Continue');
 function update(){const remaining=checks.filter(c=>!c.n.checked).length;confirm.disabled=pending||submitted||remaining>0;status.textContent=remaining?remaining+' acknowledgment'+(remaining===1?'':'s')+' remaining.':'Ready to apply.';}
 checks.forEach(c=>c.n.onchange=update);update();d.addEventListener('cancel',e=>{e.preventDefault();close();});boundCredentialFocus(d);
 f.onsubmit=async e=>{e.preventDefault();if(pending||submitted||checks.some(c=>!c.n.checked))return;pending=true;submitted=true;confirm.disabled=true;cancel.disabled=true;checks.forEach(c=>c.n.disabled=true);status.textContent='Applying changes…';d.setAttribute('aria-busy','true');
 let result;
 try{result=await api('service/apply',{id:editor.id,review:review.review,acknowledgments:checks.map(c=>c.risk)});}catch(error){
  pending=false;d.removeAttribute('aria-busy');opener.disabled=true;checks.forEach(c=>c.n.checked=false);cancel.disabled=false;cancel.textContent='Close';
  const known=error.status>=400&&error.status<500&&!error.operation;
  status.textContent=known?'Changes were not applied. '+error.message+' Review the current configuration before trying again.':'The result is not confirmed. Check current status before taking further action. Do not submit these changes again.';
  if(known){action(buttons,'Review again',async()=>{try{const fresh=await api('service/review',{id:editor.id});close();editor.step=editor.reviewReturnStep??3;renderReview(fresh);}catch(e){status.textContent=e.message+' Return to editing to resolve this issue.';}});}
  else {editor.approvalUncertain=true;serviceApprovalStatusLink(opener.parentElement,editor);const inspect=action(buttons,'Check current status',async()=>{inspect.disabled=true;try{const operation=error.operation?await api('operations/'+encodeURIComponent(error.operation)):null;const current=await api('services/'+encodeURIComponent(editor.id));editor.approvalUncertain=false;status.textContent=(operation?'Operation status: '+operation.status+'. ':'')+'Current service: '+current.lifecycle+' · revision '+current.revision+'. '+(current.draft?'A saved draft remains.':'No saved draft remains.')+' Inspect the current configuration before starting a new review.';action(buttons,'View current configuration',async()=>{close();editorDirty=false;serviceEditor=null;servicesSnapshot=await api('services');await serviceDetail(editor.id,'Configuration');});}catch(e){status.textContent='Status could not be verified. '+e.message+' Sign in again or ask the host operator to inspect the instance before retrying.';inspect.disabled=false;}});}
  return;
 }
 pending=false;d.removeAttribute('aria-busy');close();editorDirty=false;serviceEditor=null;
 try{servicesSnapshot=await api('services');await serviceDetail(editor.id);}catch(e){showError('Changes were applied, but the current view could not be loaded. Refresh to inspect the active configuration.');}
 banner.textContent='Applied '+(review.proposed.name||editor.id)+' · active revision '+result.revision+'.';
 };document.body.append(d);d.showModal();title.focus();
}
`;
