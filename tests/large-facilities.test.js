import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingCells} from '../src/building-footprint.js';
function town(){const s=new CitySimulation();s.state.money=100000;for(let x=7;x<=30;x++)s.tile(x,32).road=1;for(const [type,x]of [['power',8],['water',9]])s.build(type,[{x,y:31}]);return s;}
test('hospital unlocks at twenty thousand; both new facilities reserve four tiles with one price and survive move/save/demolition',()=>{
 for(const type of ['hospital','stadium']){
  const s=town();const spot={x:14,y:30};
  if(type==='hospital'){s.state.stats.population=19999;assert.match(s.preview(type,[spot]).reason,/20,000/);const before=s.serialize();assert(!s.build(type,[spot]).ok);assert.equal(s.serialize(),before);s.state.stats.population=20000;}
  assert.equal(s.preview(type,[spot]).cells.length,4);const money=s.state.money;assert(s.build(type,[spot]).ok);assert.equal(s.state.money,money-(type==='hospital'?15000:9000));
  const b=s.state.buildings.find(b=>b.type===type);assert.equal(b.footprint,2);assert(b.coverageCells.length);assert(s.moveBuilding(b.id,{x:15,y:30}).ok);
  const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.find(v=>v.id===b.id).footprint,2);
  const before=copy.serialize(),funds=copy.state.money;assert(copy.build('bulldoze',buildingCells(b)).ok);assert.equal(copy.state.money,funds+(type==='hospital'?3000:1800));copy.undo();assert.equal(copy.serialize(),before);
 }
});
test('hospital and stadium substitute for their service categories; same category uses only the largest bonus',()=>{
 const s=town();s.build('clinic',[{x:12,y:31}]);s.build('sportsHall',[{x:14,y:31}]);
 const first=s.tile(13,30).communityBonus;assert.equal(first,7);
 s.state.stats.population=20000;assert(s.build('hospital',[{x:17,y:30}]).ok);assert(s.build('stadium',[{x:20,y:30}]).ok);
 assert.equal(s.tile(13,30).communityBonus,10);
 s._newBuilding(13,31,'residential',true);s.recalculate();const home=s.state.buildings.at(-1);assert(home.services.clinic);assert(home.services.sportsHall);
 s.setBuildingActive(s.state.buildings.find(b=>b.type==='clinic').id,false);assert(home.services.clinic);
 s.setBuildingActive(s.state.buildings.find(b=>b.type==='hospital').id,false);assert(!home.services.clinic);
});
