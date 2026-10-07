import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityRenderer} from '../src/renderer.js';
import {LANDMARKS,landmarkHeight} from '../src/landmarks.js';
import {isLandmarkLight,NightLighting,LANDMARK_LIGHT_COLORS} from '../src/night-lighting.js';
const renderer=Object.create(CityRenderer.prototype);renderer._tile=()=>null;
function parts(b){const out=[];renderer._building({add:(...args)=>out.push(args),box:(...args)=>out.push(['box',...args])},b);return out;}
const building=(type,level=1)=>({id:1,type,x:10,y:10,footprint:LANDMARKS[type].footprint||1,level,progress:1,active:true});
const geometries={box:new THREE.BoxGeometry(),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),cone:new THREE.ConeGeometry(.5,1,8),crown:new THREE.IcosahedronGeometry(.5,1),dome:new THREE.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2)};
const bounds=items=>{
 const result=new THREE.Box3(),dummy=new THREE.Object3D(),vertex=new THREE.Vector3();
 for(const [kind,color,x,y,z,w,h,d,ry=0,rx=0,rz=0] of items){
  assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));assert(w>0&&h>0&&d>0);
  dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
  const positions=geometries[kind].getAttribute('position');for(let i=0;i<positions.count;i++)result.expandByPoint(vertex.fromBufferAttribute(positions,i).applyMatrix4(dummy.matrix));
 }
 return result;
};
test('landmarks rise above the former skyline and grow with renovation without expanding their lots',()=>{
 for(const [type,def] of Object.entries(LANDMARKS)){
  let last=0;
  for(let level=1;level<=3;level++)for(let rotation=0;rotation<4;rotation++){
   const b={...building(type,level),rotation},box=bounds(parts(b)),size=b.footprint;
   assert(box.min.x>=-22.02&&box.max.x<=-22+size+.02,type+' X');
   assert(box.min.z>=-22.02&&box.max.z<=-22+size+.02,type+' Z');
   assert(box.max.y<=landmarkHeight(b)+.12,type+' selection bounds');
   if(rotation===0){assert(box.max.y>last,type+' upgrade height');last=box.max.y;}
   if(def.footprint)assert(box.max.y>=def.height*(type==='bigBen'?1.4:1.7),type+' taller skyline');
  }
  const during={...building(type,3),progress:.6};
  assert.equal(renderer._buildingVisualHeight(during),landmarkHeight(building(type,2)));
 }
});
test('Pearl spheres and clock faces retain their proportions at every tier',()=>{
 for(let level=1;level<=3;level++){
  const pearl=parts(building('orientalPearl',level)).filter(p=>p[0]==='crown'&&p[1]===0xcb8f9d);
  assert.equal(pearl.length,3);for(const p of pearl)assert.equal(p[5],p[6]);
  const clocks=parts(building('bigBen',level)).filter(p=>p[1]===LANDMARK_LIGHT_COLORS.gold&&p[6]===.4);
  assert(clocks.length>=2);for(const p of clocks)assert(p[5]===.4||p[7]===.4);
 }
});
test('every landmark has distinct night accents that rotate with its model and switch off when paused',()=>{
 for(const type of Object.keys(LANDMARKS)){
  const b=building(type,3),on=parts(b).filter(p=>isLandmarkLight(p[0],p.slice(1)));
  assert(on.length>0,type);assert(parts({...b,rotation:1}).filter(p=>isLandmarkLight(p[0],p.slice(1))).length===on.length);
  assert.equal(parts({...b,active:false}).filter(p=>isLandmarkLight(p[0],p.slice(1))).length,0,type);
 }
});
test('landmark night lights keep their colors, fade with night, clear on rebuild and hide in road focus',()=>{
 const scene=new THREE.Scene(),city=new THREE.Group(),source=new THREE.Object3D();
 source.userData={partKind:'box',nightLandmarkParts:[[LANDMARK_LIGHT_COLORS.cyan,1,2,3,.03,2,.03,0,0,0],[LANDMARK_LIGHT_COLORS.pink,2,3,4,.03,1,.03,0,0,0]]};city.add(source);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),fx=new NightLighting(scene,{box:geometry},material),state={tiles:[],buildings:[]};
 fx.rebuild(city,state,null,false);
 assert.equal(fx.meshes.length,1);assert.equal(fx.meshes[0].count,2);assert(fx.meshes[0].instanceColor);
 const color=new THREE.Color(),expected=new THREE.Color(LANDMARK_LIGHT_COLORS.cyan);fx.meshes[0].getColorAt(0,color);assert(Math.abs(color.r-expected.r)+Math.abs(color.g-expected.g)+Math.abs(color.b-expected.b)<1e-6);
 fx.setAmount(1);assert.equal(fx.landmarkMaterial.opacity,.9);fx.setAmount(0);assert.equal(fx.landmarkMaterial.opacity,0);assert(!fx.group.visible);
 fx.rebuild(city,state,null,true);assert.equal(fx.meshes.length,0);
 let disposed=false;fx.landmarkMaterial.addEventListener('dispose',()=>disposed=true);fx.dispose();assert(disposed);geometry.dispose();material.dispose();
});
