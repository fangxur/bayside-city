import test from 'node:test';
import assert from 'node:assert/strict';
import {newTerrainDraft,validateTerrainDraft,TerrainDraftEditor,terrainDraftSummary,protectedEntry} from '../src/terrain-draft.js';
import {CitySimulation} from '../src/simulation.js';
import {CoopStore} from '../server/coop-store.mjs';
import {MAP_SIZES} from '../src/grid.js';

const flat=size=>({...newTerrainDraft('bayside',size),cells:'g'.repeat(size**2)});
const stroke=(editor,tool,from,to=from,size=1)=>{editor.beginStroke(tool,size);editor.paint(...from);editor.paint(...to);editor.endStroke();};

test('map brushes join widely spaced pointer positions and undo a whole stroke without mutating their source',()=>{
 const source=flat(64),editor=new TerrainDraftEditor(source);stroke(editor,'water',[20,15],[40,25],3);
 for(let x=20;x<=40;x++)assert.equal(editor.cells[Math.round(15+(x-20)/2)*64+x],'w');
 assert.equal(editor.undoStack.length,1);assert.equal(source.cells,'g'.repeat(4096));
 const river=editor.snapshot();editor.undo();assert.equal(editor.snapshot().cells,source.cells);editor.redo();assert.deepEqual(editor.snapshot(),river);
 editor.undo();stroke(editor,'forest',[30,30]);assert.equal(editor.redoStack.length,0);assert.equal(editor.cells[30*64+30],'f');
});

test('forests and clearing respect water and every brush preserves the entrance foothold at every scale',()=>{
 for(const size of MAP_SIZES){
  const editor=new TerrainDraftEditor(flat(size));stroke(editor,'water',[0,32],[14,32],9);
  for(let y=28;y<=36;y++)for(let x=0;x<=10;x++)assert.equal(editor.cells[y*size+x],'g');
  stroke(editor,'forest',[14,32]);assert.equal(editor.cells[32*size+14],'w');
  stroke(editor,'clear',[14,32]);assert.equal(editor.cells[32*size+14],'w');
  stroke(editor,'land',[14,32]);stroke(editor,'forest',[14,32]);assert.equal(editor.cells[32*size+14],'f');
  stroke(editor,'clear',[14,32]);assert.equal(editor.cells[32*size+14],'g');
  stroke(editor,'forest',[7,31]);assert.equal(editor.cells[31*size+7],'g');assert.doesNotThrow(()=>validateTerrainDraft(editor.snapshot(),size));
 }
});

test('drafts reject malformed, mismatched and blocked-entry layouts before creating a city',()=>{
 const source=flat(64);
 for(const bad of [null,{...source,mapSize:65},{...source,cells:'g'},{...source,cells:'g'.repeat(4095)+'?'},{...source,terrainPreset:'unknown'},{...source,cells:'w'.repeat(4096)},{...source,format:'other'}]){
  assert.throws(()=>validateTerrainDraft(bad));assert.throws(()=>new CitySimulation({terrainDraft:bad}));
 }
 assert.throws(()=>validateTerrainDraft(source,80));assert.throws(()=>new CitySimulation({mapSize:80,terrainDraft:source}));
 assert.throws(()=>new TerrainDraftEditor(source).beginStroke('toString'));assert.throws(()=>new TerrainDraftEditor(source).beginStroke('water',2));
});

test('template replacement and a blank plain are reversible with truthful area summaries',()=>{
 const editor=new TerrainDraftEditor(newTerrainDraft('paris',80)),original=editor.snapshot();
 editor.replace(newTerrainDraft('hongKong',80));assert.equal(editor.snapshot().terrainPreset,'hongKong');assert(terrainDraftSummary(editor.snapshot()).water>0);
 editor.replace(flat(80));assert.equal(terrainDraftSummary(editor.snapshot()).landPercent,100);editor.undo();assert.equal(editor.snapshot().terrainPreset,'hongKong');editor.undo();assert.deepEqual(editor.snapshot(),original);
});

test('custom maps create fresh cities, build from the protected entry and preserve vegetation in both save formats',()=>{
 for(const size of MAP_SIZES){
  const editor=new TerrainDraftEditor(flat(size));stroke(editor,'water',[size-20,20],[size-20,size-10],3);stroke(editor,'forest',[20,20],[30,20],5);
  const draft=editor.snapshot(),city=new CitySimulation({mapSize:size,terrainDraft:draft});
  assert.equal(city.state.customTerrain,true);assert.equal(city.state.money,30000);assert.equal(city.state.buildings.length,0);
  assert.equal(city.tile(20,20).vegetation,1);assert.equal(city.tile(18,20).vegetation,1);assert.equal(city.tile(size-20,30).terrain,'water');
  assert.equal(city.build('road',[{x:8,y:32},{x:9,y:32},{x:10,y:32}]).ok,true);assert.equal(city.build('power',[{x:9,y:31}]).ok,true);
  assert.equal(city.build('park',[{x:20,y:20}]).ok,true,'forest land remains buildable');
  for(const save of [city.serialize(),city.serializeCompact()]){
   const loaded=CitySimulation.deserialize(save);assert.deepEqual(JSON.parse(loaded.serialize()),JSON.parse(city.serialize()));assert.equal(loaded.tile(20,20).vegetation,1);assert.equal(loaded.tile(10,30).vegetation,0);
  }
 }
});

test('legacy natural vegetation stays unchanged and invalid saved vegetation is rejected',()=>{
 const city=new CitySimulation(),saved=city.serialize();assert(!JSON.parse(saved).tiles.some(tile=>'vegetation' in tile));assert.equal(CitySimulation.deserialize(saved).serialize(),saved);
 for(const value of [2,-1,'forest',null]){const raw=JSON.parse(saved);raw.tiles[0].vegetation=value;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));}
 const raw=JSON.parse(saved),water=raw.tiles.find(tile=>tile.terrain==='water');water.vegetation=1;assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
});

test('cooperative custom maps keep exact terrain and reject bad drafts atomically',t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const owner=store.session('地形设计师').actor,editor=new TerrainDraftEditor(flat(96));
 stroke(editor,'water',[60,5],[60,90],5);stroke(editor,'forest',[70,15],[85,25],5);
 const created=store.create(owner,{name:'手绘河湾',mapSize:96,terrainDraft:editor.snapshot(),cityGoal:'population'});
 const city=CitySimulation.deserialize(store.exportSnapshot(created.cityId,owner));assert.equal(city.state.customTerrain,true);
 for(const tile of city.state.tiles){const code=editor.cells[tile.y*96+tile.x];assert.equal(tile.terrain,code==='w'?'water':'land');if(code==='f')assert.equal(tile.vegetation,1);if(protectedEntry(tile.x,tile.y))assert.equal(tile.terrain,'land');}
 const count=store.list(owner).length;
 assert.throws(()=>store.create(owner,{name:'错误尺寸',mapSize:64,terrainDraft:editor.snapshot()}),/规模不一致/);
 assert.throws(()=>store.create(owner,{name:'重复数据',city:city.serialize(),terrainDraft:editor.snapshot()}),/不能同时/);
 assert.equal(store.list(owner).length,count);
});
