import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation,SIZE} from '../src/simulation.js';
import {buildingCells,footprintSize} from '../src/building-footprint.js';
import {buildingCapacity,upgradeOffer,utilityMaintenance} from '../src/progression.js';
import {LARGE_UTILITIES} from '../src/utility-buildings.js';
import {executeCityCommand,commandGuard} from '../src/city-commands.js';
import {cityCatalog,catalogPreview} from '../src/city-catalog.js';
import {CityRenderer} from '../src/renderer.js';

function city(){
  const sim=new CitySimulation();sim.state.money=1000000;
  for(let x=0;x<=25;x++)sim.tile(x,32).road=1;
  sim.recalculate();return sim;
}

test('large utilities reserve four cells and charge once through the cooperative build command',()=>{
  const sim=city();
  for(const [i,[tool,def]] of Object.entries(LARGE_UTILITIES).entries()){
    const cell={x:3+i*3,y:30},funds=sim.state.money,args=[tool,[cell],{}];
    const p=sim.preview(tool,[cell,{x:18,y:30}]);
    assert(p.valid);assert.equal(p.cost,def.cost);assert.equal(p.cells.length,4);
    const guard=commandGuard(sim,'build',args);
    assert(executeCityCommand(sim,'build',args).ok);assert.notEqual(commandGuard(sim,'build',args),guard);
    const b=sim.state.buildings.at(-1);
    assert.equal(sim.state.money,funds-def.cost);assert.equal(b.type,def.type);assert.equal(b.footprint,2);
    assert(b.connected&&b.powered&&b.watered);assert.equal(buildingCapacity(b),def.capacity);
    for(const c of buildingCells(b)){
      assert.equal(sim.tile(c.x,c.y).buildingId,b.id);assert.equal(sim.getInfo(c.x,c.y).buildingId,b.id);
    }
    assert.equal(sim.getInfo(b.x,b.y).title,def.name);
    assert.equal(sim.getInfo(b.x,b.y).metrics.find(m=>m.label==='月维护').value,'¥'+def.maintenance);
    assert.equal(b.publicPayroll,def.maintenance*.2);
    assert.equal(sim.state.stats[def.type+'Capacity'],def.capacity);
    assert(b.coverageCells.length>0);
  }
  assert.equal(sim.state.stats.breakdown.facilityMaintenance,920);
  assert.equal(sim.state.stats.powerUsed,8);
  for(const serialize of ['serialize','serializeCompact']){
    const copy=CitySimulation.deserialize(sim[serialize]());
    assert.equal(copy.state.stats.powerCapacity,3000);assert.equal(copy.state.stats.waterCapacity,3600);
    assert(copy.state.buildings.every(b=>buildingCells(b).length===4));
  }
  const [power,water]=sim.state.buildings;
  sim.setBuildingActive(power.id,false);assert.equal(sim.state.stats.powerCapacity,0);assert.equal(sim.state.stats.waterCapacity,0);
  sim.setBuildingActive(power.id,true);sim.setBuildingActive(water.id,false);assert.equal(sim.state.stats.waterCapacity,0);
  sim.setBuildingActive(water.id,true);assert.equal(sim.state.stats.waterCapacity,3600);
});

test('large utility upgrades keep fourfold previous supply during construction and scale costs at every tier',()=>{
  for(const [tool,def] of Object.entries(LARGE_UTILITIES)){
    const sim=city();sim.build('power',[{x:1,y:31}]);sim.build(tool,[{x:3,y:30}]);
    const b=sim.state.buildings.at(-1);
    assert(!sim.preview('upgrade',[b]).valid);
    for(const [i,stage] of ['density','metropolis','capital','regional','global'].entries()){
      sim.state.milestones[stage]=true;
      const small={...b,footprint:1},offer=upgradeOffer(b,sim.state),funds=sim.state.money,old=buildingCapacity(b);
      assert.equal(offer.cost,upgradeOffer(small,sim.state).cost*4);
      assert(sim.build('upgrade',buildingCells(b)).ok);assert.equal(sim.state.money,funds-offer.cost);
      assert.equal(b.level,i+2);assert.equal(b.footprint,2);
      const extra=def.type==='power'?750:0;
      assert.equal(sim.state.stats[def.type+'Capacity'],old+extra);
      const copy=CitySimulation.deserialize(sim.serializeCompact());
      for(const current of [sim,copy]){
        assert.equal(current.state.stats[def.type+'Capacity'],old+extra);
        current.tick();current.tick();
        assert.equal(current.state.stats[def.type+'Capacity'],buildingCapacity(b)+extra);
      }
      assert.equal(buildingCapacity(b),buildingCapacity({...b,footprint:1})*4);
      assert.equal(utilityMaintenance(b),utilityMaintenance({...b,footprint:1})*4);
    }
    assert(!sim.preview('upgrade',[b]).valid);
  }
});

test('large utilities reject blocked sites and insufficient funds without changing the city',()=>{
  for(const [tool,def] of Object.entries(LARGE_UTILITIES))for(const obstacle of ['road','border','water','zone','building','money','offroad']){
    const sim=city(),cell={x:3,y:30};
    if(obstacle==='road')sim.tile(4,30).road=1;
    if(obstacle==='border')cell.x=SIZE-1;
    if(obstacle==='water')sim.tile(4,30).terrain='water';
    if(obstacle==='zone')sim.build('residential',[{x:4,y:31}]);
    if(obstacle==='building')sim.build('park',[{x:4,y:30}]);
    if(obstacle==='money')sim.state.money=def.cost-1;
    if(obstacle==='offroad')cell.y=20;
    const before=sim.serialize();assert(!sim.preview(tool,[cell]).valid,obstacle);
    assert(!sim.build(tool,[cell]).ok,obstacle);assert.equal(sim.serialize(),before);
  }
});

test('moving, rotating and demolishing a large utility operate on the whole facility with undo',()=>{
  for(const [tool,def] of Object.entries(LARGE_UTILITIES)){
    const sim=city();sim.build(tool,[{x:3,y:30}]);const b=sim.state.buildings[0];
    assert(sim.moveBuilding(b.id,{x:4,y:30}).ok);assert.equal(sim.tile(3,30).buildingId,null);
    assert(sim.rotateBuilding(b.id).ok);
    const copy=CitySimulation.deserialize(sim.serialize()),saved=copy.state.buildings[0];
    assert.equal(saved.rotation,1);assert.equal(footprintSize(saved),2);
    const before=copy.serialize(),funds=copy.state.money;
    assert.equal(copy.preview('bulldoze',buildingCells(saved)).cost,-def.cost*.2);
    assert(copy.build('bulldoze',[{x:5,y:31}]).ok);assert.equal(copy.state.money,funds+def.cost*.2);
    assert.equal(copy.state.buildings.length,0);
    assert(buildingCells(saved).every(c=>copy.tile(c.x,c.y).buildingId===null));
    assert(copy.undo().ok);assert.equal(copy.serialize(),before);
  }
});

test('saves preserve small utilities and reject malformed large utility footprints',()=>{
  const sim=city();sim.build('power',[{x:1,y:31}]);sim.build('water',[{x:2,y:31}]);sim.build('largePower',[{x:3,y:30}]);
  for(const explicit of [false,true]){
    const raw=JSON.parse(sim.serialize());if(explicit)raw.buildings[0].footprint=raw.buildings[1].footprint=1;
    const copy=CitySimulation.deserialize(JSON.stringify(raw));
    assert.equal(copy.state.stats.powerCapacity,3750);assert.equal(copy.state.stats.waterCapacity,900);
    assert.equal(copy.state.buildings[0].x,1);assert.equal(footprintSize(copy.state.buildings[0]),1);
    assert.equal(copy.tile(2,31).buildingId,sim.state.buildings[1].id);
  }
  for(const corrupt of [raw=>raw.buildings[2].footprint=3,raw=>raw.buildings[2].footprint=1,raw=>raw.tiles[31*SIZE+4].buildingId=null]){
    const raw=JSON.parse(sim.serialize());corrupt(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
  }
});

test('catalog distinguishes sizes and previews the real four-cell model at every level',()=>{
  const sim=city();sim.build('power',[{x:1,y:31}]);sim.build('largePower',[{x:3,y:30}]);sim.build('largePower',[{x:6,y:30}]);
  const entries=cityCatalog(sim.state).buildings;
  assert.equal(entries.find(e=>e.id==='building:power').count,1);
  assert.equal(entries.find(e=>e.id==='building:largePower').count,2);
  for(const tool of Object.keys(LARGE_UTILITIES))for(let level=1;level<=6;level++){
    const preview=catalogPreview(entries.find(e=>e.id==='building:'+tool),level);
    assert.equal(preview.state.buildings[0].footprint,2);assert.equal(preview.state.tiles.filter(t=>t.buildingId).length,4);
  }
});

test('large utility models fill four cells and remain inside their sites during upgrades and rotations',()=>{
  const renderer=Object.create(CityRenderer.prototype),x=10,y=10;
  for(const type of ['power','water'])for(let level=1;level<=6;level++)for(const progress of [.6,1])for(let rotation=0;rotation<4;rotation++){
    renderer._tile=(a,b)=>({road:a===x+1&&b===y+2});
    const parts=[],batch={add:(...a)=>parts.push(a),box:(...a)=>parts.push(['box',...a])};
    renderer._building(batch,{id:1,type,x,y,level,progress,rotation,footprint:2});
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const [,color,px,py,pz,w,h,d,ry=0] of parts){
      assert([color,px,py,pz,w,h,d,ry].every(Number.isFinite));assert(w>0&&h>0&&d>0);
      const dx=(Math.abs(Math.cos(ry))*w+Math.abs(Math.sin(ry))*d)/2,dz=(Math.abs(Math.sin(ry))*w+Math.abs(Math.cos(ry))*d)/2;
      left=Math.min(left,px-dx);right=Math.max(right,px+dx);top=Math.min(top,pz-dz);bottom=Math.max(bottom,pz+dz);
    }
    assert(left>=x-SIZE/2&&right<=x-SIZE/2+2);assert(top>=y-SIZE/2&&bottom<=y-SIZE/2+2);
    assert(right-left>1.9&&bottom-top>1.9);
  }
});
