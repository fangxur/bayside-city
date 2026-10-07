import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CitySimulation} from '../src/simulation.js';
import {readCityImport} from '../src/city-import.js';
import {SoloLibrary} from '../src/solo-library.js';
import {CoopStore} from '../server/coop-store.mjs';

const file=text=>({size:Buffer.byteLength(text),text:async()=>text});
const source=()=>{const sim=new CitySimulation({mapSize:64,terrainPreset:'bayside'});sim.setCityIdentity({cityName:'导入测试城',mayorName:'原市长'});sim.build('laurelStatue',[{x:12,y:12}]);return sim;};
test('city imports accept native and compact exports and envelopes without copying ownership metadata',async()=>{
 const sim=source();
 for(const text of [sim.serialize(),sim.serializeCompact(),JSON.stringify({city:sim.serializeCompact(),name:'假的名称',accountCity:{id:'original',owner:'another-user'}})]){
  const imported=await readCityImport(file(text)),restored=CitySimulation.deserialize(imported.city);
  assert.equal(imported.name,'导入测试城');assert.equal(imported.mapSize,64);assert.equal(imported.buildings,1);
  assert.equal(restored.state.money,sim.state.money);assert.equal(restored.state.buildings[0].type,'laurelStatue');assert.deepEqual(restored.state.cityGoal,sim.state.cityGoal);
  assert(!Object.hasOwn(imported,'accountCity'));assert.equal(imported.mayorName,'原市长');
 }
});
test('invalid, oversized and corrupt imports fail before returning a city',async()=>{
 for(const text of ['broken JSON','{}',JSON.stringify({city:'{}'}),JSON.stringify({format:'bayside-identity-v1',token:'not-a-city'})])await assert.rejects(readCityImport(file(text)));
 await assert.rejects(readCityImport({size:8_000_001,text:()=>assert.fail('must reject before reading')}),/8 MB/);
 const state=JSON.parse(source().serialize());state.tiles.pop();await assert.rejects(readCityImport(file(JSON.stringify(state))),/损坏/);
});

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const handler=main.slice(main.indexOf('async function createImportedCity('),main.indexOf('const cityImport=setupCityImport('));
class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function fixture(loggedIn=false){
 const events=[],storage=new Storage(),coop={cityId:null,identity:loggedIn?{account:{username:'test'},actor:{id:'owner',name:'新市长'}}:null};
 const library=new SoloLibrary(coop,{storage});library.flush=async()=>{};
 const old={city:source().serializeCompact(),name:'原有城市'};let checkpoints=[old];
 const context={CitySimulation,coop,soloLibrary:library,started:true,paused:false,tutorialClock:true,speed:3,
  autosave:()=>{events.push('save-current');return true;},safeRead:()=>checkpoints,safeWrite:(key,items)=>{checkpoints=items;return true;},
  restoreSnapshot(item){events.push('open-import');context.restored=item;},renderer:{setSpeed(){},setPaused(){}},updateUI(){},refreshContinue(){},toast(){},closeDialog(){},enterCoop:async id=>{events.push('enter-coop');context.entered=id;},
 };
 vm.createContext(context);vm.runInContext(handler,context);return {context,library,storage,coop,events,old,checkpoints:()=>checkpoints};
}
test('guest import saves current progress first and opens a separate paused city with persisted import',async()=>{
 const f=fixture(),item=await readCityImport(file(source().serialize()));await f.context.createImportedCity(item,{name:'新的导入城'});
 assert.deepEqual(f.events,['save-current','open-import']);assert.equal(f.context.restored.name,'新的导入城');assert.equal(f.context.paused,true);assert.equal(f.context.speed,1);
 assert.equal(f.checkpoints()[1],f.old);assert.equal(f.checkpoints()[0].city,f.context.restored.city);assert(!f.context.restored.accountCity);
});
test('account imports receive a fresh city identity without overwriting an existing account city',async()=>{
 const f=fixture(true),old=f.library.create(f.old),before=JSON.stringify(old),item=await readCityImport(file(source().serialize()));
 item.accountCity={id:old.id,owner:'another-user'};await f.context.createImportedCity(item);
 const records=f.library.local();assert.equal(records.length,2);assert.equal(JSON.stringify(old),before);
 assert.notEqual(f.context.restored.accountCity.id,old.id);assert.equal(f.context.restored.accountCity.owner,'owner');assert.equal(f.context.restored.mayorName,'新市长');
});
test('read, current-save and persistence failures leave the current city open',async()=>{
 for(const reason of ['invalid','save','storage','guest-storage','shared']){
  const f=fixture(reason==='storage'),item=await readCityImport(file(source().serialize()));
  if(reason==='invalid')item.city='{}';if(reason==='save')f.context.autosave=()=>false;if(reason==='storage')f.storage.setItem=()=>{throw Error('full');};if(reason==='guest-storage')f.context.safeWrite=()=>false;if(reason==='shared')f.coop.cityId='current-coop';
  await assert.rejects(f.context.createImportedCity(item));assert(!f.events.includes('open-import'));assert.equal(f.context.restored,undefined);
 }
});
test('cooperative import creates a new owned city and preserves the imported map, buildings and goal',async t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const actor=store.session('新房主').actor;
 const f=fixture(true),item=await readCityImport(file(source().serialize())),existing=store.create(actor,{name:'原合作城'});
 f.coop.request=async(url,{body})=>{assert.equal(url,'/cities');return store.create(actor,body);};
 await f.context.createImportedCity(item,{kind:'cooperative',name:'从文件创建'});
 assert.notEqual(f.context.entered,existing.cityId);assert.equal(store.list(actor).length,2);
 const created=CitySimulation.deserialize(store.exportSnapshot(f.context.entered,actor));assert.equal(created.state.districtName,'从文件创建');assert.equal(created.state.buildings[0].type,'laurelStatue');assert.equal(created.state.mapSize,item.mapSize);assert.deepEqual(created.state.cityGoal,source().state.cityGoal);
 assert.equal(f.library.local().length,0);assert(!f.context.restored);
 await assert.rejects(fixture().context.createImportedCity(item,{kind:'cooperative'}),/登录/);
});
