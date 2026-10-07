import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CoopStore} from '../server/coop-store.mjs';
import {CoopAuth} from '../server/coop-auth.mjs';
import {SoloStore} from '../server/solo-store.mjs';
import {coopHttp} from '../server/coop-http.mjs';
import {SoloLibrary,cityId} from '../src/solo-library.js';
import {CitySimulation} from '../src/simulation.js';

class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
class LimitedStorage extends Storage{
 constructor(){super();this.limit=Infinity;}
 setItem(k,v){const size=[...this.map].reduce((sum,[key,value])=>sum+(key===k?0:key.length+value.length),k.length+v.length);if(size>this.limit)throw Object.assign(Error('Setting the value exceeded the quota'),{name:'QuotaExceededError',code:22});super.setItem(k,v);}
 get size(){return [...this.map].reduce((sum,[key,value])=>sum+key.length+value.length,0);}
}
const password='test-only account password';
function setup(t,file=':memory:'){
 const store=new CoopStore(file);t.after(()=>{try{store.close();}catch{}});const auth=new CoopAuth(store),solo=new SoloStore(store);return {store,auth,solo};
}
const snapshot=name=>{const sim=new CitySimulation({demo:false});sim.setCityIdentity({cityName:name,mayorName:'市长'});return {name,city:sim.serialize(),savedAt:new Date().toISOString()};};
function client(identity,solo){return {identity,async request(url,options){const id=url.split('/')[2];return options?.method==='DELETE'?solo.remove(this.identity.actor,id):options?solo.save(this.identity.actor,id,options.body):id?solo.get(this.identity.actor,id):solo.list(this.identity.actor);}};}
async function call(handler,url,{body,cookie,actor,origin='http://city.test',method}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);req.method=method||(body===undefined?'GET':'POST');req.socket={remoteAddress:'test'};req.headers={host:'city.test','content-type':'application/json',...(origin?{origin}:{}),...(cookie?{cookie}:{}),...(actor?{'x-coop-actor':actor}:{})};
 let status,headers,text;await handler(req,{writeHead(s,h){status=s;headers=h;},end(b){text=String(b);}},new URL(url,'http://city.test'));return {status,data:JSON.parse(text),cookie:headers['Set-Cookie']?.split(';')[0]};
}

test('account owns private solo cities alongside cooperative memberships; restart preserves both',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'bayside-solo-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'city.sqlite'),{store,auth,solo}=setup(t,file);
 const identity=await auth.register({username:'mayor',name:'市长',password});
 const shared=store.create(identity.actor,{name:'合作城'}),id=cityId(),save=snapshot('自己的城市');
 const result=solo.save(identity.actor,id,{revision:0,requestId:cityId(),city:save.city});assert.equal(result.revision,1);
 assert.equal(solo.list(identity.actor).length,1);assert.equal(store.list(identity.actor)[0].id,shared.cityId);
 store.tickDue();assert.equal(solo.get(identity.actor,id).revision,1,'solo saves are not advanced by server simulation');
 store.close();const restarted=setup(t,file);const session=restarted.auth.resolve(identity.token);
 assert.equal(restarted.solo.get(session.actor,id).name,'自己的城市');assert.equal(restarted.store.list(session.actor).length,1);
});

test('solo HTTP rejects guests, other owners, unfenced writes and cross-origin writes',async t=>{
 const {store}=setup(t),handler=coopHttp(store);
 const a=await call(handler,'/api/account/register',{body:{username:'first',name:'甲',password}});
 const b=await call(handler,'/api/account/register',{body:{username:'second',name:'乙',password}});
 const id=cityId(),body={revision:0,requestId:cityId(),city:snapshot('私有城').city},credentials={cookie:a.cookie,actor:a.data.actor.id};
 assert.equal((await call(handler,'/api/solo-cities/'+id,{body})).status,401);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials,body,origin:'http://other.test'})).status,403);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{cookie:a.cookie,body})).status,409);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials,body})).status,200);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{cookie:b.cookie})).status,404);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{cookie:b.cookie,actor:b.data.actor.id,body})).status,404);
 assert.deepEqual((await call(handler,'/api/solo-cities',{cookie:b.cookie})).data,[]);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials,body:{...body,requestId:cityId(),revision:1,city:'invalid'}})).status,400);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{cookie:b.cookie,actor:b.data.actor.id,method:'DELETE'})).status,404);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials,method:'DELETE',origin:'http://other.test'})).status,403);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials,method:'DELETE'})).status,200);
 assert.equal((await call(handler,'/api/solo-cities/'+id,{...credentials})).status,404);
});

test('deleting an account city removes its server copy, local cache and conflict backups',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'deletecity',name:'市长',password}),storage=new Storage(),library=new SoloLibrary(client(identity,solo),{storage});
 const record=library.create(snapshot('准备删除'));await library.flush(record);
 storage.setItem(library.key(record)+':conflict:backup',JSON.stringify({...record,conflictBackup:true}));
 assert.equal(solo.list(identity.actor).length,1);await library.remove(record.id);
 assert.equal(solo.list(identity.actor).length,0);assert.equal(library.local().length,0);
 assert.equal([...storage.map.keys()].some(key=>key.startsWith(library.key(record))),false);
});

test('lost acknowledgement survives reload and retries exactly once while retaining newer local progress',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'mayor',name:'市长',password}),storage=new Storage();
 const transport=client(identity,solo),request=transport.request.bind(transport);let lose=true;
 transport.request=async(url,options)=>{const result=await request(url,options);if(options&&lose){lose=false;throw Error('lost acknowledgement');}return result;};
 let library=new SoloLibrary(transport,{storage}),record=library.create(snapshot('第一版'));
 await assert.rejects(library.flush(record));assert(record.pending);assert.equal(solo.get(identity.actor,record.id).revision,1);
 library.save(record,snapshot('第二版'));
 library=new SoloLibrary(transport,{storage});record=await library.load(record.id);await library.flush(record);
 assert.equal(record.revision,1);assert(record.dirty);assert.equal(record.snapshot.name,'第二版');
 await library.flush(record);assert.equal(solo.get(identity.actor,record.id).name,'第二版');assert.equal(record.revision,2);assert(!record.dirty);
 library.save(record,{...record.snapshot,savedAt:new Date().toISOString()});await library.flush(record);
 assert.equal(record.revision,2,'saving unchanged local progress does not create another server revision');
});

test('a normal pending save stores one city copy until newer progress actually diverges',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'compact',name:'市长',password}),storage=new Storage(),transport=client(identity,solo);
 const request=transport.request.bind(transport);
 let release,entered;const reached=new Promise(resolve=>entered=resolve);
 transport.request=async(url,options)=>{entered();return new Promise(resolve=>release=()=>resolve(solo.save(identity.actor,url.split('/')[2],options.body)));};
 const library=new SoloLibrary(transport,{storage}),record=library.create(snapshot('第一版')),firstCity=record.snapshot.city,pending=library.flush(record);
 await reached;let cached=JSON.parse(storage.getItem(library.key(record)));
 assert(cached.pending);assert.equal(cached.pending.city,undefined);assert.equal(cached.snapshot.city,firstCity);
 library.save(record,snapshot('第二版'));cached=JSON.parse(storage.getItem(library.key(record)));
 assert.equal(cached.pending.city,firstCity,'only a concurrent newer save needs to retain the in-flight city copy');
 release();await pending;assert(record.dirty);transport.request=request;await library.flush(record);
});

test('binding under storage pressure evicts only clean server-backed caches',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'quota',name:'市长',password}),storage=new LimitedStorage(),library=new SoloLibrary(client(identity,solo),{storage});
 const old=library.create(snapshot('已同步旧城'));await library.flush(old);storage.limit=storage.size+10000;
 const bound=await library.bind(snapshot('刚绑定的新城'));
 assert.equal(bound.cacheLimited,undefined);assert.equal(storage.getItem(library.key(old)),null,'clean cache can be downloaded again and is safe to evict');
 assert(storage.getItem(library.key(bound)));assert.equal(solo.list(identity.actor).length,2);
});

test('binding reaches the account even when unrelated browser data leaves no cache space',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'full',name:'市长',password}),storage=new LimitedStorage();storage.setItem('unrelated-guest-data','x'.repeat(20000));storage.limit=storage.size;
 const library=new SoloLibrary(client(identity,solo),{storage}),bound=await library.bind(snapshot('安全上传'));
 assert.equal(bound.cacheLimited,true);assert.equal(storage.getItem(library.key(bound)),null);assert.equal(solo.list(identity.actor).length,1);
 assert.equal(storage.getItem('unrelated-guest-data'),'x'.repeat(20000),'unsynced unrelated data is never discarded');
 library.save(bound,snapshot('空间不足后的新进度'));await library.flush(bound);
 assert.equal(solo.get(identity.actor,bound.id).name,'空间不足后的新进度','the in-memory fallback keeps syncing while the page remains open');
});

test('two-device saves never silently overwrite a newer server version; local conflict stays recoverable',async t=>{
 const {auth,solo}=setup(t),identity=await auth.register({username:'mayor',name:'市长',password});
 const a=new SoloLibrary(client(identity,solo),{storage:new Storage()}),storageB=new Storage(),b=new SoloLibrary(client(identity,solo),{storage:storageB});
 const first=a.create(snapshot('共同起点'));await a.flush(first);const second=await b.load(first.id);
 a.save(first,snapshot('电脑上的新进度'));await a.flush(first);
 b.save(second,snapshot('手机上的不同进度'));await assert.rejects(b.flush(second),{code:'SAVE_CONFLICT'});
 assert.equal(solo.get(identity.actor,first.id).name,'电脑上的新进度');assert.equal(second.snapshot.name,'手机上的不同进度');
 assert(second.error);assert.equal((await b.list()).length,1);assert([...storageB.map.keys()].some(k=>k.includes(':conflict:')));
 const copy=b.create(second.snapshot);await b.flush(copy);assert.equal(solo.list(identity.actor).length,2);
});

test('account switching hides former private saves and leaves an in-flight outbox for the original owner',async t=>{
 const {auth,solo}=setup(t),a=await auth.register({username:'first',name:'甲',password}),b=await auth.register({username:'second',name:'乙',password});
 const transport=client(a,solo),storage=new Storage(),library=new SoloLibrary(transport,{storage}),record=library.create(snapshot('甲的城市'));
 let resolve;transport.request=async()=>new Promise(r=>resolve=r);const pending=library.flush(record);
 transport.identity=b;resolve({revision:1});await assert.rejects(pending);
 assert.equal(library.local().length,0);assert.throws(()=>library.save(record,snapshot('乙不能接管')),/所属的账号/);
 transport.identity=a;assert.equal(library.local().length,1);assert(library.local()[0].pending);
 transport.identity=null;assert.equal(library.local().length,0);
});
