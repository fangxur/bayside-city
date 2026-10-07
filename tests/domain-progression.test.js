import test from 'node:test';
import assert from 'node:assert/strict';
import {domainStageReadiness,latchDomainMilestones,upgradeOffer} from '../src/progression.js';

const serviceTypes={fireStation:'fireStation',clinic:'clinic',school:'school',library:'library',sportsHall:'sportsHall',cityHall:'cityHall',spiritual:'chapel'};
function coordinatedState({tier=2,roadTier=tier,population=5000,roads=30,traffic=90,pollution=0,amenity=20}={}){
  const ready={level:tier,progress:1,active:true,connected:true,powered:true,watered:true};
  const services={fireStation:true,clinic:true,school:true,library:true,sportsHall:true,cityHall:true,spiritual:true},serviceLevels=Object.fromEntries(Object.keys(services).map(key=>[key,tier]));
  const buildings=[
    {id:1,type:'residential',population,...ready,fireCovered:true,fireServiceLevel:tier,services,serviceLevels,environment:{pollution,amenity}},
    {id:2,type:'commercial',workers:20,...ready},
    {id:3,type:'industrial',workers:20,...ready},
    {id:4,type:'power',...ready},
    {id:5,type:'water',...ready},
    {id:6,type:'park',...ready},
    ...Object.values(serviceTypes).map((type,index)=>({id:10+index,type,...ready})),
  ];
  const tiles=Array.from({length:roads},(_,x)=>({x,y:0,road:roadTier,connected:true}));
  return {buildings,tiles,stats:{population,powerCapacity:1000,powerUsed:700,waterCapacity:1000,waterUsed:700,traffic}};
}

test('each higher upgrade stage requires the previous tier to work across every city domain',()=>{
  for(const [milestone,tier,roadTier,population] of [['metropolis',2,2,5000],['capital',3,3,10000],['regional',4,4,20000],['mature',4,5,30000],['civic',5,5,40000],['global',5,6,50000]]){
    const state=coordinatedState({tier,roadTier,population});
    const ready=domainStageReadiness(state,milestone);
    assert(ready.met,milestone);assert.equal(ready.requirements.length,7);
    assert(ready.requirements.every(item=>item.met));

    state.buildings.find(b=>b.type==='water').level=tier-1;
    let blocked=domainStageReadiness(state,milestone);
    assert(!blocked.met);assert.match(blocked.requirements.find(item=>item.label.includes('水电')).detail,/供水 未达级/);
    state.buildings.find(b=>b.type==='water').level=tier;

    state.buildings.find(b=>b.type==='residential').serviceLevels.clinic=tier-1;
    blocked=domainStageReadiness(state,milestone);
    assert(!blocked.met);assert.match(blocked.requirements.find(item=>item.label.includes('公共服务')).detail,/医疗 0%/);
    state.buildings.find(b=>b.type==='residential').serviceLevels.clinic=tier;

    state.buildings.find(b=>b.type==='industrial').workers=0;
    blocked=domainStageReadiness(state,milestone);
    assert(!blocked.met);assert.match(blocked.requirements.find(item=>item.label.includes('住商工')).detail,/工业 ○/);
    state.buildings.find(b=>b.type==='industrial').workers=20;

    state.buildings.find(b=>b.type==='park').level=tier-1;
    blocked=domainStageReadiness(state,milestone);
    assert(!blocked.met);assert.match(blocked.requirements.find(item=>item.label.includes('休闲景观')).detail,new RegExp(`${tier} 级景观 ○`));
  }
});

test('population alone cannot unlock building stages without roads, services, reserve capacity and a healthy city',()=>{
  const state=coordinatedState({tier:2,population:9000,roads:2,traffic:30,pollution:45});
  state.stats.powerUsed=state.stats.waterUsed=950;
  const clinic=state.buildings.find(b=>b.type==='clinic');clinic.level=1;
  const result=domainStageReadiness(state,'metropolis');
  assert(!result.met);assert(result.progress<1);
  assert(result.requirements.find(item=>item.label.includes('人口')).met);
  assert(!result.requirements.find(item=>item.label.includes('道路')).met);
  assert(!result.requirements.find(item=>item.label.includes('水电')).met);
  assert(!result.requirements.find(item=>item.label.includes('公共服务')).met);
  assert(!result.requirements.find(item=>item.label.includes('环境')).met);
});

test('the 40,000 stage requires an operating tier-five religious facility and spiritual coverage',()=>{
  const state=coordinatedState({tier:5,roadTier:5,population:40000});
  let result=domainStageReadiness(state,'civic');
  const publicServices=()=>result.requirements.find(item=>item.label.includes('公共服务'));
  assert(result.met);assert.match(publicServices().detail,/宗教与信仰 100%/);

  const chapel=state.buildings.find(b=>b.type==='chapel');
  chapel.level=4;
  result=domainStageReadiness(state,'civic');
  assert(!result.met);assert.match(publicServices().detail,/宗教与信仰 缺少同级设施/);

  chapel.level=5;
  state.buildings.find(b=>b.type==='residential').serviceLevels.spiritual=4;
  result=domainStageReadiness(state,'civic');
  assert(!result.met);assert.match(publicServices().detail,/宗教与信仰 0%/);
});

test('religious facilities do not gate city stages before 40,000 residents',()=>{
  const state=coordinatedState({tier:4,roadTier:5,population:30000});
  state.buildings.splice(state.buildings.findIndex(b=>b.type==='chapel'),1);
  const result=domainStageReadiness(state,'mature');
  assert(result.met);assert.doesNotMatch(result.requirements.find(item=>item.label.includes('公共服务')).detail,/宗教与信仰/);
});

test('an upgraded operating pharmacy can serve as the medical provider for domain coordination',()=>{
 const state=coordinatedState({tier:2,population:5000});
 Object.assign(state.buildings.find(b=>b.type==='clinic'),{type:'commercial',businessKind:'pharmacy',workers:6});
 const result=domainStageReadiness(state,'metropolis');
 assert(result.met);assert.match(result.requirements.find(item=>item.label.includes('公共服务')).detail,/医疗 100%/);
 state.buildings.find(b=>b.businessKind==='pharmacy').workers=0;
 assert(!domainStageReadiness(state,'metropolis').met);
});

test('locked building upgrades explain every citywide coordination requirement and its live progress',()=>{
  const state=coordinatedState({tier:4,roadTier:5,population:30000});
  state.milestones={capital:true,mature:false};
  state.buildings.find(b=>b.type==='water').level=3;
  const offer=upgradeOffer({type:'clinic',level:4,progress:1},state);
  assert(!offer.allowed);assert.equal(offer.stage.title,'30,000 人领域协同');
  assert.equal(offer.stage.total,7);assert.equal(offer.stage.completed,6);
  assert.match(offer.reason,/还缺 1 项：4 级水电稳定运行/);
  const utilities=offer.stage.requirements.find(item=>item.label.includes('水电'));
  assert.equal(utilities.met,false);assert.match(utilities.detail,/供水 未达级/);
});

test('landscape progression requires both an upgraded facility and beauty that reaches residents',()=>{
  const state=coordinatedState({tier:2,population:5000,amenity:0});
  let result=domainStageReadiness(state,'metropolis');
  const landscape=()=>result.requirements.find(item=>item.label.includes('休闲景观'));
  assert(!result.met);assert.equal(landscape().met,false);
  assert.match(landscape().detail,/2 级景观 ✓/);assert.match(landscape().detail,/居民 0% \/ 50%/);

  state.buildings.find(b=>b.type==='residential').environment.amenity=8;
  result=domainStageReadiness(state,'metropolis');
  assert.equal(landscape().met,true);
  assert.match(landscape().detail,/人均美观 8.0 \/ 6/);
});

test('small landscape decorations can replace a park provider when their combined beauty reaches residents',()=>{
  const state=coordinatedState({tier:2,population:5000,amenity:8});
  Object.assign(state.buildings.find(b=>b.type==='park'),{type:'citySculpture',level:1});
  const result=domainStageReadiness(state,'metropolis');
  assert(result.met);assert.match(result.requirements.find(item=>item.label.includes('休闲景观')).detail,/2 级景观 ✓/);
});

test('coordinated stages latch in order and remain earned after conditions later fall',()=>{
  const state=coordinatedState({tier:5,roadTier:6,population:50000});
  state.milestones={completed:true,metropolis:false,capital:false,regional:false,mature:false,civic:false,global:false};
  latchDomainMilestones(state);
  assert.deepEqual(state.milestones,{completed:true,metropolis:true,capital:true,regional:true,mature:true,civic:true,global:true});
  state.stats.population=0;state.stats.traffic=0;state.buildings.length=0;state.tiles.length=0;
  latchDomainMilestones(state);
  assert.equal(state.milestones.global,true);
});
