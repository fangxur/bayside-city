import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';
import { COMMUNITY_BUILDINGS } from '../src/community-buildings.js';
import {CityRenderer} from '../src/renderer.js';
function town(){const s=new CitySimulation();s.state.money=100000;for(let x=7;x<=25;x++)s.tile(x,32).road=1;for(const [type,x] of [['power',8],['water',9]]){s.build(type,[{x,y:31}]);s.state.buildings.at(-1).progress=1;}s.recalculate();return s;}
test('community services stack across types but not duplicates; require completion, utilities and active operation',()=>{
 const s=town();let x=10;
 for(const [type,item] of Object.entries(COMMUNITY_BUILDINGS).filter(([type])=>['school','clinic','library','sportsHall'].includes(type))){
  const money=s.state.money;assert(s.build(type,[{x:x++,y:31}]).ok);assert.equal(s.state.money,money-item.cost);
 }
 s.state.buildings.filter(b=>COMMUNITY_BUILDINGS[b.type]).forEach(b=>b.progress=.5);s.recalculate();assert.equal(s.tile(12,30).communityBonus,0);
 s.state.buildings.forEach(b=>b.progress=1);s.recalculate();assert.equal(s.tile(12,30).communityBonus,14);
 s.build('clinic',[{x:16,y:31}]);s.state.buildings.at(-1).progress=1;s.recalculate();assert.equal(s.tile(12,30).communityBonus,14);
 for(const b of s.state.buildings.filter(b=>b.type==='clinic'))b.active=false;
 s.recalculate();assert.equal(s.tile(12,30).communityBonus,10);
 s.state.buildings.find(b=>b.type==='power').active=false;s.recalculate();assert.equal(s.tile(12,30).communityBonus,0);
});
test('community buildings support inspector, move, pause, demolition, undo and round-trip saves',()=>{
 const s=town();let x=10;
 for(const [type,item] of Object.entries(COMMUNITY_BUILDINGS).filter(([type])=>['school','clinic','library','sportsHall'].includes(type))){
  assert(s.build(type,[{x:x++,y:31}]).ok);const b=s.state.buildings.at(-1);b.progress=1;s.recalculate();
  assert.equal(s.getInfo(b.x,b.y).title,item.name);
  assert(s.moveBuilding(b.id,{x:b.x,y:33}).ok);
 }
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.length,6);
 const b=copy.state.buildings.find(b=>b.type==='library');const before=copy.serialize();
 assert(copy.build('bulldoze',[b]).ok);copy.undo();assert.equal(copy.serialize(),before);
 assert.equal(copy.tile(63,63).communityBonus,0);
});
test('clinics and hospitals keep a red cross at every building tier',()=>{
 const renderer=Object.create(CityRenderer.prototype);renderer._tile=()=>null;
 for(const type of ['clinic','hospital']){
  assert.equal(COMMUNITY_BUILDINGS[type].icon,'medical');
  for(const level of [1,4,6]){
   const parts=[],batch={add(...args){parts.push(args);},box(...args){parts.push(['box',...args]);}};
   renderer._building(batch,{id:1,x:10,y:10,type,footprint:type==='hospital'?2:1,level,progress:1,active:true});
   const cross=parts.filter(([shape,color])=>shape==='box'&&color===0xc9433d);
   assert(cross.length>=2,`${type} level ${level} should show both arms of a red cross`);
  }
 }
});
