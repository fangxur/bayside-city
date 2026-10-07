import test from 'node:test';
import assert from 'node:assert/strict';
import {TERRAIN_PRESETS,terrainAt,terrainPreview} from '../src/terrain-presets.js';
import {CitySimulation} from '../src/simulation.js';
test('eight distinct terrain presets have safe entry roads, buildable footholds and matching previews',()=>{
 const layouts=new Set();
 for(const id of Object.keys(TERRAIN_PRESETS)){
  const s=new CitySimulation({terrainPreset:id});const key=s.state.tiles.map(t=>t.terrain[0]).join('');layouts.add(key);
  assert.equal(s.state.buildings.length,0);assert.equal(s.state.money,30000);
  for(let x=0;x<=7;x++){assert.equal(s.tile(x,32).terrain,'land');assert(s.tile(x,32).road);}
  assert(s.preview('power',[{x:7,y:31}]).valid);assert(s.preview('water',[{x:6,y:31}]).valid);
  const water=s.state.tiles.filter(t=>t.terrain==='water').length;assert(water>100&&water<2500,`${id}: ${water}`);
  assert(terrainPreview(id).includes(TERRAIN_PRESETS[id].name));
  assert(s.state.tiles.every(t=>t.terrain===terrainAt(id,t.x,t.y)));
  const loaded=CitySimulation.deserialize(s.serialize());assert.equal(loaded.state.terrainPreset,id);assert.equal(loaded.serialize(),s.serialize());
  assert.equal(new CitySimulation({terrainPreset:id}).serialize(),s.serialize());
 }
 assert.equal(layouts.size,8);
});
test('legacy saves retain their exact terrain and unknown presets are rejected',()=>{
 const s=new CitySimulation();const old=JSON.parse(s.serialize());delete old.terrainPreset;
 const loaded=CitySimulation.deserialize(JSON.stringify(old));assert.equal(loaded.state.terrainPreset,'bayside');assert.deepEqual(loaded.state.tiles,s.state.tiles);
 old.terrainPreset='missing';assert.throws(()=>CitySimulation.deserialize(JSON.stringify(old)));assert.throws(()=>new CitySimulation({terrainPreset:'missing'}));
 assert.equal(new CitySimulation({demo:true,terrainPreset:'hongKong'}).state.terrainPreset,'bayside');
});
test('new terrain supports both north-south and east-west complete bridge crossings',()=>{
 for(const id of ['paris','london','newYork','guangzhou','shanghai','shenzhen','hongKong']){
  const s=new CitySimulation({terrainPreset:id});
  const found=s.state.tiles.filter(t=>t.terrain==='water').map(t=>({t,p:s.preview('bridge',[t])})).find(({p})=>p.valid);
  assert(found,`${id} has a suitable bridge span`);assert(s.build('bridge',[found.t]).ok);assert.doesNotThrow(()=>CitySimulation.deserialize(s.serialize()));
 }
 const s=new CitySimulation({terrainPreset:'london'});
 const water=s.tile(26,42);assert.equal(water.terrain,'water');const p=s.preview('bridge',[water]);assert(p.valid);assert(p.cells.every(c=>c.x===26));
});
