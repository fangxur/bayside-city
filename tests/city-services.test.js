import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';

const line = (x, y, X, Y) => Array.from({ length: Math.max(Math.abs(X - x), Math.abs(Y - y)) + 1 }, (_, i) => ({ x: x + Math.sign(X - x) * i, y: y + Math.sign(Y - y) * i }));
const run = (s, n) => { for (let i = 0; i < n; i++) s.tick(); };
const build = (s, tool, cells) => { const r = s.build(tool, cells); assert.equal(r.ok, true, `${tool}: ${r.message}`); return r; };
const civicCity = () => {
  const s = new CitySimulation({ demo: true });
  build(s, 'cityHall', [{ x: 10, y: 23 }]);
  build(s, 'fireStation', [{ x: 15, y: 26 }]);
  return s;
};

test('new public buildings charge real costs and maintenance, while city hall remains unique when paused', () => {
  const s = new CitySimulation({ demo: true }); const money = s.state.money, expenses = s.state.stats.expenses;
  build(s, 'cityHall', [{ x: 10, y: 23 }]); build(s, 'fireStation', [{ x: 15, y: 26 }]);
  assert.equal(s.state.money, money - 5200);
  assert.equal(s.state.stats.expenses, expenses + 240);
  assert.equal(s.getCivicInfo().hallReady, true); assert.equal(s.getCivicInfo().stations, 1);
  assert.equal(s.getCivicInfo().servicePopulation, s.state.stats.population);
  const hall = s.state.buildings.find(b => b.type === 'cityHall');
  s.setBuildingActive(hall.id, false);
  const before = s.state.money;
  assert.equal(s.build('cityHall', [{ x: 14, y: 27 }]).ok, false);
  assert.equal(s.state.money, before);
  assert.equal(s.getCivicInfo().hallReady, false);
  assert.equal(s.getCivicInfo().monthlyCost, 132);
});

test('fire coverage follows real road distance around a detour, changes with a shortcut, and cannot jump a cut', () => {
  const s = new CitySimulation();
  build(s, 'road', line(7, 32, 8, 32));
  build(s, 'road', line(8, 20, 8, 32)); build(s, 'road', line(8, 20, 12, 20)); build(s, 'road', line(12, 20, 12, 32));
  for (const [x, type] of [[1, 'power'], [2, 'water'], [3, 'cityHall'], [7, 'fireStation']]) build(s, type, [{ x, y: type==='cityHall'?30:31 }]);
  build(s, 'residential', [{ x: 11, y: 32 }]); run(s, 12);
  const home = s.state.buildings.find(b => b.type === 'residential');
  assert(home.population > 0 && home.connected);
  assert.equal(home.fireCovered, false, 'a nearby building is beyond the road detour range');
  assert.equal(s.setFireBudget(130).ok, true);
  assert.equal(home.fireCovered, false, 'even stronger funding does not bypass physical roads');
  build(s, 'road', line(8, 30, 12, 30));
  assert.equal(home.fireCovered, true); assert.equal(s.tile(11, 32).fireCoverage, 100);
  assert.equal(s.getCivicInfo().coveredPopulation, home.population);
  build(s, 'bulldoze', [{ x: 10, y: 30 }]);
  assert.equal(home.connected, true, 'the original long detour is still usable');
  assert.equal(home.fireCovered, false);
  build(s, 'road', [{ x: 10, y: 30 }]); assert.equal(home.fireCovered, true);
});

test('covered homes gain two happiness points; disabled, unfinished or unserved stations provide no coverage', () => {
  const s = new CitySimulation({ demo: true });
  const before = new Map(s.state.buildings.filter(b => b.type === 'residential').map(b => [b.id, b.happiness]));
  build(s, 'fireStation', [{ x: 15, y: 26 }]);
  const station = s.state.buildings.find(b => b.type === 'fireStation');
  assert(s.state.stats.civic.coveredPopulation > 0);
  for (const b of s.state.buildings.filter(b => b.type === 'residential')) assert.equal(b.happiness, Math.min(100, before.get(b.id) + (b.fireCovered ? 2 : 0)));
  s.setBuildingActive(station.id, false); assert.equal(s.state.stats.civic.coveredPopulation, 0);
  s.setBuildingActive(station.id, true); assert(s.state.stats.civic.coveredPopulation > 0);
  station.progress = 0.5; s.recalculate(); assert.equal(s.state.stats.civic.stations, 0);
  station.progress = 1; s.recalculate();
  const water = s.state.buildings.find(b => b.type === 'water');
  s.setBuildingActive(water.id, false); assert.equal(s.state.stats.civic.coverage, 0);
  s.setBuildingActive(water.id, true); assert(s.state.stats.civic.coverage > 0);
  build(s, 'bulldoze', [{ x: 7, y: 32 }]);
  assert.equal(s.state.stats.civic.coverage, 0); assert.equal(s.state.stats.civic.stations, 0);
});

test('only a working city hall can adjust exact budget tiers, with immediate projected costs but no instant charge', () => {
  const s = civicCity(), money = s.state.money, rng = s.state.rng;
  const normalCoverage = s.getCivicInfo().coverage;
  assert.equal(s.setFireBudget(70).ok, true);
  assert.equal(s.getCivicInfo().range, 8); assert.equal(s.getCivicInfo().fireMonthlyCost, 84);
  assert(s.getCivicInfo().coverage < normalCoverage);
  assert.equal(s.setFireBudget(130).ok, true);
  assert.equal(s.getCivicInfo().range, 20); assert.equal(s.getCivicInfo().fireMonthlyCost, 156);
  assert(s.getCivicInfo().coverage >= normalCoverage);
  assert.equal(s.state.money, money); assert.equal(s.state.rng, rng);
  for (const value of [0, 99, 150, '100', NaN, null]) assert.equal(s.setFireBudget(value).ok, false);
  const hall = s.state.buildings.find(b => b.type === 'cityHall');
  s.setBuildingActive(hall.id, false); assert.equal(s.setFireBudget(100).ok, false);
  assert.equal(s.state.civic.fireBudget, 130);
});

test('city hall policies create distinct livability and development tradeoffs and pause with the hall', () => {
  const s = civicCity();
  const homes = s.state.buildings.filter(b => b.type === 'residential' && b.services.cityHall);
  assert(homes.length > 0); assert(s.getCivicInfo().municipalCoveredPopulation > 0);
  const balancedHappiness = new Map(homes.map(b => [b.id, b.happiness]));
  const balancedExpenses = s.state.stats.expenses;
  const balancedBusinessTax = s.state.stats.breakdown.commercialIncome + s.state.stats.breakdown.industrialIncome;
  assert.equal(s.getCivicInfo().policy, 'balanced');
  assert.equal(s.setCivicPolicy('livability').ok, true);
  assert.equal(s.getCivicInfo().policyEffect.label, '民生优先');
  assert(s.state.stats.expenses > balancedExpenses);
  assert(homes.some(b => balancedHappiness.get(b.id) <= 98 && b.happiness === balancedHappiness.get(b.id) + 2));
  assert.equal(s.setCivicPolicy('development').ok, true);
  assert(s.state.stats.breakdown.commercialIncome + s.state.stats.breakdown.industrialIncome > balancedBusinessTax);
  for (const type of ['commercial', 'industrial']) {
    assert(s.state.stats.demandDetails[type].factors.some(f => f.label === '市政招商促进' && f.value === 10));
  }
  for (const value of ['', 'tourism', null, 1]) assert.equal(s.setCivicPolicy(value).ok, false);
  const hall = s.state.buildings.find(b => b.type === 'cityHall');
  s.setBuildingActive(hall.id, false);
  assert.equal(s.getCivicInfo().policyActive, false);
  assert.equal(s.setCivicPolicy('balanced').ok, false);
  assert(!s.state.stats.demandDetails.commercial.factors.some(f => f.label === '市政招商促进'));
});

test('a free drill dispatches along a real road path, reaches its target, completes safely and observes monthly cooldown', () => {
  const s = civicCity(), money = s.state.money, rng = s.state.rng;
  const ids = s.state.buildings.map(b => b.id);
  assert.equal(s.startFireDrill().ok, true);
  const incident = s.state.civic.incident;
  assert.equal(incident.stage, 'responding'); assert.equal(incident.progress, 0);
  assert(incident.path.length >= 10, 'a far covered building makes the response visible');
  for (let i = 0; i < incident.path.length; i++) {
    const t = s.state.tiles[incident.path[i]]; assert(t.road && t.connected);
    if (i) { const last = s.state.tiles[incident.path[i - 1]]; assert.equal(Math.abs(t.x - last.x) + Math.abs(t.y - last.y), 1); }
  }
  assert.equal(s.state.money, money); assert.equal(s.state.rng, rng);
  assert.equal(s.startFireDrill().ok, false);
  run(s, incident.totalTicks);
  assert.equal(s.state.civic.incident.stage, 'controlling');
  run(s, 3);
  assert.equal(s.state.civic.incident, null);
  assert.equal(s.state.civic.history.at(-1).status, 'completed');
  assert.deepEqual(s.state.buildings.map(b => b.id), ids);
  assert.equal(s.state.money, money, 'the drill itself grants or charges no money');
  assert.equal(s.startFireDrill().ok, false);
  run(s, 15 - s.state.tick % 15);
  assert.equal(s.startFireDrill().ok, true);
});

test('failed drill starts do not consume a month and missing coverage has an actionable reason', () => {
  const s = new CitySimulation();
  assert.equal(s.startFireDrill().ok, false); assert.equal(s.state.civic.lastDrillMonth, 0);
  for (const [x, type] of [[1, 'power'], [2, 'water'], [3, 'cityHall']]) build(s, type, [{ x, y: type==='cityHall'?30:31 }]);
  assert.equal(s.startFireDrill().ok, false); assert.equal(s.state.civic.lastDrillMonth, 0);
  build(s, 'fireStation', [{ x: 6, y: 31 }]);
  assert.match(s.startFireDrill().message, /覆盖|建筑/);
  assert.equal(s.state.civic.lastDrillMonth, 0);
  build(s, 'residential', [{ x: 5, y: 31 }]); run(s, 8);
  assert.equal(s.startFireDrill().ok, true);
});

test('drill cancellation handles shutdown, removed station/target, broken response path and reduced coverage without getting stuck', () => {
  const mutations = [
    s => s.setBuildingActive(s.state.civic.incident.stationId, false),
    s => { const b = s.state.buildings.find(b => b.id === s.state.civic.incident.stationId); build(s, 'bulldoze', [b]); },
    s => { const b = s.state.buildings.find(b => b.id === s.state.civic.incident.targetId); build(s, 'bulldoze', [b]); },
    s => build(s, 'bulldoze', [s.state.tiles[s.state.civic.incident.path[4]]]),
    s => s.setFireBudget(70),
  ];
  for (const mutate of mutations) {
    const s = civicCity(); assert.equal(s.startFireDrill().ok, true); s.tick();
    mutate(s);
    assert.equal(s.state.civic.incident, null);
    assert.equal(s.state.civic.history.at(-1).status, 'cancelled');
    assert(s.state.civic.history.at(-1).message.length > 4);
    assert.equal(s.state.civic.history.length, 1);
    s.recalculate(); assert.equal(s.state.civic.history.length, 1);
    assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  }
});

test('unrelated road work and pausing city hall do not cancel an already dispatched drill', () => {
  const s = civicCity(); assert.equal(s.startFireDrill().ok, true);
  const id = s.state.civic.incident.id;
  build(s, 'road', [{ x: 7, y: 31 }]);
  assert.equal(s.state.civic.incident.id, id);
  s.setBuildingActive(s.state.buildings.find(b => b.type === 'cityHall').id, false);
  assert.equal(s.state.civic.incident.id, id);
  run(s, s.state.civic.incident.remainingTicks + 3);
  assert.equal(s.state.civic.history.at(-1).status, 'completed');
});

test('civic management clears older undo snapshots, and later construction undo preserves the dispatch/cooldown', () => {
  const s = civicCity(); build(s, 'road', [{ x: 7, y: 31 }]);
  assert.equal(s.setFireBudget(130).ok, true); assert.equal(s.undo().ok, false);
  build(s, 'road', [{ x: 7, y: 30 }]);
  assert.equal(s.startFireDrill().ok, true); assert.equal(s.undo().ok, false);
  const incident = structuredClone(s.state.civic.incident);
  build(s, 'road', [{ x: 7, y: 29 }]); assert.equal(s.undo().ok, true);
  assert.deepEqual(s.state.civic.incident, incident);
  assert.equal(s.startFireDrill().ok, false);
});

test('mid-response and mid-control saves resume deterministically; old saves receive only civic defaults', () => {
  const s = civicCity(); s.setFireBudget(130); s.startFireDrill(); run(s, 2);
  const response = CitySimulation.deserialize(s.serialize()); assert.deepEqual(response.state, s.state);
  run(s, s.state.civic.incident.remainingTicks + 1); run(response, response.state.civic.incident.remainingTicks + 1);
  assert.deepEqual(response.state, s.state);
  assert.equal(s.state.civic.incident.stage, 'controlling');
  const controlling = CitySimulation.deserialize(s.serialize());
  run(s, 4); run(controlling, 4); assert.deepEqual(controlling.state, s.state);
  assert.equal(controlling.startFireDrill().ok, false);
  const legacy = new CitySimulation({ demo: true }), raw = JSON.parse(legacy.serialize()); delete raw.civic;
  const restored = CitySimulation.deserialize(JSON.stringify(raw));
  assert.deepEqual(restored.state.civic, { fireBudget: 100, policy: 'balanced', lastDrillMonth: 0, incident: null, history: [] });
  assert.equal(restored.state.money, legacy.state.money); assert.equal(restored.state.rng, legacy.state.rng);
  assert.deepEqual(restored.state.buildings, legacy.state.buildings);
});

test('strict civic import validation rejects forged budgets, progress, paths, targets, history and duplicate city halls', () => {
  const s = civicCity(); s.startFireDrill(); s.tick();
  const mutations = [
    raw => { raw.civic = null; }, raw => { raw.civic.fireBudget = 999; }, raw => { raw.civic.policy = 'tourism'; }, raw => { raw.civic.lastDrillMonth = raw.month + 1; },
    raw => { raw.civic.incident.progress = 0.99; }, raw => { raw.civic.incident.remainingTicks = 1; },
    raw => { raw.civic.incident.path[0] = 1; }, raw => { raw.civic.incident.path.reverse(); },
    raw => { raw.civic.incident.targetId = 999999; }, raw => { raw.civic.incident.kind = 'real-fire'; },
    raw => { raw.civic.incident.stage = 'reward'; }, raw => { raw.civic.history = new Array(13).fill({}); },
    raw => { raw.buildings.find(b => b.type === 'water').type = 'cityHall'; },
    raw => { delete raw.civic.incident; },
  ];
  for (const mutate of mutations) { const raw = JSON.parse(s.serialize()); mutate(raw); assert.throws(() => CitySimulation.deserialize(JSON.stringify(raw))); }
  const info = s.getCivicInfo(); info.incident.path[0] = 0; info.history.push({ status: 'completed' });
  assert.notEqual(s.state.civic.incident.path[0], 0); assert.equal(s.state.civic.history.length, 0);
});
