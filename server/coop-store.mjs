import {interchangeAt,interchangeCells} from '../src/interchanges.js';
import {gzipSync,gunzipSync} from 'node:zlib';
import {DatabaseSync,backup} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {CitySimulation,TOOLS} from '../src/simulation.js';
import {isBankrupt,BANKRUPTCY_MESSAGE} from '../src/city-bankruptcy.js';
import {newCityGoal,validCityGoal} from '../src/city-goals.js';
import {COOP_METHODS,OWNER_METHODS,COOP_FORMAT,COOP_ENGINE} from '../src/coop-protocol.js';
import {businessKind} from '../src/business-kinds.js';
import {civicGardenGroups} from '../src/city-layout.js';
import {DEFAULT_MAP_SIZE,MAX_MAP_SIZE,gridIndex,inGrid,validMapSize} from '../src/grid.js';
import {SimulationJobs} from './simulation-jobs.mjs';
import {compactFamousSculpturePlots} from '../src/building-footprint.js';
const json=JSON.stringify,parse=JSON.parse,hash=s=>createHash('sha256').update(s).digest('hex');
const encodeState=state=>gzipSync(Buffer.from(json(state))).toString('base64');
const decodeState=text=>{
 const state=text.startsWith('{')?parse(text):parse(gunzipSync(Buffer.from(text,'base64')).toString());
 // Existing server cities and historic snapshots bypass deserialize; compact those too.
 if(compactFamousSculpturePlots(state)){const sim=hydrate(state);sim.recalculate();return sim.state;}
 return state;
};
const fail=(message,code='INVALID',status=400)=>{throw Object.assign(new Error(message),{code,status});};
const okText=(s,max=24)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<MAX_MAP_SIZE&&p.y>=0&&p.y<MAX_MAP_SIZE;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const token=()=>randomBytes(24).toString('base64url');
export function hydrate(state){const sim=Object.create(CitySimulation.prototype);sim.state=structuredClone(state);sim._undo=null;return sim;}
function geometry(b){return b?[b.id,b.x,b.y,b.type,b.businessKind||null,b.footprint||1,b.level,b.rotation||0,b.active,b.progress>=1]:null;}
function cellShape(s,p){const t=s.tiles[gridIndex(s,p.x,p.y)];return [p.x,p.y,t.terrain,t.road,t.bridge||false,interchangeAt(s,p),t.zone,t.businessKind||null,t.buildingId,geometry(s.buildings.find(b=>b.id===t.buildingId))];}
function plan(sim,method,args){
 if(method==='build')return sim.preview(args[0],args[1],args[2]||{});
 if(method==='upgradeAllRoads')return sim.previewUpgradeAllRoads();
 return null;
}
function affected(state,method,args,offer){
 let cells=offer?.cells||[],ids=[];
 if(method==='build'){
  cells=[...cells,...args[1]];
  if(args[0]==='move'){
   ids=[args[2]?.buildingId];
   if(point(args[2]?.roadSource))cells.push(args[2].roadSource);
  }
 }
 if(['rotateBuilding','setBuildingActive'].includes(method))ids=[args[0]];
 const groups=civicGardenGroups(state.buildings);
 ids=ids.flatMap(id=>groups.get(id)?.members||[id]);
 for(const b of state.buildings.filter(b=>ids.includes(b.id)))for(let y=0;y<(b.footprint||1);y++)for(let x=0;x<(b.footprint||1);x++)cells.push({x:b.x+x,y:b.y+y});
 cells=[...cells,...cells.flatMap(p=>{const item=interchangeAt(state,p);return item?interchangeCells(item):[];})];
 return [...new Map(cells.filter(p=>inGrid(state,p.x,p.y)).map(p=>[gridIndex(state,p.x,p.y),{x:p.x,y:p.y}])).values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}
function validate(method,a){
 if(!COOP_METHODS.includes(method)||!Array.isArray(a)||a.length>3)fail('不支持的城市操作');
 if(method==='build'){
  if(a.length<2||typeof a[0]!=='string'||(!TOOLS[a[0]]&&!businessKind(a[0])&&!['move'].includes(a[0]))||!Array.isArray(a[1])||!a[1].length||a[1].length>4096||!a[1].every(point))fail('建设范围无效');
  if(a[2]&&(typeof a[2]!=='object'||Array.isArray(a[2])||Object.keys(a[2]).some(k=>!['buildingId','roadSource','roadsOnly'].includes(k))||(a[2].buildingId!=null&&!integer(a[2].buildingId))||(a[2].roadSource!=null&&!point(a[2].roadSource))||(a[2].roadsOnly!==undefined&&typeof a[2].roadsOnly!=='boolean')))fail('建设参数无效');
 }
 if(['rotateBuilding','setBuildingActive'].includes(method)&&(!integer(a[0])||(method==='rotateBuilding'?![-1,1].includes(a[1]):typeof a[1]!=='boolean')))fail('建筑参数无效');
 if(method==='setTax'&&(!Number.isInteger(a[0])||a[0]<6||a[0]>15))fail('税率无效');
 if(method==='setFireBudget'&&![70,100,130].includes(a[0]))fail('消防预算无效');
 if(method==='setClock'&&(!a[0]||typeof a[0].paused!=='boolean'||![1,2,3].includes(a[0].speed)))fail('模拟速度无效');
 if(method==='setCityIdentity'&&(!a[0]||!okText(a[0].cityName)||typeof a[0].mayorName!=='string'||a[0].mayorName.length>24))fail('城市名称无效');
 if(method==='saveSnapshot'&&!okText(a[0],40))fail('请输入最多 40 字的存档名称');
 if(method==='restoreSnapshot'&&!okText(a[0],80))fail('存档无效');
 if(method==='resolveCityEvent'&&(!okText(a[0],200)||!a[1]||typeof a[1]!=='object'))fail('活动无效');
 if(method==='redeemFestivalReward'&&!okText(a[0],80))fail('奖励无效');
 if(method==='enterDragonRace'&&(!Number.isInteger(a[0])||!Number.isInteger(a[1])))fail('竞猜参数无效');
}
const methodLabels={build:'建设',rotateBuilding:'旋转建筑',setBuildingActive:'调整设施',upgradeAllRoads:'升级全部道路',undo:'撤销建设',setTax:'调整税率',takeLoan:'申请贷款',setCityIdentity:'修改城市档案',setFireBudget:'调整消防预算',startFireDrill:'消防演练',resolveCityEvent:'支持居民活动',claimFestivalPoints:'领取节庆积分',redeemFestivalReward:'调整节庆装饰',enterDragonRace:'龙舟竞猜',setClock:'调整模拟速度',saveSnapshot:'纪念存档',restoreSnapshot:'恢复城市'};
export class CoopStore{
 constructor(file,{now=()=>Date.now(),beforeCommit=null,jobs=null}={}){
  this.jobs=jobs;this.commandQueues=new Map();this.pendingTicks=new Map();this.renderPlans=new Map();this.closed=false;
  if(file!==':memory:')mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  this.file=file;this.now=now;this.beforeCommit=beforeCommit;
  this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cities(id TEXT PRIMARY KEY, owner TEXT NOT NULL, epoch INTEGER NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, checksum TEXT NOT NULL, format INTEGER NOT NULL, engine TEXT NOT NULL, paused INTEGER NOT NULL, speed INTEGER NOT NULL, next_tick INTEGER NOT NULL, updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS members(city TEXT NOT NULL REFERENCES cities(id), actor TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(city,actor));
   CREATE TABLE IF NOT EXISTS invites(code TEXT PRIMARY KEY, city TEXT NOT NULL REFERENCES cities(id), expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS commands(city TEXT NOT NULL, epoch INTEGER NOT NULL, actor TEXT NOT NULL, id TEXT NOT NULL, request_hash TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(city,epoch,actor,id));
   CREATE TABLE IF NOT EXISTS revisions(city TEXT NOT NULL, revision INTEGER NOT NULL, epoch INTEGER NOT NULL, state TEXT NOT NULL, actor TEXT NOT NULL, reversible INTEGER NOT NULL, PRIMARY KEY(city,revision));
   CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY, city TEXT NOT NULL, revision INTEGER NOT NULL, epoch INTEGER NOT NULL, actor TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, cost REAL NOT NULL, cells TEXT NOT NULL, objects TEXT NOT NULL, time INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, city TEXT NOT NULL, epoch INTEGER NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL, checksum TEXT NOT NULL, time INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS logs_city_revision ON logs(city,revision);
   CREATE INDEX IF NOT EXISTS snapshots_city_time ON snapshots(city,time);
  `);
  if(!this.db.prepare('PRAGMA table_info(invites)').all().some(column=>column.name==='display_code'))this.db.exec('ALTER TABLE invites ADD COLUMN display_code TEXT');
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.beforeCommit?.();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 session(name){if(!okText(name))fail('请输入 1～24 字的玩家名字');const secret=token(),id=randomUUID();this.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,hash(secret),name.trim());return {token:secret,actor:{id,name:name.trim()}};}
 user(secret){if(typeof secret!=='string'||secret.length>120)fail('请重新进入合作城市','AUTH',401);const u=this.db.prepare('SELECT id,name FROM users WHERE secret=?').get(hash(secret));if(!u)fail('请重新进入合作城市','AUTH',401);return u;}
 member(city,actor){const m=this.db.prepare('SELECT * FROM members WHERE city=? AND actor=?').get(city,actor);if(!m)fail('你没有这座城市的访问权限','FORBIDDEN',403);return m;}
 city(id){const c=this.db.prepare('SELECT * FROM cities WHERE id=?').get(id);if(!c)fail('城市不存在','NOT_FOUND',404);if(c.format!==COOP_FORMAT||c.engine!==COOP_ENGINE)fail('城市版本需要迁移，请先备份','VERSION',409);if(hash(c.state)!==c.checksum)fail('存档校验失败，请从备份恢复','CORRUPT',503);return c;}
 create(actor,{name,city,terrainPreset='bayside',demo=false,cityGoal,mapSize:requestedMapSize,terrainDraft}={}){
  if(!okText(name))fail('请输入城市名称');if(city!==undefined&&(typeof city!=='string'||city.length>5000000))fail('导入存档过大');if(cityGoal!==undefined&&!validCityGoal(cityGoal))fail('请选择有效的本局目标');if(requestedMapSize!==undefined&&!validMapSize(requestedMapSize))fail('请选择有效的城市规模');
  return this.transaction(()=>{
   if(this.db.prepare('SELECT count(*) AS n FROM cities WHERE owner=?').get(actor.id).n>=10)fail('每位玩家最多创建 10 座合作城市');
   if(city!==undefined&&terrainDraft!==undefined)fail('导入城市与自定义地图不能同时使用');
   let sim;
   try{sim=city?CitySimulation.deserialize(city):new CitySimulation({terrainPreset,terrainDraft,demo:demo===true,mapSize:requestedMapSize??DEFAULT_MAP_SIZE,...(cityGoal?{cityGoal}:{})});}
   catch(error){fail(error.message);}
   if(city&&requestedMapSize!==undefined&&sim.state.mapSize!==requestedMapSize)fail('复制城市的规模与所选规模不一致');
   if(city&&cityGoal){sim.state.cityGoal=newCityGoal(cityGoal);sim.recalculate();}
   sim.setCityIdentity({cityName:name.trim(),mayorName:actor.name});
   const id=randomUUID(),state=encodeState(sim.state),time=this.now();
   this.db.prepare('INSERT INTO cities VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.id,1,0,state,hash(state),COOP_FORMAT,COOP_ENGINE,1,1,time+3000,time);
   this.db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(id,actor.id,'owner',time);
   this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?,?,?)').run(id,0,1,state,actor.id,0);
   this.log(id,0,1,actor,'created','创建了合作城市',0,[],[]);this.snapshot(this.city(id),'开城纪念','milestone');
   return {cityId:id};
  });
 }
 list(actor){return this.db.prepare('SELECT c.id,c.revision,c.updated,m.role FROM cities c JOIN members m ON m.city=c.id WHERE m.actor=? ORDER BY c.updated DESC').all(actor.id).map(c=>({...c,name:decodeState(this.city(c.id).state).districtName}));}
 deleteCity(id,actor){
  return this.transaction(()=>{
   const member=this.member(id,actor.id);this.city(id);
   if(member.role!=='owner')fail('只有房主可以永久删除合作城市','FORBIDDEN',403);
   for(const table of ['commands','revisions','logs','snapshots','invites','members'])this.db.prepare(`DELETE FROM ${table} WHERE city=?`).run(id);
   this.db.prepare('DELETE FROM cities WHERE id=?').run(id);
   return {ok:true};
  });
 }
 invite(id,actor,{reuse=false}={}){return this.transaction(()=>{
  if(this.member(id,actor.id).role!=='owner')fail('只有房主可以邀请新成员','FORBIDDEN',403);
  const current=this.db.prepare('SELECT * FROM invites WHERE city=? AND expires>? AND display_code IS NOT NULL ORDER BY expires DESC LIMIT 1').get(id,this.now());
  if(reuse&&current)return {code:current.display_code,expires:current.expires};
  // Older invites only stored a hash; keep those links valid until their original expiry.
  this.db.prepare(reuse?'DELETE FROM invites WHERE city=? AND expires<=?':'DELETE FROM invites WHERE city=?').run(...(reuse?[id,this.now()]:[id]));
  const code=token(),expires=this.now()+86400000;
  this.db.prepare('INSERT INTO invites(code,city,expires,display_code) VALUES(?,?,?,?)').run(hash(code),id,expires,code);
  return {code,expires};
 });}
 resolveInvitation(code){
  if(!okText(code,100))fail('邀请码无效','INVITE_INVALID',410);
  const invitation=this.db.prepare('SELECT city,expires FROM invites WHERE code=?').get(hash(code));
  if(!invitation||invitation.expires<=this.now())fail('邀请已失效，请让房主发送新的邀请链接','INVITE_INVALID',410);
  return invitation;
 }
 invitationPreview(code){
  const invitation=this.resolveInvitation(code),city=this.city(invitation.city),state=decodeState(city.state);
  return {name:state.districtName,host:this.db.prepare('SELECT name FROM users WHERE id=?').get(city.owner).name,
   population:state.stats.population,mapSize:state.mapSize,buildings:state.buildings.length,
   memberCount:this.db.prepare('SELECT count(*) AS n FROM members WHERE city=?').get(city.id).n,maxMembers:4,expires:invitation.expires};
 }
 visit(code,since=-1){
  // The invitation grants a view only. Never create a member or update member presence here.
  const invitation=this.resolveInvitation(code),city=this.city(invitation.city);
  return {revision:city.revision,epoch:city.epoch,paused:!!city.paused,speed:city.speed,updated:city.updated,
   role:'visitor',canEdit:false,...(Number(since)===city.revision?{}:{state:decodeState(city.state)})};
 }
 join(code,actor){return this.transaction(()=>{const i=this.resolveInvitation(code);if(!this.db.prepare('SELECT 1 FROM members WHERE city=? AND actor=?').get(i.city,actor.id)){
   if(this.db.prepare('SELECT count(*) AS n FROM members WHERE city=?').get(i.city).n>=4)fail('城市已满，最多 4 位成员');
   this.db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(i.city,actor.id,'builder',this.now());
  }return {cityId:i.city};});}
 remove(id,actor,memberId){return this.transaction(()=>{if(this.member(id,actor.id).role!=='owner'||memberId===actor.id)fail('只有房主可以移除其他成员','FORBIDDEN',403);this.db.prepare('DELETE FROM members WHERE city=? AND actor=?').run(id,memberId);this.db.prepare('DELETE FROM invites WHERE city=?').run(id);return {ok:true};});}
 view(id,actor,since=-1){
  const m=this.member(id,actor.id);const time=this.now();this.db.prepare('UPDATE members SET seen=? WHERE city=? AND actor=?').run(time,id,actor.id);
  const c=this.city(id),last=this.db.prepare('SELECT actor,reversible FROM revisions WHERE city=? AND revision=?').get(id,c.revision);
  return {cityId:id,epoch:c.epoch,revision:c.revision,checksum:c.checksum,role:m.role,paused:!!c.paused,speed:c.speed,updated:c.updated,
   canUndo:!!last?.reversible&&last.actor===actor.id&&!isBankrupt(decodeState(c.state)),
   ...(Number(since)===c.revision?{}:{state:decodeState(c.state),...(this.renderPlans.get(id)?.revision===c.revision?{renderPlans:this.renderPlans.get(id).plans}:{})}),
   members:this.db.prepare('SELECT u.id,u.name,m.role,m.seen FROM members m JOIN users u ON u.id=m.actor WHERE m.city=?').all(id).map(u=>({...u,online:time-u.seen<10000})),
  };
 }
 log(city,revision,epoch,actor,kind,message,cost,cells,objects){this.db.prepare('INSERT INTO logs(city,revision,epoch,actor,name,kind,message,cost,cells,objects,time) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(city,revision,epoch,actor.id,actor.name,kind,message,cost,json(cells),json(objects),this.now());}
 logs(id,actor,before=Number.MAX_SAFE_INTEGER){this.member(id,actor.id);return this.db.prepare('SELECT * FROM logs WHERE city=? AND id<? ORDER BY id DESC LIMIT 50').all(id,Number(before)||Number.MAX_SAFE_INTEGER).map(l=>({...l,cells:parse(l.cells),objects:parse(l.objects)}));}
 snapshot(c,name,kind){const id=randomUUID();this.db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,?,?,?,?)').run(id,c.id,c.epoch,c.revision,name,kind,c.state,c.checksum,this.now());return id;}
 snapshots(id,actor){this.member(id,actor.id);return this.db.prepare('SELECT id,name,kind,epoch,revision,time FROM snapshots WHERE city=? ORDER BY time DESC').all(id);}
 getSnapshot(id,actor,snapshotId){this.member(id,actor.id);const row=this.db.prepare('SELECT * FROM snapshots WHERE city=? AND id=?').get(id,snapshotId);if(!row||hash(row.state)!==row.checksum)fail('存档不存在或已损坏');return row;}
 exportSnapshot(id,actor,snapshotId){const c=snapshotId?this.getSnapshot(id,actor,snapshotId):(this.member(id,actor.id),this.city(id));return hydrate(decodeState(c.state)).serialize();}
 command(id,actor,cmd,prepared=null){
  if(!cmd||!okText(cmd.commandId,80)||!integer(cmd.epoch)||!integer(cmd.baseRevision))fail('操作标识无效');validate(cmd.method,cmd.args);
  return this.transaction(()=>{
   const member=this.member(id,actor.id),c=this.city(id),requestHash=hash(json(cmd));
   const old=this.db.prepare('SELECT * FROM commands WHERE city=? AND epoch=? AND actor=? AND id=?').get(id,cmd.epoch,actor.id,cmd.commandId);
   if(old){if(old.request_hash!==requestHash)fail('操作标识已被其他请求使用','ID_REUSED',409);return {...parse(old.result),duplicate:true};}
   const remember=result=>{this.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?)').run(id,cmd.epoch,actor.id,cmd.commandId,requestHash,json(result));return result;};
   const reject=(message,code='TARGET_CHANGED')=>remember({ok:false,message,code,revision:c.revision,epoch:c.epoch});
   if(c.epoch!==cmd.epoch)return reject('城市已恢复到另一份存档，请同步后重新操作','CITY_RESTORED');
   if(prepared&&(prepared.revision!==c.revision||prepared.checksum!==c.checksum))return reject('城市进度在计算期间已变化，请同步后重试','STALE');
   if(OWNER_METHODS.includes(cmd.method)&&member.role!=='owner')return reject('这项全城操作需要房主进行','FORBIDDEN');
   const base=this.db.prepare('SELECT state FROM revisions WHERE city=? AND revision=? AND epoch=?').get(id,cmd.baseRevision,c.epoch);
   if(!base)return reject('预览已过期，请同步城市后重试','STALE');
   const sim=hydrate(decodeState(c.state)),before=structuredClone(sim.state),baseState=decodeState(base.state),baseSim=hydrate(baseState),[method,args]=[cmd.method,cmd.args];
   if(isBankrupt(sim.state)&&!['restoreSnapshot','saveSnapshot','setCityIdentity','setClock'].includes(method))return reject(BANKRUPTCY_MESSAGE,'BANKRUPT');
   let beforeOffer,offer,cells=[];
   try{
    beforeOffer=plan(baseSim,method,args);offer=plan(sim,method,args);
    if(beforeOffer&&!beforeOffer.valid)return reject(beforeOffer.reason,'INVALID');
    cells=affected(baseState,method,args,beforeOffer);
    if(cells.some(p=>json(cellShape(baseState,p))!==json(cellShape(sim.state,p))))return reject('这里刚有新的建设或调整，请查看最新位置后重试');
    if(offer){if(!offer.valid)return reject(offer.reason,'INVALID');if(offer.cost!==beforeOffer.cost||json(offer.cells)!==json(beforeOffer.cells))return reject('建设范围或价格已变化，请重新确认');}
    if(!['build','upgradeAllRoads','rotateBuilding','setBuildingActive'].includes(method)&&cmd.baseRevision!==c.revision)return reject('城市进度已更新，请查看后再次确认');
   }catch(e){if(e.code)throw e;return reject('操作参数或建设范围无效','INVALID');}
   let result,epoch=c.epoch,paused=c.paused,speed=c.speed;
   if(method==='undo'){
    const last=this.db.prepare('SELECT * FROM revisions WHERE city=? AND revision=?').get(id,c.revision),prior=this.db.prepare('SELECT state FROM revisions WHERE city=? AND revision=? AND epoch=?').get(id,c.revision-1,c.epoch);
    if(!last?.reversible||last.actor!==actor.id||!prior)return reject('之后已有其他建设或城市进展，不能直接撤销');
    sim.state=decodeState(prior.state);result={ok:true,message:'已撤销自己的最近一次建设'};
   }else if(method==='setClock'){if(isBankrupt(sim.state)&&!args[0].paused)return reject(BANKRUPTCY_MESSAGE);paused=args[0].paused?1:0;speed=args[0].speed;result={ok:true,message:paused?'城市已暂停':'城市已继续 · '+speed+' 倍速'};}
   else if(method==='saveSnapshot'){
    if(this.db.prepare("SELECT count(*) AS n FROM snapshots WHERE city=? AND kind='manual'").get(id).n>=50)return reject('纪念存档已达 50 份，请先导出保留','LIMIT');
    result={ok:true,message:'纪念存档已保存',snapshotId:this.snapshot(c,args[0],'manual')};
   }else if(method==='restoreSnapshot'){
    const snapshot=this.getSnapshot(id,actor,args[0]);this.snapshot(c,'恢复前 · '+new Date(this.now()).toLocaleString('zh-CN'),'before-restore');sim.state=decodeState(snapshot.state);epoch++;paused=1;result={ok:true,message:'已恢复城市，恢复前的进度已备份；城市已暂停'};
   }else if(prepared){sim.state=prepared.state;result=prepared.result;}
   else{try{result=sim[method](...args);}catch{return reject('操作参数无效','INVALID');}}
   if(!result?.ok)return reject(result?.message||'无法完成操作','INVALID');
   if(isBankrupt(sim.state)&&!isBankrupt(before))this.snapshot(c,'破产前的城市','before-bankruptcy');
   if(isBankrupt(sim.state))paused=1;
   const revision=c.revision+1,state=encodeState(sim.state),checksum=hash(state),time=this.now();
   this.db.prepare('UPDATE cities SET epoch=?,revision=?,state=?,checksum=?,paused=?,speed=?,updated=?,next_tick=? WHERE id=?').run(epoch,revision,state,checksum,paused,speed,time,method==='setClock'||method==='restoreSnapshot'?time+3000/speed:c.next_tick,id);
   const reversible=['build','rotateBuilding','upgradeAllRoads'].includes(method);
   this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?,?,?)').run(id,revision,epoch,state,actor.id,reversible?1:0);
   const objects=[...new Set(cells.flatMap(p=>[before.tiles[gridIndex(before,p.x,p.y)].buildingId,sim.state.tiles[gridIndex(sim.state,p.x,p.y)].buildingId]).filter(v=>v!=null))];
   this.log(id,revision,epoch,actor,method,result.message||methodLabels[method],before.money-sim.state.money,cells,objects);
   this.maintenance(this.city(id));
   return remember({...result,revision,epoch});
  });
 }
 commandAsync(id,actor,cmd){
  const previous=this.commandQueues.get(id)||Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
   if(!cmd||!okText(cmd.commandId,80)||!integer(cmd.epoch)||!integer(cmd.baseRevision))fail('操作标识无效');validate(cmd.method,cmd.args);
   if(['undo','setClock','saveSnapshot','restoreSnapshot'].includes(cmd.method))return this.command(id,actor,cmd);
   for(let attempt=0;attempt<3;attempt++){
    const member=this.member(id,actor.id),c=this.city(id);
    const known=this.db.prepare('SELECT 1 FROM commands WHERE city=? AND epoch=? AND actor=? AND id=?').get(id,cmd.epoch,actor.id,cmd.commandId);
    if(known||c.epoch!==cmd.epoch||(OWNER_METHODS.includes(cmd.method)&&member.role!=='owner'))return this.command(id,actor,cmd);
    this.jobs??=new SimulationJobs();
    const computed=await this.jobs.run('command',{cityId:id,state:decodeState(c.state),method:cmd.method,args:cmd.args});
    if(this.closed)throw Error('City store closed');
    const current=this.city(id);
    if(current.revision!==c.revision||current.checksum!==c.checksum)continue;
    const result=this.command(id,actor,cmd,{...computed,revision:c.revision,checksum:c.checksum});
    if(result.ok)this.renderPlans.set(id,{revision:result.revision,plans:computed.renderPlans});
    return result;
   }
   fail('城市进度更新较频繁，请同步后重试','STALE',409);
  });
  this.commandQueues.set(id,task);
  return task.finally(()=>{if(this.commandQueues.get(id)===task)this.commandQueues.delete(id);});
 }
 maintenance(c){
  this.db.prepare('DELETE FROM revisions WHERE city=? AND revision<?').run(c.id,c.revision-512);
  const latest=this.db.prepare("SELECT max(time) AS time FROM snapshots WHERE city=? AND kind='auto'").get(c.id).time;
  if(latest==null||this.now()-latest>=300000){this.snapshot(c,'自动检查点','auto');this.db.prepare("DELETE FROM snapshots WHERE city=? AND kind='auto' AND id NOT IN (SELECT id FROM snapshots WHERE city=? AND kind='auto' ORDER BY time DESC LIMIT 24)").run(c.id,c.id);}
  const day=this.db.prepare("SELECT max(time) AS time FROM snapshots WHERE city=? AND kind='daily'").get(c.id).time;
  if(day==null||this.now()-day>=86400000){this.snapshot(c,'每日存档','daily');this.db.prepare("DELETE FROM snapshots WHERE city=? AND kind='daily' AND id NOT IN (SELECT id FROM snapshots WHERE city=? AND kind='daily' ORDER BY time DESC LIMIT 30)").run(c.id,c.id);}
 }
 tickDue(){
  const due=this.db.prepare('SELECT id FROM cities WHERE paused=0 AND next_tick<=?').all(this.now());
  for(const {id} of due)this.transaction(()=>{
   const c=this.city(id);if(c.paused||c.next_tick>this.now())return;
   const online=this.db.prepare('SELECT 1 FROM members WHERE city=? AND seen>?').get(id,this.now()-10000);
   if(!online){this.db.prepare('UPDATE cities SET next_tick=? WHERE id=?').run(this.now()+3000/c.speed,id);return;}
   const sim=hydrate(decodeState(c.state)),milestones={...sim.state.milestones};sim.tick();
   const state=encodeState(sim.state),revision=c.revision+1,time=this.now();
   this.db.prepare('UPDATE cities SET revision=?,state=?,checksum=?,updated=?,next_tick=?,paused=? WHERE id=?').run(revision,state,hash(state),time,time+3000/c.speed,isBankrupt(sim.state)?1:0,id);
   if(isBankrupt(sim.state)&&!isBankrupt(decodeState(c.state)))this.snapshot(c,'破产前的城市','before-bankruptcy');
   this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?,?,?)').run(id,revision,c.epoch,state,'system',0);
   const reached=Object.keys(milestones).filter(k=>!milestones[k]&&sim.state.milestones[k]);
   if(reached.length){this.log(id,revision,c.epoch,{id:'system',name:'城市'},'milestone','达成新的人口里程碑 · '+sim.state.stats.population+' 人',0,[],[]);this.snapshot(this.city(id),'成长纪念 · '+sim.state.stats.population+' 人','milestone');}
   this.maintenance(this.city(id));
  });
 }
 async tickDueAsync(){
  if(this.closed)return;
  const due=this.db.prepare('SELECT id FROM cities WHERE paused=0 AND next_tick<=?').all(this.now()),tasks=[];
  for(const {id} of due){
   if(this.commandQueues.has(id)||this.pendingTicks.has(id))continue;
   const task=this.advanceCityAsync(id).finally(()=>this.pendingTicks.delete(id));
   this.pendingTicks.set(id,task);tasks.push(task);
  }
  // Settle all cities so a failure cannot leave another rejection unhandled.
  const results=await Promise.allSettled(tasks);
  const failed=results.find(result=>result.status==='rejected'&&!result.reason.cancelled);if(failed)throw failed.reason;
 }
 async advanceCityAsync(id){
  const c=this.city(id);if(c.paused||c.next_tick>this.now())return;
  if(!this.db.prepare('SELECT 1 FROM members WHERE city=? AND seen>?').get(id,this.now()-10000)){
   this.db.prepare('UPDATE cities SET next_tick=? WHERE id=? AND revision=?').run(this.now()+3000/c.speed,id,c.revision);return;
  }
  const input=decodeState(c.state),milestones={...input.milestones};this.jobs??=new SimulationJobs();
  const computed=await this.jobs.run('tick',{cityId:id,state:input});
  if(this.closed||this.commandQueues.has(id))return;
  const revision=this.transaction(()=>{
   const current=this.db.prepare('SELECT * FROM cities WHERE id=?').get(id);
   if(!current||current.revision!==c.revision||current.checksum!==c.checksum||current.paused||current.next_tick!==c.next_tick)return;
   const time=this.now();
   if(!this.db.prepare('SELECT 1 FROM members WHERE city=? AND seen>?').get(id,time-10000)){
    this.db.prepare('UPDATE cities SET next_tick=? WHERE id=?').run(time+3000/current.speed,id);return;
   }
   const state=encodeState(computed.state),revision=c.revision+1;
   this.db.prepare('UPDATE cities SET revision=?,state=?,checksum=?,updated=?,next_tick=?,paused=? WHERE id=?').run(revision,state,hash(state),time,time+3000/c.speed,isBankrupt(computed.state)?1:0,id);
   if(isBankrupt(computed.state)&&!isBankrupt(input))this.snapshot(c,'破产前的城市','before-bankruptcy');
   this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?,?,?)').run(id,revision,c.epoch,state,'system',0);
   const reached=Object.keys(milestones).filter(k=>!milestones[k]&&computed.state.milestones[k]);
   if(reached.length){this.log(id,revision,c.epoch,{id:'system',name:'城市'},'milestone','达成新的人口里程碑 · '+computed.state.stats.population+' 人',0,[],[]);this.snapshot(this.city(id),'成长纪念 · '+computed.state.stats.population+' 人','milestone');}
   this.maintenance(this.city(id));return revision;
  });
  if(revision!==undefined)this.renderPlans.set(id,{revision,plans:computed.renderPlans});
 }
 async backupTo(file){await backup(this.db,file);}
 close(){this.closed=true;this.jobs?.close();this.db.close();}
}
