import test from 'node:test';
import assert from 'node:assert/strict';
import {privateBuildingGroups} from '../src/city-layout.js';
import {CitySimulation} from '../src/simulation.js';
const row=(n,vertical=false)=>Array.from({length:n},(_,i)=>({id:i+1,x:10+(vertical?0:i),y:20+(vertical?i:0),type:'industrial',businessKind:'workshop',level:2,progress:1}));
const roads=bs=>bs.map(b=>({x:b.x,y:b.y+1,road:1}));
test('upgraded factories form pairs or triples; buildings form deterministic rows in both orientations',()=>{
 for(const n of [2,3,4,5,6,7])for(const vertical of [false,true]){
  const bs=row(n,vertical),ts=vertical?bs.map(b=>({x:b.x+1,y:b.y,road:1})):roads(bs);
  const groups=privateBuildingGroups(bs,ts),reversed=privateBuildingGroups([...bs].reverse(),ts);
  assert.equal(groups.size,n);
  for(const b of bs){const g=groups.get(b.id);if(!g){assert.equal(reversed.get(b.id),undefined);continue;}assert([2,3].includes(g.members.length));assert.deepEqual(g,reversed.get(b.id));assert.equal(g.dx,vertical?0:1);}
 }
});
test('rows do not join different levels, business kinds, facing streets, diagonals or unfinished buildings',()=>{
 for(const patch of [{level:1},{level:3},{type:'commercial'},{businessKind:'logistics'},{progress:.99},{x:12},{x:11,y:21}]){
  const bs=row(2);Object.assign(bs[1],patch);assert.equal(privateBuildingGroups(bs,roads(bs)).size,0);
 }
 const bs=row(2);assert.equal(privateBuildingGroups(bs,[{x:10,y:21,road:1},{x:11,y:19,road:1}]).size,0);
});
test('row appearance follows upgrades and dissolves after a move, while individual saves remain intact',()=>{
 const s=new CitySimulation();
 for(let x=10;x<=12;x++){s.tile(x,21).road=1;s.tile(x,20).businessKind='workshop';s._newBuilding(x,20,'industrial',true);}
 const buildings=s.state.buildings.filter(b=>b.type==='industrial');
 assert.equal(privateBuildingGroups(buildings,s.state.tiles).size,0);
 s.state.milestones.density=true;
 for(const b of buildings){assert(s.build('upgrade',[b]).ok);b.progress=1;}
 assert.equal(privateBuildingGroups(buildings,s.state.tiles).get(buildings[0].id).members.length,3);
 const copy=CitySimulation.deserialize(s.serialize());
 assert.equal(privateBuildingGroups(copy.state.buildings,copy.state.tiles).size,3);
 copy.tile(18,21).road=1;copy.recalculate();
 assert(copy.moveBuilding(buildings[1].id,{x:18,y:20}).ok);
 assert.equal(privateBuildingGroups(copy.state.buildings,copy.state.tiles).size,0);
 copy.undo();assert.equal(privateBuildingGroups(copy.state.buildings,copy.state.tiles).size,3);
});

test('homes and shops keep separate one-cell models at every level and after rotation',()=>{
 for(const type of ['residential','commercial'])for(const level of [1,2,3,4,5,6]){
  const bs=row(4).map(b=>({...b,type,level,businessKind:type==='residential'?'courtyard':'market'}));
  assert.equal(privateBuildingGroups(bs,roads(bs)).size,0);
  bs[0].rotation=1;assert.equal(privateBuildingGroups(bs,roads(bs)).size,0);
 }
});
