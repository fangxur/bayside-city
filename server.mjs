import {createServer} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CoopStore} from './server/coop-store.mjs';
import {backupDatabase} from './server/backup.mjs';
import {coopHttp} from './server/coop-http.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const store=new CoopStore(process.env.COOP_DB||path.join(root,'.bayside-data','cities.sqlite'));
let release='development';try{release=JSON.parse(await readFile(path.join(root,'release.json'),'utf8')).id;}catch{}
const api=coopHttp(store,{release,origin:process.env.PUBLIC_ORIGIN,lan:['0.0.0.0','::'].includes(host)});
let backingUp=false;
async function makeBackup(){if(backingUp||store.file===':memory:')return;backingUp=true;try{await backupDatabase(store.db,process.env.COOP_BACKUP_DIR||path.join(path.dirname(store.file),'backups'));}catch(e){console.error('合作城市备份失败:',e.message);}finally{backingUp=false;}}
const backups=setInterval(makeBackup,300000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');if(await api(req,res,url))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';
  const allowed=relative==='/index.html'||['/src/','/assets/','/node_modules/three/','/artifacts/'].some(prefix=>relative.startsWith(prefix));
  const type=types[path.extname(relative)];
  if(!allowed||!type||relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
  const file=await realpath(path.resolve(root,'.'+relative));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(file)).isFile())throw Error('Not found');const content=await readFile(file);
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end('Not found');}
});
const tick=setInterval(()=>{store.tickDueAsync().catch(e=>console.error('Cooperative simulation paused by storage error:',e.message));},500);
server.listen(port,host,()=>console.log(`湾畔市 — http://${host}:${port}`));
server.on('error',e=>{console.error(e.message);clearInterval(tick);clearInterval(backups);store.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(tick);server.close(()=>{store.close();process.exit(0);});server.closeIdleConnections();});
