import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fireEffectLayout} from '../src/fire-rendering.js';
import {CityRenderer} from '../src/renderer.js';

test('fire layout forms layered irregular flames, rising smoke and scattered embers deterministically',()=>{
  const event={id:'incident-fire-8-3',kind:'fire',targetId:3,startedMonth:8},target={id:3,footprint:1};
  const first=fireEffectLayout(event,target),again=fireEffectLayout(event,target);
  assert.deepEqual(first,again);
  assert.equal(first.flames.length,12);assert.equal(first.smoke.length,9);assert.equal(first.embers.length,10);
  assert.equal(first.flames.filter(part=>part.layer==='bed').length,4);
  assert.equal(first.flames.filter(part=>part.layer==='outer').length,4);
  assert.equal(first.flames.filter(part=>part.layer==='core').length,4);
  assert(first.flames.every(part=>[part.x,part.y,part.z,part.sx,part.sy,part.sz].every(Number.isFinite)));
  assert(first.smoke.every((part,index)=>index===0||part.y>first.smoke[index-1].y));
  assert(first.smoke[0].opacity>first.smoke.at(-1).opacity);
  assert(new Set(first.flames.map(part=>`${part.x.toFixed(3)}:${part.z.toFixed(3)}`)).size>4,'flame layers should not read as three identical cones');
  const large=fireEffectLayout(event,{...target,footprint:2});
  const reach=layout=>Math.max(...layout.flames.map(part=>Math.hypot(part.x,part.z)));
  assert(reach(large)>reach(first),'a large roof should spread the fire clusters farther apart');
});

test('renderer builds animated emissive fire and drifting translucent smoke above the target',()=>{
  const renderer=Object.create(CityRenderer.prototype),target={id:3,x:8,y:9,type:'residential',level:1,progress:1,population:5,active:true,variant:0,shortageTicks:0};
  Object.assign(renderer,{roadFocus:false,privateGroups:new Map(),elapsed:0,geometries:{flame:new THREE.ConeGeometry(.5,1,7),crown:new THREE.IcosahedronGeometry(.5,1)},fireIncidentGroup:new THREE.Group(),state:{buildings:[target],cityIncidents:{active:[{id:'incident-fire-8-3',kind:'fire',targetId:3,startedMonth:8}]}}});
  renderer._buildFireIncidentEffects([target]);
  assert.equal(renderer.fireIncidentGroup.children.length,1);
  const root=renderer.fireIncidentGroup.children[0],flame=root.children.find(child=>child.userData.fireRole==='flame'),smoke=root.children.find(child=>child.userData.fireRole==='smoke'),light=root.children.find(child=>child.userData.fireLight);
  assert(flame.material.emissiveIntensity>0);assert.equal(smoke.material.transparent,true);assert.equal(smoke.material.depthWrite,false);assert(light?.isPointLight);
  const before={flameY:flame.scale.y,smokeY:smoke.position.y,opacity:smoke.material.opacity,light:light.intensity};
  renderer.elapsed=1.25;renderer._animateFireIncidents();
  assert.notEqual(flame.scale.y,before.flameY);assert.notEqual(smoke.position.y,before.smokeY);assert.notEqual(smoke.material.opacity,before.opacity);assert.notEqual(light.intensity,before.light);
  renderer._clearFireIncidentEffects();assert.equal(renderer.fireIncidentGroup.children.length,0);
  renderer.geometries.flame.dispose();renderer.geometries.crown.dispose();
});

test('fire effect stays hidden when its building is filtered out or roads are focused',()=>{
  const renderer=Object.create(CityRenderer.prototype),target={id:3,x:8,y:9,type:'residential',level:1,progress:1,active:true,variant:0};
  Object.assign(renderer,{roadFocus:false,privateGroups:new Map(),geometries:{flame:new THREE.ConeGeometry(.5,1,7),crown:new THREE.IcosahedronGeometry(.5,1)},fireIncidentGroup:new THREE.Group(),state:{buildings:[target],cityIncidents:{active:[{id:'incident-fire-8-3',kind:'fire',targetId:3,startedMonth:8}]}}});
  renderer._buildFireIncidentEffects([]);assert.equal(renderer.fireIncidentGroup.children.length,0);
  renderer.roadFocus=true;renderer._buildFireIncidentEffects([target]);assert.equal(renderer.fireIncidentGroup.children.length,0);
  renderer.geometries.flame.dispose();renderer.geometries.crown.dispose();
});
