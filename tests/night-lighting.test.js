import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NightLighting,nightAmount,isLuminousPart} from '../src/night-lighting.js';
import {CitySimulation} from '../src/simulation.js';
test('lighting modes have smooth cyclic dawn and dusk with safe defaults',()=>{
 assert.equal(nightAmount('day',80),0);assert.equal(nightAmount('night',0),1);assert.equal(nightAmount('unknown',80),0);
 assert.equal(nightAmount('auto',0),0);assert.equal(nightAmount('auto',80),1);assert.equal(nightAmount('auto',120),0);
 for(let t=0;t<120;t++){const n=nightAmount('auto',t);assert(n>=0&&n<=1);assert.equal(n,nightAmount('auto',t+120));assert(Math.abs(n-nightAmount('auto',t+.1))<.02);}
});
test('emissive panes exclude roofs and road markings while retaining street lamps',()=>{
 assert(isLuminousPart('box',[0x627f82,0,.5,0,.15,.17,.015]));
 assert(isLuminousPart('box',[0xffefba,0,.57,0,.064,.025,.036]));
 assert(isLuminousPart('box',[0x8ba096,0,.25,0,.14,.10,.024]));
 assert(isLuminousPart('box',[0xffdfaa,0,.43,0,1.6,.012,.016]));
 assert(!isLuminousPart('roof',[0x627f82,0,.5,0,.7,.3,.7]));
 assert(!isLuminousPart('box',[0xffffff,0,.04,0,.15,.01,.04]));
});
test('all roads and buildings receive light pools without mutating saves; filtering and cleanup work',()=>{
 const s=new CitySimulation({demo:true}),before=s.serialize(),scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();
 const fx=new NightLighting(scene,{box:geometry},material),city=new THREE.Group();
 fx.rebuild(city,s.state,null,false);
 const roads=s.state.tiles.filter(t=>t.road).length;
 assert.equal(fx.meshes.at(-1).count,roads+2*s.state.buildings.length);
 for(const mesh of fx.meshes)assert([...mesh.instanceMatrix.array].every(Number.isFinite));
 fx.setAmount(1);assert(fx.group.visible);fx.setAmount(0);assert(!fx.group.visible);
 fx.rebuild(city,s.state,'commercial',false);assert.equal(fx.meshes.at(-1).count,roads+2*s.state.buildings.filter(b=>b.type==='commercial').length);
 fx.rebuild(city,s.state,null,true);assert.equal(fx.meshes.at(-1).count,roads);
 assert.equal(s.serialize(),before);fx.dispose();assert.equal(scene.children.length,0);geometry.dispose();material.dispose();
});
test('fountain water, halo and rim lights rebuild cleanly and fade together',()=>{
 const scene=new THREE.Scene(),city=new THREE.Group(),source=new THREE.Object3D();
 source.userData={partKind:'cylinder',nightFountainParts:[[0x68a8b1,2,.226,3,.78,.022,.78,0,0,0],[0xbde2dd,2,.56,3,.035,.23,.035,0,0,0]]};city.add(source);
 const geometries={box:new THREE.BoxGeometry(),cylinder:new THREE.CylinderGeometry(.5,.5,1,16)},material=new THREE.MeshBasicMaterial(),fx=new NightLighting(scene,geometries,material);
 const state={tiles:[],buildings:[]};fx.rebuild(city,state,null,false);
 assert.equal(fx.meshes.find(m=>m.material===fx.basinMaterial).count,1);
 assert.equal(fx.meshes.find(m=>m.material===fx.windowMaterial).count,8);
 assert.equal(fx.meshes.find(m=>m.material===fx.fountainGlowMaterial).count,2);
 for(const mesh of fx.meshes)assert([...mesh.instanceMatrix.array].every(Number.isFinite));
 fx.setAmount(.5,24);assert.equal(fx.basinMaterial.uniforms.amount.value,.5);assert.equal(fx.basinMaterial.uniforms.time.value,24);
 fx.setAmount(0,24);assert(!fx.group.visible);assert.equal(fx.fountainGlowMaterial.uniforms.amount.value,0);
 fx.rebuild(city,state,null,true);assert.equal(fx.meshes.length,0);
 fx.rebuild(new THREE.Group(),state,'commercial',false);assert.equal(fx.meshes.length,0);
 let disposed=0;for(const m of [fx.basinMaterial,fx.fountainGlowMaterial])m.addEventListener('dispose',()=>disposed++);
 fx.dispose();assert.equal(disposed,2);Object.values(geometries).forEach(g=>g.dispose());material.dispose();
});
