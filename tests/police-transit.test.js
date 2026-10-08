import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {incidentRisks,createCityIncident} from '../src/city-incidents.js';
import {busRoutes,policeCoverageCells} from '../src/network-services.js';
import {publicVehicleRoutes} from '../src/public-vehicles.js';
import {cityCatalog} from '../src/city-catalog.js';
import {CityRenderer} from '../src/renderer.js';

function town(){
  const sim=new CitySimulation();sim.state.money=100000;
  for(let x=7;x<=40;x++){sim.tile(x,32).road=1;sim.tile(x,32).bridge=sim.tile(x,32).terrain==='water';}
  for(const [type,x] of [['power',8],['water',9],['residential',20],['industrial',32]])sim._newBuilding(x,31,type,true);
  Object.assign(sim.state.buildings.find(b=>b.type==='residential'),{level:2,population:16});
  sim.recalculate();return sim;
}
function facility(sim,type,x,y=31){
  const before=sim.state.money;assert(sim.build(type,[{x,y}]).ok);
  const building=sim.state.buildings.at(-1);building.progress=1;sim.recalculate();
  assert(sim.state.money<before);return building;
}

test('police protection follows connected roads, lowers crime risk and mitigates an active robbery',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential');
  home.level=6;home.population=220;sim.state.buildings.find(b=>b.type==='industrial').active=false;sim.recalculate();
  const before=incidentRisks(sim.state).find(r=>r.kind==='robbery');assert(before);
  createCityIncident(sim.state,'robbery',home.id);sim.recalculate();const penalty=home.incidentHappinessPenalty;
  const police=facility(sim,'policeStation',12);
  assert(home.services.policeStation);assert(home.incidentHappinessPenalty<penalty);
  const response=publicVehicleRoutes(sim.state).find(r=>r.kind==='police');assert(response?.responding);assert.equal(response.targetId,home.id);
  sim.state.cityIncidents.active=[];sim.recalculate();
  assert(incidentRisks(sim.state).find(r=>r.kind==='robbery').probability<before.probability);
  police.active=false;sim.recalculate();assert(!home.services.policeStation);assert(!publicVehicleRoutes(sim.state).some(r=>r.kind==='police'));
  police.active=true;sim.tile(16,32).road=0;sim.recalculate();assert(!home.services.policeStation);
  assert(!policeCoverageCells(sim.state,police).includes(home.y*sim.state.mapSize+home.x));
});

test('two operating bus stops create real road trips and reduce commute traffic without removing jobs',()=>{
  const sim=town(),home=sim.state.buildings.find(b=>b.type==='residential'),baseline=sim.state.routes.find(r=>r.kind==='commute'),workers=home.workers;
  const first=facility(sim,'busStop',19);assert.equal(busRoutes(sim.state).length,0);assert(!home.services.busStop);
  const second=facility(sim,'busStop',31);
  const routes=busRoutes(sim.state);assert.equal(routes.length,1);assert(home.services.busStop);
  for(const route of routes){assert.deepEqual(route.points[0],route.points.at(-1));route.points.forEach((p,i)=>{assert(sim.tile(p.x,p.y).road);if(i)assert.equal(Math.abs(p.x-route.points[i-1].x)+Math.abs(p.y-route.points[i-1].y),1);});}
  const commute=sim.state.routes.find(r=>r.kind==='commute');assert(commute.transit);assert.equal(home.workers,workers);assert.equal(commute.commuters,workers);
  assert(commute.load<baseline.load);assert(home.commute<baseline.duration);assert.equal(sim.state.stats.transit.commuters,workers);
  assert(cityCatalog(sim.state).vehicles.find(v=>v.id==='vehicle:bus').unlocked);
  second.active=false;sim.recalculate();assert.equal(busRoutes(sim.state).length,0);assert(!home.services.busStop);assert.equal(sim.state.stats.transit.commuters,0);
  second.active=true;sim.tile(26,32).road=0;sim.recalculate();assert.equal(busRoutes(sim.state).length,0);
  assert(!sim.getInfo(first.x,first.y).metrics.find(m=>m.label==='公交线路').value.includes('条往返'));
});

test('inactive, unfinished and unpowered facilities cannot dispatch or protect, and nearby stops alone do not reduce all commutes',()=>{
  const sim=town(),first=facility(sim,'busStop',18),second=facility(sim,'busStop',21),police=facility(sim,'policeStation',12);
  assert.equal(busRoutes(sim.state).length,1);assert.equal(sim.state.stats.transit.commuters,0,'workplace is outside the stop catchments');
  first.progress=.5;police.progress=.5;sim.recalculate();assert.equal(busRoutes(sim.state).length,0);assert(!publicVehicleRoutes(sim.state).some(r=>r.kind==='police'));
  first.progress=police.progress=1;sim.state.buildings.find(b=>b.type==='power').active=false;sim.recalculate();
  assert.equal(busRoutes(sim.state).length,0);assert(!publicVehicleRoutes(sim.state).some(r=>r.kind==='police'));
  assert(!second.services.busStop);
});

test('new facilities survive saves, moves, rotations, demolition and undo, with distinct models at supported levels',()=>{
  const sim=town();const police=facility(sim,'policeStation',12),stop=facility(sim,'busStop',19);facility(sim,'busStop',31);
  assert(sim.rotateBuilding(police.id).ok);assert(sim.moveBuilding(stop.id,{x:19,y:33}).ok);
  const loaded=CitySimulation.deserialize(sim.serialize());assert.equal(busRoutes(loaded.state).length,1);assert(loaded.state.buildings.find(b=>b.id===police.id).rotation);
  assert(loaded.getInfo(19,33).metrics.some(m=>m.label==='公交线路'));
  assert(loaded.build('bulldoze',[{x:19,y:33}]).ok);assert.equal(busRoutes(loaded.state).length,0);loaded.undo();assert.equal(busRoutes(loaded.state).length,1);
  const renderer=Object.create(CityRenderer.prototype);renderer._tile=()=>null;
  for(const [type,levels,color] of [['policeStation',[1,4,6],0x315d91],['busStop',[1],0x46a58c]])for(const level of levels){
    const parts=[],batch={box:(...a)=>parts.push(a),add:(shape,...a)=>parts.push(a)};
    renderer._building(batch,{id:1,x:10,y:10,type,level,progress:1,active:true});assert(parts.some(p=>p[0]===color));
    assert(parts.every(p=>p.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
});
