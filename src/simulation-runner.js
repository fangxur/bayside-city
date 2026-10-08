export class SimulationRunner {
  constructor(createWorker=()=>new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'})) {
    this.createWorker=createWorker;
    this.worker=null;
    this.disabled=false;
    this.pending=false;
  }

  async tick(sim,isCurrent=()=>true) {
    if(this.pending)return false;
    this.pending=true;
    const state=sim.state,checkpoint=sim.serializeCompact();
    try {
      let result;
      if(!this.disabled)try {
        this.worker??=this.createWorker();
        result=await new Promise((resolve,reject)=>{
          this.worker.onmessage=({data})=>data.error?reject(Error(data.error)):resolve(data);
          this.worker.onerror=event=>{event.preventDefault?.();reject(Error(event.message||'Simulation worker failed'));};
          this.worker.postMessage({state});
        });
      }catch(error){
        this.worker?.terminate();this.worker=null;this.disabled=true;
        console.warn('城市后台模拟不可用，改用本机同步模拟',error);
      }
      // Building, undo, load and city switching remain available during work.
      // A stale result must never overwrite a newer edit or another city.
      if(!isCurrent()||sim.state!==state||sim.serializeCompact()!==checkpoint)return false;
      if(result){
        Object.assign(state,result.state);sim._pedestrianPlans=result.pedestrianPlans;
        sim._publicRoutes=result.publicRoutes;sim._undo=null;
      }else{sim.tick();sim._pedestrianPlans=undefined;sim._publicRoutes=undefined;}
      return true;
    }finally{this.pending=false;}
  }
}
