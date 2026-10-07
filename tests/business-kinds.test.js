import test from 'node:test';
import assert from 'node:assert/strict';
import {ZONE_ECONOMY} from '../src/economy.js';
import {CitySimulation} from '../src/simulation.js';
import {BUSINESS_KINDS} from '../src/business-kinds.js';
import {addFactoryPrerequisites} from './factory-fixture.js';

test('neighborhood services are distinct one-cell commercial businesses',()=>{
 const expected={
  pharmacy:['社区药店','pharmaceutical'],repairGarage:['汽车修理店','carFactory'],
  laundry:['社区洗衣店','textile'],hardware:['五金工具店','machinery'],
 };
 for(const [kind,[name]] of Object.entries(expected)){
  assert.equal(BUSINESS_KINDS[kind].zone,'commercial');
  assert.equal(BUSINESS_KINDS[kind].footprint,1);
  assert.equal(BUSINESS_KINDS[kind].name,name);
  assert.equal(BUSINESS_KINDS[kind].architecture,kind);
 }
});
test('business zoning preserves chosen kinds through development, upgrade, move, save and demolition',()=>{
 for(const [kind,def] of Object.entries(BUSINESS_KINDS)){
  let s=new CitySimulation();for(let x=8;x<=16;x++)s.tile(x,32).road=1;s.recalculate();
  if(def.zone==='commercial')addFactoryPrerequisites(s);
  const y=32-(def.footprint||1),cells=[{x:10,y},{x:11,y}];
  assert.equal(s.preview(kind,cells).cost,(def.cost??ZONE_ECONOMY[def.zone].cost)*(def.footprint>1?1:2));
  assert(s.build(kind,cells).ok);
  s=CitySimulation.deserialize(s.serialize());
  assert.equal(s.tile(10,y).businessKind,kind);
  const b=def.footprint>1?s.state.buildings.find(v=>v.x===10&&v.y===y):s._newBuilding(10,y,def.zone,true);b.progress=1;
  assert.equal(b.businessKind,kind);
  s.state.milestones.density=true;
  assert(s.build('upgrade',[cells[0]]).ok);
  assert.equal(b.businessKind,kind);
  assert(s.moveBuilding(b.id,{x:14,y}).ok);
  assert.equal(s.tile(10,y).businessKind,undefined);
  assert.equal(s.tile(14,y).businessKind,kind);
  s=CitySimulation.deserialize(s.serialize());
  assert.equal(s.state.buildings.find(v=>v.id===b.id).businessKind,kind);
  assert(s.build('bulldoze',[{x:14,y}]).ok);
  assert.equal(s.tile(14,y).businessKind,undefined);
  s.undo();assert.equal(s.tile(14,y).businessKind,kind);
 }
});
test('empty business zoning can be changed; invalid specialization saves are rejected',()=>{
 const s=new CitySimulation(),y=31,c=[{x:10,y}];
 addFactoryPrerequisites(s);
 assert(s.build('oldStreet',c).ok);assert(s.build('cafe',c).ok);
 assert.equal(s.tile(10,y).businessKind,'cafe');
 assert(s.build('commercial',c).ok);assert.equal(s.tile(10,y).businessKind,undefined);
 assert(s.build('workshop',c).ok);
 const raw=JSON.parse(s.serialize());raw.tiles[31*64+10].businessKind='hotel';
 assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
});
