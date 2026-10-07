import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {RELIGIOUS_BUILDINGS} from '../src/religious-buildings.js';
import {drawReligiousBuilding} from '../src/religious-architecture.js';
import {communityService} from '../src/community-buildings.js';
import {mayorReputation} from '../src/mayor-reputation.js';
import {getCitizenStory} from '../src/city-life.js';
function town(){const s=new CitySimulation();s.state.money=100000;for(let x=0;x<30;x++)s.tile(x,32).road=1;s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);return s;}
test('religious facilities provide non-stacking spiritual service, keep identity through move and save',()=>{
 for(const [type,item] of Object.entries(RELIGIOUS_BUILDINGS)){
  const s=town(),pos={x:9,y:32-item.footprint};assert(s.build(type,[pos]).ok,type);const b=s.state.buildings.at(-1);
  assert.equal(s.tile(9,31).communityServices.spiritual,item.bonus);assert(s.tile(9,31).services.spiritual);
  assert.equal(mayorReputation(s.state).landmarks.length,0);
  assert(s.moveBuilding(b.id,{x:12,y:pos.y}).ok);const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.at(-1).type,type);
  s.setBuildingActive(b.id,false);assert.equal(s.tile(12,31).communityServices.spiritual,undefined);
  s.setBuildingActive(b.id,true);s.state.buildings.find(v=>v.type==='power').active=false;s.recalculate();assert.equal(s.tile(12,31).communityServices.spiritual,undefined);
 }
 const s=town();s.build('mosque',[{x:9,y:30}]);s.build('buddhistTemple',[{x:12,y:30}]);assert.equal(s.tile(11,31).communityServices.spiritual,3);assert.equal(s.tile(11,31).communityBonus,3);
 const secular=town();secular.build('park',[{x:9,y:31}]);assert.equal(secular.tile(9,31).communityServices.spiritual,2);
});

test('religious facilities cover a broad district and keep expanding when upgraded',()=>{
 assert.equal(RELIGIOUS_BUILDINGS.chapel.radius,9);
 for(const type of ['buddhistTemple','taoistTemple','mosque'])assert.equal(RELIGIOUS_BUILDINGS[type].radius,12);
 assert.equal(communityService({type:'chapel',level:5}).radius,17);
 assert.equal(communityService({type:'buddhistTemple',level:5}).radius,20);
});
test('all religious models render finite, distinct geometry at every tier within their plot',()=>{
 const signatures=[];
 for(const [type,item] of Object.entries(RELIGIOUS_BUILDINGS))for(let level=1;level<=6;level++){
  const parts=[],batch={box:(...p)=>parts.push(['box',...p]),add:(...p)=>parts.push(p)};
  drawReligiousBuilding(batch,{type,x:31,y:31,footprint:item.footprint,level});assert(parts.length>15);
  for(const p of parts){
   assert(p.slice(1).every(Number.isFinite));const [shape,color,x,y,z,w,h,d,ry=0]=p;assert(w>0&&h>0&&d>0);
   // Gable roof dimensions are local: turning the ridge also turns its footprint.
   const spanX=shape==='roof'?Math.abs(w*Math.cos(ry))+Math.abs(d*Math.sin(ry)):w,spanZ=shape==='roof'?Math.abs(d*Math.cos(ry))+Math.abs(w*Math.sin(ry)):d;
   assert(x-spanX/2>=-1.001&&x+spanX/2<=item.footprint-1+.001);assert(z-spanZ/2>=-1.001&&z+spanZ/2<=item.footprint-1+.001);
  }
  if(level===1)signatures.push(JSON.stringify(parts));
 }
 assert.equal(new Set(signatures).size,Object.keys(RELIGIOUS_BUILDINGS).length);
});
test('religious activities link actual neighbors and operating venues, with relevant festivals',()=>{
 for(const [type,month] of [['gothicCathedral',12],['domedCathedral',12],['chapel',12],['taoistTemple',2],['buddhistTemple',5],['mosque',4]]){
  const s=new CitySimulation({demo:true});const home=s.state.buildings.find(b=>b.type==='residential'&&b.population>0);
  for(const b of s.state.buildings)if(!['residential','power','water','industrial'].includes(b.type))b.active=false;
  const host={id:9999,type,x:home.x+1,y:home.y,active:true,progress:1,connected:true,powered:true,watered:true};s.state.buildings.push(host);s.state.month=month;
  const stories=Array.from({length:30},(_,i)=>getCitizenStory(s.state,{id:'religion-'+i,kind:'pedestrian',x:home.x,y:home.y}));
  assert(stories.some(v=>v.social?.category==='节日活动'));assert(stories.every(v=>v.social?.venue.id===host.id));
  host.active=false;assert.equal(getCitizenStory(s.state,{id:'religion-0',kind:'pedestrian',x:home.x,y:home.y}).social,null);
 }
});
