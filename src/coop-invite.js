const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const requests=new WeakMap();

export async function renderCoopInvite(container,client,notify){
 const city=client.cityId,request={};requests.set(container,request);
 container.hidden=!city;
 if(!city){container.replaceChildren();return;}
 const heading='<h3>邀请朋友共建</h3>';
 if(client.view?.role!=='owner'){
  container.innerHTML=heading+'<p>请联系房主获取这座城市的邀请码。</p>';return;
 }
 const active=()=>container.isConnected&&client.cityId===city&&requests.get(container)===request;
 container.innerHTML=heading+'<p role="status">正在读取邀请码…</p>';
 try{
  const invitation=await client.request('/cities/'+city+'/invite',{method:'POST',body:{reuse:true}});
  if(!active())return;
  const url=new URL(location.pathname,invitation.origin||location.origin);url.hash='join='+encodeURIComponent(invitation.code);
  const localOnly=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  container.innerHTML=heading+`<label>城市邀请码<div class="coop-invite-field"><input aria-label="城市邀请码" readonly value="${esc(invitation.code)}"><button type="button" class="secondary-button" data-copy-invite>复制邀请码</button></div></label><label>邀请链接<div class="coop-invite-field"><input aria-label="邀请链接" readonly value="${esc(url.href)}"><button type="button" class="secondary-button" data-copy-invite>复制链接</button></div></label><p>有效至 ${esc(new Date(invitation.expires).toLocaleString('zh-CN'))} · 最多 4 人共建</p><p>${localOnly?'当前链接仅能在本机打开。开启局域网模式后，重新打开此窗口获取联机链接。':'把链接发给同一局域网或能访问此地址的朋友，也可以在合作大厅输入邀请码加入。'}</p>`;
  container.insertAdjacentHTML('beforeend','<p>朋友无需账号也能通过邀请链接先游览城市；想参与建设时，再登录或注册并选择加入。游客不占共建名额。</p>');
  for(const button of container.querySelectorAll('[data-copy-invite]'))button.onclick=async()=>{
   const input=button.previousElementSibling;let copied=false;
   try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(input.value);copied=true;}}catch{}
   if(!copied){input.focus();input.select();try{copied=document.execCommand('copy');}catch{}}
   if(copied){const label=input.getAttribute('aria-label')==='城市邀请码'?'复制邀请码':'复制链接';button.textContent='已复制';setTimeout(()=>{button.textContent=label;},2000);}
   notify(copied?'已复制，可以发给朋友了。':'已选中内容，请长按复制或按 Ctrl / ⌘ + C。');
  };
 }catch(e){
  if(!active())return;
  container.innerHTML=heading+`<p role="alert">${esc(e.message||'暂时无法读取邀请码')}</p><button type="button" class="secondary-button" data-retry-invite>重新加载邀请码</button>`;
  container.querySelector('[data-retry-invite]').onclick=()=>renderCoopInvite(container,client,notify);
 }
}
