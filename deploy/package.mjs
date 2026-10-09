import {readFile,readdir,mkdtemp,mkdir,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {archive,unpack,sha256} from './release-lib.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=new Map();
async function add(name){const info=await lstat(path.join(root,name));if(info.isSymbolicLink())throw Error('发布包不能包含软链接：'+name);if(info.isDirectory()){for(const entry of (await readdir(path.join(root,name))).sort())if(!entry.startsWith('.'))await add(name+'/'+entry);}else if(info.isFile())files.set(name,await readFile(path.join(root,name)));}
for(const name of ['src','server','assets','deploy','docs','tests','tools/optimize-sculptures.py','index.html','server.mjs','package.json','package-lock.json','README.md','LICENSE'])await add(name);
const pkg=JSON.parse(files.get('package.json')),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
const manifest={format:1,id:'bayside-'+stamp,version:pkg.version,accounts:1,created:new Date().toISOString(),files:Object.fromEntries([...files].map(([name,data])=>[name,sha256(data)]))};
files.set('release.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));const packed=archive(files);unpack(packed);
const output=path.join(root,'artifacts',manifest.id+'.tar.gz');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,packed,{flag:'wx'});await writeFile(output+'.sha256',sha256(packed)+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({file:output,sha256:sha256(packed),bytes:packed.length,files:files.size,release:manifest.id},null,2));
