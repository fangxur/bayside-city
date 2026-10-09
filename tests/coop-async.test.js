import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopStore,hydrate} from '../server/coop-store.mjs';
import {SimulationJobs} from '../server/simulation-jobs.mjs';

let serial=0;
const command=(method,args,revision=0)=>({commandId:'async-'+(++serial),epoch:1,baseRevision:revision,method,args});
const build=(x,y,revision=0)=>command('build',['park',[{x,y}]],revision);
class DeferredJobs{
 constructor(){this.pending=[];}
 run(kind,payload){return new Promise((resolve,reject)=>this.pending.push({kind,payload,resolve,reject}));}
 finish(kind){
  const i=this.pending.findIndex(job=>job.kind===kind);assert(i>=0,'expected pending '+kind);
  const [job]=this.pending.splice(i,1),sim=hydrate(job.payload.state);
  const result=kind==='tick'?(sim.tick(),undefined):sim[job.payload.method](...job.payload.args);
  job.resolve({state:sim.state,result,renderPlans:{pedestrians:{hasResidents:false,people:[]},publicRoutes:[]}});
 }
 close(){for(const job of this.pending.splice(0))job.reject(Error('closed'));}
}
function fixture(t,jobs=null){
 let now=100000;const store=new CoopStore(':memory:',{now:()=>now,jobs});t.after(()=>store.close());
 const a=store.session('甲').actor,b=store.session('乙').actor,id=store.create(a,{name:'异步合建'}).cityId;
 store.join(store.invite(id,a).code,b);
 return {store,a,b,id,advance(){now+=3001;},startClock(){assert(store.command(id,a,command('setClock',[{paused:false,speed:1}])).ok);}};
}
const started=()=>new Promise(resolve=>setImmediate(resolve));

test('background commands preserve concurrent construction, conflict checks and durable retries',async t=>{
 const {store,a,b,id}=fixture(t),first=build(10,29),second=build(12,29);
 const results=await Promise.all([store.commandAsync(id,a,first),store.commandAsync(id,b,second)]);
 assert(results.every(r=>r.ok));const view=store.view(id,a);
 assert.equal(view.state.buildings.length,2);assert.equal(view.state.money,28800);assert(view.renderPlans);
 assert((await store.commandAsync(id,a,first)).duplicate);
 assert(!(await store.commandAsync(id,b,build(10,29))).ok);
 assert.equal(store.view(id,a).state.money,28800);
});

test('a background tick cannot overwrite a construction committed during its calculation',async t=>{
 const jobs=new DeferredJobs(),f=fixture(t,jobs);f.startClock();f.advance();
 const tick=f.store.tickDueAsync();assert.equal(jobs.pending[0].kind,'tick');
 const edit=f.store.commandAsync(f.id,f.a,build(10,29,1));await started();
 jobs.finish('command');assert((await edit).ok);jobs.finish('tick');await tick;
 const view=f.store.view(f.id,f.a);assert.equal(view.state.tick,0);assert.equal(view.state.buildings.length,1);assert.equal(view.state.money,29400);
});

test('periodic work is not queued while a city edit is waiting for its worker',async t=>{
 const jobs=new DeferredJobs(),f=fixture(t,jobs);f.startClock();f.advance();
 const edit=f.store.commandAsync(f.id,f.a,build(10,29,1));await started();await f.store.tickDueAsync();
 assert.deepEqual(jobs.pending.map(job=>job.kind),['command']);jobs.finish('command');assert((await edit).ok);
});

test('a pause or restore invalidates an in-flight simulation tick',async t=>{
 const jobs=new DeferredJobs(),f=fixture(t,jobs);f.startClock();f.advance();
 const tick=f.store.tickDueAsync();
 assert(f.store.command(f.id,f.a,command('setClock',[{paused:true,speed:1}],1)).ok);
 jobs.finish('tick');await tick;assert.equal(f.store.view(f.id,f.a).state.tick,0);
});

test('a city changed by another writer is recomputed before committing the prepared edit',async t=>{
 const jobs=new DeferredJobs(),f=fixture(t,jobs);
 const edit=f.store.commandAsync(f.id,f.a,build(10,29));await started();
 assert(f.store.command(f.id,f.b,build(12,29)).ok);
 jobs.finish('command');await started();assert.equal(jobs.pending.length,1);
 jobs.finish('command');assert((await edit).ok);
 assert.equal(f.store.view(f.id,f.a).state.buildings.length,2);assert.equal(f.store.view(f.id,f.a).state.money,28800);
});

test('a failed asynchronous commit leaves treasury, receipts and undo intact',async t=>{
 const jobs=new DeferredJobs(),f=fixture(t,jobs),cmd=build(10,29),before=f.store.view(f.id,f.a);
 f.store.beforeCommit=()=>{throw Error('disk full');};
 const edit=f.store.commandAsync(f.id,f.a,cmd);await started();jobs.finish('command');await assert.rejects(edit,/disk full/);
 assert.equal(f.store.view(f.id,f.a).checksum,before.checksum);assert.equal(f.store.logs(f.id,f.a).length,1);
 f.store.beforeCommit=null;const retry=f.store.commandAsync(f.id,f.a,cmd);await started();jobs.finish('command');assert((await retry).ok);
 assert(f.store.command(f.id,f.a,command('undo',[],1)).ok);assert.equal(f.store.view(f.id,f.a).state.money,30000);
});

test('an online city advances exactly once in a real worker and duplicate schedulers do not double-tick',async t=>{
 const f=fixture(t);f.startClock();f.advance();
 await Promise.all([f.store.tickDueAsync(),f.store.tickDueAsync()]);
 const view=f.store.view(f.id,f.a);assert.equal(view.state.tick,1);assert.equal(view.revision,2);assert(view.renderPlans);
});

test('construction cancels an unfinished tick for the same city and obtains the worker first',async t=>{
 const pool=new SimulationJobs({workers:1});t.after(()=>pool.close());
 const f=fixture(t),state=f.store.view(f.id,f.a).state;
 const tick=pool.run('tick',{cityId:f.id,state});
 const tickResult=Promise.allSettled([tick]);
 const edit=pool.run('command',{cityId:f.id,state,method:'build',args:['park',[{x:10,y:29}]]});
 const [cancelled]=await tickResult;assert.equal(cancelled.status,'rejected');assert(cancelled.reason.cancelled);
 const result=await edit;assert(result.result.ok);assert.equal(result.state.buildings.length,1);
});
