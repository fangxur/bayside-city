import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {advanceSimulationState} from '../src/simulation-worker.js';
import {SimulationRunner} from '../src/simulation-runner.js';
import {planPedestrians} from '../src/pedestrian-plans.js';
import {publicVehicleRoutes} from '../src/public-vehicles.js';
import {Worker} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function workerHarness(){
 let worker;
 const runner=new SimulationRunner(()=>worker={postMessage({state}){this.input=structuredClone(state);},terminate(){}});
 return {runner,get worker(){return worker;},finish(){const state=advanceSimulationState(worker.input);worker.onmessage({data:{state,pedestrianPlans:planPedestrians(state),publicRoutes:publicVehicleRoutes(state)}});}};
}

test('background ticks exactly match synchronous ticks including monthly settlement',()=>{
 const sim=new CitySimulation({demo:true,seed:2026});
 sim.state.tick=14;
 const state=advanceSimulationState(structuredClone(sim.state));
 sim.tick();assert.deepEqual(state,sim.state);
});

test('worker applies a tick while retaining the renderer state identity',async()=>{
 const sim=new CitySimulation({demo:true}),state=sim.state,oldTick=state.tick,h=workerHarness();
 const tick=h.runner.tick(sim);assert.equal(h.runner.pending,true);
 assert.equal(await h.runner.tick(sim),false);
 h.finish();assert.equal(await tick,true);assert.equal(sim.state,state);
 assert.equal(state.tick,oldTick+1);assert.equal(h.runner.pending,false);
 assert.deepEqual(sim._pedestrianPlans,planPedestrians(state));
 assert.deepEqual(sim._publicRoutes,publicVehicleRoutes(state));
 assert.equal(sim.serialize().includes('pedestrianPlans'),false);
});

test('the real worker protocol returns simulation and visual routes together',async t=>{
 const moduleUrl=new URL('../src/simulation-worker.js',import.meta.url).href;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(`
   import {parentPort} from 'node:worker_threads';
   globalThis.self={postMessage:data=>parentPort.postMessage(data)};
   await import(${JSON.stringify(moduleUrl)});
   parentPort.on('message',data=>self.onmessage({data}));
 `)),{execArgv:[]});
 t.after(()=>worker.terminate());
 const sim=new CitySimulation({demo:true});
 const response=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
 worker.postMessage({state:sim.state});sim.tick();
 const data=await response;assert.equal(data.error,undefined);
 assert.deepEqual(data.state,sim.state);
 assert.deepEqual(data.pedestrianPlans,planPedestrians(sim.state));
 assert.deepEqual(data.publicRoutes,publicVehicleRoutes(sim.state));
});

test('edits and city replacement invalidate pending ticks',async()=>{
 for(const change of ['edit','replace','switch']){
  const sim=new CitySimulation({demo:true}),h=workerHarness();let current=true;
  const tick=h.runner.tick(sim,()=>current);
  if(change==='edit')sim.setDistrictName('Edited city');
  if(change==='replace')sim.state=structuredClone(sim.state);
  if(change==='switch')current=false;
  const before=structuredClone(sim.state);
  h.finish();assert.equal(await tick,false);assert.deepEqual(sim.state,before);
 }
});

test('unavailable workers fall back to synchronous simulation',async t=>{
 t.mock.method(console,'warn',()=>{});
 const runner=new SimulationRunner(()=>{throw Error('Unsupported');}),sim=new CitySimulation();
 assert.equal(await runner.tick(sim),true);assert.equal(sim.state.tick,1);
 assert.equal(runner.disabled,true);
});

function clockHarness(){
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const sim=new CitySimulation({demo:true}),h=workerHarness();let now=0,syncs=0;
 const context={sim,SimulationRunner:class{constructor(){return h.runner;}},coop:{cityId:null},
  lastTime:0,accumulator:3000,simulationClockEpoch:0,speed:3,undoReady:true,
  renderer:{setPaused(){}},performance:{now:()=>now},isStopped:()=>false,
  mayorReputation:()=>({landmarkBonus:0}),celebrationSnapshot:()=>({}),
  reachedCelebrations:()=>[],milestoneQueue:[],lastCelebrationState:{},hover:null,
  syncWorld(){syncs++;},toast(){},autosave(){},showNextMilestone(){}};
 vm.createContext(context);
 vm.runInContext(source.match(/function resetSimulationClock\(\)\{[^\n]+/)[0]+'\n'+
  source.slice(source.indexOf('const simulationRunner=new SimulationRunner();'),source.indexOf('\ntry {',source.indexOf('async function advance()'))),context);
 return {sim,h,context,get syncs(){return syncs;},step(){now+=500;return context.advance();}};
}

test('resetting the clock during a worker tick discards it even after resuming',async()=>{
 const c=clockHarness(),oldTick=c.sim.state.tick,tick=c.step();
 c.context.resetSimulationClock();
 c.h.finish();await tick;
 assert.equal(c.sim.state.tick,oldTick);assert.equal(c.context.accumulator,0);
 assert.equal(c.syncs,0);
});

test('slow background ticks cap catch-up and refresh the world after one tick',async()=>{
 const c=clockHarness(),oldTick=c.sim.state.tick,tick=c.step();
 for(let i=0;i<20;i++)await c.step();
 assert.equal(c.context.accumulator,6000);
 c.h.finish();await tick;
 assert.equal(c.sim.state.tick,oldTick+1);assert.equal(c.context.accumulator,3000);
 assert.equal(c.syncs,1);assert.equal(c.h.runner.pending,false);
});
