import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {COMMUNITY_BUILDINGS} from '../src/community-buildings.js';
import {buildingCells} from '../src/building-footprint.js';
test('metropolitan facilities use their 40000 or 50000 stage, reserve configured cells, charge once and preserve movement/save/undo',()=>{
 for(const type of ['grandStadium','grandGallery','shoppingComplex']){
  const s=new CitySimulation();s.state.money=1000000;
  for(const [t,x]of [['power',1],['water',2]]){s.build(t,[{x,y:31}]);s.state.buildings.at(-1).level=6;}
  s.recalculate();const size=COMMUNITY_BUILDINGS[type].footprint,spot={x:5,y:32-size},target=COMMUNITY_BUILDINGS[type].minPopulation;s.state.stats.population=target-1;
  const before=s.serialize();assert(!s.build(type,[spot]).ok);assert.equal(s.serialize(),before);
  s.state.stats.population=target;assert.equal(s.preview(type,[spot]).cells.length,size**2);
  const money=s.state.money;assert(s.build(type,[spot]).ok);assert.equal(s.state.money,money-COMMUNITY_BUILDINGS[type].cost);
  const b=s.state.buildings.find(v=>v.type===type);assert(b.connected);assert(b.coverageCells.length>0);
  if(type==='shoppingComplex')assert.equal(b.jobs,500);
  assert(s.moveBuilding(b.id,{x:6,y:32-size}).ok);
  const copy=CitySimulation.deserialize(s.serialize()),saved=copy.serialize();assert.equal(buildingCells(copy.state.buildings.find(v=>v.id===b.id)).length,size**2);
  assert(copy.build('bulldoze',[{x:6+size-1,y:31}]).ok);assert(!copy.state.buildings.some(v=>v.id===b.id));copy.undo();assert.equal(copy.serialize(),saved);
 }
});

test('complete metropolitan facilities reject upgrades without charging and preserve legacy levels',()=>{
 for(const type of ['grandStadium','grandGallery','shoppingComplex']){
  const s=new CitySimulation();s.state.money=1000000;s.state.stats.population=50000;
  assert(s.build(type,[{x:5,y:32-COMMUNITY_BUILDINGS[type].footprint}]).ok);
  Object.assign(s.state.milestones,{density:true,completed:true,metropolis:true,capital:true,regional:true,global:true});
  const b=s.state.buildings.find(b=>b.type===type);
  for(const level of [1,4,6]){
   b.level=level;s.recalculate();const before=s.serialize();
   assert.match(s.preview('upgrade',[b]).reason,/无需升级/);
   assert(!s.build('upgrade',[b]).ok);assert.equal(s.serialize(),before);
   const loaded=CitySimulation.deserialize(before),copy=loaded.state.buildings.find(c=>c.id===b.id);
   assert.equal(copy.level,level);assert.equal(loaded.state.money,s.state.money);
   assert.match(loaded.getInfo(b.x,b.y).subtitle,/完整大型设施/);
  }
 }
});
