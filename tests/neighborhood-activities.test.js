import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {getCitizenStory} from '../src/city-life.js';
import {NEIGHBORHOOD_ACTIVITIES} from '../src/neighborhood-activities.js';
import {FESTIVALS} from '../src/festivals.js';

test('each festival offers multiple distinct activities and all activity IDs are unique',()=>{
 assert.equal(new Set(NEIGHBORHOOD_ACTIVITIES.map(a=>a.id)).size,NEIGHBORHOOD_ACTIVITIES.length);
 for(const f of FESTIVALS)assert(NEIGHBORHOOD_ACTIVITIES.filter(a=>a.festival===f.id).length>=2);
});

test('civic activities vary by resident, advance through phases, and disappear when closed',()=>{
 const sim=new CitySimulation({demo:true});
 const home=sim.state.buildings.find(b=>b.type==='residential'&&b.population>0);
 const actor={id:'community-test',kind:'pedestrian',x:home.x,y:home.y};
 for(const b of sim.state.buildings)if(!['residential','power','water','industrial'].includes(b.type))b.active=false;
 const host={id:9999,type:'library',x:home.x+1,y:home.y,active:true,progress:1,connected:true,powered:true,watered:true};
 sim.state.buildings.push(host);sim.state.month=4;sim.state.tick=45;
 const ids=new Set();
 for(let i=0;i<30;i++){
  const story=getCitizenStory(sim.state,{...actor,id:'resident-'+i});
  assert(story.social);assert.equal(story.social.venue.id,host.id);ids.add(story.social.activityId);
 }
 assert(ids.size>=3);
 const before=JSON.stringify(sim.state),planned=getCitizenStory(sim.state,actor).social;
 assert.equal(planned.stage,'筹备中');assert.equal(JSON.stringify(sim.state),before);
 sim.state.tick=50;const ongoing=getCitizenStory(sim.state,actor).social;
 sim.state.tick=55;const recap=getCitizenStory(sim.state,actor).social;
 assert.equal(ongoing.stage,'进行中');assert.equal(recap.stage,'活动回顾');
 assert.equal(planned.activityId,ongoing.activityId);assert.equal(planned.activityId,recap.activityId);
 assert.notEqual(planned.quote,recap.quote);
 host.active=false;assert.equal(getCitizenStory(sim.state,actor).social,null);
 host.active=true;host.powered=false;assert.equal(getCitizenStory(sim.state,actor).social,null);
 host.powered=true;sim.state.buildings.pop();assert.equal(getCitizenStory(sim.state,actor).social,null);
});

test('congestion preserves useful complaints alongside varied, actionable neighborhood proposals',()=>{
 const sim=new CitySimulation({demo:true});
 const home=sim.state.buildings.find(b=>b.type==='residential'&&b.population>0);
 home.commute=15;
 for(const t of sim.state.tiles)if(t.road)t.traffic=95;
 const events=new Set();
 for(let i=0;i<30;i++){
  const actor={id:'busy-neighbor-'+i,kind:'pedestrian',x:home.x,y:home.y};
  const story=getCitizenStory(sim.state,actor);
  assert.equal(story.suggestion.overlay,'traffic');assert.equal(story.mood,'upset');
  assert(story.social);assert.equal(story.event.kind,story.social.activityId);
  events.add(story.event.kind);
 }
 assert(events.size>=3);
 const actor={id:'busy-neighbor-1',kind:'pedestrian',x:home.x,y:home.y};
 const story=getCitizenStory(sim.state,actor);
 assert(sim.resolveCityEvent(story.event.id,actor).ok);
 assert.equal(sim.state.cityLife.activeEvent.kind,story.event.kind);
 assert.deepEqual(CitySimulation.deserialize(sim.serialize()).state.cityLife,sim.state.cityLife);
});
