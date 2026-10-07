import {buildingCells} from './building-footprint.js';
import {gridIndex,gridPoint,inGrid,mapSize} from './grid.js';

const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const operational=building=>building&&building.active!==false&&building.progress>=1&&building.connected&&building.powered&&building.watered;

const style=value=>Object.freeze(value);

// A compact shared vocabulary keeps catalog previews and live street traffic
// on the same silhouettes. `family` controls trip behavior; `shape` controls
// the extra bodywork assembled by the renderer.
export const ROAD_VEHICLE_STYLES=Object.freeze({
  car:style({label:'城市轿车',family:'car',shape:'sedan',body:Object.freeze([0xe8d7ae,0xc96850,0x4b8793,0xb9bcae,0xd5aa4f,0x6f8580]),cabin:0x496c73,trim:0xe9dfc4,accent:0x36545a,length:.43,width:.19,bodyHeight:.105,cabinLength:.205,cabinHeight:.075,cabinOffset:-.025,axleOffset:.135}),
  compact:style({label:'灵巧微型车',family:'car',shape:'compact',body:Object.freeze([0xe8b95d,0x75a77e,0xd87962,0x7f99b0]),cabin:0x54777b,trim:0xf1e3bd,accent:0x56706b,length:.33,width:.18,bodyHeight:.115,cabinLength:.19,cabinHeight:.09,cabinOffset:-.015,axleOffset:.10}),
  hatchback:style({label:'家用掀背车',family:'car',shape:'hatchback',body:Object.freeze([0x6c98a4,0xbc7558,0x879768,0xd8c79c]),cabin:0x486a73,trim:0xe5d7b9,accent:0x3e575b,length:.405,width:.19,bodyHeight:.115,cabinLength:.24,cabinHeight:.09,cabinOffset:-.035,axleOffset:.125}),
  suv:style({label:'城市越野车',family:'car',shape:'suv',body:Object.freeze([0x55746e,0x9a765b,0x74879b,0xc5b485]),cabin:0x405f67,trim:0xdad5bd,accent:0x314b50,length:.46,width:.205,bodyHeight:.145,cabinLength:.235,cabinHeight:.09,cabinOffset:-.015,axleOffset:.145}),
  taxi:style({label:'城市出租车',family:'car',shape:'taxi',body:0xe0b641,cabin:0x3f6269,trim:0xf4e9c8,accent:0x31514f,length:.43,width:.19,bodyHeight:.105,cabinLength:.205,cabinHeight:.075,cabinOffset:-.025,axleOffset:.135}),
  minivan:style({label:'家庭多用途车',family:'car',shape:'minivan',body:Object.freeze([0xd8d2bb,0x718d91,0x9a7d67,0x668071]),cabin:0x486b73,trim:0xe7dcc0,accent:0x58706d,length:.49,width:.205,bodyHeight:.14,cabinLength:.34,cabinHeight:.095,cabinOffset:-.015,axleOffset:.155}),
  pickup:style({label:'城市皮卡',family:'freight',shape:'pickup',body:Object.freeze([0xb87957,0x708a78,0x7c8f9b]),cabin:0x496a70,trim:0xdfd2b2,accent:0x644e3e,length:.50,width:.205,bodyHeight:.115,cabinLength:.18,cabinHeight:.095,cabinOffset:.12,axleOffset:.16}),
  'delivery-van':style({label:'厢式配送车',family:'freight',shape:'delivery-van',body:Object.freeze([0xe4ddc7,0xc8c2ab,0xa6b8b2]),cabin:0x4e7379,trim:0xd8874f,accent:0x64837c,length:.52,width:.215,bodyHeight:.18,cabinLength:.18,cabinHeight:.085,cabinOffset:.155,axleOffset:.17}),
  freight:style({label:'城市货车',family:'freight',shape:'freight',body:Object.freeze([0xe1d6b8,0xc5b58e,0xc8c6b6]),cabin:0x51777a,trim:0x8c7659,accent:0xd0b46f,length:.58,width:.225,bodyHeight:.135,cabinLength:.18,cabinHeight:.095,cabinOffset:.18,axleOffset:.19}),
  ambulance:style({label:'城市救护车',family:'service',shape:'ambulance',body:0xf3f0e4,cabin:0x4e7e87,mark:0xd84c43,trim:0xd84c43,accent:0xd84c43,length:.56,width:.22,bodyHeight:.185,cabinLength:.19,cabinHeight:.09,cabinOffset:.165,axleOffset:.18,speed:.96}),
  'fire-engine':style({label:'城市消防车',family:'service',shape:'fire-engine',body:0xc84235,cabin:0x395f67,mark:0xf0d393,trim:0xf0d393,accent:0xf0d393,length:.61,width:.23,bodyHeight:.18,cabinLength:.19,cabinHeight:.10,cabinOffset:.19,axleOffset:.20,speed:.84}),
});

export const CIVILIAN_VEHICLE_KINDS=Object.freeze(['compact','car','hatchback','suv','taxi','minivan']);
export const FREIGHT_VEHICLE_KINDS=Object.freeze(['delivery-van','pickup','freight']);
export const PUBLIC_VEHICLE_STYLES=Object.freeze({
  'fire-engine':ROAD_VEHICLE_STYLES['fire-engine'],
  ambulance:ROAD_VEHICLE_STYLES.ambulance,
});

export const isPublicVehicleKind=kind=>Object.hasOwn(PUBLIC_VEHICLE_STYLES,kind);

function adjacentRoads(state,building){
  const roads=new Set();
  for(const cell of buildingCells(building))for(const [dx,dy] of DIRECTIONS){
    const x=cell.x+dx,y=cell.y+dy;
    if(!inGrid(state,x,y))continue;
    if(state.tiles[gridIndex(state,x,y)]?.road)roads.add(gridIndex(state,x,y));
  }
  return [...roads].sort((a,b)=>a-b);
}

function roadPath(state,from,to){
  const starts=adjacentRoads(state,from),ends=new Set(adjacentRoads(state,to));
  if(!starts.length||!ends.size)return [];
  const queue=[...starts],previous=new Map(starts.map(index=>[index,null]));
  let found=queue.find(index=>ends.has(index));
  for(let head=0;found===undefined&&head<queue.length;head++){
    const current=queue[head],{x,y}=gridPoint(state,current);
    for(const [dx,dy] of DIRECTIONS){
      const nx=x+dx,ny=y+dy,index=gridIndex(state,nx,ny);
      if(!inGrid(state,nx,ny)||previous.has(index)||!state.tiles[index]?.road)continue;
      previous.set(index,current);queue.push(index);
      if(ends.has(index)){found=index;break;}
    }
  }
  if(found===undefined)return [];
  const result=[];for(let at=found;at!==null;at=previous.get(at))result.push(gridPoint(state,at));
  return result.reverse();
}

function roundTrip(path){
  return path.length<2?[]:path.concat(path.slice(0,-1).reverse());
}

function patrolCandidates(state,kind,facility){
  const buildings=(state.buildings||[]).filter(building=>building.id!==facility.id&&building.progress>=1&&building.active!==false&&building.connected);
  const covered=kind==='fire-engine'
    ?buildings.filter(building=>building.fireCovered)
    :buildings.filter(building=>building.services?.clinic);
  const homes=buildings.filter(building=>building.type==='residential'&&building.population>0);
  return (covered.length?covered:homes).sort((a,b)=>a.id-b.id);
}

function routeFor(state,kind,facility,incident){
  const responseKind=kind==='fire-engine'?'fire':'medical';
  const incidentTarget=incident?.kind===responseKind&&(state.buildings||[]).find(building=>building.id===incident.targetId);
  const candidates=incidentTarget?[incidentTarget]:patrolCandidates(state,kind,facility);
  if(!candidates.length)return null;
  const offset=(facility.id+(state.month||0))%candidates.length;
  for(let index=0;index<candidates.length;index++){
    const target=candidates[(offset+index)%candidates.length],path=roadPath(state,facility,target);
    if(path.length<2)continue;
    return {kind,load:1,facilityId:facility.id,targetId:target.id,incidentId:incidentTarget?incident.id:null,responding:!!incidentTarget,points:roundTrip(path)};
  }
  return null;
}

export function publicVehicleRoutes(state){
  if(!state||!Array.isArray(state.tiles)||state.tiles.length!==mapSize(state)**2||!Array.isArray(state.buildings))return [];
  const incident=state.cityIncidents?.active?.[0]||null;
  const fire=state.buildings.filter(building=>building.type==='fireStation'&&operational(building)).sort((a,b)=>a.id-b.id).slice(0,3);
  const medical=state.buildings.filter(building=>['clinic','hospital'].includes(building.type)&&operational(building)).sort((a,b)=>(a.type==='hospital'?0:1)-(b.type==='hospital'?0:1)||a.id-b.id).slice(0,4);
  return [
    ...fire.map(facility=>routeFor(state,'fire-engine',facility,incident)),
    ...medical.map(facility=>routeFor(state,'ambulance',facility,incident)),
  ].filter(Boolean);
}
