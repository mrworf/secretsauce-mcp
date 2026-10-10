// Native public clients select an ephemeral loopback port (RFC 8252 section 7.3).
// Every other redirect component remains registered exactly.
export function matchesOAuthRedirect(registered:string,requested:string):boolean {
 try{
  const a=new URL(registered),b=new URL(requested);
  if(a.username||a.password||b.username||b.password||a.hash||b.hash)return false;
  if(registered===requested)return true;
  if(a.href!==registered||b.href!==requested)return false;
  if(a.protocol!=='http:'||b.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(a.hostname)||a.hostname!==b.hostname||a.username||a.password||b.username||b.password||a.hash||b.hash)return false;
  return a.pathname===b.pathname&&a.search===b.search;
 }catch{return false;}
}
