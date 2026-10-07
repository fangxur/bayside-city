import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CoopStore} from '../server/coop-store.mjs';
let serial=0;
function fixture(t,opts={}){const dir=mkdtempSync(path.join(tmpdir(),'bayside-coop-')),file=path.join(dir,'city.db'),store=new CoopStore(file,opts);t.after(()=>{try{store.close();}catch{}rmSync(dir,{recursive:true,force:true});});const a=store.user(store.session('甲').token),b=store.user(store.session('乙').token),id=store.create(a,{name:'测试共建城'}).cityId;store.join(store.invite(id,a).code,b);return {store,a,b,id,file,dir};}
const command=(method,args,revision=0,epoch=1)=>({commandId:'test-'+(++serial),epoch,baseRevision:revision,method,args});
const build=(x,y,type='park',revision=0)=>command('build',[type,[{x,y}]],revision);

test('cooperative construction accepts the current browser build options for roads and buildings',t=>{
 const {store:s,a,id}=fixture(t),options={buildingId:null,roadSource:null,roadsOnly:false};
 assert(s.command(id,a,command('build',['road',[{x:8,y:32}],options])).ok);
 assert(s.command(id,a,command('build',['park',[{x:10,y:29}],options],1)).ok);
 assert(s.command(id,a,command('build',['plaza',[{x:12,y:29}],options],2)).ok);
 const state=s.view(id,a).state;
 assert.equal(state.tiles[32*64+8].road,1);
 assert.equal(state.buildings.find(b=>b.x===10&&b.y===29)?.type,'park');
 const plaza=state.buildings.find(b=>b.x===12&&b.y===29);
 assert.equal(plaza?.type,'plaza');assert.equal(plaza?.footprint,2);
});

test('cooperative cities preserve their selected scale and can build beyond the standard-map edge',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'bayside-coop-size-')),store=new CoopStore(path.join(dir,'city.db'));
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const actor=store.user(store.session('大城房主').token),id=store.create(actor,{name:'超大合作城',mapSize:96,cityGoal:'population'}).cityId;
 const initial=store.view(id,actor).state,cell=initial.tiles.find(tile=>tile.x>=90&&tile.y>=70&&tile.terrain==='land');
 assert.equal(initial.mapSize,96);assert(cell);
 assert(store.command(id,actor,build(cell.x,cell.y)).ok);
 const state=store.view(id,actor).state;
 assert.equal(state.tiles[cell.y*96+cell.x].buildingId,1);
 assert.equal(state.buildings[0].x,cell.x);
});

test('cooperative road moves accept and protect their source coordinate',t=>{
 const {store:s,a,id}=fixture(t),options={buildingId:null,roadSource:null,roadsOnly:false};
 assert(s.command(id,a,command('build',['road',[{x:8,y:32}],options])).ok);
 const moved=s.command(id,a,command('build',['move',[{x:8,y:31}],{...options,roadSource:{x:8,y:32}}],1));
 assert(moved.ok);
 const state=s.view(id,a).state;
 assert.equal(state.tiles[32*64+8].road,0);
 assert.equal(state.tiles[31*64+8].road,1);
 const log=s.logs(id,a).find(entry=>entry.revision===2);
 assert.deepEqual(log.cells,[{x:8,y:31},{x:8,y:32}]);
});

test('viewing an invitation reuses its code across restart, expires it and preserves owner access',t=>{
 let now=100000;const {store:s,a,b,id,file}=fixture(t,{now:()=>now});
 const first=s.invite(id,a,{reuse:true}),before=s.view(id,a);
 assert.deepEqual(s.invite(id,a,{reuse:true}),first);
 const second=new CoopStore(file,{now:()=>now});t.after(()=>second.close());
 assert.deepEqual(second.invite(id,a,{reuse:true}),first);
 assert.throws(()=>second.invite(id,b,{reuse:true}),{status:403});
 assert.equal(s.view(id,a).checksum,before.checksum);assert.equal(s.view(id,a).revision,before.revision);
 now=first.expires+1;
 const renewed=s.invite(id,a,{reuse:true});assert.notEqual(renewed.code,first.code);
 assert.throws(()=>s.join(first.code,b));assert.equal(s.join(renewed.code,b).cityId,id);
 s.remove(id,a,b.id);assert.throws(()=>s.join(renewed.code,b));
});

test('legacy invite schema upgrades without changing city data or invalidating existing links',t=>{
 const {store:s,a,b,id,file}=fixture(t),legacy=s.invite(id,a),before=s.view(id,a);
 s.db.exec('ALTER TABLE invites DROP COLUMN display_code');s.close();
 const migrated=new CoopStore(file);t.after(()=>migrated.close());
 const invitation=migrated.invite(id,a,{reuse:true});
 assert.equal(migrated.join(legacy.code,b).cityId,id);
 assert.equal(migrated.join(invitation.code,b).cityId,id);
 assert.deepEqual(migrated.invite(id,a,{reuse:true}),invitation);
 assert.equal(migrated.view(id,a).checksum,before.checksum);
});

test('different plots from the same version both persist; collisions never charge twice',t=>{
 const {store:s,a,b,id}=fixture(t);assert(s.command(id,a,build(10,29)).ok);assert(s.command(id,b,build(12,29)).ok);
 const result=s.command(id,b,build(10,29));assert(!result.ok);assert.equal(result.code,'TARGET_CHANGED');
 const v=s.view(id,a);assert.equal(v.state.money,28800);assert.equal(v.state.buildings.length,2);assert.equal(v.revision,2);assert.equal(s.logs(id,a).length,3);
});
test('overlapping footprints and a partially changed road stroke are atomic',t=>{
 const {store:s,a,b,id}=fixture(t);assert(s.command(id,a,build(10,29,'plaza')).ok);assert(!s.command(id,b,build(11,30,'plaza')).ok);
 const v=s.view(id,a);assert(s.command(id,a,build(9,32,'park',v.revision)).ok);
 const stroke=command('build',['road',[{x:8,y:32},{x:9,y:32}]],v.revision);assert(!s.command(id,b,stroke).ok);assert.equal(s.view(id,a).state.tiles[32*64+8].road,0);
});
test('same ID deduplicates 100 retries across restart and rejects a changed payload',t=>{
 const {store:s,a,id,file}=fixture(t),c=build(10,29);for(let i=0;i<100;i++)assert(s.command(id,a,c).ok);
 const other=new CoopStore(file);t.after(()=>other.close());assert(other.command(id,a,c).duplicate);assert.equal(other.view(id,a).state.money,29400);
 assert.throws(()=>other.command(id,a,{...c,args:['park',[{x:12,y:29}]]}),{code:'ID_REUSED'});
});
test('shared treasury cannot be overspent by stale concurrent requests',t=>{
 const {store:s,a,b,id}=fixture(t);
 // Import through the normal save validator instead of forging the live stored state.
 const city=JSON.stringify({...JSON.parse(s.exportSnapshot(id,a)),money:700});const second=s.create(a,{name:'预算城',city}).cityId;s.join(s.invite(second,a).code,b);
 assert(s.command(second,a,build(10,29)).ok);assert(!s.command(second,b,build(12,29)).ok);assert.equal(s.view(second,a).state.money,100);
});
test('rollback leaves money, city, command receipt and log unchanged on storage failure',t=>{
 const {store:s,a,id}=fixture(t);const before=s.view(id,a);s.beforeCommit=()=>{throw Error('disk full');};const c=build(10,29);
 assert.throws(()=>s.command(id,a,c),/disk full/);s.beforeCommit=null;assert.equal(s.view(id,a).checksum,before.checksum);assert.equal(s.logs(id,a).length,1);assert(s.command(id,a,c).ok);
});
test('undo never rolls back another player or a simulation tick',t=>{
 let now=100000;const {store:s,a,b,id}=fixture(t,{now:()=>now});assert(s.command(id,a,build(10,29)).ok);assert(s.command(id,b,build(12,29)).ok);
 assert(!s.command(id,a,command('undo',[],2)).ok);assert(s.command(id,b,command('undo',[],2)).ok);assert.equal(s.view(id,a).state.buildings.length,1);
 assert(s.command(id,a,command('setClock',[{paused:false,speed:1}],3)).ok);now+=3001;s.tickDue();assert(!s.command(id,a,command('undo',[],5)).ok);
});
test('snapshots restore into a new epoch with a pre-restore backup and reject old writes',t=>{
 const {store:s,a,b,id}=fixture(t);const snap=s.command(id,a,command('saveSnapshot',['初城']));assert(snap.ok);
 assert(s.command(id,b,build(10,29,'park',1)).ok);const stale=build(12,29,'park',2);
 assert(s.command(id,a,command('restoreSnapshot',[snap.snapshotId],2)).ok);
 assert.equal(s.view(id,a).epoch,2);assert.equal(s.view(id,a).state.buildings.length,0);assert.equal(s.command(id,b,stale).code,'CITY_RESTORED');
 assert(s.snapshots(id,a).some(s=>s.kind==='before-restore'));assert.equal(s.view(id,b).role,'builder');
});
test('nonmembers and removed members cannot read or write; builders cannot alter city policy',t=>{
 const {store:s,a,b,id}=fixture(t);const stranger=s.user(s.session('丙').token);assert.throws(()=>s.view(id,stranger),{status:403});assert.throws(()=>s.command(id,stranger,build(10,29)),{status:403});
 assert(!s.command(id,b,command('setTax',[15])).ok);assert.throws(()=>s.invite(id,b),{status:403});const code=s.invite(id,a).code;s.remove(id,a,b.id);assert.throws(()=>s.view(id,b),{status:403});assert.throws(()=>s.join(code,b));
});
test('only the owner can permanently delete a cooperative city and all of its records',t=>{
 const {store:s,a,b,id}=fixture(t);assert(s.command(id,a,build(10,29)).ok);s.invite(id,a);s.snapshot(s.city(id),'删除前存档','manual');
 assert.throws(()=>s.deleteCity(id,b),{status:403});assert.equal(s.view(id,a).state.buildings.length,1);
 assert(s.deleteCity(id,a).ok);assert.throws(()=>s.view(id,a),{status:403});
 for(const table of ['cities','members','invites','commands','revisions','logs','snapshots'])assert.equal(s.db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${table==='cities'?'id':'city'}=?`).get(id).n,0);
});
test('tick scheduling is shared across store instances and stops without online members',t=>{
 let now=100000;const {store:s,a,id,file}=fixture(t,{now:()=>now});s.command(id,a,command('setClock',[{paused:false,speed:1}]));const second=new CoopStore(file,{now:()=>now});t.after(()=>second.close());
 now+=3001;s.tickDue();second.tickDue();assert.equal(s.view(id,a).state.tick,1);
 now+=15000;s.tickDue();assert.equal(s.city(id).revision,2);s.view(id,a);now+=3001;s.tickDue();assert.equal(s.view(id,a).state.tick,2);
});
test('hard crash before commit rolls back; crash after commit survives and retries once',t=>{
 const {store:s,a,id,file}=fixture(t),c=build(10,29);const script=`import {CoopStore} from './server/coop-store.mjs';const s=new CoopStore(process.env.DB);if(process.env.PHASE==='before')s.beforeCommit=()=>process.kill(process.pid,'SIGKILL');s.command(process.env.CITY,JSON.parse(process.env.ACTOR),JSON.parse(process.env.CMD));process.kill(process.pid,'SIGKILL');`;
 const run=phase=>spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,DB:file,CITY:id,ACTOR:JSON.stringify(a),CMD:JSON.stringify(c),PHASE:phase}});
 assert.equal(run('before').signal,'SIGKILL');assert.equal(s.view(id,a).revision,0);assert.equal(run('after').signal,'SIGKILL');assert(s.command(id,a,c).duplicate);assert.equal(s.view(id,a).revision,1);assert.equal(s.logs(id,a).length,2);
});
test('backup can recover confirmed city, history and idempotency receipts',async t=>{
 const {store:s,a,id,dir}=fixture(t),c=build(10,29);s.command(id,a,c);const file=path.join(dir,'backup.db');await s.backupTo(file);const restored=new CoopStore(file);t.after(()=>restored.close());assert.equal(restored.view(id,a).checksum,s.view(id,a).checksum);assert(restored.command(id,a,c).duplicate);assert.equal(restored.logs(id,a).length,2);
});
test('moving, rotating or demolishing a changed building never targets its replacement',t=>{
 const {store:s,a,b,id}=fixture(t);s.command(id,a,build(10,29));const building=s.view(id,a).state.buildings[0];
 const move=command('build',['move',[{x:12,y:29}],{buildingId:building.id}],1);assert(s.command(id,b,move).ok);
 assert(!s.command(id,a,command('rotateBuilding',[building.id,1],1)).ok);
 assert(!s.command(id,a,command('build',['bulldoze',[{x:10,y:29}]],1)).ok);
 assert.equal(s.view(id,a).state.buildings[0].x,12);
});
test('restoring a snapshot requires the exact confirmation version',t=>{
 const {store:s,a,b,id}=fixture(t),snapshot=s.snapshots(id,a)[0];s.command(id,b,build(10,29));
 const r=s.command(id,a,command('restoreSnapshot',[snapshot.id],0));assert(!r.ok);assert.equal(s.view(id,a).state.buildings.length,1);
});
test('festival rewards cannot be claimed twice by simultaneous residents',t=>{
 const {store:s,a,b,id}=fixture(t),before=s.view(id,a).state.festivalGames.points;
 assert(s.command(id,a,command('claimFestivalPoints',[])).ok);assert(!s.command(id,b,command('claimFestivalPoints',[])).ok);assert.equal(s.view(id,a).state.festivalGames.points,before+100);
});
