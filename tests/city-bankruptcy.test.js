import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CitySimulation} from '../src/simulation.js';
import {isBankrupt} from '../src/city-bankruptcy.js';
import {advanceSimulationState} from '../src/simulation-worker.js';
import {CoopStore} from '../server/coop-store.mjs';

function indebted(){const s=new CitySimulation();s.state.money=2000;assert(s.takeLoan().ok);return s;}
function finalMonth(){const s=indebted();s._newBuilding(1,31,'power',true);s.state.tick=14;s.state.money=100;s.recalculate();return s;}

test('unused emergency borrowing can rescue an exhausted treasury; repaying never resets the one-off opportunity',()=>{
  const s=new CitySimulation();s.state.money=0;s.recalculate();assert(!isBankrupt(s.state));assert(s.takeLoan().ok);assert.equal(s.state.money,6000);assert(!isBankrupt(s.state));assert(!s.takeLoan().ok);
  s.state.loan={taken:true,remaining:0,grace:0,monthsPaid:24};s.state.money=1;s.recalculate();assert(!isBankrupt(s.state));
  s.state.money=0;s.recalculate();assert(isBankrupt(s.state));assert(!s.takeLoan().ok);
});

test('monthly insolvency latches at zero or below, freezing time, debt, growth and later monthly settlements',()=>{
  const s=finalMonth();s.tick();assert(s.state.money<0);assert(isBankrupt(s.state));assert.equal(s.state.tick,15);assert.equal(s.state.month,2);
  assert.deepEqual(s.state.bankruptcy,{tick:15,month:2,money:s.state.money});assert.equal(s.state.loan.grace,2);
  const frozen=s.serialize();for(let i=0;i<60;i++)s.tick();assert.equal(s.serialize(),frozen);
  assert(s.state.stats.alerts.some(a=>a.text.includes('破产')));
  const worker=advanceSimulationState(structuredClone(s.state));assert.deepEqual(worker,s.state);
});

test('spending the last funds ends the game; demolition, undo, tax changes and festivals cannot revive it',()=>{
  const s=indebted();s.state.money=600;assert(s.build('park',[{x:5,y:29}]).ok);assert.equal(s.state.money,0);assert(isBankrupt(s.state));assert.equal(s._undo,null);
  const frozen=s.serialize();
  for(const action of [()=>s.undo(),()=>s.build('bulldoze',[{x:5,y:29}]),()=>s.setBuildingActive(s.state.buildings[0].id,false),()=>s.setTax(15),()=>s.takeLoan(),()=>s.moveRoad({x:7,y:32},{x:7,y:31}),()=>s.rotateBuilding(1),()=>s.upgradeAllRoads(),()=>s.claimFestivalPoints(),()=>s.redeemFestivalReward('x'),()=>s.enterDragonRace('x',100),()=>s.resolveCityEvent('x',{}),()=>s.setFireBudget(70),()=>s.setCivicPolicy('balanced'),()=>s.startFireDrill()]){
    const result=action();assert.equal(result.ok,false);assert.match(result.message,/破产/);assert.equal(s.serialize(),frozen);
  }
});

test('native and compact saves retain the failure; pre-failure saves and a new city remain playable',()=>{
  const s=finalMonth(),healthy=s.serialize();s.tick();
  for(const save of [s.serialize(),s.serializeCompact()]){const loaded=CitySimulation.deserialize(save);assert.deepEqual(loaded.state.bankruptcy,s.state.bankruptcy);const frozen=loaded.serialize();loaded.tick();assert.equal(loaded.serialize(),frozen);}
  const restored=CitySimulation.deserialize(healthy);assert(!isBankrupt(restored.state));assert.equal(restored.state.tick,14);assert.equal(restored.state.money,100);
  assert(!isBankrupt(new CitySimulation().state));
  const old=JSON.parse(s.serialize());delete old.bankruptcy;const legacy=CitySimulation.deserialize(JSON.stringify(old));assert(isBankrupt(legacy.state));assert(legacy.state.bankruptcy);
  for(const corrupt of [raw=>raw.bankruptcy.tick++,raw=>raw.bankruptcy.month++,raw=>raw.bankruptcy.money--,raw=>raw.bankruptcy=[],raw=>raw.money=1]){
    const raw=JSON.parse(s.serialize());corrupt(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)),/损坏/);
  }
});

test('borrowing too late cannot leave a failed city running with a still-negative treasury',()=>{
  const s=new CitySimulation();s.state.money=-6500;s.recalculate();assert(!isBankrupt(s.state));assert(s.takeLoan().ok);assert.equal(s.state.money,-500);assert(isBankrupt(s.state));const tick=s.state.tick;s.tick();assert.equal(s.state.tick,tick);
});

let serial=0;
for(const asyncTick of [false,true])test(`cooperative ${asyncTick?'worker':'synchronous'} insolvency pauses all players and permits recovery only through a snapshot`,async t=>{
  let now=100000;const dir=mkdtempSync(path.join(tmpdir(),'bayside-bankruptcy-')),store=new CoopStore(path.join(dir,'city.db'),{now:()=>now});
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const owner=store.user(store.session('破产测试房主').token),guest=store.user(store.session('街坊').token),id=store.create(owner,{name:'濒临破产',city:finalMonth().serialize()}).cityId;
  store.join(store.invite(id,owner).code,guest);
  const command=(method,args)=>{const v=store.view(id,owner);return store.command(id,owner,{commandId:`bankruptcy-${++serial}`,method,args,baseRevision:v.revision,epoch:v.epoch});};
  assert(command('setClock',[{paused:false,speed:1}]).ok);now+=3001;
  if(asyncTick)await store.tickDueAsync();else store.tickDue();
  const failed=store.view(id,owner);assert(isBankrupt(failed.state));assert(failed.paused);assert(isBankrupt(store.view(id,guest).state));
  const revision=failed.revision;now+=3001;if(asyncTick)await store.tickDueAsync();else store.tickDue();assert.equal(store.view(id,owner).revision,revision);
  assert(!command('setClock',[{paused:false,speed:3}]).ok);assert(!command('undo',[]).ok);assert(!command('setTax',[15]).ok);assert(!command('takeLoan',[]).ok);
  const recovery=store.snapshots(id,owner).find(s=>s.kind==='before-bankruptcy');assert(recovery);
  assert(command('restoreSnapshot',[recovery.id]).ok);const restored=store.view(id,owner);assert(!isBankrupt(restored.state));assert(restored.paused);assert.equal(restored.state.tick,14);assert.equal(restored.state.money,100);assert(command('setClock',[{paused:false,speed:1}]).ok);
});

test('cooperative construction exhausting funds disables undo and preserves the city before spending',t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'bayside-bankruptcy-build-')),store=new CoopStore(path.join(dir,'city.db'));
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const owner=store.user(store.session('房主').token),s=indebted();s.state.money=600;s.recalculate();
  const id=store.create(owner,{name:'最后一笔建设',city:s.serialize()}).cityId;
  const command=(method,args)=>{const v=store.view(id,owner);return store.command(id,owner,{commandId:`bankruptcy-${++serial}`,method,args,baseRevision:v.revision,epoch:v.epoch});};
  assert(command('build',['park',[{x:5,y:29}]]).ok);
  const failed=store.view(id,owner);assert(isBankrupt(failed.state));assert(failed.paused);assert.equal(failed.canUndo,false);assert(!command('undo',[]).ok);
  const recovery=store.snapshots(id,owner).find(s=>s.kind==='before-bankruptcy');assert(recovery);assert(command('restoreSnapshot',[recovery.id]).ok);
  const restored=store.view(id,owner);assert(!isBankrupt(restored.state));assert.equal(restored.state.money,600);assert.equal(restored.state.tiles[29*restored.state.mapSize+5].buildingId,null);
});
