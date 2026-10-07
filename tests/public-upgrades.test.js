import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {COMMUNITY_BUILDINGS,communityService} from '../src/community-buildings.js';
import {upgradeOffer,maintenanceMultiplier} from '../src/progression.js';
import {buildingCells} from '../src/building-footprint.js';
test('all public community facilities upgrade through four levels with real service, cost, maintenance and save changes',()=>{
 for(const [type,base] of Object.entries(COMMUNITY_BUILDINGS).filter(([type,base])=>!base.fixedFacility&&type!=='marina')){
  const s=new CitySimulation();s.state.money=1000000;s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);for(const utility of s.state.buildings)utility.level=6;s.recalculate();if(type==='districtOffice')assert(s.build('cityHall',[{x:6,y:30}]).ok);s.state.stats.population=50000;
  assert(s.build(type,[{x:3,y:32-(base.footprint||1)}]).ok);
  let b=s.state.buildings.find(b=>b.type===type);const cells=buildingCells(b);
  Object.assign(s.state.milestones,{density:true,completed:true,metropolis:true,capital:true});
  for(let level=2;level<=4;level++){
   const before=s.serialize(),money=s.state.money,offer=upgradeOffer(b,s.state.milestones),count=b.coverageCells.length;
   assert(offer.allowed);assert(s.build('upgrade',[cells.at(-1)]).ok);assert.equal(s.state.money,money-offer.cost);
   assert.equal(b.level,level);assert(!s.preview('upgrade',[b]).valid);assert.equal(b.coverageCells.length,0);
   s.undo();assert.equal(s.serialize(),before);assert(s.build('upgrade',[cells[0]]).ok);
   const current=s.state.buildings.find(v=>v.id===b.id);current.progress=1;s.recalculate();
   assert(current.coverageCells.length>count);assert.equal(communityService(current).radius,base.radius+2*(level-1));assert.equal(communityService(current).bonus,base.bonus+level-1);
   assert.deepEqual(buildingCells(current),cells);assert(maintenanceMultiplier(current)>1);
   assert.equal(CitySimulation.deserialize(s.serialize()).state.buildings.find(v=>v.id===b.id).level,level);
   // Undo replaces state, so retain the current building for the next iteration.
   b=current;
  }
  assert(!upgradeOffer(b,s.state.milestones).allowed);
 }
});
