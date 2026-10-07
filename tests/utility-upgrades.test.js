import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {upgradeOffer} from '../src/progression.js';
import {executeCityCommand} from '../src/city-commands.js';

const stages=['density','metropolis','capital','regional','global'];
const capacities={power:[750,1600,3200,6000,9900,15600],water:[900,2000,4000,7500,12375,19500]};
const costs={power:[1800,3500,6000,10800,18000],water:[1200,2500,4500,8100,13500]};
const maintenance={power:[150,240,375,570,825,1200],water:[80,128,200,304,440,640]};
function city(){
  const sim=new CitySimulation();sim.state.money=100000;
  assert(sim.build('power',[{x:1,y:31}]).ok);
  assert(sim.build('water',[{x:2,y:31}]).ok);
  sim._newBuilding(3,31,'commercial',true);sim.recalculate();
  return sim;
}

test('the 1,000-person stage unlocks second-level power and water, while other civic facilities still wait for 2,000',()=>{
  for(const type of ['power','water']){
    const building={type,level:1,progress:1};
    assert.match(upgradeOffer(building,{}).reason,/1,000/);
    assert(upgradeOffer(building,{density:true}).allowed);
  }
  assert.equal(upgradeOffer({type:'fireStation',level:1,progress:1},{density:true}).allowed,false);
  assert.match(upgradeOffer({type:'fireStation',level:1,progress:1},{density:true}).reason,/2,000/);
});

test('both utilities upgrade through six population stages with real capacity, upkeep and persisted construction',()=>{
  for(const type of ['power','water']){
    const sim=city(),b=sim.state.buildings.find(b=>b.type===type);
    assert(!sim.preview('upgrade',[b]).valid);
    for(let level=2;level<=6;level++){
      const before=sim.serialize();
      assert(!sim.build('upgrade',[b]).ok);assert.equal(sim.serialize(),before);
      sim.state.milestones[stages[level-2]]=true;
      const offer=upgradeOffer(b,sim.state.milestones),funds=sim.state.money;
      assert(offer.allowed);assert.equal(offer.cost,costs[type][level-2]);
      assert(offer.benefit.includes(capacities[type][level-1].toLocaleString('zh-CN')));
      assert.match(offer.benefit,/月维护/);
      assert(executeCityCommand(sim,'build',['upgrade',[{x:b.x,y:b.y}],{}]).ok);
      assert.equal(b.level,level);assert.equal(b.progress,.6);
      assert.equal(sim.state.money,funds-offer.cost);
      assert.equal(sim.state.stats[type+'Capacity'],capacities[type][level-2]);
      assert(sim.state.buildings.every(v=>v.powered&&v.watered));
      assert(b.coverageCells.length>0);
      assert.equal(sim.tile(1,31).pollution,13);
      assert(!sim.preview('upgrade',[b]).valid);
      const info=sim.getInfo(b.x,b.y);
      assert.match(info.metrics.find(m=>m.label===(type==='power'?'供电容量':'供水容量')).value,/改造完成后/);
      assert.equal(info.metrics.find(m=>m.label==='月维护').value,'¥'+maintenance[type][level-1]);
      const copy=CitySimulation.deserialize(sim.serialize());
      assert.equal(copy.state.stats[type+'Capacity'],capacities[type][level-2]);
      for(const current of [sim,copy]){
        current.tick();assert.equal(current.state.stats[type+'Capacity'],capacities[type][level-2]);
        current.tick();assert.equal(current.state.stats[type+'Capacity'],capacities[type][level-1]);
        assert(current.state.buildings.every(v=>v.powered&&v.watered));
      }
      assert.equal(b.progress,1);assert.equal(b.footprint,undefined);
      assert.equal(CitySimulation.deserialize(sim.serialize()).state.buildings.find(v=>v.id===b.id).level,level);
    }
    const maxed=sim.serialize();assert(!sim.build('upgrade',[b]).ok);assert.equal(sim.serialize(),maxed);
    assert.match(upgradeOffer(b,sim.state.milestones).reason,/最高等级/);
  }
});

test('simultaneous utility upgrades charge once per facility, undo atomically and reject insufficient funds',()=>{
  const sim=city();sim.state.milestones.density=true;
  const [power,water]=sim.state.buildings;
  const cells=[power,power,water,water];
  const before=sim.serialize(),funds=sim.state.money;
  assert.equal(sim.preview('upgrade',cells).cost,3000);
  assert(sim.build('upgrade',cells).ok);assert.equal(sim.state.money,funds-3000);
  assert.equal(sim.state.stats.powerCapacity,750);assert.equal(sim.state.stats.waterCapacity,900);
  assert(sim.undo().ok);assert.equal(sim.serialize(),before);
  sim.state.money=2999;const poor=sim.serialize();
  assert(!sim.build('upgrade',cells).ok);assert.equal(sim.serialize(),poor);
  sim.state.money=3000;assert(sim.build('upgrade',cells).ok);
  sim.tick();sim.tick();assert.equal(sim.state.stats.powerCapacity,1600);assert.equal(sim.state.stats.waterCapacity,2000);
});

test('construction supply still requires active connected facilities and electricity for water',()=>{
  const sim=city();sim.state.milestones.density=true;
  const [power,water]=sim.state.buildings;
  assert(sim.build('upgrade',[power,water]).ok);
  sim.setBuildingActive(power.id,false);
  assert.equal(sim.state.stats.powerCapacity,0);assert.equal(sim.state.stats.waterCapacity,0);
  sim.tick();assert.equal(power.progress,.6);assert.equal(water.progress,.6);
  sim.setBuildingActive(power.id,true);sim.setBuildingActive(water.id,false);
  assert.equal(sim.state.stats.powerCapacity,750);assert.equal(sim.state.stats.waterCapacity,0);
  sim.setBuildingActive(water.id,true);
  sim.tile(1,32).road=0;sim.recalculate();
  assert.equal(sim.state.stats.powerCapacity,0);assert.equal(sim.state.stats.waterCapacity,0);
  sim.tile(1,32).road=1;sim.recalculate();sim.tick();sim.tick();
  assert.equal(sim.state.stats.powerCapacity,1600);assert.equal(sim.state.stats.waterCapacity,2000);
  power.level=water.level=1;power.progress=water.progress=.6;sim.recalculate();
  assert.equal(sim.state.stats.powerCapacity,0);assert.equal(sim.state.stats.waterCapacity,0);
});

test('capacity warnings locate an affordable unlocked utility and otherwise offer new construction',()=>{
  const sim=city();
  for(let x=4;x<=12;x++){
    sim.tile(x,32).road=1;
    sim._newBuilding(x,31,'industrial',true).level=4;
  }
  sim.recalculate();
  const warnings=()=>sim.state.stats.alerts.filter(a=>/容量即将不足/.test(a.text));
  assert.equal(warnings().length,2);assert(warnings().every(a=>!a.text.includes('升级')));
  sim.state.milestones.density=true;sim.recalculate();
  for(const type of ['power','water']){
    const b=sim.state.buildings.find(b=>b.type===type),label=type==='power'?'电力':'供水';
    const alert=warnings().find(a=>a.text.startsWith(label));
    assert.match(alert.text,/升级/);assert.deepEqual([alert.x,alert.y],[b.x,b.y]);
  }
  sim.state.money=0;sim.recalculate();assert(warnings().every(a=>!a.text.includes('升级')));
});
