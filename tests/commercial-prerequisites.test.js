import {newBuildingFootprint} from '../src/building-footprint.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {COMMERCIAL_FACTORIES,availableCommercialKinds} from '../src/commercial-prerequisites.js';
import {addFactoryPrerequisites} from './factory-fixture.js';

test('daily-service shops use their matching industrial suppliers',()=>{
 assert.deepEqual(Object.fromEntries(['pharmacy','repairGarage','laundry','hardware'].map(kind=>[kind,COMMERCIAL_FACTORIES[kind]])),{
  pharmacy:'pharmaceutical',repairGarage:'carFactory',laundry:'textile',hardware:'machinery',
 });
});

test('every commercial type requires its specific functioning factory and blocked builds cost nothing',()=>{
 for(const [kind,factory]of Object.entries(COMMERCIAL_FACTORIES)){
  const s=new CitySimulation(),cells=[{x:10,y:32-newBuildingFootprint(kind)}],before=s.serialize();
  assert(!s.preview(kind,cells).valid);assert(!s.build(kind,cells).ok);assert.equal(s.serialize(),before);
  addFactoryPrerequisites(s,[factory]);assert(s.preview(kind,cells).valid,kind);
  const supplier=s.state.buildings.find(b=>b.businessKind===factory);
  for(const field of ['active','connected','powered','watered','progress']){
   const previous=supplier[field];supplier[field]=field==='progress'?.5:false;
   assert(!s.preview(kind,cells).valid,`${kind}: ${field}`);supplier[field]=previous;
  }
  const other=Object.values(COMMERCIAL_FACTORIES).find(k=>k!==factory);supplier.businessKind=other;
  assert(!s.preview(kind,cells).valid);
 }
});
test('mixed commercial zoning only develops unlocked types and empty parcels explain missing factories',()=>{
 const s=new CitySimulation();assert(!s.preview('commercial',[{x:10,y:31}]).valid);
 addFactoryPrerequisites(s,['brewery']);assert.deepEqual(availableCommercialKinds(s.state),['tavern','izakaya']);
 for(let i=0;i<4;i++){s.tile(10+i,31).zone='commercial';const b=s._newBuilding(10+i,31,'commercial',true);assert(['tavern','izakaya'].includes(b.businessKind));}
 for(let x=8;x<=16;x++)s.tile(x,32).road=1;
 s.recalculate();assert(s.build('tavern',[{x:15,y:31}]).ok);
 s.state.buildings.find(b=>b.businessKind==='brewery').active=false;s.recalculate();
 assert.match(s.getInfo(15,31).problem,/精酿/);
 for(let i=0;i<4;i++)s.tick();assert.equal(s.tile(15,31).buildingId,null);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.filter(b=>b.type==='commercial').length,4);
});
test('a previously zoned shop waits for its supplier and resumes development when service returns',()=>{
 const s=addFactoryPrerequisites(new CitySimulation(),['brewery']);
 for(let x=8;x<=10;x++)s.tile(x,32).road=1;
 s.recalculate();assert(s.build('tavern',[{x:10,y:31}]).ok);
 const supplier=s.state.buildings.find(b=>b.businessKind==='brewery');
 supplier.active=false;s.recalculate();
 assert(s.state.stats.demand.commercial>=12);assert(s.tile(10,31).powered&&s.tile(10,31).watered);
 s.tick();assert.equal(s.tile(10,31).buildingId,null);
 supplier.active=true;s.recalculate();s.tick();
 assert.notEqual(s.tile(10,31).buildingId,null);
 assert.equal(s.state.buildings.find(b=>b.id===s.tile(10,31).buildingId).businessKind,'tavern');
});

test('supply details favor operating factories and explain each missing condition without mutating the city',async()=>{
 const {commercialSupply}=await import('../src/commercial-prerequisites.js');
 const s=new CitySimulation();addFactoryPrerequisites(s,['brewery']);
 const supplier=s.state.buildings.find(b=>b.businessKind==='brewery');
 const shop={businessKind:'tavern',x:10,y:31};
 const before=s.serialize();assert.equal(commercialSupply(s.state,shop).suppliers[0].ready,true);assert.equal(s.serialize(),before);
 supplier.powered=false;supplier.watered=false;
 const supply=commercialSupply(s.state,shop);assert.equal(supply.required,'brewery');assert.equal(supply.suppliers[0].ready,false);assert.match(supply.suppliers[0].status,/缺电、缺水/);
 s.state.buildings=s.state.buildings.filter(b=>b.id!==supplier.id);
 assert.equal(commercialSupply(s.state,shop).suppliers.length,0);
});
