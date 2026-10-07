import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityRenderer} from '../src/renderer.js';
import {isLuminousPart} from '../src/night-lighting.js';

const renderer=()=>{const r=Object.create(CityRenderer.prototype);r._tile=()=>null;return r;};
const building=(kind,level,footprint=2,rotation=0)=>({id:1,x:10,y:10,type:kind==='teaHouse'?'commercial':kind,businessKind:kind==='teaHouse'?kind:undefined,level,footprint,rotation,progress:1,active:true});
const parts=(r,b)=>{const out=[];r._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},b);return out;};

test('tea house and Buddhist temple retain their roofs and fit lots and selection boxes at every tier and rotation',()=>{
 const r=renderer(),object=new THREE.Object3D(),point=new THREE.Vector3();
 const geometries={box:new THREE.BoxGeometry(),roof:new THREE.BoxGeometry().translate(0,.5,0),mansard:new THREE.CylinderGeometry(.33,.5,1,4).rotateY(Math.PI/4).scale(Math.SQRT2,1,Math.SQRT2),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),crown:new THREE.IcosahedronGeometry(.5,1)};
 for(const kind of ['teaHouse','buddhistTemple'])for(const footprint of [1,2])for(let level=1;level<=6;level++)for(let rotation=0;rotation<4;rotation++){
  const b=building(kind,level,footprint,rotation),out=parts(r,b),bounds=new THREE.Box3();
  assert(out.filter(p=>p[0]==='mansard'&&p[1]===0x171b1b).length>=2,kind+' loses traditional roofs');
  for(const [shape,color,x,y,z,w,h,d,ry=0,rx=0,rz=0]of out){
   assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));assert(w>0&&h>0&&d>0);
   object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
   const vertices=geometries[shape].attributes.position;
   for(let i=0;i<vertices.count;i++)bounds.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrix));
  }
  for(const axis of ['x','z'])assert(bounds.min[axis]>=-22.01&&bounds.max[axis]<=-22+footprint+.01,`${kind} ${footprint}×${footprint} L${level} R${rotation}: ${axis} boundary`);
  assert(bounds.max.y<=r._buildingVisualHeight(b)+.015,kind+' selection height');
 }
 for(const g of Object.values(geometries))g.dispose();
});

test('traditional upgrades stay distinct, and windows and lanterns extinguish with the building',()=>{
 const r=renderer(),glows=out=>out.filter(([shape,...p])=>isLuminousPart(shape,p)||shape==='cylinder'&&p[0]===0xba7252);
 const families=[];
 for(const kind of ['teaHouse','buddhistTemple']){
  const signatures=[];
  for(let level=1;level<=6;level++){
   const b=building(kind,level),on=parts(r,b),off=parts(r,{...b,active:false});
   assert(glows(on).length>=6,kind+' lacks night detail');assert.equal(glows(off).length,0,kind+' has lights when paused');
   signatures.push(JSON.stringify(on));
  }
  assert.equal(new Set(signatures).size,6);families.push(signatures[0]);
 }
 assert.notEqual(families[0],families[1]);
});
