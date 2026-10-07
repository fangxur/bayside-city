import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingStyle} from '../src/building-styles.js';
import {privateBuildingGroups} from '../src/city-layout.js';
test('Chinese residential zoning retains identity and Chinese styling through upgrades and saves without joining neighboring homes',()=>{
 for(const kind of ['courtyard','lingnan']){
  const s=new CitySimulation();s.state.milestones.density=true;
  for(let x=10;x<13;x++){
   s.tile(x,32).road=1;
   // Existing single-cell Chinese homes keep their own footprint and architecture.
   s.tile(x,31).zone='residential';s.tile(x,31).businessKind=kind;
   const b=s._newBuilding(x,31,'residential',true);assert.equal(b.businessKind,kind);
   assert(s.build('upgrade',[{x,y:31}]).ok);b.progress=1;assert(buildingStyle(b).chinese);
  }
  const copy=CitySimulation.deserialize(s.serialize());
  assert.equal(privateBuildingGroups(copy.state.buildings,copy.state.tiles).size,0);
  assert.equal(copy.getInfo(10,31).title,kind==='courtyard'?'四合院住宅':'岭南民居');
 }
});
test('Chinese leisure facilities supply non-stacking entertainment coverage and support pause, move and save',()=>{
 const s=new CitySimulation();s.state.money=30000;
 s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
 assert.equal(s.preview('operaStage',[{x:3,y:30}]).cells.length,4);
 assert(s.build('operaStage',[{x:3,y:30}]).ok);
 assert(s.build('chessPavilion',[{x:6,y:30}]).ok);
 const stage=s.state.buildings.find(b=>b.type==='operaStage'),pavilion=s.state.buildings.find(b=>b.type==='chessPavilion');
 assert(stage.coverageCells.length>0);assert(pavilion.coverageCells.length>0);
 assert.equal(s.tile(5,30).communityServices.entertainment,4);
 assert(s.tile(5,30).services.entertainment);
 s.setBuildingActive(stage.id,false);assert.equal(s.tile(5,30).communityServices.entertainment,2);
 s.setBuildingActive(pavilion.id,false);assert.equal(s.tile(5,30).services.entertainment,undefined);
 assert(s.moveBuilding(stage.id,{x:3,y:33}).ok);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.find(b=>b.id===stage.id).footprint,2);
 assert(copy.build('bulldoze',[{x:4,y:34}]).ok);assert.equal(copy.tile(3,33).buildingId,null);
});
