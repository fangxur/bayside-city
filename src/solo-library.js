const PREFIX='bayside-solo:';
export const cityId=()=>globalThis.crypto.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const storageFull=error=>error?.name==='QuotaExceededError'||error?.code===22||error?.code===1014||/quota|storage full|存储空间/i.test(error?.message||'');

// A durable outbox belongs to an actor, not whichever account next logs into this browser.
export class SoloLibrary {
 constructor(client,{storage=globalThis.localStorage,onStatus=()=>{}}={}){this.client=client;this.storage=storage;this.onStatus=onStatus;this.records=new Map();this.sending=new Map();this.deleting=new Set();this.bindingCandidate=null;}
 owner(){return this.client.identity?.account?this.client.identity.actor.id:null;}
 key(record){return PREFIX+record.owner+':'+record.id;}
 persist(record){
  const key=this.key(record),write=()=>this.storage.setItem(key,JSON.stringify({...record,cacheLimited:undefined}));
  try{write();}
  catch(error){
   if(!storageFull(error))throw error;
   const disposable=[];
   for(let i=0;i<this.storage.length;i++){
    const candidate=this.storage.key(i);if(!candidate?.startsWith(PREFIX)||candidate===key)continue;
    try{const cached=JSON.parse(this.storage.getItem(candidate));if(cached.revision>0&&!cached.dirty&&!cached.pending&&!cached.error&&!cached.conflictBackup)disposable.push({key:candidate,savedAt:cached.snapshot?.savedAt||cached.updated||''});}catch{}
   }
   disposable.sort((a,b)=>String(a.savedAt).localeCompare(String(b.savedAt)));
   let last=error;
   for(const cached of disposable){this.storage.removeItem(cached.key);this.records.delete(cached.key);try{write();last=null;break;}catch(next){last=next;if(!storageFull(next))throw next;}}
   if(last){const friendly=Error('浏览器本地存储空间不足。当前城市仍在页面中，请先导出存档或等待账号同步完成。');friendly.name='QuotaExceededError';throw friendly;}
  }
  delete record.cacheLimited;this.records.set(key,record);
 }
 cache(record){
  try{this.persist(record);return true;}
  catch(error){if(!storageFull(error))throw error;record.cacheLimited=true;this.records.set(this.key(record),record);return false;}
 }
 check(record){if(!this.owner()||record.owner!==this.owner())throw Error('请登录这座城市所属的账号');}
 create(snapshot){
  const owner=this.owner();if(!owner)throw Error('请先登录账号');
  const record={id:cityId(),owner,revision:0,snapshot,dirty:true,pending:null,error:null};this.persist(record);return record;
 }
 async bind(snapshot){
  const owner=this.owner();if(!owner)throw Error('请先登录账号');
  let candidate=this.bindingCandidate;
  if(!candidate||candidate.record.owner!==owner||candidate.record.snapshot.city!==snapshot.city){
   candidate={record:{id:cityId(),owner,revision:0,snapshot,dirty:true,pending:null,error:null},requestId:cityId()};
   this.bindingCandidate=candidate;
  }
  const {record,requestId}=candidate;
  this.onStatus(record,'正在绑定并保存单人城市到账号…');
  const result=await this.client.request('/solo-cities/'+record.id,{method:'POST',body:{revision:0,requestId,city:snapshot.city}});
  this.check(record);record.revision=result.revision;record.snapshot=snapshot;record.dirty=false;record.pending=null;record.error=null;
  if(this.cache(record))this.onStatus(record,'已保存到账号 · 单人城市');
  else this.onStatus(record,'已保存到账号 · 正在释放旧的本机缓存');
  this.bindingCandidate=null;return record;
 }
 save(record,snapshot){
  this.check(record);if(this.deleting.has(this.key(record)))throw Error('这座城市正在删除');const changed=record.snapshot.city!==snapshot.city;
  if(changed&&record.pending&&!record.pending.city)record.pending.city=record.snapshot.city;
  record.dirty ||= changed;record.snapshot=snapshot;
  const cached=this.cache(record);
  this.onStatus(record,record.error||(cached?(record.dirty||record.pending?'已保存到本机 · 等待同步到账号':'已保存到账号 · 单人城市'):'浏览器空间不足 · 正在直接同步到账号'));
  if(!cached&&record.dirty)this.flush(record).catch(()=>{});
 }
 local(){
  const prefix=PREFIX+this.owner()+':',records=[];
  for(let i=0;i<this.storage.length;i++){
   const key=this.storage.key(i);if(!key?.startsWith(prefix))continue;
   try{const record=this.records.get(key)||JSON.parse(this.storage.getItem(key));if(record.owner===this.owner()&&!record.conflictBackup)records.push(record);}catch{}
  }
  return records;
 }
 async list(){
  if(!this.owner())return [];
  const owner=this.owner(),local=this.local();let remote;
  try{remote=await this.client.request('/solo-cities');}catch(e){if(local.length&&![401,403].includes(e.status)&&e.code!=='ACCOUNT_CHANGED')return local.map(r=>({...r,offline:true}));throw e;}
  if(owner!==this.owner())throw Error('账号已切换，请重新打开城市列表');
  const rows=new Map(remote.map(row=>[row.id,{...row,owner}]));
  for(const record of local)if(record.dirty||record.pending||!rows.has(record.id))rows.set(record.id,record);
  return [...rows.values()].sort((a,b)=>String(b.snapshot?.savedAt||b.updated).localeCompare(String(a.snapshot?.savedAt||a.updated)));
 }
 async load(id,{remote=false}={}){
  const owner=this.owner(),cached=this.local().find(r=>r.id===id);
  if(cached&&!remote&&(cached.dirty||cached.pending)){this.records.set(this.key(cached),cached);return cached;}
  let data;try{data=await this.client.request('/solo-cities/'+id);}catch(e){if(cached&&!remote&&![401,403].includes(e.status)&&e.code!=='ACCOUNT_CHANGED')return cached;throw e;}
  if(owner!==this.owner())throw Error('账号已切换，请重新打开城市');
  const record={id,owner,revision:data.revision,snapshot:{city:data.city,name:data.name,savedAt:new Date(data.updated).toISOString()},dirty:false,pending:null,error:null};
  this.cache(record);return record;
 }
 async remove(id){
  const owner=this.owner();if(!owner)throw Error('请先登录账号');
  const key=PREFIX+owner+':'+id;
  if(this.sending.has(key)||this.deleting.has(key))throw Error('这座城市仍在同步，请稍后再删除');
  this.deleting.add(key);
  try{
   await this.client.request('/solo-cities/'+id,{method:'DELETE'});
   for(let i=this.storage.length-1;i>=0;i--){const candidate=this.storage.key(i);if(candidate===key||candidate?.startsWith(key+':conflict:'))this.storage.removeItem(candidate);}
   this.records.delete(key);
   if(this.bindingCandidate?.record?.id===id)this.bindingCandidate=null;
   return {ok:true};
  }finally{this.deleting.delete(key);}
 }
 async flush(record){
  this.check(record);const key=this.key(record);
  if(this.deleting.has(key))throw Error('这座城市正在删除');
  if(this.sending.has(key))return this.sending.get(key);
  if(record.error)throw Error(record.error);
  if(!record.dirty&&!record.pending)return true;
  const task=this.send(record);this.sending.set(key,task);
  try{return await task;}finally{this.sending.delete(key);}
 }
 async send(record){
  try{
   if(!record.pending){record.pending={revision:record.revision,requestId:cityId()};this.cache(record);}
   const pending=record.pending,city=pending.city||record.snapshot.city;
   this.onStatus(record,'正在同步单人城市到账号…');
   const result=await this.client.request('/solo-cities/'+record.id,{method:'POST',body:{revision:pending.revision,requestId:pending.requestId,city}});
   this.check(record);
   record.revision=result.revision;record.dirty=record.snapshot.city!==city;record.pending=null;record.error=null;const cached=this.cache(record);
   this.onStatus(record,record.dirty?(cached?'已保存到本机 · 等待同步新进度':'浏览器空间不足 · 正在直接同步新进度'):(cached?'已保存到账号 · 单人城市':'已保存到账号 · 本机缓存空间不足'));return !record.dirty;
  }catch(e){
   if(e.code==='SAVE_CONFLICT'){
    record.error=e.message;
    // Preserve the losing version independently, including when another tab shares this cache.
    this.storage.setItem(this.key(record)+':conflict:'+cityId(),JSON.stringify({...record,conflictBackup:true}));
    this.persist(record);
   }
   this.onStatus(record,e.code==='SAVE_CONFLICT'?'存档版本冲突 · 请打开我的城市':'已保存到本机 · 账号同步未完成');throw e;
  }
 }
 async sync(){
  const records=new Map(this.local().map(record=>[this.key(record),record]));
  for(const [key,record] of this.records)if(record.owner===this.owner())records.set(key,record);
  for(const record of records.values())if(!record.conflictBackup&&!this.deleting.has(this.key(record))&&(record.dirty||record.pending)&&!record.error)try{await this.flush(record);}catch{}
 }
}
