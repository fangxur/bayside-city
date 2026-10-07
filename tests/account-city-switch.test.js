import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CitySimulation} from '../src/simulation.js';
import {SoloLibrary} from '../src/solo-library.js';

// Exercise the actual application handler with real snapshots and the durable solo library.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const loadHandler=main.slice(main.indexOf('async function loadAccountCity(record){'),main.indexOf('async function mutate(method,'));
class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function fixture(){
 const storage=new Storage(),coop={cityId:'shared',busy:false,accessDenied:false,pending:()=>[],identity:{actor:{id:'owner'},account:{username:'test'}}};
 const library=new SoloLibrary(coop,{storage});const city=new CitySimulation();city.setCityIdentity({cityName:'目标单人城',mayorName:'测试市长'});
 const record=library.create({city:city.serialize(),name:'目标单人城'}),events=[];
 const context={coop,soloLibrary:library,CitySimulation,started:true,soloRecord:null,
  autosave(){events.push('save');return true;},
  leaveCoop(){events.push('leave');coop.cityId=null;},
  restoreSnapshot(snapshot){events.push('restore');context.restored=CitySimulation.deserialize(snapshot.city);context.metadata=snapshot.accountCity;},
 };
 vm.createContext(context);vm.runInContext(loadHandler,context);
 return {context,record,coop,storage,library,events};
}
test('continue opens a locally pending solo city directly from a shared city without overwriting either save',async()=>{
 const f=fixture(),before=JSON.stringify(f.record);await f.context.loadAccountCity(f.record);
 assert.deepEqual(f.events,['leave','restore']);assert.equal(f.coop.cityId,null);assert.equal(f.context.soloRecord,f.record);
 assert.equal(f.context.restored.state.districtName,'目标单人城');assert.equal(f.context.metadata.id,f.record.id);
 assert.equal(JSON.stringify(f.record),before);assert(f.record.dirty);
});
test('unconfirmed shared commands keep the current city open; denied access may leave without dropping the outbox',async()=>{
 for(const state of [{busy:true},{pending:()=>[{command:'unconfirmed'}]}]){
  const f=fixture();Object.assign(f.coop,state);await assert.rejects(f.context.loadAccountCity(f.record),/正在保存或核对/);assert.equal(f.coop.cityId,'shared');assert.deepEqual(f.events,[]);
 }
 const f=fixture(),pending=[{command:'retained'}];f.coop.accessDenied=true;f.coop.pending=()=>pending;
 await f.context.loadAccountCity(f.record);assert.equal(f.coop.cityId,null);assert.equal(pending.length,1);
});
test('invalid snapshots, wrong owners and failed local persistence cannot leave the shared city',async()=>{
 for(const reason of ['snapshot','owner','storage']){
  const f=fixture();if(reason==='snapshot')f.record.snapshot.city='invalid';if(reason==='owner')f.record.owner='another';if(reason==='storage')f.storage.setItem=()=>{throw Error('storage full');};
  await assert.rejects(f.context.loadAccountCity(f.record));assert.equal(f.coop.cityId,'shared');assert.deepEqual(f.events,[]);assert.equal(f.context.soloRecord,null);
 }
});
test('switching between solo cities first saves current progress and continuing the active city keeps its latest state',async()=>{
 const f=fixture();f.coop.cityId=null;await f.context.loadAccountCity(f.record);assert.deepEqual(f.events,['save','restore']);
 const incoming=structuredClone(f.record);f.record.snapshot.name='最新名称';const latest=CitySimulation.deserialize(f.record.snapshot.city);latest.setCityIdentity({cityName:'最新名称',mayorName:'测试市长'});f.record.snapshot.city=latest.serialize();
 await f.context.loadAccountCity(incoming);assert.equal(f.context.restored.state.districtName,'最新名称');
 f.context.autosave=()=>false;await assert.rejects(f.context.loadAccountCity(incoming),/导出当前城市/);
});

test('account actions show errors inside the open dialog, prevent double clicks and allow retry',async()=>{
 const source=readFileSync(new URL('../src/account-ui.js',import.meta.url),'utf8');
 const runner=source.slice(source.indexOf(' let actionPending=false;'),source.indexOf(' const finish=async'));
 const errors=[],host={isConnected:true,append:e=>errors.push(e)},button={disabled:false,closest:()=>host,setAttribute(){},removeAttribute(){}};
 const context={dialog:{open:true,querySelectorAll:()=>errors.map(e=>({remove(){errors.splice(errors.indexOf(e),1);}}))},document:{createElement:()=>({dataset:{},setAttribute(k,v){this[k]=v;},scrollIntoView(){this.scrolled=true;}})},notify(){assert.fail('error must appear inside the modal');}};
 vm.createContext(context);vm.runInContext(runner+'\nthis.wrap=run;',context);
 let reject,calls=0;const handler=context.wrap(()=>{calls++;return new Promise((_,no)=>{reject=no;});});
 const pending=handler({currentTarget:button});assert(button.disabled);await handler({currentTarget:button});assert.equal(calls,1);
 reject(Error('合作城市还有操作正在保存或核对'));await pending;assert(!button.disabled);assert.equal(errors.length,1);assert.equal(errors[0].role,'alert');assert(errors[0].scrolled);assert.match(errors[0].textContent,/正在保存/);
 await context.wrap(async()=>{})({currentTarget:button});assert.equal(errors.length,0);
});

test('legacy account checkpoints prune only exact copies that already have a solo record',()=>{
 const storage=new Storage(),owner='owner',id='city-record',current={city:'current-city',accountCity:{id,owner}},older={city:'older-city',accountCity:{id,owner}},orphan={city:'other-city',accountCity:{id:'missing',owner}};
 storage.setItem(`bayside-solo:${owner}:${id}`,JSON.stringify({id,owner,snapshot:{city:current.city}}));
 storage.setItem(`bayside-v1:account:${owner}:checkpoints`,JSON.stringify([current,older,orphan]));storage.setItem(`bayside-v1:account:${owner}:manual`,JSON.stringify(current));storage.setItem('bayside-v1:manual',JSON.stringify({city:'guest'}));
 const source=main.slice(main.indexOf('function pruneLegacyAccountCopies(owner){'),main.indexOf('function retireBoundLocalCopies(bound,owner){'));
 const context={localStorage:storage,PREFIX:'bayside-v1:'};vm.createContext(context);vm.runInContext(source,context);context.pruneLegacyAccountCopies(owner);
 assert.deepEqual(JSON.parse(storage.getItem(`bayside-v1:account:${owner}:checkpoints`)).map(item=>item.city),['older-city','other-city']);
 assert.equal(storage.getItem(`bayside-v1:account:${owner}:manual`),null);assert(storage.getItem('bayside-v1:manual'),'guest saves remain untouched');
});
