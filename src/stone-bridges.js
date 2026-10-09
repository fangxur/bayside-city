// Derived bridge geometry: no new save fields, road ownership or traffic rules.
import {roadElevation} from './interchanges.js';
const key=(x,y)=>`${x},${y}`,cache=new WeakMap();
const ARCH_CLEAR_WIDTH=2,MIN_PIER_WIDTH=.44;

export function stoneBridgeLayout(state,refresh=false){
 const old=cache.get(state);if(!refresh&&old?.tiles===state.tiles)return old.layout;
 const roads=new Map(state.tiles.filter(t=>t.road).map(t=>[key(t.x,t.y),t])),rows=new Map();
 for(const t of roads.values()){
  if(!t.bridge||t.terrain!=='water')continue;
  const candidates=[];
  for(const axis of ['ew','ns']){
   // Bank-to-bank continuity determines the crossing direction. A broad road
   // can be wider than the river and must not turn the bridge through 90°.
   const cross=axis==='ew'?t.y:t.x,at=a=>roads.get(axis==='ew'?key(a,cross):key(cross,a));
   let start=axis==='ew'?t.x:t.y,end=start;
   while(at(start-1)?.bridge&&at(start-1).terrain==='water')start--;
   while(at(end+1)?.bridge&&at(end+1).terrain==='water')end++;
   // A damaged/incomplete crossing keeps the existing flat road rendering.
   if(at(start-1)?.terrain!=='land'||at(end+1)?.terrain!=='land')continue;
   candidates.push({axis,start:start-1,end:end+1,min:cross,max:cross});
  }
  candidates.sort((a,b)=>a.end-a.start-(b.end-b.start));
  const row=candidates[0];if(row)rows.set(`${row.axis}:${row.start}:${row.end}:${row.min}`,row);
 }
 const bridges=[];
 for(const row of [...rows.values()].sort((a,b)=>a.axis.localeCompare(b.axis)||a.min-b.min||a.start-b.start)){
  const previous=bridges.find(b=>b.axis===row.axis&&b.max===row.min-1&&b.start<row.end&&row.start<b.end&&(()=>{
   for(let along=Math.min(b.start,row.start);along<=Math.max(b.end,row.end);along++)for(let cross=b.min;cross<=row.max;cross++){
    const t=roads.get(b.axis==='ew'?key(along,cross):key(cross,along));if(!t||t.interchange||(t.terrain==='water'&&!t.bridge))return false;
   }return true;
  })());
  if(previous){previous.max=row.max;previous.start=Math.min(previous.start,row.start);previous.end=Math.max(previous.end,row.end);}
  else bridges.push({...row});
 }
 const cells=new Map();
 for(const b of bridges){
  b.center=(b.start+b.end)/2;b.cross=(b.min+b.max)/2;b.length=b.end-b.start+1;b.width=b.max-b.min+1;
  b.riverSpan=b.length-2;
  // Each opening is two road cells wide. Fit whole openings plus solid piers;
  // distribute the remaining space into supports instead of stretching holes.
  const clearWidth=b.riverSpan<ARCH_CLEAR_WIDTH?b.riverSpan*.84:ARCH_CLEAR_WIDTH;
  const count=Math.max(1,Math.floor((b.riverSpan+MIN_PIER_WIDTH)/(ARCH_CLEAR_WIDTH+MIN_PIER_WIDTH)));
  const spare=Math.max(0,(b.riverSpan-count*clearWidth-(count-1)*MIN_PIER_WIDTH)/(count+1));
  b.pierWidth=MIN_PIER_WIDTH+spare;
  b.rise=count===1?Math.min(1.24,Math.max(.55,.3+b.riverSpan*.24)):1.24;
  b.approach=Math.min(3,b.length*.4);b.opening=clearWidth/2;
  const first=b.start+.5+spare+b.opening,pitch=clearWidth+b.pierWidth;
  b.arches=Array.from({length:count},(_,i)=>({center:first+pitch*i,opening:b.opening}));
  b.piers=Array.from({length:count-1},(_,i)=>first+pitch*(i+.5));
  // Match the road renderer's shared cross-section level, including upgrades.
  b.roadLevels=Array.from({length:b.length},(_,i)=>Math.min(...Array.from({length:b.width},(_,j)=>roads.get(b.axis==='ew'?key(b.start+i,b.min+j):key(b.min+j,b.start+i)).road)));
  for(let a=b.start;a<=b.end;a++)for(let c=b.min;c<=b.max;c++)cells.set(b.axis==='ew'?key(a,c):key(c,a),b);
 }
 const layout={bridges,cells};cache.set(state,{tiles:state.tiles,layout});return layout;
}
export const stoneBridgeAt=(state,x,y)=>stoneBridgeLayout(state).cells.get(key(Math.floor(x+.5),Math.floor(y+.5)));
export function stoneDeckHeight(b,along){
 const t=Math.max(0,Math.min(1,(along-(b.start-.5))/b.length));
 // Short bridges retain their gentle hump; long bridges have level spans and
 // smooth approaches instead of stretching one enormous arch across the river.
 const profile=b.arches.length===1?Math.sin(Math.PI*t)**2:Math.sin(Math.PI/2*Math.min(1,Math.min(t,1-t)*b.length/b.approach))**2;
 return .079+b.rise*profile;
}
export const stoneArchAt=(b,along)=>b.arches.find(a=>Math.abs(along-a.center)<=a.opening);
export function stoneArchHeight(b,along){
 const arch=stoneArchAt(b,along);if(!arch)return -.22;
 const u=(along-arch.center)/arch.opening;
 return Math.min(stoneDeckHeight(b,along)-.20,-.09+(b.rise-.10)*Math.sqrt(Math.max(0,1-u*u)));
}
// Shared by wheels, walkers, road lamps and overlays; construction rebuilds the cache.
export function roadSurfaceHeight(state,x,y,axis){
 const b=stoneBridgeAt(state,x,y);if(b)return stoneDeckHeight(b,b.axis==='ew'?x:y);
 const size=state.mapSize||64,water=(x,y)=>state.tiles[y*size+x]?.terrain==='water';
 const along=axis==='ns'?y:x,base=Math.floor(along),f=along-base,cross=Math.round(axis==='ns'?x:y);
 const wet=a=>axis==='ns'?water(cross,a):water(a,cross);
 return .079+.114*((wet(base)?1-f:0)+(wet(base+1)?f:0))+roadElevation(state,x,y,axis);
}
