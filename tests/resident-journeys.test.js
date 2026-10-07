import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {getCitizenStory} from '../src/city-life.js';
import {residentCommute,walkingPath} from '../src/resident-journeys.js';
import {ResidentRouteOverlay} from '../src/resident-route-rendering.js';
import {CityRenderer} from '../src/renderer.js';

function town(){
  const sim=new CitySimulation();sim.state.money=100000;
  sim.build('road',Array.from({length:20},(_,i)=>({x:i+7,y:32})));
  for(const [type,x]of [['power',1],['water',2]])sim._newBuilding(x,31,type,true).level=6;
  for(const x of [5,6,7]){const b=sim._newBuilding(x,31,'residential',true);b.level=2;b.population=30;}
  sim._newBuilding(10,31,'park',true);
  const market=sim._newBuilding(12,31,'commercial',true);market.businessKind='market';sim.tile(12,31).businessKind='market';market.level=2;
  sim._newBuilding(14,31,'library',true);
  const firm=sim._newBuilding(22,31,'industrial',true);firm.businessKind='workshop';sim.tile(22,31).businessKind='workshop';firm.level=3;
  sim.recalculate();return sim;
}
const actor=(home,i=0)=>({id:'story-person-'+i,nameSeed:i*17,kind:'pedestrian',homeId:home.id,x:home.x,y:home.y});
function validPath(sim,points){
  assert(points.length);points.forEach((p,i)=>{assert(sim.tile(p.x,p.y)?.road);if(i)assert.equal(Math.abs(p.x-points[i-1].x)+Math.abs(p.y-points[i-1].y),1);});
}

test('commutes retain exact home/job assignments, weighted time and save compatibility',()=>{
  const sim=town();
  for(const home of sim.state.buildings.filter(b=>b.type==='residential')){
    const routes=sim.state.routes.filter(r=>r.homeId===home.id);
    assert.equal(routes.reduce((n,r)=>n+r.load,0),home.workers);
    assert(Math.abs(routes.reduce((n,r)=>n+r.duration*r.load,0)/home.workers-home.commute)<=.11);
    for(const r of routes){assert(sim.state.buildings.some(b=>b.id===r.workplaceId&&b.jobs>0));validPath(sim,r.points);}
    const trip=residentCommute(sim.state,home,123);assert(trip);assert.equal(trip.from.id,home.id);
  }
  const restored=CitySimulation.deserialize(sim.serialize());assert.deepEqual(restored.state.routes,sim.state.routes);
});

test('residents have varied dates, activities, errands and work trips plus reversible routes home',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential'),purposes=new Set(),diaries=new Set();
  const before=JSON.stringify(sim.state);
  for(let i=0;i<48;i++){
    const person=actor(home,i),story=getCitizenStory(sim.state,person),trip=story.journey;
    assert(story.personal.tag);assert(story.personal.text);assert(trip);
    purposes.add(trip.purpose);diaries.add(story.personal.text);validPath(sim,trip.points);
    assert.equal(trip.from.id,home.id);assert(sim.state.buildings.some(b=>b.id===trip.to.id&&b.active));
    if(trip.purpose==='date'){assert(trip.companion);assert(story.personal.text.includes(trip.companion));}
    const back=getCitizenStory(sim.state,{...person,returning:true});
    assert.equal(back.journey.purpose,'home');assert.equal(back.journey.to.id,home.id);
    assert.deepEqual(back.journey.points,[...trip.points].reverse());
    assert.deepEqual(getCitizenStory(sim.state,person),story);
  }
  for(const purpose of ['work','date','activity','errand'])assert(purposes.has(purpose),purpose);
  assert(diaries.size>=12);assert.equal(JSON.stringify(sim.state),before);
  const restored=CitySimulation.deserialize(sim.serialize());assert.deepEqual(getCitizenStory(restored.state,actor(home)),getCitizenStory(sim.state,actor(home)));
});

test('Christmas sends a visible share of residents to real reachable holiday activities',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential');
  sim.state.month=12;sim.state.tick=165;
  const outings=[];
  for(let i=0;i<64;i++){
    const story=getCitizenStory(sim.state,actor(home,100+i));
    if(story.journey?.purpose==='festival')outings.push(story);
  }
  assert(outings.length>=20,`only ${outings.length} Christmas outings`);
  for(const story of outings){
    assert.equal(story.journey.festivalId,'christmas');assert.equal(story.journey.festivalName,'圣诞节');
    assert.match(story.journey.label,/圣诞节活动/);assert(story.journey.activity);validPath(sim,story.journey.points);
    assert.match(story.personal.text,/圣诞|热饮|灯饰|冬日/);
    assert(sim.state.buildings.some(b=>b.id===story.journey.to.id&&b.active));
  }
  const christmasKinds=new Set(['bakery','tavern','artDeco','cafe','teaHouse','diner','market','oldStreet','park','plaza','library','chapel']);
  for(const b of sim.state.buildings)if(christmasKinds.has(b.businessKind||b.type))b.active=false;
  sim.recalculate();
  for(let i=0;i<24;i++)assert.notEqual(getCitizenStory(sim.state,actor(home,200+i)).journey?.purpose,'festival');
});

test('closures and road changes never leave routes to stale venues or fabricate employment',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential');
  let person,story;
  for(let i=0;i<48;i++){person=actor(home,i);story=getCitizenStory(sim.state,person);if(story.journey.purpose==='activity')break;}
  assert.equal(story.journey.purpose,'activity');const old=story.journey.to.id;
  sim.setBuildingActive(old,false);assert.notEqual(getCitizenStory(sim.state,person).journey?.to.id,old);
  sim.tile(8,32).road=0;sim.recalculate();
  assert.equal(residentCommute(sim.state,home,1),null);
  const walk=getCitizenStory(sim.state,person);assert.equal(walk.journey.purpose,'walk');validPath(sim,walk.journey.points);
  assert.equal(walk.commute,null);assert(!walk.personal.occupation.includes('员工'));
  sim.build('bulldoze',[home]);assert.equal(getCitizenStory(sim.state,person),null);
});

test('walking routes connect whole footprints across bridges and refuse missing roads',()=>{
  const sim=new CitySimulation();
  const from={id:1,x:5,y:5,footprint:2},to={id:2,x:10,y:5,footprint:2};
  for(let x=6;x<=11;x++)Object.assign(sim.tile(x,7),{road:1,terrain:x===8?'water':'land',bridge:x===8});
  const path=walkingPath(sim.state,from,to);validPath(sim,path);assert(path.some(p=>p.x===8));
  sim.tile(8,7).road=0;assert.deepEqual(walkingPath(sim.state,from,to),[]);
});

test('rendered walkers keep their real home and follow the entire selected outing',()=>{
  const sim=town(),r=Object.create(CityRenderer.prototype);
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
  Object.assign(r,{state:sim.state,pedestrians:[],pedestrianCapacity:96,actorById:new Map(),paused:true,carDummy:new THREE.Object3D()});
  for(const key of ['walkerBodies','walkerHeads','walkerHair','walkerArms','walkerLegs'])r[key]=new THREE.InstancedMesh(geometry,material,192);
  r._setPedestrians();assert(r.pedestrians.length>0);
  for(const walker of r.pedestrians){
    const descriptor=r._actorDescriptor(walker),story=getCitizenStory(sim.state,descriptor);
    assert.equal(story.home.id,walker.homeId);
    assert.deepEqual(story.journey.points,walker.returning?[...walker.points].reverse():walker.points);
    const before=walker.travel;r._animatePedestrians(3);assert.equal(walker.travel,before);
  }
  for(const key of ['walkerBodies','walkerHeads','walkerHair','walkerArms','walkerLegs'])r[key].dispose();geometry.dispose();material.dispose();
});

test('journey overlay draws bridges above water, updates congestion and disposes replaced geometry',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential'),trip=residentCommute(sim.state,home,1);
  const scene=new THREE.Scene(),overlay=new ResidentRouteOverlay(scene);
  const middle=trip.points[Math.floor(trip.points.length/2)];Object.assign(sim.tile(middle.x,middle.y),{bridge:true,traffic:0});
  overlay.setJourney(trip,sim.state);assert.equal(overlay.group.children.length,3);
  const mesh=overlay.group.children[0],positions=mesh.geometry.getAttribute('position');
  assert([...positions.array].every(Number.isFinite));assert([...positions.array].some((n,i)=>i%3===1&&n>=.25));
  overlay.setJourney(trip,sim.state);assert.equal(overlay.group.children[0],mesh);
  let disposed=false;mesh.geometry.addEventListener('dispose',()=>disposed=true);
  sim.tile(middle.x,middle.y).traffic=95;overlay.setJourney(trip,sim.state);assert(disposed);
  overlay.dispose();assert.equal(scene.children.length,0);
});

test('a job across the same road cell is a short outing, without sending the walker on a different route',()=>{
  const sim=new CitySimulation();
  for(const [type,x]of [['power',1],['water',2]])sim._newBuilding(x,31,type,true);
  const home=sim._newBuilding(5,31,'residential',true);home.population=8;
  sim._newBuilding(5,33,'commercial',true);sim.recalculate();
  const r=Object.create(CityRenderer.prototype),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
  Object.assign(r,{state:sim.state,pedestrians:[],pedestrianCapacity:96,actorById:new Map(),paused:false,carDummy:new THREE.Object3D()});
  const keys=['walkerBodies','walkerHeads','walkerHair','walkerArms','walkerLegs'];
  for(const key of keys)r[key]=new THREE.InstancedMesh(geometry,material,192);
  r._setPedestrians();const walker=r.pedestrians[0];assert(walker);assert.equal(walker.points.length,1);assert.equal(walker.path.length,2);
  r._animatePedestrians(3);assert(walker.position.toArray().every(Number.isFinite));
  const story=getCitizenStory(sim.state,r._actorDescriptor(walker));assert.equal(story.journey.roadCells,1);assert.equal(story.home.id,home.id);
  for(const key of keys)r[key].dispose();geometry.dispose();material.dispose();
});
