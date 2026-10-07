import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {buildingStyle,BUILDING_STYLES} from '../src/building-styles.js';
test('six architecture families have deterministic shapes with Chinese styles and varied massing',()=>{
 assert.equal(BUILDING_STYLES.length,6);assert.equal(BUILDING_STYLES.filter(s=>s.chinese).length,2);
 for(const type of ['residential','commercial','industrial'])for(let level=1;level<=4;level++){
  const shapes=[];for(let variant=0;variant<6;variant++){
   const b={id:42,type,level,variant},a=buildingStyle(b);assert.deepEqual(a,buildingStyle({...b,x:20,y:30}));assert(a.height>0);assert(a.width<.9);shapes.push(a.name);
  }assert.equal(new Set(shapes).size,6);
 }
});
test('random architecture persists through moves, upgrades and save loading without changing city economics',()=>{
 const s=new CitySimulation();s.state.money=100000;s.state.milestones.density=true;
 for(let i=0;i<24;i++){const x=8+i%12,y=20+Math.floor(i/12);s._newBuilding(x,y,'residential',true);}
 s.recalculate();assert(new Set(s.state.buildings.map(b=>b.variant)).size>=5);
 const b=s.state.buildings[0],style=buildingStyle(b).name;
 s.tile(10,25).road=1;s.recalculate();
 assert(s.moveBuilding(b.id,{x:10,y:24}).ok);assert.equal(buildingStyle(b).name,style);
 assert(s.build('upgrade',[b]).ok);assert.equal(buildingStyle(b).name,style);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(buildingStyle(copy.state.buildings.find(v=>v.id===b.id)).name,style);
 const before=JSON.stringify(copy.state.stats);copy.state.buildings.forEach(b=>b.variant=(b.variant+1)%6);copy.recalculate();assert.equal(JSON.stringify(copy.state.stats),before);
});
