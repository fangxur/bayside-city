import {renderAccountEntry,renderAccountSettings} from './coop-account.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(snapshot){const url=URL.createObjectURL(new Blob([snapshot.city],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=(snapshot.name||'单人城市')+'-本机备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function setupAccountUI({client,library,current,localSaves,bind,load,loadLocal,removeSolo,removeLocal,removeShared,prepareLogout,openCoop,enterCoop,notify}){
 const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='coop-dialog account-dialog';dialog.setAttribute('aria-labelledby','account-title');document.body.append(dialog);
 let afterLogin=null,afterCancel=null,invitationEntry=false,generation=0;
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  const next=afterCancel;afterCancel=null;afterLogin=null;
  if(next)Promise.resolve(next()).catch(e=>notify(e.message,true));
 });
 let actionPending=false;
 const run=fn=>async event=>{
  if(actionPending)return;
  const button=event?.currentTarget,host=button?.closest('article')||dialog.querySelector('#account-body')||dialog;
  dialog.querySelectorAll('[data-action-error]').forEach(el=>el.remove());
  actionPending=true;if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
  try{await fn();}
  catch(e){
   const error=document.createElement('p');error.dataset.actionError='';error.className='account-action-error';error.setAttribute('role','alert');error.textContent=e.message;
   if(dialog.open&&host.isConnected){host.append(error);error.scrollIntoView({block:'nearest'});}else notify(e.message,true);
  }finally{actionPending=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
 };
 const confirmHere=(host,message,action)=>{
  dialog.querySelector('[data-delete-confirm]')?.remove();
  const panel=document.createElement('section');panel.dataset.deleteConfirm='';panel.className='account-delete-confirm';
  const copy=document.createElement('p');copy.textContent=message;
  const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary-button';cancel.textContent='取消';cancel.onclick=()=>panel.remove();
  const confirm=document.createElement('button');confirm.type='button';confirm.className='danger-button';confirm.textContent='确认删除';confirm.onclick=run(action);
  panel.append(copy,cancel,confirm);host.append(panel);panel.scrollIntoView({block:'nearest'});
 };
 const finish=async()=>{if(afterLogin){const next=afterLogin;afterLogin=null;afterCancel=null;dialog.close();await next();}else await render();};
 async function render(){
  const version=++generation;
  dialog.innerHTML='<div class="dialog-heading"><div><span class="eyebrow">YOUR ACCOUNT · YOUR CITIES</span><h2 id="account-title">账号与我的城市</h2></div><button class="plain-icon" data-close aria-label="关闭账号面板">×</button></div><div id="account-body"></div>';
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();const body=dialog.querySelector('#account-body');
  if(!client.identity){
   body.innerHTML=invitationEntry?'<p class="muted">登录后可以选择加入朋友的城市，也可以返回继续游览。登录不会自动加入共建。</p><div data-entry></div><button class="secondary-button" data-guest>暂不登录，返回城市邀请</button>':'<p class="muted">游客也能单机游玩。登录后，单人城市和合作城市都可以保存在同一个账号下。</p><div data-entry></div><button class="secondary-button" data-guest>暂不登录，继续游客单机</button>';
   renderAccountEntry(body.querySelector('[data-entry]'),client,finish,notify);
   body.querySelector('[data-guest]').onclick=()=>{afterLogin=null;dialog.close();};return;
  }
  if(!client.identity.account){
   body.innerHTML='<p>当前使用旧版玩家身份。绑定账号后会保留合作城市和市长身份，本地单人存档可单独选择绑定。</p><div data-entry></div><p><button class="secondary-button" data-legacy>旧身份备份与迁移</button></p>';
   renderAccountEntry(body.querySelector('[data-entry]'),client,finish,notify,{binding:true,cancel:()=>dialog.close()});
   body.querySelector('[data-legacy]').onclick=()=>{dialog.close();openCoop();};return;
  }
  body.innerHTML=`<section class="account-summary"><strong>${esc(client.identity.actor.name)}</strong><span>账号 · ${esc(client.identity.account.username)}</span><p>单人城市只有你能管理。合作城市可邀请朋友共建。账号存档保存在当前游戏服务器。</p></section><div class="coop-tabs"><button class="secondary-button" data-settings ${client.cityId?'disabled':''}>账号与登录设备</button><button class="secondary-button" data-logout ${client.cityId?'disabled':''}>退出账号</button></div>${client.cityId?'<p class="muted">离开合作城市后，可以退出账号或修改密码。</p>':''}<section data-current></section><h3>我的单人城市</h3><div class="account-city-list" data-solo>正在读取…</div><h3>我的合作城市</h3><div class="account-city-list" data-coop>正在读取…</div><button class="secondary-button" data-coop-open>创建或加入合作城市</button><section data-local></section>`;
  body.querySelector('[data-settings]').onclick=run(()=>renderAccountSettings(body,client,render,notify));
  body.querySelector('[data-logout]').onclick=run(async()=>{await prepareLogout();await client.logout();afterLogin=null;await render();});
  body.querySelector('[data-coop-open]').onclick=()=>{dialog.close();openCoop();};
  const active=current();
  if(active){
   const box=body.querySelector('[data-current]');
   box.innerHTML=`<h3>当前城市 · ${esc(active.snapshot.name)}</h3><p>${active.record?'账号单人城市 · 本机自动保存，并同步到账号':'游客本地城市 · 尚未绑定账号'}</p><button class="primary-button" data-bind>${active.record?'立即同步到账号':'绑定这座单人城市到账号'}</button><button class="secondary-button" data-export>导出本机进度</button>`;
   box.querySelector('[data-bind]').onclick=run(async()=>{await bind(active);await render();});
   box.querySelector('[data-export]').onclick=()=>download(current()?.snapshot||active.snapshot);
  }
  const locals=localSaves();
  if(locals.length&&!client.cityId){
   const box=body.querySelector('[data-local]');box.innerHTML='<h3>此浏览器的游客存档</h3><p class="muted">旧存档不会自动归入任何账号。先打开城市，再选择绑定；绑定成功后该城市归入账号，其他游客存档仍会保留。</p><div class="account-city-list">'+locals.map((s,i)=>`<article><strong>${esc(s.name||'本地城市')}</strong><small>${esc(new Date(s.savedAt).toLocaleString('zh-CN'))} · 仅此浏览器</small><div><button class="secondary-button" data-local-save="${i}">打开存档</button><button class="danger-button" data-local-delete="${i}">删除存档</button></div></article>`).join('')+'</div>';
   box.querySelectorAll('[data-local-save]').forEach(button=>button.onclick=()=>{dialog.close();loadLocal(locals[Number(button.dataset.localSave)]);});
   box.querySelectorAll('[data-local-delete]').forEach(button=>button.onclick=()=>{const save=locals[Number(button.dataset.localDelete)];confirmHere(button.closest('article'),`删除此浏览器里的「${save?.name||'本地城市'}」存档？该存档没有服务器副本，删除后无法撤销。`,async()=>{await removeLocal?.(save);await render();});});
  }
  const results=await Promise.allSettled([library.list(),client.request('/cities')]);
  if(version!==generation||!body.isConnected)return;
  const solo=body.querySelector('[data-solo]'),shared=body.querySelector('[data-coop]');
  if(results[0].status==='rejected')solo.textContent=results[0].reason.message;
  else{
   solo.innerHTML=results[0].value.map(row=>{const playing=active?.record?.id===row.id;return `<article><strong>${esc(row.snapshot?.name||row.name)}</strong><small>${row.error?'本机和服务器版本有冲突':row.dirty||row.pending?'本机有待同步进度':row.offline?'本机缓存':'已保存到账号'} · 单人${playing?' · 正在游玩':''}</small><div><button class="secondary-button" data-solo-open="${esc(row.id)}">继续建设</button>${row.error?`<button class="secondary-button" data-copy="${esc(row.id)}">本机进度另存新城</button><button class="secondary-button" data-server="${esc(row.id)}">读取服务器版本</button>`:''}<button class="danger-button" data-solo-delete="${esc(row.id)}">删除存档</button></div></article>`;}).join('')||'<p class="muted">还没有账号单人城市。可以新建一座，或绑定已有的本地城市。</p>';
   solo.querySelectorAll('[data-solo-open]').forEach(button=>button.onclick=run(async()=>{await load(await library.load(button.dataset.soloOpen));dialog.close();}));
   solo.querySelectorAll('[data-solo-delete]').forEach(button=>button.onclick=()=>{const row=results[0].value.find(item=>item.id===button.dataset.soloDelete),name=row?.snapshot?.name||row?.name||'这座城市';confirmHere(button.closest('article'),`永久删除「${name}」的账号存档？服务器版本、本机缓存和冲突备份都会删除，无法撤销。`,async()=>{const result=await (removeSolo?removeSolo(row):library.remove(row.id));if(!result?.active)await render();});});
   solo.querySelectorAll('[data-copy]').forEach(button=>button.onclick=run(async()=>{const old=await library.load(button.dataset.copy);const copy=library.create(old.snapshot);await load(copy);await library.flush(copy);await render();}));
   solo.querySelectorAll('[data-server]').forEach(button=>button.onclick=run(async()=>{
    const old=await library.load(button.dataset.server);download(old.snapshot);
    // Keep the local version as a separate city before fetching a different device's version.
    const copy=library.create(old.snapshot);await library.flush(copy);
    const server=await library.load(old.id,{remote:true});await load(server);await render();
   }));
  }
  if(results[1].status==='rejected')shared.textContent=results[1].reason.message;
  else{
   shared.innerHTML=results[1].value.map(row=>`<article><strong>${esc(row.name)}</strong><small>合作 · ${row.role==='owner'?'房主':'共建者'}</small><div><button class="secondary-button" data-shared="${esc(row.id)}">进入城市</button>${row.role==='owner'&&row.id!==client.cityId?`<button class="danger-button" data-shared-delete="${esc(row.id)}">删除合作城市</button>`:''}</div></article>`).join('')||'<p class="muted">还没有合作城市。</p>';
   shared.querySelectorAll('[data-shared]').forEach(button=>button.onclick=run(async()=>{await enterCoop(button.dataset.shared);dialog.close();}));
   shared.querySelectorAll('[data-shared-delete]').forEach(button=>button.onclick=()=>{const row=results[1].value.find(item=>item.id===button.dataset.sharedDelete);confirmHere(button.closest('article'),`永久删除合作城市「${row?.name||'未命名城市'}」？所有成员的正式进度、纪念存档和建设日志都会删除，无法撤销。`,async()=>{await (removeShared?removeShared(row):client.request('/cities/'+row.id,{method:'DELETE'}));await render();});});
  }
 }
 async function open({then,onCancel,invitation=false}={}){
  afterLogin=then||null;afterCancel=onCancel||null;invitationEntry=invitation;if(!dialog.open)dialog.showModal();dialog.innerHTML='<p>正在读取账号…</p>';
  try{if(!client.cityId){try{await client.refreshIdentity();}catch(e){if(!client.identity?.account)throw e;}}await render();}
  catch(e){dialog.innerHTML=`<p>${esc(e.message)}</p><button class="secondary-button" data-retry>重试</button><button class="secondary-button" data-close>回到游戏</button>`;dialog.querySelector('[data-retry]').onclick=()=>open({then:afterLogin,onCancel:afterCancel,invitation:invitationEntry});dialog.querySelector('[data-close]').onclick=()=>dialog.close();}
 }
 return {open,refresh:()=>{if(dialog.open)render().catch(e=>notify(e.message,true));}};
}
