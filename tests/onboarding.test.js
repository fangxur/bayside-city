import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {getOnboarding,onboardingProgress} from '../src/onboarding.js';
import {OnboardingOverlay} from '../src/onboarding-rendering.js';
import {TERRAIN_PRESETS} from '../src/terrain-presets.js';

function perform(sim,step){
  assert.equal(step.action.kind,'build');assert(step.action.target,JSON.stringify(step));
  const cells=step.action.tool==='road'?step.hint.cells:[step.action.target];
  assert(sim.preview(step.action.tool,cells).valid,step.id);
  assert(sim.build(step.action.tool,cells).ok,step.id);
}
function housing(){
  const sim=new CitySimulation();
  for(let i=0;i<4;i++)perform(sim,getOnboarding(sim));
  return sim;
}

test('every terrain completes the guide using genuinely buildable suggested sites and normal simulation',()=>{
  for(const terrainPreset of Object.keys(TERRAIN_PRESETS)){
    const sim=new CitySimulation({terrainPreset}),progress=onboardingProgress(null,{fresh:true}),seen=new Set();
    for(let i=0;i<100;i++){
      const before=sim.serialize(),step=getOnboarding(sim,progress);assert.equal(sim.serialize(),before,'guidance must be read only');seen.add(step.id);
      if(step.id==='complete')break;
      if(step.action.kind==='build')perform(sim,step);
      else if(step.waiting)sim.tick();
      else if(step.action.kind==='citizen')progress.metCitizen=true;
      else assert.fail(terrainPreset+': '+JSON.stringify(step));
    }
    assert.equal(getOnboarding(sim,progress).id,'complete',terrainPreset);
    for(const id of ['road','power','water','housing','arrival','work','shop','life'])assert(seen.has(id),terrainPreset+': '+id);
    assert(sim.state.stats.population>0);assert(sim.state.stats.jobs>0);
  }
});

test('isolated roads do not complete the entrance step and completion responds to demolition',()=>{
  const sim=new CitySimulation();
  sim.build('road',Array.from({length:8},(_,i)=>({x:15+i,y:20})));
  assert.equal(getOnboarding(sim).id,'road');assert.match(getOnboarding(sim).status,/0 \/ 6/);
  perform(sim,getOnboarding(sim));assert.equal(getOnboarding(sim).id,'power');
  sim.build('bulldoze',[{x:7,y:32}]);assert.equal(getOnboarding(sim).id,'road');
});

test('the first home distinguishes zoning, construction, arrival and actual utility blockers',()=>{
  const sim=housing();let step=getOnboarding(sim);
  assert.equal(step.id,'arrival');assert(step.waiting);assert.match(step.status,/等待开发商开工/);
  sim.tick();step=getOnboarding(sim);assert.equal(step.id,'arrival');assert(step.waiting);assert(step.progress>0&&step.progress<100);
  const water=sim.state.buildings.find(b=>b.type==='water');sim.setBuildingActive(water.id,false);
  step=getOnboarding(sim);assert.equal(step.id,'water');assert.equal(step.action.kind,'inspect');assert(!step.waiting);assert.match(step.status,/暂停/);
  assert.deepEqual(step.action.target,{x:water.x,y:water.y});
  sim.setBuildingActive(water.id,true);
  for(let i=0;i<8;i++)sim.tick();assert.equal(getOnboarding(sim).id,'work');
});

test('existing cities skip construction already completed; UI progress accepts only known values',()=>{
  const sim=new CitySimulation({demo:true});
  assert.equal(getOnboarding(sim).id,'life');
  assert.equal(getOnboarding(sim,{metCitizen:true}).id,'complete');
  assert.deepEqual(onboardingProgress({status:'malformed',metCitizen:'yes'}),{status:'skipped',metCitizen:false});
  const progress=onboardingProgress({status:'skipped',metCitizen:true},{fresh:true});
  assert.equal(progress.status,'skipped');assert(progress.metCitizen);
  assert.deepEqual(getOnboarding(CitySimulation.deserialize(sim.serialize()),progress),getOnboarding(sim,progress));
});

test('an empty city beyond the pioneer period is guided to jobs instead of waiting forever',()=>{
  const sim=housing();sim.state.tick=100;
  for(let i=0;i<8;i++)sim.tick();
  const step=getOnboarding(sim);assert.equal(step.id,'arrival');assert(!step.waiting);assert.equal(step.action.tool,'foodFactory');assert.match(step.description,/等待工作机会/);
  perform(sim,step);assert(getOnboarding(sim).waiting);
  for(let i=0;i<9;i++)sim.tick();assert(sim.state.stats.population>0);assert.notEqual(getOnboarding(sim).id,'arrival');
});

test('map recommendations reuse geometry, dispose on changes and never alter the city',()=>{
  const sim=new CitySimulation(),step=getOnboarding(sim),scene=new THREE.Scene(),overlay=new OnboardingOverlay(scene);
  const before=sim.serialize();overlay.setHint(step.hint);assert.equal(overlay.group.children.length,6);
  const geometry=overlay.geometry;let disposed=false;geometry.addEventListener('dispose',()=>disposed=true);
  overlay.setHint(step.hint);assert.equal(overlay.geometry,geometry);
  assert([...geometry.getAttribute('position').array].every(Number.isFinite));
  overlay.setHint(null);assert(disposed);assert.equal(overlay.group.children.length,0);assert.equal(sim.serialize(),before);
  overlay.dispose();assert.equal(scene.children.length,0);
});

test('waiting automatically runs at triple speed and later stages keep running unless manually overridden',async()=>{
  const {onboardingClock}=await import('../src/onboarding.js');
  const sim=new CitySimulation();
  assert.deepEqual(onboardingClock(getOnboarding(sim),{automatic:true}),{paused:true,speed:1});
  const waiting=getOnboarding(housing());assert(waiting.waiting);
  assert.deepEqual(onboardingClock(waiting,{automatic:true}),{paused:false,speed:3});
  assert.equal(onboardingClock(waiting,{automatic:false}),null);
  assert.equal(onboardingClock(waiting,{automatic:true,shared:true}),null);
  const city=housing();for(let i=0;i<8;i++)city.tick();
  const next=getOnboarding(city);assert.equal(next.id,'work');assert(!next.waiting);
  assert.deepEqual(onboardingClock(next,{automatic:true}),{paused:false,speed:3});
});

test('construction guidance reuses existing utilities and recommends a concrete single-cell home',()=>{
  const sim=new CitySimulation();perform(sim,getOnboarding(sim));perform(sim,getOnboarding(sim));
  assert.equal(sim.state.buildings.filter(b=>b.type==='power').length,1);
  const b=sim.state.buildings.find(b=>b.type==='power');sim.setBuildingActive(b.id,false);
  const step=getOnboarding(sim);assert.equal(step.action.kind,'inspect');assert.deepEqual(step.action.target,{x:b.x,y:b.y});
  sim.setBuildingActive(b.id,true);perform(sim,getOnboarding(sim));
  const home=getOnboarding(sim);assert.equal(home.action.tool,'nordic');assert.equal(home.hint.cells.length,1);
});
