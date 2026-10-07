import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';

test('buildings reject off-road and diagonal placement without spending funds, including large footprints',()=>{
 for(const tool of ['residential','spanish','industrial','brewery','power','water','fireStation','cityHall','sportsHall']){
  const s=new CitySimulation(),pos={x:15,y:15};s.state.money=100000;
  const before=s.serialize();assert(!s.preview(tool,[pos]).valid,tool);assert(!s.build(tool,[pos]).ok,tool);assert.equal(s.serialize(),before);
  s.tile(14,14).road=1;assert(!s.preview(tool,[pos]).valid,tool+' diagonal');
  s.tile(14,15).road=1;assert(s.preview(tool,[pos]).valid,tool+' roadside');assert(s.build(tool,[pos]).ok);
 }
});
test('zoning drags only charge for roadside parcels; moving cannot bypass the road requirement',()=>{
 const s=new CitySimulation(),cells=[{x:5,y:31},{x:5,y:30}],money=s.state.money;
 const p=s.preview('residential',cells);assert.deepEqual(p.cells,[cells[0]]);
 assert(s.build('residential',cells).ok);assert.equal(s.state.money,money-p.cost);assert.equal(s.tile(5,30).zone,null);
 const b=s._newBuilding(5,31,'residential',true);s.recalculate();const before=s.serialize();
 assert(!s.moveBuilding(b.id,{x:15,y:15}).ok);assert.equal(s.serialize(),before);
 s.tile(15,16).road=1;assert(s.moveBuilding(b.id,{x:15,y:15}).ok);
});
test('open gardens keep their road-free placement rule',()=>{
 const s=new CitySimulation();assert(s.build('park',[{x:15,y:15}]).ok);assert(s.moveBuilding(s.state.buildings[0].id,{x:18,y:18}).ok);
});
