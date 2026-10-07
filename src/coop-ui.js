import {renderCoopInvite} from './coop-invite.js';
import {renderAccountEntry,renderAccountSettings} from './coop-account.js';
import {cityGoalsForMapSize} from './city-goals.js';
import {DEFAULT_MAP_SIZE,MAP_SIZE_OPTIONS,validMapSize} from './grid.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupCoopUI({client,enter,currentCity,leave,locate,notify,openAccount,importCity,mapEditor}){
 const dialog=document.createElement('dialog');dialog.id='coop-dialog';dialog.className='coop-dialog';document.body.append(dialog);
 const button=(text,id)=>`<button class="secondary-button" id="${id}">${text}</button>`;
 let page='home',logs=[],before=null,paintLogs=null,refreshing=false,loadedCity=null;
 const identityTools=body=>{
  if(client.identity?.account)return;
  const section=document.createElement('details');section.className='coop-identity-tools';section.innerHTML='<summary>备份或恢复玩家身份</summary><p>旧版玩家可以导入之前备份的身份凭据，再绑定账号。尚未绑定账号时，换设备前请保存身份凭据。</p>'+(client.identity?'<button class="secondary-button" id="coop-export-identity">导出我的身份凭据</button>':'')+'<label>恢复身份凭据<input type="file" accept="application/json,.json" id="coop-import-identity"></label>';
  body.append(section);
  section.querySelector('#coop-export-identity')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'bayside-identity-v1',token:client.identity.token})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='小城-玩家身份凭据.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  section.querySelector('#coop-import-identity').onchange=run(async()=>{const file=section.querySelector('input').files[0];if(!file||file.size>2048)throw Error('请选择有效的身份凭据文件');const data=JSON.parse(await file.text());if(data.format!=='bayside-identity-v1'||typeof data.token!=='string')throw Error('身份凭据格式无效');await client.restoreIdentity(data.token);await render();});
 };
 const run=fn=>async()=>{try{await fn();}catch(e){notify(e.message,true);}};
 const confirmHere=(message,action)=>{
  const panel=document.createElement('section');panel.className='coop-confirm';
  panel.innerHTML='<p>'+esc(message)+'</p><button class="secondary-button" data-cancel>取消</button> <button class="primary-button" data-confirm>确认并执行</button>';
  dialog.querySelector('.coop-confirm')?.remove();dialog.querySelector('#coop-body').prepend(panel);
  panel.querySelector('[data-cancel]').onclick=()=>panel.remove();panel.querySelector('[data-confirm]').onclick=run(async()=>{panel.querySelector('[data-confirm]').disabled=true;try{await action();}finally{panel.remove();}});panel.scrollIntoView({block:'nearest'});
 };
 async function render(){
  paintLogs=null;
  if(loadedCity!==client.cityId){loadedCity=client.cityId;logs=[];before=null;}
  const active=!!client.cityId;
  dialog.innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">BUILD TOGETHER</span><h2>${active?'合作城市 · 建设日志':'和朋友一起建城'}</h2></div><button class="plain-icon" id="coop-close" aria-label="关闭合作面板">×</button></div><p class="muted">${active?'操作由服务器统一保存。每个人可独立查看地图，城市速度由房主控制。':'2–4 人共享城市和财政。合作存档保存在运行游戏的服务器上。'}</p><div id="coop-body"></div>`;
  dialog.querySelector('#coop-close').onclick=()=>dialog.close();const body=dialog.querySelector('#coop-body');
  if(!client.identity){const entry=document.createElement('section');body.append(entry);if(openAccount){entry.innerHTML='<p>合作建城需要一个账号，你的单人城市也可以保存在这个账号下。</p><button class="primary-button" data-login>登录或注册账号</button>';entry.querySelector('[data-login]').onclick=()=>{dialog.close();openAccount({then:open});};}else renderAccountEntry(entry,client,render,notify);identityTools(body);return;}
  if(!active){
   const cities=await client.request('/cities');
   const soloCity=currentCity();
   body.innerHTML=`<p>你好，${esc(client.identity.actor.name)}</p><form id="coop-create"><label>新合作城市名称<input id="coop-city-name" required maxlength="24" placeholder="给你们的城市起个名字"></label><label>1. 城市规模<select id="coop-map-size" required>${MAP_SIZE_OPTIONS.map(option=>`<option value="${option.size}">${option.name} · ${option.populationEstimate}</option>`).join('')}</select></label><label>2. 本局目标 <small>根据城市规模生成</small><select id="coop-city-goal" required></select></label><label class="checkbox-field"><input type="checkbox" id="coop-copy" ${soloCity?'':'disabled'}><span>复制当前单人城市（原存档保留，规模沿用原城市）</span></label><button class="primary-button">按此规模与目标创建合作城市</button></form><form id="coop-join"><label>朋友的邀请码<input id="coop-code" required placeholder="粘贴邀请码或邀请链接"></label><button class="secondary-button">加入朋友的城市</button></form><h3>我的合作城市</h3><div class="checkpoint-list">${cities.length?cities.map(c=>`<button data-enter="${esc(c.id)}">${esc(c.name)} <small>${c.role==='owner'?'房主':'共建者'} · v${c.revision}</small></button>`).join(''):'还没有合作城市。'}</div>`;
   if(importCity){const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='secondary-button coop-import-shortcut';shortcut.textContent='从存档创建合作城市';shortcut.onclick=()=>importCity();body.querySelector('#coop-create').before(shortcut);}
   const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('join'))body.querySelector('#coop-code').value=hash.get('join');
   const sizeSelect=body.querySelector('#coop-map-size'),goalSelect=body.querySelector('#coop-city-goal'),copy=body.querySelector('#coop-copy');
   let terrainDraft=null;
   if(mapEditor){
    copy.closest('label').insertAdjacentHTML('beforebegin','<div class="terrain-editor-shortcut"><div><strong>设计合作城市的地图</strong><p data-coop-map-summary>先画河流、海岸和树林，再邀请朋友共建。</p></div><button type="button" class="secondary-button" data-coop-map-edit>编辑地图</button></div>');
    body.querySelector('[data-coop-map-edit]').onclick=()=>mapEditor.open({mapSize:Number(sizeSelect.value),draft:terrainDraft||undefined,apply:draft=>{if(!body.isConnected)return;terrainDraft=draft;body.querySelector('[data-coop-map-summary]').textContent=`已使用 ${draft.mapSize} × ${draft.mapSize} 自定义地图`;}});
   }
   const renderGoals=()=>{goalSelect.innerHTML='<option value="">请选择并确认目标</option>'+cityGoalsForMapSize(Number(sizeSelect.value)).map(goal=>`<option value="${goal.id}">${goal.name} · ${goal.summary}</option>`).join('');};
   sizeSelect.onchange=()=>{terrainDraft=null;if(mapEditor)body.querySelector('[data-coop-map-summary]').textContent='已切换地图规模，可以重新编辑地形。';renderGoals();};
   copy.onchange=()=>{sizeSelect.disabled=copy.checked;if(mapEditor)body.querySelector('[data-coop-map-edit]').disabled=copy.checked;if(copy.checked){try{const size=Number(JSON.parse(soloCity).mapSize)||DEFAULT_MAP_SIZE;if(validMapSize(size))sizeSelect.value=String(size);}catch{sizeSelect.value=String(DEFAULT_MAP_SIZE);}}if(terrainDraft&&terrainDraft.mapSize!==Number(sizeSelect.value)){terrainDraft=null;if(mapEditor)body.querySelector('[data-coop-map-summary]').textContent='已切换地图规模，可以重新编辑地形。';}renderGoals();};
   renderGoals();
   body.querySelector('#coop-create').onsubmit=e=>{e.preventDefault();run(async()=>{const data={name:body.querySelector('#coop-city-name').value,mapSize:Number(sizeSelect.value),cityGoal:goalSelect.value};if(copy.checked)data.city=soloCity;else if(terrainDraft)data.terrainDraft=terrainDraft;const c=await client.request('/cities',{method:'POST',body:data});await enter(c.cityId);await render();})()};
   body.querySelector('#coop-join').onsubmit=e=>{e.preventDefault();run(async()=>{let code=body.querySelector('#coop-code').value.trim();if(code.includes('#'))code=new URLSearchParams(code.split('#')[1]).get('join')||code;const c=await client.request('/join',{method:'POST',body:{code}});await enter(c.cityId);await render();})()};
   body.querySelectorAll('[data-enter]').forEach(b=>b.onclick=run(async()=>{await enter(b.dataset.enter);await render();}));
   const account=document.createElement('section');account.className='coop-account-banner';body.prepend(account);
   if(client.identity.account){
    account.innerHTML=`<span>账号：${esc(client.identity.account.username)}</span>${button(openAccount?'我的城市与账号':'账号与登录设备','coop-account-settings')}${openAccount?'':button('退出当前账号','coop-account-logout')}`;
    account.querySelector('#coop-account-settings').onclick=run(()=>{if(openAccount){dialog.close();return openAccount();}return renderAccountSettings(body,client,render,notify);});
    if(account.querySelector('#coop-account-logout'))account.querySelector('#coop-account-logout').onclick=run(async()=>{if(openAccount){dialog.close();return openAccount();}await client.logout();await render();});
   }else{
    account.innerHTML='<strong>将当前玩家绑定账号，就能在多台设备继续建城</strong>'+button('绑定账号','coop-account-bind')+button('登录其他账号','coop-account-switch');
    account.querySelector('#coop-account-bind').onclick=()=>renderAccountEntry(body,client,render,notify,{binding:true});
    account.querySelector('#coop-account-switch').onclick=()=>confirmHere('先用下方“备份或恢复玩家身份”导出当前身份凭据。已有账号不会自动接管这些城市；确认已备份后再退出。',async()=>{await client.logout();await render();});
   }
   identityTools(body);return;
  }
  const view=client.view,owner=view.role==='owner';
  body.innerHTML=`<div class="coop-members">${view.members.map(m=>`<span>${m.online?'●':'○'} ${esc(m.name)} · ${m.role==='owner'?'房主':'共建者'}${owner&&m.id!==client.identity.actor.id?` <button class="text-button" data-remove="${esc(m.id)}">移除</button>`:''}</span>`).join('')}</div><div class="coop-tabs">${button('建设日志','coop-log-tab')}${button('存档与恢复','coop-save-tab')}${owner?button('邀请好友','coop-invite'):''}${button('离开合作城市','coop-leave')}</div><div id="coop-content"></div>`;
  body.querySelector('#coop-log-tab').onclick=()=>{page='home';logs=[];before=null;run(render)();};body.querySelector('#coop-save-tab').onclick=()=>{page='saves';run(render)();};
  body.querySelector('#coop-leave').onclick=run(async()=>{if(client.busy||(!client.accessDenied&&client.pending().length))throw Error('请等未确认的操作核对完成后再离开');leave();await client.refreshIdentity();await render();});
  body.querySelector('#coop-invite')?.addEventListener('click',()=>{const content=body.querySelector('#coop-content');let box=content.querySelector('.coop-invite');if(!box){box=document.createElement('section');box.className='coop-invite';content.prepend(box);}renderCoopInvite(box,client,notify);});
  body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>confirmHere('移除这位成员？原来的邀请也会失效，已建成果会保留。',async()=>{await client.request('/cities/'+client.cityId+'/members',{method:'POST',body:{memberId:b.dataset.remove}});await client.poll(true);await render();}));
  const content=body.querySelector('#coop-content');
  if(page==='saves'){
   const saves=await client.request('/cities/'+client.cityId+'/snapshots');
   content.innerHTML=`<form id="coop-save-form"><label>纪念存档名称<input maxlength="40" required placeholder="例如：第一座千人小城"></label><button class="primary-button">保存纪念存档</button></form><p class="muted">正式进度每次操作后保存；自动检查点最多保留 24 份，每日存档最多 30 份。</p><div class="coop-saves">${saves.map(s=>`<article><strong>${esc(s.name)}</strong><small>${new Date(s.time).toLocaleString('zh-CN')} · v${s.revision}</small><div>${button('复制为新合作城市','copy-'+s.id)}${button('导出','export-'+s.id)}${owner?button('恢复这座城市','restore-'+s.id):''}</div></article>`).join('')}</div>`;
   content.querySelector('form').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await client.command('saveSnapshot',[content.querySelector('input').value]);notify(r.message,!r.ok);await render();})()};
   for(const s of saves){
    content.querySelector('#copy-'+s.id).onclick=run(async()=>{const data=await client.request('/cities/'+client.cityId+'/export?snapshot='+s.id);const c=await client.request('/cities',{method:'POST',body:{name:(view.state.districtName+' · 副本').slice(0,24),city:data.city}});await enter(c.cityId);await render();});
    content.querySelector('#export-'+s.id).onclick=run(async()=>{const data=await client.request('/cities/'+client.cityId+'/export?snapshot='+s.id);const url=URL.createObjectURL(new Blob([data.city],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='合作城市-'+s.revision+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    content.querySelector('#restore-'+s.id)?.addEventListener('click',()=>{const version={epoch:client.view.epoch,revision:client.view.revision};confirmHere(`将整座合作城市恢复到「${s.name}」（v${s.revision}），所有成员之后的建设都会回退。系统会先保留当前进度备份，恢复后暂停城市。`,async()=>{const r=await client.command('restoreSnapshot',[s.id],version);notify(r.message,!r.ok);await render();});});
   }
  }else{
   if(!logs.length)logs=await client.request('/cities/'+client.cityId+'/logs');
   content.innerHTML=`<label>筛选建设日志<input id="coop-log-search" placeholder="玩家名字、建设或升级"></label><div class="coop-log-list"></div>${button('加载更早记录','coop-older')}`;
   const show=()=>{const query=content.querySelector('input').value;content.querySelector('.coop-log-list').innerHTML=logs.filter(l=>(l.name+l.message).includes(query)).map(l=>`<article><small>${new Date(l.time).toLocaleString('zh-CN')} · v${l.revision}${l.epoch!==client.view?.epoch?' · 历史分支':''}</small><p><b>${esc(l.name)}</b> · ${esc(l.message)}</p>${l.cost?`<small>${l.cost>0?'支出':'退回'} ¥${Math.abs(l.cost).toLocaleString('zh-CN')}</small>`:''}${l.cells.length&&l.epoch===client.view?.epoch?`<button class="text-button" data-locate-log="${l.id}">定位建设范围</button>`:''}</article>`).join('')||'<p>还没有匹配的记录。</p>';content.querySelectorAll('[data-locate-log]').forEach(b=>b.onclick=()=>{const log=logs.find(l=>l.id===Number(b.dataset.locateLog));dialog.close();locate(log);});};paintLogs=show;show();content.querySelector('input').oninput=show;
   content.querySelector('#coop-older').onclick=run(async()=>{before=logs.at(-1)?.id;const next=await client.request('/cities/'+client.cityId+'/logs?before='+(before||Number.MAX_SAFE_INTEGER));logs.push(...next);show();if(!next.length)content.querySelector('#coop-older').disabled=true;});
  }
 }
 async function open(){page='home';logs=[];before=null;dialog.innerHTML='<p>正在读取合作城市…</p>';if(!dialog.open)dialog.showModal();try{if(!client.cityId)await client.refreshIdentity();await render();}catch(e){dialog.innerHTML=`<p>${esc(e.message)}</p><button id="coop-retry">重新加载</button><button id="coop-dismiss">关闭</button>${client.cityId?'<button id="coop-exit-error">离开合作城市</button>':''}`;dialog.querySelector('#coop-retry').onclick=open;dialog.querySelector('#coop-dismiss').onclick=()=>dialog.close();dialog.querySelector('#coop-exit-error')?.addEventListener('click',run(async()=>{if(client.busy||(!client.accessDenied&&client.pending().length))throw Error('请等待未确认操作核对完成');leave();await client.refreshIdentity();await render();}));if(!client.cityId)identityTools(dialog);}}
 setInterval(async()=>{
  if(refreshing||!dialog.open||!client.cityId||page!=='home'||!paintLogs)return;
  refreshing=true;const city=client.cityId,paint=paintLogs;
  try{const latest=await client.request('/cities/'+city+'/logs');if(city===client.cityId&&paint===paintLogs){const map=new Map([...logs,...latest].map(l=>[l.id,l]));logs=[...map.values()].sort((a,b)=>b.id-a.id);paint();}}catch{}finally{refreshing=false;}
 },3000);
 return {open};
}
