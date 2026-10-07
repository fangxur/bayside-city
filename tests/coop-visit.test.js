import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {CoopStore} from '../server/coop-store.mjs';
import {coopHttp} from '../server/coop-http.mjs';
import {InvitationVisit,readInvitation} from '../src/coop-visit.js';

async function call(handler,path,{method='GET',body,token,origin}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 req.method=method;req.headers={host:'localhost:4173','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})};req.socket={remoteAddress:'visitor-test'};
 let status,data;await handler(req,{writeHead:s=>status=s,end:value=>data=JSON.parse(String(value))},new URL(path,'http://localhost:4173'));return {status,data};
}
function fixture(t){
 let now=100000;const store=new CoopStore(':memory:',{now:()=>now});t.after(()=>store.close());
 const owner=store.session('河畔市长'),city=store.create(owner.actor,{name:'河畔之城',demo:true}).cityId,invite=store.invite(city,owner.actor),handler=coopHttp(store);
 return {store,owner,city,invite,handler,path:'/api/invitations/'+invite.code,setNow:value=>now=value};
}
const databaseSnapshot=store=>Object.fromEntries(['users','members','cities','commands','logs','revisions','snapshots','accounts','auth_sessions'].map(name=>[name,store.db.prepare(`SELECT * FROM ${name}`).all()]));

test('anonymous invite tour reads the actual city without membership, presence, identity or state changes',async t=>{
 const f=fixture(t),before=databaseSnapshot(f.store);f.setNow(150000);
 const summary=await call(f.handler,f.path);assert.equal(summary.status,200);assert.equal(summary.data.name,'河畔之城');assert.equal(summary.data.memberCount,1);assert.equal(summary.data.host,'河畔市长');
 const tour=await call(f.handler,f.path+'/visit');assert.equal(tour.status,200);assert.equal(tour.data.role,'visitor');assert.equal(tour.data.canEdit,false);
 assert.equal(tour.data.state.districtName,'河畔之城');assert(tour.data.state.buildings.length>0);
 assert(!('members' in tour.data));assert(!('token' in tour.data));assert(!('cityId' in summary.data));
 const unchanged=await call(f.handler,f.path+'/visit?since=0');assert.equal(unchanged.status,200);assert(!('state' in unchanged.data));
 assert.deepEqual(databaseSnapshot(f.store),before);
 // An invalid/stale account credential must not prevent an otherwise valid invitation tour.
 assert.equal((await call(f.handler,f.path+'/visit',{token:'expired-account'})).status,200);
});

test('tour does not grant editing, exports, membership or public lookup by city ID',async t=>{
 const f=fixture(t);
 for(const [path,method] of [[`/api/cities/${f.city}`,'GET'],[`/api/cities/${f.city}/export`,'GET'],[`/api/cities/${f.city}/commands`,'POST'],['/api/join','POST'],[f.path,'POST'],[f.path+'/visit','DELETE'],[f.path+'/visit/commands','POST']]){
  assert.equal((await call(f.handler,path,{method,body:method==='POST'?{code:f.invite.code}:undefined})).status,401,path);
 }
 assert.equal((await call(f.handler,'/api/invitations/'+f.city+'/visit')).status,410);
 assert.equal((await call(f.handler,f.path+'/visit',{origin:'https://other.invalid'})).status,403);
 const outsider=f.store.session('游客自己的账号');
 assert.equal((await call(f.handler,`/api/cities/${f.city}`,{token:outsider.token})).status,403);
 assert.equal((await call(f.handler,f.path+'/visit',{token:outsider.token})).status,200);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM members').get().n,1);
 // An explicit authenticated join still gives the ordinary builder permissions.
 assert.equal((await call(f.handler,'/api/join',{method:'POST',body:{code:f.invite.code},token:outsider.token})).status,200);
 assert.equal(f.store.member(f.city,outsider.actor.id).role,'builder');
});

test('full cities allow tours, and every tour poll checks revoked and expired invites',async t=>{
 const f=fixture(t);for(let i=0;i<3;i++)f.store.join(f.invite.code,f.store.session('共建者'+i).actor);
 assert.equal((await call(f.handler,f.path)).data.memberCount,4);
 assert.equal((await call(f.handler,f.path+'/visit')).status,200);
 const extra=f.store.session('后来者');assert.throws(()=>f.store.join(f.invite.code,extra.actor),/已满/);
 f.store.invite(f.city,f.owner.actor);
 assert.equal((await call(f.handler,f.path+'/visit?since=0')).status,410);
 const renewed=f.store.invite(f.city,f.owner.actor);f.setNow(renewed.expires);
 assert.equal((await call(f.handler,'/api/invitations/'+renewed.code)).status,410);
 assert.equal((await call(f.handler,'/api/invitations/'+renewed.code+'/visit')).status,410);
 assert.throws(()=>f.store.join(renewed.code,extra.actor),/邀请已失效/);
});

test('visitor polling returns changed world and never keeps an unoccupied city running',async t=>{
 const f=fixture(t);f.store.command(f.city,f.owner.actor,{commandId:'clock',epoch:1,baseRevision:0,method:'setClock',args:[{paused:false,speed:1}]});
 const updated=await call(f.handler,f.path+'/visit?since=0');assert.equal(updated.data.revision,1);assert(updated.data.state);assert.equal(updated.data.paused,false);
 f.setNow(200000);const before=databaseSnapshot(f.store);await call(f.handler,f.path+'/visit');assert.deepEqual(databaseSnapshot(f.store),before);
 f.store.tickDue();const after=databaseSnapshot(f.store);
 // The scheduler advances its next check time, but not the world or member presence.
 after.cities[0].next_tick=before.cities[0].next_tick;assert.deepEqual(after,before);
 f.store.deleteCity(f.city,f.owner.actor);assert.equal((await call(f.handler,f.path+'/visit')).status,410);
});

test('visitor client omits credentials and stops cleanly when an in-flight request finishes late',async()=>{
 let resolve,options,path;const received=[],errors=[];
 const visitor=new InvitationVisit('invite/code',{fetcher:(url,opts)=>{path=url;options=opts;return new Promise(done=>resolve=done);},onView:view=>received.push(view),onError:e=>errors.push(e)});
 const running=visitor.start();assert.equal(path,'/api/invitations/invite%2Fcode/visit?since=-1');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');
 visitor.stop();assert(options.signal.aborted);resolve({ok:true,json:async()=>({revision:0,state:{}})});await running;
 assert.deepEqual(received,[]);assert.deepEqual(errors,[]);assert.equal(visitor.timer,undefined);
});

test('visitor client ends on expired invitation and retries only transient failures',async t=>{
 const events=[];let status=503;
 const visitor=new InvitationVisit('demo',{interval:60000,fetcher:async()=>({ok:false,status,json:async()=>({message:status===410?'邀请已失效':'服务暂不可用'})}),onView:()=>assert.fail('unexpected view'),onError:(error,ended)=>events.push({message:error.message,ended})});
 t.after(()=>visitor.stop());await visitor.start();assert.equal(events[0].ended,false);assert(visitor.timer);
 clearTimeout(visitor.timer);status=410;await visitor.poll();assert.equal(events[1].ended,true);assert.equal(visitor.active,false);
 await assert.rejects(()=>readInvitation('demo',{fetcher:async()=>({ok:false,status:410,json:async()=>({message:'邀请已失效',code:'INVITE_INVALID'})})}),{status:410,code:'INVITE_INVALID'});
});
