import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {BUSINESS_KINDS} from '../src/business-kinds.js';
import {JAPANESE_HOME_KINDS,japaneseHomeHeight} from '../src/japanese-residential.js';
import {RESIDENTIAL_STYLE_GROUPS} from '../src/residential-styles.js';
import {CityRenderer} from '../src/renderer.js';
import {isLuminousPart} from '../src/night-lighting.js';

const renderer=()=>{const r=Object.create(CityRenderer.prototype);r._tile=()=>null;return r;};
const parts=(r,b)=>{const out=[];r._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},b);return out;};
test('Japanese homes fit their occupied lots and selection boxes through six tiers and four rotations',()=>{
 const r=renderer(),object=new THREE.Object3D(),point=new THREE.Vector3();
 const geometries={box:new THREE.BoxGeometry(),roof:new THREE.BoxGeometry().translate(0,.5,0),crown:new THREE.IcosahedronGeometry(.5,1),rock:new THREE.DodecahedronGeometry(.5,0),cylinder:new THREE.CylinderGeometry(.5,.5,1,10)};
 assert.deepEqual(RESIDENTIAL_STYLE_GROUPS.find(g=>g.id==='japanese').tools,JAPANESE_HOME_KINDS);
 for(const kind of JAPANESE_HOME_KINDS){
  const def=BUSINESS_KINDS[kind];
  for(let level=1;level<=6;level++)for(let rotation=0;rotation<4;rotation++){
   const b={id:7,x:10,y:10,type:'residential',businessKind:kind,footprint:def.footprint,level,rotation,progress:1,active:true};
   const bounds=new THREE.Box3();
   for(const [shape,color,x,y,z,w,h,d,ry=0,rx=0,rz=0]of parts(r,b)){
    assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));assert(w>0&&h>0&&d>0);
    object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
    const positions=geometries[shape].getAttribute('position');
    for(let i=0;i<positions.count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(object.matrix));
   }
   for(const axis of ['x','z'])assert(bounds.min[axis]>=-22.01&&bounds.max[axis]<=-22+def.footprint+.01,`${kind} L${level} R${rotation} ${axis} occupies a neighboring tile`);
   assert(bounds.max.y<=r._buildingVisualHeight(b)+.03,`${kind} L${level} exceeds selection height`);
  }
 }
 for(const geometry of Object.values(geometries))geometry.dispose();
});
test('Japanese window and lantern lighting switches off with the building, while each tier remains distinct',()=>{
 const r=renderer();
 for(const kind of JAPANESE_HOME_KINDS){
  const signatures=[];
  for(let level=1;level<=6;level++){
   const base={id:7,x:10,y:10,type:'residential',businessKind:kind,footprint:BUSINESS_KINDS[kind].footprint,level,progress:1};
   const on=parts(r,{...base,active:true}),off=parts(r,{...base,active:false});
   assert(on.filter(([shape,...p])=>isLuminousPart(shape,p)).length>=4,kind+' needs lit windows');
   assert.equal(off.filter(([shape,...p])=>isLuminousPart(shape,p)).length,0,kind+' inactive glazing must be dark');
   signatures.push(JSON.stringify(on));
  }
  assert.equal(new Set(signatures).size,6,kind+' should show its upgrades');
 }
 assert(japaneseHomeHeight({businessKind:'sukiyaHouse',level:6})<1.1,'garden home retains its low pavilion silhouette');
 assert(japaneseHomeHeight({businessKind:'japaneseApartment',level:6})>2,'modern apartments visibly gain floors');
});
