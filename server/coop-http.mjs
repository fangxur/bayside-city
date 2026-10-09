import {gzipSync} from 'node:zlib';
import {networkInterfaces} from 'node:os';
import {CoopAuth} from './coop-auth.mjs';
import {SoloStore} from './solo-store.mjs';
import {CoopPresence} from './coop-presence.mjs';
export function invitationOrigin(req,{origin,lan=false,interfaces=networkInterfaces()}={}){
 if(origin)return origin;
 const url=new URL(`${req.socket.encrypted?'https':'http'}://${req.headers.host}`);
 if(lan&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
  const address=Object.values(interfaces).flat().find(item=>item&&!item.internal&&item.family==='IPv4'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address));
  if(address)url.hostname=address.address;
 }
 return url.origin;
}
export function publicOrigin(value){
 if(value===undefined||value==='')return null;
 try{
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.hostname.includes('*')||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('invalid');
  return url.origin;
 }catch{throw Error('PUBLIC_ORIGIN 必须是完整的游戏站点地址，例如 https://city.yunyousl.com.cn；不能包含路径、账号或通配符');}
}
export function coopHttp(store,{origin,lan=false,release='development'}={}){
 // Pin the public site explicitly: proxy headers supplied by a client are not authority.
 const allowedOrigin=publicOrigin(origin);
 const limits=new Map(),auth=new CoopAuth(store),solo=new SoloStore(store),presence=new CoopPresence(store);
 const send=(req,res,status,data,extra={})=>{let body=Buffer.from(JSON.stringify(data));const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra};if(body.length>2048&&/gzip/.test(req.headers['accept-encoding']||'')){body=gzipSync(body);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}res.writeHead(status,headers);res.end(body);};
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/'))return false;
  let responseHeaders={};
  try{
   const expectedOrigin=allowedOrigin||`${req.socket.encrypted?'https':'http'}://${req.headers.host}`;
   if(req.headers.origin&&req.headers.origin!==expectedOrigin)throw Object.assign(new Error('请求来源不匹配'),{status:403});
   const ip=req.socket.remoteAddress,key=ip+':'+Math.floor(Date.now()/60000),count=(limits.get(key)||0)+1;limits.set(key,count);if(limits.size>1000)limits.clear();if(count>1200)throw Object.assign(new Error('操作太频繁，请稍后再试'),{status:429});
   let data={};if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('请使用 JSON 请求'),{status:415});
    let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>6000000)throw Object.assign(new Error('请求过大'),{status:413});parts.push(chunk);}try{data=JSON.parse(Buffer.concat(parts).toString());if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid');}catch{throw Object.assign(new Error('请求格式无效'),{status:400});}
   }
   const p=url.pathname.split('/').filter(Boolean);let result;
   const bearer=(req.headers.authorization||'').replace(/^Bearer /,'');
   const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('bayside_session='))?.slice(16);
   const isAccountRoute=p[1]==='account';
   const setSession=result=>{
    responseHeaders['Set-Cookie']='bayside_session='+result.token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(expectedOrigin.startsWith('https:')?'; Secure':'');
    const {token,...safe}=result;return safe;
   };
   const clearSession=()=>{responseHeaders['Set-Cookie']='bayside_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(expectedOrigin.startsWith('https:')?'; Secure':'');};
   if(['POST','DELETE'].includes(req.method)&&(isAccountRoute||cookie)&&req.headers.origin!==expectedOrigin)throw Object.assign(Error('请从游戏页面提交操作'),{status:403});
   if(url.pathname==='/api/health'&&req.method==='GET'){
    store.db.prepare('SELECT 1').get();result={ok:true,release,accounts:1};
   }
   else if(p[1]==='invitations'&&req.method==='GET'&&(p.length===3||(p.length===4&&p[3]==='visit'))){
    result=p.length===3?store.invitationPreview(p[2]):store.visit(p[2],url.searchParams.get('since')??-1);
   }
   else if(isAccountRoute&&req.method==='POST'&&['register','login','recover'].includes(p[2])){
    auth.limit('ip:'+ip,80);
    if(cookie){try{auth.resolve(cookie);throw Object.assign(Error('请先退出当前账号'),{status:409});}catch(e){if(e.status!==401)throw e;}}
    if(bearer&&p[2]!=='register')throw Object.assign(Error('请先绑定或备份并退出原玩家身份，再登录其他账号'),{status:409});
    const device=req.headers['user-agent'];
    result=setSession(p[2]==='register'?await auth.register(data,bearer,device):p[2]==='login'?await auth.login(data,device):await auth.reset(data,device));
   }
   else 
   if(req.method==='POST'&&url.pathname==='/api/session'){const sessionKey=key+':session',sessions=(limits.get(sessionKey)||0)+1;limits.set(sessionKey,sessions);if(sessions>20)throw Object.assign(new Error('创建身份太频繁'),{status:429});result=store.session(data.name);}
   else{
    const identity=bearer?{actor:store.user(bearer)}:auth.resolve(cookie),actor=identity.actor;
    if(req.headers['x-coop-actor']&&req.headers['x-coop-actor']!==actor.id)throw Object.assign(Error('账号已在另一个标签页切换，请重新进入城市'),{status:409,code:'ACCOUNT_CHANGED'});
    if(req.method==='POST'&&identity.account&&req.headers['x-coop-actor']!==actor.id)throw Object.assign(Error('请刷新页面后继续操作'),{status:409,code:'ACCOUNT_CHANGED'});
    if(url.pathname==='/api/me'&&req.method==='GET')result=identity;
    else if(isAccountRoute){
     if(!identity.account)throw Object.assign(Error('请先绑定账号'),{status:401,code:'AUTH'});
     if(p[2]==='sessions'&&req.method==='GET')result=auth.sessions(identity);
     else if(p[2]==='logout'&&req.method==='POST'){result=auth.logout(identity);clearSession();}
     else if(p[2]==='revoke'&&req.method==='POST'){
      if(typeof data.id!=='string')throw Object.assign(Error('请选择登录设备'),{status:400});
      result=auth.logout(identity,data.id);if(data.id===identity.sessionId)clearSession();
     }
     else if(p[2]==='password'&&req.method==='POST')result=setSession(await auth.changePassword(identity,data,req.headers['user-agent']));
    }
    else if(p[1]==='solo-cities'){
     if(!identity.account)throw Object.assign(Error('请登录账号后管理单人城市'),{status:401,code:'AUTH'});
     if(p.length===2&&req.method==='GET')result=solo.list(actor);
     else if(p.length===3&&req.method==='GET')result=solo.get(actor,p[2]);
     else if(p.length===3&&req.method==='POST')result=solo.save(actor,p[2],data);
     else if(p.length===3&&req.method==='DELETE')result=solo.remove(actor,p[2]);
    }
    else if(p[1]==='cities'&&p.length===2){if(req.method==='GET')result=store.list(actor);else if(req.method==='POST')result=store.create(actor,data);}
    else if(url.pathname==='/api/join'&&req.method==='POST')result=store.join(data.code,actor);
    else if(p[1]==='cities'&&p[2]){
     const id=p[2],action=p[3];
     if(!action&&req.method==='GET')result=store.view(id,actor,url.searchParams.get('since')??-1);
     else if(!action&&req.method==='DELETE')result=store.deleteCity(id,actor);
     else if(action==='presence'&&req.method==='POST')result=presence.exchange(id,actor,data);
     else if(action==='commands'&&req.method==='POST'){
      result=await store.commandAsync(id,actor,data);
      // Return the committed view in the acknowledgement, avoiding a second
      // full-city round trip and a wait behind an older polling request.
      result={...result,view:store.view(id,actor)};
     }
     else if(action==='invite'&&req.method==='POST')result={...store.invite(id,actor,{reuse:data.reuse===true}),origin:invitationOrigin(req,{origin:allowedOrigin,lan})};
     else if(action==='members'&&req.method==='POST')result=store.remove(id,actor,data.memberId);
     else if(action==='logs'&&req.method==='GET')result=store.logs(id,actor,url.searchParams.get('before'));
     else if(action==='snapshots'&&req.method==='GET')result=store.snapshots(id,actor);
     else if(action==='export'&&req.method==='GET')result={city:store.exportSnapshot(id,actor,url.searchParams.get('snapshot'))};
    }
   }
   if(result===undefined)throw Object.assign(new Error('接口不存在'),{status:404});send(req,res,200,result,responseHeaders);
  }catch(e){const status=e.status||503;send(req,res,status,{ok:false,code:e.code||(status===503?'STORAGE':'INVALID'),message:status===503?'账号或存档服务暂不可用，请稍后重试；本机未同步的进度会保留。':e.message});if(status===503)console.error('City request failed:',e.message);}
  return true;
 };
}
