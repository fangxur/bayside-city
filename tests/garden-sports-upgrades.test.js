import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingCells} from '../src/building-footprint.js';
import {gardenRadius} from '../src/progression.js';
import {civicGardenGroups} from '../src/city-layout.js';
test('gardens upgrade through four tiers without utilities; 2x2 groups charge once per member and undo atomically',()=>{
 for(const type of ['park','plaza']){
 const s=new CitySimulation();s.state.money=100000;
 for(const [x,y]of [[15,15],[16,15],[15,16],[16,16]])s._newBuilding(x,y,type,true,1);s.recalculate();
 const b=s.state.buildings[0],radius=gardenRadius(b);
 assert(!s.preview('upgrade',[b]).valid);Object.assign(s.state.milestones,{density:true,metropolis:true,capital:true});
 for(let level=2;level<=4;level++){
  const p=s.preview('upgrade',[b,b]);assert.equal(p.cells.length,4);const money=s.state.money;
  assert(s.build('upgrade',[b,b]).ok);assert.equal(s.state.money,money-p.cost);
  assert(s.state.buildings.every(b=>b.level===level));assert.equal(civicGardenGroups(s.state.buildings).get(b.id).level,level);
 }
 assert(gardenRadius(b)>radius);assert(s.tile(15+radius,15).amenity>0);assert.equal(s.state.stats.powerUsed,0);
 assert(!s.preview('upgrade',[b]).valid);assert.doesNotThrow(()=>CitySimulation.deserialize(s.serialize()));
 s.undo();assert(s.state.buildings.every(b=>b.level===3));
 s.state.money=1;const saved=s.serialize();assert(!s.build('upgrade',[b]).ok);assert.equal(s.serialize(),saved);
 }
});
test('new sports halls use one cell, connect to the road, move and demolish once',()=>{
 const s=new CitySimulation();s.state.money=100000;
 for(let x=7;x<=15;x++)s.tile(x,32).road=1;
 assert(!s.preview('sportsHall',[{x:10,y:32}]).valid);
 assert(!s.preview('sportsHall',[{x:63,y:63}]).valid);
 const origin={x:12,y:31};assert.equal(s.preview('sportsHall',[origin]).cells.length,1);
 const money=s.state.money;assert(s.build('sportsHall',[origin]).ok);assert.equal(s.state.money,money-3600);
 const b=s.state.buildings[0];assert.equal(b.connected,true);assert(buildingCells(b).every(c=>s.tile(c.x,c.y).buildingId===b.id));
 assert.equal(s.getInfo(12,31).title,'社区体育馆');assert(!s.build('park',[{x:12,y:31}]).ok);
 assert(s.moveBuilding(b.id,{x:13,y:31}).ok);assert.equal(s.tile(12,31).buildingId,null);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings[0].footprint,undefined);
 const before=copy.serialize(),funds=copy.state.money;assert(copy.build('bulldoze',buildingCells(b)).ok);
 assert.equal(copy.state.money,funds+720);assert.equal(copy.state.buildings.length,0);assert(buildingCells(b).every(c=>copy.tile(c.x,c.y).buildingId===null));
 copy.undo();assert.equal(copy.serialize(),before);
 const bad=JSON.parse(before);bad.tiles[31*64+13].buildingId=null;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(bad)));
});
test('older two-cell sports halls retain their footprint without expanding or shrinking',()=>{
 const s=new CitySimulation();for(let x=15;x<=18;x++)s.tile(x,14).road=1;const b=s._newBuilding(15,15,'sportsHall',true,2);s.recalculate();
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(buildingCells(copy.state.buildings[0]).length,4);
 assert(copy.moveBuilding(b.id,{x:17,y:15}).ok);
});
