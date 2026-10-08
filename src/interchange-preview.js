import {CitySimulation} from './simulation.js';
import {requiresRoad} from './building-access.js';

// A preview owns its state and undo record. Nothing is charged or persisted
// until the normal construction command is explicitly confirmed.
export function prepareInterchangePreview(sim,tool,point){
  if(!['interchangeNS','interchangeEW','interchangeFlat'].includes(tool))return {ok:false,message:'请选择有效的立交设计'};
  const offer=sim.preview(tool,[point]);
  if(!offer.valid)return {ok:false,message:offer.reason};
  const before=structuredClone(sim.state),candidate=Object.create(CitySimulation.prototype);
  candidate.state=structuredClone(before);candidate._undo=null;
  const result=candidate.build(tool,[point]);if(!result.ok)return result;
  const after=candidate.state;
  const disconnected=before.buildings.filter(b=>requiresRoad(b.type)&&b.connected&&!after.buildings.find(next=>next.id===b.id)?.connected).length;
  return {ok:true,before,after,offer,disconnected};
}
