import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {cityHallRequirement} from '../src/city-services.js';
import {unlockedRoadLevel} from '../src/progression.js';
const grow=s=>{for(const b of s.state.buildings)if(b.type==='residential'){b.level=4;b.population=80;}s.state.milestones.bridge=true;s.state.profitableMonths=3;s.recalculate();};
test('one thousand population requires an operating city hall, and higher stages cannot skip it',()=>{
 const s=new CitySimulation({demo:true});grow(s);
 assert(s.state.stats.population>2000);
 assert.equal(s.state.milestones.density,false);assert.equal(s.state.milestones.completed,false);
 const objective=s.getObjective();assert.equal(objective.target,1000);assert.equal(objective.action,'cityHall');assert(objective.progress<1);
 assert.equal(s.preview('upgrade',[{x:8,y:32}]).valid,true,'population opens roads without city hall');
 assert.equal(s.preview('upgrade',[s.state.buildings.find(b=>b.type==='residential')]).valid,false,'buildings still require the city stage');
 assert(s.build('cityHall',[{x:10,y:23}]).ok);
 assert.equal(s.state.milestones.density,true);
 const hall=s.state.buildings.find(b=>b.type==='cityHall');
 s.setBuildingActive(hall.id,false);assert.equal(s.state.milestones.density,true);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.milestones.density,true);
});
test('a paused city hall blocks promotion until enabled, while population continues above one thousand',()=>{
 const s=new CitySimulation({demo:true});s.build('cityHall',[{x:10,y:23}]);
 const hall=s.state.buildings.find(b=>b.type==='cityHall');s.setBuildingActive(hall.id,false);grow(s);
 assert(!s.state.milestones.density);assert.match(s.getObjective().requirements[1].detail,/启用/);
 s.setBuildingActive(hall.id,true);assert(s.state.milestones.density);
});
test('road upgrades follow population and ignore city hall construction or operating state',()=>{
 const s=new CitySimulation({demo:true}),road={x:8,y:32},home=s.state.buildings.find(b=>b.type==='residential');
 assert(s.state.stats.population<1000);assert.equal(s.state.milestones.density,false);
 assert.equal(unlockedRoadLevel(s.state),1,'upgrade tool starts visually locked');
 assert.match(s.preview('upgrade',[road]).reason,/1,000/);
 s.state.milestones.bridge=true;s.recalculate();assert.equal(s.getObjective().action,'cityHall');
 assert(s.build('cityHall',[{x:10,y:23}]).ok);
 assert.equal(s.state.milestones.density,false);
 assert.equal(unlockedRoadLevel(s.state),1,'city hall alone does not unlock roads');
 assert.equal(s.preview('upgrade',[road]).valid,false);
 for(const residential of s.state.buildings.filter(b=>b.type==='residential'))residential.population=0;
 home.population=1000;s.recalculate();
 assert.equal(unlockedRoadLevel(s.state),2,'population unlocks roads');
 assert.equal(s.preview('upgrade',[road]).valid,true);
 assert.equal(s.preview('upgrade',[road]).cost,30);
 const hall=s.state.buildings.find(b=>b.type==='cityHall');s.setBuildingActive(hall.id,false);
 assert.equal(unlockedRoadLevel(s.state),2,'pausing the hall cannot relock roads');
 assert(s.build('upgrade',[road]).ok);assert.equal(s.tile(road.x,road.y).road,2);
});
test('city hall status lists construction, road, electricity, water and activity requirements',()=>{
 assert.equal(cityHallRequirement([]).exists,false);
 const ready={type:'cityHall',active:true,connected:true,powered:true,watered:true,progress:1};
 assert(cityHallRequirement([ready]).met);
 for(const field of ['active','connected','powered','watered','progress']){
  const hall={...ready,[field]:field==='progress'?.5:false};
  assert(!cityHallRequirement([hall]).met);assert(cityHallRequirement([hall]).detail.length>0);
 }
});
