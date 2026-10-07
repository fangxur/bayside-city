import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {CitySimulation} from '../src/simulation.js';
import {hydrateCity,executeCityCommand,commandGuard,commandChanges,commandLabel,OWNER_METHODS,EDIT_METHODS} from '../src/city-commands.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(24).toString('base64url');
const ENGINE='coop-1';
export class CityError extends Error{constructor(code,message,status=409){super(message);this.code=code;this.status=status;}}
const fail=(code,message,status)=>{throw new CityError(code,message,status);};
const nameOf=s=>{if(typeof s!=='string'||!s.trim()||s.trim().length>24)fail('INVALID','名字请输入 1～24 个字',400);return s.trim();};
export class CityStore{
 constructor(file,{now=()=>Date.now(),beforeCommit=()=>{}}={}){
  if(file!==':memory:')mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(file);this.now=now;this.beforeCommit=beforeCommit;
  this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cities(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,revision INTEGER NOT NULL,engine TEXT NOT NULL,state TEXT NOT NULL,checksum TEXT NOT NULL,paused INTEGER NOT NULL DEFAULT 0,speed INTEGER NOT NULL DEFAULT 1,next_tick INTEGER NOT NULL,updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS members(city TEXT NOT NULL,actor TEXT NOT NULL,role TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(city,actor));
   CREATE TABLE IF NOT EXISTS invites(secret TEXT PRIMARY KEY,city TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,city TEXT NOT NULL,actor TEXT NOT NULL,epoch INTEGER NOT NULL,method TEXT NOT NULL,args TEXT NOT NULL,basis TEXT NOT NULL,cost REAL NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS commands(city TEXT NOT NULL,epoch INTEGER NOT NULL,actor TEXT NOT NULL,id TEXT NOT NULL,request_hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(city,epoch,actor,id));
   CREATE TABLE IF NOT EXISTS log(city TEXT NOT NULL,revision INTEGER NOT NULL,epoch INTEGER NOT NULL,actor TEXT NOT NULL,name TEXT NOT NULL,label TEXT NOT NULL,details TEXT NOT NULL,time INTEGER NOT NULL,month INTEGER NOT NULL,PRIMARY KEY(city,revision));
   CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,city TEXT NOT NULL,epoch INTEGER NOT NULL,revision INTEGER NOT NULL,label TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,checksum TEXT NOT NULL,engine TEXT NOT NULL,time INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS undo(city TEXT PRIMARY KEY,actor TEXT NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL);`);
 }
 close(){this.db.close();}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.beforeCommit();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 person(secret){return typeof secret==='string'?this.db.prepare('SELECT id,name FROM people WHERE secret=?').get(hash(secret)):null;}
 identity(secret,name){const existing=this.person(secret);if(existing)return {...existing,secret};const value=token(),id=randomUUID();this.db.prepare('INSERT INTO people VALUES(?,?,?)').run(id,hash(value),nameOf(name));return {id,name:name.trim(),secret:value};}
 member(city,actor,owner=false){const m=this.db.prepare('SELECT m.*,p.name FROM members m JOIN people p ON p.id=m.actor WHERE city=? AND actor=?').get(city,actor);if(!m)fail('FORBIDDEN','你不是这座城市的成员',403);if(owner&&m.role!=='owner')fail('FORBIDDEN','这项操作需要房主处理',403);return m;}
 row(city){const r=this.db.prepare('SELECT * FROM cities WHERE id=?').get(city);if(!r)fail('NOT_FOUND','找不到这座合作城市',404);if(r.engine!==ENGINE)fail('ENGINE_MISMATCH','城市需要先完成版本迁移',503);if(hash(r.state)!==r.checksum)fail('CORRUPT','存档校验失败，已停止写入，请从备份恢复',503);return r;}
 envelope(r,actor){const m=this.member(r.id,actor);return {cityId:r.id,epoch:r.epoch,revision:r.revision,role:m.role,actorId:actor,checksum:r.checksum,paused:!!r.paused,speed:r.speed,updated:r.updated,state:JSON.parse(r.state)};}
 read(city,actor,known){this.member(city,actor);const now=this.now();this.db.prepare('UPDATE members SET seen=? WHERE city=? AND actor=?').run(now,city,actor);const r=this.row(city);if(String(r.epoch)+':'+r.revision===known)return {unchanged:true,revision:r.revision,epoch:r.epoch};return this.envelope(r,actor);}
 create(actor,{save,name,requestId}){
  if(!/^[\w-]{16,80}$/.test(requestId||''))fail('INVALID','缺少创建请求编号',400);
  return this.tx(()=>{
   const prior=this.db.prepare('SELECT result,request_hash FROM commands WHERE city=? AND actor=? AND id=? AND epoch=0').get('create',actor,requestId),fingerprint=hash(JSON.stringify([save,name]));
   if(prior){if(prior.request_hash!==fingerprint)fail('REUSED_ID','创建请求编号已被使用');return JSON.parse(prior.result);}
   const sim=save?CitySimulation.deserialize(save):new CitySimulation();if(name){const result=sim.setCityIdentity({cityName:name,mayorName:sim.state.mayorName||''});if(!result.ok)fail('INVALID',result.message,400);}
   const id=randomUUID(),state=JSON.stringify(sim.state),now=this.now();
   this.db.prepare('INSERT INTO cities VALUES(?,1,1,?,?,?,0,1,?,?)').run(id,ENGINE,state,hash(state),now+3000,now);
   this.db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(id,actor,'owner',now);
   const r=this.row(id);this.addLog(r,actor,'创建合作城市',{cells:[],buildings:[],moneyDelta:0});this.snapshot(r,'起点存档','milestone');
   const result={cityId:id};this.db.prepare('INSERT INTO commands VALUES(?,0,?,?,?,?)').run('create',actor,requestId,fingerprint,JSON.stringify(result));return result;
  });
 }
 list(actor){return this.db.prepare('SELECT c.id,c.epoch,c.revision,c.updated,c.state,m.role FROM cities c JOIN members m ON m.city=c.id WHERE m.actor=? ORDER BY c.updated DESC').all(actor).map(r=>({cityId:r.id,name:JSON.parse(r.state).districtName,role:r.role,revision:r.revision,updated:r.updated}));}
 invite(city,actor){return this.tx(()=>{this.member(city,actor,true);this.row(city);const value=token();this.db.prepare('INSERT INTO invites VALUES(?,?,?)').run(hash(value),city,this.now()+86400000);return {code:value,expires:this.now()+86400000};});}
 join(actor,code){return this.tx(()=>{const i=this.db.prepare('SELECT * FROM invites WHERE secret=? AND expires>?').get(hash(String(code)),this.now());if(!i)fail('INVITE_EXPIRED','邀请不存在或已过期',404);this.row(i.city);if(!this.db.prepare('SELECT 1 FROM members WHERE city=? AND actor=?').get(i.city,actor)){if(this.db.prepare('SELECT count(*) AS n FROM members WHERE city=?').get(i.city).n>=4)fail('FULL','城市已有 4 位共建成员');this.db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(i.city,actor,'builder',this.now());}return {cityId:i.city};});}
 preview(city,actor,{epoch,method,args,basis}){return this.tx(()=>{
  this.member(city,actor,OWNER_METHODS.has(method));const r=this.row(city);if(epoch!==r.epoch)fail('CITY_RESTORED','城市已恢复历史存档，请同步后重新操作');
  const sim=hydrateCity(JSON.parse(r.state)),current=commandGuard(sim,method,args);if(current!==basis)fail('TARGET_CHANGED','目标刚被其他人修改，请查看最新状态后再操作');
  const before=sim.state.money,result=executeCityCommand(sim,method,args);if(!result.ok)fail('RULE',result.message||'当前条件不允许这项操作');
  const cost=before-sim.state.money,id=token();this.db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?,?)').run(id,city,actor,r.epoch,method,JSON.stringify(args),current,cost,this.now()+30000);
  this.db.prepare('DELETE FROM quotes WHERE expires<?').run(this.now()-60000);
  return {quoteId:id,cost,message:result.message};
 });}
 checkRequest(request){if(!request||!/^[\w-]{16,80}$/.test(request.commandId||'')||!Number.isInteger(request.epoch))fail('INVALID','操作编号或城市版本不正确',400);}
 commit(city,actor,request){this.checkRequest(request);return this.tx(()=>{
  this.member(city,actor);let r=this.row(city);const fingerprint=hash(JSON.stringify(request));
  const prior=this.db.prepare('SELECT * FROM commands WHERE city=? AND epoch=? AND actor=? AND id=?').get(city,request.epoch,actor,request.commandId);
  if(prior){if(prior.request_hash!==fingerprint)fail('REUSED_ID','同一操作编号不能用于不同请求');return JSON.parse(prior.result);}
  if(request.epoch!==r.epoch)fail('CITY_RESTORED','城市已恢复历史存档，旧操作不能再次提交');
  const before=JSON.parse(r.state),sim=hydrateCity(before);let result,label,details,undoable=false,newEpoch=r.epoch,paused=r.paused,speed=r.speed;
  if(request.action==='edit'){
   const q=this.db.prepare('SELECT * FROM quotes WHERE id=? AND city=? AND actor=?').get(request.quoteId,city,actor);if(!q||q.epoch!==r.epoch||q.expires<this.now())fail('QUOTE_EXPIRED','方案已过期，请重新确认');
   this.member(city,actor,OWNER_METHODS.has(q.method));const args=JSON.parse(q.args);
   if(commandGuard(sim,q.method,args)!==q.basis)fail('TARGET_CHANGED','目标刚被其他人修改，本次操作未执行、未扣费');
   result=executeCityCommand(sim,q.method,args);if(!result.ok)fail('RULE',result.message||'当前条件不允许这项操作');
   if(before.money-sim.state.money!==q.cost)fail('PRICE_CHANGED','建设费用有变化，请重新确认');
   label=commandLabel(q.method,args);undoable=EDIT_METHODS.has(q.method);
  }else if(request.action==='undo'){
   const u=this.db.prepare('SELECT * FROM undo WHERE city=?').get(city);
   if(request.baseRevision!==r.revision||!u||u.actor!==actor||u.revision!==r.revision)fail('UNDO_CHANGED','之后已有其他建设或城市进展，不能直接撤销');
   sim.state=JSON.parse(u.state);result={ok:true,message:'已撤销自己的上一次建设'};label='撤销上一次建设';details={originalRevision:u.revision};
  }else if(request.action==='control'){
   this.member(city,actor,true);if(request.baseRevision!==r.revision)fail('TARGET_CHANGED','城市状态已更新，请重新操作');
   if(typeof request.paused!=='boolean'||![1,2,4].includes(request.speed))fail('INVALID','速度设置不正确',400);paused=Number(request.paused);speed=request.speed;result={ok:true,message:paused?'合作城市已暂停':'合作城市继续经营'};label=result.message;
  }else if(request.action==='restore'){
   this.member(city,actor,true);if(request.baseRevision!==r.revision)fail('TARGET_CHANGED','确认期间城市已有变化，请重新查看后恢复');
   const snap=this.db.prepare('SELECT * FROM snapshots WHERE city=? AND id=?').get(city,request.snapshotId);if(!snap||snap.engine!==ENGINE||hash(snap.state)!==snap.checksum)fail('INVALID','历史存档不可读取',400);
   this.snapshot(r,'恢复前备份','backup');sim.state=JSON.parse(snap.state);newEpoch++;paused=1;label='恢复历史存档：'+snap.label;result={ok:true,message:'已恢复历史存档，城市暂时暂停；恢复前进度已备份'};
  }else if(request.action==='snapshot'){
   const saved=this.snapshot(r,nameOf(request.label),'manual');result={ok:true,message:'纪念存档已保存',snapshotId:saved.id};label='保存纪念存档：'+request.label;
  }else fail('INVALID','不支持的合作操作',400);
  const changes={...commandChanges(before,sim.state),...details};
  r=this.write(r,sim.state,{epoch:newEpoch,paused,speed});this.addLog(r,actor,label,changes);
  this.db.prepare('DELETE FROM undo WHERE city=?').run(city);
  if(undoable)this.db.prepare('INSERT INTO undo VALUES(?,?,?,?)').run(city,actor,r.revision,JSON.stringify(before));
  if(newEpoch!==request.epoch)this.db.prepare('DELETE FROM quotes WHERE city=?').run(city);
  const response={...result,epoch:r.epoch,revision:r.revision};
  this.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?)').run(city,request.epoch,actor,request.commandId,fingerprint,JSON.stringify(response));
  this.autoSnapshots(r,before);return response;
 });}
 commandResult(city,actor,epoch,id){this.member(city,actor);const row=this.db.prepare('SELECT result FROM commands WHERE city=? AND actor=? AND epoch=? AND id=?').get(city,actor,epoch,id);return row?JSON.parse(row.result):{unknown:true};}
 write(r,state,{epoch=r.epoch,paused=r.paused,speed=r.speed}={}){
  if(!Number.isFinite(state.money))fail('INVALID_STATE','城市状态异常，未保存',503);
  const encoded=JSON.stringify(state),now=this.now(),revision=r.revision+1;
  this.db.prepare('UPDATE cities SET epoch=?,revision=?,state=?,checksum=?,paused=?,speed=?,updated=? WHERE id=? AND revision=?').run(epoch,revision,encoded,hash(encoded),paused,speed,now,r.id,r.revision);
  return {...r,epoch,revision,state:encoded,checksum:hash(encoded),paused,speed,updated:now};
 }
 addLog(r,actor,label,details){const person=actor==='system'?{name:'城市动态'}:this.db.prepare('SELECT name FROM people WHERE id=?').get(actor);this.db.prepare('INSERT INTO log VALUES(?,?,?,?,?,?,?,?,?,?)').run(r.id,r.revision,r.epoch,actor,person.name,label,JSON.stringify(details),this.now(),JSON.parse(r.state).month);}
 snapshot(r,label,kind){const id=randomUUID();this.db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,r.id,r.epoch,r.revision,label,kind,r.state,r.checksum,ENGINE,this.now());return {id};}
 autoSnapshots(r,before){
  const s=JSON.parse(r.state),gained=Object.keys(s.milestones).filter(k=>s.milestones[k]&&!before.milestones[k]);if(gained.length)this.snapshot(r,'人口里程碑 · '+s.stats.population+' 人','milestone');
  const latest=this.db.prepare("SELECT max(time) AS time FROM snapshots WHERE city=? AND kind='auto'").get(r.id);
  if(latest.time==null||this.now()-latest.time>=300000){this.snapshot(r,'自动检查点','auto');this.db.prepare("DELETE FROM snapshots WHERE city=? AND kind='auto' AND id NOT IN(SELECT id FROM snapshots WHERE city=? AND kind='auto' ORDER BY time DESC LIMIT 24)").run(r.id,r.id);}
  const daily=this.db.prepare("SELECT max(time) AS time FROM snapshots WHERE city=? AND kind='daily'").get(r.id);
  if(daily.time==null||this.now()-daily.time>=86400000){this.snapshot(r,'每日备份','daily');this.db.prepare("DELETE FROM snapshots WHERE city=? AND kind='daily' AND id NOT IN(SELECT id FROM snapshots WHERE city=? AND kind='daily' ORDER BY time DESC LIMIT 30)").run(r.id,r.id);}
 }
 snapshots(city,actor){this.member(city,actor);return this.db.prepare('SELECT id,label,kind,epoch,revision,time FROM snapshots WHERE city=? ORDER BY time DESC LIMIT 100').all(city);}
 logs(city,actor,before=Number.MAX_SAFE_INTEGER){this.member(city,actor);return this.db.prepare('SELECT * FROM log WHERE city=? AND revision<? ORDER BY revision DESC LIMIT 50').all(city,before).map(r=>({...r,details:JSON.parse(r.details)}));}
 members(city,actor){this.member(city,actor);return this.db.prepare('SELECT m.actor,m.role,m.seen,p.name FROM members m JOIN people p ON p.id=m.actor WHERE m.city=?').all(city);}
 tickDue(){const now=this.now();const cities=this.db.prepare('SELECT id FROM cities WHERE next_tick<=?').all(now);for(const {id} of cities)this.tx(()=>{
  const r=this.row(id);if(r.next_tick>now)return;
  const present=this.db.prepare('SELECT 1 FROM members WHERE city=? AND seen>? LIMIT 1').get(id,now-15000);
  this.db.prepare('UPDATE cities SET next_tick=? WHERE id=?').run(now+3000/r.speed,id);
  if(r.paused||!present)return;
  const before=JSON.parse(r.state),sim=hydrateCity(before);sim.tick();const updated=this.write(r,sim.state);
  this.db.prepare('DELETE FROM undo WHERE city=?').run(id);
  const gained=Object.keys(sim.state.milestones).filter(k=>sim.state.milestones[k]&&!before.milestones[k]);
  if(gained.length)this.addLog(updated,'system','城市达到新里程碑 · '+sim.state.stats.population+' 人',{cells:[],buildings:[],moneyDelta:0});
  this.autoSnapshots(updated,before);
 });}
 leave(city,actor){this.member(city,actor);this.db.prepare('UPDATE members SET seen=0 WHERE city=? AND actor=?').run(city,actor);}
}
