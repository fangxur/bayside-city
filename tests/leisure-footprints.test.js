import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation,TOOLS} from '../src/simulation.js';
import {buildingCells,newBuildingFootprint} from '../src/building-footprint.js';
import {civicGardenGroups} from '../src/city-layout.js';
test('new leisure footprints reserve, price, move and demolish the entire site',()=>{
 for(const [type,size]of [['plaza',2],['chessPavilion',2],['operaStage',2]]){
  const s=new CitySimulation();s.state.money=100000;for(let x=8;x<=18;x++)s.tile(x,32).road=1;s.recalculate();
  const pos={x:10,y:32-size},funds=s.state.money;assert.equal(newBuildingFootprint(type),size);
  assert.equal(s.preview(type,[pos]).cells.length,size*size);assert(s.build(type,[pos]).ok);
  const b=s.state.buildings[0];assert.equal(s.state.money,funds-TOOLS[type].cost);assert.equal(buildingCells(b).length,size*size);
  assert(buildingCells(b).every(c=>s.tile(c.x,c.y).buildingId===b.id));assert(!s.build('park',[{x:10+size-1,y:31}]).ok);
  assert(s.moveBuilding(b.id,{x:14,y:32-size}).ok);assert.equal(s.tile(10,31).buildingId,null);
  const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings[0].footprint,size);
  const before=copy.serialize();assert(copy.build('bulldoze',[{x:14+size-1,y:31}]).ok);assert.equal(copy.state.buildings.length,0);assert(copy.undo().ok);assert.equal(copy.serialize(),before);
 }
});
test('legacy leisure sizes remain unchanged and only single-cell gardens form groups',()=>{
 for(const [type,size]of [['plaza',1],['chessPavilion',1],['operaStage',2],['operaStage',3]]){
  const s=new CitySimulation();s._newBuilding(10,10,type,true,size);s.recalculate();
  const copy=CitySimulation.deserialize(s.serialize());assert.equal(buildingCells(copy.state.buildings[0]).length,size*size);
 }
 assert.equal(civicGardenGroups([{id:1,x:10,y:10,type:'plaza',footprint:2},{id:2,x:11,y:10,type:'plaza'},{id:3,x:10,y:11,type:'plaza'},{id:4,x:11,y:11,type:'plaza'}]).size,0);
});
