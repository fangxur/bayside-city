import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {DECORATIONS} from '../src/decorations.js';
import {COMMUNITY_BUILDINGS} from '../src/community-buildings.js';

test('every landscape can be placed and moved away from roads',()=>{
 const types=['park','plaza',...Object.keys(DECORATIONS),...Object.keys(COMMUNITY_BUILDINGS).filter(t=>COMMUNITY_BUILDINGS[t].category==='entertainment')];
 for(const type of types){
  const s=new CitySimulation();s.state.money=100000;
  const origin=type==='marina'?{x:35,y:30}:{x:12,y:12};
  assert(s.build(type,[origin]).ok,type);
  const b=s.state.buildings.find(b=>b.type===type);assert.equal(b.connected,false,type);
  assert(s.moveBuilding(b.id,type==='marina'?{x:35,y:31}:{x:16,y:16}).ok,type);
 }
 const s=new CitySimulation();
 for(const type of ['school','cityHall','residential'])assert.equal(s.preview(type,[{x:12,y:12}]).valid,false,type);
});

test('off-road leisure venues supply beauty and coverage, finish construction and retain utility requirements',()=>{
 for(const type of ['operaStage','chessPavilion','marina']){
  const s=new CitySimulation();s.state.money=100000;
  assert(s.build('power',[{x:1,y:31}]).ok);assert(s.build('water',[{x:2,y:31}]).ok);
  const cell=type==='marina'?{x:35,y:30}:{x:12,y:12};assert(s.build(type,[cell]).ok);
  const b=s.state.buildings.find(b=>b.type===type);assert.equal(b.connected,false);
  assert(b.powered&&b.watered);assert(b.coverageCells.length>0);assert(s.getCommunityBeauty(b.x,b.y).value>0);
  assert(s.tile(b.x,b.y).services.entertainment);assert(s.tile(b.x,b.y).communityServices.entertainment>0);
  assert.equal(s.getInfo(b.x,b.y).metrics.find(m=>m.label==='道路连接').value,'无需连接');
  b.progress=.6;s.recalculate();s.tick();s.tick();assert.equal(b.progress,1);
  const copy=CitySimulation.deserialize(s.serialize());assert(copy.state.buildings.find(v=>v.id===b.id).coverageCells.length>0);
  s.setBuildingActive(s.state.buildings.find(v=>v.type==='power').id,false);
  assert.equal(b.coverageCells.length,0);assert.equal(s.getCommunityBeauty(b.x,b.y).value,0);
 }
});
