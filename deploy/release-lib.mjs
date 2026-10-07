import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mkdir,writeFile,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const safe = name => /^[A-Za-z0-9_./-]+$/.test(name) && !name.startsWith('/') && name.split('/').every(part=>part && part!=='.' && part!=='..' && !part.startsWith('.'));
export function archive(files) {
 const parts=[];
 for(const [name,data] of files){
  if(!safe(name)||Buffer.byteLength(name)>100)throw Error('不支持的发布文件名：'+name);
  const header=Buffer.alloc(512);header.write(name,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header[156]=48;header.write('ustar\0',257);header.write('00',263);
  header.write([...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
  parts.push(header,data,Buffer.alloc((512-data.length%512)%512));
 }
 return gzipSync(Buffer.concat([...parts,Buffer.alloc(1024)]));
}
export function unpack(data) {
 const tar=gunzipSync(data,{maxOutputLength:128*1024*1024}),files=new Map();let offset=0;
 while(offset+512<=tar.length){
  const h=tar.subarray(offset,offset+512);if(h.every(b=>b===0))break;
  const name=h.subarray(0,100).toString().split('\0')[0],size=parseInt(h.subarray(124,136).toString(),8),checksum=parseInt(h.subarray(148,156).toString(),8);
  const actual=[...h].reduce((sum,b,i)=>sum+(i>=148&&i<156?32:b),0);
  if(checksum!==actual||!safe(name)||h[156]!==48||h.subarray(345,500).some(b=>b!==0)||!Number.isSafeInteger(size)||size<0||offset+512+size>tar.length||files.has(name))throw Error('发布包包含无效路径、链接、重复文件或损坏数据');
  files.set(name,tar.subarray(offset+512,offset+512+size));offset+=512+Math.ceil(size/512)*512;
 }
 const manifest=JSON.parse(files.get('release.json')?.toString()||'null');
 if(manifest?.format!==1||!/^bayside-[\w-]+$/.test(manifest.id)||!manifest.files||manifest.accounts!==1)throw Error('不是受支持的湾畔市发布包');
 if(files.size!==Object.keys(manifest.files).length+1)throw Error('发布包文件清单不一致');
 for(const [name,hash] of Object.entries(manifest.files))if(!files.has(name)||sha256(files.get(name))!==hash)throw Error('发布包校验失败：'+name);
 for(const name of ['server.mjs','package.json','package-lock.json','server/coop-auth.mjs','deploy/baota/update.mjs'])if(!files.has(name))throw Error('发布包缺少 '+name);
 return {manifest,files};
}
export async function extract(files,directory) {
 await mkdir(directory,{recursive:false});
 for(const [name,data] of files){const target=path.join(directory,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data,{flag:'wx',mode:0o644});}
}
export async function verifyFiles(directory,manifest) {
 for(const [name,hash] of Object.entries(manifest.files)){
  if(!safe(name))throw Error('文件清单包含无效路径');
  const file=path.join(directory,name),info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||sha256(await readFile(file))!==hash)throw Error('文件被修改或损坏：'+name);
 }
}
