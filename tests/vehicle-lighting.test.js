import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoadVehicleLighting} from '../src/vehicle-lighting.js';
import {ROAD_VEHICLE_STYLES} from '../src/public-vehicles.js';
import {createYachtModel,updateYachtActor} from '../src/yacht-rendering.js';
import {CityRenderer} from '../src/renderer.js';

const position=(mesh,i)=>{const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix);};

test('all road fleet lights face forward and stay on elevated, inclined and turning vehicles',()=>{
 const parent=new THREE.Group(),lights=new RoadVehicleLighting(parent,1);lights.setCount(1);
 for(const style of Object.values(ROAD_VEHICLE_STYLES))for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const pitch of [-.3,0,.3]){
  const base=new THREE.Vector3(4,1.26,7),forward=new THREE.Vector3(Math.sin(angle)*Math.cos(pitch),-Math.sin(pitch),Math.cos(angle)*Math.cos(pitch));
  lights.update(0,{x:base.x,y:base.y,z:base.z,angle,pitch,length:style.length,width:style.width});lights.finish();
  for(let i=0;i<2;i++){
   const head=position(lights.heads,i),tail=position(lights.tails,i),beam=position(lights.beams,i);
   assert(head.clone().sub(base).dot(forward)>style.length/2);
   assert(tail.clone().sub(base).dot(forward)<-style.length/2);
   assert(beam.clone().sub(head).dot(forward)>.5);assert(head.y>.9);
  }
  for(const mesh of lights.meshes)assert([...mesh.instanceMatrix.array].every(Number.isFinite));
 }
 lights.dispose();assert.equal(parent.children.length,0);
});

test('daytime, dusk and night fade consistently; hidden and removed cars leave no lights',()=>{
 const lights=new RoadVehicleLighting(new THREE.Group(),3);lights.setCount(3);
 for(const n of [0,.5,1]){
  lights.setAmount(n);assert.equal(lights.headMaterial.opacity,n);assert.equal(lights.beamMaterial.uniforms.amount.value,n);
  assert.equal(lights.tailPoolMaterial.uniforms.amount.value,n);assert.equal(lights.heads.visible,n>0);
 }
 lights.setAmount(1,true);assert(!lights.group.visible);lights.setAmount(1);assert(lights.group.visible);
 lights.update(1,{visible:false});
 for(const mesh of lights.meshes)for(const i of [2,3]){const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);assert.equal(new THREE.Vector3().setFromMatrixScale(m).length(),0);}
 lights.setCount(1);assert(lights.meshes.every(mesh=>mesh.count===2));lights.setCount(0);assert(lights.meshes.every(mesh=>mesh.count===0));
 let released=0;for(const resource of [lights.box,lights.plane,lights.headMaterial,lights.tailMaterial,lights.beamMaterial,lights.tailPoolMaterial])resource.addEventListener('dispose',()=>released++);
 lights.dispose();assert.equal(released,6);
});

test('both yacht types illuminate navigation lights, cabin windows and water while respecting bridge occlusion',()=>{
 for(const kind of ['motor','cruiser']){
  const model=createYachtModel(kind),actor={position:new THREE.Vector3(),model};
  const entry={boat:{id:0},berth:0,route:[0,1,2],bridgeRoutePositions:[1],gridSize:64,operating:true},before=JSON.stringify(entry);
  const lights=model.userData.lighting;
  assert(!lights.group.visible);
  for(const name of ['port-light','starboard-light','mast-light','stern-light','cabin-window','water-reflection'])assert(lights.group.getObjectByName(name),name);
  updateYachtActor(actor,entry,0,false,1);assert(model.visible);assert(lights.group.visible);assert.equal(lights.warm.opacity,1);
  updateYachtActor(actor,entry,26.5,false,1);assert(!model.visible,'no floating light remains while the hull is under a bridge');
  updateYachtActor(actor,entry,29,false,.5);assert(model.visible);assert.equal(lights.white.opacity,.5);assert.equal(lights.reflection.uniforms.amount.value,.5);
  updateYachtActor(actor,entry,29,true,1);assert(!model.visible,'road focus hides the boat and all its lights');
  updateYachtActor(actor,entry,29,false,0);assert(model.visible);assert(!lights.group.visible);
  assert.equal(JSON.stringify(entry),before,'rendering cannot mutate boat ownership or routes');
  let disposed=0;for(const resource of [...lights.materials,lights.box,lights.plane])resource.addEventListener('dispose',()=>disposed++);
  model.userData.dispose();assert.equal(disposed,7);
 }
});

test('switching to night while paused illuminates the fleet without advancing simulation clocks',()=>{
 const r=Object.create(CityRenderer.prototype),amounts=[];
 Object.assign(r,{paused:true,lightingMode:'night',lightingClock:24,nightBlend:0,scene:{background:new THREE.Color(),fog:{color:new THREE.Color()}},
  ambient:{color:new THREE.Color(),groundColor:new THREE.Color()},sun:{color:new THREE.Color()},nightLighting:{setAmount(){}},
  vehicleLighting:{setAmount(n,hidden){amounts.push([n,hidden]);}},civicRoadLighting:{setAmount(n){amounts.push([n,false]);}},roadFocus:false});
 r._animateLighting(.4);assert.equal(r.lightingClock,24);assert.equal(r.nightBlend,1);assert.deepEqual(amounts,[[1,false],[1,false]]);
 r.setLightingMode('day');r._animateLighting(.4);assert.equal(r.nightBlend,0);assert.equal(r.lightingClock,24);
});
