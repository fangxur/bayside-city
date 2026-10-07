import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingCells} from '../src/building-footprint.js';
test('city hall occupies four cells, connects on the far edge and supports whole-building actions',()=>{
 const s=new CitySimulation(),spot={x:3,y:30},money=s.state.money;
 assert.equal(s.preview('cityHall',[spot]).cells.length,4);
 assert(s.build('cityHall',[spot]).ok);assert.equal(s.state.money,money-3000);
 const hall=s.state.buildings.find(b=>b.type==='cityHall');assert.equal(hall.footprint,2);assert(hall.connected);
 for(const c of buildingCells(hall))assert.equal(s.tile(c.x,c.y).buildingId,hall.id);
 assert(!s.preview('cityHall',[{x:10,y:30}]).valid);
 assert(s.moveBuilding(hall.id,{x:4,y:30}).ok);
 assert.equal(s.tile(3,30).buildingId,null);assert.equal(s.getInfo(5,31).buildingId,hall.id);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.buildings.find(b=>b.id===hall.id).footprint,2);
 assert(copy.build('bulldoze',[{x:5,y:31}]).ok);assert.equal(copy.state.buildings.length,0);
 copy.undo();assert.equal(copy.tile(5,31).buildingId,hall.id);
});
test('city hall refuses road overlap, occupied land and incomplete map footprints atomically',()=>{
 const s=new CitySimulation();
 for(const c of [{x:3,y:31},{x:63,y:30},{x:3,y:63}]){
  const before=s.serialize();assert(!s.build('cityHall',[c]).ok);assert.equal(s.serialize(),before);
 }
 s.build('park',[{x:4,y:30}]);assert(!s.preview('cityHall',[{x:3,y:30}]).valid);
});
test('legacy single-cell city hall keeps its footprint and neighboring tiles',()=>{
 const s=new CitySimulation();s.build('cityHall',[{x:3,y:30}]);
 const raw=JSON.parse(s.serialize()),hall=raw.buildings.find(b=>b.type==='cityHall');
 delete hall.footprint;
 for(const t of raw.tiles)if(t.buildingId===hall.id&&(t.x!==hall.x||t.y!==hall.y))t.buildingId=null;
 raw.tiles[30*64+4].road=1;
 const copy=CitySimulation.deserialize(JSON.stringify(raw));
 assert.equal(buildingCells(copy.state.buildings[0]).length,1);assert.equal(copy.tile(4,30).road,1);
 assert.equal(CitySimulation.deserialize(copy.serialize()).tile(4,30).road,1);
});
