import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,rename,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
export async function backupDatabase(db,directory){
 await mkdir(directory,{recursive:true,mode:0o700});
 const name='city-backup-'+Date.now()+'.sqlite',temporary=path.join(directory,name+'.partial'),target=path.join(directory,name);
 await backup(db,temporary);
 const check=new DatabaseSync(temporary,{readOnly:true});try{const result=check.prepare('PRAGMA integrity_check').get();if(Object.values(result)[0]!=='ok')throw Error('备份校验失败');}finally{check.close();}
 await rename(temporary,target);
 const old=(await readdir(directory)).filter(n=>/^city-backup-\d+\.sqlite$/.test(n)).sort().slice(0,-24);
 for(const n of old)await unlink(path.join(directory,n));return target;
}
