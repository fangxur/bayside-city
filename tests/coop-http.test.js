import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopStore} from '../server/coop-store.mjs';
import {coopHttp,publicOrigin,invitationOrigin} from '../server/coop-http.mjs';
import {Readable} from 'node:stream';
// Exercise the real request handler without opening a network listener.
async function call(handler,path,method='GET',body,token,origin,headers={}){
 const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);request.method=method;request.headers={host:'localhost:4173','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{}),...headers};request.socket={remoteAddress:'test-client'};
 let status,text;const res={writeHead:s=>{status=s;},end:data=>{text=String(data);}};
 await handler(request,res,new URL(path,'http://localhost:4173'));return {status,data:JSON.parse(text)};
}
test('HTTP identities, invite join, simultaneous writes and authenticated export',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const handler=coopHttp(store);
 const a=(await call(handler,'/api/session','POST',{name:'玩家甲'})).data,b=(await call(handler,'/api/session','POST',{name:'玩家乙'})).data;
 const created=await call(handler,'/api/cities','POST',{name:'多人接口测试'},a.token),id=created.data.cityId;
 const invitation=await call(handler,`/api/cities/${id}/invite`,'POST',{},a.token);assert.equal((await call(handler,'/api/join','POST',{code:invitation.data.code},b.token)).status,200);
 const cmd=(x,i)=>({commandId:i,epoch:1,baseRevision:0,method:'build',args:['park',[{x,y:29}],{buildingId:null,roadSource:null,roadsOnly:false}]});
 const results=await Promise.all([call(handler,`/api/cities/${id}/commands`,'POST',cmd(10,'a'),a.token),call(handler,`/api/cities/${id}/commands`,'POST',cmd(12,'b'),b.token)]);assert(results.every(r=>r.data.ok));
 const v=await call(handler,`/api/cities/${id}`,'GET',undefined,b.token);assert.equal(v.data.state.buildings.length,2);assert.equal(v.data.state.money,28800);
 assert.equal((await call(handler,`/api/cities/${id}`)).status,401);assert.equal((await call(handler,`/api/cities/${id}/commands`,'POST',cmd(15,'c'),b.token,'https://evil.invalid')).status,403);
 const exported=await call(handler,`/api/cities/${id}/export`,'GET',undefined,b.token);assert.equal(JSON.parse(exported.data.city).buildings.length,2);
 assert.equal((await call(handler,'/api/me','GET',undefined,a.token)).data.actor.name,'玩家甲');
 assert.equal((await call(handler,`/api/cities/${id}`,'DELETE',undefined,b.token)).status,403);
 assert.equal((await call(handler,`/api/cities/${id}`,'DELETE',undefined,a.token)).status,200);
 assert.equal((await call(handler,`/api/cities/${id}`,'GET',undefined,a.token)).status,403);
});
test('HTTPS public origin works through an HTTP reverse proxy and keeps authentication',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const origin='https://city.yunyousl.com.cn',handler=coopHttp(store,{origin:origin+'/'});
 const player=await call(handler,'/api/session','POST',{name:'反代测试'},undefined,origin);assert.equal(player.status,200);
 const created=await call(handler,'/api/cities','POST',{name:'HTTPS 共建城'},player.data.token,origin);assert.equal(created.status,200);
 const id=created.data.cityId,cmd={commandId:'proxy-park',epoch:1,baseRevision:0,method:'build',args:['park',[{x:10,y:29}]]};
 assert((await call(handler,`/api/cities/${id}/commands`,'POST',cmd,player.data.token,origin)).data.ok);
 assert.equal((await call(handler,`/api/cities/${id}`,'GET',undefined,undefined,origin)).status,401);
 for(const other of ['http://city.yunyousl.com.cn','https://www.yunyousl.com.cn','https://city.yunyousl.com.cn.evil.invalid','null']){
  assert.equal((await call(handler,'/api/session','POST',{name:'拒绝'},undefined,other,{host:new URL(origin).host,'x-forwarded-proto':'https','x-forwarded-host':new URL(origin).host})).status,403);
 }
});
test('local play still works and forwarded headers cannot enable a different origin',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const handler=coopHttp(store);
 assert.equal((await call(handler,'/api/session','POST',{name:'本地'},undefined,'http://localhost:4173')).status,200);
 assert.equal((await call(handler,'/api/session','POST',{name:'伪造'},undefined,'https://city.yunyousl.com.cn',{'x-forwarded-proto':'https','x-forwarded-host':'city.yunyousl.com.cn'})).status,403);
});
test('public origin configuration fails fast for paths, credentials or invalid schemes',()=>{
 assert.equal(publicOrigin(undefined),null);assert.equal(publicOrigin(''),null);
 assert.equal(publicOrigin('https://city.yunyousl.com.cn/'),'https://city.yunyousl.com.cn');
 for(const value of ['https://*.yunyousl.com.cn','city.yunyousl.com.cn','https://city.yunyousl.com.cn/game','https://user:password@city.yunyousl.com.cn','file:///tmp/game','https://city.yunyousl.com.cn/?x=1','https://city.yunyousl.com.cn/#game'])assert.throws(()=>publicOrigin(value),/PUBLIC_ORIGIN/);
});

test('invitation panel returns the current code to the owner and supports joining over LAN HTTP',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const handler=coopHttp(store,{lan:true});
 const owner=store.session('房主'),guest=store.session('朋友'),id=store.create(owner.actor,{name:'局域网共建'}).cityId;
 const address='http://192.168.50.222:4173',headers={host:'192.168.50.222:4173'};
 const first=await call(handler,`/api/cities/${id}/invite`,'POST',{reuse:true},owner.token,address,headers);
 assert.equal(first.status,200);assert.equal(first.data.origin,address);
 const again=await call(handler,`/api/cities/${id}/invite`,'POST',{reuse:true},owner.token,address,headers);
 assert.deepEqual(again.data,first.data);
 assert.equal((await call(handler,`/api/cities/${id}/invite`,'POST',{reuse:true},undefined,address,headers)).status,401);
 assert.equal((await call(handler,'/api/join','POST',{code:first.data.code},guest.token,address,headers)).status,200);
 assert.equal((await call(handler,`/api/cities/${id}/invite`,'POST',{reuse:true},guest.token,address,headers)).status,403);
 const publicHandler=coopHttp(store,{origin:'https://city.example',lan:true});
 const publicInvite=await call(publicHandler,`/api/cities/${id}/invite`,'POST',{reuse:true},owner.token,'https://city.example');
 assert.equal(publicInvite.data.origin,'https://city.example');assert.equal(publicInvite.data.code,first.data.code);
});

test('LAN invitations replace loopback hosts only when LAN mode is enabled',()=>{
 const req={headers:{host:'127.0.0.1:4173'},socket:{}},interfaces={lo:[{family:'IPv4',internal:true,address:'127.0.0.1'}],wifi:[{family:'IPv4',internal:false,address:'192.168.50.222'}]};
 assert.equal(invitationOrigin(req,{interfaces}),'http://127.0.0.1:4173');
 assert.equal(invitationOrigin(req,{lan:true,interfaces}),'http://192.168.50.222:4173');
 assert.equal(invitationOrigin(req,{lan:true,interfaces:{}}),'http://127.0.0.1:4173');
 req.headers.host='city.example:8080';assert.equal(invitationOrigin(req,{lan:true,interfaces}),'http://city.example:8080');
});
