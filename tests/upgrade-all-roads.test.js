import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';

test('bulk upgrade reaches the highest unlocked tier and charges every intermediate step, including bridges',()=>{
 const s=new CitySimulation();s.state.money=100000;s.state.roadLevelUnlocked=4;
 s.tile(1,32).road=2;s.tile(2,32).road=3;s.tile(3,32).bridge=true;
 const originals=s.state.tiles.filter(t=>t.road).map(t=>({...t})),before=s.serialize(),money=s.state.money;
 const quote=s.previewUpgradeAllRoads();assert.equal(s.serialize(),before);assert.equal(quote.targetLevel,4);
 const expected=originals.reduce((sum,t)=>sum+({1:215,2:185,3:120}[t.road]),0);assert.equal(quote.cost,expected);
 assert(s.upgradeAllRoads().ok);assert.equal(s.state.money,money-expected);assert(s.state.tiles.filter(t=>t.road).every(t=>t.road===4));assert(s.tile(3,32).bridge);
 assert(!s.upgradeAllRoads().ok);assert(s.undo().ok);assert.equal(s.serialize(),before);
});
test('insufficient funds and locked stages do not partially upgrade or charge money',()=>{
 const s=new CitySimulation();let before=s.serialize();assert(!s.upgradeAllRoads().ok);assert.equal(s.serialize(),before);
 s.state.roadLevelUnlocked=7;s.state.money=1;before=s.serialize();
 assert.equal(s.previewUpgradeAllRoads().targetLevel,7);assert(!s.upgradeAllRoads().ok);assert.equal(s.serialize(),before);
 s.state.money=s.previewUpgradeAllRoads().cost;assert(s.upgradeAllRoads().ok);assert.equal(s.state.money,0);assert(s.state.tiles.filter(t=>t.road).every(t=>t.road===7));
 const copy=CitySimulation.deserialize(s.serialize());assert(copy.state.tiles.filter(t=>t.road).every(t=>t.road===7));
});
test('bulk upgrades skip high level roads and never modify buildings or empty tiles',()=>{
 const s=new CitySimulation({demo:true});s.state.money=100000;s.state.roadLevelUnlocked=2;s.tile(1,32).road=7;
 const buildings=JSON.stringify(s.state.buildings.map(b=>[b.id,b.type,b.level,b.x,b.y])),count=s.state.tiles.filter(t=>t.road).length;
 assert(s.upgradeAllRoads().ok);assert.equal(s.tile(1,32).road,7);assert.equal(s.state.tiles.filter(t=>t.road).length,count);
 assert.equal(JSON.stringify(s.state.buildings.map(b=>[b.id,b.type,b.level,b.x,b.y])),buildings);
});
