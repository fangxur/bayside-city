import test from 'node:test';
import assert from 'node:assert/strict';
import {TrafficController} from '../src/traffic-signals.js';
import {boulevardLanes,laneMovements} from '../src/city-layout.js';
import {vehicleLanePose} from '../src/vehicle-routing.js';
import {CityRenderer} from '../src/renderer.js';

const line=(x,y,X,Y)=>Array.from({length:Math.max(Math.abs(X-x),Math.abs(Y-y))+1},(_,i)=>({x:x+Math.sign(X-x)*i,y:y+Math.sign(Y-y)*i}));
const roads=(points,level=2)=>[...new Map(points.map(p=>[`${p.x},${p.y}`,{...p,road:level,terrain:'land',traffic:0}])).values()];
const cross=(level=2)=>roads([14,15].flatMap(i=>[...line(4,i,25,i),...line(i,4,i,25)]),level);
const routes={straight:line(4,15,25,15),left:[...line(4,15,15,15),...line(15,14,15,4)],right:[...line(4,15,14,15),...line(14,16,14,25)]};
const rotate=(points,n)=>points.map(p=>{let {x,y}=p;for(let i=0;i<n;i++)[x,y]=[29-y,x];return {x,y};});
const car=(id,points,travel=0,kind='car')=>({id,points,travel,kind});
const controller=(cars,level=2,tiles=cross(level))=>{const c=new TrafficController();c.sync(tiles,cars);return c;};
const startGreen=(c,axis='ew')=>{for(let t=0;t<18;t+=.05){c.time=t;c._refreshSignals();if(c.signals[0][axis]==='green'&&c.signals[0].remaining>5.9)return;}assert.fail('green phase missing');};

for(const level of [2,5])test(`${level>=5?'three':'two'} lanes select the painted movement from all four approaches`,()=>{
  assert.deepEqual(Array.from({length:level===2?2:3},(_,i)=>laneMovements(level===2?2:3,i)),level===2?[['straight','left'],['straight','right']]:[['left'],['straight'],['right']]);
  for(let turn=0;turn<4;turn++)for(const [movement,source] of Object.entries(routes)){
    const points=rotate(source,turn),c=controller(['a','b'].map(id=>car(id,points,6)),level),p=points[6],q=points[7];
    const layout=c.wideRoads.get(`${p.x},${p.y}`),lanes=boulevardLanes(p,layout);
    const choices=new Set();
    for(const id of ['a','b']){
      const model=c._cars.get(id),pose=vehicleLanePose(points,6,c.wideRoads,model.lanePlan);
      const offset=layout.axis==='ew'?pose.y-p.y:pose.x-p.x;
      const index=lanes.centers.findIndex(center=>Math.abs(center-offset)<1e-6);
      assert(index>=0);assert(laneMovements(lanes.lanesPerDirection,index).includes(movement));choices.add(index);
      assert.equal(lanes.direction,(q.x-p.x)||(q.y-p.y));
    }
    if(movement==='straight')assert.equal(choices.size,level===2?2:1,'both legal straight lanes are used');
  }
});

test('parallel queues stop independently and several followers pass during one green',()=>{
  const cars=Array.from({length:8},(_,i)=>car(String.fromCharCode(97+i),routes.straight,8-Math.floor(i/2)*.55));
  const c=controller(cars);c.step(5);
  assert.equal(c.getPose('a').distance,c.getPose('b').distance);
  assert(Math.abs(c.getPose('a').lanePose.y-c.getPose('b').lanePose.y)>.4);
  startGreen(c);const cleared=new Set();let sideBySide=false;
  for(let i=0;i<170;i++){
    c.step(1/30);const a=c.getPose('a'),b=c.getPose('b');
    sideBySide ||= a.x>14&&a.x<15&&Math.abs(a.x-b.x)<.05;
    for(const input of cars)if(c.getPose(input.id).x>16)cleared.add(input.id);
    for(let j=2;j<cars.length;j++)assert(c.getPose(cars[j-2].id).x-c.getPose(cars[j].id).x>=.48-1e-6);
  }
  assert(sideBySide,'two lanes may occupy a green junction together');
  assert(cleared.size>=6,`at least three cars per lane clear in one green, got ${cleared.size}`);
});

test('an occupied exit lane holds entry without blocking the other straight lane',()=>{
  const c=controller([car('a',routes.straight,9.17),car('b',routes.straight,9.17),car('c',routes.straight,12)]);
  const blocked=c._cars.get('c');blocked.distance=12;blocked.visible=true;
  c._tiles.get('16,15').traffic=1e9; // Standing downstream queue.
  startGreen(c);c.step(2);
  assert(Math.abs(c.getPose('a').distance-9.17)<1e-6);
  assert(c.getPose('b').distance>10.5,'the empty parallel exit remains usable');
  c._tiles.get('16,15').traffic=0;c.step(4);
  assert(c.getPose('a').distance>10,'the held lane resumes as the exit frees');
});

test('mixed straight and turning traffic clears every approach over repeated signal cycles',()=>{
  for(const level of [2,5]){
    const cars=[];for(let turn=0;turn<4;turn++)for(const [movement,points] of Object.entries(routes))for(let j=0;j<2;j++)cars.push(car(`${turn}-${movement}-${j}`,rotate(points,turn),7-j*.7));
    const c=controller(cars,level),cleared=new Set();let minimum=Infinity;
    for(let frame=0;frame<2400;frame++){
      c.step(.05);
      const poses=cars.map(input=>({id:input.id,...c.getPose(input.id)})).filter(p=>p.visible);
      for(const p of poses)if(p.distance>15)cleared.add(p.id);
      for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
        const a=poses[i],b=poses[j];
        const distance=Math.hypot(a.lanePose.x-b.lanePose.x,a.lanePose.y-b.lanePose.y);minimum=Math.min(minimum,distance);
        assert(distance>.17,`physical overlap: ${a.id} / ${b.id} at ${c.time.toFixed(2)} (${distance})`);
      }
    }
    assert.equal(cleared.size,cars.length,`${level}: all movements must make progress, missing ${cars.filter(a=>!cleared.has(a.id)).map(a=>a.id)}`);
    assert(minimum>.17);
  }
});

test('unchanged sync preserves lane choices, upgrading to three lanes reapplies turn allocation',()=>{
  const input=car('a',routes.straight,6),tiles=cross(),c=controller([input],2,tiles),plan=c._cars.get('a').lanePlan;
  c.step(.2);const pose=c.getPose('a');c.sync(structuredClone(tiles),[input]);
  assert.equal(c._cars.get('a').lanePlan,plan);assert.deepEqual(c.getPose('a'),pose);
  c.sync(tiles.map(t=>({...t,road:5})),[input]);
  assert.notEqual(c._cars.get('a').lanePlan,plan);
  const p=routes.straight[6],layout=c.wideRoads.get(`${p.x},${p.y}`),lanes=boulevardLanes(p,layout);
  assert(Math.abs(c.getPose('a').lanePose.y-p.y-lanes.centers[1])<1e-6);
});

test('junction arrows use the driver left/right under all rotations and fit three-lane widths',()=>{
  for(const ew of [true,false])for(const direction of [-1,1])for(const movement of ['left','right']){
    const strokes=[],batch={add:(...args)=>strokes.push(args)};
    CityRenderer.prototype._laneArrow(batch,0,0,ew,0,direction,['straight',movement]);
    const branches=strokes.slice(3);
    assert.equal(branches.length,3);
    const coordinates=branches.map(s=>ew?s[4]*direction:-s[2]*direction);
    assert(coordinates.every(v=>movement==='left'?v<0:v>0));
    for(const s of strokes){
      const radius=Math.abs(ew?Math.cos(s[8]):Math.sin(s[8]))*s[7]/2+.012;
      assert(Math.abs(ew?s[4]:s[2])+radius<.132,'arrow stays within the narrowest lane');
    }
  }
});

test('changing lanes between successive junctions yields to the occupied lane and completes the turn',()=>{
  const tiles=roads([...line(4,14,30,14),...line(4,15,30,15),...[14,15,22,23].flatMap(i=>line(i,4,i,25))]);
  const inputs=[car('a',line(4,15,30,15),8),car('b',[...line(4,15,23,15),...line(23,14,23,4)],8)];
  const c=controller(inputs,2,tiles);let yielded=false,turned=false;
  for(let frame=0;frame<1700;frame++){
    c.step(.04);const a=c.getPose('a'),b=c.getPose('b');
    yielded ||= b.x>16&&b.x<20&&b.waiting;
    turned ||= b.visible&&b.y<12;
    if(a.visible&&b.visible&&a.dx===b.dx&&a.dy===b.dy){
      const across=Math.abs(a.lanePose.y-b.lanePose.y),along=Math.abs(a.lanePose.x-b.lanePose.x);
      assert(across>=.20||along>=.48-1e-6,`lane change must leave a gap (${across}, ${along})`);
    }
  }
  assert(yielded,'the merging car waits for a gap');assert(turned,'the turn still completes');
});

test('road rendering places movement arrows immediately before each signalized approach',()=>{
  for(const level of [2,5]){
    const c=controller([],level),tiles=c._tiles,cells=new Set(c.signals.map(s=>`${s.x},${s.y}`));
    for(const [x,y] of [[13,15],[16,14],[14,13],[15,16]]){
      const calls=[],context={junctionCells:cells,_tile:(x,y)=>tiles.get(`${x},${y}`),_laneArrow:(...args)=>calls.push(args),_avenueEdge:()=>{},_lamp:()=>{}};
      CityRenderer.prototype._wideRoad.call(context,{add:()=>{},box:()=>{}},tiles.get(`${x},${y}`),x,y,c.wideRoads.get(`${x},${y}`));
      assert.deepEqual(calls.map(args=>args[6]),level===2?[['straight','left'],['straight','right']]:[['left'],['straight'],['right']]);
    }
  }
});

test('upgrading two parallel straight queues to a single through lane preserves safe spacing',()=>{
  const inputs=['a','b','c','d'].map(id=>car(id,routes.straight,8));
  const c=controller(inputs);c.sync(cross(5),inputs);
  const positions=inputs.map(input=>c.getPose(input.id)).filter(p=>p.visible).sort((a,b)=>a.x-b.x);
  assert.equal(positions.length,4);
  for(let i=1;i<positions.length;i++){
    assert(Math.abs(positions[i].lanePose.y-positions[i-1].lanePose.y)<1e-6);
    assert(positions[i].x-positions[i-1].x>=.48-1e-6);
  }
});
