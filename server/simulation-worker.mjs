import {parentPort} from 'node:worker_threads';
import {CitySimulation} from '../src/simulation.js';
import {planPedestrians} from '../src/pedestrian-plans.js';
import {publicVehicleRoutes} from '../src/public-vehicles.js';

// Workers never open the database. The main thread commits a result only if
// its source revision is still current, preserving treasury and undo rules.
parentPort.on('message',({kind,state,method,args})=>{
  try{
    const sim=Object.create(CitySimulation.prototype);sim.state=state;sim._undo=null;
    let result;
    if(kind==='tick')sim.tick();
    else{try{result=sim[method](...args);}catch{result={ok:false,message:'操作参数无效'};}}
    const renderPlans=kind==='tick'||result?.ok
      ?{pedestrians:planPedestrians(sim.state),publicRoutes:publicVehicleRoutes(sim.state)}:undefined;
    parentPort.postMessage({state:sim.state,result,renderPlans});
  }catch(error){parentPort.postMessage({error:error.message});}
});
