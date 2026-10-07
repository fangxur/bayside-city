// Explicit integration rehearsal. Uses only a newly created temporary city and loopback port.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,realpath,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {CoopStore} from '../server/coop-store.mjs';
import {unpack,archive} from './release-lib.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),packageFile=process.argv[2];
if(!packageFile)throw Error('请提供待演练发布包路径');
const temporary=await mkdtemp(path.join(os.tmpdir(),'bayside-update-test-')),base=path.join(temporary,'program'),database=path.join(temporary,'data/cities.sqlite');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
let server;
async function update(command,input,expect=0){
 const args=[path.join(root,'deploy/baota/update.mjs'),command,...(input?[input]:[]),'--base',base];
 const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,npm_config_cache:process.env.npm_config_cache||path.join(temporary,'npm-cache')},stdio:'inherit'});const [code]=await once(child,'exit');assert.equal(code,expect,command);
}
async function wizard(expect=0){
 const child=spawn('bash',[path.join(base,'update.sh'),base],{cwd:root,env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,npm_config_cache:process.env.npm_config_cache||path.join(temporary,'npm-cache')},stdio:['ignore','inherit','inherit']});
 const [code]=await once(child,'exit');assert.equal(code,expect,'resumable wizard');
}
async function request(url,body,headers={}){const r=await fetch(`http://127.0.0.1:${port}/api${url}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`,...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function start(){
 server=spawn(process.execPath,['--env-file='+path.join(base,'production.env'),'server.mjs'],{cwd:path.join(base,'app'),stdio:['ignore','ignore','inherit']});
 for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('测试服务退出');try{if((await request('/health')).data.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('测试服务未就绪');
}
async function stop(){if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}server=null;}
try{
 await mkdir(path.join(base,'app'),{recursive:true});await writeFile(path.join(base,'app/server.mjs'),'// old release\n');
 await writeFile(path.join(base,'update.sh'),await readFile(path.join(root,'deploy/baota/update.sh')));
 const initialPackage=await readFile(packageFile),initialFiles=unpack(initialPackage).files;
 for(const [name,data] of initialFiles)if(name.startsWith('deploy/')){const target=path.join(base,'installer',name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);}
 await mkdir(path.join(base,'uploads'));await writeFile(path.join(base,'uploads',path.basename(packageFile)),initialPackage);
 await writeFile(path.join(base,'production.env'),`HOST=127.0.0.1\nPORT=${port}\nPUBLIC_ORIGIN=http://127.0.0.1:${port}\nCOOP_DB=${database}\nCOOP_BACKUP_DIR=${temporary}/backups\n`);
 const initial=new CoopStore(database),guest=initial.session('演练房主'),city=initial.create(guest.actor,{name:'升级保留城市'});initial.close();
 await wizard();assert.equal(JSON.parse(await readFile(path.join(base,'update-state.json'))).phase,'prepared');
 // Simulate the exact legacy marker left behind by a disconnected Baota terminal.
 await mkdir(path.join(base,'.update-wizard-lock'));
 await wizard();assert.equal(JSON.parse(await readFile(path.join(base,'update-state.json'))).phase,'awaiting-verification');
 await start();await wizard();
 const bound=await request('/account/register',{username:'test_owner',password:'only-local-test-password'},{Authorization:'Bearer '+guest.token});assert.equal(bound.status,200);assert.equal(bound.data.actor.id,guest.actor.id);
 const headers={Cookie:bound.cookie,'X-Coop-Actor':guest.actor.id};assert.equal((await request('/cities',undefined,headers)).data[0].id,city.cityId);
 const soloId='solo-upgrade-test-city-0001',solo=await request(`/cities/${city.cityId}/export`,undefined,headers);
 assert.equal((await request('/solo-cities/'+soloId,{revision:0,requestId:'save-before-update-00001',city:solo.data.city},headers)).status,200);
 const build=(id,x,revision)=>request(`/cities/${city.cityId}/commands`,{commandId:id,epoch:1,baseRevision:revision,method:'build',args:['park',[{x,y:29}]]},headers);
 assert((await build('before-update',10,0)).data.ok);
 const {files,manifest}=unpack(await readFile(packageFile));manifest.id+='-rehearsal';files.set('release.json',Buffer.from(JSON.stringify(manifest)));const second=path.join(temporary,'second.tar.gz');await writeFile(second,archive(files));
 await update('prepare',second);const oldPath=await realpath(path.join(base,'app'));
 await wizard(1);assert.equal(await realpath(path.join(base,'app')),oldPath,'running service must block a switch');
 await stop();await update('rollback',undefined,1);assert.equal(await realpath(path.join(base,'app')),oldPath,'cannot return an account database to legacy code');
 await wizard();await start();await wizard();assert((await build('after-update',12,1)).data.ok);await stop();
 await update('rollback');await start();await wizard();
 const view=await request(`/cities/${city.cityId}`,undefined,headers);assert.equal(view.status,200);assert.equal(view.data.role,'owner');assert.equal(view.data.state.buildings.length,2);assert.equal(view.data.state.money,28800);
 const savedSolo=await request('/solo-cities/'+soloId,undefined,headers);assert.equal(savedSolo.status,200);assert.equal(savedSolo.data.revision,1);
 console.log('更新演练通过：分阶段重开终端、旧向导锁恢复、运行时拒绝切换、旧身份绑定、单人/合作城市保留、版本验收与兼容回退。');
}finally{await stop();await rm(temporary,{recursive:true,force:true});}
