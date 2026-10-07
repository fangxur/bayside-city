const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(name, value){const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function recoveryPanel(body, client, code, done){
 body.innerHTML=`<section class="coop-account-recovery"><h3>账号已保存，再收好这张恢复卡</h3><p>账号：<strong>${esc(client.identity.account.username)}</strong>。忘记密码时可以用恢复码找回。它只在这里显示一次，请单独保存，不要发给朋友。</p><label>恢复码<input readonly value="${esc(code)}" aria-label="账号恢复码"></label><div class="coop-recovery-actions"><button class="secondary-button" data-download>下载账号恢复卡</button><label class="checkbox-field"><input type="checkbox" data-saved><span>我已妥善保存恢复码</span></label></div><button class="primary-button" data-done disabled>完成并继续</button></section>`;
 body.querySelector('[data-download]').onclick=()=>download('小城-账号恢复卡.txt',`湾畔市账号恢复卡\n站点：${location.origin}\n账号：${client.identity.account.username}\n恢复码：${code}\n此码可重设密码，请保密。使用后会生成新的恢复码。\n`);
 body.querySelector('[data-saved]').onchange=e=>body.querySelector('[data-done]').disabled=!e.target.checked;
 body.querySelector('[data-done]').onclick=done;
}
export function renderAccountEntry(body,client,done,notify,{binding=false,cancel}={}){
 let mode=binding?'register':'login';
 function paint(){
  const register=mode==='register',recover=mode==='recover';
  body.innerHTML=`<section class="coop-account"><h3>${binding?'给当前玩家绑定账号':recover?'找回账号':register?'创建账号':'登录你的小城账号'}</h3><p class="muted">${binding?'绑定后保留所有城市、房主权限和建设记录，其他设备用这个账号登录即可。':'一个账号管理你的单人城市和合作城市。已有游客存档可在登录后选择绑定，未绑定的存档仍保存在本机。'}</p>${!binding?'<div class="coop-tabs"><button class="secondary-button" type="button" data-mode="login">登录</button><button class="secondary-button" type="button" data-mode="register">注册</button><button class="secondary-button" type="button" data-mode="recover">忘记密码</button></div>':''}<form><label>账号名<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="3～24 位字母、数字或下划线"></label>${register&&!binding?'<label>玩家名字<input name="name" required maxlength="24" autocomplete="nickname" placeholder="朋友在建设日志里看到的名字"></label>':''}${recover?'<label>账号恢复码<input name="recoveryCode" required maxlength="128" autocomplete="off"></label>':''}<label>${recover?'新密码':'密码'}<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="${register||recover?'new-password':'current-password'}" placeholder="至少 10 个字符"></label>${register||recover?'<label>再输入一次密码<input name="confirm" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label>':''}<p role="alert" class="coop-account-error"></p><button class="primary-button">${binding?'绑定账号并保留城市':recover?'重设密码':register?'注册账号':'登录'}</button></form>${binding?'<p class="muted">原来的身份凭据在绑定成功后失效。已有账号与旧玩家的城市暂不自动合并；请为这个旧玩家绑定一个新账号。</p><button class="secondary-button" data-cancel>返回</button>':''}</section>`;
  body.querySelectorAll('[data-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.mode===mode));button.onclick=()=>{mode=button.dataset.mode;paint();};});
  body.querySelector('[data-cancel]')?.addEventListener('click',cancel||done);
  const form=body.querySelector('form');
  form.onsubmit=async event=>{
   event.preventDefault();const button=form.querySelector('button');button.disabled=true;const error=form.querySelector('[role=alert]');error.textContent='';
   try{
    const data=Object.fromEntries(new FormData(form));if((register||recover)&&data.password!==data.confirm)throw Error('两次输入的密码不一致');delete data.confirm;
    const code=await client.authenticate(mode,data);form.reset();
    if(code)recoveryPanel(body,client,code,done);else await done();
   }catch(e){error.textContent=e.message;button.disabled=false;}
  };
 }
 paint();
}
export async function renderAccountSettings(body,client,done,notify){
 const sessions=await client.request('/account/sessions');
 body.innerHTML=`<section class="coop-account"><h3>账号 · ${esc(client.identity.account.username)}</h3><p>登录在 30 天后到期；退出本机不会让其他设备掉线。</p><h4>登录设备</h4><div class="coop-device-list">${sessions.map(s=>`<article><strong>${s.current?'当前设备':esc(s.device)}</strong><small>${s.current?esc(s.device)+' · ':''}最近使用：${new Date(s.seen).toLocaleString('zh-CN')}</small>${!s.current?`<button class="secondary-button" data-revoke="${esc(s.id)}">退出此设备</button>`:''}</article>`).join('')}</div><details><summary>修改密码</summary><p>修改后其他设备会退出，原恢复码也会失效，请保存新恢复码。</p><form><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128"></label><label>新密码<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><label>再输入新密码<input name="confirm" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><p role="alert" class="coop-account-error"></p><button class="primary-button">修改密码</button></form></details><button class="secondary-button" data-back>返回</button></section>`;
 body.querySelector('[data-back]').onclick=done;
 body.querySelectorAll('[data-revoke]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await client.request('/account/revoke',{method:'POST',body:{id:button.dataset.revoke}});await renderAccountSettings(body,client,done,notify);}catch(e){notify(e.message,true);button.disabled=false;}});
 const form=body.querySelector('form');form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));if(data.password!==data.confirm)throw Error('两次输入的密码不一致');delete data.confirm;const code=await client.authenticate('password',data);form.reset();recoveryPanel(body,client,code,done);}
  catch(e){form.querySelector('[role=alert]').textContent=e.message;button.disabled=false;}
 };
}
