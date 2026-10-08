import {buildingCells} from './building-footprint.js';
import {groundRoadAccess} from './interchanges.js';
import {gridIndex,inGrid} from './grid.js';
import {getCitizenStory} from './city-life.js';
import {pedestrianStroll} from './pedestrian-routing.js';
import {residentHash} from './resident-journeys.js';

export const PEDESTRIAN_CAPACITY=96;

// Plain data only: the worker plans outings, the renderer owns animation clocks
// and Three.js objects. This also serves initial loads and construction edits.
export function planPedestrians(state,capacity=PEDESTRIAN_CAPACITY){
  const homes=(state.buildings||[]).filter(b=>b.type==='residential'&&b.population>0&&b.progress>=1);
  const people=[];
  const walkable=p=>inGrid(state,p.x,p.y)&&!!state.tiles[gridIndex(state,p.x,p.y)]?.road;
  const nearby=p=>[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}].filter(walkable);
  for(const home of homes){
    if(people.length>=capacity)break;
    const neighbors=[...new Map(buildingCells(home).flatMap(nearby).filter(p=>groundRoadAccess(state.tiles[gridIndex(state,p.x,p.y)])).map(p=>[`${p.x},${p.y}`,p])).values()];
    if(!neighbors.length)continue;
    const count=home.population>=16?2:1;
    for(let slot=0;slot<count&&people.length<capacity;slot++){
      const id=`resident-${home.id}-${slot}`,nameSeed=residentHash(id),origin=neighbors[nameSeed%neighbors.length];
      const journey=getCitizenStory(state,{id,nameSeed,kind:'pedestrian',homeId:home.id,...origin})?.journey;
      const trip=journey?.sidewalk?.length?journey:pedestrianStroll(state,home,nameSeed);
      const points=trip?.points||[],sidewalk=trip?.sidewalk||[];
      if(sidewalk.length<2)continue;
      const path=sidewalk.map(p=>({...p,x:p.x-31.5,z:p.y-31.5})),lengths=[0];
      for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
      if(lengths.at(-1)<.001)continue;
      people.push({id,nameSeed,homeId:home.id,kind:'pedestrian',points,path,lengths,
        signature:path.map(p=>`${p.x},${p.z},${p.height}`).join(';'),x:origin.x,y:origin.y});
    }
  }
  return {hasResidents:homes.length>0,people};
}
