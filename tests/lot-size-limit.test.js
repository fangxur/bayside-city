import test from 'node:test';import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';import {BUSINESS_KINDS} from '../src/business-kinds.js';import {COMMUNITY_BUILDINGS} from '../src/community-buildings.js';import {buildingCapacity} from '../src/progression.js';import {buildingCells,newBuildingFootprint} from '../src/building-footprint.js';
test('large private styles are two by two, neighborhood premises stay one by one and the metro complex is three by three',()=>{
 const large=['sukiyaHouse','gasshoHouse','japaneseApartment','parisApartment','londonTerrace','thamesWarehouse','courtyard','spanish','french','italian','huizhou','bai','miaoVillage','tulou','jiangnan','shanxiCourtyard','hakkaWeilong','teaHouse','market','office','hotel','departmentStore','foodHall','europeanArcade','japaneseMarket'];
 for(const [kind,def]of Object.entries(BUSINESS_KINDS))if(['residential','commercial'].includes(def.zone))assert.equal(newBuildingFootprint(kind),large.includes(kind)?2:1,kind);
 for(const [kind,def]of Object.entries(COMMUNITY_BUILDINGS))if(def.category==='commercial')assert.equal(newBuildingFootprint(kind),kind==='shoppingComplex'?3:1,kind);
});
test('legacy three-cell estates compact without losing population or access and remain loadable',()=>{
 for(const [type,kind]of [['residential','french'],['commercial','hotel']]){
  const s=new CitySimulation();for(let x=8;x<=16;x++)s.tile(x,32).road=1;
  if(kind){s.tile(10,29).zone=type;s.tile(10,29).businessKind=kind;}
  const b=s._newBuilding(10,29,type,true,3);if(type==='residential')b.population=80;
  const original=buildingCells(b),copy=CitySimulation.deserialize(s.serialize()),small=copy.state.buildings.find(v=>v.id===b.id);
  assert.equal(small.footprint,2);assert.equal(small.y,30);assert(small.connected);assert.equal(small.population,b.population);assert.equal(small.level,b.level);
  const kept=new Set(buildingCells(small).map(c=>c.y*64+c.x));
  for(const c of original)if(!kept.has(c.y*64+c.x)){const t=copy.tile(c.x,c.y);assert.equal(t.buildingId,null);assert.equal(t.zone,null);assert.equal(t.businessKind,undefined);}
  if(kind)assert.equal(small.legacyLotArea,9);if(type==='residential')assert.equal(buildingCapacity(small),90);
  const again=CitySimulation.deserialize(copy.serialize());assert.equal(again.state.buildings[0].footprint,small.footprint);assert.equal(again.state.buildings[0].population,b.population);
 }
});

test('existing small shopping complexes keep their saved footprint while new ones use nine cells',()=>{
 for(const size of [1,2]){
  const s=new CitySimulation();for(let x=8;x<=16;x++)s.tile(x,32).road=1;
  const b=s._newBuilding(10,32-size,'shoppingComplex',true,size),copy=CitySimulation.deserialize(s.serialize()),saved=copy.state.buildings.find(v=>v.id===b.id);
  assert.equal(buildingCells(saved).length,size**2);assert(saved.connected);
  assert.equal(CitySimulation.deserialize(copy.serialize()).state.buildings[0].footprint,size===1?undefined:2);
 }
 const s=new CitySimulation();s.state.money=1000000;s.state.stats.population=50000;
 const preview=s.preview('shoppingComplex',[{x:5,y:29}]);assert.equal(preview.cells.length,9);
});

test('old large homes and newly-large commercial kinds retain four cells while small shops compact without losing capacity',()=>{
 for(const [kind,def]of Object.entries(BUSINESS_KINDS).filter(([kind])=>['courtyard','spanish','french','italian','miaoVillage','tulou','teaHouse','market','diner','mediterranean','office','hotel','departmentStore','foodHall','europeanArcade','japaneseMarket'].includes(kind))){
  const sim=new CitySimulation();sim.tile(3,30).zone=def.zone;sim.tile(3,30).businessKind=kind;
  const b=sim._newBuilding(3,30,def.zone,true,2);if(def.zone==='residential')b.population=35;
  const capacity=buildingCapacity(b),copy=CitySimulation.deserialize(sim.serialize()),saved=copy.state.buildings[0];
  const large=def.zone==='residential'||['teaHouse','market','office','hotel','departmentStore','foodHall','europeanArcade','japaneseMarket'].includes(kind),cells=large?4:1;
  assert.equal(saved.id,b.id);assert.equal(saved.footprint,large?2:1);assert.equal(saved.legacyLotArea,large?undefined:4);assert.equal(saved.population,b.population);assert.equal(buildingCapacity(saved),capacity);assert(saved.connected);
  assert.equal(copy.state.tiles.filter(t=>t.buildingId===b.id).length,cells);assert.equal(CitySimulation.deserialize(copy.serialize()).state.buildings[0].legacyLotArea,large?undefined:4);
 }
});
test('invalid legacy capacity flags remain rejected',()=>{
 for(const [kind,area] of [['nordic',4],['french',16],['courtyard',9]]){
  const sim=new CitySimulation();sim.tile(3,31).zone='residential';sim.tile(3,31).businessKind=kind;sim._newBuilding(3,31,'residential',true);
  const raw=JSON.parse(sim.serialize());raw.buildings[0].footprint=1;raw.buildings[0].legacyLotArea=area;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
 }
});

test('already compacted homes remain single-cell without taking neighboring land or losing residents',()=>{
 for(const kind of ['courtyard','spanish','italian','french'])for(const area of (kind==='french'?[4,9]:[4])){
  const sim=new CitySimulation();sim.tile(3,31).zone='residential';sim.tile(3,31).businessKind=kind;
  const b=sim._newBuilding(3,31,'residential',true);Object.assign(b,{footprint:1,legacyLotArea:area,population:area*10-1});
  assert(sim.build('british',[{x:4,y:31}]).ok);
  const copy=CitySimulation.deserialize(sim.serialize()),saved=copy.state.buildings.find(v=>v.id===b.id);
  assert.equal(saved.footprint,1);assert.equal(saved.population,b.population);assert.equal(buildingCapacity(saved),area*10);assert.equal(copy.tile(4,31).businessKind,'british');assert.equal(copy.state.tiles.filter(t=>t.buildingId===b.id).length,1);
 }
});
