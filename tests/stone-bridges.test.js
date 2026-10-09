import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {stoneBridgeLayout,stoneBridgeAt,stoneDeckHeight,stoneArchHeight,roadSurfaceHeight} from '../src/stone-bridges.js';
import {drawStoneBridge,stoneVaultGeometry,animateStoneBridgeLights} from '../src/stone-bridge-rendering.js';
import {CityRenderer} from '../src/renderer.js';
import {pedestrianTrip} from '../src/pedestrian-routing.js';
import {createYachtModel,updateYachtActor} from '../src/yacht-rendering.js';

function crossing(axis='ew',width=1,riverSpan=5){
 const sim=new CitySimulation();for(const t of sim.state.tiles)Object.assign(t,{road:0,bridge:false,terrain:'land'});
 const start=31-Math.floor(riverSpan/2),end=start+riverSpan-1;
 for(const t of sim.state.tiles){const a=axis==='ew'?t.x:t.y;if(a>=start&&a<=end)t.terrain='water';}
 for(let c=30;c<30+width;c++)for(let a=start-4;a<=end+4;a++){
  const t=axis==='ew'?sim.tile(a,c):sim.tile(c,a);Object.assign(t,{road:2,bridge:a>=start-1&&a<=end+1});
 }
 return sim;
}

test('water spans become a continuous stone vault in either orientation, preserve saves and meet both banks smoothly',()=>{
 for(const axis of ['ew','ns'])for(const width of [1,2,3]){
  const sim=crossing(axis,width),before=JSON.stringify(sim.state),layout=stoneBridgeLayout(sim.state),b=layout.bridges[0];
  assert.equal(layout.bridges.length,1);assert.equal(b.axis,axis);assert.equal(b.width,width);assert.equal(layout.cells.size,7*width);
  assert.equal(stoneDeckHeight(b,b.start-.5),.079);assert.equal(stoneDeckHeight(b,b.end+.5),.079);
  assert(stoneDeckHeight(b,b.center)>1.2);assert(stoneArchHeight(b,b.arches[0].center)>.8);
  assert(stoneDeckHeight(b,b.start-.499)-.079<1e-6);assert(stoneDeckHeight(b,b.end+.499)-.079<1e-6);
  for(let a=b.start-.5;a<=b.end+.5;a+=.025){assert(stoneDeckHeight(b,a)>stoneArchHeight(b,a)+.13);assert(Math.abs(stoneDeckHeight(b,a)-stoneDeckHeight(b,b.start+b.end-a))<1e-9);}
  assert.equal(JSON.stringify(sim.state),before);
  sim.tile(31,31).road=0;stoneBridgeLayout(sim.state,true);assert(!stoneBridgeAt(sim.state,31,31));
 }
});

test('staggered banks join into one broad deck only where all occupied cells are actual roads',()=>{
 const sim=crossing('ew',2);sim.tile(33,31).terrain='land';
 let layout=stoneBridgeLayout(sim.state);assert.equal(layout.bridges.length,1);assert.equal(layout.bridges[0].width,2);
 sim.tile(34,31).road=0;layout=stoneBridgeLayout(sim.state,true);assert.equal(layout.bridges.length,2);assert(!layout.cells.has('34,31'));
});

test('walkers remain on the outside footway and follow the curved bridge without inventing crossings',()=>{
 const sim=crossing('ew',2),trip=pedestrianTrip(sim.state,{x:26,y:29},{x:36,y:29});assert(trip);
 assert(trip.sidewalk.every(p=>p.y>=29.588&&p.y<=29.66&&!p.crossing));
 for(const p of trip.sidewalk){assert.equal(p.height,roadSurfaceHeight(sim.state,p.x,p.y,p.axis));}
 assert(trip.sidewalk.some(p=>p.height>1));assert(trip.sidewalk.some(p=>p.height<.1));
});

test('vault meshes have an actual navigable opening, finite bounds, and lights fade without changing simulation',()=>{
 const sim=crossing('ew',1,4),b=stoneBridgeLayout(sim.state).bridges[0],before=JSON.stringify(sim.state),g=stoneVaultGeometry(b);
 assert([...g.attributes.position.array].every(Number.isFinite));assert([...g.attributes.normal.array].every(Number.isFinite));
 const ray=new THREE.Raycaster(new THREE.Vector3(b.center-31.5,.55,b.cross-31.5+3),new THREE.Vector3(0,0,-1));
 const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,mat);mesh.updateMatrixWorld();assert.equal(ray.intersectObject(mesh).length,0,'boat corridor is a hole through the bridge');
 ray.ray.origin.y=stoneDeckHeight(b,b.center)-.05;assert(ray.intersectObject(mesh).length>0,'solid deck remains above the opening');
 const group=new THREE.Group(),parts=[];drawStoneBridge(b,{add:(...args)=>parts.push(args)},group);
 assert(parts.every(p=>p.slice(2).every(Number.isFinite)));const lights=group.children.filter(m=>m.userData.stoneBridgeNight);assert.equal(lights.length,4);
 animateStoneBridgeLights(lights,1,10);assert(lights.every(m=>m.visible));animateStoneBridgeLights(lights,0,10);assert(lights.every(m=>!m.visible));
 assert.equal(JSON.stringify(sim.state),before);
 let disposed=0,textures=0;for(const m of group.children){m.geometry.addEventListener('dispose',()=>disposed++);if(m.userData.ownTexture)m.material.map.addEventListener('dispose',()=>textures++);}
 CityRenderer.prototype._clear(group);assert.equal(disposed,5);assert.equal(textures,1);g.dispose();mat.dispose();
});

test('two-cell openings repeat across wider rivers without rotating broad roads or stretching the holes',()=>{
 for(const axis of ['ew','ns'])for(const width of [1,3,8,16])for(const [span,count] of [[1,1],[2,1],[3,1],[4,1],[5,2],[6,2],[7,3],[10,4],[11,4],[14,5],[15,6],[16,6],[24,10]]){
  const sim=crossing(axis,width,span),before=JSON.stringify(sim.state),layout=stoneBridgeLayout(sim.state),b=layout.bridges[0];
  assert.equal(layout.bridges.length,1);assert.equal(b.axis,axis);assert.equal(b.arches.length,count);assert.equal(b.width,width);
  assert.equal(layout.cells.size,(span+2)*width);assert.equal(b.piers.length,count-1);
  assert.equal(stoneDeckHeight(b,b.start-.5),.079);assert.equal(stoneDeckHeight(b,b.end+.5),.079);
  for(const a of b.arches){
   assert(stoneArchHeight(b,a.center)>0);
   assert.equal(a.opening*2,span<2?.84:2,'net opening width follows road cells, never the width of the bridge deck');
   assert(a.center-a.opening>=b.start+.5-1e-9);assert(a.center+a.opening<=b.end-.5+1e-9);
  }
  for(let i=1;i<b.arches.length;i++)assert(b.arches[i].center-b.arches[i-1].center-2>=.44-1e-9,'intermediate supports remain solid');
  assert(Math.abs((b.arches[0].center-b.arches[0].opening-(b.start+.5))-((b.end-.5)-(b.arches.at(-1).center+b.arches.at(-1).opening)))<1e-9,'both banks have equal margins');
  for(const a of b.piers)assert.equal(stoneArchHeight(b,a),-.22);
  if(count>1){assert(stoneDeckHeight(b,b.center)<1.4);assert.equal(stoneDeckHeight(b,b.start-.5+b.approach),stoneDeckHeight(b,b.center));}
  assert.equal(JSON.stringify(sim.state),before,'derived layout must not change saves or ownership');
 }
});

test('multi-arch vaults expose every hole, retain solid piers and keep all illuminated trim below the deck',()=>{
 for(const axis of ['ew','ns']){
  const sim=crossing(axis,3,14),b=stoneBridgeLayout(sim.state).bridges[0],group=new THREE.Group();
  drawStoneBridge(b,{add:()=>{}},group);group.updateMatrixWorld();
  const vault=group.children.find(m=>m.userData.stoneVault);
  const hit=(a,h=.55)=>{const origin=axis==='ew'?new THREE.Vector3(a-31.5,h,b.cross-31.5+4):new THREE.Vector3(b.cross-31.5+4,h,a-31.5);return new THREE.Raycaster(origin,axis==='ew'?new THREE.Vector3(0,0,-1):new THREE.Vector3(-1,0,0)).intersectObject(vault);};
  for(const arch of b.arches){
   assert.equal(hit(arch.center).length,0);
   for(const side of [-1,1]){
    assert.equal(hit(arch.center+side*.98,0).length,0,'the two-cell opening is open through the entire deck width');
    assert(hit(arch.center+side*1.02,0).length>0,'stone supports begin just outside the two-cell opening');
   }
  }
  for(const pier of b.piers)assert(hit(pier).length>0);
  const lights=group.children.filter(m=>m.userData.stoneBridgeNight);assert.equal(lights.filter(m=>m.userData.stoneBridgeNight==='reflection').length,10);
  const glow=lights.find(m=>m.userData.stoneBridgeNight==='arch').geometry.attributes.position;
  for(let i=0;i<glow.count;i++){const a=(axis==='ew'?glow.getX(i):glow.getZ(i))+31.5;assert(glow.getY(i)<stoneDeckHeight(b,a)-.05,'arch trim stays inside the masonry');}
  for(const mesh of group.children)assert([...mesh.geometry.attributes.position.array].every(Number.isFinite));
  let textures=0,geometries=0;for(const mesh of group.children){mesh.geometry.addEventListener('dispose',()=>geometries++);if(mesh.userData.ownTexture)mesh.material.map.addEventListener('dispose',()=>textures++);}
  CityRenderer.prototype._clear(group);assert.equal(textures,1);assert.equal(geometries,13);
 }
});

test('traffic heatmaps sit above every curved bridge slice and clear their geometry on layer changes',()=>{
 const sim=crossing('ns',2),r=Object.create(CityRenderer.prototype),geometry=new THREE.BoxGeometry(),matrix=new THREE.Matrix4();
 Object.assign(r,{state:sim.state,overlay:'traffic',overlayGroup:new THREE.Group(),geometries:{box:geometry}});r._buildOverlay();
 const upper=r.overlayGroup.children.find(m=>m.userData.elevatedTraffic);assert(upper);assert.equal(upper.count,7*2*12);
 for(let i=0;i<upper.count;i++){
  upper.getMatrixAt(i,matrix);const x=matrix.elements[12]+31.5,y=matrix.elements[14]+31.5;
  assert(Math.abs(matrix.elements[13]-(roadSurfaceHeight(sim.state,x,y,'ns')+.013))<.001);
 }
 r.overlay='none';r._buildOverlay();assert.equal(r.overlayGroup.children.length,0);geometry.dispose();
});

test('yachts stay visible under the open high arch while low stone abutments still occlude them',()=>{
 const sim=crossing('ew',1,3),model=createYachtModel('cruiser'),actor={position:new THREE.Vector3(),model},size=64;
 const entry={boat:{id:0},berth:29*size+31,route:[29*size+31,30*size+31,31*size+31],bridgeRoutePositions:[1],gridSize:size,operating:true};
 updateYachtActor(actor,entry,26.5,false,1);assert(!model.visible);
 updateYachtActor(actor,entry,26.5,false,1,sim.state);assert(model.visible);assert(model.userData.lighting.group.visible);
 entry.route=entry.route.map(i=>i-2);entry.berth-=2;
 updateYachtActor(actor,entry,26.5,false,1,sim.state);assert(!model.visible);model.userData.dispose();
});
