import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingCapacity} from '../src/progression.js';
import {CITY_INCIDENT_TYPES,incidentRisks,createCityIncident,advanceCityIncidents} from '../src/city-incidents.js';

const run=(sim,ticks)=>{for(let i=0;i<ticks;i++)sim.tick();};
const home=sim=>sim.state.buildings.find(b=>b.type==='residential'&&b.population>0);

test('real unemployment and missing services expose matching city incident risks',()=>{
  const jobs=new CitySimulation({demo:true});
  for(const b of jobs.state.buildings.filter(b=>['commercial','industrial'].includes(b.type)))b.active=false;
  jobs.recalculate();
  const crime=incidentRisks(jobs.state).find(r=>r.kind==='robbery');
  assert(crime);assert.match(crime.reason,/失业率/);assert(crime.probability>=.65);

  const services=new CitySimulation({demo:true});
  for(const b of services.state.buildings.filter(b=>b.type==='residential')){b.level=2;b.population=Math.min(16,buildingCapacity(b));}
  services.recalculate();
  const risks=new Map(incidentRisks(services.state).map(r=>[r.kind,r]));
  for(const kind of ['fire','medical','education']){assert(risks.has(kind),kind);assert(risks.get(kind).probability>=.7);}
  const started=advanceCityIncidents(services.state);assert(started);assert(risks.has(started.kind));
});

test('fire has visible mechanical consequences for happiness, jobs, demand and move-in willingness',()=>{
  const residential=new CitySimulation({demo:true}),target=home(residential),before=target.happiness,demand=residential.state.stats.demand.residential;
  assert(createCityIncident(residential.state,'fire',target.id));residential.recalculate();
  assert(target.happiness<=before-CITY_INCIDENT_TYPES.fire.happinessPenalty);
  assert(target.moveInBlocked);assert(target.moveInWillingness<target.happiness);
  assert.equal(residential.state.stats.incidentDemandPenalty,CITY_INCIDENT_TYPES.fire.demandPenalty);
  assert(residential.state.stats.demand.residential<demand);
  const alert=residential.state.stats.alerts[0];assert.equal(alert.incidentId,residential.state.cityIncidents.active[0].id);assert.deepEqual([alert.x,alert.y],[target.x,target.y]);
  const info=residential.getInfo(target.x,target.y);assert(info.metrics.some(m=>m.label==='入住意愿'&&m.value.includes('暂停')));assert(info.metrics.some(m=>m.label==='当前风险事件'&&m.value.includes('建筑失火')));

  const firmCity=new CitySimulation({demo:true}),firm=firmCity.state.buildings.find(b=>b.type==='commercial'&&b.jobs>0),jobs=firm.jobs;
  assert(createCityIncident(firmCity.state,'fire',firm.id));firmCity.recalculate();
  assert(firm.jobs<jobs);assert.equal(firm.incidentEfficiency,CITY_INCIDENT_TYPES.fire.targetEfficiency);assert.match(firm.problem,/火灾/);
});

test('crime, medical, education, culture and sports events each reduce local satisfaction and willingness',()=>{
  for(const kind of ['robbery','medical','education','culture','wellness']){
    const sim=new CitySimulation({demo:true}),target=home(sim),before=target.happiness;
    assert(createCityIncident(sim.state,kind,target.id),kind);sim.recalculate();
    assert(target.happiness<before,kind);assert(target.moveInWillingness<target.happiness,kind);
    assert(target.incidentKinds.includes(kind));assert(sim.state.stats.alerts.some(a=>a.incidentId===sim.state.cityIncidents.active[0].id));
  }
});

test('a serious local incident pauses arrivals, expires into history and round-trips safely',()=>{
  const sim=new CitySimulation({demo:true}),target=home(sim),before=target.population,clean=CitySimulation.deserialize(sim.serialize());
  clean.tick();assert(clean.state.buildings.find(b=>b.id===target.id).population>before,'the same home normally attracts another resident');
  assert(createCityIncident(sim.state,'medical',target.id));sim.recalculate();sim.tick();assert.equal(target.population,before);
  const loaded=CitySimulation.deserialize(sim.serialize());assert.deepEqual(loaded.state.cityIncidents,sim.state.cityIncidents);
  run(loaded,29);
  assert(!loaded.state.cityIncidents.active.some(e=>e.kind==='medical'));
  assert(loaded.state.cityIncidents.history.some(e=>e.kind==='medical'&&e.status==='expired'));
});

test('incident save validation rejects fabricated kinds, timing, targets and duplicate IDs',()=>{
  const sim=new CitySimulation({demo:true}),target=home(sim);createCityIncident(sim.state,'fire',target.id);sim.recalculate();
  const mutations=[
    raw=>{raw.cityIncidents.active[0].kind='meteor';},
    raw=>{raw.cityIncidents.active[0].expiresMonth++;},
    raw=>{raw.cityIncidents.active[0].targetId=999999;},
    raw=>{raw.cityIncidents.active.push({...raw.cityIncidents.active[0]});},
    raw=>{raw.cityIncidents.history=new Array(25).fill(raw.cityIncidents.active[0]);},
  ];
  for(const mutate of mutations){const raw=JSON.parse(sim.serialize());mutate(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));}
  const legacy=JSON.parse(new CitySimulation({demo:true}).serialize());delete legacy.cityIncidents;
  assert.deepEqual(CitySimulation.deserialize(JSON.stringify(legacy)).state.cityIncidents,{active:[],history:[]});
});
