import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {BUSINESS_KINDS,businessKindsFor} from '../src/business-kinds.js';
import {RESIDENTIAL_STYLE_GROUPS} from '../src/residential-styles.js';
import {EUROPEAN_STREET_KINDS} from '../src/european-residential.js';
import {CityRenderer} from '../src/renderer.js';
import {RELIGIOUS_BUILDINGS} from '../src/religious-buildings.js';
import {isLandmarkLight} from '../src/night-lighting.js';

test('residential style sections partition the construction choices without mixing commercial or omitting old homes',()=>{
 const kinds=RESIDENTIAL_STYLE_GROUPS.flatMap(group=>group.tools);
 assert.equal(kinds.length,new Set(kinds).size);assert.deepEqual([...kinds].sort(),businessKindsFor('residential').sort());
 for(const kind of EUROPEAN_STREET_KINDS)assert(RESIDENTIAL_STYLE_GROUPS.find(g=>g.id==='europeanStreet').tools.includes(kind));
});

test('European homes and cathedrals fit their actual rotated lots and selection bounds at every tier',()=>{
 const r=Object.create(CityRenderer.prototype);r._tile=()=>null;
 const vertices={
  box:new THREE.BoxGeometry(),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),cone:new THREE.ConeGeometry(.5,1,8),crown:new THREE.IcosahedronGeometry(.5,1),
  mansard:new THREE.CylinderGeometry(.33,.5,1,4).rotateY(Math.PI/4).scale(Math.SQRT2,1,Math.SQRT2),dome:new THREE.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2),ring:new THREE.TorusGeometry(.5,.075,5,16),
  roof:new THREE.BoxGeometry().translate(0,.5,0),
 };
 const object=new THREE.Object3D(),point=new THREE.Vector3();
 for(const kind of [...EUROPEAN_STREET_KINDS,'gothicCathedral','domedCathedral']){
  const def=BUSINESS_KINDS[kind]||RELIGIOUS_BUILDINGS[kind],type=BUSINESS_KINDS[kind]?'residential':kind;
  for(let level=1;level<=6;level++)for(let rotation=0;rotation<4;rotation++){
   const b={id:1,x:10,y:10,type,businessKind:type==='residential'?kind:undefined,footprint:def.footprint,level,progress:1,rotation,active:true};
   const out=[];r._building({add:(...args)=>out.push(args),box:(...args)=>out.push(['box',...args])},b);
   const bounds=new THREE.Box3();for(const [shape,color,x,y,z,w,h,d,ry=0,rx=0,rz=0]of out){
    assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
    const pos=vertices[shape].getAttribute('position');for(let i=0;i<pos.count;i++)bounds.expandByPoint(point.fromBufferAttribute(pos,i).applyMatrix4(object.matrix));
   }
   assert(bounds.min.x>=-22.02&&bounds.max.x<=-22+def.footprint+.02,kind+' x boundary');
   assert(bounds.min.z>=-22.02&&bounds.max.z<=-22+def.footprint+.02,kind+' z boundary');
   assert(bounds.max.y<=r._buildingVisualHeight(b)+.04,kind+' selection height');
  }
 }
 for(const g of Object.values(vertices))g.dispose();
});

test('cathedral stained glass and lamps are present at night and extinguish when paused',()=>{
 const r=Object.create(CityRenderer.prototype);r._tile=()=>null;
 for(const type of ['gothicCathedral','domedCathedral'])for(const active of [true,false]){
  const out=[];r._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},{type,id:1,x:10,y:10,footprint:3,level:1,progress:1,active});
  assert.equal(out.some(([shape,...p])=>isLandmarkLight(shape,p)),active);
 }
});
