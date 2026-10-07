import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {BUILDING_TIERS,upgradeOffer,buildingCapacity,residentialArrivalCohort} from '../src/progression.js';
import {COMMUNITY_BUILDINGS,communityService,isCommunityBusiness} from '../src/community-buildings.js';
test('fifth and sixth levels have explicit prices, service conditions and larger capacities',()=>{
 for(const [type,tier] of Object.entries(BUILDING_TIERS).filter(([type])=>!COMMUNITY_BUILDINGS[type]?.fixedFacility&&type!=='marina')){
  assert.equal(tier.names.length,6);assert.equal(tier.costs.length,5);assert(tier.costs.every(Number.isFinite));
  const b={type,level:4,progress:1,fireCovered:true,services:{clinic:true,park:true},environment:{amenity:28,pollution:0}};
  assert(!upgradeOffer(b,{capital:true}).allowed);assert.match(upgradeOffer(b,{capital:true}).reason,/¥/);
  const growthTier=['residential','power','water'].includes(type),stage5=growthTier?{regional:true}:{mature:true};
  if(type==='residential'){assert(!upgradeOffer(b,stage5).allowed);Object.assign(b.services,{school:true,library:true});}
  assert(upgradeOffer(b,stage5).allowed);b.level=5;
  const civicTier=type==='residential'||['fireStation','cityHall','park','plaza'].includes(type)||(COMMUNITY_BUILDINGS[type]&&!isCommunityBusiness(type)),stage6=civicTier?{civic:true}:{global:true};
  if(type==='residential'){assert(!upgradeOffer(b,stage6).allowed);Object.assign(b.services,{sportsHall:true,cityHall:true});}
  assert(upgradeOffer(b,stage6).allowed);b.level=6;assert(!upgradeOffer(b,stage6).allowed);
  if(tier.capacities)assert(buildingCapacity(b)>buildingCapacity({...b,level:4}));
 }
 assert.equal(communityService({type:'hospital',level:6}).radius,26);
});
test('late residential upgrades keep pace with regional employment growth',()=>{
 const housing=BUILDING_TIERS.residential.capacities,commercial=BUILDING_TIERS.commercial.capacities,industrial=BUILDING_TIERS.industrial.capacities;
 assert.deepEqual(housing,[10,32,72,128,400,800]);
 for(const index of [4,5]){
  const housingGain=housing[index]-housing[index-1];
  assert(housingGain>=commercial[index]-commercial[index-1]);
  assert(housingGain>=industrial[index]-industrial[index-1]);
 }
 assert.equal(residentialArrivalCohort({level:4,moveInWillingness:80}),2);
 assert.equal(residentialArrivalCohort({level:5,moveInWillingness:80}),4);
 assert.equal(residentialArrivalCohort({level:6,moveInWillingness:80}),6);
});
test('earned late milestones persist, and old saves default new flags',()=>{
 const s=new CitySimulation();Object.assign(s.state.milestones,{named:true,bridge:true,density:true,completed:true,metropolis:true,capital:true,regional:true,mature:true,civic:true,global:true});
 for(let y=0;y<6;y++)for(let x=0;x<30;x++){const b=s._newBuilding(x,y,'residential',true);b.level=6;b.population=0;}
 let remaining=50000;for(const b of s.state.buildings){b.population=Math.min(remaining,buildingCapacity(b));remaining-=b.population;}
 s.recalculate();assert.equal(s.state.stats.population,50000);assert(s.state.milestones.regional);assert(s.state.milestones.global);
 const copy=CitySimulation.deserialize(s.serialize());assert(copy.state.milestones.global);assert.equal(copy.state.buildings[0].level,6);
 const old=new CitySimulation(),raw=JSON.parse(old.serialize());delete raw.milestones.regional;delete raw.milestones.mature;delete raw.milestones.civic;delete raw.milestones.global;const loaded=CitySimulation.deserialize(JSON.stringify(raw));assert.equal(loaded.state.milestones.regional,false);assert.equal(loaded.state.milestones.mature,false);assert.equal(loaded.state.milestones.civic,false);
});
test('sixth-level public upgrade preserves footprint and round-trips real service levels',()=>{
 const s=new CitySimulation();s.state.money=300000;Object.assign(s.state.milestones,{density:true,regional:true,mature:true,civic:true,global:true});
 s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);s.state.stats.population=20000;s.build('hospital',[{x:3,y:30}]);
 let b=s.state.buildings.find(b=>b.type==='hospital');b.level=4;b.progress=1;
 for(const level of [5,6]){const offer=upgradeOffer(b,s.state.milestones),money=s.state.money;assert(s.build('upgrade',[{x:4,y:31}]).ok);assert.equal(s.state.money,money-offer.cost);b.progress=1;s.recalculate();assert.equal(b.level,level);}
 assert.equal(CitySimulation.deserialize(s.serialize()).state.buildings.find(b=>b.id===s.tile(4,31).buildingId).level,6);
});
