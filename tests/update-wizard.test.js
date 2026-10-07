import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,utimesSync,realpathSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
const wizard=fileURLToPath(new URL('../deploy/baota/update.sh',import.meta.url));
const old='bayside-20260930T160140Z',fresh='bayside-20261001T090000Z';
function fixture(t,{phase='verified',active=old,prepared='',installer=false}={}){
 const base=realpathSync(mkdtempSync(path.join(os.tmpdir(),'bayside-wizard-')));
 t.after(()=>rmSync(base,{recursive:true,force:true}));
 const tools=path.join(base,installer?'installer':'app','deploy/baota');mkdirSync(tools,{recursive:true});mkdirSync(path.join(base,'uploads'));
 writeFileSync(path.join(base,'production.env'),'# test fixture\n');
 writeFileSync(path.join(base,'update-state.json'),JSON.stringify({phase,active,prepared}));
 writeFileSync(path.join(tools,'update.mjs'),`
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,rmdirSync} from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),base=args[args.indexOf('--base')+1],stateFile=path.join(base,'update-state.json'),state=JSON.parse(readFileSync(stateFile));
const lock=path.join(base,'.update-lock');
try{mkdirSync(lock);}catch{console.error('底层更新锁仍被占用');process.exit(1);}
try{
appendFileSync(path.join(base,'calls.jsonl'),JSON.stringify(args)+'\\n');
if(process.env.WIZARD_FAIL===args[0])throw Error('injected '+args[0]+' failure');
if(args[0]==='prepare'){state.phase='prepared';state.prepared=path.basename(args[1],'.tar.gz');}
if(args[0]==='activate'){state.phase='awaiting-verification';state.active=state.prepared;}
if(args[0]==='verify')state.phase='verified';
writeFileSync(stateFile,JSON.stringify(state));
}finally{rmdirSync(lock);}
`);
 const run=(input='',env={})=>spawnSync('bash',[wizard,base],{input,encoding:'utf8',env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,...env}});
 const state=()=>JSON.parse(readFileSync(path.join(base,'update-state.json')));
 const calls=()=>existsSync(path.join(base,'calls.jsonl'))?readFileSync(path.join(base,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse):[];
 const upload=id=>writeFileSync(path.join(base,'uploads',id+'.tar.gz'),'fixture archive');
 return {base,run,state,calls,upload};
}
test('the same command resumes one durable stage per terminal session and skips the active release',t=>{
 const f=fixture(t);f.upload(fresh);f.upload(old);utimesSync(path.join(f.base,'uploads',old+'.tar.gz'),new Date(),new Date('2030-01-01'));
 const prepared=f.run();assert.equal(prepared.status,0,prepared.stderr);assert.match(prepared.stdout,/停止项目/);assert.match(prepared.stdout,/向导现在退出/);assert.equal(f.state().phase,'prepared');assert.equal(f.state().active,old);
 const activated=f.run();assert.equal(activated.status,0,activated.stderr);assert.match(activated.stdout,/启动项目/);assert.equal(f.state().phase,'awaiting-verification');
 const r=f.run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/更新完成/);assert.equal(f.state().active,fresh);
 assert.deepEqual(f.calls().map(c=>c[0]),['prepare','activate','verify']);assert.equal(f.calls()[0][1],path.join(f.base,'uploads',fresh+'.tar.gz'));
 assert.equal(f.run().status,0);assert.equal(f.calls().length,3);assert(!existsSync(path.join(f.base,'.update-wizard-lock')));
});
test('closed standard input does not lose progress or reinstall the prepared package',t=>{
 const f=fixture(t,{installer:true});f.upload(fresh);
 assert.equal(f.run().status,0);assert.equal(f.state().phase,'prepared');assert.deepEqual(f.calls().map(c=>c[0]),['prepare']);
 assert.equal(f.run().status,0);assert.equal(f.state().phase,'awaiting-verification');assert.deepEqual(f.calls().map(c=>c[0]),['prepare','activate']);
 assert.equal(f.run().status,0);assert.equal(f.state().phase,'verified');assert.deepEqual(f.calls().map(c=>c[0]),['prepare','activate','verify']);
});
test('a connected terminal is released after prepare without waiting for a keypress',async t=>{
 const f=fixture(t);f.upload(fresh);
 const child=spawn('bash',[wizard,f.base],{stdio:['pipe','pipe','pipe'],env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH}});
 t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('wizard waited for terminal input'));},5000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);resolve(code);});});
 assert.equal(code,0,output);assert.equal(f.state().phase,'prepared');assert(!existsSync(path.join(f.base,'.update-wizard-lock')));assert(!existsSync(path.join(f.base,'.update-lock')));
});
test('a failed step stops subsequent steps, and retries resume at that stage',t=>{
 const f=fixture(t);f.upload(fresh);
 assert.equal(f.run('\n\n',{WIZARD_FAIL:'prepare'}).status,1);assert.equal(f.state().phase,'verified');assert.deepEqual(f.calls().map(c=>c[0]),['prepare']);
 assert.equal(f.run().status,0);assert.equal(f.state().phase,'prepared');
 assert.equal(f.run('\n\n',{WIZARD_FAIL:'activate'}).status,1);assert.equal(f.state().phase,'prepared');assert(!f.calls().some(c=>c[0]==='verify'));
 assert.equal(f.run().status,0);assert.equal(f.state().phase,'awaiting-verification');
 assert.equal(f.run('\n\n',{WIZARD_FAIL:'verify'}).status,1);assert.equal(f.state().phase,'awaiting-verification');
 assert.equal(f.run('\n').status,0);assert.equal(f.state().phase,'verified');
});
test('pending verification does not prepare a newer uploaded package',t=>{
 const f=fixture(t,{phase:'awaiting-verification',active:old,prepared:old});f.upload(fresh);
 assert.equal(f.run('\n').status,0);assert.equal(f.state().active,old);assert.deepEqual(f.calls().map(c=>c[0]),['verify']);
});
test('older packages and malformed or incomplete state stop before mutation',t=>{
 const f=fixture(t,{active:fresh});f.upload(old);assert.equal(f.run().status,1);assert.deepEqual(f.calls(),[]);
 writeFileSync(path.join(f.base,'update-state.json'),'bad json');assert.equal(f.run().status,1);assert.deepEqual(f.calls(),[]);
 writeFileSync(path.join(f.base,'update-state.json'),JSON.stringify({phase:'prepared',active:old}));assert.equal(f.run().status,1);assert.deepEqual(f.calls(),[]);
});
test('legacy wizard markers do not block resume; active tool locks are never removed or bypassed',t=>{
 const f=fixture(t,{phase:'prepared',prepared:fresh});
 const legacy=path.join(f.base,'.update-wizard-lock'),active=path.join(f.base,'.update-lock');mkdirSync(legacy);mkdirSync(active);
 const blocked=f.run();assert.equal(blocked.status,1);assert.match(blocked.stderr,/底层更新锁/);assert.equal(f.state().phase,'prepared');assert.deepEqual(f.calls(),[]);assert(existsSync(active));assert(existsSync(legacy));
 rmSync(active,{recursive:true});
 const resumed=f.run();assert.equal(resumed.status,0,resumed.stderr);assert.equal(f.state().phase,'awaiting-verification');assert.deepEqual(f.calls().map(c=>c[0]),['activate']);assert(existsSync(legacy),'the wrapper does not delete another process\'s legacy marker');
});
