import {COMMUNITY_BUILDINGS} from '../src/community-buildings.js';
import test from 'node:test';
import {newBuildingFootprint} from '../src/building-footprint.js';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';
import { buildingCapacity, upgradeOffer, BUILDING_TIERS } from '../src/progression.js';
import { fireRange } from '../src/city-services.js';
import { civicGardenGroups } from '../src/city-layout.js';
import {commandGuard,commandLabel,executeCityCommand} from '../src/city-commands.js';

const build = (s, type, x, y) => { assert(s.build(type, [{ x, y }]).ok); return s.state.buildings.find(b => b.x === x && b.y === y); };
const tick = (s, count) => { for (let i = 0; i < count; i++) s.tick(); };

test('parks and plazas radiate on empty land without roads or utilities and pause correctly', () => {
  for (const type of ['park', 'plaza']) {
    const s = new CitySimulation();
    const b = build(s, type, 15, 15);
    assert.equal(b.connected, false);
    assert.equal(b.problem, '');
    assert.equal(s.state.stats.powerUsed, 0);
    assert.equal(s.state.stats.waterUsed, 0);
    assert(s.tile(17, 15).amenity > 0);
    assert.equal(s.tile(type === 'park' ? 20 : 23, 15).amenity, 0);
    assert(!s.state.stats.alerts.some(a => a.text.includes('部分建筑未连接')));
    assert.match(s.getInfo(15, 15).metrics.find(m=>m.label==='道路 / 水电').value, /无需/);
    const expense = s.state.stats.expenses;
    s.setBuildingActive(b.id, false);
    assert.equal(s.tile(17, 15).amenity, 0);
    assert(s.state.stats.expenses < expense);
    s.setBuildingActive(b.id, true);
    assert(s.tile(17, 15).amenity > 0);
    assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  }
});

test('moving a populated building is free, preserves identity and leaves no old zoning; undo and save work', () => {
  const s = new CitySimulation({ demo: true });
  const b = s.state.buildings.find(b => b.type === 'residential' && b.level === 2);
  s.tile(4,11).road=1;s.recalculate();
  const before = s.serialize(), money = s.state.money;
  const identity = Object.fromEntries(['id', 'population', 'level', 'age', 'variant', 'progress', 'active'].map(k => [k, b[k]]));
  const origin = { x: b.x, y: b.y };
  const preview = s.previewMove(b.id, { x: 4, y: 10 });
  assert(preview.valid); assert.match(preview.reason, /免费/); assert.equal(s.serialize(), before);
  assert(s.moveBuilding(b.id, { x: 4, y: 10 }).ok);
  assert.deepEqual(Object.fromEntries(Object.keys(identity).map(k => [k, b[k]])), identity);
  assert.equal(s.state.money, money);
  assert.equal(s.tile(origin.x, origin.y).buildingId, null);
  assert.equal(s.tile(origin.x, origin.y).zone, null);
  assert.equal(s.tile(4, 10).zone, 'residential');
  assert.equal(b.connected, false);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  assert(s.undo().ok); assert.equal(s.serialize(), before);
});

test('placing a moving building back at its origin succeeds without changing city state or undo',()=>{
  const s=new CitySimulation({demo:true}),b=s.state.buildings.find(b=>b.type==='residential'),before=s.serialize(),previousUndo=s._undo;
  const preview=s.previewMove(b.id,{x:b.x,y:b.y});assert(preview.valid);assert(preview.unchanged);assert.equal(preview.affected,0);assert.match(preview.reason,/放回原位/);
  const result=s.moveBuilding(b.id,{x:b.x,y:b.y});assert(result.ok);assert.equal(result.changed,false);assert.match(result.message,/原位/);
  assert.equal(s.serialize(),before);assert.equal(s._undo,previousUndo);
});

test('moving a road tile is free, preserves its level, supports undo and collaborative command guards', () => {
  const s = new CitySimulation({ demo: true });
  const source = s.state.tiles.find(t=>t.road&&!t.bridge&&!(t.x===0&&t.y===32));
  const destination = s.state.tiles.find(t=>t.terrain==='land'&&!t.road&&!t.zone&&t.buildingId===null);
  source.road=3;s.recalculate();
  const from={x:source.x,y:source.y},to={x:destination.x,y:destination.y},money=s.state.money,before=s.serialize();
  const options={buildingId:null,roadSource:from,roadsOnly:false};
  const preview=s.preview('move',[to],options);
  assert(preview.valid);assert.match(preview.reason,/免费移动/);assert.equal(s.serialize(),before);
  const guard=commandGuard(s,'build',['move',[to],options]);
  s.tile(63,63).pollution=1;
  assert.equal(commandGuard(s,'build',['move',[to],options]),guard);
  s.tile(63,63).pollution=0;
  assert.equal(commandLabel('build',['move',[to],options]),'移动道路');
  assert(executeCityCommand(s,'build',['move',[to],options]).ok);
  assert.equal(s.tile(from.x,from.y).road,0);assert.equal(s.tile(to.x,to.y).road,3);assert.equal(s.state.money,money);
  assert.doesNotThrow(()=>CitySimulation.deserialize(s.serialize()));
  assert(s.undo().ok);assert.equal(s.serialize(),before);
});

test('road moves reject protected, structural and occupied cells without changing the city', () => {
  const s = new CitySimulation({demo:true});
  const source=s.state.tiles.find(t=>t.road&&!t.bridge&&!(t.x===0&&t.y===32)),from={x:source.x,y:source.y};
  const bridge=s.state.tiles.find(t=>t.bridge),water=s.state.tiles.find(t=>t.terrain==='water'&&!t.road),road=s.state.tiles.find(t=>t.road&&(t.x!==source.x||t.y!==source.y));
  const building=s.state.buildings[0],zoned=s.state.tiles.find(t=>t.terrain==='land'&&!t.road&&!t.zone&&t.buildingId===null);
  zoned.zone='residential';s.recalculate();const before=s.serialize();
  for(const target of [road,water,building,zoned]){
    assert.equal(s.moveRoad(from,{x:target.x,y:target.y}).ok,false);
    assert.equal(s.serialize(),before);
  }
  assert.equal(s.moveRoad({x:0,y:32},{x:1,y:1}).ok,false);
  if(bridge)assert.equal(s.moveRoad({x:bridge.x,y:bridge.y},{x:1,y:1}).ok,false);
  assert.equal(s.serialize(),before);
  assert.throws(()=>executeCityCommand(s,'build',['move',[{x:1,y:1}],{buildingId:1,roadSource:from}]));
  assert.throws(()=>executeCityCommand(s,'build',['move',[{x:1,y:1}],{roadSource:{x:-1,y:0}}]));
});

test('moving a 2x2 garden handles self-overlap atomically and moves its environmental coverage', () => {
  const s = new CitySimulation();
  for (const x of [10, 11]) for (const y of [10, 11]) build(s, 'park', x, y);
  const b = s.state.buildings[0], count = s.state.buildings.length;
  assert(s.moveBuilding(b.id, { x: 11, y: 10 }).ok);
  assert.equal(civicGardenGroups(s.state.buildings).size, 4);
  assert.equal(s.tile(10, 10).buildingId, null);
  assert(s.moveBuilding(b.id, { x: 20, y: 15 }).ok);
  assert.equal(s.tile(10, 10).amenity, 0);
  assert(s.tile(20, 15).amenity > 0);
  assert.equal(s.state.buildings.length, count);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  const before = s.serialize();
  for (const destination of [{ x: 63, y: 63 }, { x: 0, y: 32 }, { x: 39, y: 0 }, { x: NaN, y: 0 }]) {
    assert.equal(s.moveBuilding(b.id, destination).ok, false);
    assert.equal(s.serialize(), before);
  }
  const other = build(s, 'plaza', 4, 4);
  const snapshot = s.serialize();
  assert.equal(s.moveBuilding(b.id, { x: other.x, y: other.y }).ok, false);
  assert.equal(s.serialize(), snapshot);
});

test('road-only upgrade strokes skip buildings, are priced once and can be undone atomically', () => {
  const s = new CitySimulation({ demo: true }); s.state.roadLevelUnlocked = 2;
  const roads = s.state.tiles.filter(t => t.road === 1).slice(0, 12);
  const home = s.state.buildings.find(b => b.type === 'residential');
  const cells = [...roads, roads[0], { x: home.x, y: home.y }];
  const before = s.serialize(), level = home.level, money = s.state.money;
  const p = s.preview('upgrade', cells, { roadsOnly: true });
  assert.equal(p.cost, 12 * 30); assert.equal(p.cells.length, 12);
  assert(s.build('upgrade', cells, { roadsOnly: true }).ok);
  assert(roads.every(t => t.road === 2)); assert.equal(home.level, level);
  assert.equal(s.state.money, money - p.cost);
  assert.equal(s.preview('upgrade', cells, { roadsOnly: true }).valid, false);
  assert(s.undo().ok); assert.equal(s.serialize(), before);
});

test('stage gates unlock four distinct tiers with higher housing, jobs and utility capacity', () => {
  for (const type of Object.keys(BUILDING_TIERS).filter(type=>!COMMUNITY_BUILDINGS[type]?.fixedFacility&&type!=='marina')) {
    const b = { type, level: 1, progress: 1 };
    assert.equal(upgradeOffer(b, {}).allowed, false);
    assert.equal(upgradeOffer(b, { density: true }).allowed, ['residential', 'commercial', 'industrial', 'park', 'plaza', 'power', 'water'].includes(type));
    const s = new CitySimulation(); s.state.money = 1000000;
    Object.assign(s.state.milestones, { density: true, completed: true, metropolis: true, capital: true });
    const actual = s._newBuilding(7, 32-newBuildingFootprint(type), type, true);
    if (['residential', 'commercial', 'industrial'].includes(type)) s.tile(7, 31).zone = type;
    if(type==='residential'){for(const [kind,x,y] of [['power',6,31],['water',5,31],['fireStation',4,31],['clinic',7,33],['park',6,30],['plaza',5,28]])s.build(kind,[{x,y}]);s.recalculate();}
    let capacity = buildingCapacity(actual);
    for (let level = 2; level <= 4; level++) {
      const cost = upgradeOffer(actual, s.state.milestones).cost, money = s.state.money;
      assert(s.build('upgrade', [{ x: actual.x, y: actual.y }]).ok);
      assert.equal(actual.level, level); assert.equal(s.state.money, money - cost);
      if (!['park','plaza'].includes(type)) assert.equal(s.preview('upgrade', [{ x: actual.x, y: actual.y }]).valid, false, 'cannot upgrade unfinished work');
      actual.progress = 1; s.recalculate();
      if (capacity) assert(buildingCapacity(actual) > capacity);
      capacity = buildingCapacity(actual);
      assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
    }
    assert.equal(s.preview('upgrade', [{ x: actual.x, y: actual.y }]).valid, false);
  }
});

test('upgrading the only power or water facility finishes without a construction deadlock', () => {
  for (const type of ['power', 'water']) {
    const s = new CitySimulation();
    build(s, 'power', 5, 31); build(s, 'water', 6, 31);
    s.state.milestones.density = s.state.milestones.completed = true;
    const b = s.state.buildings.find(b => b.type === type);
    assert(s.build('upgrade', [{ x: b.x, y: b.y }]).ok);
    tick(s, 3);
    assert.equal(b.progress, 1);
    assert.equal(s.state.stats[type === 'power' ? 'powerCapacity' : 'waterCapacity'], buildingCapacity(b));
  }
});

test('the 2000-person goal continues to 5000 and 10000 and older saves get new flags', () => {
  const s = new CitySimulation({ demo: true });
  Object.assign(s.state.milestones, { bridge: true, density: true, completed: true, landmark: true });
  assert.equal(s.getObjective().target, 5000);
  s.state.milestones.metropolis = true;
  assert.equal(s.getObjective().target, 10000);
  s.state.milestones.capital = true;
  assert.equal(s.getObjective().target, 20000);
  assert.deepEqual(s.getGrowthStages().map(g => g.population), [500, 1000, 2000, 5000, 10000,20000,30000,40000,50000]);
  const old = JSON.parse(s.serialize()); delete old.milestones.metropolis; delete old.milestones.capital;delete old.milestones.mature;delete old.milestones.civic;
  const loaded = CitySimulation.deserialize(JSON.stringify(old));
  assert.equal(loaded.state.milestones.metropolis, false);
  assert.equal(loaded.state.milestones.mature, false);assert.equal(loaded.state.milestones.civic,false);
  assert.equal(loaded.getObjective().target, 5000);
  old.milestones.metropolis = 'yes';
  assert.throws(() => CitySimulation.deserialize(JSON.stringify(old)));
});

test('fire station and city hall upgrades extend real road-based service and maintenance', () => {
  const s = new CitySimulation(); s.state.money = 1000000;
  for (let x = 8; x <= 32; x++) assert(s.build('road', [{ x, y: 32 }]).ok);
  build(s, 'power', 5, 31); build(s, 'water', 6, 31);
  const station = build(s, 'fireStation', 7, 31), hall = build(s, 'cityHall', 8, 30);
  s._newBuilding(27, 31, 'residential', true); s.tile(27, 31).zone = 'residential';
  s.recalculate(); const original = s.state.stats.civic.fireMonthlyCost;
  assert.equal(s.tile(27, 31).fireCoverage, 0);
  station.level = 3; hall.level = 3; s.recalculate();
  assert.equal(fireRange(s.state, station), 24);
  assert.equal(s.tile(27, 31).fireCoverage, 100);
  assert(s.state.stats.civic.fireMonthlyCost > original);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
});

test('large-city population alone cannot skip domain coordination, while earned stages survive population loss', () => {
  const s = new CitySimulation();
  build(s, 'power', 5, 31); build(s, 'water', 6, 31);
  Object.assign(s.state.milestones, { named: true, bridge: true, density: true, completed: true, landmark: true });
  const homes = [];
  for (let i = 0; i < 80; i++) {
    const x = 10 + i % 20, y = 10 + Math.floor(i / 20);
    const b = s._newBuilding(x, y, 'residential', true); b.level = 4; s.tile(x, y).zone = 'residential'; homes.push(b);
  }
  const population = n => { for (const home of homes) { home.population = Math.min(128, n); n -= home.population; } s.recalculate(); };
  population(4999); assert.equal(s.state.milestones.metropolis, false);
  population(5000); assert.equal(s.state.milestones.metropolis, false);assert.equal(s.getObjective().target,5000);
  assert(s.getObjective().requirements.some(item=>!item.met));
  Object.assign(s.state.milestones,{metropolis:true,capital:true});
  population(4000);
  const loaded = CitySimulation.deserialize(s.serialize());
  assert.equal(loaded.state.milestones.capital, true);
  assert.equal(loaded.getObjective().target, 20000);
});

test('long-range upgraded drills survive saves; moving a dispatched station or target cancels safely and can be undone', () => {
  const s = new CitySimulation(); s.state.money = 1000000;
  for (let x = 8; x <= 32; x++) build(s, 'road', x, 32);
  build(s, 'power', 5, 31); build(s, 'water', 6, 31);
  const station = build(s, 'fireStation', 7, 31), hall = build(s, 'cityHall', 8, 30);
  station.level = hall.level = 3;
  const home = s._newBuilding(31, 31, 'residential', true); home.population = 8; s.tile(31, 31).zone = 'residential';
  s.recalculate(); assert(s.startFireDrill().ok);
  assert(s.state.civic.incident.path.length > 21);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  for (const id of [home.id, station.id]) {
    const before = s.serialize();
    assert(s.moveBuilding(id, { x: 20, y: 33 }).ok);
    assert.equal(s.state.civic.incident, null);
    assert.equal(s.state.civic.history.at(-1).status, 'cancelled');
    assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
    assert(s.undo().ok); assert.equal(s.serialize(), before);
  }
});
