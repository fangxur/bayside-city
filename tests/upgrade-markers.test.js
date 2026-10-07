import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {CityRenderer} from '../src/renderer.js';

test('upgrade markers show their price and upgrade directly without opening building details',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(){return {listeners:{},addEventListener(k,f){this.listeners[k]=f;},setAttribute(k,v){this[k]=v;},remove(){this.removed=true;}};}};
 try{
  const sim=new CitySimulation({demo:true});sim.state.money=100000;
  Object.assign(sim.state.milestones,{density:true,completed:true});sim.recalculate();
  const r=Object.create(CityRenderer.prototype);let upgraded=null,inspected=false;
  Object.assign(r,{state:sim.state,container:{appendChild(){}},callbacks:{
   getUpgradePreview:b=>sim.preview('upgrade',[b]),onUpgrade:b=>{upgraded=b.id;sim.build('upgrade',[{x:b.x,y:b.y}]);},onUpgradeInspect:()=>inspected=true,
  },buildingPickMesh:{getMatrixAt(i,m){m.copy(new THREE.Matrix4().makeTranslation(i,1,0));}}});
  r._syncUpgradeMarkers();assert(r.upgradeMarkers.size>0);
  for(const marker of r.upgradeMarkers.values())assert(sim.preview('upgrade',[marker.building]).valid);
  const marker=r.upgradeMarkers.values().next().value,before=sim.serialize(),level=marker.building.level,cost=sim.preview('upgrade',[marker.building]).cost;
  assert(marker.button.innerHTML.includes('¥'+cost.toLocaleString('zh-CN')));assert.match(marker.button.title,/点击直接升级/);
  marker.button.listeners.click({stopPropagation(){}});
  assert.equal(upgraded,marker.building.id);assert.equal(inspected,false);assert.notEqual(sim.serialize(),before);assert.equal(marker.building.level,level+1);
  marker.building.progress=1;sim.recalculate();
  sim.state.money=0;r._syncUpgradeMarkers();assert.equal(r.upgradeMarkers.size,0);assert(marker.button.removed);
  sim.state.money=100000;r._syncUpgradeMarkers();assert(r.upgradeMarkers.size>0);
  sim.state.milestones.density=false;r._syncUpgradeMarkers();assert.equal(r.upgradeMarkers.size,0);
 }finally{globalThis.document=previous;}
});

test('category filtering keeps upgrade markers on visible buildings with correct pick indices',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(){return {addEventListener(){},setAttribute(){},remove(){}};}};
 try{
  const sim=new CitySimulation({demo:true});sim.state.money=100000;Object.assign(sim.state.milestones,{density:true,completed:true});sim.recalculate();
  const r=Object.create(CityRenderer.prototype),indices=[];
  Object.assign(r,{state:sim.state,tool:'upgrade',buildingFilter:'commercial',container:{appendChild(){}},callbacks:{getUpgradePreview:b=>sim.preview('upgrade',[b])},buildingPickMesh:{getMatrixAt(i,m){indices.push(i);m.copy(new THREE.Matrix4().makeTranslation(i,1,0));}}});
  r._syncUpgradeMarkers();assert(r.upgradeMarkers.size>0);
  const visible=sim.state.buildings.filter(b=>b.type==='commercial');
  for(const marker of r.upgradeMarkers.values()){assert.equal(marker.building.type,'commercial');assert.equal(marker.position.x,visible.findIndex(b=>b.id===marker.building.id));}
  assert(indices.every(i=>i<visible.length));assert.equal(r.tool,'upgrade');
  r.buildingFilter=null;r._syncUpgradeMarkers();assert([...r.upgradeMarkers.values()].some(m=>m.building.type!=='commercial'));
 }finally{globalThis.document=previous;}
});

test('the industrial filter keeps power and water upgrade prices visible',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(){return {addEventListener(){},setAttribute(){},remove(){}};}};
 try{
  const sim=new CitySimulation({demo:true});sim.state.money=100000;Object.assign(sim.state.milestones,{density:true,completed:true});sim.recalculate();
  const r=Object.create(CityRenderer.prototype);
  Object.assign(r,{state:sim.state,tool:'upgrade',buildingFilter:'industrial',container:{appendChild(){}},callbacks:{getUpgradePreview:b=>sim.preview('upgrade',[b])},buildingPickMesh:{getMatrixAt(i,m){m.copy(new THREE.Matrix4().makeTranslation(i,1,0));}}});
  r._syncUpgradeMarkers();const markers=[...r.upgradeMarkers.values()],types=new Set(markers.map(marker=>marker.building.type));
  assert(types.has('industrial'));assert(types.has('power'));assert(types.has('water'));
  for(const marker of markers)assert(['industrial','power','water'].includes(marker.building.type));
  for(const marker of markers.filter(marker=>['power','water'].includes(marker.building.type)))assert.match(marker.button.innerHTML,/¥[\d,]+/);
 }finally{globalThis.document=previous;}
});
