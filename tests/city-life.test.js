import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';
import { getCitizenStory } from '../src/city-life.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks; i++) sim.tick(); };
const pedestrian = sim => {
  const home = sim.state.buildings.find(b => b.type === 'residential' && b.population > 0);
  return { id: `ped-${home.id}`, kind: 'pedestrian', x: home.x, y: home.y, nameSeed: home.id * 7 };
};
const car = sim => {
  const route = sim.state.routes.find(r => r.kind === 'commute' && !r.walking && r.points.length > 3);
  return { id: 'car-route-1', kind: 'car', ...route.points[0], origin: { ...route.points[0] }, destination: { ...route.points.at(-1) }, routeLength: route.points.length, nameSeed: 123 };
};

test('neighborhood stories link a working shop and an occupied neighboring home, with stable save identity',()=>{
 for(const kind of ['tavern','izakaya','bakery','cafe','market']){
  const sim=new CitySimulation({demo:true}),actor=pedestrian(sim);
  const home=sim.state.buildings.find(b=>b.x===actor.x&&b.y===actor.y);
  for(const b of sim.state.buildings){if(b.type==='commercial'){b.businessKind='office';sim.tile(b.x,b.y).businessKind='office';}else if(!['residential','industrial','power','water'].includes(b.type))b.active=false;}
  const land=sim.state.tiles.find(t=>t.terrain==='land'&&!t.road&&!t.buildingId&&Math.hypot(t.x-home.x,t.y-home.y)<5&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>sim.tile(t.x+dx,t.y+dy)?.road));
  assert(land);
  const shop=sim._newBuilding(land.x,land.y,'commercial',true);
  shop.businessKind=kind;sim.tile(shop.x,shop.y).businessKind=kind;
  sim.recalculate();
  home.commute=0; // This fixture isolates social dialogue from the commute complaint.
  const before=JSON.stringify(sim.state),story=getCitizenStory(sim.state,actor);
  assert(story.social,kind);assert.equal(story.social.venue.id,shop.id);
  const neighbor=sim.state.buildings.find(b=>b.id===story.social.neighbor.home.id);
  assert(neighbor.population>0);assert.notEqual(neighbor.id,home.id);
  assert.match(story.quote,new RegExp(story.social.neighbor.name));
  assert.deepEqual(getCitizenStory(sim.state,actor),story);
  assert.equal(JSON.stringify(sim.state),before);
  // A save round-trip preserves the derived resident identity.
  const loaded=CitySimulation.deserialize(sim.serialize());
  const loadedStory=getCitizenStory(loaded.state,actor);
  assert.equal(loadedStory.social?.neighbor.name,story.social.neighbor.name);
  shop.active=false;assert.equal(getCitizenStory(sim.state,actor).social,null);
  shop.active=true;shop.connected=false;assert.equal(getCitizenStory(sim.state,actor).social,null);
  shop.connected=true;shop.progress=.5;assert.equal(getCitizenStory(sim.state,actor).social,null);
  shop.progress=1;sim.tile(home.x,home.y).pollution=60;
  assert.equal(getCitizenStory(sim.state,actor).suggestion.overlay,'pollution');
  assert.equal(getCitizenStory(sim.state,actor).social.venue.id,shop.id);
 }
});

test('stories and names are deterministic read-only views; empty cities and invalid actors have no stories', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  const before = JSON.stringify(sim.state);
  const story = getCitizenStory(sim.state, actor);
  assert(story.name && story.role && story.quote);
  const home=sim.state.buildings.find(b=>b.id===story.home.id);
  assert.equal(home.type,'residential');assert.deepEqual(story.home,{id:home.id,x:home.x,y:home.y});
  assert.deepEqual(getCitizenStory(sim.state, actor), story);
  assert.equal(JSON.stringify(sim.state), before);
  assert.equal(getCitizenStory(new CitySimulation().state, actor), null);
  for (const invalid of [null, {}, { ...actor, x: -3 }, { ...actor, x: NaN }, { ...actor, kind: 'plane' }, { ...actor, id: '' }, { ...actor, x: 62, y: 2 }, { ...actor, origin: { x: '0', y: 2 } }]) {
    assert.equal(getCitizenStory(sim.state, invalid), null);
  }
});

test('real utility and tax changes replace warm daily stories with actionable complaints', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  assert.equal(getCitizenStory(sim.state, actor).mood, 'happy');
  const power = sim.state.buildings.find(b => b.type === 'power');
  const water = sim.state.buildings.find(b => b.type === 'water');
  sim.setBuildingActive(power.id, false);
  const blackout = getCitizenStory(sim.state, actor);
  assert.equal(blackout.suggestion.tool, 'power'); assert.equal(blackout.suggestion.overlay, 'power');
  assert.equal(blackout.mood, 'upset'); assert.equal(blackout.event.available, false);
  sim.setBuildingActive(power.id, true); sim.setBuildingActive(water.id, false);
  assert.equal(getCitizenStory(sim.state, actor).suggestion.overlay, 'water');
  sim.setBuildingActive(water.id, true); sim.setTax(12);
  assert.equal(getCitizenStory(sim.state, actor).suggestion.action, 'budget');
  sim.setTax(9);
  assert.equal(getCitizenStory(sim.state, actor).mood, 'happy');
});

test('traffic, pollution and job complaints use local simulation fields, without inventing trouble', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  const home = sim.state.buildings.find(b => b.x === actor.x && b.y === actor.y);
  const localTile = sim.tile(home.x, home.y);
  assert.equal(getCitizenStory(sim.state, actor).mood, 'happy');
  localTile.pollution = 55;
  assert.equal(getCitizenStory(sim.state, actor).suggestion.overlay, 'pollution');
  sim.recalculate();
  home.commute = 30;
  assert.equal(getCitizenStory(sim.state, actor).suggestion.overlay, 'traffic');
  sim.recalculate();
  home.workers = 0;
  assert.equal(getCitizenStory(sim.state, actor).suggestion.tool, 'industrial');
  sim.recalculate();
  assert.equal(getCitizenStory(sim.state, actor).mood, 'happy');
});

test('commutes below fifteen minutes never complain about congestion; longer local congestion locates the road',()=>{
 const sim=new CitySimulation({demo:true}),actor=pedestrian(sim);
 const home=sim.state.buildings.find(b=>b.x===actor.x&&b.y===actor.y);
 home.commute=6.2;
 for(const t of sim.state.tiles)if(t.road)t.traffic=0;
 assert.notEqual(getCitizenStory(sim.state,actor).title,'住宅平均通勤偏长');
 const road=sim.state.tiles.filter(t=>t.road).sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y))[0];
 road.traffic=90;
 const short=getCitizenStory(sim.state,actor);
 assert.notEqual(short.title,'眼前这段路有点挤');assert.doesNotMatch(short.quote,/拥堵|有点挤|车流比较集中/);
 assert.equal(short.details.find(d=>d.label==='附近道路负载').value,'90%');
 home.commute=14.9;
 assert.notEqual(getCitizenStory(sim.state,actor).title,'眼前这段路有点挤');
 home.commute=15;
 const local=getCitizenStory(sim.state,actor);
 assert.equal(local.title,'眼前这段路有点挤');assert.match(local.quote,/15 分钟/);
 assert.deepEqual(local.suggestion.location,{x:road.x,y:road.y});
 assert.equal(local.details.find(d=>d.label==='住宅平均通勤').value,'15 分钟');
 assert.equal(local.details.find(d=>d.label==='附近道路拥堵').value,'90%');
 road.traffic=0;home.commute=22;
 assert.notEqual(getCitizenStory(sim.state,actor).title,'住宅平均通勤偏长');
 home.commute=22.1;
 const long=getCitizenStory(sim.state,actor);
 assert.equal(long.title,'住宅平均通勤偏长');assert.match(long.quote,/22\.1 分钟/);
 assert.deepEqual(long.suggestion.location,{x:home.x,y:home.y});
 home.workers=0;
 assert.notEqual(getCitizenStory(sim.state,actor).title,'住宅平均通勤偏长');
});

test('cars require a current physical route; removing its origin invalidates the old actor and proposal', () => {
  const sim = new CitySimulation({ demo: true }); const actor = car(sim);
  const story = getCitizenStory(sim.state, actor);
  assert(story); assert.equal(story.role, '通勤居民');
  assert.equal(getCitizenStory(sim.state, { ...actor, origin: { x: 62, y: 62 } }), null);
  assert.equal(sim.build('bulldoze', [actor.origin]).ok, true);
  assert.equal(getCitizenStory(sim.state, actor), null);
  const money = sim.state.money;
  assert.equal(sim.resolveCityEvent(story.event.id, actor).ok, false);
  assert.equal(sim.state.money, money);
});

test('supporting a local activity deducts exactly 300 and adds bounded real happiness, with city-wide duplicate protection', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  const story = getCitizenStory(sim.state, actor);
  assert.equal(story.event.available, true);
  const money = sim.state.money, rng = sim.state.rng;
  const happiness = new Map(sim.state.buildings.map(b => [b.id, b.happiness]));
  assert.equal(sim.resolveCityEvent(story.event.id, actor).ok, true);
  assert.equal(sim.state.money, money - 300); assert.equal(sim.state.rng, rng);
  assert.equal(sim.state.stats.cityEventBonus, 4);
  for (const b of sim.state.buildings) assert.equal(b.happiness, b.type === 'residential' ? Math.min(100, happiness.get(b.id) + 4) : happiness.get(b.id));
  assert.equal(sim.resolveCityEvent(story.event.id, actor).ok, false);
  const otherActor = { ...actor, id: 'different-neighbor' };
  const otherStory = getCitizenStory(sim.state, otherActor);
  assert.equal(otherStory.event.available, false);
  assert.equal(sim.resolveCityEvent(otherStory.event.id, otherActor).ok, false);
  assert.equal(sim.state.money, money - 300);
  assert.equal(sim.state.cityLife.activeEvent.kind,story.event.kind);
  assert.match(getCitizenStory(sim.state, actor).event.reason,/进行中/);
});

test('event duration follows simulation months; stale proposals and identities cannot be replayed', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  const proposal = getCitizenStory(sim.state, actor).event;
  assert.equal(sim.resolveCityEvent(proposal.id, { ...actor, id: 'someone-else' }).ok, false);
  assert.equal(sim.resolveCityEvent(proposal.id, actor).ok, true);
  const endMonth = sim.state.month + 2;
  run(sim, 15);
  assert.equal(sim.state.stats.cityEventBonus, 4);
  assert.equal(getCitizenStory(sim.state, actor).event.available, false);
  run(sim, 15);
  assert.equal(sim.state.month, endMonth);
  assert.equal(sim.state.cityLife.activeEvent, null);
  assert.equal(sim.state.stats.cityEventBonus, 0);
  const money = sim.state.money;
  assert.equal(sim.resolveCityEvent(proposal.id, actor).ok, false);
  assert.equal(sim.state.money, money);
  const current = getCitizenStory(sim.state, actor).event;
  assert.notEqual(current.id, proposal.id);
  assert.equal(current.available, true);
  assert.equal(sim.resolveCityEvent(current.id, actor).ok, true);
});

test('insufficient money and missing park prevent events without charges, while invalid event IDs cannot act', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  const original = getCitizenStory(sim.state, actor).event;
  sim.state.money = 299;
  assert.equal(getCitizenStory(sim.state, actor).event.available, false);
  assert.equal(sim.resolveCityEvent(original.id, actor).ok, false);
  assert.equal(sim.state.money, 299);
  sim.state.money = 300;
  for (const b of sim.state.buildings.filter(b => ['park', 'plaza'].includes(b.type))) sim.setBuildingActive(b.id, false);
  assert.match(getCitizenStory(sim.state, actor).event.reason, /公园|广场/);
  assert.equal(sim.resolveCityEvent(original.id, actor).ok, false);
  for (const invalid of ['', 'market:6:bogus', null, 300, 'x'.repeat(200)]) assert.equal(sim.resolveCityEvent(invalid, actor).ok, false);
  assert.equal(sim.state.money, 300);
});

test('construction undo never refunds event costs or removes an active event', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  assert.equal(sim.build('road', [{ x: 7, y: 31 }]).ok, true);
  const money = sim.state.money;
  assert.equal(sim.resolveCityEvent(getCitizenStory(sim.state, actor).event.id, actor).ok, true);
  assert.equal(sim.undo().ok, false);
  assert.equal(sim.state.money, money - 300);
  assert.equal(sim.build('road', [{ x: 7, y: 30 }]).ok, true);
  assert.equal(sim.undo().ok, true);
  assert.equal(sim.state.money, money - 300);
  assert.equal(sim.state.stats.cityEventBonus, 4);
});

test('active events survive exact save/load, older version-one saves load, invalid life states reject', () => {
  const sim = new CitySimulation({ demo: true }); const actor = pedestrian(sim);
  sim.resolveCityEvent(getCitizenStory(sim.state, actor).event.id, actor);
  const restored = CitySimulation.deserialize(sim.serialize());
  assert.deepEqual(restored.state, sim.state);
  const old = JSON.parse(sim.serialize()); delete old.cityLife;
  const oldRestored = CitySimulation.deserialize(JSON.stringify(old));
  assert.deepEqual(oldRestored.state.cityLife, { lastEventMonth: 0, activeEvent: null });
  assert.equal(oldRestored.state.stats.cityEventBonus, 0);
  for (const mutate of [
    s => { s.cityLife = null; }, s => { s.cityLife = []; },
    s => { s.cityLife.lastEventMonth = s.month + 1; }, s => { s.cityLife.lastEventMonth = -1; },
    s => { s.cityLife.activeEvent.bonus = 100; }, s => { s.cityLife.activeEvent.kind = 'free-money'; },
    s => { s.cityLife.activeEvent.expiresMonth = s.month + 1000; },
    s => { s.cityLife.activeEvent.expiresMonth = s.month; },
    s => { delete s.cityLife.activeEvent; },
  ]) { const raw = JSON.parse(sim.serialize()); mutate(raw); assert.throws(() => CitySimulation.deserialize(JSON.stringify(raw))); }
  run(sim, 30); run(restored, 30);
  assert.deepEqual(restored.state, sim.state);
});
