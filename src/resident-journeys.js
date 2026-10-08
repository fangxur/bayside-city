import {groundRoadAccess} from './interchanges.js';
import {pedestrianTrip,pedestrianStroll} from './pedestrian-routing.js';
import {buildingCells,footprintSize} from './building-footprint.js';
import {businessKind} from './business-kinds.js';
import {COMMUNITY_BUILDINGS} from './community-buildings.js';
import {requiresRoad} from './building-access.js';
import {festivalForMonth} from './festivals.js';
import {gridIndex,inGrid} from './grid.js';

export const residentHash=text=>{
  let n=2166136261;for(const char of String(text))n=Math.imul(n^char.charCodeAt(0),16777619);return n>>>0;
};
export const placeName=b=>businessKind(b.businessKind)?.name||COMMUNITY_BUILDINGS[b.type]?.name||({residential:'家',commercial:'街角商店',industrial:'城市工坊',park:'社区公园',plaza:'喷泉广场'})[b.type]||'街区';
const place=b=>({id:b.id,x:b.x,y:b.y,size:footprintSize(b),name:placeName(b)});
const index=(state,p)=>gridIndex(state,p.x,p.y);
const tile=(state,p)=>state.tiles[index(state,p)];
const road=(state,p)=>inGrid(state,p?.x,p?.y)&&!!tile(state,p)?.road;
const neighbors=p=>[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}];
const entrances=(state,b)=>[...new Map(buildingCells(b).flatMap(neighbors).filter(p=>road(state,p)&&groundRoadAccess(tile(state,p))).map(p=>[index(state,p),p])).values()];
const ready=b=>b.active&&b.progress>=1&&(b.connected||!requiresRoad(b.type))&&b.powered&&b.watered;
const venueReady=b=>['park','plaza'].includes(b.type)?b.active&&b.progress>=1:ready(b);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=12;

// Preserve road-cell routes for stories and overlays, alongside precise curb
// waypoints. Opposite curbs connect only at a marked pedestrian crossing.
export function walkingPath(state,from,to){
  const trip=pedestrianTrip(state,from,to),points=trip?.points||[];
  if(trip)Object.defineProperty(points,'sidewalk',{value:trip.sidewalk});
  return points;
}

function journey(state,home,destination,points,purpose,label,extra={}){
  if(!points.length)return null;
  const congestion=points.filter(p=>(tile(state,p)?.traffic||0)>=75).length;
  return {purpose,label,from:place(home),to:place(destination),points:points.map(p=>({...p})),
    minutes:Math.round(points.reduce((sum,p)=>sum+.65*(1+(tile(state,p)?.traffic||0)/100),1)*10)/10,
    roadCells:points.length,congestion,...(points.sidewalk?{sidewalk:points.sidewalk.map(p=>({...p,cell:{...p.cell}}))}:{}),...extra};
}

export function residentCommute(state,home,seed,workplaceId,{vehicle=false}={}){
  if(!home||!ready(home)||home.workers<=0)return null;
  const starts=new Set(entrances(state,home).map(p=>index(state,p)));
  const options=(state.routes||[]).filter(r=>r.kind==='commute'&&(!vehicle||!r.walking)&&r.homeId===home.id&&r.load>0&&(!workplaceId||r.workplaceId===workplaceId)).filter(r=>{
    const firm=state.buildings.find(b=>b.id===r.workplaceId);
    return firm&&ready(firm)&&firm.jobs>0&&r.points?.length&&Number.isFinite(r.duration)&&starts.has(index(state,r.points[0]))&&
      entrances(state,firm).some(p=>index(state,p)===index(state,r.points.at(-1)))&&r.points.every((p,i)=>road(state,p)&&(!i||Math.abs(p.x-r.points[i-1].x)+Math.abs(p.y-r.points[i-1].y)===1));
  }).sort((a,b)=>a.workplaceId-b.workplaceId);
  let choice=(seed>>>0)%options.reduce((sum,r)=>sum+r.load,0);
  const route=options.find(r=>(choice-=r.load)<0);if(!route)return null;
  const firm=state.buildings.find(b=>b.id===route.workplaceId);
  const points=vehicle?route.points:walkingPath(state,home,firm);
  return journey(state,home,firm,points,'work','去上班',vehicle?{minutes:route.duration,returnPoints:route.returnPoints}:{});
}

function stroll(state,home,seed){
  const trip=pedestrianStroll(state,home,seed);if(!trip)return null;
  return journey(state,home,{...trip.points.at(-1),type:'street'},trip.points,'walk','街区散步',{sidewalk:trip.sidewalk});
}

export function residentJourney(state,home,seed,social,{returning=false,workplaceId,commuter=false}={}){
  const commute=residentCommute(state,home,seed,workplaceId,{vehicle:commuter});
  let trip=commuter?commute:null;
  if(!commuter){
    const rotation=residentHash(`${seed}:${state.month}:outing`),mode=rotation%4;
    const festival=festivalForMonth(state.month);
    const visit=(destination,purpose,label,extra={})=>destination&&venueReady(destination)?journey(state,home,destination,walkingPath(state,home,destination),purpose,label,extra):null;
    const venues=state.buildings.filter(b=>near(home,b)&&venueReady(b)).sort((a,b)=>a.id-b.id);
    const choose=(kinds,purpose,label,extra={})=>{
      const options=venues.filter(b=>kinds.includes(b.businessKind||b.type));
      for(let i=0;i<options.length;i++){const trip=visit(options[(rotation+i)%options.length],purpose,label,extra);if(trip)return trip;}
      return null;
    };
    if(ready(home)){
      if(festival&&rotation%2===0){
        const festive=social?.category==='节日活动'&&social.activityId;
        const extra={festivalId:festival.id,festivalName:festival.name,activity:festive?social.title:festival.activity,...(festive?{companion:social.neighbor.name}:{})};
        if(festive)trip=visit(state.buildings.find(b=>b.id===social.venue.id),'festival',`参加${festival.name}活动`,extra);
        if(!trip)trip=choose(festival.venues,'festival',`参加${festival.name}活动`,extra);
      }
      if(!trip&&mode===0)trip=commute;
      if(!trip&&mode===1&&social){
        const companion=state.buildings.find(b=>b.id===social.neighbor.home.id);
        trip=choose(['mediterranean','teaHouse','diner','tavern','park','plaza'],'date','去赴约',{companion:social.neighbor.name});
        if(trip&&(!companion||!walkingPath(state,companion,state.buildings.find(b=>b.id===trip.to.id)).length))trip=null;
      }
      if(!trip&&social&&mode!==3)trip=visit(state.buildings.find(b=>b.id===social.venue.id),'activity','参加活动',{activity:social.title,companion:social.neighbor.name});
      if(!trip&&mode===3)trip=choose(['market','oldStreet','bakery','pharmacy','repairGarage','laundry','hardware'],'errand','顺路办事');
      if(!trip)trip=choose(['park','plaza'],'walk','去公园散步')||commute;
    }
    trip??=stroll(state,home,rotation);
  }
  if(!trip)return null;
  return returning?{...trip,purpose:'home',label:'回家',outingPurpose:trip.purpose,from:trip.to,to:trip.from,points:trip.returnPoints?.length?trip.returnPoints.map(p=>({...p})):[...trip.points].reverse(),...(trip.sidewalk?{sidewalk:[...trip.sidewalk].reverse()}: {})}:trip;
}
