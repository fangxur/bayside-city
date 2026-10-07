import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation,SIZE} from '../src/simulation.js';
import {CityRenderer} from '../src/renderer.js';
import {BUSINESS_KINDS} from '../src/business-kinds.js';
import {buildingCells,footprintSize} from '../src/building-footprint.js';
import {buildingCapacity,upgradeOffer} from '../src/progression.js';
import {privateMaintenance} from '../src/economy.js';

const largeKinds=['logistics','electronics','pharmaceutical','machinery','shipyard','carFactory'];
function servicedCity(){
  const sim=new CitySimulation();
  assert(sim.build('power',[{x:1,y:31}]).ok);
  assert(sim.build('water',[{x:2,y:31}]).ok);
  return sim;
}

test('large factories reserve four cells, finish construction with far-edge road access and scale their economy',()=>{
  for(const kind of largeKinds){
    const sim=servicedCity(),spot={x:3,y:30},money=sim.state.money;
    const preview=sim.preview(kind,[spot,{x:6,y:30}]);
    assert.equal(preview.valid,true,kind);assert.equal(preview.cells.length,4);
    assert.equal(preview.cost,960);
    assert(sim.build(kind,[spot,{x:6,y:30}]).ok);
    assert.equal(sim.state.money,money-960);
    const factory=sim.state.buildings.find(b=>b.businessKind===kind);
    assert.equal(sim.state.buildings.filter(b=>b.type==='industrial').length,1);
    assert.equal(footprintSize(factory),2);assert.equal(factory.progress,.05);
    assert(factory.connected&&factory.powered&&factory.watered);
    assert.equal(factory.jobs,0,'construction does not provide jobs');
    for(const cell of buildingCells(factory)){
      assert.equal(sim.tile(cell.x,cell.y).buildingId,factory.id);
      assert.equal(sim.tile(cell.x,cell.y).businessKind,kind);
      assert.equal(sim.getInfo(cell.x,cell.y).buildingId,factory.id);
    }
    for(let i=0;i<5;i++)sim.tick();
    assert.equal(factory.progress,1);assert.equal(factory.jobs,64);
    assert.equal(privateMaintenance(factory),64);
    assert.equal(sim.state.stats.powerUsed,47);assert.equal(sim.state.stats.waterUsed,45);
    sim.state.milestones.density=true;
    assert.equal(upgradeOffer(factory,sim.state.milestones).cost,4800);
    const beforeUpgrade=sim.state.money;
    assert(sim.build('upgrade',buildingCells(factory)).ok);
    assert.equal(sim.state.money,beforeUpgrade-4800,'charge an upgrade once across all four cells');
    assert.equal(factory.level,2);assert.equal(buildingCapacity(factory),152);
    assert.equal(privateMaintenance(factory),180);
    assert(sim.rotateBuilding(factory.id).ok);
    assert(sim.moveBuilding(factory.id,{x:5,y:30}).ok);
    for(const x of [3,4])for(const y of [30,31])assert.equal(sim.tile(x,y).buildingId,null);
    const restored=CitySimulation.deserialize(sim.serialize());
    const moved=restored.state.buildings.find(b=>b.id===factory.id);
    assert.equal(moved.businessKind,kind);assert.equal(moved.footprint,2);assert.equal(moved.rotation,1);
    assert.equal(restored.preview('bulldoze',[{x:6,y:31}]).cells.length,4);
    assert(restored.build('bulldoze',[{x:6,y:31}]).ok);
    for(const cell of buildingCells(moved)){
      const tile=restored.tile(cell.x,cell.y);
      assert.equal(tile.buildingId,null);assert.equal(tile.zone,null);assert.equal(tile.businessKind,undefined);
    }
    assert(restored.undo().ok);
    assert.equal(CitySimulation.deserialize(restored.serialize()).tile(6,31).buildingId,moved.id);
  }
});

test('large factory placement rejects roads, borders, water, zoning, occupied land and insufficient funds atomically',()=>{
  const invalidSites=[{x:3,y:31},{x:63,y:30},{x:3,y:63},{x:20,y:20}];
  for(const kind of largeKinds){
    for(const cell of invalidSites){
      const sim=servicedCity(),before=sim.serialize();
      assert(!sim.build(kind,[cell]).ok);assert.equal(sim.serialize(),before);
    }
    for(const block of ['water','building','zone','money']){
      const sim=servicedCity();
      if(block==='water')sim.tile(4,30).terrain='water';
      if(block==='building')assert(sim.build('park',[{x:4,y:30}]).ok);
      if(block==='zone')assert(sim.build('workshop',[{x:4,y:31}]).ok);
      if(block==='money')sim.state.money=959;
      const before=sim.serialize();assert(!sim.build(kind,[{x:3,y:30}]).ok,kind+': '+block);
      assert.equal(sim.serialize(),before);
    }
  }
});

test('old single-cell factories and pending zones keep their area, economy and neighbors after loading',()=>{
  for(const kind of largeKinds){
    const sim=servicedCity();
    sim.tile(3,31).zone='industrial';sim.tile(3,31).businessKind=kind;
    const factory=sim._newBuilding(3,31,'industrial',true);
    assert(sim.build('park',[{x:4,y:31}]).ok);
    sim.tile(5,31).zone='industrial';sim.tile(5,31).businessKind=kind;
    sim.recalculate();
    for(const explicitFootprint of [false,true]){
      const raw=JSON.parse(sim.serialize());
      if(explicitFootprint)raw.buildings.find(b=>b.id===factory.id).footprint=1;
      const loaded=CitySimulation.deserialize(JSON.stringify(raw)),old=loaded.state.buildings.find(b=>b.id===factory.id);
      assert.equal(footprintSize(old),1);assert.equal(old.jobs,16);assert.equal(privateMaintenance(old),16);
      assert.equal(upgradeOffer(old,{density:true}).cost,1200);
      assert.equal(loaded.state.buildings.find(b=>b.id===loaded.tile(4,31).buildingId).type,'park');
      loaded.tick();const developed=loaded.state.buildings.find(b=>b.id===loaded.tile(5,31).buildingId);
      assert.equal(developed.businessKind,kind);assert.equal(footprintSize(developed),1);
      assert.equal(CitySimulation.deserialize(loaded.serialize()).state.buildings.length,loaded.state.buildings.length);
    }
  }
});

test('industrial save validation accepts only supported, fully reserved footprints',()=>{
  const sim=servicedCity();assert(sim.build('electronics',[{x:3,y:30}]).ok);
  for(const corrupt of [
    raw=>raw.buildings.find(b=>b.type==='industrial').footprint=3,
    raw=>raw.buildings.find(b=>b.type==='industrial').businessKind='workshop',
    raw=>raw.tiles[31*SIZE+4].buildingId=null,
  ]){const raw=JSON.parse(sim.serialize());corrupt(raw);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));}
});

test('large industrial models fill their four-cell sites through construction, levels and rotations without covering neighbors',()=>{
  const renderer=Object.create(CityRenderer.prototype),x=10,y=10;
  renderer._tile=(a,b)=>({road:a===x+1&&b===y+2});
  for(const kind of largeKinds)for(const progress of [.05,1])for(let level=1;level<=6;level++)for(let rotation=0;rotation<4;rotation++){
    const parts=[],batch={add:(...args)=>parts.push(args),box:(...args)=>parts.push(['box',...args])};
    renderer._building(batch,{id:1,x,y,type:'industrial',businessKind:kind,footprint:2,level,rotation,progress,variant:0});
    const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(const [shape,color,px,py,pz,sx,sy,sz,ry=0] of parts){
      assert([color,px,py,pz,sx,sy,sz,ry].every(Number.isFinite),kind);
      assert(sx>0&&sy>0&&sz>0);
      const dx=(Math.abs(Math.cos(ry))*sx+Math.abs(Math.sin(ry))*sz)/2,dz=(Math.abs(Math.sin(ry))*sx+Math.abs(Math.cos(ry))*sz)/2;
      bounds.left=Math.min(bounds.left,px-dx);bounds.right=Math.max(bounds.right,px+dx);
      bounds.top=Math.min(bounds.top,pz-dz);bounds.bottom=Math.max(bounds.bottom,pz+dz);
    }
    const tolerance=.02;
    assert(bounds.left>=x-SIZE/2-tolerance&&bounds.right<=x-SIZE/2+2+tolerance,kind+' X bounds');
    assert(bounds.top>=y-SIZE/2-tolerance&&bounds.bottom<=y-SIZE/2+2+tolerance,kind+' Y bounds');
    assert(bounds.right-bounds.left>1.7&&bounds.bottom-bounds.top>1.7,kind+' must fill the larger site');
  }
  for(const kind of largeKinds){
    const capture=side=>{
      renderer._tile=(a,b)=>({road:a===x+1&&b===(side==='south'?y+2:y-1)});
      const parts=[];renderer._building({add:(...a)=>parts.push(a),box:(...a)=>parts.push(['box',...a])},{id:1,x,y,type:'industrial',businessKind:kind,footprint:2,level:1,progress:1});return parts;
    };
    assert.notDeepEqual(capture('north'),capture('south'),BUSINESS_KINDS[kind].name+' frontage follows the far road edge');
  }
});
