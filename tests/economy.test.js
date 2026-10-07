import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation,TOOLS} from '../src/simulation.js';
import {ECONOMY_RULES,ZONE_ECONOMY,privateMaintenance,businessTaxPerWorker} from '../src/economy.js';
import {BUILDING_TIERS,buildingCapacity} from '../src/progression.js';
import {addFactoryPrerequisites} from './factory-fixture.js';

test('zoning charges the displayed development price exactly once and insufficient funds never partially build',()=>{
 for(const type of Object.keys(ZONE_ECONOMY)){
  const s=new CitySimulation(),cells=[{x:10,y:31},{x:11,y:31}];
  for(let x=8;x<=11;x++)s.tile(x,32).road=1;s.recalculate();
  if(type==='commercial')addFactoryPrerequisites(s);
  const maintenance=s.state.stats.breakdown.privateMaintenance;
  assert.equal(s.preview(type,cells).cost,TOOLS[type].cost*2);
  s.state.money=TOOLS[type].cost*2-1;const before=s.serialize();assert(!s.build(type,cells).ok);assert.equal(s.serialize(),before);
  s.state.money=10000;assert(s.build(type,cells).ok);assert.equal(s.state.money,10000-TOOLS[type].cost*2);
  assert(!s.build(type,cells).ok);assert.equal(s.state.stats.breakdown.privateMaintenance,maintenance,'empty zoning adds no building upkeep');
 }
});
test('vacant and disconnected buildings still incur upkeep, which increases faster than capacity at high levels',()=>{
 const s=new CitySimulation();
 for(const type of Object.keys(ZONE_ECONOMY)){
  const b=s._newBuilding(10+s.state.buildings.length,20,type,true);s.recalculate();
  assert.equal(s.state.stats.breakdown.districtMaintenance[type],ZONE_ECONOMY[type].maintenance[0]);
  b.level=6;s.recalculate();assert.equal(s.state.stats.breakdown.districtMaintenance[type],privateMaintenance(b));
  assert(privateMaintenance(b)/buildingCapacity(b)>ZONE_ECONOMY[type].maintenance[0]/BUILDING_TIERS[type].capacities[0]);
 }
 const total=Object.values(s.state.stats.breakdown.districtMaintenance).reduce((a,b)=>a+b,0);
 assert.equal(s.state.stats.expenses,Math.round(total+s.state.stats.breakdown.roadMaintenance));
 const money=s.state.money;s.tick();assert.equal(s.state.money,money,'upkeep settles at month end');
 const loaded=CitySimulation.deserialize(s.serialize());assert.equal(loaded.state.money,money);assert.equal(loaded.state.stats.expenses,s.state.stats.expenses);
});
test('an established starter city remains profitable but retains under half of the previous monthly surplus',()=>{
 const s=new CitySimulation({demo:true}),stats=s.state.stats;
 assert(stats.balance>0);assert(stats.balance<(stats.balance+stats.breakdown.privateMaintenance)*.5);
});

test('residents pay wage and service taxes while private employers fund wages outside the city budget',()=>{
 const s=new CitySimulation({demo:true}),b=s.state.stats.breakdown;
 assert.equal(b.residentialIncome,b.wageTax+b.residentServiceTax);
 assert.equal(b.wageTax,Math.round(b.enterprisePayroll*s.state.taxRate/100));
 assert(b.enterprisePayroll>b.residentialIncome,'private payroll is an economic flow, not city revenue');
 assert.equal(s.state.stats.income,b.residentialIncome+b.commercialIncome+b.industrialIncome);
 const income=s.state.stats.income,payroll=b.enterprisePayroll;
 s.setTax(15);
 assert.equal(s.state.stats.breakdown.enterprisePayroll,payroll,'tax changes do not rewrite private wages');
 assert(s.state.stats.income>income,'higher rates affect both household and business tax receipts');
});

test('business tax follows actual staffing and gains only modest productivity from upgrades',()=>{
 const s=new CitySimulation({demo:true}),factory=s.state.buildings.find(b=>b.type==='industrial'&&b.workers>0);
 assert(factory);
 assert.equal(Math.round(factory.taxContribution),Math.round(factory.workers*businessTaxPerWorker(factory)));
 const levelOne=businessTaxPerWorker(factory);factory.level=6;s.recalculate();
 assert(businessTaxPerWorker(factory)>levelOne);
 assert(businessTaxPerWorker(factory)<levelOne*1.3,'upgrades cannot multiply profit per employee without limit');
 factory.active=false;s.recalculate();assert.equal(factory.workers,0);assert.equal(factory.taxContribution,0);
});

test('public payroll is a real municipal expense and pausing facilities reduces it',()=>{
 const s=new CitySimulation({demo:true}),before=s.state.stats;
 assert.equal(before.breakdown.publicPayroll,Math.round(before.breakdown.facilityMaintenance*ECONOMY_RULES.publicPayrollRate));
 assert.equal(before.expenses,Math.round(before.breakdown.privateMaintenance+before.breakdown.roadMaintenance+before.breakdown.facilityMaintenance+before.breakdown.publicPayroll+before.breakdown.loanPayment));
 for(const b of s.state.buildings)if(!['residential','commercial','industrial'].includes(b.type))b.active=false;
 s.recalculate();assert(s.state.stats.breakdown.publicPayroll<before.breakdown.publicPayroll);
});
