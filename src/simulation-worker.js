import {CitySimulation} from './simulation.js';
import {planPedestrians} from './pedestrian-plans.js';
import {publicVehicleRoutes} from './public-vehicles.js';

// The input already contains derived state. Deserializing a save here would
// unnecessarily calculate the entire city once before advancing it.
export function advanceSimulationState(state) {
  const sim=Object.create(CitySimulation.prototype);
  sim.state=state;
  sim._undo=null;
  sim.tick();
  return sim.state;
}

if(typeof self!=='undefined')self.onmessage=({data})=>{
  try{
    const state=advanceSimulationState(data.state);
    self.postMessage({state,pedestrianPlans:planPedestrians(state),publicRoutes:publicVehicleRoutes(state)});
  }
  catch(error){self.postMessage({error:error.message});}
};
