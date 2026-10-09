import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopClient} from '../src/coop-client.js';
import {CoopStore} from '../server/coop-store.mjs';
import {mayorIdentity} from '../src/city-identity.js';
class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function client(t){const oldStorage=globalThis.localStorage;globalThis.localStorage=new Storage();t.after(()=>globalThis.localStorage=oldStorage);const c=new CoopClient();c.identity={actor:{id:'person'},token:'test'};c.cityId='city';c.connected=true;c.view={revision:0,epoch:1};return c;}
test('a committed acknowledgement updates the city without waiting for polling or fetching it again',async t=>{
 const c=client(t),state={money:29400},plans={pedestrians:{people:[]},publicRoutes:[]};let updates=0,calls=0;
 c.polling=true;c.onState=(view,changed)=>{assert(changed);assert.equal(view.state,state);assert.equal(view.renderPlans,plans);updates++;};
 c.request=async(url)=>{calls++;assert(url.endsWith('/commands'));return {ok:true,message:'saved',revision:1,epoch:1,view:{revision:1,epoch:1,state,renderPlans:plans}};};
 const result=await c.command('build',['park',[{x:10,y:29}]]);
 assert(result.ok);assert.equal(calls,1);assert.equal(updates,1);assert.equal(c.pending().length,0);assert(!c.busy);
 c.acceptView({revision:0,epoch:1,state:{money:30000}});assert.equal(c.view.state,state);assert.equal(updates,1);
});
test('a new snapshot without visual plans cannot reuse plans from an older revision',async t=>{
 const c=client(t);c.acceptView({revision:1,epoch:1,state:{},renderPlans:{publicRoutes:[]}});
 c.acceptView({revision:2,epoch:1,state:{}});assert.equal(c.view.renderPlans,undefined);
});
test('cooperative mayor credits follow joins and removals even while the city is paused at the same revision',async t=>{
 let now=100000;const store=new CoopStore(':memory:',{now:()=>now});t.after(()=>store.close());
 const owner=store.session('Jonathan').actor,friend=store.session('方旭').actor;
 const id=store.create(owner,{name:'共建署名城'}).cityId,invite=store.invite(id,owner);
 const c=client(t);c.cityId=id;c.identity.actor=owner;c.view=null;
 const updates=[];c.onState=(view,changed)=>updates.push({changed,identity:mayorIdentity(view.state,view.members)});
 c.request=async url=>store.view(id,owner,new URL(url,'http://localhost').searchParams.get('since')??-1);
 await c.poll();assert.deepEqual(updates.at(-1).identity.names,['Jonathan']);assert(updates.at(-1).changed);
 const state=c.view.state;
 store.join(invite.code,friend);await c.poll();
 assert.equal(c.view.revision,0);assert(!updates.at(-1).changed);assert.equal(c.view.state,state);
 assert.equal(updates.at(-1).identity.text,'合作市长 · Jonathan、方旭');
 assert.deepEqual(mayorIdentity(state,[...c.view.members].reverse()).names,['Jonathan','方旭'],'the owner remains first');
 now+=15000;await c.poll();assert(!c.view.members.find(m=>m.id===friend.id).online);
 assert.deepEqual(updates.at(-1).identity.names,['Jonathan','方旭'],'offline members keep their credit');
 store.remove(id,owner,friend.id);await c.poll();assert.deepEqual(updates.at(-1).identity.names,['Jonathan']);
 assert.equal(state.mayorName,'Jonathan');assert.equal(JSON.parse(store.exportSnapshot(id,owner)).mayorName,'Jonathan');
 c.leave();assert.equal(mayorIdentity({mayorName:'单人市长'}).text,'市长 · 单人市长');
});
test('lost acknowledgement retries the same durable command ID rather than charging again',async t=>{
 const c=client(t);let applied=0,known,id,reachable=true;
 c.request=async(url,options)=>{
  if(!reachable)throw Error('offline');
  if(url.endsWith('/commands')){const cmd=options.body;if(!known){known=cmd;id=cmd.commandId;applied++;reachable=false;throw Error('lost ack');}assert.equal(cmd.commandId,id);return {ok:true,message:'saved',duplicate:true};}
  return {revision:applied,epoch:1,state:{},paused:true,members:[]};
 };
 const result=await c.command('build',['road',[{x:8,y:32}]]);assert(!result.ok);assert.equal(c.pending().length,1);assert.equal(applied,1);
 reachable=true;await c.poll(true);assert.equal(c.pending().length,0);assert.equal(applied,1);assert(c.connected);
});
test('read-only offline mode, pending write guard and monotonic received versions',async t=>{
 const c=client(t);c.connected=false;assert(!(await c.command('undo',[])).ok);c.connected=true;c.busy=true;assert(!(await c.command('undo',[])).ok);c.busy=false;c.view.revision=7;
 c.request=async()=>({revision:3,epoch:1,state:{}});await c.poll();assert.equal(c.view.revision,7);
});
test('restore confirmation binds its original version even when polling advances the city',async t=>{
 const c=client(t);c.view.revision=6;let sent;c.request=async(url,options)=>{if(options){sent=options.body;return {ok:false,message:'stale'};}return {revision:6,epoch:1,state:{}};};
 await c.command('restoreSnapshot',['snapshot'],{epoch:1,revision:3});assert.equal(sent.baseRevision,3);assert.equal(c.pending().length,0);
});
test('revoked membership preserves uncertain receipts but allows leaving read-only mode',async t=>{
 const c=client(t);let notices=0;c.onNotice=()=>notices++;
 localStorage.setItem('bayside-coop:pending:unknown',JSON.stringify({actor:'person',city:'city',command:{commandId:'unknown'},time:1}));
 c.request=async()=>{throw Object.assign(Error('权限已取消'),{status:403});};
 await c.poll();await c.poll();assert(c.accessDenied);assert(!c.connected);assert.equal(notices,1);assert.equal(c.pending().length,1);
 c.leave();assert.equal(c.pending().length,0);assert.equal(localStorage.length,1);
});
test('definitive rejected recovery is removed and does not block later commands',async t=>{
 const c=client(t);
 localStorage.setItem('bayside-coop:pending:bad',JSON.stringify({actor:'person',city:'city',command:{commandId:'bad'},time:1}));
 c.request=async(url)=>{if(url.endsWith('/commands'))throw Object.assign(Error('操作无效'),{status:400});return {revision:1,epoch:1,state:{}};};
 await c.recover();assert.equal(c.pending().length,0);assert(c.connected);
});
test('account login stores no bearer secret and requests carry the expected actor',async t=>{
 const c=client(t);c.leave();c.identity=null;const oldFetch=globalThis.fetch;t.after(()=>globalThis.fetch=oldFetch);
 const actor={id:'account-player',name:'市长'};let request;
 globalThis.fetch=async(url,options)=>{request=options;return {ok:true,json:async()=>({actor,account:{username:'mayor'},sessionId:'device'})};};
 await c.authenticate('login',{username:'mayor',password:'test-password'});
 assert(!c.identity.token);assert(!localStorage.getItem('bayside-coop:identity').includes('test-password'));
 await c.request('/cities');assert.equal(request.credentials,'same-origin');assert.equal(request.headers['X-Coop-Actor'],actor.id);assert(!request.headers.Authorization);
});
test('switching accounts during a write retains its old-actor receipt and never applies its response to the new city',async t=>{
 const c=client(t);let unblock,applied=0;const oldFetch=globalThis.fetch;t.after(()=>globalThis.fetch=oldFetch);c.onState=()=>applied++;
 globalThis.fetch=async()=>{await new Promise(resolve=>unblock=resolve);return {ok:true,json:async()=>({ok:true,message:'saved'})};};
 const sending=c.command('build',['park',[{x:10,y:29}]]);await new Promise(resolve=>setTimeout(resolve,0));
 c.storageListener({key:'bayside-coop:identity',newValue:JSON.stringify({actor:{id:'someone-else'},account:{username:'other'}})});
 unblock();await sending;assert.equal(applied,0);assert.equal(c.cityId,null);assert.equal(c.pending().length,0);
 const receipt=[...localStorage.map.entries()].find(([key])=>key.startsWith('bayside-coop:pending:'));assert(receipt);assert.equal(JSON.parse(receipt[1]).actor,'person');
 c.identity={actor:{id:'person'}};c.cityId='city';assert.equal(c.pending().length,1);
});
test('expired session returns to account login without deleting durable operation receipts',async t=>{
 const c=client(t);c.leave();localStorage.setItem('bayside-coop:pending:keep','{}');c.request=async()=>{throw Object.assign(Error('expired'),{status:401});};
 assert.equal(await c.refreshIdentity(),null);assert.equal(c.identity,null);assert.equal(localStorage.getItem('bayside-coop:pending:keep'),'{}');
});
test('another tab refreshing the same identity does not leave the active city',t=>{
 const c=client(t);let changes=0;c.onAuthChange=()=>changes++;
 c.storageListener({key:'bayside-coop:identity',newValue:JSON.stringify(c.identity)});
 assert.equal(c.cityId,'city');assert.equal(changes,0);
});
test('binding response loss recovers the cookie session even after retiring the legacy token',async t=>{
 const c=client(t);c.leave();const oldFetch=globalThis.fetch;t.after(()=>globalThis.fetch=oldFetch);
 globalThis.fetch=async(_url,options)=>options.headers.Authorization?{ok:false,status:401,json:async()=>({message:'retired'})}:{ok:true,json:async()=>({actor:{id:'person',name:'原市长'},account:{username:'mayor'},sessionId:'device'})};
 const identity=await c.refreshIdentity();assert.equal(identity.actor.id,'person');assert.equal(identity.account.username,'mayor');assert(!identity.token);
});
test('presence stays separate from saves and drops late responses after leaving',async t=>{
 const c=client(t);let finish,seen=[],body;c.onPresence=p=>seen.push(p);
 c.request=async(path,options)=>{assert(path.endsWith('/presence'));body=options.body;return new Promise(resolve=>finish=resolve);};
 const cells=[{x:8,y:32}];c.setPresence(cells[0],cells,'road');cells[0].x=99;
 const sending=c.exchangePresence();assert.equal(body.cursor.x,8);assert.equal(body.cells[0].x,8);assert(!c.busy);assert.equal(c.pending().length,0);
 c.leave();finish({presence:[{id:'other'}]});await sending;assert.deepEqual(seen,[[]]);
});
test('hidden construction previews clear remotely without disconnecting city commands',async t=>{
 const c=client(t);c.presenceVisible=()=>false;c.setPresence({x:8,y:32},[{x:8,y:32}],'road');let sent;
 c.request=async(path,options)=>{sent=options.body;return {presence:[]};};await c.exchangePresence();assert.equal(sent.cursor,null);assert.deepEqual(sent.cells,[]);assert(c.connected);
 c.request=async()=>{throw Object.assign(Error('old server'),{status:404});};await c.exchangePresence();assert(c.presenceUnsupported);assert(c.connected);
});
