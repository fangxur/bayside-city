import {groundRoadAccess,roadNodes,roadSteps,roadIndex} from './interchanges.js';
import {buildingCells} from './building-footprint.js';
import {gridIndex,gridPoint,inGrid} from './grid.js';
const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];

export function adjacentRoads(state,building){
  const roads=new Set();
  for(const cell of buildingCells(building))for(const [dx,dy] of DIRECTIONS){
    const x=cell.x+dx,y=cell.y+dy;
    if(!inGrid(state,x,y))continue;
    if(state.tiles[gridIndex(state,x,y)]?.road&&state.tiles[gridIndex(state,x,y)].connected&&groundRoadAccess(state.tiles[gridIndex(state,x,y)]))roads.add(gridIndex(state,x,y));
  }
  return [...roads].sort((a,b)=>a-b);
}

export function roadPath(state,from,to){
  const starts=adjacentRoads(state,from).flatMap(i=>roadNodes(state,i)),ends=new Set(adjacentRoads(state,to).flatMap(i=>roadNodes(state,i)));
  if(!starts.length||!ends.size)return [];
  const queue=[...starts],previous=new Map(starts.map(node=>[node,null]));let found=queue.find(node=>ends.has(node));
  for(let head=0;found===undefined&&head<queue.length;head++)for(const next of roadSteps(state,queue[head],{connected:true})){
    if(previous.has(next))continue;previous.set(next,queue[head]);queue.push(next);
    if(ends.has(next)){found=next;break;}
  }
  if(found===undefined)return [];
  const result=[];for(let at=found;at!==null;at=previous.get(at))result.push(gridPoint(state,roadIndex(at)));
  return result.reverse();
}

export function roadReach(state,starts,range){
  const queue=starts.flatMap(i=>roadNodes(state,i)),nodeDistance=new Map(queue.map(node=>[node,0])),previous=new Map(),distance=new Map(),bestNodes=new Map();
  for(let head=0;head<queue.length;head++){
    const node=queue[head],index=roadIndex(node),d=nodeDistance.get(node);
    if(!distance.has(index)||d<distance.get(index)){distance.set(index,d);bestNodes.set(index,node);}
    if(d>=range)continue;
    for(const next of roadSteps(state,node,{connected:true}))if(!nodeDistance.has(next)){nodeDistance.set(next,d+1);previous.set(next,node);queue.push(next);}
  }
  return {distance,previous,bestNodes};
}
