import {COMMERCIAL_FACTORIES} from '../src/commercial-prerequisites.js';
export function addFactoryPrerequisites(sim,kinds=[...new Set(Object.values(COMMERCIAL_FACTORIES))]){
 for(let x=0;x<=16;x++)sim.tile(x,32).road=1;
 sim._newBuilding(1,31,'power',true);sim._newBuilding(2,31,'water',true);
 kinds.forEach((kind,i)=>{
  const b=sim._newBuilding(3+i,33,'industrial',true);b.businessKind=kind;sim.tile(b.x,b.y).businessKind=kind;
 });
 sim.recalculate();return sim;
}
