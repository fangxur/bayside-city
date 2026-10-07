import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {StreetCelebration,celebrationStreets} from '../src/street-celebration.js';
test('celebrations use connected land streets near residents without mutating the city',()=>{
 const s=new CitySimulation({demo:true}),before=s.serialize(),sites=celebrationStreets(s.state);assert(sites.length>0&&sites.length<=4);
 for(const t of sites)assert(t.road&&t.connected&&!t.bridge&&t.terrain==='land');
 const effect=new StreetCelebration(s.state);assert.equal(effect.people.length,sites.length*8);
 effect.update(1,s.state);assert([...effect.sparks.instanceMatrix.array].every(Number.isFinite));
 const snapshot=[...effect.sparks.instanceMatrix.array];effect.update(0,s.state);assert.deepEqual([...effect.sparks.instanceMatrix.array],snapshot);
 assert.equal(s.serialize(),before);assert.equal(effect.update(24,s.state),false);effect.dispose();
});
test('celebrations handle missing roads and reduced motion',()=>{
 const s=new CitySimulation({demo:true}),effect=new StreetCelebration(s.state,{reducedMotion:true});
 effect.update(1,s.state);assert(effect.people.every(p=>p.person.position.y===.045));
 for(const t of s.state.tiles)t.road=0;effect.update(1,s.state);assert(effect.people.every(p=>!p.person.visible));effect.dispose();
 const empty=new StreetCelebration(s.state);assert.equal(empty.people.length,0);empty.dispose();
});
test('grand milestone celebrations use denser, taller and longer fireworks',()=>{
 const s=new CitySimulation({demo:true}),normal=new StreetCelebration(s.state),grand=new StreetCelebration(s.state,{grand:true});
 assert.equal(normal.duration,24);assert.equal(grand.duration,36);assert(grand.sparks.count>normal.sparks.count);assert.equal(grand.volleys,3);
 grand.update(1,s.state);assert([...grand.sparks.instanceMatrix.array].every(Number.isFinite));assert.equal(grand.update(35,s.state),false);
 normal.dispose();grand.dispose();
});
