import test from 'node:test';import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';import {BUSINESS_KINDS} from '../src/business-kinds.js';import {buildingCells,footprintSize} from '../src/building-footprint.js';import {privateMaintenance} from '../src/economy.js';import {buildingCapacity,upgradeOffer} from '../src/progression.js';import {CityRenderer} from '../src/renderer.js';import {addFactoryPrerequisites} from './factory-fixture.js';
test('commercial premises use their designed footprint, charge once and retain identity through rotation, upgrades and saves',()=>{
 for(const kind of ['market','teaHouse','diner','mediterranean','office','hotel']){
  const s=new CitySimulation();s.state.money=100000;addFactoryPrerequisites(s);const spec=BUSINESS_KINDS[kind],cell={x:10,y:32-spec.footprint},money=s.state.money;
  const p=s.preview(kind,[cell]);assert(p.valid);assert.equal(p.cost,spec.cost);assert.equal(p.cells.length,spec.footprint**2);assert(s.build(kind,[cell]).ok);assert.equal(s.state.money,money-spec.cost);
  if(spec.footprint===1){assert.equal(s.tile(cell.x,cell.y).buildingId,null);s.tick();}
  const b=s.state.buildings.find(v=>v.businessKind===kind&&v.type==='commercial');assert.equal(footprintSize(b),spec.footprint);assert(b.progress>0&&b.progress<1);
  for(const c of buildingCells(b)){assert.equal(s.tile(c.x,c.y).buildingId,b.id);assert.equal(s.tile(c.x,c.y).businessKind,kind);}
  assert.equal(buildingCapacity(b),8*spec.footprint**2);assert.equal(privateMaintenance(b),10*spec.footprint**2);
  b.progress=1;s.state.milestones.density=true;s.recalculate();assert.equal(b.jobs,8*spec.footprint**2);assert.equal(upgradeOffer(b,s.state.milestones).cost,1000*spec.footprint**2);
  assert(s.rotateBuilding(b.id).ok);assert(s.build('upgrade',[cell]).ok);assert.equal(b.rotation,1);assert(s.moveBuilding(b.id,{x:14,y:cell.y}).ok);
  const copy=CitySimulation.deserialize(s.serialize()),saved=copy.state.buildings.find(v=>v.id===b.id);assert.equal(footprintSize(saved),spec.footprint);assert.equal(saved.rotation,1);
  assert(copy.build('bulldoze',[{x:14+spec.footprint-1,y:cell.y+spec.footprint-1}]).ok);assert(!copy.state.buildings.some(v=>v.id===b.id));assert(copy.undo().ok);
 }
});
test('commercial tiers preserve supplier prerequisites, reject collisions, and retain old single-cell shops',()=>{
 const s=new CitySimulation(),cell={x:10,y:33};let before=s.serialize();assert(!s.build('market',[cell]).ok);assert.equal(s.serialize(),before);
 addFactoryPrerequisites(s);s.build('power',[cell]);before=s.serialize();assert(!s.build('market',[cell]).ok);assert.equal(s.serialize(),before);
 s.build('bulldoze',[cell]);s.state.money=BUSINESS_KINDS.market.cost-1;before=s.serialize();assert(!s.build('market',[cell]).ok);assert.equal(s.serialize(),before);
 s.tile(10,31).zone='commercial';s.tile(10,31).businessKind='market';const b=s._newBuilding(10,31,'commercial',true);s.recalculate();
 const saved=CitySimulation.deserialize(s.serialize()).state.buildings.find(v=>v.id===b.id);assert.equal(saved.footprint,undefined);assert.equal(buildingCapacity(saved),8);assert.equal(privateMaintenance(saved),10);
});
test('mixed commercial zoning grows only one-cell shops while large premises require whole-building placement',()=>{
 const s=new CitySimulation();addFactoryPrerequisites(s);
 for(let i=0;i<16;i++){const x=18+i%8,y=25+Math.floor(i/8);s.tile(x,y).zone='commercial';const b=s._newBuilding(x,y,'commercial',true);assert.equal(footprintSize(b),1);assert.equal(BUSINESS_KINDS[b.businessKind].footprint,1);}
 for(const kind of ['teaHouse','market','office','hotel'])assert.equal(s.preview(kind,[{x:18,y:30}]).cells.length,4);
});
test('commercial models render every tier at the selected footprint and rotation',()=>{
 const r=Object.create(CityRenderer.prototype),s=new CitySimulation();r.state=s.state;r._tile=(x,y)=>s.tile(x,y);
 for(const kind of ['market','teaHouse','diner','mediterranean','office','hotel'])for(const level of [1,4,6]){
  let count=0;const batch={add(...a){assert(a.slice(2).every(Number.isFinite),kind);count++;},box(...a){this.add('box',...a);}};
  r._building(batch,{id:1,type:'commercial',businessKind:kind,x:10,y:10,footprint:BUSINESS_KINDS[kind].footprint,level,rotation:1,progress:1,variant:0});assert(count>0);
 }
});
