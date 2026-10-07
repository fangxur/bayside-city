import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {backupDatabase} from './backup.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),file=process.env.COOP_DB||path.join(root,'.bayside-data','cities.sqlite');
const db=new DatabaseSync(file,{readOnly:true});try{console.log(await backupDatabase(db,process.env.COOP_BACKUP_DIR||path.join(path.dirname(file),'backups')));}finally{db.close();}
