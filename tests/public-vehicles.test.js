import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {createCityIncident} from '../src/city-incidents.js';
import {CIVILIAN_VEHICLE_KINDS,FREIGHT_VEHICLE_KINDS,PUBLIC_VEHICLE_STYLES,ROAD_VEHICLE_STYLES,publicVehicleRoutes} from '../src/public-vehicles.js';

function town(){
  const sim=new CitySimulation();sim.state.money=100000;
  for(let x=7;x<=28;x++)sim.tile(x,32).road=1;
  for(const [type,x,y] of [['power',8,31],['water',9,31],['fireStation',11,31],['clinic',14,31],['residential',20,31],['residential',25,31]])sim._newBuilding(x,y,type,true);
  for(const home of sim.state.buildings.filter(building=>building.type==='residential'))home.population=8;
  sim.recalculate();return sim;
}

test('the road fleet has distinct proportions and recognizable service liveries',()=>{
  assert.deepEqual(CIVILIAN_VEHICLE_KINDS,['compact','car','hatchback','suv','taxi','minivan']);
  assert.deepEqual(FREIGHT_VEHICLE_KINDS,['delivery-van','pickup','freight']);
  assert.equal(Object.keys(ROAD_VEHICLE_STYLES).length,11);
  for(const [kind,style] of Object.entries(ROAD_VEHICLE_STYLES)){
    assert(style.label,kind);assert(style.shape,kind);
    for(const field of ['length','width','bodyHeight','cabinLength','cabinHeight','axleOffset'])assert(Number.isFinite(style[field])&&style[field]>0,`${kind}.${field}`);
  }
  assert.notEqual(ROAD_VEHICLE_STYLES.car.shape,ROAD_VEHICLE_STYLES.suv.shape);
  assert.notEqual(ROAD_VEHICLE_STYLES.ambulance.body,ROAD_VEHICLE_STYLES['fire-engine'].body);
  assert(ROAD_VEHICLE_STYLES['fire-engine'].length>ROAD_VEHICLE_STYLES.ambulance.length);
});

test('working fire and medical facilities put recognizable public vehicles on real roads',()=>{
  const sim=town(),before=JSON.stringify(sim.state),routes=publicVehicleRoutes(sim.state);
  assert.deepEqual(routes.map(route=>route.kind).sort(),['ambulance','fire-engine']);
  assert.equal(JSON.stringify(sim.state),before,'visual routes do not mutate the simulation');
  for(const route of routes){
    assert(PUBLIC_VEHICLE_STYLES[route.kind]);assert(route.points.length>=3);assert.deepEqual(route.points[0],route.points.at(-1));
    route.points.forEach((cell,index)=>{
      assert(sim.tile(cell.x,cell.y).road);
      if(index)assert.equal(Math.abs(cell.x-route.points[index-1].x)+Math.abs(cell.y-route.points[index-1].y),1);
    });
  }
});

test('public vehicles disappear when their facility cannot operate',()=>{
  const sim=town(),fire=sim.state.buildings.find(building=>building.type==='fireStation'),clinic=sim.state.buildings.find(building=>building.type==='clinic');
  fire.active=false;clinic.watered=false;
  assert.deepEqual(publicVehicleRoutes(sim.state),[]);
});

test('fire engines and ambulances respond to matching city incidents',()=>{
  for(const [incidentKind,vehicleKind] of [['fire','fire-engine'],['medical','ambulance']]){
    const sim=town(),target=sim.state.buildings.find(building=>building.type==='residential');
    assert(createCityIncident(sim.state,incidentKind,target.id));
    const route=publicVehicleRoutes(sim.state).find(item=>item.kind===vehicleKind);
    assert(route?.responding);assert.equal(route.targetId,target.id);assert.equal(route.incidentId,sim.state.cityIncidents.active[0].id);
  }
});
