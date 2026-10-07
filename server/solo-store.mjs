import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {CitySimulation} from '../src/simulation.js';

const fail=(message,status=400,code='INVALID')=>{throw Object.assign(Error(message),{status,code});};
export class SoloStore {
 constructor(store){
  this.store=store;this.db=store.db;
  this.db.exec(`CREATE TABLE IF NOT EXISTS solo_cities(
   id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(actor), name TEXT NOT NULL,
   city BLOB NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL,
   request_id TEXT NOT NULL, request_hash TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS solo_cities_owner ON solo_cities(owner);`);
 }
 list(actor){return this.db.prepare('SELECT id,name,revision,updated FROM solo_cities WHERE owner=? ORDER BY updated DESC').all(actor.id);}
 get(actor,id){
  const row=this.db.prepare('SELECT * FROM solo_cities WHERE id=? AND owner=?').get(id,actor.id);
  if(!row)fail('找不到这座单人城市',404);
  return {id:row.id,owner:row.owner,name:row.name,revision:row.revision,updated:row.updated,city:gunzipSync(row.city).toString()};
 }
 remove(actor,id){
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id))fail('存档标识无效');
  return this.store.transaction(()=>{
   const row=this.db.prepare('SELECT owner FROM solo_cities WHERE id=?').get(id);
   if(row&&row.owner!==actor.id)fail('找不到这座单人城市',404);
   const result=this.db.prepare('DELETE FROM solo_cities WHERE id=? AND owner=?').run(id,actor.id);
   return {ok:true,deleted:result.changes>0};
  });
 }
 save(actor,id,data){
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id)||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId))fail('存档版本无效');
  if(typeof data.city!=='string'||Buffer.byteLength(data.city)>5500000)fail('请选择有效的城市存档');
  const hash=createHash('sha256').update(data.city).digest('hex');
  return this.store.transaction(()=>{
   const row=this.db.prepare('SELECT owner,revision,updated,request_id,request_hash FROM solo_cities WHERE id=?').get(id);
   if(row&&row.owner!==actor.id)fail('找不到这座单人城市',404);
   if(row?.request_id===data.requestId){
    if(row.request_hash!==hash)fail('同一次保存的内容不一致',409);
    return {id,revision:row.revision,updated:row.updated};
   }
   if((row?.revision||0)!==data.revision)fail('另一台设备已经保存了更新的进度。本机进度仍保留，请在“我的城市”中选择要继续的版本。',409,'SAVE_CONFLICT');
   let sim;try{sim=CitySimulation.deserialize(data.city);}catch{fail('城市存档格式无效');}
   if(!row&&this.list(actor).length>=100)fail('账号最多保存 100 座单人城市，请先导出备份');
   const revision=(row?.revision||0)+1,updated=this.store.now();
   this.db.prepare(`INSERT INTO solo_cities VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,city=excluded.city,revision=excluded.revision,updated=excluded.updated,
    request_id=excluded.request_id,request_hash=excluded.request_hash`).run(id,actor.id,sim.state.districtName,gzipSync(sim.serialize()),revision,updated,data.requestId,hash);
   return {id,revision,updated};
  });
 }
}
