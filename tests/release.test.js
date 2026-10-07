import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {archive,unpack,extract,verifyFiles,sha256} from '../deploy/release-lib.mjs';
function fixture(){const files=new Map(['server.mjs','package.json','package-lock.json','server/coop-auth.mjs','deploy/baota/update.mjs'].map(name=>[name,Buffer.from('test '+name)]));const manifest={format:1,id:'bayside-test',accounts:1,files:Object.fromEntries([...files].map(([name,data])=>[name,sha256(data)]))};files.set('release.json',Buffer.from(JSON.stringify(manifest)));return {files,manifest};}
test('release archive verifies every file and detects changed or truncated content',async t=>{
 const {files,manifest}=fixture(),packed=archive(files),decoded=unpack(packed);assert.deepEqual(decoded.manifest,manifest);
 const base=await mkdtemp(path.join(os.tmpdir(),'bayside-release-'));t.after(()=>rm(base,{recursive:true,force:true}));const dir=path.join(base,'release');await extract(decoded.files,dir);await verifyFiles(dir,manifest);
 await writeFile(path.join(dir,'server.mjs'),'changed');await assert.rejects(verifyFiles(dir,manifest),/文件被修改/);
 files.set('server.mjs',Buffer.from('corrupt'));assert.throws(()=>unpack(archive(files)),/校验失败/);assert.throws(()=>unpack(packed.subarray(0,-20)));
});
test('archives refuse traversal, links, duplicate members and missing files before extraction',()=>{
 const {files}=fixture();assert.throws(()=>archive(new Map([['../outside',Buffer.from('bad')]])),/文件名/);
 const packed=archive(files),tar=gunzipSync(packed);tar[156]=50;tar.fill(32,148,156);const sum=[...tar.subarray(0,512)].reduce((a,b)=>a+b,0);tar.write(sum.toString(8).padStart(6,'0')+'\0 ',148);assert.throws(()=>unpack(gzipSync(tar)),/无效路径/);
 const original=gunzipSync(packed);assert.throws(()=>unpack(gzipSync(Buffer.concat([original.subarray(0,1024),original]))),/重复文件/);
 files.delete('server.mjs');assert.throws(()=>unpack(archive(files)),/清单/);
});
