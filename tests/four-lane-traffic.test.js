import test from 'node:test';
import assert from 'node:assert/strict';
import {TrafficController} from '../src/traffic-signals.js';
import {boulevardLanes,laneMovements} from '../src/city-layout.js';
import {vehicleLanePose} from '../src/vehicle-routing.js';
import {CityRenderer} from '../src/renderer.js';

const line=(x,y,X,Y)=>Array.from({length:Math.max(Math.abs(X-x),Math.abs(Y-y))+1},(_,i)=>({x:x+Math.sign(X-x)*i,y:y+Math.sign(Y-y)*i}));
function fixture(width=6,level=7){
  const min=12,max=min+width-1,middle=(min+max)/2,limit=min+max-4;
  const tiles=[...new Map(Array.from({length:width},(_,i)=>[...line(4,min+i,limit,min+i),...line(min+i,4,min+i,limit)]).flat().map(p=>[`${p.x},${p.y}`,{...p,road:level,terrain:'land'}])).values()];
  const routes={straight:line(4,max,limit,max),left:[...line(4,max,max,max),...line(max,max-1,max,4)],right:[...line(4,max,min,max),...line(min,max+1,min,limit)]};
  const rotate=(points,n)=>points.map(p=>{let {x,y}=p;for(let i=0;i<n;i++)[x,y]=[middle*2-y,x];return {x,y};});
  return {tiles,routes,min,max,middle,rotate};
}
const vehicle=(id,points,travel=5)=>({id,points,travel});
const controller=(f,cars)=>{const c=new TrafficController();c.sync(f.tiles,cars);return c;};

for(const width of [6,7])test(`${width}-tile roads route four lanes as left / straight / straight / right`,()=>{
  const f=fixture(width);
  for(let rotation=0;rotation<4;rotation++)for(const [movement,route] of Object.entries(f.routes)){
    const points=f.rotate(route,rotation),c=controller(f,['a','b'].map(id=>vehicle(id,points))),p=points[5],q=points[6];
    const lanes=boulevardLanes(p,c.wideRoads.get(`${p.x},${p.y}`),(q.x-p.x)||(q.y-p.y));
    assert.equal(lanes.lanesPerDirection,4);
    const selected=new Set();
    for(const id of ['a','b']){
      const pose=c.getPose(id).lanePose,offset=q.x!==p.x?pose.y-p.y:pose.x-p.x;
      selected.add(lanes.centers.findIndex(v=>Math.abs(v-offset)<1e-6));
    }
    assert.deepEqual([...selected].sort(),movement==='left'?[0]:movement==='right'?[3]:[1,2]);
  }
});

test('every four-lane approach paints exactly four arrows in lane order, including odd-width centre tiles',()=>{
  for(const width of [6,7]){
    const f=fixture(width),c=controller(f,[]),cells=new Set(c.signals.map(s=>`${s.x},${s.y}`));
    for(let rotation=0;rotation<4;rotation++){
      const calls=[],context={junctionCells:cells,_tile:(x,y)=>c._tiles.get(`${x},${y}`),_laneArrow:(...args)=>calls.push(args),_avenueEdge:()=>{},_lamp:()=>{}};
      const heading=f.rotate([{x:f.min-1,y:f.max},{x:f.min,y:f.max}],rotation);
      const dx=heading[1].x-heading[0].x,dy=heading[1].y-heading[0].y;
      for(let y=f.min;y<=f.max;y++){
        const [p]=f.rotate([{x:f.min-1,y}],rotation),tile=c._tiles.get(`${p.x},${p.y}`);
        CityRenderer.prototype._wideRoad.call(context,{add:()=>{},box:()=>{}},tile,p.x,p.y,c.wideRoads.get(`${p.x},${p.y}`));
      }
      const incoming=calls.filter(a=>a[5]===(dx||dy));
      incoming.sort((a,b)=>Math.abs((dx?a[2]:a[1])+a[4]-f.middle)-Math.abs((dx?b[2]:b[1])+b[4]-f.middle));
      assert.deepEqual(incoming.map(a=>a[6]),[['left'],['straight'],['straight'],['right']]);
      assert(incoming.every(a=>a[4]>=-.5&&a[4]<.5),'tile ownership prevents duplicate arrows');
    }
  }
  assert.deepEqual([0,1,2,3].map(i=>laneMovements(4,i)),[['left'],['straight'],['straight'],['right']]);
});

test('both middle lanes pass a four-lane junction together while preserving independent queues',()=>{
  const f=fixture(),cars=['a','b','c','d'].map((id,i)=>vehicle(id,f.routes.straight,6-Math.floor(i/2)*.6)),c=controller(f,cars);
  let parallel=false;const crossed=new Set();
  for(let frame=0;frame<1500;frame++){
    c.step(.04);const a=c.getPose('a'),b=c.getPose('b');
    parallel ||= a.visible&&b.visible&&a.x>f.min&&a.x<f.max&&Math.abs(a.x-b.x)<.05;
    for(const car of cars)if(c.getPose(car.id).x>f.max+1)crossed.add(car.id);
    for(const [first,second] of [['a','c'],['b','d']]){
      const a=c.getPose(first),b=c.getPose(second);
      if(a.visible&&b.visible)assert(Math.abs(a.lanePose.x-b.lanePose.x)>=.48-1e-6);
    }
  }
  assert(parallel);assert.equal(crossed.size,4);
});

test('wide-road turning curves join their approach lanes continuously and never reverse through the junction',()=>{
  const f=fixture();
  for(const movement of ['left','right']){
    const points=f.routes[movement],c=controller(f,[vehicle('turn',points)]),plan=c._cars.get('turn').lanePlan;
    assert.equal(plan.curves.length,1);const curve=plan.curves[0];
    for(const edge of [curve.startDistance,curve.endDistance]){
      const before=vehicleLanePose(points,edge-1e-6,c.wideRoads,plan),after=vehicleLanePose(points,edge+1e-6,c.wideRoads,plan);
      assert(Math.hypot(before.x-after.x,before.y-after.y)<1e-5);
      assert(Math.abs(Math.atan2(Math.sin(before.angle-after.angle),Math.cos(before.angle-after.angle)))<1e-4);
    }
    let previous=curve.a;
    for(let d=curve.startDistance;d<=curve.endDistance;d+=.025){
      const pose=vehicleLanePose(points,d,c.wideRoads,plan);
      assert(pose.x>=previous.x-1e-6);
      assert(movement==='left'?pose.y<=previous.y+1e-6:pose.y>=previous.y-1e-6);previous=pose;
    }
  }
});

test('four-lane traffic from all approaches completes turns and straight movements without overlap',()=>{
  const f=fixture(),cars=[];
  for(let rotation=0;rotation<4;rotation++)for(const [movement,points] of Object.entries(f.routes))cars.push(vehicle(`${rotation}-${movement}`,f.rotate(points,rotation)));
  const c=controller(f,cars),crossed=new Set();
  for(let frame=0;frame<3600;frame++){
    c.step(.05);const visible=cars.map(car=>({id:car.id,...c.getPose(car.id)})).filter(p=>p.visible);
    for(const pose of visible)if(pose.distance>c._cars.get(pose.id).zones[0].clear+1)crossed.add(pose.id);
    for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)assert(Math.hypot(visible[i].lanePose.x-visible[j].lanePose.x,visible[i].lanePose.y-visible[j].lanePose.y)>.17,`overlap at ${c.time}: ${visible[i].id}/${visible[j].id}`);
  }
  assert.equal(crossed.size,cars.length,`stalled: ${cars.filter(c=>!crossed.has(c.id)).map(c=>c.id)}`);
});
