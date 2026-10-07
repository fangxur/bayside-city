import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityRenderer} from '../src/renderer.js';
import {DECORATIONS,EUROPEAN_SCULPTURE_KINDS} from '../src/decorations.js';
import {isSculptureWash} from '../src/european-sculptures.js';
import {isLuminousPart,NightLighting} from '../src/night-lighting.js';

const renderer=()=>Object.create(CityRenderer.prototype);
const parts=(r,b)=>{const out=[];r._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},b);return out;};
const building=type=>({id:1,type,x:10,y:10,progress:1,level:1,active:true});

test('classical sculptures have distinct silhouettes and stay inside a single tile at every rotation',()=>{
 const r=renderer(),object=new THREE.Object3D(),point=new THREE.Vector3();
 const geometries={box:new THREE.BoxGeometry(),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),cone:new THREE.ConeGeometry(.5,1,8),crown:new THREE.IcosahedronGeometry(.5,1),rock:new THREE.DodecahedronGeometry(.5,0),dome:new THREE.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2),ring:new THREE.TorusGeometry(.5,.075,5,16)};
 const silhouettes=[];
 for(const type of EUROPEAN_SCULPTURE_KINDS)for(let rotation=0;rotation<4;rotation++){
  const b={...building(type),rotation},out=parts(r,b),bounds=new THREE.Box3();
  if(!rotation)silhouettes.push(JSON.stringify(out.map(p=>[p[0],...p.slice(2)])));
  for(const [kind,color,x,y,z,w,h,d,ry=0,rx=0,rz=0]of out){
   assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));assert(w>0&&h>0&&d>0);
   object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
   const vertices=geometries[kind].attributes.position;
   for(let i=0;i<vertices.count;i++)bounds.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrix));
  }
  for(const axis of ['x','z'])assert(bounds.min[axis]>=-22&&bounds.max[axis]<=-21,`${type} R${rotation} exceeds tile on ${axis}`);
  assert(bounds.min.y>=0,`${type} below ground`);
  assert(bounds.max.y<=DECORATIONS[type].height,`${type} exceeds selection height: ${bounds.max.y}`);
 }
 assert.equal(new Set(silhouettes).size,EUROPEAN_SCULPTURE_KINDS.length);
 for(const g of Object.values(geometries))g.dispose();
});

test('sculpture uplights and facade wash extinguish when deactivated, without luminous bronze bodies',()=>{
 const r=renderer(),lights=out=>out.filter(([kind,...p])=>isLuminousPart(kind,p)),wash=out=>out.filter(([kind,...p])=>isSculptureWash(kind,p));
 for(const type of EUROPEAN_SCULPTURE_KINDS){
  const b=building(type),on=parts(r,b),off=parts(r,{...b,active:false});
  assert.equal(lights(on).length,2,type+' has extra glowing surfaces');
  assert(wash(on).length>15,type+' missing sculpture illumination');
  assert.equal(lights(off).length,0,type+' lamps still on');assert.equal(wash(off).length,0,type+' facade still lit');
 }
});

test('inactive sculptures also remove their ground pools and garden lights',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),fx=new NightLighting(new THREE.Scene(),{box:geometry},material),city=new THREE.Group();
 const state={tiles:[],buildings:[building('laurelStatue')]};
 fx.rebuild(city,state,null,false);assert.equal(fx.meshes.filter(m=>m.material===fx.windowMaterial)[0].count,2);
 state.buildings[0].active=false;fx.rebuild(city,state,null,false);assert.equal(fx.meshes.length,0);
 fx.dispose();geometry.dispose();material.dispose();
});
