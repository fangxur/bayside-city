import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CitySimulation} from '../src/simulation.js';
import {MAP_SIZE_OPTIONS,mapSize} from '../src/grid.js';

test('new cities support standard, large and extra-large maps all the way to their far edge',()=>{
  assert.deepEqual(MAP_SIZE_OPTIONS.map(option=>option.size),[64,80,96]);
  assert.deepEqual(MAP_SIZE_OPTIONS.map(option=>option.populationEstimate),['预估约 6 万人','预估约 6–10 万人','预估 10 万人以上']);
  for(const option of MAP_SIZE_OPTIONS){
    const sim=new CitySimulation({terrainPreset:'bayside',mapSize:option.size});
    assert.equal(sim.state.mapSize,option.size);
    assert.equal(sim.state.tiles.length,option.size**2);
    assert.equal(sim.tile(option.size-1,option.size-1).terrain,'land');
    const result=sim.build('park',[{x:option.size-1,y:option.size-1}],{});
    assert.equal(result.ok,true);
    assert.equal(sim.tile(option.size-1,option.size-1).buildingId,1);
    if(option.size>64)assert(sim.state.buildings[0].coverageCells.some(index=>index>=64**2));
  }
});

test('roads connect and simulate beyond the former 64-cell edge',()=>{
  const sim=new CitySimulation({terrainPreset:'bayside',mapSize:96});
  assert.equal(sim.build('bridge',[{x:59,y:32}],{}).ok,true);
  assert.equal(sim.build('road',Array.from({length:47},(_,index)=>({x:index+8,y:32})),{}).ok,true);
  assert.equal(sim.build('road',Array.from({length:32},(_,index)=>({x:index+64,y:32})),{}).ok,true);
  assert.equal(sim.tile(95,32).road,1);
  assert.equal(sim.tile(95,32).connected,true);
});

test('large map dimensions and far-edge construction survive an exact save round trip',()=>{
  const sim=new CitySimulation({terrainPreset:'newYork',mapSize:96});
  const cell=sim.state.tiles.find(tile=>tile.x>=90&&tile.y>=70&&tile.terrain==='land');
  assert(cell,'the expanded map should contain buildable land beyond the old 64-cell boundary');
  assert.equal(sim.build('park',[cell],{}).ok,true);
  const restored=CitySimulation.deserialize(sim.serialize());
  assert.equal(restored.state.mapSize,96);
  assert.equal(restored.state.tiles.length,96**2);
  assert(restored.tile(cell.x,cell.y).buildingId);
  assert.equal(restored.state.buildings[0].x,cell.x);
  assert.equal(restored.state.buildings[0].y,cell.y);
});

test('legacy saves remain standard maps and unsupported dimensions are rejected',()=>{
  const standard=new CitySimulation();
  const legacy=JSON.parse(standard.serialize());
  delete legacy.mapSize;
  const restored=CitySimulation.deserialize(JSON.stringify(legacy));
  assert.equal(mapSize(restored.state),64);
  assert.throws(()=>new CitySimulation({mapSize:72}),/未知地图尺寸/);
});

test('new-city setup exposes every selectable map size',async()=>{
  const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/城市规模/);
  assert.match(source,/MAP_SIZE_OPTIONS\.map/);
  assert.match(source,/mapSize:selectedMapSize/);
});
