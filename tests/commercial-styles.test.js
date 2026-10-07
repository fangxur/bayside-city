import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {BUSINESS_KINDS,businessKindsFor} from '../src/business-kinds.js';
import {COMMUNITY_BUILDINGS,isCommunityBusiness} from '../src/community-buildings.js';
import {COMMERCIAL_STYLE_GROUPS,commercialConstructionKinds} from '../src/commercial-styles.js';
import {CityRenderer} from '../src/renderer.js';
import {isLuminousPart} from '../src/night-lighting.js';

test('commercial menu sections contain every shop and commercial facility exactly once',()=>{
 const grouped=COMMERCIAL_STYLE_GROUPS.flatMap(group=>group.tools),expected=[...businessKindsFor('commercial'),...Object.keys(COMMUNITY_BUILDINGS).filter(isCommunityBusiness)];
 assert.equal(grouped.length,new Set(grouped).size);assert.deepEqual([...grouped].sort(),expected.sort());assert.deepEqual([...commercialConstructionKinds()].sort(),expected.sort());
});
test('new commercial storefronts fit rotated lots through all tiers and keep working night lights',()=>{
 const r=Object.create(CityRenderer.prototype),kinds=['kissaten','flowerShop','bookstore','departmentStore','foodHall','europeanArcade','japaneseMarket'];
 const geometries={box:new THREE.BoxGeometry(),roof:new THREE.BoxGeometry().translate(0,.5,0),crown:new THREE.IcosahedronGeometry(.5,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,10)};
 const object=new THREE.Object3D(),point=new THREE.Vector3();
 for(const kind of kinds)for(let level=1;level<=6;level++)for(let rotation=0;rotation<4;rotation++){
  const def=BUSINESS_KINDS[kind],b={id:4,x:10,y:10,type:'commercial',businessKind:kind,footprint:def.footprint,level,rotation,progress:1,active:true};r._tile=()=>null;
  const out=[];r._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},b);const bounds=new THREE.Box3();
  for(const [shape,color,x,y,z,w,h,d,ry=0,rx=0,rz=0]of out){
   assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
   const positions=geometries[shape].getAttribute('position');for(let i=0;i<positions.count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(object.matrix));
  }
  for(const axis of ['x','z'])assert(bounds.min[axis]>=-22.01&&bounds.max[axis]<=-22+def.footprint+.01,`${kind} L${level} R${rotation} ${axis}`);
  assert(bounds.max.y<=r._buildingVisualHeight(b)+.03,kind+' selection height');
  assert(out.some(([shape,...p])=>isLuminousPart(shape,p)),kind+' needs night lighting');
 }
 for(const geometry of Object.values(geometries))geometry.dispose();
});
