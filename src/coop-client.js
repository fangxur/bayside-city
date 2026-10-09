const IDENTITY='bayside-coop:identity',PENDING='bayside-coop:pending:';
export class CoopClient{
 constructor({onState=()=>{},onStatus=()=>{},onNotice=()=>{},onAuthChange=()=>{},onPresence=()=>{},presenceVisible=()=>true}={}){
  this.onPresence=onPresence;this.presenceVisible=presenceVisible;this.presenceGeneration=0;this.presenceTimer=null;this.presenceHint={cursor:null,cells:[],tool:'inspect',valid:true};
  this.authEpoch=0;this.onAuthChange=onAuthChange;this.onState=onState;this.onStatus=onStatus;this.onNotice=onNotice;this.cityId=null;this.view=null;this.connected=false;this.accessDenied=false;this.busy=false;this.timer=null;
  try{this.identity=JSON.parse(localStorage.getItem(IDENTITY));}catch{this.identity=null;}
  this.storageListener=event=>{if(event.key!==IDENTITY)return;let next=null;try{next=JSON.parse(event.newValue);}catch{}if(JSON.stringify(next)===JSON.stringify(this.identity))return;this.authEpoch++;this.identity=next;this.onAuthChange({external:true});this.leave();this.onNotice('登录状态已在另一个标签页更改，请重新打开属于当前账号的城市。');};
  if(typeof window!=='undefined')window.addEventListener('storage',this.storageListener);
 }
 setIdentity(identity){const previous=this.identity;this.authEpoch++;this.identity=identity;if(identity)localStorage.setItem(IDENTITY,JSON.stringify(identity));else localStorage.removeItem(IDENTITY);if(previous?.actor?.id!==identity?.actor?.id||previous?.account?.username!==identity?.account?.username)this.onAuthChange();}
 async refreshIdentity(){
  try{const data=await this.request('/me',{fence:false});const identity=this.identity?.token?{token:this.identity.token,actor:data.actor}:data;this.setIdentity(identity);return identity;}
  catch(e){if(e.status!==401)throw e;
   // A successful binding may set the cookie even when its response was lost.
   if(this.identity?.token){try{const data=await this.request('/me',{fence:false,legacy:false});this.setIdentity(data);return data;}catch(cookieError){if(cookieError.status!==401)throw cookieError;}}
   this.setIdentity(null);return null;}
 }
 async authenticate(action,body){
  if(this.cityId||this.busy)throw Error('请先离开合作城市');
  const data=await this.request('/account/'+action,{method:'POST',body});
  const {recoveryCode,...identity}=data;this.setIdentity(identity);return recoveryCode;
 }
 async logout(){
  if(this.cityId||this.busy)throw Error('请先离开合作城市');
  if(this.identity?.account){try{await this.request('/account/logout',{method:'POST',body:{}});}catch(e){if(e.status!==401)throw e;}}
  this.setIdentity(null);
 }
 async request(path,{method='GET',body,fence=true,legacy=true}={}){
  const epoch=this.authEpoch,identity=this.identity;
  const res=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(legacy&&identity?.token?{Authorization:'Bearer '+identity.token}:{}),...(fence&&identity?.actor?{'X-Coop-Actor':identity.actor.id}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  const data=await res.json();if(epoch!==this.authEpoch)throw Object.assign(Error('登录状态已更改，未确认的操作会保留供原账号核对'),{code:'ACCOUNT_CHANGED'});if(!res.ok)throw Object.assign(new Error(data.message||'合作服务暂不可用'),{status:res.status,code:data.code});return data;
 }
 async restoreIdentity(token){
  if(this.cityId)throw Error('请先离开合作城市');
  const previous=this.identity;this.identity={token};
  try{const {actor}=await this.request('/me');this.setIdentity({token,actor});}catch(e){this.identity=previous;throw e;}
 }
 async identify(name){if(this.identity)return;this.setIdentity(await this.request('/session',{method:'POST',body:{name}}));}
 status(){this.onStatus(this.accessDenied?'访问权限已变更 · 可离开合作城市':this.busy?'正在保存到合作城市…':!this.connected?'连接中断 · 合作城市只读':this.pending().length?'正在核对未确认的操作…':'已保存到合作城市 · v'+(this.view?.revision??0));}
 pending(){const list=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(PENDING))continue;try{const item=JSON.parse(localStorage.getItem(key));if(item.actor===this.identity?.actor.id&&item.city===this.cityId)list.push({key,...item});}catch{}}return list.sort((a,b)=>a.time-b.time);}
 async enter(id){this.leave();while(this.polling)await new Promise(resolve=>setTimeout(resolve,20));this.cityId=id;await this.poll(true);if(!this.connected)throw Error('无法读取合作城市');this.timer=setInterval(()=>this.poll().catch(()=>{}),1500);this.presenceTimer=setInterval(()=>this.exchangePresence(),500);return this.view;}
 leave(){
  if(this.presenceTimer&&this.cityId&&this.view&&!this.busy)this.request('/cities/'+this.cityId+'/presence',{method:'POST',body:{epoch:this.view.epoch,cursor:null,cells:[],tool:'inspect'}}).catch(()=>{});
  clearInterval(this.timer);clearInterval(this.presenceTimer);this.presenceTimer=null;this.presenceGeneration++;this.presenceInFlight=null;this.presenceUnsupported=false;this.presenceHint={cursor:null,cells:[],tool:'inspect',valid:true};this.onPresence([]);
  this.timer=null;this.cityId=null;this.view=null;this.connected=false;this.accessDenied=false;
 }
 setPresence(cursor,cells=[],tool='inspect',valid=true){this.presenceHint={cursor:cursor?{x:cursor.x,y:cursor.y}:null,cells:cells.slice(0,256).map(p=>({x:p.x,y:p.y})),tool,valid};}
 async exchangePresence(){
  const id=this.cityId,generation=this.presenceGeneration;
  if(!id||!this.view||!this.connected||this.presenceUnsupported||this.presenceInFlight===generation)return;
  this.presenceInFlight=generation;
  const hidden=!this.presenceVisible()||(typeof document!=='undefined'&&document.hidden);
  try{
   const result=await this.request('/cities/'+id+'/presence',{method:'POST',body:{epoch:this.view.epoch,...(hidden?{cursor:null,cells:[],tool:'inspect'}:this.presenceHint)}});
   if(generation===this.presenceGeneration&&id===this.cityId)this.onPresence(result.presence||[]);
  }catch(error){if(generation===this.presenceGeneration){this.onPresence([]);if(error.status===404)this.presenceUnsupported=true;}}
  finally{if(this.presenceInFlight===generation)this.presenceInFlight=null;}
 }
 acceptView(data){
  if(this.view&&data.revision<this.view.revision)return;
  const reset=this.view&&data.epoch!==this.view.epoch;
  this.view={...this.view,...data,...(data.state?{renderPlans:data.renderPlans}:{})};
  this.onState(this.view,!!data.state,reset);
 }
 async poll(force=false){
  const id=this.cityId,epoch=this.authEpoch;if(!id||this.polling)return;this.polling=true;
  try{
   const data=await this.request('/cities/'+id+(force?'':'?since='+(this.view?.revision??-1)));
   if(id!==this.cityId||epoch!==this.authEpoch)return;this.connected=true;this.accessDenied=false;
   this.acceptView(data);
  }catch(e){if(id===this.cityId&&epoch===this.authEpoch){this.connected=false;if([401,403].includes(e.status)||e.code==='ACCOUNT_CHANGED'){if(!this.accessDenied)this.onNotice(e.message+'。可离开此城；未确认操作会留待恢复权限后核对。');this.accessDenied=true;}}}
  finally{this.polling=false;this.status();}
  if(this.connected&&!this.busy&&this.pending().length)await this.recover();
 }
 async recover(){
  if(this.busy)return;this.busy=true;this.status();
  const city=this.cityId,epoch=this.authEpoch;
  try{for(const item of this.pending()){
   if(city!==this.cityId||epoch!==this.authEpoch)break;
   try{const result=await this.request('/cities/'+city+'/commands',{method:'POST',body:item.command});localStorage.removeItem(item.key);this.onNotice(result.ok?'已核对并保存：'+result.message:result.message);}
   catch(e){if(e.status>=400&&e.status<500&&![401,403,429].includes(e.status)){localStorage.removeItem(item.key);this.onNotice(e.message);}else throw e;}
  }}catch{this.connected=false;}finally{this.busy=false;this.status();}
  if(this.connected)await this.poll(true);
 }
 async command(method,args,expected=this.view){
  if(!this.connected||!this.view)return {ok:false,message:'连接中断，请同步城市后再建设'};
  if(this.busy||this.pending().length)return {ok:false,message:'上一项操作还在保存或核对，请稍候'};
  const city=this.cityId,epoch=this.authEpoch,command={commandId:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join(''),epoch:expected.epoch,baseRevision:expected.revision,method,args:structuredClone(args)};
  const key=PENDING+command.commandId;try{localStorage.setItem(key,JSON.stringify({actor:this.identity.actor.id,city,command,time:Date.now()}));}catch{return {ok:false,message:'无法记录待确认操作，请释放浏览器空间后再试'};}
  this.busy=true;this.status();let result;
  try{
   result=await this.request('/cities/'+city+'/commands',{method:'POST',body:command});localStorage.removeItem(key);
   if(city===this.cityId&&epoch===this.authEpoch&&result.view?.state){this.acceptView(result.view);this.connected=true;this.accessDenied=false;}
  }catch(e){const rejected=e.status>=400&&e.status<500&&![401,403,429].includes(e.status);if(rejected)localStorage.removeItem(key);this.connected=false;result={ok:false,message:rejected?e.message:'尚未确认保存结果，重连后会自动核对，请勿重复建设。'};}
  finally{this.busy=false;}
  // Await the authoritative snapshot before existing UI handlers inspect the simulation.
  if(city===this.cityId&&epoch===this.authEpoch&&!result.view?.state){while(this.polling)await new Promise(resolve=>setTimeout(resolve,20));await this.poll(true);}
  this.status();return result;
 }
}
