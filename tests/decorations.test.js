import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {DECORATIONS} from '../src/decorations.js';
test('decorations work on isolated land, supply leisure-landscape coverage, and persist through all operations',()=>{
 for(const [type,d] of Object.entries(DECORATIONS)){
  const s=new CitySimulation(),money=s.state.money,c={x:12,y:12};
  assert(s.build(type,[c]).ok);assert.equal(s.state.money,money-d.cost);
  const b=s.state.buildings.find(b=>b.type===type);assert.equal(b.problem,'');assert(b.coverageCells.length);assert(s.tile(13,12).amenity>0);assert(s.tile(13,12).services.park);
  assert.equal(s.getInfo(12,12).title,d.name);
  s.setBuildingActive(b.id,false);assert.equal(s.tile(13,12).amenity,0);assert(!s.tile(13,12).services.park);
  s.setBuildingActive(b.id,true);assert(s.moveBuilding(b.id,{x:20,y:12}).ok);
  const copy=CitySimulation.deserialize(s.serialize());assert(copy.tile(21,12).amenity>0);assert.equal(copy.tile(12,12).buildingId,null);
  const before=copy.serialize();assert(copy.build('bulldoze',[{x:20,y:12}]).ok);copy.undo();assert.equal(copy.serialize(),before);
  assert(!copy.preview(type,[{x:3,y:32}]).valid);
 }
});
