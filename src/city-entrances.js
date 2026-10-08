import {mapSize,gridIndex} from './grid.js';

export const ENTRANCE_SIDE_NAMES=Object.freeze({west:'西侧',east:'东侧',north:'北侧',south:'南侧'});

// Derive gateways from roads so existing saves, undo and multiplayer share the
// same rules. Adjacent lanes on an edge form one wide gateway.
export function cityEntrances(state,{removed=new Set()}={}){
  const size=mapSize(state),last=size-1,entrances=[],claimed=new Set();
  const road=(x,y)=>{const i=gridIndex(state,x,y),t=state.tiles[i];return t?.road&&t.terrain==='land'&&!removed.has(i);};
  for(const side of ['west','east','north','south']){
    let group=null;
    for(let offset=0;offset<size;offset++){
      const x=side==='west'?0:side==='east'?last:offset;
      const y=side==='north'?0:side==='south'?last:offset;
      const i=gridIndex(state,x,y);
      const inward=side==='west'?[1,y]:side==='east'?[last-1,y]:side==='north'?[x,1]:[x,last-1];
      const eligible=road(x,y)&&!claimed.has(i)&&((x===0&&y===32)||road(...inward));
      if(!eligible){group=null;continue;}
      if(!group){group={id:`${side}:${offset}`,side,x,y,roadIndexes:[]};entrances.push(group);}
      group.roadIndexes.push(i);claimed.add(i);
    }
  }
  return entrances;
}

export const entranceRoadIndexes=(state,options)=>cityEntrances(state,options).flatMap(p=>p.roadIndexes);
