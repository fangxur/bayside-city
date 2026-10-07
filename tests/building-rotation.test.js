import test from 'node:test';import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';import {CityRenderer} from '../src/renderer.js';import {buildingCells} from '../src/building-footprint.js';import {privateBuildingGroups} from '../src/city-layout.js';
test('building rotation preserves footprint, money, upgrades and saves, with undo and four-turn reset',()=>{
 const s=new CitySimulation();s.state.money=10000;assert(s.build('courtyard',[{x:3,y:30}]).ok);const b=s.state.buildings[0],cells=buildingCells(b),money=s.state.money;
 assert(s.rotateBuilding(b.id).ok);assert.equal(b.rotation,1);assert.equal(s.state.money,money);assert.deepEqual(buildingCells(b),cells);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings[0].rotation,1);
 assert(s.undo().ok);assert.equal(s.state.buildings[0].rotation,undefined);
 for(let i=0;i<4;i++)assert(s.rotateBuilding(b.id).ok);assert.equal(s.state.buildings[0].rotation,0);
 assert(s.rotateBuilding(b.id,-1).ok);assert.equal(s.state.buildings[0].rotation,3);
 assert(s.moveBuilding(b.id,{x:3,y:33}).ok);assert.equal(s.state.buildings[0].rotation,3);
 const raw=JSON.parse(s.serialize());raw.buildings[0].rotation=4;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
 assert(!s.rotateBuilding(-1).ok);assert(!s.rotateBuilding(b.id,1.5).ok);
});
test('rotation transforms model geometry around its occupied center',()=>{
 const s=new CitySimulation();const r=Object.create(CityRenderer.prototype);r.state=s.state;r._tile=(x,y)=>s.tile(x,y);
 for(const type of ['power','marina','courtyard']){
  const b={id:1,x:3,y:30,type:type==='courtyard'?'residential':type,businessKind:type==='courtyard'?'courtyard':undefined,footprint:type==='power'?1:2,level:1,progress:1,variant:0};
  const capture=rotation=>{const data=[],batch={box:(...a)=>data.push(['box',...a]),add:(...a)=>data.push(a)};r._building(batch,{...b,rotation});return data;};
  const normal=capture(0),rotated=capture(1);assert.equal(normal.length,rotated.length);assert.notDeepEqual(normal,rotated,type);
  for(const part of rotated)assert(part.slice(2).every(Number.isFinite));
 }
});
test('manually rotated factory rows become independent models and garden groups rotate together',()=>{
 const homes=[0,1].map(i=>({id:i+1,x:3+i,y:31,type:'industrial',level:2,progress:1})),tiles=[{x:3,y:32,road:1},{x:4,y:32,road:1}];
 assert.equal(privateBuildingGroups(homes,tiles).size,2);homes[0].rotation=1;assert.equal(privateBuildingGroups(homes,tiles).size,0);
 const s=new CitySimulation();for(const x of [10,11])for(const y of [10,11])assert(s.build('park',[{x,y}]).ok);
 s.rotateBuilding(s.state.buildings[0].id);assert(s.state.buildings.every(b=>b.rotation===1));
});
