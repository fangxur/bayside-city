import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {cityEntrances,entranceRoadIndexes} from '../src/city-entrances.js';
import {CoopStore} from '../server/coop-store.mjs';

function empty(size=64){
  const sim=new CitySimulation({mapSize:size});
  for(const t of sim.state.tiles){t.terrain='land';t.road=0;}
  sim.tile(0,32).road=1;sim.state.money=100000;return sim;
}
const road=(s,x,y,level=1)=>{s.tile(x,y).road=level;};
function freightTown(){
  const s=empty();for(let x=0;x<63;x++)road(s,x,32,x?7:1);
  // Legal turn-around streets let vehicles reach both curb sides without using a gateway.
  for(let x=35;x<=39;x++)road(s,x,30,7);for(const x of [35,39])road(s,x,31,7);
  for(let x=56;x<=60;x++)road(s,x,34,7);for(const x of [56,60])road(s,x,33,7);
  s._newBuilding(8,31,'power',true).level=6;s._newBuilding(9,31,'water',true).level=6;
  for(let x=42;x<=54;x++){
    const h=s._newBuilding(x,31,'residential',true);h.level=6;h.population=300;
    s._newBuilding(x,33,'industrial',true).level=6;
  }
  s.recalculate();return s;
}

test('each land edge with an inward road is an external gateway, including on larger maps',()=>{
  for(const size of [64,80,96]){
    const s=empty(size),last=size-1;
    for(const [x,y]of [[last,20],[last-1,20],[20,0],[20,1],[20,last],[20,last-1],[0,20],[1,20]])road(s,x,y);
    s.recalculate();assert.equal(s.state.stats.entrances.length,5);
    for(const [x,y]of [[last-1,20],[20,1],[20,last-1],[1,20]])assert(s.tile(x,y).connected);
    if(size>64){road(s,63,8);road(s,62,8);s.recalculate();assert(!s.tile(63,8).connected,'old map edge is interior on a larger map');}
  }
});

test('wide gateways group adjacent lanes; corners never double-count a lane',()=>{
  const s=empty();for(let y=20;y<23;y++){road(s,63,y);road(s,62,y);}
  for(const [x,y]of [[0,0],[1,0],[0,1]])road(s,x,y);
  const ports=cityEntrances(s.state),east=ports.find(p=>p.side==='east');
  assert.equal(east.roadIndexes.length,3);
  const roots=entranceRoadIndexes(s.state);assert.equal(roots.length,new Set(roots).size);
  s.recalculate();assert.equal(s.state.stats.entrances.find(p=>p.side==='east').capacity,102);
});

test('isolated edge tiles, edge-parallel roads and water do not create gateways',()=>{
  const s=empty();for(let x=10;x<=12;x++)road(s,x,0);
  road(s,63,10);road(s,62,10);s.tile(63,10).terrain='water';
  s.recalculate();assert.equal(s.state.stats.entrances.length,1);
  assert(!s.tile(10,0).connected);assert(!s.tile(62,10).connected);
  road(s,11,1);s.recalculate();assert.equal(s.state.stats.entrances.length,2);assert(s.tile(10,0).connected);
});

test('removing a gateway or its inward road updates demolition connectivity preview',()=>{
  const s=empty();for(let x=60;x<64;x++)road(s,x,10);s.recalculate();
  assert(s.tile(60,10).connected);
  for(const removed of [new Set([10*64+63]),new Set([10*64+62])]){
    assert(!s._connectedRoads(removed).has(10*64+60));
    assert.equal(cityEntrances(s.state,{removed}).length,1);
  }
});

test('an additional edge road diverts actual freight and preserves demand, saves and undo',()=>{
  const s=freightTown(),before=s.serialize(),oldLoad=s.tile(0,32).trafficLoad;
  const freight=()=>s.state.routes.filter(r=>r.kind==='freight').reduce((sum,r)=>sum+r.load,0);
  const demand=freight(),employed=s.state.stats.employed;
  assert(oldLoad>100);assert(demand>0);assert.equal(s.state.stats.entrances.length,1);
  assert(s.build('road',[{x:63,y:32}]).ok);
  assert.equal(s.state.stats.entrances.length,2);
  assert(s.tile(0,32).trafficLoad<oldLoad);assert(s.tile(63,32).trafficLoad>0);
  assert.equal(Math.round(freight()*10),Math.round(demand*10));assert.equal(s.state.stats.employed,employed);
  assert.equal(s.getInfo(63,32).title,'城市对外入口');
  const sum=s.state.stats.entrances.reduce((sum,p)=>sum+p.freightLoad,0);assert(Math.abs(sum-demand)<.2);
  for(const data of [s.serialize(),s.serializeCompact()]){
    const restored=CitySimulation.deserialize(data);assert.deepEqual(restored.state.stats.entrances,s.state.stats.entrances);
    assert.deepEqual(restored.state.routes,s.state.routes);
  }
  assert(s.undo().ok);assert.equal(s.serialize(),before);
});

test('routing includes congestion at the entry itself and chooses a longer clear entrance',()=>{
  const s=empty();for(let x=0;x<64;x++)road(s,x,32);s.recalculate();
  s.tile(0,32).trafficLoad=1000;
  const path=s._path([32*64,32*64+63],[32*64+2],10,{includeStartCost:true});
  assert.equal(path[0],32*64+63);
  s.tile(0,32).road=7;s.tile(0,32).trafficCapacity=1000;
  const upgraded=s._path([32*64,32*64+63],[32*64+2],10,{includeStartCost:true});
  assert.equal(upgraded[0],32*64);
});

test('multiple boundary connections do not teleport internal commutes between road components',()=>{
  const s=empty();for(let x=0;x<5;x++)road(s,x,32);for(let x=59;x<64;x++)road(s,x,32);s.recalculate();
  assert(s.tile(3,32).connected);assert(s.tile(60,32).connected);
  assert.deepEqual(s._path([32*64+3],[32*64+60]),[]);
});

test('a large employer distributes deliveries over comparable gateways under congestion',()=>{
  const s=empty();for(let x=0;x<64;x++)road(s,x,32,x===0||x===63?1:7);
  for(let x=30;x<=39;x++)road(s,x,34,7);for(const x of [30,39])road(s,x,33,7);
  s._newBuilding(8,31,'power',true).level=6;s._newBuilding(9,31,'water',true).level=6;
  const h=s._newBuilding(31,31,'residential',true);h.level=6;h.population=1800;
  s._newBuilding(31,33,'industrial',true).level=6;
  s.recalculate();const used=s.state.stats.entrances.filter(p=>p.freightLoad>0);
  assert.equal(used.length,2);
  const deliveries=s.state.routes.filter(r=>r.kind==='freight');
  assert(deliveries.length>=2&&deliveries.length<=8,'batches use both gateways and may choose different return roads');
});

test('cooperative road commands derive the same gateways and freight redistribution',t=>{
  const store=new CoopStore(':memory:');t.after(()=>store.close());
  const actor=store.user(store.session('入口市长').token),sim=freightTown();
  const id=store.create(actor,{name:'多入口测试城',city:sim.serialize()}).cityId;
  const result=store.command(id,actor,{commandId:'new-east-entry',epoch:1,baseRevision:0,method:'build',args:['road',[{x:63,y:32}]]});
  assert(result.ok);const restored=CitySimulation.deserialize(JSON.stringify(store.view(id,actor).state));
  sim.build('road',[{x:63,y:32}]);assert.deepEqual(restored.state.stats.entrances,sim.state.stats.entrances);
  assert.deepEqual(restored.state.routes,sim.state.routes);
});
