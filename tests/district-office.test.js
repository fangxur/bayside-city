import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {cityHallRequirement} from '../src/city-services.js';
import {upgradeOffer} from '../src/progression.js';
import {buildingCells,footprintSize,newBuildingFootprint} from '../src/building-footprint.js';
function town(){
 const s=new CitySimulation();s.state.money=100000;
 for(let x=7;x<=32;x++)s.tile(x,32).road=1;
 for(const [type,x] of [['power',8],['water',9]])assert(s.build(type,[{x,y:31}]).ok);
 s.recalculate();return s;
}
test('district offices unlock at 5000, use one cell, charge once and can be built repeatedly',()=>{
 const s=town();assert(!s.preview('districtOffice',[{x:16,y:31}]).valid);
 s.state.stats.population=5000;const cash=s.state.money;
 assert.equal(newBuildingFootprint('districtOffice'),1);assert(s.build('districtOffice',[{x:16,y:31}]).ok);assert.equal(s.state.money,cash-2600);
 const b=s.state.buildings.at(-1);assert.equal(footprintSize(b),1);assert.equal(s.tile(16,31).buildingId,b.id);assert.equal(s.tile(17,31).buildingId,null);
 assert.equal(b.coverageCells.length,0);assert.equal(b.problem,'等待市政府统筹');
 s.state.stats.population=5000;assert(s.build('districtOffice',[{x:24,y:31}]).ok);
 assert.equal(cityHallRequirement(s.state.buildings).met,false);
 assert.equal(s.setCivicPolicy('development').ok,false,'a district office cannot set city policy without city hall');
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.filter(b=>b.type==='districtOffice').length,2);
 assert(copy.moveBuilding(b.id,{x:20,y:31}).ok);
 const before=copy.serialize();assert(copy.build('bulldoze',[{x:20,y:31}]).ok);copy.undo();assert.equal(copy.serialize(),before);
});
test('legacy two-by-two district offices compact safely into a roadside one-cell office',()=>{
 const s=town(),office=s._newBuilding(16,30,'districtOffice',true,2);s.recalculate();const copy=CitySimulation.deserialize(s.serialize()),saved=copy.state.buildings.find(b=>b.id===office.id);
 assert.equal(footprintSize(saved),1);assert.equal(saved.x,16);assert.equal(saved.y,31);assert.equal(buildingCells(saved).length,1);
 assert.equal(copy.state.tiles.filter(tile=>tile.buildingId===saved.id).length,1);assert(saved.connected);assert.equal(footprintSize(CitySimulation.deserialize(copy.serialize()).state.buildings.find(b=>b.id===office.id)),1);
});
test('district coverage satisfies sixth-level homes, extends on upgrade, and stops without operation',()=>{
 const s=town();assert(s.build('cityHall',[{x:10,y:30}]).ok);s.state.stats.population=5000;assert(s.build('districtOffice',[{x:16,y:31}]).ok);
 const b=s.state.buildings.at(-1);assert(s.tile(22,31).services.cityHall);assert(!s.tile(23,31).services.cityHall);
 const home={type:'residential',level:5,progress:1,fireCovered:true,services:{...s.tile(22,31).services,clinic:true,park:true,school:true,library:true,sportsHall:true},environment:{amenity:20,pollution:0}};
 assert(upgradeOffer(home,{civic:true}).allowed);
 s.state.milestones.density=true;s.state.milestones.completed=true;assert(s.build('upgrade',[b]).ok);b.progress=1;s.recalculate();assert(s.tile(24,31).services.cityHall);
 assert(s.getInfo(16,31).metrics.some(m=>m.label==='服务半径'&&m.value==='8 格'));
 assert(s.setBuildingActive(b.id,false).ok);assert(!s.tile(22,31).services.cityHall);assert.equal(b.coverageCells.length,0);
 s.setBuildingActive(b.id,true);assert(s.tile(22,31).services.cityHall);
 const hall=s.state.buildings.find(b=>b.type==='cityHall');s.setBuildingActive(hall.id,false);assert.equal(b.coverageCells.length,0);assert.equal(b.problem,'等待市政府统筹');
 s.setBuildingActive(hall.id,true);assert(s.tile(22,31).services.cityHall);
 s.setBuildingActive(s.state.buildings.find(b=>b.type==='water').id,false);assert(!s.tile(23,31).services.cityHall);
});
