import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {vehicleNetwork,vehicleTrip,vehicleRoadPath,vehicleLaneOffset,vehicleLanePose} from '../src/vehicle-routing.js';
import {boulevardLanes,wideRoadLayout} from '../src/city-layout.js';
import {validRoadPath} from '../src/interchanges.js';
import {TrafficController} from '../src/traffic-signals.js';

function town(){
  const s=new CitySimulation();
  for(const t of s.state.tiles){t.terrain='land';t.road=0;}
  s.state.money=100000;return s;
}
function curbOnRight(path,building,departure=false){
  const a=departure?path[0]:path.at(-2),b=departure?path[1]:path.at(-1),p=departure?a:b;
  assert.equal(building.x-p.x,-(b.y-a.y)||0);assert.equal(building.y-p.y,b.x-a.x||0);
}

test('reused route search storage isolates trips, recovers stamp overflow and resizes safely',()=>{
  const s=town();
  for(let x=0;x<=30;x++)s.tile(x,32).road=1;
  s.recalculate();
  const network=vehicleNetwork(s.state),starts=[32*64+5],goals=[32*64+20];
  const expected=vehicleRoadPath(s.state,starts,goals,{network});assert(expected.length);
  assert.deepEqual(vehicleRoadPath(s.state,starts,[50*64+50],{network}),[]);
  assert.deepEqual(vehicleRoadPath(s.state,starts,goals,{network}),expected);
  network.search.stamp=0xffffffff;
  assert.deepEqual(vehicleRoadPath(s.state,starts,goals,{network}),expected);
  network.search.distance=new Float64Array(1);
  assert.deepEqual(vehicleRoadPath(s.state,starts,goals,{network}),expected);
});

test('both directions use the right lane and boulevard arrows agree with the carriageway',()=>{
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const p={x:10,y:10},offset=vehicleLaneOffset(p,dx,dy);
    assert.equal(offset.x*-dy+offset.y*dx,.16);
  }
  for(const vertical of [false,true])for(const level of [2,3,5,7]){
    const tiles=Array.from({length:12},(_,i)=>[0,1].map(j=>({x:vertical?10+j:i+4,y:vertical?i+4:10+j,road:level,terrain:'land'}))).flat(),wide=wideRoadLayout(tiles);
    for(const p of tiles){
      const layout=wide.get(`${p.x},${p.y}`),lanes=boulevardLanes(p,layout),dx=vertical?0:lanes.direction,dy=vertical?lanes.direction:0;
      const offset=vehicleLaneOffset(p,dx,dy,wide),cross=vertical?p.x+offset.x:p.y+offset.y;
      assert.equal(Math.sign(cross-10.5),vertical?-dy:dx);
      assert(lanes.centers.includes(vertical?offset.x:offset.y));
    }
  }
});

test('opposite curb destinations require a legal turn-around and independently planned return trip',()=>{
  for(const vertical of [false,true]){
    const s=town(),transpose=p=>vertical?{x:p.y,y:p.x}:p;
    for(let x=0;x<=30;x++)for(const y of [32,33]){const p=transpose({x,y});s.tile(p.x,p.y).road=3;}
    s.recalculate();const from=transpose({x:10,y:31}),to=transpose({x:15,y:34}),trip=vehicleTrip(s.state,from,to);
    assert(trip);curbOnRight(trip.points,from,true);curbOnRight(trip.points,to);curbOnRight(trip.returnPoints,to,true);curbOnRight(trip.returnPoints,from);
    assert.notDeepEqual(trip.returnPoints,[...trip.points].reverse());
    for(const path of [trip.points,trip.returnPoints]){
      assert(validRoadPath(s.state,path));
      for(let i=1;i<path.length;i++){
        const a=transpose(path[i-1]),b=transpose(path[i]);
        if(a.y!==b.y)assert(a.x===0||a.x===30,'no crossing the median in the middle of the road');
      }
      // Wide-road lane offsets must also join the turn without a position jump.
      for(let i=1;i<path.length-1;i++)if(path[i+1].x-path[i].x!==path[i].x-path[i-1].x||path[i+1].y-path[i].y!==path[i].y-path[i-1].y){
        for(const edge of [i-.35,i+.35]){
          const before=vehicleLanePose(path,edge-1e-6,wideRoadLayout(s.state.tiles)),after=vehicleLanePose(path,edge+1e-6,wideRoadLayout(s.state.tiles));
          assert(Math.hypot(before.x-after.x,before.y-after.y)<1e-5);
          assert(Math.abs(Math.atan2(Math.sin(before.angle-after.angle),Math.cos(before.angle-after.angle)))<1e-4);
        }
      }
    }
  }
});

test('a real intersection permits turns across the road, while bridges keep their layers and directions',()=>{
  const s=town();
  for(let x=0;x<=35;x++)for(let y=31;y<=33;y++)s.tile(x,y).road=3;
  for(let y=24;y<=42;y++)for(let x=16;x<=18;x++)s.tile(x,y).road=3;
  s.recalculate();
  const from={x:12,y:30},to={x:21,y:34},flat=vehicleTrip(s.state,from,to);assert(flat);
  for(const axis of ['ew','ns']){
    assert(s.build(axis==='ew'?'interchangeEW':'interchangeNS',[{x:17,y:32}]).ok);
    const trip=vehicleTrip(s.state,from,to);assert(trip);
    for(const path of [trip.points,trip.returnPoints]){
      assert(validRoadPath(s.state,path));
      for(let i=1;i<path.length-1;i++)if(s.tile(path[i].x,path[i].y).interchange){
        assert.equal(path[i].x-path[i-1].x,path[i+1].x-path[i].x);
        assert.equal(path[i].y-path[i-1].y,path[i+1].y-path[i].y);
      }
    }
    assert(s.build('interchangeFlat',[{x:17,y:32}]).ok);
  }
});

test('curved turns and dead-end turn-arounds keep position and heading continuous in either direction',()=>{
  for(const points of [
    [{x:8,y:10},{x:9,y:10},{x:10,y:10},{x:10,y:11},{x:10,y:12}],
    [{x:8,y:10},{x:9,y:10},{x:10,y:10},{x:10,y:9},{x:10,y:8}],
    [{x:8,y:10},{x:9,y:10},{x:10,y:10},{x:9,y:10},{x:8,y:10}],
  ])for(const path of [points,[...points].reverse()]){
    let previous;
    for(let d=1.64;d<=2.36;d+=.002){
      const pose=vehicleLanePose(path,d);assert(Object.values(pose).every(Number.isFinite));
      if(previous){assert(Math.hypot(pose.x-previous.x,pose.y-previous.y)<.01);const difference=Math.atan2(Math.sin(pose.angle-previous.angle),Math.cos(pose.angle-previous.angle));assert(Math.abs(difference)<.04);}
      previous=pose;
    }
    const halfway=vehicleLanePose(path,1.9);
    assert(Math.abs(Math.sin(halfway.angle))>.01&&Math.abs(Math.cos(halfway.angle))>.01,'the car rotates along the curve instead of snapping at the tile center');
  }
});

test('signal-controlled curves preserve reservations, pause state and the reverse trip heading',()=>{
  const tiles=[...[8,9,10,11,12].map(x=>({x,y:10,road:1,terrain:'land'})),...[8,9,11,12].map(y=>({x:10,y,road:1,terrain:'land'}))];
  const points=[{x:8,y:10},{x:9,y:10},{x:10,y:10},{x:10,y:11},{x:10,y:12}],controller=new TrafficController();
  controller.sync(tiles,[{id:'turn',points,travel:1.9},{id:'back',points,reverse:true,travel:.5}]);
  const back=controller.getPose('back');assert.equal(back.dy,-1);assert(back.lanePose.x>back.x,'northbound traffic stays east of the centerline');
  let pose;
  for(let i=0;i<600;i++){controller.step(.05);const current=controller.getPose('turn');if(current.visible&&Math.abs(current.lanePose.angle-Math.atan2(current.dx,current.dy))>.1){pose=current;break;}}
  assert(pose,'the signal releases the vehicle into a curved turn');
  controller.step(0);assert.deepEqual(controller.getPose('turn'),pose);
});

test('weighted city traffic counts legal outward and return paths and rebuilds them after saves and road changes',()=>{
  const s=town();for(let x=0;x<=25;x++)s.tile(x,32).road=2;
  for(const [type,x]of [['power',1],['water',2]])s._newBuilding(x,31,type,true);
  const home=s._newBuilding(10,31,'residential',true);home.population=8;s._newBuilding(20,33,'commercial',true);s.recalculate();
  const expected=new Map();
  for(const route of s.state.routes){
    assert(route.returnPoints.length);const firm=s.state.buildings.find(b=>b.id===route.workplaceId);curbOnRight(route.points,firm);
    for(const path of [route.points,route.returnPoints])for(const p of path){const id=`${p.x},${p.y}`;expected.set(id,(expected.get(id)||0)+route.load/2);}
  }
  for(const t of s.state.tiles)if(t.road)assert(Math.abs(t.trafficLoad-(expected.get(`${t.x},${t.y}`)||0))<1e-7);
  const restored=CitySimulation.deserialize(s.serialize());assert.deepEqual(restored.state.routes,s.state.routes);
  const network=vehicleNetwork(s.state);assert(vehicleRoadPath(s.state,[32*64+10],[32*64+15],{from:home,network}).length);
  assert(s.build('bulldoze',[{x:12,y:32}]).ok);assert.equal(s.state.routes.length,0);
});

test('short sidewalk commutes keep their jobs without driving around a block to cross the street',()=>{
  const s=town();for(let x=0;x<=12;x++)s.tile(x,32).road=1;
  for(const [type,x]of [['power',1],['water',2]])s._newBuilding(x,31,type,true);
  const home=s._newBuilding(5,31,'residential',true);home.population=8;
  s._newBuilding(5,33,'commercial',true);s.recalculate();
  const commute=s.state.routes.find(r=>r.kind==='commute');assert(commute.walking);assert.equal(commute.points.length,1);assert(home.workers>0);
  const expected=new Map();for(const r of s.state.routes.filter(r=>!r.walking))for(const path of [r.points,r.returnPoints])for(const p of path)expected.set(`${p.x},${p.y}`,(expected.get(`${p.x},${p.y}`)||0)+r.load/2);
  for(const t of s.state.tiles.filter(t=>t.road))assert(Math.abs(t.trafficLoad-(expected.get(`${t.x},${t.y}`)||0))<1e-7);
  assert.deepEqual(CitySimulation.deserialize(s.serialize()).state.routes,s.state.routes);
});

test('a motor trip turns around at an intersection rather than crossing the centerline at a driveway',()=>{
  const s=town();for(let x=0;x<=25;x++)s.tile(x,32).road=2;
  for(const x of [8,16])s.tile(x,31).road=2;s.recalculate();
  const from={x:10,y:31},to={x:14,y:33},trip=vehicleTrip(s.state,from,to);assert(trip);
  curbOnRight(trip.points,from,true);curbOnRight(trip.points,to);
  assert(trip.points.some((p,i)=>i>0&&i<trip.points.length-1&&trip.points[i-1].x===trip.points[i+1].x&&p.x===8));
  for(const path of [trip.points,trip.returnPoints])assert(path.every(p=>p.x>0&&p.x<25),'a nearby intersection avoids the distant road ends');
});

test('a building at the end of a street remains reachable by a straight driveway',()=>{
  const s=town();for(let x=0;x<=20;x++)s.tile(x,32).road=2;s.recalculate();
  const trip=vehicleTrip(s.state,{x:10,y:33},{x:21,y:32});assert(trip);
  assert.deepEqual(trip.points.at(-1),{x:20,y:32});assert.equal(trip.points.at(-1).x-trip.points.at(-2).x,1);
  assert.deepEqual(trip.returnPoints[0],{x:20,y:32});assert.equal(trip.returnPoints[1].x-trip.returnPoints[0].x,-1);
});
