// Settings routes contain only a fixed non-secret section name. Draft inputs never enter URLs/storage.
export const consoleSettingsScript=String.raw`
const settingsSections=[['protection','Response protection'],['authentication','MCP authentication'],['limits','Limits'],['email','Email'],['backups','Backups & restore'],['health','Health & retention']];
let settingsSection='protection';
function permittedSettings(){return settingsSections.filter(([id])=>workspaceState?.user.role!=='Member'&&(id!=='backups'||workspaceState?.user.role==='Owner'));}
function settingsUrl(id){return location.pathname+'?settings='+encodeURIComponent(id);}
async function settings(id=settingsSection,push=true){
 if(!permittedSettings().some(([key])=>key===id)){form('Settings unavailable').remove();showError('This Settings destination is unavailable for your role.');action(content,'Back to Services',()=>services());return;}
 settingsSection=id;currentNav('settings-nav');
 if(push&&location.search!=='?settings='+id)history.pushState({settings:id},'',settingsUrl(id));
 try{form('Settings — '+settingsSections.find(([key])=>key===id)[1]).remove();
 const nav=el('nav');nav.className='settings-rail';nav.setAttribute('aria-label','Settings sections');
 for(const [key,label] of permittedSettings()){const a=el('a',label);a.href=settingsUrl(key);if(key===id)a.setAttribute('aria-current','page');a.onclick=e=>{e.preventDefault();settings(key);};nav.append(a);}
 const mobile=el('div');mobile.className='settings-mobile';choice(mobile,'Settings section','settings-section',permittedSettings(),id,value=>settings(value));content.append(mobile);
 const shell=el('div');shell.className='settings-layout';shell.append(nav);const panel=el('div');panel.className='settings-panel';panel.id='settings-panel';shell.append(panel);content.append(shell);
 const start=new Set(content.children);
 if(id==='protection')await responseProtectionSettings();
 if(id==='authentication'){await authenticationSettings();await externalRegistrySettings();}
 if(id==='limits')await operatingSettings();
 if(id==='email')await emailSettings();
 if(id==='backups')await backupSettings();
 if(id==='health'){await healthSettings();await retentionSettings();}
 for(const child of [...content.children])if(!start.has(child))panel.append(child);
 for(const d of panel.querySelectorAll(':scope>details'))d.open=true;
 const forms=[...panel.querySelectorAll('form')].filter(f=>[...f.querySelectorAll('button[type=submit]')].some(b=>/^Save /.test(b.textContent)));
 if(forms.length){for(const f of forms)f.hidden=true;const edit=action(panel,'Edit '+settingsSections.find(([key])=>key===id)[1],()=>{for(const f of forms)f.hidden=false;edit.hidden=true;const target=forms[0].querySelector('input,textarea,select');for(let d=target?.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;target?.focus();});panel.prepend(edit);}
 }catch(e){showError(e.message,e.operation);}
}
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('settings');if(id)settings(id,false);else services();});
document.querySelector('#settings-nav').onclick=()=>leaveEditor(()=>settings('protection'));
`;
