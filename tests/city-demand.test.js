import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDemand,zoningReadiness} from '../src/city-demand.js';
import {CitySimulation} from '../src/simulation.js';
test('demand stays scale-stable above ten thousand and every displayed source sums to the actual score',()=>{
 const base={population:2000,jobs:1200,workforce:1100,housingCapacity:2150,commercialJobs:400,taxRate:9};
 const first=calculateDemand(base);
 for(const multiplier of [5,10,50]){
  const large={...base};for(const key of ['population','jobs','workforce','housingCapacity','commercialJobs'])large[key]*=multiplier;
  const result=calculateDemand(large);assert.deepEqual(result.demand,first.demand);
  for(const type of Object.keys(result.demand)){
   const d=result.details[type];assert.equal(d.factors.reduce((sum,f)=>sum+f.value,0),d.raw);
   assert.equal(result.demand[type],Math.round(Math.max(0,Math.min(100,d.raw))));
  }
 }
});
test('zero demand still explains oversupply and tax pressure; construction blockers are separate',()=>{
 const result=calculateDemand({population:12000,jobs:15000,workforce:6600,housingCapacity:40000,commercialJobs:10000,taxRate:15});
 assert.equal(result.demand.residential,0);assert.equal(result.demand.commercial,0);assert.equal(result.demand.industrial,0);
 for(const d of Object.values(result.details)){assert(d.summary);assert(d.factors.some(f=>f.value<0));}
 const cell={zone:'residential',buildingId:null,connected:true,powered:true,watered:true};
 assert.deepEqual(zoningReadiness([cell,{...cell,connected:false},{...cell,powered:false},{...cell,watered:false},{...cell,buildingId:1}],'residential'),{total:4,ready:1,road:1,power:1,water:1});
});
test('city objectives continue indefinitely after the 10000 milestone',()=>{
 const s=new CitySimulation();Object.assign(s.state.milestones,{named:true,bridge:true,density:true,completed:true,metropolis:true,capital:true});
 Object.assign(s.state.stats,{powerCapacity:100,waterCapacity:100});
 for(const [population,target]of [[10000,20000],[15000,20000],[50000,60000],[59999,60000],[60000,65000],[100000,105000]]){
  s.state.stats.population=population;s.state.milestones.regional=population>=20000;s.state.milestones.mature=population>=30000;s.state.milestones.civic=population>=40000;s.state.milestones.global=population>=50000;const objective=s.getObjective();assert.equal(objective.target,target);assert(objective.progress<1);
 }
});
