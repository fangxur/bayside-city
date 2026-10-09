import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {pedestrianTrip,pedestrianNetwork,pedestrianStroll,pedestrianCrossings} from '../src/pedestrian-routing.js';
import {wideRoadLayout} from '../src/city-layout.js';
import {walkingPath} from '../src/resident-journeys.js';

const blank=()=>{const s=new CitySimulation();for(const t of s.state.tiles){t.road=0;t.terrain='land';delete t.bridge;}s.tile(0,32).road=1;return s;};
const put=(s,x,y)=>{s.tile(x,y).road=4;};
function crossroads(width,vertical=false){
  const s=blank(),road=(x,y)=>put(s,vertical?y:x,vertical?x:y);
  for(let x=10;x<=45;x++)for(let y=30;y<30+width;y++)road(x,y);
  for(let y=20;y<=42;y++)for(let x=25;x<25+width;x++)road(x,y);
  return s;
}
function safeSegments(s,trip){
  assert(trip);assert(trip.sidewalk.length>1);
  const wide=wideRoadLayout(s.state.tiles),crossings=new Map(pedestrianCrossings(s.state).map(c=>[c.id,c]));
  for(let i=1;i<trip.sidewalk.length;i++){
    const a=trip.sidewalk[i-1],b=trip.sidewalk[i];
    if(b.crossing){
      const c=crossings.get(b.crossing);assert(c);
      const vertical=c.direction%2===1;
      assert(Math.abs((vertical?a.x:a.y)-(vertical?c.start.x:c.start.y))<1e-8);
      assert(Math.abs((vertical?b.x:b.y)-(vertical?c.start.x:c.start.y))<1e-8);
    }
    for(let f=.05;f<1;f+=.05){
      const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f,t=s.tile(Math.round(x),Math.round(y));if(!t?.road)continue;
      const px=x-t.x,py=y-t.y,neighbor=(dx,dy)=>!!s.tile(t.x+dx,t.y+dy)?.road,layout=wide.get(`${t.x},${t.y}`);
      let asphalt;
      if(layout){
        const left=neighbor(-1,0)?.501:.36,right=neighbor(1,0)?.501:.36,top=neighbor(0,-1)?.501:.36,bottom=neighbor(0,1)?.501:.36;
        asphalt=px>-left&&px<right&&py>-top&&py<bottom;
      }else asphalt=Math.abs(px)<.36&&Math.abs(py)<.36||Math.abs(py)<.36&&(px<0?neighbor(-1,0):neighbor(1,0))||Math.abs(px)<.36&&(py<0?neighbor(0,-1):neighbor(0,1));
      assert(!asphalt||b.crossing,`unmarked crossing at ${x},${y}`);
    }
  }
  trip.points.forEach((p,i)=>{assert(s.tile(p.x,p.y).road);if(i)assert.equal(Math.abs(p.x-trip.points[i-1].x)+Math.abs(p.y-trip.points[i-1].y),1);});
}

test('opposite buildings detour along the curb and cross one complete zebra on roads of every width',()=>{
  for(const width of [1,2,3,4,6])for(const vertical of [false,true]){
    const s=crossroads(width,vertical),point=(x,y)=>vertical?{x:y,y:x}:{x,y};
    const trip=pedestrianTrip(s.state,point(35,29),point(35,30+width));safeSegments(s,trip);
    const crossing=trip.sidewalk.filter(p=>p.crossing);assert.equal(new Set(crossing.map(p=>p.crossing)).size,1);assert.equal(crossing.length,width+1);
    assert(trip.points.length>width);assert.equal(trip.sidewalk[0][vertical?'x':'y'],30-.412);assert.equal(trip.sidewalk.at(-1)[vertical?'x':'y'],29+width+.412);
  }
});

test('same-side trips and inside bends follow the pavement without diagonal shortcuts',()=>{
  const s=crossroads(3),trip=pedestrianTrip(s.state,{x:35,y:29},{x:40,y:29});safeSegments(s,trip);assert(trip.sidewalk.every(p=>!p.crossing&&p.y===29.588));
  const bend=blank();for(let x=10;x<=20;x++)put(bend,x,30);for(let y=30;y<=40;y++)put(bend,20,y);
  safeSegments(bend,pedestrianTrip(bend.state,{x:18,y:31},{x:19,y:35}));
});

test('a street loop with no zebra cannot connect its inner and outer sidewalks',()=>{
  const s=blank();for(let x=15;x<=25;x++){put(s,x,25);put(s,x,35);}for(let y=25;y<=35;y++){put(s,15,y);put(s,25,y);}
  assert.equal(pedestrianCrossings(s.state).length,0);assert.equal(pedestrianTrip(s.state,{x:20,y:24},{x:20,y:26}),null);
  safeSegments(s,pedestrianTrip(s.state,{x:20,y:24},{x:14,y:30}));
});

test('sidewalks wrap around an actual street end without crossing the carriageway',()=>{
  const s=blank();for(let x=10;x<=20;x++)put(s,x,30);
  const trip=pedestrianTrip(s.state,{x:18,y:29},{x:18,y:31});safeSegments(s,trip);assert(trip.sidewalk.every(p=>!p.crossing));assert(trip.sidewalk.some(p=>p.x===20.412));
});

test('bridge sidewalks stay at the outer edge and crossings never appear over water',()=>{
  const s=crossroads(2);for(let x=31;x<=33;x++)for(let y=30;y<=31;y++)Object.assign(s.tile(x,y),{terrain:'water',bridge:true});
  const trip=pedestrianTrip(s.state,{x:30,y:29},{x:34,y:29});assert(trip);assert(trip.sidewalk.every(p=>p.y>=29.588&&p.y<=29.66&&!p.crossing));assert(trip.sidewalk.some(p=>p.cell.x===32&&p.height>.7));
  assert(pedestrianCrossings(s.state).every(c=>c.cells.every(p=>s.tile(p.x,p.y).terrain==='land')));
});

test('removing a crossing or road recomputes walkers without stale waypoints and preserves save round trips',()=>{
  const s=crossroads(3),from={x:35,y:29},to={x:35,y:33};let trip=pedestrianTrip(s.state,from,to);safeSegments(s,trip);
  const before=JSON.stringify(s.state);assert.deepEqual(walkingPath(s.state,from,to),trip.points);assert.equal(JSON.stringify(s.state),before);
  const restored=CitySimulation.deserialize(s.serialize());assert.deepEqual(pedestrianTrip(restored.state,from,to),trip);
  const old=pedestrianNetwork(s.state);for(const t of s.state.tiles)if(t.x<30)t.road=0;
  assert.notEqual(pedestrianNetwork(s.state),old);trip=pedestrianTrip(s.state,from,to);safeSegments(s,trip);assert(trip.sidewalk.every(p=>!p.crossing));
});

test('fallback strolls start at the real home curb and cannot invent a road crossing',()=>{
  const s=crossroads(4);for(let seed=0;seed<20;seed++){
    const trip=pedestrianStroll(s.state,{x:35,y:29},seed);safeSegments(s,trip);assert(trip.sidewalk.every(p=>!p.crossing));assert.equal(trip.sidewalk[0].y,29.588);
  }
});
