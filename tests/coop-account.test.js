import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {CoopStore} from '../server/coop-store.mjs';
import {CoopAuth} from '../server/coop-auth.mjs';
import {coopHttp} from '../server/coop-http.mjs';
const password='correct horse 小城 battery';
function setup(t){const dir=mkdtempSync(path.join(os.tmpdir(),'bayside-account-'));const store=new CoopStore(path.join(dir,'city.sqlite'));t.after(()=>{try{store.close();}catch{}rmSync(dir,{recursive:true,force:true});});return {store,dir};}
async function call(handler,path,{body,token,cookie,actor,origin='https://city.test'}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);req.method=body===undefined?'GET':'POST';req.socket={remoteAddress:'test'};req.headers={host:'city.test','content-type':'application/json',...(origin?{origin}:{}),...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),...(actor?{'x-coop-actor':actor}:{}),'user-agent':'Test browser'};
 let status,headers,text;await handler(req,{writeHead(s,h){status=s;headers=h;},end(b){text=String(b);}},new URL(path,'https://city.test'));return {status,headers,data:JSON.parse(text),cookie:headers['Set-Cookie']?.split(';')[0]};
}
test('binding a legacy owner preserves cities, logs and idempotent commands across two devices and restarts',async t=>{
 const {store,dir}=setup(t),guest=store.session('原市长'),id=store.create(guest.actor,{name:'旧城市'}).cityId;
 const command={commandId:'old-receipt',epoch:1,baseRevision:0,method:'build',args:['park',[{x:10,y:29}]]};
 assert(store.command(id,guest.actor,command).ok);
 const auth=new CoopAuth(store);const account=await auth.register({username:'My_Mayor',password},guest.token,'电脑');
 assert.equal(account.actor.id,guest.actor.id);assert.equal(account.account.username,'my_mayor');assert.throws(()=>store.user(guest.token),{status:401});
 const mobile=await auth.login({username:'MY_MAYOR',password},'手机');assert.equal(mobile.actor.id,account.actor.id);
 const before=store.view(id,mobile.actor);assert.equal(before.role,'owner');assert.equal(before.members.length,1);
 assert(store.command(id,mobile.actor,command).duplicate);assert.equal(store.view(id,mobile.actor).state.money,before.state.money);
 const second={commandId:'phone-build',epoch:1,baseRevision:1,method:'build',args:['park',[{x:12,y:29}]]};
 assert(store.command(id,mobile.actor,second).ok);
 const collision={...second,commandId:'pc-build'};assert(!store.command(id,account.actor,collision).ok);
 assert.equal(store.view(id,account.actor).state.money,28800);
 const logs=store.logs(id,account.actor);assert(logs.every(log=>log.actor===guest.actor.id));
 const another=new CoopStore(path.join(dir,'city.sqlite'));t.after(()=>another.close());const restored=new CoopAuth(another);
 assert.equal(restored.resolve(mobile.token).actor.id,guest.actor.id);assert.equal(another.list(account.actor)[0].role,'owner');
 const row=store.db.prepare('SELECT * FROM accounts').get();assert(!JSON.stringify(row).includes(password));assert.notEqual(row.recovery_hash,account.recoveryCode);
});
test('one account cannot claim another guest, and concurrent registrations bind only once',async t=>{
 const {store}=setup(t),auth=new CoopAuth(store),a=store.session('甲'),b=store.session('乙');
 const attempts=await Promise.allSettled([auth.register({username:'first',password},a.token),auth.register({username:'second',password},a.token)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM accounts').get().n,1);assert.equal(store.user(b.token).id,b.actor.id);
 await assert.rejects(auth.register({username:'fake',password,actor:b.actor.id},'bad-token'),{status:401});
 const bound=attempts.find(r=>r.status==='fulfilled').value;
 await assert.rejects(auth.login({username:bound.account.username,password:'wrong password here'}),{status:401});
 await assert.rejects(auth.register({username:bound.account.username.toUpperCase(),password,name:'别人'}),{status:409});
});
test('device revocation is scoped; password changes and single-use recovery invalidate prior sessions',async t=>{
 const {store}=setup(t);let now=100000;store.now=()=>now;const auth=new CoopAuth(store);
 const a=await auth.register({username:'mayor',name:'市长',password});const b=await auth.login({username:'mayor',password},'手机');
 const other=await auth.register({username:'other',name:'朋友',password});auth.logout(other,b.sessionId);assert(auth.resolve(b.token));
 auth.logout(a,b.sessionId);assert.throws(()=>auth.resolve(b.token),{status:401});assert(auth.resolve(a.token));
 const changed=await auth.changePassword(a,{currentPassword:password,password:'another secret password'},'电脑');
 assert.throws(()=>auth.resolve(a.token),{status:401});await assert.rejects(auth.reset({username:'mayor',password,recoveryCode:a.recoveryCode}),{status:401});
 const reset=await auth.reset({username:'mayor',password,recoveryCode:changed.recoveryCode},'新电脑');
 assert.equal(reset.actor.id,a.actor.id);assert.throws(()=>auth.resolve(changed.token),{status:401});
 await assert.rejects(auth.reset({username:'mayor',password,recoveryCode:changed.recoveryCode}),{status:401});
 now+=31*86400000;assert.throws(()=>auth.resolve(reset.token),{status:401});
});
test('HTTP uses secure HttpOnly cookies, rejects CSRF and mismatched actors, and permits two devices',async t=>{
 const {store}=setup(t),handler=coopHttp(store,{origin:'https://city.test',release:'test-release'});
 const registered=await call(handler,'/api/account/register',{body:{username:'mayor',name:'市长',password}});
 assert.equal(registered.status,200);assert(registered.cookie);assert.match(registered.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);assert.match(registered.headers['Set-Cookie'],/Secure/);assert(!registered.data.token);
 const cookie=registered.cookie,actor=registered.data.actor.id;
 assert.equal((await call(handler,'/api/cities',{cookie,actor,body:{name:'新城'},origin:null})).status,403);
 assert.equal((await call(handler,'/api/cities',{cookie,actor:'someone-else',body:{name:'新城'}})).status,409);
 assert.equal((await call(handler,'/api/cities',{cookie,body:{name:'新城'}})).status,409);
 const created=await call(handler,'/api/cities',{cookie,actor,body:{name:'新城'}});assert.equal(created.status,200);
 const second=await call(handler,'/api/account/login',{body:{username:'mayor',password}});assert.equal(second.status,200);assert.notEqual(second.cookie,cookie);
 const listed=await call(handler,'/api/cities',{cookie:second.cookie,actor});assert.equal(listed.data[0].id,created.data.cityId);
 assert.equal((await call(handler,'/api/account/login',{cookie,body:{username:'mayor',password}})).status,409);
 const sessions=await call(handler,'/api/account/sessions',{cookie,actor});assert.equal(sessions.data.length,2);assert(sessions.data.every(s=>!s.token_hash));
 assert.equal((await call(handler,'/api/account/logout',{cookie,actor,body:{}})).status,200);assert.equal((await call(handler,'/api/me',{cookie})).status,401);assert.equal((await call(handler,'/api/me',{cookie:second.cookie})).status,200);
 assert.deepEqual((await call(handler,'/api/health')).data,{ok:true,release:'test-release',accounts:1});
});
test('HTTP binds a guest through its bearer credential without assigning new ownership',async t=>{
 const {store}=setup(t),handler=coopHttp(store,{origin:'https://city.test'}),guest=store.session('原玩家'),id=store.create(guest.actor,{name:'我的城'}).cityId;
 const bound=await call(handler,'/api/account/register',{token:guest.token,body:{username:'owner',password}});assert.equal(bound.status,200);
 assert.equal((await call(handler,'/api/me',{token:guest.token})).status,401);
 assert.equal((await call(handler,'/api/cities',{cookie:bound.cookie})).data[0].id,id);
});
test('failed account binding transaction leaves legacy ownership and credentials intact',async t=>{
 const {store}=setup(t),auth=new CoopAuth(store),guest=store.session('旧玩家'),city=store.create(guest.actor,{name:'绑定失败保留城'});
 store.beforeCommit=()=>{throw Error('injected commit failure');};
 await assert.rejects(auth.register({username:'retry_owner',password},guest.token),/injected/);
 store.beforeCommit=null;assert.equal(store.user(guest.token).id,guest.actor.id);assert.equal(store.list(guest.actor)[0].id,city.cityId);
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM accounts').get().n,0);assert.equal(store.db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,0);
 assert.equal((await auth.register({username:'retry_owner',password},guest.token)).actor.id,guest.actor.id);
});
