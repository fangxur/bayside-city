import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {upgradeOffer} from '../src/progression.js';
import {serviceDefinition,placementServiceCoverage,movedServiceCoverage,calculateServiceCoverage} from '../src/service-coverage.js';
function town(){
 const s=new CitySimulation();s.state.money=100000;
 Object.assign(s.state.milestones,{density:true,completed:true,metropolis:true,capital:true});
 for(let x=7;x<=28;x++)s.tile(x,32).road=1;
 for(const [type,x,y]of [['power',8,31],['water',9,31],['residential',12,31]])s._newBuilding(x,y,type,true);
 s.state.buildings.at(-1).level=2;s.recalculate();return s;
}
test('placement coverage matches functioning facilities without mutating the city',()=>{
 for(const [type,x,y]of [['cityHall',21,30],['fireStation',11,31]]){
  const s=town(),before=JSON.stringify(s.state);
  const preview=placementServiceCoverage(s.state,type,{x,y});
  assert(preview.cells.length>0);assert.equal(JSON.stringify(s.state),before);
  assert(s.build(type,[{x,y}]).ok);
  const b=s.state.buildings.find(b=>b.type===type);
  assert.deepEqual([...preview.cells].sort((a,b)=>a-b),[...b.coverageCells].sort((a,b)=>a-b));
 }
});
test('fire placement follows connected roads and unsupported tools have no range',()=>{
 const s=town();
 assert.equal(placementServiceCoverage(s.state,'fireStation',{x:40,y:40}).cells.length,0);
 const standard=placementServiceCoverage(s.state,'fireStation',{x:11,y:31});
 s.state.civic.fireBudget=130;
 assert(placementServiceCoverage(s.state,'fireStation',{x:11,y:31}).cells.length>standard.cells.length);
 assert.equal(placementServiceCoverage(s.state,'residential',{x:11,y:31}),null);
 assert.equal(placementServiceCoverage(s.state,'cityHall',null),null);
});
test('housing upgrades require working fire and medical service, then any leisure landscape and a clean environment',()=>{
 const s=town(),home=s.state.buildings.find(b=>b.type==='residential');
 const before=s.serialize();assert.match(s.preview('upgrade',[home]).reason,/消防.*医疗/);assert(!s.build('upgrade',[home]).ok);assert.equal(s.serialize(),before);
 s.build('fireStation',[{x:10,y:31}]);s.build('clinic',[{x:13,y:31}]);assert(s.preview('upgrade',[home]).valid);
 const clinic=s.state.buildings.find(b=>b.type==='clinic');s.setBuildingActive(clinic.id,false);assert(!s.preview('upgrade',[home]).valid);s.setBuildingActive(clinic.id,true);
 assert(s.build('upgrade',[home]).ok);home.progress=1;s.recalculate();assert.match(s.preview('upgrade',[home]).reason,/休闲景观/);
 s.build('plaza',[{x:11,y:29}]);assert(s.preview('upgrade',[home]).valid,'a plaza should replace a park');
 assert(s.moveBuilding(clinic.id,{x:25,y:31}).ok);assert(!s.preview('upgrade',[home]).valid);s.undo();assert(s.preview('upgrade',[home]).valid);
 const copy=CitySimulation.deserialize(s.serialize());const loaded=copy.state.buildings.find(b=>b.id===home.id);assert(copy.preview('upgrade',[loaded]).valid);
 assert(copy.build('upgrade',[loaded]).ok);assert.equal(loaded.level,4);
});
test('environment thresholds are inclusive and municipal stages cannot be bypassed',()=>{
 const b={type:'residential',level:3,progress:1,fireCovered:true,services:{clinic:true,park:true},environment:{amenity:12,pollution:20}};
 assert(upgradeOffer(b,{capital:true}).allowed);assert(!upgradeOffer(b,{}).allowed);
 b.environment.pollution=20.01;assert(!upgradeOffer(b,{capital:true}).allowed);
 b.environment.pollution=0;b.environment.amenity=11.99;assert(!upgradeOffer(b,{capital:true}).allowed);
 b.environment.amenity=20;b.services.park=false;assert(!upgradeOffer(b,{capital:true}).allowed);
});
test('functional buildings expose actual coverage; city hall coverage grows and inactive facilities stop serving',()=>{
 const s=town();
 for(const [type,x,y]of [['school',14,31],['clinic',15,31],['library',16,31],['sportsHall',18,31],['cityHall',21,30],['fireStation',11,31],['park',12,29]])assert(s.build(type,[{x,y}]).ok);
 for(const b of s.state.buildings.filter(b=>b.type!=='residential')){assert(serviceDefinition(s.state,b));assert(b.coverageCells.length);assert(b.coverageDescription);}
 const hall=s.state.buildings.find(b=>b.type==='cityHall'),home=s.state.buildings.find(b=>b.type==='residential');assert(home.services.cityHall);
 assert.equal(home.serviceLevels.cityHall,1);assert.equal(home.serviceLevels.fireStation,1);assert.equal(home.serviceLevels.clinic,1);
 const count=hall.coverageCells.length;hall.level=4;s.recalculate();assert(hall.coverageCells.length>count);
 assert.equal(home.serviceLevels.cityHall,4);
 s.setBuildingActive(hall.id,false);assert.equal(hall.coverageCells.length,0);assert(!home.services.cityHall);
 const school=s.state.buildings.find(b=>b.type==='school'),library=s.state.buildings.find(b=>b.type==='library');
 assert(home.services.school);assert(home.services.library);assert.equal(serviceDefinition(s.state,library).label,'文化与教育');
 s.setBuildingActive(school.id,false);assert(home.services.school,'the library should keep education covered');
 s.setBuildingActive(library.id,false);assert(!home.services.school);assert(!home.services.library);
 const fire=s.state.buildings.find(b=>b.type==='fireStation');assert(fire.coverageCells.includes(home.y*64+home.x));
 s.setBuildingActive(s.state.buildings.find(b=>b.type==='power').id,false);assert(!home.services.clinic);assert(!home.fireCovered);assert(home.services.park);
});

test('a library extends education coverage without turning schools into cultural facilities',()=>{
 const s=town(),home=s.state.buildings.find(b=>b.type==='residential');
 assert(s.build('library',[{x:16,y:31}]).ok);
 const library=s.state.buildings.find(b=>b.type==='library');library.level=3;s.recalculate();
 assert(home.services.library);assert(home.services.school);
 assert.equal(home.serviceLevels.library,3);assert.equal(home.serviceLevels.school,3);
 assert.equal(serviceDefinition(s.state,library).label,'文化与教育');
 assert.equal(placementServiceCoverage(s.state,'library',{x:16,y:31}).description.startsWith('文化与教育'),true);
 s.setBuildingActive(library.id,false);assert(!home.services.library);assert(!home.services.school);
 const school={id:999,type:'school',x:14,y:31,active:true,progress:1,level:2,connected:true,powered:true,watered:true};
 s.state.buildings.push(school);s.recalculate();
 assert(home.services.school);assert(!home.services.library,'school coverage should not masquerade as culture');
});

test('an operating pharmacy provides compact medical coverage and a placement preview',()=>{
 const s=town(),home=s.state.buildings.find(b=>b.type==='residential');
 const pharmacy={id:999,type:'commercial',businessKind:'pharmacy',x:15,y:31,level:2,progress:1,active:true,connected:true,powered:true,watered:true,workers:3};
 s.state.buildings.push(pharmacy);calculateServiceCoverage(s.state);
 assert.equal(serviceDefinition(s.state,pharmacy).label,'基础医疗与药事服务');
 assert.equal(serviceDefinition(s.state,pharmacy).radius,5);
 assert(home.services.clinic);assert.equal(home.serviceLevels.clinic,2);
 assert.match(placementServiceCoverage(s.state,'pharmacy',{x:15,y:31}).description,/基础医疗与药事服务 · 半径 4 格/);
 pharmacy.workers=0;calculateServiceCoverage(s.state);assert(!home.services.clinic,'an unstaffed pharmacy is not a medical resource');
 pharmacy.workers=3;pharmacy.active=false;calculateServiceCoverage(s.state);assert(!home.services.clinic);
});

test('moving a service facility previews its level-aware coverage at the destination without mutating the city',()=>{
 const s=town();assert(s.build('library',[{x:16,y:31}]).ok);
 const library=s.state.buildings.find(b=>b.type==='library');library.level=3;s.recalculate();
 const before=JSON.stringify(s.state),preview=movedServiceCoverage(s.state,library.id,{x:25,y:31}),basic=placementServiceCoverage(s.state,'library',{x:25,y:31});
 assert(preview);assert(preview.cells.includes(31*64+25));assert(preview.cells.length>basic.cells.length);assert.match(preview.description,/移动后文化与教育影响/);
 assert.equal(JSON.stringify(s.state),before);
 assert(s.build('fireStation',[{x:11,y:31}]).ok);const fire=s.state.buildings.find(b=>b.type==='fireStation');
 assert.equal(movedServiceCoverage(s.state,999,{x:10,y:31}),null);
 assert(movedServiceCoverage(s.state,fire.id,{x:13,y:31}).cells.length>0);
});
