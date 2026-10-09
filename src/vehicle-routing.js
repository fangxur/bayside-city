import {wideRoadLayout,boulevardLanes,laneMovements} from './city-layout.js';
import {interchangeBounds,groundRoadAccess,roadNodes,roadSteps,roadIndex} from './interchanges.js';
import {buildingCells} from './building-footprint.js';
import {gridPoint,gridIndex,inGrid} from './grid.js';

const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const key=p=>`${p.x},${p.y}`;
export class RouteHeap {
  constructor(){this.items=[];}
  push(value){const a=this.items;a.push(value);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=value[0])break;a[i]=a[p];i=p;}a[i]=value;}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}

// Motor routes carry an arrival heading as well as a road/layer node. Physical
// connectivity and pedestrian/service coverage continue to use the road graph.
export function vehicleNetwork(state){
  const wide=wideRoadLayout(state.tiles),roads=new Map(state.tiles.filter(t=>t.road).map(t=>[key(t),t]));
  const junction=new Set(),ends=new Set(),stepCache=new Map();
  for(const t of roads.values()){
    const layout=wide.get(key(t));
    if(layout){
      if(layout.junction)junction.add(key(t));
      const along=layout.axis==='ew'?[1,0]:[0,1];
      if(!roads.has(`${t.x+along[0]},${t.y+along[1]}`)||!roads.has(`${t.x-along[0]},${t.y-along[1]}`))ends.add(key(t));
    }else if(DIRS.filter(([dx,dy])=>roads.has(`${t.x+dx},${t.y+dy}`)).length>=3)junction.add(key(t));
  }
  const curb=(index,heading,building)=>{
    if(!building)return true;
    const p=gridPoint(state,index),cells=buildingCells(building);
    const adjacent=cells.filter(c=>Math.abs(c.x-p.x)+Math.abs(c.y-p.y)===1);
    // Community businesses may share an entrance several tiles away.
    if(!adjacent.length)return true;
    const [dx,dy]=DIRS[heading];
    return adjacent.some(c=>{
      const bx=c.x-p.x,by=c.y-p.y;
      if(bx===-dy&&by===dx)return true;
      // A driveway at the actual end of a street can continue straight into
      // the property; it never crosses the centerline to reach the other side.
      return bx*dy===by*dx&&roads.has(`${p.x-bx},${p.y-by}`)&&
        !roads.has(`${p.x-by},${p.y+bx}`)&&!roads.has(`${p.x+by},${p.y-bx}`);
    });
  };
  const laneAllows=(p,heading)=>{
    const [dx,dy]=DIRS[heading],item=roads.get(key(p))?.interchange;
    if(item){
      const b=interchangeBounds(item),cross=dx?p.y:p.x,middle=dx?b.cy:b.cx;
      return cross===middle||(dx||dy)===(dx?Math.sign(cross-middle):-Math.sign(cross-middle));
    }
    const info=wide.get(key(p));
    if(!info||junction.has(key(p))||ends.has(key(p)))return true;
    const cross=info.axis==='ew'?p.y:p.x,middle=(info.min+info.max)/2;
    if(cross===middle)return true; // The central tile of an odd-width road has two lanes.
    const direction=info.axis==='ew'?dx:dy;
    return direction===(info.axis==='ew'?Math.sign(cross-middle):-Math.sign(cross-middle));
  };
  const steps=(node,heading)=>{
    const id=node*4+heading;if(stepCache.has(id))return stepCache.get(id);
    const p=gridPoint(state,roadIndex(node)),info=wide.get(key(p));
    const neighbors=roadSteps(state,node,{connected:true}),canTurn=junction.has(key(p))||ends.has(key(p))||!info;
    const result=neighbors.flatMap(next=>{
      const q=gridPoint(state,roadIndex(next)),nextHeading=DIRS.findIndex(([dx,dy])=>q.x-p.x===dx&&q.y-p.y===dy);
      if(nextHeading<0)return [];
      if(nextHeading===(heading+2)%4&&(state.tiles[roadIndex(node)].interchange||(!junction.has(key(p))&&!ends.has(key(p))&&neighbors.length>1)))return [];
      if(nextHeading!==heading&&!canTurn)return [];
      if(!laneAllows(p,nextHeading)||!laneAllows(q,nextHeading))return [];
      return [[next,nextHeading]];
    });
    stepCache.set(id,result);return result;
  };
  // Reuse dense search storage across thousands of trips per city update.
  // Stamps avoid clearing the entire map between searches.
  const size=state.tiles.length*12;
  const search={distance:new Float64Array(size),previous:new Int32Array(size),seen:new Uint32Array(size),stamp:0};
  return {wide,curb,laneAllows,steps,search};
}

export function vehicleRoadPath(state,starts,goals,{from,to,network=vehicleNetwork(state),cost=()=>1,startCost=()=>0}={}){
  if(!starts.length||!goals.length)return [];
  const target=new Set(goals.flatMap(i=>roadNodes(state,i))),heap=new RouteHeap();
  if(!network.search||network.search.distance.length!==state.tiles.length*12){
    const size=state.tiles.length*12;
    network.search={distance:new Float64Array(size),previous:new Int32Array(size),seen:new Uint32Array(size),stamp:0};
  }
  const search=network.search;
  if(search.stamp===0xffffffff){search.seen.fill(0);search.stamp=0;}
  const stamp=++search.stamp,{distance:dist,previous:prev,seen}=search;
  for(const node of starts.flatMap(i=>roadNodes(state,i)))for(let h=0;h<4;h++){
    if(!network.curb(roadIndex(node),h,from)||!network.laneAllows(gridPoint(state,roadIndex(node)),h))continue;
    const id=node*4+h,d=startCost(roadIndex(node));seen[id]=stamp;dist[id]=d;prev[id]=-1;heap.push([d,id]);
  }
  while(heap.items.length){
    const [d,id]=heap.pop();if(d!==dist[id])continue;
    const node=Math.floor(id/4),heading=id%4;
    if(target.has(node)&&network.curb(roadIndex(node),heading,to)){
      const path=[];for(let at=id;at!==-1;at=prev[at])path.push(roadIndex(Math.floor(at/4)));
      return path.reverse();
    }
    for(const [next,h] of network.steps(node,heading)){
      const nextId=next*4+h,value=d+cost(roadIndex(next));
      if(seen[nextId]!==stamp||value<dist[nextId]){seen[nextId]=stamp;dist[nextId]=value;prev[nextId]=id;heap.push([value,nextId]);}
    }
  }
  return [];
}

export function vehicleTrip(state,from,to,{network=vehicleNetwork(state)}={}){
  const adjacent=building=>{
    const result=new Set();
    for(const p of buildingCells(building))for(const [dx,dy] of DIRS){const x=p.x+dx,y=p.y+dy;if(inGrid(state,x,y)){const i=gridIndex(state,x,y),t=state.tiles[i];if(t.road&&t.connected&&groundRoadAccess(t))result.add(i);}}
    return [...result].sort((a,b)=>a-b);
  };
  const outward=vehicleRoadPath(state,adjacent(from),adjacent(to),{from,to,network});
  if(outward.length<2)return null;
  const returning=vehicleRoadPath(state,[outward.at(-1)],[outward[0]],{from:to,to:from,network});
  if(returning.length<2)return null;
  return {points:outward.map(i=>gridPoint(state,i)),returnPoints:returning.map(i=>gridPoint(state,i))};
}

// Lane offsets use the right-hand normal (-dy, dx) in the map's x/y plane.
export function vehicleLaneOffset(point,dx,dy,wide,laneIndex){
  const layout=wide?.get(key(point)),lanes=boulevardLanes(point,layout,layout?.max-layout?.min>1?(dx||dy):undefined);
  if(lanes&&((layout.axis==='ew'&&dx===lanes.direction)||(layout.axis==='ns'&&dy===lanes.direction))){
    const selected=Math.max(0,Math.min(lanes.centers.length-1,laneIndex??Math.floor(lanes.centers.length/2)));
    const low=Math.floor(selected),f=selected-low,center=lanes.centers[low]*(1-f)+lanes.centers[Math.min(low+1,lanes.centers.length-1)]*f;
    return layout.axis==='ew'?{x:0,y:center}:{x:center,y:0};
  }
  return {x:-dy*.16,y:dx*.16};
}

// Plan lanes once per route/topology, not once per frame. Straight traffic uses
// both shared lanes; turns and three-lane approaches obey the painted arrows.
export function vehicleLanePlan(points,wide,zones=[],id=''){
  let seed=2166136261;for(const c of String(id))seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const segments=[],last=points.length-1;
  const movement=(ix,iy,ox,oy)=>ix*ox+iy*oy<0?'left':ix*oy-iy*ox<0?'left':ix*oy-iy*ox>0?'right':'straight';
  const choose=(count,turn)=>{
    const candidates=Array.from({length:count},(_,i)=>i).filter(i=>laneMovements(count,i).includes(turn));
    return candidates.length?candidates[seed%candidates.length]:Math.floor(count/2);
  };
  const zoneTurn=zone=>{
    const end=Math.min(last-1,zone.endCenter??zone.center),a=points[end],b=points[end+1];
    return movement(zone.dx,zone.dy,b.x-a.x,b.y-a.y);
  };
  for(let start=0;start<last;){
    const dx=points[start+1].x-points[start].x,dy=points[start+1].y-points[start].y;
    let end=start+1;while(end<last&&points[end+1].x-points[end].x===dx&&points[end+1].y-points[end].y===dy)end++;
    const axis=dx?'ew':'ns',references=[];
    for(let i=start;i<=end;i++){
      const info=wide?.get(key(points[i]));
      if(info?.axis===axis&&info.sharedLanes&&!info.junction)references.push({i,info});
    }
    const relevant=zones.filter(z=>z.center<=end&&(z.endCenter??z.center)>=start);
    const finalTurn=end<last?movement(dx,dy,points[end+1].x-points[end].x,points[end+1].y-points[end].y):'straight';
    const offsets=[];
    for(let i=start;i<=end;i++){
      let info=wide?.get(key(points[i]));
      // The junction's square can be labelled with the perpendicular road axis.
      // Continue this approach's carriageway through it instead of jumping lanes.
      if((!info||info.axis!==axis||info.junction)&&references.length)info=references.reduce((a,b)=>Math.abs(a.i-i)<=Math.abs(b.i-i)?a:b).info;
      const lanes=info?.axis===axis?boulevardLanes(points[i],info,info.max-info.min>1?(dx||dy):undefined):null;
      if(!lanes||lanes.direction!==(dx||dy)){offsets.push(vehicleLaneOffset(points[i],dx,dy,wide));continue;}
      const next=relevant.find(z=>(z.endCenter??z.center)+1>=i),previous=relevant.filter(z=>(z.endCenter??z.center)+1<i).at(-1);
      const turn=next?zoneTurn(next):finalTurn;
      let selected=choose(lanes.lanesPerDirection,turn);
      // Keep the previous junction's lane until its rear-clear boundary, then
      // move smoothly across the block, finishing before the next stop line.
      if(previous){
        const from=choose(lanes.lanesPerDirection,zoneTurn(previous)),begin=(previous.endCenter??previous.center)+1;
        const available=next?Math.max(.25,next.center-1-begin):3,duration=Math.min(3,available);
        const t=Math.max(0,Math.min(1,(i-begin)/duration)),blend=t*t*(3-2*t);
        selected=from+(selected-from)*blend;
      }
      const low=Math.floor(selected),f=selected-low,cross=lanes.centers[low]*(1-f)+lanes.centers[Math.min(low+1,lanes.centers.length-1)]*f;
      offsets.push(axis==='ew'?{x:0,y:cross}:{x:cross,y:0});
    }
    for(let i=start;i<end;i++)segments[i]={start:offsets[i-start],end:offsets[i-start+1]};
    start=end;
  }
  const plan={segments,curves:[]};
  for(const zone of zones){
    const approach=wide?.get(key(points[Math.max(0,zone.center-1)]));
    if(!approach?.sharedLanes||approach.max-approach.min<2)continue;
    const end=zone.endCenter??zone.center;
    if(end>=last)continue;
    const dx=points[end+1].x-points[end].x,dy=points[end+1].y-points[end].y;
    if(zone.dx*dx+zone.dy*dy!==0)continue;
    const startDistance=Math.max(0,zone.center-.65),endDistance=Math.min(last,end+.65);
    const a=vehicleLanePose(points,startDistance,wide,plan),b=vehicleLanePose(points,endDistance,wide,plan);
    // A wide-road lane may be several grid rows from its logical route. Round
    // the whole junction between its actual entrance/exit lanes, rather than
    // making a small backwards turn around that route's original tile corner.
    const incoming=((b.x-a.x)*zone.dx+(b.y-a.y)*zone.dy)*.5523;
    const outgoing=((b.x-a.x)*dx+(b.y-a.y)*dy)*.5523;
    if(incoming<=0||outgoing<=0)continue;
    plan.curves.push({startDistance,endDistance,a,b,c1:{x:a.x+zone.dx*incoming,y:a.y+zone.dy*incoming},c2:{x:b.x-dx*outgoing,y:b.y-dy*outgoing}});
  }
  return plan;
}

// Logical distance stays in road segments for signal reservations and queues.
// The drawn pose rounds corners without changing the authoritative trip clock.
export function vehicleLanePose(points,distance,wide,plan){
  const curve=plan?.curves?.find(c=>distance>=c.startDistance&&distance<=c.endDistance);
  if(curve){
    const {a,b,c1,c2}=curve,u=(distance-curve.startDistance)/(curve.endDistance-curve.startDistance),v=1-u;
    const x=v*v*v*a.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*b.x;
    const y=v*v*v*a.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*b.y;
    const tx=v*v*(c1.x-a.x)+2*v*u*(c2.x-c1.x)+u*u*(b.x-c2.x);
    const ty=v*v*(c1.y-a.y)+2*v*u*(c2.y-c1.y)+u*u*(b.y-c2.y);
    return {x,y,angle:Math.atan2(tx,ty)};
  }
  const last=points.length-1,d=Math.max(0,Math.min(last,distance)),segment=Math.min(last-1,Math.floor(d)),f=d-segment;
  const a=points[segment],b=points[segment+1],dx=b.x-a.x,dy=b.y-a.y;
  const offsetA=plan?.segments[segment]?.start||vehicleLaneOffset(a,dx,dy,wide),offsetB=plan?.segments[segment]?.end||vehicleLaneOffset(b,dx,dy,wide);
  let x=a.x+dx*f+offsetA.x*(1-f)+offsetB.x*f,y=a.y+dy*f+offsetA.y*(1-f)+offsetB.y*f,tx=dx+offsetB.x-offsetA.x,ty=dy+offsetB.y-offsetA.y;
  const corner=f<.5?segment:segment+1,r=.35;
  if(corner>0&&corner<last&&Math.abs(d-corner)<=r){
    const p=points[corner],before=points[corner-1],after=points[corner+1],ix=p.x-before.x,iy=p.y-before.y,ox=after.x-p.x,oy=after.y-p.y;
    if(ix!==ox||iy!==oy){
      const u=(d-corner+r)/(2*r),v=1-u,incoming=plan?.segments[corner-1]?.end||vehicleLaneOffset(p,ix,iy,wide),outgoing=plan?.segments[corner]?.start||vehicleLaneOffset(p,ox,oy,wide);
      const beforeOffset=plan?.segments[corner-1]?.start||vehicleLaneOffset(before,ix,iy,wide),afterOffset=plan?.segments[corner]?.end||vehicleLaneOffset(after,ox,oy,wide);
      const start={x:p.x-ix*r+incoming.x*(1-r)+beforeOffset.x*r,y:p.y-iy*r+incoming.y*(1-r)+beforeOffset.y*r};
      const end={x:p.x+ox*r+outgoing.x*(1-r)+afterOffset.x*r,y:p.y+oy*r+outgoing.y*(1-r)+afterOffset.y*r};
      const handle=(ix===-ox&&iy===-oy?4:2)*r/3;
      // Match the adjacent lane tangents, including transitions between road
      // widths. This keeps both position and heading continuous at the joins.
      const c1={x:start.x+(ix+incoming.x-beforeOffset.x)*handle,y:start.y+(iy+incoming.y-beforeOffset.y)*handle};
      const c2={x:end.x-(ox+afterOffset.x-outgoing.x)*handle,y:end.y-(oy+afterOffset.y-outgoing.y)*handle};
      x=v*v*v*start.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*end.x;
      y=v*v*v*start.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*end.y;
      tx=v*v*(c1.x-start.x)+2*v*u*(c2.x-c1.x)+u*u*(end.x-c2.x);
      ty=v*v*(c1.y-start.y)+2*v*u*(c2.y-c1.y)+u*u*(end.y-c2.y);
    }
  }
  return {x,y,angle:Math.atan2(tx,ty)};
}
