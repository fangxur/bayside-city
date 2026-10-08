import {vehicleNetwork,vehicleTrip} from './vehicle-routing.js';
import {adjacentRoads,roadReach} from './road-network.js';
import {gridIndex,gridNeighbors,gridPoint} from './grid.js';
import {communityService} from './community-buildings.js';

const operational=b=>b.active!==false&&b.progress>=1&&b.connected&&b.powered&&b.watered;

// Coverage follows the real street network rather than crossing water or gaps.
export function policeCoverageCells(state,station){
  if(!operational(station))return [];
  const reach=roadReach(state,adjacentRoads(state,station),communityService(station).radius),cells=new Set();
  for(const index of reach.distance.keys()){
    const {x,y}=gridPoint(state,index);cells.add(index);
    for(const [nx,ny] of gridNeighbors(state,x,y)){
      const next=gridIndex(state,nx,ny),tile=state.tiles[next];
      if(tile.terrain==='land'&&!tile.road)cells.add(next);
    }
  }
  return [...cells];
}

// Each stop connects to the nearest later reachable stop. This produces a
// deterministic network without duplicate pairs; disconnected stops stay idle.
export function busRoutes(state,network=vehicleNetwork(state)){
  const stops=state.buildings.filter(b=>b.type==='busStop'&&operational(b)).sort((a,b)=>a.id-b.id),routes=[];
  for(let i=0;i<stops.length-1;i++){
    let best=null;
    for(let j=i+1;j<stops.length;j++){
      const trip=vehicleTrip(state,stops[i],stops[j],{network}),path=trip?.points||[];
      if(path.length>=2&&(!best||path.length<best.path.length))best={target:stops[j],path,trip};
    }
    if(best)routes.push({kind:'bus',load:1,facilityId:stops[i].id,targetId:best.target.id,points:best.path.concat(best.trip.returnPoints.slice(1)),directed:true,outboundLength:best.path.length});
  }
  return routes;
}

export function servedBusStops(state,routes=busRoutes(state)){
  const ids=new Set(routes.flatMap(route=>[route.facilityId,route.targetId]));
  return state.buildings.filter(b=>b.type==='busStop'&&ids.has(b.id));
}

export function busCommuteAvailable(stops,home,workplace){
  const nearby=building=>stops.filter(stop=>Math.hypot(stop.x-building.x,stop.y-building.y)<=communityService(stop).radius);
  return nearby(home).some(from=>nearby(workplace).some(to=>to.id!==from.id));
}
