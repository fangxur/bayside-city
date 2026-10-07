import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
const types=['park','plaza','citySculpture','stoneLions','flowerBed','stoneLantern'];
test('every landscape increases community beauty without utilities and reports its contribution',()=>{
 for(const type of types){
  const s=new CitySimulation();assert(s.build(type,[{x:12,y:12}]).ok);
  const b=s.state.buildings.find(b=>b.type===type),beauty=s.getCommunityBeauty(13,12);
  assert(beauty.value>0);assert.equal(beauty.sources.length,1);assert.equal(beauty.sources[0].id,b.id);
  assert(s.tile(13,12).services.park,`${type} should provide leisure-landscape coverage`);
  assert(Math.abs(beauty.value-beauty.sources[0].value)<1e-8);
  assert(s.getInfo(12,12).metrics.some(m=>m.label==='社区美观加成'));
  s.setBuildingActive(b.id,false);assert.equal(s.getCommunityBeauty(13,12).value,0);assert.equal(s.getCommunityBeauty(13,12).sources.length,0);
 }
});
test('mixed landscapes stack to the beauty cap and residential details explain sources',()=>{
 const s=new CitySimulation();s.state.money=30000;
 types.forEach((type,i)=>{const [x,y]=[[10,11],[12,11],[10,12],[11,11],[10,13],[11,13]][i];assert(s.build(type,[{x,y}]).ok);});
 const home=s._newBuilding(11,12,'residential',true);s.recalculate();
 const beauty=s.getCommunityBeauty(home.x,home.y);assert.equal(beauty.value,28);assert.equal(beauty.sources.length,6);
 const info=s.getInfo(home.x,home.y);assert.match(info.metrics.find(m=>m.label==='美观来源').value,/城市雕塑/);
 assert.equal(CitySimulation.deserialize(s.serialize()).getCommunityBeauty(home.x,home.y).value,28);
});
test('leisure venues add beauty and entertainment only while operational, including upgrades and saves',()=>{
 for(const type of ['operaStage','chessPavilion']){
  const s=new CitySimulation();s.state.money=30000;
  assert(s.build('power',[{x:1,y:31}]).ok);assert(s.build('water',[{x:2,y:31}]).ok);
  assert(s.build(type,[{x:3,y:30}]).ok);
  const b=s.state.buildings.find(b=>b.type===type),x=6,y=30;
  const initial=s.getCommunityBeauty(x,y);assert(initial.value>0);assert.equal(initial.sources[0].id,b.id);assert(initial.sources[0].name);
  assert(Math.abs(initial.value-initial.sources[0].value)<1e-8);assert(s.tile(x,y).communityServices.entertainment>0);
  assert(s.getInfo(b.x,b.y).metrics.some(m=>m.label==='社区美观加成'));
  b.level=2;s.recalculate();assert(s.getCommunityBeauty(x,y).value>initial.value);
  assert.equal(CitySimulation.deserialize(s.serialize()).getCommunityBeauty(x,y).value,s.getCommunityBeauty(x,y).value);
  for(const problem of ['paused','construction','power','water']){
   b.active=problem!=='paused';b.progress=problem==='construction'?.5:1;
   for(const utility of s.state.buildings.filter(v=>['power','water'].includes(v.type)))utility.active=utility.type!==problem;
   for(let roadX=3;roadX<=5;roadX++)s.tile(roadX,32).road=problem==='road'?0:1;
   s.recalculate();assert.equal(s.getCommunityBeauty(x,y).value,0,problem);assert.equal(s.tile(x,y).communityServices.entertainment,undefined,problem);
  }
 }
});
