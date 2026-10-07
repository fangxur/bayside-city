import test from 'node:test';
import assert from 'node:assert/strict';
import {workforceDashboard} from '../src/workforce-dashboard.js';
import {CitySimulation} from '../src/simulation.js';

const ready={progress:1,active:true,connected:true,powered:true,watered:true};

test('workforce dashboard lists core public professions and distinguishes positions from staff on duty',()=>{
  const state={buildings:[
    {type:'clinic',level:1,publicPayroll:24,...ready},
    {type:'hospital',level:2,publicPayroll:130,...ready},
    {type:'fireStation',level:1,publicPayroll:24,...ready},
    {type:'school',level:1,publicPayroll:20,...ready,active:false},
    {type:'cityHall',level:1,publicPayroll:16,...ready},
    {type:'park',level:1,publicPayroll:4,progress:1,active:true,connected:false,powered:true,watered:true},
  ],stats:{breakdown:{commercialIncome:0,industrialIncome:0,enterprisePayroll:0,publicPayroll:218}}};
  const report=workforceDashboard(state),publicSection=report.sections.find(section=>section.id==='public');
  const rows=Object.fromEntries(publicSection.rows.map(row=>[row.key,row]));
  assert.equal(rows.medical.places,2);assert.equal(rows.medical.workers,53);assert.equal(rows.medical.positions,53);
  assert.equal(rows.fire.workers,8);assert.equal(rows.education.workers,0);assert.equal(rows.education.positions,12);
  assert.equal(rows.government.workers,12);
  assert(publicSection.rows.some(row=>row.label==='医生与医护人员'));
  assert(publicSection.rows.some(row=>row.label==='消防员'));
  assert(publicSection.rows.some(row=>row.label==='教师与教职工'));
  assert(publicSection.rows.some(row=>row.label==='政府工作人员'));
  assert.equal(report.sections.find(section=>section.id==='entertainment').workers,2);
  assert.equal(report.summary.publicPayroll,218);
});

test('commercial and industrial rows preserve business kinds, actual staffing, taxes and both payroll sources',()=>{
  const state={buildings:[
    {type:'commercial',businessKind:'cafe',jobs:8,workers:6,taxContribution:25.2,monthlyPayroll:144,publicPayroll:0},
    {type:'commercial',businessKind:'cafe',jobs:8,workers:4,taxContribution:16.8,monthlyPayroll:96,publicPayroll:0},
    {type:'shoppingComplex',jobs:500,workers:120,taxContribution:504,monthlyPayroll:2880,publicPayroll:200},
    {type:'industrial',businessKind:'electronics',jobs:16,workers:12,taxContribution:36,monthlyPayroll:336,publicPayroll:0},
  ],stats:{breakdown:{commercialIncome:546,industrialIncome:36,enterprisePayroll:3456,publicPayroll:200}}};
  const report=workforceDashboard(state),commercial=report.sections.find(section=>section.id==='commercial'),industrial=report.sections.find(section=>section.id==='industrial');
  const cafe=commercial.rows.find(row=>row.key==='cafe'),complex=commercial.rows.find(row=>row.key==='shoppingComplex');
  assert.deepEqual({places:cafe.places,workers:cafe.workers,positions:cafe.positions,tax:cafe.tax,privatePayroll:cafe.privatePayroll},{places:2,workers:10,positions:16,tax:42,privatePayroll:240});
  assert.equal(complex.workers,120);assert.equal(complex.privatePayroll,2880);assert.equal(complex.publicPayroll,200);
  assert.equal(industrial.rows[0].label,'电子工厂');assert.equal(industrial.rows[0].tax,36);
  assert.equal(report.summary.privateWorkers,142);assert.equal(report.summary.businessTax,582);assert.equal(report.summary.enterprisePayroll,3456);
});

test('simulation exposes a live workforce report consistent with monthly finance totals',()=>{
  const simulation=new CitySimulation({demo:true}),report=simulation.state.stats.workforceReport,breakdown=simulation.state.stats.breakdown;
  assert(report.sections.find(section=>section.id==='commercial').rows.length>0);
  assert(report.sections.find(section=>section.id==='industrial').rows.length>0);
  assert.equal(report.summary.businessTax,breakdown.commercialIncome+breakdown.industrialIncome);
  assert.equal(report.summary.enterprisePayroll,breakdown.enterprisePayroll);
  assert.equal(report.summary.publicPayroll,breakdown.publicPayroll);
  const copy=CitySimulation.deserialize(simulation.serialize());
  assert.deepEqual(copy.state.stats.workforceReport,report);
});
