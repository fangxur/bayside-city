import test from 'node:test';
import assert from 'node:assert/strict';
import {FESTIVALS,festivalForMonth} from '../src/festivals.js';
import {CitySimulation} from '../src/simulation.js';
import {getCitizenStory} from '../src/city-life.js';

test('all festivals recur each year with distinct occurrences and quiet months remain empty',()=>{
  assert.equal(new Set(FESTIVALS.map(f=>f.id)).size,FESTIVALS.length);
  for(const f of FESTIVALS){
    const first=festivalForMonth(f.month),next=festivalForMonth(f.month+12);
    assert.equal(first.id,next.id);assert.equal(next.year,2);
    assert.notEqual(first.occurrence,next.occurrence);
  }
  for(const m of [7,8])assert.equal(festivalForMonth(m),null);
  for(const m of [0,-1,1.5,NaN,undefined])assert.equal(festivalForMonth(m),null);
});

test('festival state restores from saved month without charges or repeated effects',()=>{
  const sim=new CitySimulation({demo:true});
  const home=sim.state.buildings.find(b=>b.type==='residential'&&b.population>0);
  const actor={id:'holiday-resident',kind:'pedestrian',x:home.x,y:home.y};
  for(const f of FESTIVALS){
    sim.state.month=f.month+12;
    sim.state.tick=(sim.state.month-1)*15;
    const before=JSON.stringify(sim.state),story=getCitizenStory(sim.state,actor);
    assert.equal(story.festival.id,f.id);assert.equal(story.festival.year,2);
    assert.deepEqual(getCitizenStory(sim.state,actor),story);
    assert.equal(JSON.stringify(sim.state),before);
    const loaded=CitySimulation.deserialize(sim.serialize());
    assert.deepEqual(getCitizenStory(loaded.state,actor).festival,story.festival);
    if(story.social?.category==='节日活动')assert.match(story.social.quote,new RegExp(f.name));
  }
  sim.state.month=7;assert.equal(getCitizenStory(sim.state,actor).festival,null);
});
