import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';
import { LANDMARKS } from '../src/landmarks.js';
test('landmarks unlock by stage, charge correctly, enforce uniqueness and survive saves and moves',()=>{
 const s=new CitySimulation();s.state.money=1000000;
 let i=0;
 for(const [type,item] of Object.entries(LANDMARKS)){
  const pos={x:8+(i%5)*4,y:12+Math.floor(i/5)*12};i++;
  assert.equal(s.preview(type,[pos]).valid,false);
  s.state.milestones[item.gate]=true;
  s.tile(pos.x,pos.y-1).road=1;s.tile(pos.x,pos.y+3).road=1;s.recalculate();
  const money=s.state.money;
  assert.equal(s.build(type,[pos]).ok,true);
  assert.equal(s.state.money,money-item.cost);
  assert.equal(s.preview(type,[{x:20,y:31}]).valid,false);
  const b=s.state.buildings.find(b=>b.type===type);assert.equal(s.getInfo(b.x,b.y).title,item.name);
  assert.equal(s.moveBuilding(b.id,{x:b.x,y:b.y+4}).ok,true);
  s.state.milestones[item.gate]=false;
 }
 const copy=CitySimulation.deserialize(s.serialize());
 assert.equal(copy.state.buildings.length,Object.keys(LANDMARKS).length);
 for(const b of copy.state.buildings)assert(LANDMARKS[b.type]);
});
test('new landmarks provide amenity only when connected and active',()=>{
 const s=new CitySimulation();s.state.milestones.bridge=true;
 s.build('lighthouse',[{x:7,y:31}]);const b=s.state.buildings[0];b.progress=1;s.recalculate();
 assert(s.tile(7,30).amenity>0);
 b.active=false;s.recalculate();assert.equal(s.tile(7,30).amenity,0);
});
test('large world landmarks enforce gates and uniqueness before footprint placement, occupy the full site and undo cleanly',()=>{
 for(const [type,item] of Object.entries(LANDMARKS).filter(([,item])=>item.footprint)){
  const s=new CitySimulation();s.state.money=200000;const pos={x:8,y:32-item.footprint};
  s.tile(8,32).road=1;s.recalculate();
  const before=s.serialize();assert(!s.build(type,[pos]).ok);assert.equal(s.serialize(),before);
  s.state.milestones[item.gate]=true;assert.equal(s.preview(type,[pos]).cells.length,item.footprint**2);assert(s.build(type,[pos]).ok);
  const b=s.state.buildings[0];assert.equal(s.state.tiles.filter(t=>t.buildingId===b.id).length,item.footprint**2);
  assert(!s.build(type,[{x:15,y:32-item.footprint}]).ok);
  const saved=s.serialize(),funds=s.state.money;
  assert(s.build('bulldoze',[{x:b.x+item.footprint-1,y:31}]).ok);assert.equal(s.state.money,funds+Math.floor(item.cost*.2));s.undo();assert.equal(s.serialize(),saved);
  const malformed=JSON.parse(saved);malformed.buildings[0].footprint=1;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(malformed)));
 }
});

test('every major population stage unlocks landmarks and the growth guide lists them',()=>{
 const s=new CitySimulation();
 for(const stage of s.getGrowthStages()){
  const landmarks=Object.values(LANDMARKS).filter(item=>item.population===stage.population);
  assert(landmarks.length>0,stage.population);
  for(const item of landmarks){assert(stage.reward.includes(item.name));assert.equal(item.gate,stage.milestone==='completed'?'landmark':stage.milestone);}
 }
 assert.equal(LANDMARKS.lighthouse.population,500);assert.equal(LANDMARKS.museum.population,1000);
});

test('landmark renovations require population, city development and mayor honor, keep prior points, and persist',async()=>{
 const {upgradeOffer}=await import('../src/progression.js');
 const {landmarkHonor,landmarkUpgradePlan}=await import('../src/landmarks.js');
 const {executeCityCommand}=await import('../src/city-commands.js');
 const {buildingCells}=await import('../src/building-footprint.js');
 for(const type of Object.keys(LANDMARKS)){
  const s=new CitySimulation();s.state.money=1000000;
  for(let x=0;x<25;x++)s.tile(x,32).road=1;
  s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
  s.state.milestones[LANDMARKS[type].gate]=true;
  const size=LANDMARKS[type].footprint||1;assert(s.build(type,[{x:8,y:32-size}]).ok);
  let b=s.state.buildings.at(-1);const cells=buildingCells(b);
  assert(!upgradeOffer(b,s.state).allowed);
  for(const key of ['density','completed','metropolis','capital','regional','mature','civic','global'])s.state.milestones[key]=true;
  for(let level=2;level<=3;level++){
   const plan=landmarkUpgradePlan(b);
   s.state.stats.population=plan.population-1;assert(!s.preview('upgrade',[b]).valid);
   s.state.stats.population=130000;
   s.state.milestones[plan.milestone]=false;assert(!s.preview('upgrade',[b]).valid);
   s.state.milestones[plan.milestone]=true;
   b.active=false;assert(!s.preview('upgrade',[b]).valid);b.active=true;
   assert(s.preview('upgrade',[b]).valid,type);
   const funds=s.state.money,points=landmarkHonor(b),before=s.serialize();
   s.state.money=plan.cost-1;const poor=s.serialize();assert(!s.build('upgrade',[b]).ok);assert.equal(s.serialize(),poor);s.state.money=funds;
   assert(executeCityCommand(s,'build',['upgrade',cells,{}]).ok);
   assert.equal(s.state.money,funds-plan.cost);assert.equal(b.level,level);assert.equal(b.progress,.6);
   assert.equal(landmarkHonor(b),points);assert.deepEqual(buildingCells(b),cells);
   assert.match(s.getInfo(b.x,b.y).subtitle,/名胜等级/);
   assert(s.undo().ok);assert.equal(s.serialize(),before);
   const current=s.state.buildings.find(v=>v.id===b.id);s.state.stats.population=130000;
   assert(s.build('upgrade',[current]).ok);
   const copy=CitySimulation.deserialize(s.serializeCompact());
   for(const sim of [s,copy]){
    const saved=sim.state.buildings.find(v=>v.id===b.id);assert.equal(landmarkHonor(saved),points);
    sim.setBuildingActive(saved.id,false);sim.tick();assert.equal(saved.progress,.6);
    sim.setBuildingActive(saved.id,true);sim.tick();sim.tick();
    assert.equal(saved.progress,1);assert.equal(landmarkHonor(saved),level*2);
    assert.equal(saved.coverageDescription,`半径 ${8+(level-1)*2} 格`);
    assert.equal(CitySimulation.deserialize(sim.serialize()).state.buildings.find(v=>v.id===b.id).level,level);
   }
   // undo replaces object identities; keep the next loop's reference current.
   b=s.state.buildings.find(v=>v.id===b.id);
  }
  const saved=s.state.buildings.find(v=>v.id===b.id);assert(!s.preview('upgrade',[saved]).valid);
  const corrupt=JSON.parse(s.serialize());corrupt.buildings.find(v=>v.id===b.id).level=4;
  assert.throws(()=>CitySimulation.deserialize(JSON.stringify(corrupt)));
 }
});

test('low honor cannot be bypassed by population and a manually opened city stage',async()=>{
 const {upgradeOffer}=await import('../src/progression.js');
 const b={type:'lighthouse',level:2,progress:1,active:true,connected:true,powered:true,watered:true};
 const state={stats:{population:50000,happiness:0,employmentRate:0,income:0,expenses:100},milestones:{global:true},buildings:[b]};
 const offer=upgradeOffer(b,state);assert(!offer.allowed);
 assert(offer.requirements.some(r=>r.label.includes('荣誉')&&!r.met));
});
