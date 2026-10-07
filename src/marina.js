import {requiresRoad} from './building-access.js';
import {COMMUNITY_BUILDINGS} from './community-buildings.js';
import {gridIndex,gridNeighbors,gridPoint,inGrid,mapSize} from './grid.js';
// Private yacht purchases never spend city funds. Routes are derived from live water tiles.
export const YACHT_TYPES={motor:{name:'悠游号小游艇',price:8000,color:0xf6efcf},cruiser:{name:'海风号豪华游艇',price:16000,color:0xe5f0ee}};
export const newMarinaLife=()=>({accounts:[],boats:[],nextId:1,lastMonth:0});
const ready=b=>b?.active&&b.progress>=1&&(b.connected||!requiresRoad(b.type))&&b.powered&&b.watered;
export const wealthyHome=b=>b.type==='residential'&&b.population>0&&ready(b)&&(b.level>=3||((b.footprint||1)>1&&b.level>=2));
const adjacent=(state,i)=>{const {x,y}=gridPoint(state,i);return gridNeighbors(state,x,y).map(([nextX,nextY])=>gridIndex(state,nextX,nextY));};
const openWater=(state,i)=>state.tiles[i]?.terrain==='water'&&!state.tiles[i].road&&state.tiles[i].buildingId==null;
// Bridge decks occupy a road tile, but the water channel below remains open to
// boats. Ordinary roads on water are invalid obstructions and stay blocked.
const navigable=(state,i)=>state.tiles[i]?.terrain==='water'&&(!state.tiles[i].road||state.tiles[i].bridge)&&state.tiles[i].buildingId==null;
export const marinaCapacity=b=>{
 const berths=COMMUNITY_BUILDINGS.marina.berths,index=Math.max(0,Math.min(berths.length-1,(b?.level||1)-1));
 return berths[index];
};
export function marinaBerths(state,b){
 const size=b.footprint||2,candidates=new Map(),add=(x,y,depth)=>{
  if(!inGrid(state,x,y))return false;
  const i=gridIndex(state,x,y);if(!openWater(state,i))return false;
  if(!candidates.has(i))candidates.set(i,depth);return true;
 };
 // Higher-level marinas extend their finger piers farther into open water. A
 // ray stops at the first blocked tile so a pier can never jump over land or a
 // bridge just to claim a distant berth.
 for(let offset=0;offset<size;offset++)for(const [sx,sy,dx,dy] of [
  [b.x-1,b.y+offset,-1,0],[b.x+size,b.y+offset,1,0],
  [b.x+offset,b.y-1,0,-1],[b.x+offset,b.y+size,0,1],
 ])for(let depth=1;depth<=4;depth++)if(!add(sx+dx*(depth-1),sy+dy*(depth-1),depth))break;
 return [...candidates].sort((a,b)=>a[1]-b[1]||a[0]-b[0]).slice(0,marinaCapacity(b)).map(([i])=>i);
}
export function waterRoute(state,start,blocked=new Set()){
 if(!navigable(state,start))return [];
 const prev=new Map([[start,null]]),depth=new Map([[start,0]]),queue=[start];let end=start;
 for(let n=0;n<queue.length&&queue.length<state.tiles.length;n++){
  const i=queue[n];if(depth.get(i)>depth.get(end))end=i;
  if(depth.get(i)>=16)continue;
  for(const next of adjacent(state,i))if(!prev.has(next)&&!blocked.has(next)&&navigable(state,next)){prev.set(next,i);depth.set(next,depth.get(i)+1);queue.push(next);}
 }
 const route=[];for(let i=end;i!==null;i=prev.get(i))route.push(i);return route.reverse();
}
export function marinaPlacement(state,b){
 const berths=marinaBerths(state,b),reserved=new Set(state.buildings.filter(v=>v.type==='marina'&&v.id!==b.id).flatMap(v=>marinaBerths(state,v)));
 if(berths.some(i=>reserved.has(i)))return '这段岸线已有其他码头，请留出独立泊位';
 if(berths.length<2)return '码头需要至少两格相邻的开阔水面，请沿岸摆放';
 if(!berths.some(i=>waterRoute(state,i).length>=6))return '码头前方需要至少六格连通航道；桥下可以正常通航';
 return '';
}
export function yachtRoutes(state){
 const life=state.marinaLife||newMarinaLife(),result=[],reserved=new Set(state.buildings.filter(b=>b.type==='marina').flatMap(b=>marinaBerths(state,b)));
 for(const marina of state.buildings.filter(b=>b.type==='marina')){
  const berths=marinaBerths(state,marina),boats=life.boats.filter(b=>b.marinaId===marina.id).sort((a,b)=>a.id-b.id);
  boats.forEach((boat,slot)=>{if(slot>=berths.length)return;const route=waterRoute(state,berths[slot],reserved),bridgeRoutePositions=route.flatMap((tileIndex,index)=>state.tiles[tileIndex]?.bridge?[index]:[]);result.push({boat,marina,berth:berths[slot],route,bridgeRoutePositions,gridSize:mapSize(state),operating:ready(marina)&&route.length>=6&&state.buildings.some(b=>b.id===boat.homeId&&b.population>0)});});
 }
 return result;
}
export function yachtPose(entry,seconds){
 const route=entry.route.length?entry.route:[entry.berth],travel=(route.length-1)*2.5,cycle=24+travel*2;
 let phase=(seconds+entry.boat.id*9)%cycle,distance=0,status='停泊中';
 if(entry.operating&&phase>=24){phase-=24;const returning=phase>=travel;distance=returning?route.length-1-(phase-travel)/2.5:phase/2.5;status=returning?'返港中':'出航中';}
 distance=Math.max(0,Math.min(route.length-1,distance));const a=route[Math.floor(distance)],b=route[Math.min(route.length-1,Math.floor(distance)+1)],f=distance%1;
 const size=entry.gridSize||64,ax=a%size,ay=Math.floor(a/size),bx=b%size,by=Math.floor(b/size),routePosition=Math.round(distance),dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
 // Outbound and returning boats keep to opposite sides of the channel. The
 // offset tapers to zero at both ends so every yacht still meets its berth and
 // turns around without sliding sideways.
 const direction=status==='出航中'?1:status==='返港中'?-1:0,taper=Math.max(0,Math.min(1,distance*2,(route.length-1-distance)*2)),lane=length?.2*taper*direction:0;
 return {x:ax+dx*f+dy/Math.max(1,length)*lane,y:ay+dy*f-dx/Math.max(1,length)*lane,angle:Math.atan2(dx,dy)+(status==='返港中'?Math.PI:0),status:entry.operating?status:'暂停航行',underBridge:entry.bridgeRoutePositions?.includes(routePosition)||false};
}
export function refreshMarinaLife(state){
 const life=state.marinaLife||(state.marinaLife=newMarinaLife()),homes=new Set(state.buildings.filter(b=>b.type==='residential').map(b=>b.id));
 life.accounts=life.accounts.filter(a=>homes.has(a.homeId));life.boats=life.boats.filter(b=>homes.has(b.homeId));
 const marinas=state.buildings.filter(b=>b.type==='marina').sort((a,b)=>a.id-b.id),counts=new Map();
 for(const boat of life.boats){
  let marina=marinas.find(m=>m.id===boat.marinaId&&(counts.get(m.id)||0)<marinaBerths(state,m).length);
  if(!marina)marina=marinas.find(m=>ready(m)&&(counts.get(m.id)||0)<marinaBerths(state,m).length);
  boat.marinaId=marina?.id??null;if(marina)counts.set(marina.id,(counts.get(marina.id)||0)+1);
 }
}
export const shipyardReady=state=>state.buildings.some(b=>b.type==='industrial'&&b.businessKind==='shipyard'&&ready(b));
export function settleMarinaMonth(state){
 refreshMarinaLife(state);const life=state.marinaLife;if(life.lastMonth>=state.month)return;life.lastMonth=state.month;
 for(const home of state.buildings.filter(wealthyHome)){
  let account=life.accounts.find(a=>a.homeId===home.id);if(!account){account={homeId:home.id,balance:0};life.accounts.push(account);}
  account.balance=Math.min(100000,account.balance+home.level*1000);
  if(life.boats.some(b=>b.homeId===home.id)||life.boats.length>=24)continue;
  const kind=home.level>=4?'cruiser':'motor',spec=YACHT_TYPES[kind];if(account.balance<spec.price)continue;
  const marina=state.buildings.filter(b=>b.type==='marina'&&ready(b)&&!marinaPlacement(state,b)&&life.boats.filter(v=>v.marinaId===b.id).length<marinaBerths(state,b).length).sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y)||a.id-b.id)[0];
  if(!marina||!shipyardReady(state))continue;account.balance-=spec.price;life.boats.push({id:life.nextId++,homeId:home.id,marinaId:marina.id,kind,boughtMonth:state.month});
 }
}
export function loadMarinaLife(raw,buildings,month){
 if(raw===undefined)return newMarinaLife();const fail=()=>{throw Error('游艇存档数据无效');};
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!raw||!Array.isArray(raw.accounts)||raw.accounts.length>4096||!Array.isArray(raw.boats)||raw.boats.length>24||!integer(raw.nextId,1,1e9)||!integer(raw.lastMonth,0,month))fail();
 const homes=new Set(buildings.filter(b=>b.type==='residential').map(b=>b.id)),marinas=new Set(buildings.filter(b=>b.type==='marina').map(b=>b.id)),seenHomes=new Set(),ids=new Set(),owners=new Set();
 const accounts=raw.accounts.map(a=>{if(!a||!homes.has(a.homeId)||seenHomes.has(a.homeId)||!integer(a.balance,0,100000))fail();seenHomes.add(a.homeId);return {homeId:a.homeId,balance:a.balance};});
 const boats=raw.boats.map(b=>{if(!b||!integer(b.id,1,raw.nextId-1)||ids.has(b.id)||owners.has(b.homeId)||!seenHomes.has(b.homeId)||!Object.hasOwn(YACHT_TYPES,b.kind)||!(b.marinaId===null||marinas.has(b.marinaId))||!integer(b.boughtMonth,1,month))fail();ids.add(b.id);owners.add(b.homeId);return {id:b.id,homeId:b.homeId,marinaId:b.marinaId,kind:b.kind,boughtMonth:b.boughtMonth};});
 return {accounts,boats,nextId:raw.nextId,lastMonth:raw.lastMonth};
}
