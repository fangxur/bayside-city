import {CityRenderer} from './renderer.js';
import {CitySimulation} from './simulation.js';
import {InvitationVisit,readInvitation} from './coop-visit.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value||0).toLocaleString('zh-CN');

export function setupCityVisit({isLoggedIn,openAccount,join,onClose}){
 const dialog=document.createElement('dialog');dialog.id='city-visit-dialog';dialog.className='city-visit-dialog';
 dialog.setAttribute('aria-labelledby','city-visit-title');document.body.append(dialog);
 let code='',summary=null,renderer=null,session=null,request=null,generation=0,joining=false,simulation=null;
 const find=selector=>dialog.querySelector(selector);
 const clean=()=>{generation++;request?.abort();request=null;session?.stop();session=null;renderer?.dispose();renderer=null;simulation=null;};
 dialog.addEventListener('close',()=>{if(!dialog.open){clean();onClose?.();}});
 dialog.addEventListener('cancel',event=>{if(joining)event.preventDefault();});
 const close=()=>{if(joining)return;clean();dialog.close();};
 const bindClose=()=>{find('[data-visit-close]').onclick=close;};
 const heading=(eyebrow,title)=>`<div class="dialog-heading"><div><div class="eyebrow">${eyebrow}</div><h2 id="city-visit-title">${esc(title)}</h2></div><button type="button" class="secondary-button" data-visit-close aria-label="关闭城市邀请">×</button></div>`;
 const joinCity=async()=>{
  if(joining)return;
  if(!isLoggedIn()){
   const invited=code;close();openAccount({then:()=>open(invited),onCancel:()=>open(invited),invitation:true});return;
  }
  joining=true;const button=find('[data-visit-join]'),message=find('[data-visit-status]');
  button.disabled=true;button.textContent='正在加入…';find('[data-visit-close]').disabled=true;
  try{await join(code);clean();dialog.close();}
  catch(error){if(dialog.open){message.textContent=error.message;button.textContent='加入共建';button.disabled=false;find('[data-visit-close]').disabled=false;}}
  finally{joining=false;}
 };
 const joinButton=()=>`<button class="secondary-button" type="button" data-visit-join>${isLoggedIn()?'加入共建':'登录 / 注册后加入'}</button>`;
 const showError=error=>{
  clean();dialog.classList.remove('is-touring');
  dialog.innerHTML=heading('CITY INVITATION','暂时无法游览')+`<p role="alert">${esc(error.message)}</p><button type="button" class="primary-button" data-visit-retry>重新读取邀请</button>`;
  bindClose();find('[data-visit-retry]').onclick=()=>open(code);
 };
 const inspect=cell=>{
  if(!cell||!simulation)return;
  const info=simulation.getInfo(cell.x,cell.y);renderer.selectCell(cell);
  const panel=find('[data-visit-inspector]');panel.hidden=false;
  panel.innerHTML=`<button type="button" class="text-button" aria-label="收起建筑详情" data-inspector-close>收起</button><h3>${esc(info.title)}</h3><p>${esc(info.subtitle)}</p><dl>${info.metrics.slice(0,8).map(item=>`<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl>`;
  find('[data-inspector-close]').onclick=()=>{panel.hidden=true;renderer.selectCell(null);};
 };
 const tour=()=>{
  clean();dialog.classList.add('is-touring');
  dialog.innerHTML=`<header class="city-visit-header"><div><span class="city-visit-badge">游客游览 · 仅查看</span><h2 id="city-visit-title">${esc(summary.name)}</h2><p data-visit-stats>${number(summary.population)} 位居民 · ${number(summary.buildings)} 栋建筑</p></div><div class="city-visit-actions"><button type="button" class="primary-button" data-visit-join>加入共建</button><button type="button" class="secondary-button" data-visit-close>结束游览</button></div></header><div class="city-visit-map" data-visit-map></div><aside class="city-visit-inspector" data-visit-inspector hidden></aside><footer class="city-visit-footer"><div><strong data-visit-status role="status">正在打开城市…</strong><p>拖动游览 · 滚轮或双指缩放 · 点击建筑查看详情</p></div><nav aria-label="游览视角"><button type="button" data-camera="in" aria-label="放大">＋</button><button type="button" data-camera="out" aria-label="缩小">−</button><button type="button" data-camera="rotate">旋转</button><button type="button" data-camera="home">全景</button><button type="button" data-lighting aria-pressed="false">欣赏夜景</button></nav></footer>`;
  bindClose();find('[data-visit-join]').onclick=joinCity;
  const frame=()=>{
   if(!simulation)return;
   const buildings=simulation.state.buildings,size=simulation.state.mapSize||64;
   const xs=buildings.map(b=>b.x+(b.footprint||1)/2),ys=buildings.map(b=>b.y+(b.footprint||1)/2);
   const minX=xs.length?Math.min(...xs):size*.25,maxX=xs.length?Math.max(...xs):size*.75;
   const minY=ys.length?Math.min(...ys):size*.25,maxY=ys.length?Math.max(...ys):size*.75;
   renderer.viewSize=Math.min(65,Math.max(22,(maxX-minX+maxY-minY)*.55));renderer.focusCell((minX+maxX)/2,(minY+maxY)/2);
  };
  try{
   renderer=new CityRenderer(find('[data-visit-map]'),{onSelect:inspect});renderer.setTool('inspect');
   renderer.canvas.setAttribute('aria-label','城市游览地图；拖动平移，滚轮或双指缩放，点击建筑查看详情。游客不能建设。');
   renderer.setLightingMode('day');
   for(const button of dialog.querySelectorAll('[data-camera]'))button.onclick=()=>{
    if(button.dataset.camera==='home')frame();
    else if(button.dataset.camera==='rotate')renderer.rotate();
    else renderer.zoomBy(button.dataset.camera==='in'?.8:1.25);
   };
   find('[data-lighting]').onclick=event=>{
    const button=event.currentTarget,night=button.getAttribute('aria-pressed')!=='true';
    renderer.setLightingMode(night?'night':'day');button.setAttribute('aria-pressed',String(night));button.textContent=night?'回到白天':'欣赏夜景';
   };
   session=new InvitationVisit(code,{onView:view=>{
    if(view.state){
     const first=!simulation;simulation=Object.create(CitySimulation.prototype);simulation.state=view.state;simulation._undo=null;
     renderer.setState(view.state,{sameWorld:!first});renderer.setSpeed(view.speed);if(first)frame();
     find('#city-visit-title').textContent=view.state.districtName;
     find('[data-visit-stats]').textContent=`${number(view.state.stats.population)} 位居民 · ${number(view.state.buildings.length)} 栋建筑`;
    }
    // Animate streets, but never run a local city simulation or change the shared clock.
    renderer.setPaused(false);find('[data-visit-status]').textContent=view.paused?'城市已暂停 · 自由游览中':'游览中 · 自动同步城市近况';
   },onError:(error,ended)=>{if(ended)showError(error);else find('[data-visit-status]').textContent='连接暂时中断，正在重试；当前显示上次的城市画面。';}});
   session.start();
  }catch(error){showError(error);}
 };
 async function open(invitationCode){
  if(joining)return;
  clean();code=String(invitationCode||'').trim();dialog.classList.remove('is-touring');
  dialog.innerHTML=heading('CITY INVITATION','朋友邀请你来逛逛')+'<p role="status">正在读取城市邀请…</p>';
  bindClose();if(!dialog.open)dialog.showModal();
  const current=generation;request=new AbortController();
  try{
   summary=await readInvitation(code,{signal:request.signal});if(current!==generation||!dialog.open)return;
   dialog.innerHTML=heading('CITY INVITATION',summary.name)+`<p class="city-visit-intro">${esc(summary.host)} 邀请你来这座城市做客。<br>先逛一逛街区、看看夜景，喜欢的话再一起建设。</p><div class="city-visit-facts"><div><strong>${number(summary.population)}</strong><span>城市居民</span></div><div><strong>${number(summary.buildings)}</strong><span>已建建筑</span></div><div><strong>${summary.memberCount} / ${summary.maxMembers}</strong><span>共建成员</span></div></div><div class="city-visit-choice"><button type="button" class="primary-button" data-visit-start>以游客身份游览 <span aria-hidden="true">→</span></button>${joinButton()}</div><p class="city-visit-note">无需账号 · 不占共建名额 · 可随时结束游览</p><p data-visit-status role="status">${summary.memberCount>=summary.maxMembers?'共建名额已满，仍可自由游览。已有成员可以登录后进入。':'登录后，由你决定是否加入共建。'}</p>`;
   bindClose();find('[data-visit-start]').onclick=tour;find('[data-visit-join]').onclick=joinCity;
  }catch(error){if(current===generation&&dialog.open)showError(error);}
 }
 return {open,close};
}
