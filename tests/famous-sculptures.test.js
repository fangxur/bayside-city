import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {CityRenderer} from '../src/renderer.js';
import {DECORATIONS,FAMOUS_SCULPTURE_KINDS} from '../src/decorations.js';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildingCells,footprintSize} from '../src/building-footprint.js';
import {cityCatalog,catalogPreview} from '../src/city-catalog.js';
import {isSculptureWash} from '../src/european-sculptures.js';
import {isLuminousPart,NightLighting} from '../src/night-lighting.js';
import {createFamousSculptureGeometries} from '../src/famous-sculptures.js';
import {CoopStore} from '../server/coop-store.mjs';

const parts=b=>{const out=[];Object.create(CityRenderer.prototype)._building({add:(...p)=>out.push(p),box:(...p)=>out.push(['box',...p])},b);return out;};
const building=type=>({id:1,type,x:10,y:10,progress:1,level:1,active:true});

function legacySculptures(){
 const sim=new CitySimulation();
 for(const [i,type] of FAMOUS_SCULPTURE_KINDS.entries()){
  assert(sim.build(type,[{x:12+i*3,y:12}]).ok);
  const b=sim.state.buildings.at(-1);b.footprint=2;b.rotation=i;b.active=i!==2;
  for(const p of buildingCells(b))sim.tile(p.x,p.y).buildingId=b.id;
 }
 assert(sim.build('park',[{x:12,y:14}]).ok);sim.recalculate();return sim;
}

test('legacy full and compact saves release three sculpture cells without changing identity, money or neighbors',()=>{
 const old=legacySculptures(),money=old.state.money;
 for(const text of [old.serialize(),old.serializeCompact()]){
  const loaded=CitySimulation.deserialize(text);assert.equal(loaded.state.money,money);
  for(const original of old.state.buildings.filter(b=>FAMOUS_SCULPTURE_KINDS.includes(b.type))){
   const b=loaded.state.buildings.find(b=>b.id===original.id);
   for(const key of ['x','y','active','progress'])assert.equal(b[key],original[key]);
   assert.equal(b.rotation||0,original.rotation||0);
   assert.equal(footprintSize(b),1);assert.equal(loaded.tile(b.x,b.y).buildingId,b.id);
   for(const p of buildingCells(original).slice(1)){assert.equal(loaded.tile(p.x,p.y).buildingId,null);assert(loaded.preview('park',[p]).valid);}
  }
  assert.equal(loaded.tile(12,14).buildingId,old.tile(12,14).buildingId);
  const stable=loaded.serializeCompact();assert.equal(CitySimulation.deserialize(stable).serializeCompact(),stable);
  assert(loaded.build('park',[{x:13,y:13}]).ok);
  const again=CitySimulation.deserialize(loaded.serializeCompact());assert.equal(again.tile(13,13).buildingId,loaded.tile(13,13).buildingId);
 }
 const broken=JSON.parse(old.serialize());broken.tiles[13*64+13].buildingId=null;
 assert.throws(()=>CitySimulation.deserialize(JSON.stringify(broken)),/损坏/);
});

test('existing cooperative cities and historic snapshots also compact before viewing, commands and restoration',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());
 const owner=store.user(store.session('迁移房主').token),id=store.create(owner,{name:'迁移雕像'}).cityId;
 const legacy=legacySculptures(),state=gzipSync(Buffer.from(JSON.stringify(legacy.state))).toString('base64'),checksum=createHash('sha256').update(state).digest('hex');
 for(const table of ['cities','snapshots'])store.db.prepare(`UPDATE ${table} SET state=?,checksum=? WHERE ${table==='cities'?'id':'city'}=?`).run(state,checksum,id);
 store.db.prepare('UPDATE revisions SET state=? WHERE city=?').run(state,id);
 const view=store.view(id,owner);assert(view.state.buildings.every(b=>footprintSize(b)===1));assert.equal(view.state.tiles[13*64+13].buildingId,null);
 assert.equal(view.state.money,legacy.state.money);assert.equal(CitySimulation.deserialize(store.exportSnapshot(id,owner)).state.buildings.length,5);
 const restored=store.snapshots(id,owner)[0].id;
 assert((await store.commandAsync(id,owner,{commandId:'fill-freed-cell',epoch:1,baseRevision:0,method:'build',args:['park',[{x:13,y:13}]]})).ok);
 assert((await store.commandAsync(id,owner,{commandId:'restore-old-sculpture',epoch:1,baseRevision:1,method:'restoreSnapshot',args:[restored]})).ok);
 const after=store.view(id,owner);assert.equal(after.state.tiles[13*64+13].buildingId,null);assert(after.state.buildings.every(b=>footprintSize(b)===1));assert.equal(after.state.money,legacy.state.money);
});

test('packed museum meshes decode into finite indexed surfaces with smooth normals and baked stone occlusion',()=>{
 const geometries=createFamousSculptureGeometries();assert.equal(Object.keys(geometries).length,4);
 for(const geometry of Object.values(geometries)){
  const {position,normal,color}=geometry.attributes;
  assert(position.count>5000&&position.count<10000);assert.equal(normal.count,position.count);assert.equal(color.count,position.count);
  assert(geometry.index.count/3<=18000);assert(geometry.index.array.every(index=>index<position.count));
  assert(position.array.every(Number.isFinite));assert(normal.array.every(Number.isFinite));
  assert(color.array.every(value=>Number.isFinite(value)&&value>=.4&&value<=1));
  assert(Math.min(...color.array)<.7);assert(Math.max(...color.array)>.99);
  geometry.dispose();
 }
});

test('night stone wash aligns with the scanned surface instead of inflating it around its feet',()=>{
 const geometries=createFamousSculptureGeometries(),material=new THREE.MeshStandardMaterial();
 const fx=new NightLighting(new THREE.Scene(),geometries,material),matrix=new THREE.Matrix4(),expected=new THREE.Matrix4(),dummy=new THREE.Object3D();
 dummy.position.set(3,.7,4);dummy.scale.set(.95,.95,.95);dummy.rotation.y=Math.PI/2;dummy.updateMatrix();expected.copy(dummy.matrix);
 fx.addParts('sculptureVictory',[[0xffebca,3,.7,4,.95,.95,.95,0,Math.PI/2,0]],fx.sculptureWashMaterial,geometries.sculptureVictory,true);
 fx.meshes[0].getMatrixAt(0,matrix);matrix.elements.forEach((value,i)=>assert(Math.abs(value-expected.elements[i])<1e-6));
 assert(fx.sculptureWashMaterial.vertexColors);assert(fx.sculptureWashMaterial.polygonOffset);
 fx.setAmount(1);assert(fx.sculptureWashMaterial.opacity>0);fx.setAmount(0);assert.equal(fx.sculptureWashMaterial.opacity,0);
 fx.dispose();material.dispose();Object.values(geometries).forEach(g=>g.dispose());
});

test('classical sculptures have different silhouettes, fit their single-tile plots at every rotation and selection height contains the full model',()=>{
 const geometries={box:new THREE.BoxGeometry(),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),crown:new THREE.IcosahedronGeometry(.5,1),rock:new THREE.DodecahedronGeometry(.5,0),...createFamousSculptureGeometries()},object=new THREE.Object3D(),point=new THREE.Vector3(),silhouettes=[];
 for(const type of FAMOUS_SCULPTURE_KINDS)for(let rotation=0;rotation<4;rotation++){
  const out=parts({...building(type),rotation}),bounds=new THREE.Box3();
  if(!rotation)silhouettes.push(JSON.stringify(out.map(p=>[p[0],...p.slice(2)])));
  for(const [kind,color,x,y,z,w,h,d,ry=0,rx=0,rz=0] of out){
   assert([color,x,y,z,w,h,d,ry,rx,rz].every(Number.isFinite));assert(w>0&&h>0&&d>0);
   object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.set(rx,ry,rz);object.updateMatrix();
   const vertices=geometries[kind].attributes.position;
   for(let i=0;i<vertices.count;i++)bounds.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrix));
  }
  for(const axis of ['x','z'])assert(bounds.min[axis]>=-22&&bounds.max[axis]<=-21,`${type} R${rotation} spills outside its plot on ${axis}`);
  assert(bounds.min.y>=0,type+' below ground');assert(bounds.max.y<=DECORATIONS[type].height,`${type} exceeds height ${bounds.max.y}`);assert(bounds.max.y>1.25,type+' lost its vertical presence');
 }
 assert.equal(new Set(silhouettes).size,4);for(const geometry of Object.values(geometries))geometry.dispose();
});

test('cooperative worker construction preserves all four plots and protects occupied cells from stale overlapping commands',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());
 const owner=store.user(store.session('雕像房主').token),guest=store.user(store.session('雕像队友').token),id=store.create(owner,{name:'雕像广场'}).cityId;
 store.join(store.invite(id,owner).code,guest);let spent=0,serial=0;
 for(const [i,type] of FAMOUS_SCULPTURE_KINDS.entries()){
  const x=12+i*3,y=12,revision=store.view(id,owner).revision;
  const cmd={commandId:'sculpture-'+(++serial),epoch:1,baseRevision:revision,method:'build',args:[type,[{x,y}]]};
  assert((await store.commandAsync(id,owner,cmd)).ok);spent+=DECORATIONS[type].cost;
  const view=store.view(id,guest),b=view.state.buildings.find(b=>b.type===type);assert.equal(footprintSize(b),1);
  for(const p of buildingCells(b))assert.equal(view.state.tiles[p.y*64+p.x].buildingId,b.id);
  assert.equal(view.state.money,30000-spent);
  const overlap={...cmd,commandId:'sculpture-'+(++serial),args:['park',[{x,y}]]};
  assert(!(await store.commandAsync(id,guest,overlap)).ok);assert.equal(store.view(id,guest).checksum,view.checksum);
 }
 const restored=CitySimulation.deserialize(store.exportSnapshot(id,owner));assert.equal(restored.state.buildings.length,4);
 assert(restored.state.buildings.every(b=>footprintSize(b)===1));
});

test('a whole sculpture charges once, occupies one cell without road or utility requirements, and can rotate, move, save and be removed from its occupied cell',()=>{
 for(const type of FAMOUS_SCULPTURE_KINDS){
  const s=new CitySimulation(),money=s.state.money,offer=s.preview(type,[{x:12,y:12}]);assert(offer.valid);assert.equal(offer.cells.length,1);
  assert(s.build(type,[{x:12,y:12}]).ok);assert.equal(s.state.money,money-DECORATIONS[type].cost);
  let b=s.state.buildings.find(b=>b.type===type);assert.equal(footprintSize(b),1);for(const p of buildingCells(b))assert.equal(s.tile(p.x,p.y).buildingId,b.id);
  assert.match(s.getInfo(12,12).subtitle,/1 × 1/);assert(s.getCommunityBeauty(14,13).value>0);assert(s.tile(14,13).services.park);
  assert(s.rotateBuilding(b.id).ok);assert.equal(b.rotation,1);assert(s.moveBuilding(b.id,{x:16,y:12}).ok);assert.equal(s.tile(12,12).buildingId,null);assert.equal(s.state.money,money-DECORATIONS[type].cost);
  const loaded=CitySimulation.deserialize(s.serializeCompact());b=loaded.state.buildings.find(b=>b.type===type);assert.equal(b.rotation,1);assert.equal(footprintSize(b),1);assert.equal(b.x,16);
  assert(loaded.build('bulldoze',[{x:16,y:12}]).ok);assert(!loaded.state.buildings.some(b=>b.type===type));for(const p of buildingCells(b))assert.equal(loaded.tile(p.x,p.y).buildingId,null);
  assert(s.undo().ok);assert.equal(s.tile(12,12).buildingId,b.id);
 }
});

test('occupied, off-map and unaffordable plots fail atomically; unsupported sculpture sizes are rejected',()=>{
 for(const type of FAMOUS_SCULPTURE_KINDS){
  const s=new CitySimulation();assert(s.build('road',[{x:12,y:12}]).ok);const before=s.serialize();assert(!s.build(type,[{x:12,y:12}]).ok);assert.equal(s.serialize(),before);assert(!s.preview(type,[{x:64,y:63}]).valid);
  const empty=new CitySimulation();empty.state.money=DECORATIONS[type].cost-1;const poor=empty.serialize();assert(!empty.build(type,[{x:12,y:12}]).ok);assert.equal(empty.serialize(),poor);
  empty.state.money=30000;assert(empty.build(type,[{x:12,y:12}]).ok);const raw=JSON.parse(empty.serialize());raw.buildings[0].footprint=3;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)),/损坏/);
 }
});

test('catalog previews are centred on the full footprint and include the tall statue in the view',()=>{
 const s=new CitySimulation(),catalog=cityCatalog(s.state);
 for(const type of FAMOUS_SCULPTURE_KINDS){const item=catalog.buildings.find(b=>b.id===`decoration:${type}`);assert(item.unlocked);assert.equal(item.footprint,1);assert.equal(item.maxLevel,1);
  const preview=catalogPreview(item);const b=preview.state.buildings[0];assert.equal(footprintSize(b),1);assert.equal(preview.focus.x,b.x);assert.equal(preview.focus.y,b.y);assert(preview.viewSize>DECORATIONS[type].height);
 }
});

test('night uplights and stone wash turn off with the whole sculpture, along with its garden pools and beauty',()=>{
 for(const type of FAMOUS_SCULPTURE_KINDS){const on=parts(building(type)),off=parts({...building(type),active:false});assert.equal(on.filter(([kind,...p])=>isLuminousPart(kind,p)).length,2);assert.equal(on.filter(([kind,...p])=>isSculptureWash(kind,p)).length,1);assert(on.some(([kind,...p])=>kind.startsWith('sculpture')&&isSculptureWash(kind,p)));assert.equal(off.filter(([kind,...p])=>isLuminousPart(kind,p)||isSculptureWash(kind,p)).length,0);
  const s=new CitySimulation();s.build(type,[{x:12,y:12}]);const b=s.state.buildings[0];s.setBuildingActive(b.id,false);assert.equal(s.getCommunityBeauty(14,13).value,0);
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),fx=new NightLighting(scene,{box:geometry},material);
  fx.rebuild(new THREE.Group(),{tiles:[],buildings:[{...building(type),active:false}]},null,false);assert.equal(fx.meshes.length,0);fx.dispose();geometry.dispose();material.dispose();
 }
});
