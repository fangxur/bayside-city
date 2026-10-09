import {MAX_MAP_SIZE} from '../src/grid.js';

// Ephemeral collaboration hints never enter the city database or command log.
export class CoopPresence{
 constructor(store){this.store=store;this.cities=new Map();}
 exchange(id,actor,data){
  this.store.member(id,actor.id);
  const city=this.store.db.prepare('SELECT epoch FROM cities WHERE id=?').get(id);
  const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<MAX_MAP_SIZE&&p.y<MAX_MAP_SIZE;
  if(!data||data.epoch!==city?.epoch||!(data.cursor===null||point(data.cursor))||!Array.isArray(data.cells)||data.cells.length>256||!data.cells.every(point)||typeof data.tool!=='string'||data.tool.length>40){
   throw Object.assign(Error('协作位置已过期或无效'),{status:400});
  }
  const now=this.store.now();
  for(const [key,entries] of this.cities){for(const [member,p] of entries)if(now-p.updated>5000)entries.delete(member);if(!entries.size)this.cities.delete(key);}
  const entries=this.cities.get(id)||new Map();this.cities.set(id,entries);
  if(data.cursor)entries.set(actor.id,{id:actor.id,name:actor.name,epoch:city.epoch,cursor:{x:data.cursor.x,y:data.cursor.y},cells:data.cells.map(p=>({x:p.x,y:p.y})),tool:data.tool,valid:data.valid!==false,updated:now});
  else entries.delete(actor.id);
  const members=new Set(this.store.db.prepare('SELECT actor FROM members WHERE city=?').all(id).map(m=>m.actor));
  for(const [member,p] of entries)if(!members.has(member)||p.epoch!==city.epoch)entries.delete(member);
  return {presence:[...entries.values()].filter(p=>p.id!==actor.id)};
 }
}
