#!/usr/bin/env node
// Baota owns start/stop. This tool never kills processes or touches another website.
import {readFile,writeFile,mkdir,rename,symlink,lstat,realpath,rm,rmdir,chmod} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {spawnSync} from 'node:child_process';
import {DatabaseSync,backup} from 'node:sqlite';
import {createConnection} from 'node:net';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {unpack,extract,verifyFiles,sha256} from '../release-lib.mjs';

const args=process.argv.slice(2),baseFlag=args.indexOf('--base');
const base=path.resolve(baseFlag<0?'/www/bayside-city':args[baseFlag+1]);
if(baseFlag>=0)args.splice(baseFlag,2);
const [command,input]=args,app=path.join(base,'app'),releases=path.join(base,'releases'),stateFile=path.join(base,'update-state.json');
const stamp=()=>new Date().toISOString().replace(/[-:.]/g,'');
const exists=async file=>{try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
async function saveState(state){const tmp=stateFile+'.tmp';await writeFile(tmp,JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(tmp,stateFile);}
function run(executable,argv,cwd,env=process.env){const r=spawnSync(executable,argv,{cwd,env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('检查失败：'+path.basename(executable)+' '+argv.slice(0,2).join(' '));}
async function offline(){
 const listening=await new Promise((resolve,reject)=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',e=>{if(e.code==='ECONNREFUSED')resolve(false);else reject(e);});socket.setTimeout(2000,()=>{socket.destroy();reject(Error('无法确认端口已停止'));});});
 if(listening)throw Error('请先在宝塔停止 bayside-city 项目，确认停止后再执行此命令。');
}
async function snapshot(target){
 await mkdir(path.dirname(target),{recursive:true,mode:0o700});
 const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,target);}finally{db.close();}
 await chmod(target,0o600);const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('数据库备份校验失败');}finally{check.close();}
 return target;
}
async function preflight(directory){
 const copied=path.join(base,'update-check-'+stamp()+'.sqlite');await snapshot(copied);
 const soloFile=path.join(directory,'server/solo-store.mjs');
 const soloMigration=await exists(soloFile)?`const {SoloStore}=await import(${JSON.stringify(pathToFileURL(soloFile).href)});new SoloStore(s);`:'';
 const script=`import {CoopStore} from ${JSON.stringify(pathToFileURL(path.join(directory,'server/coop-store.mjs')).href)};import {CoopAuth} from ${JSON.stringify(pathToFileURL(path.join(directory,'server/coop-auth.mjs')).href)};const s=new CoopStore(process.argv[1]);try{new CoopAuth(s);${soloMigration}for(const c of s.db.prepare('SELECT id FROM cities').all())s.city(c.id);if(s.db.prepare('PRAGMA foreign_key_check').all().length)throw Error('外键检查失败');if(s.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('数据库完整性检查失败');console.log('存档副本迁移检查通过');}finally{s.close();}`;
 try{run(process.execPath,['--input-type=module','-e',script,copied],directory);}finally{for(const suffix of ['', '-wal','-shm'])await rm(copied+suffix,{force:true});}
}
async function switchTo(target){
 const temporary=path.join(base,'app-link-'+stamp());await symlink(target,temporary);try{await rename(temporary,app);}catch(e){await rm(temporary,{force:true});throw e;}
}
let database,port;
try{
 if(!['prepare','activate','verify','rollback'].includes(command))throw Error('用法：node update.mjs prepare 发布包.tar.gz [--base /www/bayside-city]；或 activate / verify / rollback');
 loadEnvFile(path.join(base,'production.env'));database=process.env.COOP_DB;port=Number(process.env.PORT||4173);
 if(!database||!path.isAbsolute(database)||!await exists(database))throw Error('production.env 中 COOP_DB 必须指向现有的正式数据库');
 const actualDB=await realpath(database),actualBase=await realpath(base);
 if(actualDB.startsWith(actualBase+path.sep))throw Error('正式存档必须放在程序目录之外，例如 /www/bayside-data/cities.sqlite');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 无效');
 if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('此宝塔更新脚本要求 HOST=127.0.0.1');
 const configuredOrigin=process.env.PUBLIC_ORIGIN;if(!configuredOrigin)throw Error('请在 production.env 配置 PUBLIC_ORIGIN');
 await mkdir(releases,{recursive:true});
 const lock=path.join(base,'.update-lock');try{await mkdir(lock);}catch{throw Error('已有更新任务或上次更新意外中断。确认没有更新进程后，删除空的 .update-lock 目录再重试。');}
 try{
  const state=await exists(stateFile)?await readJSON(stateFile):{};
  if(command==='prepare'){
   if(state.phase==='awaiting-verification')throw Error('上次更新尚未验证，请先执行 verify，或停止项目后 rollback');
   if(!input)throw Error('请指定 tar.gz 发布包');
   const data=await readFile(path.resolve(input)),{manifest,files}=unpack(data),destination=path.join(releases,manifest.id);
   if(state.phase==='verified'&&state.active===manifest.id)throw Error('这已是当前运行版本，无需再次更新');
   console.log('发布包 SHA256：'+sha256(data));
   if(await exists(destination)){await verifyFiles(destination,manifest);}else await extract(files,destination);
   run(process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],destination);
   run(process.platform==='win32'?'npm.cmd':'npm',['run','check'],destination);
   await preflight(destination);
   await saveState({...state,prepared:manifest.id,phase:'prepared'});
   console.log('准备完成：'+manifest.id+'。下一步：宝塔停止项目 → 执行 activate → 宝塔启动项目 → 执行 verify。');
  }
  if(command==='activate'){
   if(state.phase!=='prepared'||!/^bayside-[\w-]+$/.test(state.prepared||''))throw Error('请先 prepare 发布包');
   const destination=path.join(releases,state.prepared),manifest=await readJSON(path.join(destination,'release.json'));
   await verifyFiles(destination,manifest);await offline();
   const backupFile=await snapshot(path.join(process.env.COOP_BACKUP_DIR||path.dirname(database),'before-update',stamp()+'.sqlite'));
   await preflight(destination);await offline();
   const current=await lstat(app);let previous=await realpath(app),moved=false;
   if(!current.isSymbolicLink()){previous=path.join(releases,'legacy-'+stamp());await rename(app,previous);moved=true;}
   else if(!previous.startsWith((await realpath(releases))+path.sep))throw Error('app 链接不在 releases 目录内，请人工检查');
   try{await saveState({...state,previous,active:state.prepared,backup:backupFile,phase:'awaiting-verification'});await switchTo(destination);}
   catch(e){if(moved&&!await exists(app))await rename(previous,app);await saveState(state);throw e;}
   console.log('程序已切换；升级前备份：'+backupFile+'。现在在宝塔启动项目，再执行 verify。');
  }
  if(command==='verify'){
   if(state.phase!=='awaiting-verification'&&state.phase!=='verified')throw Error('没有待验证版本');
   const response=await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(5000)}),health=await response.json();
   if(!response.ok||!health.ok||health.release!==state.active||health.accounts!==1)throw Error('新进程的版本或健康检查不匹配');
   const publicResponse=await fetch(new URL('/api/health',configuredOrigin),{signal:AbortSignal.timeout(15000)}),publicHealth=await publicResponse.json();
   if(!publicResponse.ok||publicHealth.release!==state.active||!publicHealth.ok)throw Error('域名访问尚未通过，请检查宝塔外网映射、SSL 与项目日志');
   await saveState({...state,phase:'verified'});console.log('本机和域名检查通过，当前版本：'+state.active+'。请刷新游戏页面，用原账号进入城市。');
  }
  if(command==='rollback'){
   if(!state.previous||!await exists(state.previous))throw Error('没有可以切回的上一版程序');
   const previous=await realpath(state.previous);if(!previous.startsWith((await realpath(releases))+path.sep))throw Error('回退目标不在 releases 内');
   await offline();
   const oldManifest=await exists(path.join(previous,'release.json'))?await readJSON(path.join(previous,'release.json')):null;
   const db=new DatabaseSync(database,{readOnly:true});let accounts=0;
   try{if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='accounts'").get())accounts=db.prepare('SELECT count(*) AS n FROM accounts').get().n;}finally{db.close();}
   if(accounts&&oldManifest?.accounts!==1)throw Error('已创建账号，不能回退到不支持账号的旧版；请保留存档并使用修复版程序。脚本不会恢复旧数据库或删除账号。');
   if(oldManifest)await verifyFiles(previous,oldManifest);
   const backupFile=await snapshot(path.join(process.env.COOP_BACKUP_DIR||path.dirname(database),'before-update','rollback-'+stamp()+'.sqlite'));
   const current=await realpath(app);await switchTo(previous);await saveState({...state,previous:current,active:oldManifest?.id||'legacy',backup:backupFile,phase:oldManifest?'awaiting-verification':'rolled-back'});
   console.log('已切回上一版程序，正式数据库保持当前进度。请在宝塔启动项目。'+(oldManifest?'然后执行 verify。':'请打开网页检查游戏；旧版没有健康接口。'));
  }
 }finally{await rmdir(lock);}
}catch(e){console.error('更新未完成：'+e.message);process.exitCode=1;}
