import test from 'node:test';
import assert from 'node:assert/strict';
import {setupTaxControl} from '../src/tax-control.js';

class Input extends EventTarget{value='9';disabled=false;fire(name){this.dispatchEvent(new Event(name));}}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function control(){
  const input=new Input(),output={value:''},status={textContent:''};
  let state={city:'solo',rate:9,disabledReason:''},resolve;
  const commits=[],errors=[];let applied=0;
  const ui=setupTaxControl({input,output,status,getState:()=>state,commit:rate=>{commits.push(rate);return new Promise(r=>resolve=r);},onApplied:()=>applied++,notify:message=>errors.push(message)});
  ui.sync();
  return {input,output,status,ui,commits,errors,get applied(){return applied;},set state(value){state=value;},get state(){return state;},finish:result=>resolve(result)};
}

test('dragging updates the displayed percentage before release and background refresh preserves the chosen rate',()=>{
  const c=control();c.input.value='12';c.input.fire('input');assert.equal(c.output.value,'12%');assert.deepEqual(c.commits,[]);
  c.ui.sync();assert.equal(c.input.value,'12');assert.equal(c.output.value,'12%');
});

test('release submits once, keeps the selected value during saving, then adopts the authoritative result',async()=>{
  const c=control();c.input.value='12';c.input.fire('input');c.input.fire('change');
  assert.deepEqual(c.commits,[12]);assert(c.input.disabled);c.ui.sync();assert.equal(c.input.value,'12');
  c.input.fire('change');assert.deepEqual(c.commits,[12]);
  c.state.rate=12;c.finish({ok:true});await flush();assert.equal(c.applied,1);assert.equal(c.output.value,'12%');assert(!c.input.disabled);
});

test('a rejected or disconnected submission resets both slider and label to the actual city rate',async()=>{
  const c=control();c.input.value='15';c.input.fire('input');c.input.fire('change');c.finish({ok:false,message:'保存失败'});await flush();
  assert.equal(c.input.value,'9');assert.equal(c.output.value,'9%');assert.deepEqual(c.errors,['保存失败']);assert.equal(c.applied,0);assert(!c.input.disabled);
});

test('read-only players cannot drag a working-looking slider and receive the reason',()=>{
  const c=control();c.state.disabledReason='合作城市的税率由房主调整。';c.ui.sync();assert(c.input.disabled);assert.equal(c.status.textContent,c.state.disabledReason);c.input.fire('change');assert.deepEqual(c.commits,[]);
});

test('switching cities or restoring another epoch discards an old pending tax result',async()=>{
  const c=control();c.input.value='12';c.input.fire('input');c.input.fire('change');
  c.state={city:'cooperative:2',rate:7,disabledReason:''};c.ui.sync();assert.equal(c.output.value,'7%');assert(!c.input.disabled);
  c.finish({ok:false,message:'旧城市保存失败'});await flush();assert.equal(c.output.value,'7%');assert.equal(c.applied,0);assert.deepEqual(c.errors,[]);
});
