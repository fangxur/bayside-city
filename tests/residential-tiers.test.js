import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {BUSINESS_KINDS} from '../src/business-kinds.js';
import {buildingCells,footprintSize} from '../src/building-footprint.js';
import {buildingCapacity,upgradeOffer} from '../src/progression.js';
import {privateMaintenance} from '../src/economy.js';
test('large residential styles reserve all four cells and survive move, upgrades, saves and undo',()=>{
 for(const kind of ['spanish','italian','courtyard','french','huizhou','bai','miaoVillage','tulou','jiangnan','shanxiCourtyard','hakkaWeilong']){
  const s=new CitySimulation();s.state.money=100000;const spec=BUSINESS_KINDS[kind],pos={x:3,y:32-spec.footprint};
  s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
  const preview=s.preview(kind,[pos]);assert(preview.valid);assert.equal(preview.cells.length,spec.footprint**2);assert.equal(preview.cost,spec.cost);
  const money=s.state.money;assert(s.build(kind,[pos]).ok);assert.equal(s.state.money,money-spec.cost);
  const b=s.state.buildings.find(b=>b.type==='residential');assert.equal(footprintSize(b),2);assert.equal(b.businessKind,kind);assert(b.progress<1);
  for(const cell of buildingCells(b)){const t=s.tile(cell.x,cell.y);assert.equal(t.buildingId,b.id);assert.equal(t.businessKind,kind);assert.equal(t.zone,'residential');}
  assert.equal(buildingCapacity(b),10*spec.footprint**2);assert.equal(privateMaintenance(b),8*spec.footprint**2);
  assert(!s.preview('road',[pos]).valid);
  b.progress=1;s.state.milestones.density=true;s.recalculate();assert.equal(upgradeOffer(b,s.state.milestones).cost,900*spec.footprint**2);
  assert(s.build('upgrade',[pos]).ok);assert.equal(b.level,2);assert.equal(footprintSize(b),2);
  assert(s.moveBuilding(b.id,{x:3,y:33}).ok);for(const cell of preview.cells)assert.equal(s.tile(cell.x,cell.y).buildingId,null);
  const copy=CitySimulation.deserialize(s.serialize());assert.equal(footprintSize(copy.state.buildings.find(v=>v.id===b.id)),2);
  assert(copy.build('bulldoze',[{x:3,y:33}]).ok);assert.equal(copy.state.buildings.filter(v=>v.type==='residential').length,0);assert(copy.undo().ok);assert.equal(footprintSize(copy.state.buildings.find(v=>v.id===b.id)),2);
 }
});
test('large homes reject occupied parcels, roads, insufficient funds and incomplete edge plots without partial changes',()=>{
 for(const reason of ['building','road','money','edge']){
  const s=new CitySimulation();let pos={x:3,y:30};
  if(reason==='building')s.build('power',[{x:4,y:31}]);
  if(reason==='road')pos={x:3,y:32};
  if(reason==='money')s.state.money=BUSINESS_KINDS.courtyard.cost-1;
  if(reason==='edge')pos={x:63,y:30};
  const before=s.serialize();assert(!s.build('courtyard',[pos]).ok,reason);assert.equal(s.serialize(),before);
 }
 const s=new CitySimulation();assert(s.build('courtyard',[{x:3,y:30}]).ok);assert.equal(s.tile(5,31).zone,null);assert(s.build('british',[{x:5,y:31}]).ok);
});
test('small homes use per-cell prices and legacy courtyard homes retain single-cell economics',()=>{
 const s=new CitySimulation();const before=s.state.money;assert(s.build('british',[{x:3,y:31},{x:4,y:31}]).ok);assert.equal(s.state.money,before-320);
 s.tile(5,31).zone='residential';s.tile(5,31).businessKind='courtyard';const b=s._newBuilding(5,31,'residential',true);s.recalculate();
 const copy=CitySimulation.deserialize(s.serialize()),saved=copy.state.buildings.find(v=>v.id===b.id);assert.equal(saved.footprint,undefined);assert.equal(buildingCapacity(saved),10);assert.equal(privateMaintenance(saved),8);
});
test('new one-cell homes grow, retain style through upgrades, and round-trip without expanding',()=>{
 for(const kind of ['dutch','chalet','tibetan']){
  const s=new CitySimulation();s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
  const p={x:4,y:31},before=s.state.money;assert(s.build(kind,[p]).ok);assert.equal(s.state.money,before-BUSINESS_KINDS[kind].cost);s.tick();
  const b=s.state.buildings.find(b=>b.type==='residential');assert.equal(b.businessKind,kind);assert.equal(footprintSize(b),1);b.progress=1;s.state.milestones.density=true;s.recalculate();assert(s.build('upgrade',[p]).ok);assert(s.rotateBuilding(b.id).ok);assert(s.moveBuilding(b.id,{x:5,y:33}).ok);
  const saved=CitySimulation.deserialize(s.serialize()).state.buildings.find(v=>v.id===b.id);assert.equal(saved.businessKind,kind);assert.equal(saved.level,2);assert.equal(saved.rotation,1);assert.equal(footprintSize(saved),1);
 }
});
test('legacy one-cell Jiangnan homes stay one-cell when loaded while new ones use a full courtyard plot',()=>{
 const old=new CitySimulation();old.tile(4,31).zone='residential';old.tile(4,31).businessKind='jiangnan';
 const home=old._newBuilding(4,31,'residential',true,1),copy=CitySimulation.deserialize(old.serialize()),saved=copy.state.buildings.find(b=>b.id===home.id);
 assert.equal(footprintSize(saved),1);assert.equal(copy.state.tiles.filter(tile=>tile.buildingId===home.id).length,1);
 const modern=new CitySimulation();modern.state.money=100000;const preview=modern.preview('jiangnan',[{x:4,y:30}]);
 assert(preview.valid);assert.equal(preview.cells.length,4);assert.equal(preview.cost,1200);
});
