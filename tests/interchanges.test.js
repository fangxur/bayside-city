import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {interchangeBounds,interchangeCore,findInterchangeCenter,interchangeCells,interchangeOffer,roadElevation,validRoadPath,INTERCHANGE_MAINTENANCE} from '../src/interchanges.js';
import {prepareInterchangePreview} from '../src/interchange-preview.js';
import {InterchangeDirectionGuide,interchangeDirectionMarkers} from '../src/interchange-direction-guide.js';
import {detectIntersections,TrafficController} from '../src/traffic-signals.js';
import {CityRenderer} from '../src/renderer.js';
import {roadPath} from '../src/road-network.js';
import {walkingPath} from '../src/resident-journeys.js';
import {CoopStore} from '../server/coop-store.mjs';

const center={x:14,y:32};
function town(detour=false){
  const sim=new CitySimulation();sim.state.money=100000;
  const road=(x,y)=>{const t=sim.tile(x,y);t.terrain='land';t.road=2;};
  for(let x=0;x<=28;x++)for(let y=31;y<=33;y++)road(x,y);
  for(let y=23;y<=41;y++)for(let x=13;x<=15;x++)road(x,y);
  if(detour){for(let y=24;y<=40;y++)road(8,y);for(const y of [24,40])for(let x=8;x<=14;x++)road(x,y);}
  sim.recalculate();return sim;
}
function convert(sim,axis='ns'){const result=sim.build(axis==='ns'?'interchangeNS':'interchangeEW',[center]);assert(result.ok,result.message);return result;}
function wideTown(width,height){
  const sim=town();for(const t of sim.state.tiles){t.terrain='land';t.road=0;}
  const b=interchangeBounds({...center,width,height});
  for(let y=b.minY;y<=b.maxY;y++)for(let x=0;x<=28;x++)sim.tile(x,y).road=2;
  for(let x=b.minX;x<=b.maxX;x++)for(let y=22;y<=43;y++)sim.tile(x,y).road=2;
  sim.recalculate();return sim;
}

test('rectangular and even-width crossings preserve geometry, separated routes, saves and undo',()=>{
  for(const [width,height] of [[3,5],[4,4],[5,5],[6,4]])for(const axis of ['ns','ew']){
    const sim=wideTown(width,height),b=interchangeBounds({...center,width,height}),before=sim.serialize();
    for(const cell of interchangeCore({...center,width,height}))assert.deepEqual(findInterchangeCenter(sim.state,cell),{...center,width,height});
    convert(sim,axis);const item=sim.state.interchanges[0];assert.equal(item.width,width);assert.equal(item.height,height);
    assert.equal(sim.state.tiles.filter(t=>t.interchange).length,width*height+4*(axis==='ns'?width:height));
    assert.equal(roadElevation(sim.state,b.cx,b.cy,axis),1.1);assert.equal(roadElevation(sim.state,b.cx,b.cy,axis==='ns'?'ew':'ns'),0);
    const edge=axis==='ns'?b.maxY+.5:b.maxX+.5;
    const at=p=>roadElevation(sim.state,axis==='ns'?b.cx:p,axis==='ns'?p:b.cy,axis);
    assert.equal(at(edge),1.1);assert.equal(at(edge+2),0);assert(at(edge+1)>0&&at(edge+1)<1.1);
    assert(!validRoadPath(sim.state,[{x:center.x-1,y:center.y},{...center},{x:center.x,y:center.y+1}]));
    for(const saved of [sim.serialize(),sim.serializeCompact()])assert.deepEqual(CitySimulation.deserialize(saved).state.interchanges,[item]);
    for(const corrupt of [raw=>raw.interchanges[0].width=width+1,raw=>delete raw.interchanges[0].height]){const raw=JSON.parse(sim.serialize());corrupt(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));}
    assert(sim.undo().ok);assert.equal(sim.serialize(),before);
  }
});

test('preview leaves authoritative money, tick and undo untouched for build, direction and restore',()=>{
  const sim=wideTown(4,5);
  for(const tool of ['interchangeNS','interchangeEW','interchangeFlat']){
    const before=sim.serialize(),undo=sim._undo,preview=prepareInterchangePreview(sim,tool,center);
    assert(preview.ok,preview.message);assert.equal(sim.serialize(),before);assert.equal(sim._undo,undo);
    assert.equal(preview.before.money,sim.state.money);assert.equal(preview.after.tick,sim.state.tick);
    assert.equal(preview.after.money,sim.state.money-preview.offer.cost);
    assert.equal(preview.after.interchanges.length,tool==='interchangeFlat'?0:1);
    preview.after.tiles[0].road=7;assert.notEqual(sim.state.tiles[0].road,7);
    assert(sim.build(tool,[center]).ok);
  }
  assert(!prepareInterchangePreview(sim,'road',center).ok);
  sim.state.money=5999;const before=sim.serialize();assert(!prepareInterchangePreview(sim,'interchangeNS',center).ok);assert.equal(sim.serialize(),before);
});

test('preview warns about buildings cut off by removing intersection turns',()=>{
  const sim=wideTown(4,5),home=sim._newBuilding(12,24,'residential',true,1);sim.recalculate();
  assert(home.connected);const before=sim.serialize(),preview=prepareInterchangePreview(sim,'interchangeNS',center);
  assert(preview.ok);assert.equal(preview.disconnected,1);assert.equal(sim.serialize(),before);
  assert.equal(prepareInterchangePreview(sim,'interchangeEW',center).disconnected,1);
});

test('wide bridge heatmap follows the deck and ramps, preserves traffic colors, and clears on other layers',()=>{
  for(const axis of ['ns','ew']){
    const sim=wideTown(4,5);convert(sim,axis);
    for(const t of sim.state.tiles)if(t.interchange)t.traffic=100;
    const renderer=Object.create(CityRenderer.prototype);renderer.state=sim.state;renderer.overlay='traffic';renderer.overlayGroup=new THREE.Group();renderer.geometries={box:new THREE.BoxGeometry()};
    renderer._buildOverlay();const upper=renderer.overlayGroup.children.find(m=>m.userData.elevatedTraffic);
    assert(upper);assert.equal(upper.count,20+4*(axis==='ns'?4:5)*12);assert.equal(renderer.overlayGroup.children.length,2);
    const color=new THREE.Color();upper.getColorAt(0,color);assert(color.r>color.g&&color.r>color.b);
    const matrix=new THREE.Matrix4(),pos=new THREE.Vector3();let ramps=0,deck=0;
    for(let i=0;i<upper.count;i++){upper.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));pos.setFromMatrixPosition(matrix);if(pos.y>1.19)deck++;else if(pos.y>.10)ramps++;}
    assert(deck>=20);assert(ramps>0);
    const info=sim.getInfo(center.x,center.y);assert.equal(info.title,'4×5 立交桥');assert(info.metrics.some(m=>m.label==='拥堵程度'&&m.value==='100%'));
    renderer.overlay='power';renderer._buildOverlay();assert.equal(renderer.overlayGroup.children.length,1);assert(!renderer.overlayGroup.children.some(m=>m.userData.elevatedTraffic));
    renderer._clear(renderer.overlayGroup);renderer.geometries.box.dispose();
  }
});

test('direction labels agree with raised approaches and remain geographic after camera rotation',()=>{
  for(const axis of ['ns','ew']){
    const sim=wideTown(4,5);convert(sim,axis);const item=sim.state.interchanges[0],markers=interchangeDirectionMarkers(item,sim.state);
    assert.deepEqual(markers.filter(p=>p.upper).map(p=>p.label),axis==='ns'?['北','南']:['西','东']);
    assert.equal(sim.getInfo(center.x,center.y).metrics.find(m=>m.label==='高架方向').value,axis==='ns'?'南北':'东西');
    for(const p of markers)assert.equal(p.height,roadElevation(sim.state,p.x,p.y,p.axis)+.22);
    const oldDocument=globalThis.document;
    const elements=[],container={appendChild:label=>elements.push(label)};
    globalThis.document={createElement:()=>({style:{},classList:{toggle(){}},setAttribute(){},remove(){elements.pop();}})};
    try{
      const guide=new InterchangeDirectionGuide(container);guide.set(item,sim.state);
      const b=interchangeBounds(item),renderer=Object.create(CityRenderer.prototype);
      Object.assign(renderer,{viewSize:16,aspect:2,azimuth:Math.PI/4,target:new THREE.Vector3(b.cx-31.5,0,b.cy-31.5),camera:new THREE.OrthographicCamera(-16,16,8,-8,.1,180)});
      const rect={left:0,top:0,width:800,height:400};renderer._updateCamera();guide.update(renderer.camera,rect,rect);
      const before=guide.labels.map(p=>({left:parseFloat(p.style.left),text:p.textContent}));
      assert(before[2].left<before[3].left);
      renderer.rotateBy(Math.PI/2);guide.update(renderer.camera,rect,rect);
      assert(parseFloat(guide.labels[2].style.left)>parseFloat(guide.labels[3].style.left));
      assert.deepEqual(guide.labels.map(p=>p.textContent),before.map(p=>p.text));
      guide.set(null,sim.state);assert(guide.labels.every(p=>p.hidden));guide.dispose();assert.equal(elements.length,0);
    }finally{globalThis.document=oldDocument;}
  }
});

test('interchange previews center and fit all approaches across rotations, panel sizes and map edges',()=>{
  for(const point of [{x:5,y:5},{x:81,y:84}])for(const aspect of [.6,1,2.8]){
    const item={...point,width:4,height:6,axis:'ew'},b=interchangeBounds(item),r=Object.create(CityRenderer.prototype);
    Object.assign(r,{state:{mapSize:96,interchanges:[item]},aspect,azimuth:Math.PI/4,target:new THREE.Vector3(),camera:new THREE.OrthographicCamera(-16,16,8,-8,.1,180)});
    r.frameInterchange(item);
    for(let turn=0;turn<8;turn++){
      const middle=new THREE.Vector3(b.cx-31.5,r.interchangeFrameElevation,b.cy-31.5).project(r.camera);
      assert(Math.abs(middle.x)<1e-9&&Math.abs(middle.y)<1e-9);
      for(const dx of [-1,1])for(const dz of [-1,1])for(const height of [0,1.4]){
        const corner=new THREE.Vector3(b.cx-31.5+dx*(b.width+6)/2,height,b.cy-31.5+dz*(b.height+6)/2).project(r.camera);
        assert(Math.abs(corner.x)<=.840001&&Math.abs(corner.y)<=.840001);
      }
      r.rotateBy(Math.PI/4);
    }
    const center=r.target.clone();r.target.set(-100,0,-100);r._limitCamera();assert(r.target.equals(center));
    r.zoomBy(.8);assert(r.target.equals(center));
    r.container={clientWidth:300,clientHeight:420};r.renderer={setSize(){}};r._resize();
    assert.equal(r.aspect,300/420);assert(r.target.equals(center));
  }
});

test('3x3 crossroads can choose either upper axis, rotate, restore and undo with exact finance',()=>{
  const sim=town(),before=sim.serialize(),expenses=sim.state.stats.expenses,maintenance=sim.state.stats.breakdown.roadMaintenance;
  assert(sim.preview('interchangeNS',[{x:13,y:31}]).valid);convert(sim);
  assert.equal(sim.state.money,94000);assert.equal(sim.state.interchanges[0].axis,'ns');
  assert.equal(sim.state.stats.breakdown.roadMaintenance,maintenance+INTERCHANGE_MAINTENANCE);
  assert(sim.state.stats.expenses>expenses);assert(!sim.preview('interchangeNS',[center]).valid);
  const ns=sim.serialize();assert(sim.build('interchangeEW',[center]).ok);assert.equal(sim.state.money,93000);assert.equal(sim.state.interchanges[0].axis,'ew');
  assert(sim.undo().ok);assert.equal(sim.serialize(),ns);
  const roads=sim.state.tiles.filter(t=>t.road).length;assert(sim.build('interchangeFlat',[center]).ok);assert.equal(sim.state.interchanges.length,0);assert.equal(sim.state.tiles.filter(t=>t.road).length,roads);
  assert(sim.undo().ok);assert.equal(sim.serialize(),ns);
  assert(sim.getInfo(14,32).title.includes('立交桥'));
});

test('invalid ramps, widths, water, edge plots, directions and funds are rejected atomically',()=>{
  for(const change of [s=>s.tile(13,28).road=0,s=>s.tile(16,34).road=1,s=>s.tile(14,30).terrain='water',s=>s.state.money=5999]){
    const sim=town();change(sim);sim.recalculate();const before=sim.serialize();assert(!sim.build('interchangeNS',[center]).ok);assert.equal(sim.serialize(),before);
  }
  const sim=town();assert(!interchangeOffer(sim.state,center,'diagonal').valid);assert(!sim.preview('interchangeEW',[{x:0,y:0}]).valid);
});

test('decks stay separate for connectivity, weighted commuting, public vehicles and walking',()=>{
  const sim=town();convert(sim);
  assert(sim.tile(24,32).connected);assert(!sim.tile(14,24).connected,'the northern approach cannot turn onto the lower western road');
  const west={x:9,y:30},east={x:23,y:30},north={x:12,y:24};
  assert(roadPath(sim.state,west,east).length);assert.equal(roadPath(sim.state,west,north).length,0);
  const detour=town(true),from=detour._index(9,32),to=detour._index(14,24);convert(detour);
  const paths=[detour._path([from],[to]),roadPath(detour.state,west,north).map(p=>detour._index(p.x,p.y)),walkingPath(detour.state,west,north).map(p=>detour._index(p.x,p.y))];
  for(const path of paths){assert(path.length);assert(path.map(i=>detour.state.tiles[i]).some(p=>p.x===8));assert(validRoadPath(detour.state,path.map(i=>detour.state.tiles[i])));}
  assert(!validRoadPath(detour.state,[{x:13,y:32},{x:14,y:32},{x:14,y:31}]));
  assert.equal(roadElevation(detour.state,14,32,'ns'),1.1);assert.equal(roadElevation(detour.state,14,32,'ew'),0);
  assert(roadElevation(detour.state,14,29,'ns')<roadElevation(detour.state,14,30,'ns'));assert.equal(roadElevation(detour.state,14,28,'ns'),0);
});

test('converted crossings remove lights and invalid turning visual routes, then restore signals',()=>{
  const sim=town(true),within=t=>Math.abs(t.x-14)<=1&&Math.abs(t.y-32)<=1;
  assert(detectIntersections(sim.state.tiles).some(within));convert(sim);
  assert(!detectIntersections(sim.state.tiles).some(within));
  const controller=new TrafficController(),turn={id:'invalid',points:[{x:13,y:32},{x:14,y:32},{x:14,y:31}],travel:0};controller.sync(sim.state.tiles,[turn]);assert.equal(controller.getPose('invalid'),null);
  assert(sim.build('interchangeFlat',[center]).ok);assert(detectIntersections(sim.state.tiles).some(within));
});

test('normal and compact saves validate structures; demolition restores a whole bridge and moves cannot break its approaches',()=>{
  const sim=town(true);convert(sim);
  for(const saved of [sim.serialize(),sim.serializeCompact()]){const copy=CitySimulation.deserialize(saved);assert.deepEqual(copy.state.interchanges,sim.state.interchanges);assert.equal(copy.serialize(),sim.serialize());}
  for(const mutate of [r=>r.interchanges[0].axis='bad',r=>r.interchanges.push({...r.interchanges[0]}),r=>r.tiles[28*64+13].road=0]){
    const raw=JSON.parse(sim.serialize());mutate(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
  }
  assert(!sim.previewMoveRoad({x:14,y:28},{x:20,y:25}).valid);
  const before=sim.serialize();assert(sim.build('bulldoze',[{x:14,y:28}]).ok);assert.equal(sim.state.interchanges.length,0);assert(sim.tile(14,32).road);sim.undo();assert.equal(sim.serialize(),before);
  const old=JSON.parse(town().serialize());delete old.interchanges;assert.deepEqual(CitySimulation.deserialize(JSON.stringify(old)).state.interchanges,[]);
});

test('both orientations draw finite ramps, two decks and support piers',()=>{
  const renderer=Object.create(CityRenderer.prototype);
  for(const [width,height] of [[3,3],[4,4],[3,5],[6,4]])for(const axis of ['ns','ew']){
    const sim=width===3&&height===3?town():wideTown(width,height);convert(sim,axis);renderer.state=sim.state;renderer._tile=(x,y)=>sim.tile(x,y);
    const parts=[],batch={add:(...a)=>parts.push(a),box:(...a)=>parts.push(['box',...a])};
    for(const cell of interchangeCells(sim.state.interchanges[0])){const t=sim.tile(cell.x,cell.y);if(t.interchange)renderer._road(batch,t,t.x-32,t.y-32);}
    assert(parts.length>150);assert(parts.some(p=>p[1]===0xa7b6af));assert(parts.some(p=>p[4]>1));assert(parts.every(p=>p.slice(2).every(Number.isFinite)));
  }
});

test('ramp profiles ease into flat roads and cars, buses and walkers follow the surface',()=>{
  const sim=town();convert(sim);
  const height=y=>roadElevation(sim.state,14,y,'ns');
  for(let y=28.5;y<30.5;y+=.05)assert(height(y+.05)>=height(y));
  assert(height(28.501)<.00001);assert(1.1-height(30.499)<.00001);
  const renderer=Object.create(CityRenderer.prototype);renderer.state=sim.state;renderer._tile=(x,y)=>sim.tile(x,y);
  renderer.paused=true;renderer.carClock=0;renderer.carDummy=new THREE.Object3D();renderer._updateTrafficLights=()=>{};
  const mesh=()=>({matrices:[],instanceMatrix:{},setMatrixAt(i,m){this.matrices[i]=m.clone();}});
  for(const name of ['carBodies','carCabins','carWheels','carLights','carEmergencyRed','carEmergencyBlue','carServiceMarksA','carServiceMarksB','carDetailsA','carDetailsB','walkerBodies','walkerHeads','walkerHair','walkerArms','walkerLegs'])renderer[name]=mesh();
  for(const appearance of ['car','bus']){
    for(const upper of [true,false]){
      const points=upper?[{x:14,y:29},{x:14,y:30}]:[{x:13,y:32},{x:14,y:32}];
      const pose={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,dx:upper?0:1,dy:upper?1:0,distance:.5};
      renderer.trafficController={step(){},getPose(){return pose;}};
      renderer.cars=[{id:'test',appearance,points,position:new THREE.Vector3()}];renderer._animateTraffic(0);
      const body=renderer.carBodies.matrices[0],wheels=renderer.carWheels.matrices;
      assert(Math.abs(body.elements[13]-(upper?.71:.16))<.00001);
      assert(upper?wheels[1].elements[13]>wheels[0].elements[13]:wheels[1].elements[13]===wheels[0].elements[13]);
      assert(body.elements.every(Number.isFinite));
    }
  }
  // A one-road-cell leisure trip still has two sidewalk endpoints.
  renderer.pedestrians=[{nameSeed:1,travel:0,points:[{x:9,y:32}],path:[{x:-22.6,z:.5,height:.079},{x:-22.4,z:.5,height:.079}],position:new THREE.Vector3()}];
  renderer._animatePedestrians(0);assert(renderer.walkerBodies.matrices[0].elements.every(Number.isFinite));
});

test('cooperative interchange builds, direction changes, conflict checks and undo use shared reversible construction',t=>{
  const store=new CoopStore(':memory:');t.after(()=>store.close());
  const actor=store.user(store.session('路口市长').token),sim=wideTown(4,5),id=store.create(actor,{name:'立交测试城',city:sim.serialize()}).cityId;
  const command=(tool,revision)=>({commandId:tool+'-'+revision,epoch:1,baseRevision:revision,method:'build',args:[tool,[center]]});
  const built=store.command(id,actor,command('interchangeNS',0));assert(built.ok,built.message);
  const rotated=store.command(id,actor,command('interchangeEW',built.revision));assert(rotated.ok,rotated.message);
  const stale=store.command(id,actor,command('interchangeFlat',0));assert(!stale.ok);
  assert(store.command(id,actor,{commandId:'undo',epoch:1,baseRevision:rotated.revision,method:'undo',args:[]}).ok);
  assert.equal(store.view(id,actor).state.interchanges[0].axis,'ns');
  assert.equal(store.view(id,actor).state.interchanges[0].width,4);assert.equal(store.view(id,actor).state.interchanges[0].height,5);
});
