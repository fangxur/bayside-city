import {buildingCells} from './building-footprint.js';
import {detectIntersections} from './traffic-signals.js';
import {wideRoadLayout} from './city-layout.js';
import {groundRoadAccess,roadNodes,roadSteps,roadElevation} from './interchanges.js';
import {gridIndex} from './grid.js';
import {RouteHeap} from './vehicle-routing.js';

const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],CORNERS=[[-1,-1],[1,-1],[1,1],[-1,1]],EDGES=[[0,1],[1,2],[3,2],[0,3]];
const CURB=.412,CROSSING=.60,key=p=>`${p.x},${p.y}`;
const cache=new WeakMap();

// Crossings and walkers share this geometry. A crossing sits on an approach,
// outside the junction, so its ends actually meet the two outer sidewalks.
export function pedestrianCrossings(state){
  const roads=new Map(state.tiles.filter(t=>t.road).map(t=>[key(t),t]));
  const junctions=new Set(detectIntersections(state.tiles).map(key)),rows=new Map();
  for(const id of junctions){
    const t=roads.get(id);
    DIRS.forEach(([dx,dy],direction)=>{
      const next=roads.get(`${t.x+dx},${t.y+dy}`);
      if(!next||next.bridge||next.interchange||next.terrain!=='land'||junctions.has(key(next)))return;
      const rowKey=`${direction}:${dx?t.x:t.y}`,row=rows.get(rowKey)||{direction,along:dx?t.x:t.y,cells:[]};
      row.cells.push(dx?t.y:t.x);rows.set(rowKey,row);
    });
  }
  const crossings=[];
  for(const row of rows.values()){
    const [dx,dy]=DIRS[row.direction],sorted=row.cells.sort((a,b)=>a-b);
    for(let i=0;i<sorted.length;){
      const min=sorted[i];let max=min;while(sorted[++i]===max+1)max++;
      const along=row.along+(dx||dy)*CROSSING;
      crossings.push({id:`crossing-${row.direction}-${row.along}-${min}`,direction:row.direction,
        start:dx?{x:along,y:min-CURB}:{x:min-CURB,y:along},end:dx?{x:along,y:max+CURB}:{x:max+CURB,y:along},
        cells:Array.from({length:max-min+1},(_,n)=>dx?{x:row.along+dx,y:min+n}:{x:min+n,y:row.along+dy})});
    }
  }
  return crossings;
}

export function pedestrianNetwork(state){
  const roads=state.tiles.filter(t=>t.road);
  const signature=roads.map(t=>`${t.x},${t.y}:${t.road}:${t.terrain}:${!!t.bridge}:${t.interchange?`${t.interchange.x},${t.interchange.y},${t.interchange.axis},${t.interchange.core}`:''}`).join('|');
  const old=cache.get(state);if(old?.signature===signature)return old.network;
  const wide=wideRoadLayout(state.tiles),surfaces=new Map(),nodes=new Map(),edges=new Map(),boundaries=new Map(),vertices=new Map();
  for(const t of roads)for(const id of roadNodes(state,gridIndex(state,t.x,t.y)))surfaces.set(id,{id,t,neighbors:[]});
  const sameDeck=(a,b)=>a.t.interchange&&b.t.interchange&&a.id%3===b.id%3&&a.t.interchange.x===b.t.interchange.x&&a.t.interchange.y===b.t.interchange.y;
  for(const s of surfaces.values()){
    const physical=roadSteps(state,s.id);
    s.neighbors=DIRS.map(([dx,dy])=>{
      const t=state.tiles[gridIndex(state,s.t.x+dx,s.t.y+dy)];
      if(!t?.road||t.x!==s.t.x+dx||t.y!==s.t.y+dy)return null;
      return roadNodes(state,gridIndex(state,t.x,t.y)).map(id=>surfaces.get(id)).find(next=>sameDeck(s,next)||physical.includes(next.id)&&(s.id%3===0||next.id%3===0||s.id%3===next.id%3))||null;
    });
  }
  const add=(id,x,y,s)=>{
    if(nodes.has(id))return id;
    const mode=s.id%3,axis=mode===1?'ew':mode===2?'ns':wide.get(key(s.t))?.axis||((s.neighbors[1]||s.neighbors[3])?'ew':'ns');
    const bridge=s.t.terrain==='water'||wide.get(key(s.t))?.overWater;
    nodes.set(id,{x,y,cell:{x:s.t.x,y:s.t.y},axis,height:(bridge?.193:.079)+roadElevation(state,x,y,axis)});edges.set(id,[]);return id;
  };
  const link=(a,b,crossing=null)=>{
    if(a===b)return;
    const p=nodes.get(a),q=nodes.get(b),distance=Math.hypot(p.x-q.x,p.y-q.y);
    edges.get(a).push({id:b,distance,crossing});edges.get(b).push({id:a,distance,crossing});
  };
  for(const s of surfaces.values()){
    const corners=CORNERS.map(([sx,sy],i)=>{
      const sides=[sx<0?3:1,sy<0?0:2];if(sides.every(d=>s.neighbors[d]))return null;
      const id=add(`${s.id}:c${i}`,s.t.x+sx*CURB,s.t.y+sy*CURB,s),vertex=`${s.t.x+sx*.5},${s.t.y+sy*.5}`;
      const list=vertices.get(vertex)||[];list.push({id,s});vertices.set(vertex,list);return id;
    });
    DIRS.forEach(([dx,dy],d)=>{
      if(s.neighbors[d])return;
      const [a,b]=EDGES[d],middle=add(`${s.id}:e${d}`,s.t.x+dx*CURB,s.t.y+dy*CURB,s);
      boundaries.set(`${s.id}:${d}`,{s,d,ids:[corners[a],middle,corners[b]],middle});
    });
  }
  for(const [vertex,list] of vertices){
    const [vx,vy]=vertex.split(',').map(Number);
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j],distance=Math.abs(a.s.t.x-b.s.t.x)+Math.abs(a.s.t.y-b.s.t.y);
      if(distance===1&&a.s.neighbors.includes(b.s)){link(a.id,b.id);continue;}
      if(distance!==2)continue;
      const shared=a.s.neighbors.find(s=>s&&b.s.neighbors.includes(s));if(!shared)continue;
      // At an inside bend, round the paved corner of the missing quadrant;
      // connecting the road-cell centers here would cut across the carriageway.
      const corner=add(`bend-${vertex}-${shared.id}`,vx+Math.sign(vx-shared.t.x)*.012,vy+Math.sign(vy-shared.t.y)*.012,shared);
      link(a.id,corner);link(corner,b.id);
    }
  }
  const crossings=pedestrianCrossings(state);
  for(const crossing of crossings){
    const dx=crossing.direction%2===1,ends=[crossing.start,crossing.end],gates=[];
    for(let side=0;side<2;side++){
      const cell=side?crossing.cells.at(-1):crossing.cells[0],s=surfaces.get(gridIndex(state,cell.x,cell.y)*3),d=dx?(side?2:0):(side?1:3),boundary=s&&boundaries.get(`${s.id}:${d}`);
      if(!boundary)break;
      const p=ends[side],id=add(`${crossing.id}-${side}`,p.x,p.y,s);boundary.ids.push(id);gates.push(id);
    }
    if(gates.length!==2)continue;
    const path=[gates[0],...crossing.cells.map((cell,i)=>{const s=surfaces.get(gridIndex(state,cell.x,cell.y)*3);return add(`${crossing.id}-road-${i}`,dx?crossing.start.x:cell.x,dx?cell.y:crossing.start.y,s);}),gates[1]];
    for(let i=1;i<path.length;i++)link(path[i-1],path[i],crossing.id);
  }
  for(const b of boundaries.values()){
    b.ids.sort((a,c)=>b.d%2===0?nodes.get(a).x-nodes.get(c).x:nodes.get(a).y-nodes.get(c).y);
    for(let i=1;i<b.ids.length;i++)link(b.ids[i-1],b.ids[i]);
  }
  const entrances=building=>{
    const found=new Set();
    for(const cell of buildingCells(building))DIRS.forEach(([dx,dy],d)=>{
      const x=cell.x+dx,y=cell.y+dy,t=state.tiles[gridIndex(state,x,y)];if(!t?.road||t.x!==x||t.y!==y||!groundRoadAccess(t))return;
      for(const id of roadNodes(state,gridIndex(state,x,y))){
        const s=surfaces.get(id);if(t.interchange&&id%3===(t.interchange.axis==='ew'?1:2))continue;
        const b=boundaries.get(`${s.id}:${(d+2)%4}`);if(b)found.add(b.middle);
      }
    });
    // Roadside destinations may be a street location rather than a building.
    // Choose its actual pavement, never a fictitious entrance inside asphalt.
    if(!found.size)for(const cell of buildingCells(building)){
      const t=state.tiles[gridIndex(state,cell.x,cell.y)];if(!t?.road)continue;
      for(const id of roadNodes(state,gridIndex(state,cell.x,cell.y)))for(let d=0;d<4;d++){
        const b=boundaries.get(`${id}:${d}`);if(b)found.add(b.middle);
      }
    }
    return [...found];
  };
  const network={nodes,edges,entrances,crossings};cache.set(state,{signature,network});return network;
}

function route(network,starts,goals){
  if(!starts.length||!goals.size)return null;
  const heap=new RouteHeap(),distance=new Map(),previous=new Map();
  for(const id of starts){heap.push([0,id]);distance.set(id,0);previous.set(id,null);}
  while(heap.items.length){
    const [cost,id]=heap.pop();if(cost!==distance.get(id))continue;
    if(goals.has(id)){
      const sidewalk=[];for(let at=id;at!==null;at=previous.get(at)?.id??null){const p=network.nodes.get(at);sidewalk.push({...p,cell:{...p.cell},crossing:previous.get(at)?.crossing||null});}
      sidewalk.reverse();const points=[];
      for(const p of sidewalk)if(key(points.at(-1)||{})!==key(p.cell))points.push({...p.cell});
      return {points,sidewalk,distance:cost};
    }
    for(const next of network.edges.get(id)){
      const value=cost+next.distance;if(value>=(distance.get(next.id)??Infinity))continue;
      distance.set(next.id,value);previous.set(next.id,{id,crossing:next.crossing});heap.push([value,next.id]);
    }
  }
  return null;
}

export function pedestrianTrip(state,from,to){
  const network=pedestrianNetwork(state);return route(network,network.entrances(from),new Set(network.entrances(to)));
}

export function pedestrianStroll(state,home,seed){
  const network=pedestrianNetwork(state),starts=network.entrances(home);if(!starts.length)return null;
  const start=starts[(seed>>>0)%starts.length],queue=[start],seen=new Set(queue),targets=[];
  for(let i=0;i<queue.length&&i<200;i++)for(const next of network.edges.get(queue[i])){
    if(next.crossing||seen.has(next.id))continue;seen.add(next.id);queue.push(next.id);
    const a=network.nodes.get(start),b=network.nodes.get(next.id),distance=Math.hypot(a.x-b.x,a.y-b.y);
    if(distance>=2&&distance<=8)targets.push(next.id);
  }
  return targets.length?route(network,[start],new Set([targets[(seed>>>0)%targets.length]])):null;
}
