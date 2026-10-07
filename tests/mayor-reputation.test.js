import test from 'node:test';
import assert from 'node:assert/strict';
import {mayorReputation,reputationMarkup} from '../src/mayor-reputation.js';
import {LANDMARKS} from '../src/landmarks.js';
import {CitySimulation} from '../src/simulation.js';
const milestones={density:true,completed:true,metropolis:true,capital:true,regional:true,mature:true,civic:true,global:true};
const city=(stats={},buildings=[])=>({stats:{population:50000,happiness:100,employmentRate:100,income:1000,expenses:0,...stats},buildings});
test('governance reputation remains weighted separately from honor progression',()=>{
 assert.equal(mayorReputation(city()).score,100);
 assert.equal(mayorReputation(city({happiness:0})).score,50);
 assert.equal(mayorReputation(city({population:12500})).score,87.5);
 assert.equal(mayorReputation(city({employmentRate:0})).score,85);
 assert.equal(mayorReputation(city({expenses:1000})).score,95);
 assert.equal(mayorReputation(city({population:0})).score,0);
 assert.equal(mayorReputation(city({population:200000,happiness:200})).score,100);
});
test('population above fifty thousand keeps earning honor and city upgrades contribute stage points',()=>{
 const values=[50000,80000,120000,130000,200000].map(population=>mayorReputation(city({population})));
 for(let i=1;i<values.length;i++)assert(values[i].honorPoints>values[i-1].honorPoints);
 assert(values[2].level>values[0].level);
 const developed=mayorReputation({...city({population:120000}),milestones});
 assert.equal(developed.developmentBonus,180);assert(developed.level>=10);
 assert(developed.honorPoints>values[2].honorPoints);
});
test('building every landmark in a large city raises honor by at most one level',()=>{
 for(const population of [120000,130000])for(const happiness of [50,75,90,100]){
  const state={...city({population,happiness,employmentRate:90,expenses:800}),milestones};
  const before=mayorReputation(state);
  state.buildings=Object.keys(LANDMARKS).map(type=>({type,level:1,progress:1}));
  const after=mayorReputation(state);
  assert.equal(after.landmarkBonus,20);assert.equal(Math.round((after.honorPoints-before.honorPoints)*10)/10,20);
  assert(after.level-before.level<=1);assert(after.level<16);
 }
});
test('unique landmarks award two points per completed tier without losing old honor during renovation',()=>{
 const state=city({},[{type:'lighthouse',level:1,progress:1,active:false},{type:'lighthouse',level:1,progress:1},{type:'museum',level:1,progress:.5},{type:'park',progress:1}]);
 let r=mayorReputation(state);assert.equal(r.landmarkBonus,2);assert.equal(r.landmarks.length,1);
 const lighthouse=state.buildings[0];lighthouse.level=2;lighthouse.progress=.6;
 assert.equal(mayorReputation(state).landmarkBonus,2);
 lighthouse.progress=1;assert.equal(mayorReputation(state).landmarkBonus,4);
 lighthouse.level=3;lighthouse.progress=.8;assert.equal(mayorReputation(state).landmarkBonus,4);
 lighthouse.progress=1;assert.equal(mayorReputation(state).landmarkBonus,6);
 lighthouse.x=30;assert.equal(mayorReputation(state).landmarkBonus,6);
 state.buildings.splice(0,2);assert.equal(mayorReputation(state).landmarkBonus,0);
});
test('mayor profile explains next-level progress, stage points and landmark renovation',()=>{
 const state={...city({population:120000,happiness:80},[{type:'lighthouse',level:1,progress:1},{type:'museum',level:3,progress:1}]),milestones};
 const markup=reputationMarkup(state),r=mayorReputation(state);
 assert.match(markup,/荣誉积分/);assert(markup.includes(String(r.nextPoints)));
 assert.match(markup,/人口发展荣誉/);assert.match(markup,/城市晋级荣誉/);
 assert.match(markup,/望海灯塔 · 1 级（2 分）/);assert.match(markup,/河湾艺术馆 · 3 级（6 分）/);
 assert.doesNotMatch(markup,/额外提升一级|每座.*额外荣誉/);
});
test('existing saves reconstruct mayor reputation without additional stored fields',()=>{
 const s=new CitySimulation({demo:true});const before=mayorReputation(s.state),serialized=s.serialize();
 assert.deepEqual(mayorReputation(CitySimulation.deserialize(serialized).state),before);
 assert.equal(s.serialize(),serialized);
});
