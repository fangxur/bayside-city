import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMUNITY_BUILDINGS,isCommunityBusiness} from '../src/community-buildings.js';
import {matchesBuildingFilter} from '../src/building-filter.js';
import {cityCatalog} from '../src/city-catalog.js';
import {CitySimulation} from '../src/simulation.js';

const TYPES=['chessPavilion','operaStage','marina'];

test('traditional leisure venues and the marina belong to commercial while retaining their landscape service',()=>{
  const catalog=cityCatalog(new CitySimulation().state);
  for(const type of TYPES){
    const definition=COMMUNITY_BUILDINGS[type],entry=catalog.buildings.find(item=>item.id===`community:${type}`);
    assert.equal(isCommunityBusiness(type),true,type);
    assert.equal(entry.category,'commercial',type);
    assert(definition.jobs>0,type);
    assert(definition.beauty>0,type);
    assert.equal(definition.service,'entertainment',type);
    assert(matchesBuildingFilter({type},'commercial'),type);
  }
});

test('each leisure business creates staffed jobs, enterprise wages and commercial tax',()=>{
  for(const type of TYPES){
    const simulation=new CitySimulation();
    for(let x=0;x<=20;x++)simulation.tile(x,32).road=1;
    simulation._newBuilding(1,31,'power',true);
    simulation._newBuilding(2,31,'water',true);
    const home=simulation._newBuilding(5,31,'residential',true);home.level=4;home.population=80;
    const business=simulation._newBuilding(10,28,type,true);
    simulation.recalculate();

    assert.equal(business.jobs,COMMUNITY_BUILDINGS[type].jobs,type);
    assert(business.workers>0,type);
    assert(business.monthlyPayroll>0,type);
    assert(business.taxContribution>0,type);
    assert.equal(business.publicPayroll,0,type);
    assert(simulation.state.stats.breakdown.commercialIncome>0,type);
    const commercial=simulation.state.stats.workforceReport.sections.find(section=>section.id==='commercial');
    assert(commercial.rows.some(row=>row.key===type&&row.workers===business.workers&&row.tax>0),type);
  }
});
