import {Worker} from 'node:worker_threads';

export class SimulationJobs{
  constructor({workers=2}={}){this.capacity=workers;this.slots=[];this.queue=[];this.closed=false;}
  run(kind,payload){
    if(this.closed)return Promise.reject(Error('Simulation jobs closed'));
    return new Promise((resolve,reject)=>{
      this.queue.push({kind,payload,resolve,reject});
      if(kind==='command')this.cancelTicks(payload.cityId);
      this.dispatch();
    });
  }
  cancelTicks(cityId){
    if(!cityId)return;
    const cancelled=Object.assign(Error('Tick superseded by construction'),{cancelled:true});
    this.queue=this.queue.filter(job=>{if(job.kind!=='tick'||job.payload.cityId!==cityId)return true;job.reject(cancelled);return false;});
    for(const slot of [...this.slots])if(slot.job?.kind==='tick'&&slot.job.payload.cityId===cityId){
      this.slots.splice(this.slots.indexOf(slot),1);slot.job.reject(cancelled);slot.worker.terminate();
    }
  }
  dispatch(){
    if(this.closed||!this.queue.length)return;
    while(this.slots.length<this.capacity){
      const worker=new Worker(new URL('./simulation-worker.mjs',import.meta.url),{
        // Host/test runner flags may not be valid for a file-based worker.
        execArgv:[],
      });
      const slot={worker,job:null};this.slots.push(slot);worker.unref();
      worker.on('message',data=>{
        const job=slot.job;if(this.closed||!this.slots.includes(slot)||!job)return;slot.job=null;worker.unref();
        if(data.error)job.reject(Error(data.error));else job.resolve(data);
        this.dispatch();
      });
      worker.on('error',error=>this.failed(slot,error));
      worker.on('exit',code=>{if(!this.closed&&this.slots.includes(slot))this.failed(slot,Error('Simulation worker exited: '+code));});
      worker.unref();
    }
    for(const slot of this.slots){
      if(slot.job||!this.queue.length)continue;
      // A queued edit takes precedence over the next periodic city tick.
      const priority=this.queue.findIndex(job=>job.kind==='command');
      const [job]=this.queue.splice(priority<0?0:priority,1);slot.job=job;slot.worker.ref();
      try{slot.worker.postMessage({kind:job.kind,...job.payload});}
      catch(error){this.failed(slot,error);}
    }
  }
  failed(slot,error){
    const index=this.slots.indexOf(slot);if(index<0)return;
    this.slots.splice(index,1);slot.job?.reject(error);slot.worker.terminate();this.dispatch();
  }
  close(){
    this.closed=true;
    for(const job of this.queue.splice(0))job.reject(Error('Simulation jobs closed'));
    for(const slot of this.slots.splice(0)){slot.job?.reject(Error('Simulation jobs closed'));slot.worker.terminate();}
  }
}
