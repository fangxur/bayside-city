import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation, SIZE } from '../src/simulation.js';

const line = (x1, y1, x2, y2) => Array.from({ length: Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) + 1 }, (_, i) => ({ x: x1 + Math.sign(x2 - x1) * i, y: y1 + Math.sign(y2 - y1) * i }));
const run = (city, n) => { for (let i = 0; i < n; i++) city.tick(); };
const build = (s, tool, cells) => { const result = s.build(tool, cells); assert.equal(result.ok, true, `${tool}: ${result.message}`); return result; };
const starter = () => {
  const s = new CitySimulation();
  build(s, 'road', line(7, 32, 30, 32));
  build(s, 'power', [{ x: 8, y: 31 }]);
  build(s, 'water', [{ x: 9, y: 31 }]);
  build(s, 'residential', [...line(10, 31, 19, 31), ...line(8, 33, 19, 33)]);
  build(s, 'foodFactory', line(24, 31, 30, 31));
  for(let i=0;i<20&&!s.preview('commercial',line(20,31,23,31)).valid;i++)s.tick();
  build(s, 'commercial', line(20, 31, 23, 31));
  return s;
};

// A mature city with spare housing and saturated shops, but too few jobs.
const matureCity = () => {
  const s = new CitySimulation();
  for (let x = 7; x <= 31; x++) s.tile(x, 32).road = 2;
  for (let y = 10; y <= 43; y++) s.tile(8, y).road = 2;
  for (const x of [12, 16, 20, 24, 28, 31]) for (let y = 10; y <= 43; y++) s.tile(x, y).road = 2;
  for (let y = 11; y <= 44; y += 3) for (let x = 8; x <= 31; x++) s.tile(x, y).road = 2;
  const sites = s.state.tiles.filter(t => t.x >= 9 && t.x <= 30 && t.y >= 10 && t.y <= 43 && !t.road);
  const add = (type, minY = 10) => {
    const [t] = sites.splice(sites.findIndex(t => t.y >= minY), 1);
    if (['residential', 'commercial', 'industrial'].includes(type)) t.zone = type;
    return s._newBuilding(t.x, t.y, type, true);
  };
  for (let i = 0; i < 8; i++) { add('power', 40); add('water', 40); }
  for (let i = 0; i < 99; i++) {
    const b = add('residential'); b.level = 2; b.population = i < 90 ? 20 : 19;
    if (i % 3 === 0 && i < 84) add('commercial').level = 2;
    if (i % 5 === 0) add('park');
  }
  for (let i = 0; i < 11; i++) add('industrial', 34).level = 2;
  for (const t of sites.filter(t => t.y >= 34).slice(0, 30)) t.zone = 'industrial';
  s.state.tick = 300; s.state.month = 21;
  s.state.milestones.completed = true;
  s.recalculate();
  return s;
};

test('a mature city can create jobs and grow beyond 2,000 despite vacant homes and saturated shops', () => {
  const s = matureCity();
  assert.equal(s.state.stats.population, 1971);
  assert(s.state.stats.jobs < s.state.stats.workforce);
  assert.equal(s.state.stats.demand.residential, 0);
  assert.equal(s.state.stats.demand.commercial, 0);
  assert(s.state.stats.demand.industrial >= 12, 'available workers must attract new employers');
  const initialFactories = s.state.stats.counts.industrial;
  run(s, 30);
  assert(s.state.stats.counts.industrial > initialFactories);
  assert(s.state.stats.population > 2000, 'growth continues after the first objective');
});

test('mature-city job demand still responds to tax and excess job capacity', () => {
  const s = matureCity();
  const normalDemand = s.state.stats.demand.industrial;
  s.setTax(15);
  assert(s.state.stats.demand.industrial < normalDemand);
  for (const b of s.state.buildings) if (b.type === 'residential') b.population = 10;
  s.recalculate();
  assert.equal(s.state.stats.demand.industrial, 0);
});

test('terrain, entry and preview are deterministic and have no side effects', () => {
  const a = new CitySimulation({ seed: 12 });
  const b = new CitySimulation({ seed: 12 });
  assert.equal(a.serialize(), b.serialize());
  assert.equal(a.state.tiles.length, SIZE * SIZE);
  assert.equal(a.tile(0, 32).connected, true);
  const initial = a.serialize();
  const p = a.preview('road', line(6, 32, 10, 32));
  assert.equal(p.valid, true); assert.equal(p.cost, 75); assert.equal(p.cells.length, 3);
  assert.equal(a.serialize(), initial);
});

test('build is atomic, deduplicates cells and never charges for existing roads or zones', () => {
  const s = new CitySimulation();
  build(s, 'road', [{ x: 8, y: 32 }, { x: 8, y: 32 }, { x: 7, y: 32 }]);
  assert.equal(s.state.money, 29975);
  const initial = s.serialize();
  assert.equal(s.build('road', [{ x: 8, y: 32 }]).ok, false);
  assert.equal(s.serialize(), initial);
  assert.equal(s.build('road', [{ x: 9, y: 32 }, { x: 39, y: 32 }]).ok, false);
  assert.equal(s.tile(9, 32).road, 0);
  build(s, 'residential', [{ x: 8, y: 31 }, { x: 8, y: 32 }, { x: 39, y: 32 }]);
  assert.equal(s.state.money, 29855);
  assert.equal(s.build('residential', [{ x: 8, y: 31 }]).ok, false);
  s.state.money = 10;
  assert.equal(s.build('road', [{ x: 9, y: 32 }]).ok, false);
  assert.equal(s.tile(9, 32).road, 0);
});

test('cold start creates buildings, residents, employment and sustainable tax revenue', () => {
  const s = starter();
  assert(s.state.money > 20000);
  run(s, 40);
  assert(s.state.stats.population >= 150, 'families arrive without a resident/job deadlock');
  assert(s.state.stats.jobs > 0);
  assert(s.state.stats.employed > 0);
  assert(s.state.stats.balance > 0);
  assert(s.state.stats.happiness >= 55);
  assert(s.state.money > 19000);
});

test('an isolated neighborhood stays empty, then grows after a real connection', () => {
  const s = new CitySimulation();
  build(s, 'road', line(10, 20, 20, 20));
  build(s, 'power', [{ x: 10, y: 19 }]);
  build(s, 'water', [{ x: 11, y: 19 }]);
  build(s, 'residential', line(12, 19, 19, 19));
  run(s, 8);
  assert.equal(s.state.stats.population, 0);
  assert.equal(s.state.stats.powerCapacity, 0);
  assert.match(s.getInfo(12, 19).problem, /道路/);
  build(s, 'road', line(7, 32, 10, 32));
  build(s, 'road', line(10, 20, 10, 32));
  run(s, 12);
  assert(s.state.stats.population > 0);
});

test('cutting the only connection stops utilities, employment and traffic; reconnecting restores them', () => {
  const s = starter(); run(s, 25);
  assert(s.state.routes.length > 0);
  const p = s.preview('bulldoze', [{ x: 7, y: 32 }]);
  assert(p.affected > 0);
  build(s, 'bulldoze', [{ x: 7, y: 32 }]);
  assert.equal(s.state.stats.powerCapacity, 0);
  assert.equal(s.state.stats.jobs, 0);
  assert.equal(s.state.routes.length, 0);
  assert(s.state.buildings.every(b => !b.connected));
  const oldPopulation = s.state.stats.population;
  run(s, 7);
  assert(s.state.stats.population < oldPopulation);
  build(s, 'road', [{ x: 7, y: 32 }]);
  assert.equal(s.state.stats.powerCapacity, 750);
  assert(s.state.stats.jobs > 0);
});

test('routes follow adjacent connected roads and raw loads determine the traffic overlay', () => {
  const s = new CitySimulation({ demo: true });
  const expected = new Map();
  assert(s.state.routes.some(r => r.kind === 'commute'));
  assert(s.state.routes.some(r => r.kind === 'freight'));
  for (const r of s.state.routes) {
    assert(r.load > 0);
    for (const path of [r.points,r.returnPoints]) for (let i = 0; i < path.length; i++) {
      const p = path[i]; const t = s.tile(p.x, p.y);
      assert(t.road && t.connected);
      if (i) assert.equal(Math.abs(p.x - path[i - 1].x) + Math.abs(p.y - path[i - 1].y), 1);
      const key = `${p.x},${p.y}`; expected.set(key, (expected.get(key) || 0) + (r.walking?0:r.load/2));
    }
  }
  for (const t of s.state.tiles.filter(t => t.road)) {
    assert(Math.abs(t.trafficLoad - (expected.get(`${t.x},${t.y}`) || 0)) < 1.5, 'display routes represent assigned road load, allowing rounded route loads');
    assert.equal(t.traffic, Math.min(100, Math.round(t.trafficLoad / t.trafficCapacity * 70)));
  }
});

test('a competitive parallel street carries real traffic and relieves the old bottleneck', () => {
  const s = starter(); run(s, 40);
  const load = s.tile(18, 32).trafficLoad, flow = s.state.stats.traffic;
  build(s, 'road', line(7, 32, 7, 34));
  build(s, 'road', line(7, 34, 30, 34));
  build(s, 'road', line(30, 32, 30, 34));
  assert(s.tile(18, 32).trafficLoad < load * 0.8);
  assert(s.tile(18, 34).trafficLoad > 0);
  assert(s.state.stats.traffic > flow);
});

test('active industries pollute their neighbors and distant land stays clean', () => {
  const s = starter(); run(s, 20);
  const factories = s.state.buildings.filter(b => b.type === 'industrial');
  assert(factories.length > 0);
  assert(s.tile(25, 31).pollution > s.tile(10, 31).pollution);
  const factory = factories[0];
  assert(s.getInfo(factory.x, factory.y).metrics.some(m => m.label === '员工 / 岗位'));
});

test('utility shortages are real, and facility pause changes service and maintenance immediately', () => {
  const s = starter(); run(s, 20);
  const power = s.state.buildings.find(b => b.type === 'power');
  const originalExpenses = s.state.stats.expenses;
  assert.equal(s.setBuildingActive(power.id, false).ok, true);
  assert.equal(s.state.stats.powerCapacity, 0);
  assert(s.state.stats.expenses < originalExpenses);
  assert(s.state.buildings.filter(b => b.type === 'residential').every(b => !b.powered));
  assert.equal(s.setBuildingActive(power.id, true).ok, true);
  assert(s.state.stats.powerCapacity > 0);
  assert.equal(s.state.stats.expenses, originalExpenses);
});

test('monthly settlement is exact and recalculation does not advance money or time', () => {
  const s = starter(); run(s, 14-s.state.tick%15);
  const before = { money: s.state.money, tick: s.state.tick, rng: s.state.rng, month:s.state.month };
  s.recalculate(); const stats = JSON.stringify(s.state.stats); s.recalculate();
  assert.equal(JSON.stringify(s.state.stats), stats);
  assert.equal(s.state.money, before.money); assert.equal(s.state.tick, before.tick); assert.equal(s.state.rng, before.rng);
  s.tick();
  assert.equal(s.state.money, before.money + s.state.lastMonthly.balance);
  assert.equal(s.state.lastMonthly.income - s.state.lastMonthly.expenses, s.state.lastMonthly.balance);
  assert.equal(s.state.month, before.month+1);
});

test('undo exactly restores last construction only before simulation advances', () => {
  const s = new CitySimulation(); const initial = s.serialize();
  build(s, 'road', line(7, 32, 13, 32));
  assert.equal(s.undo().ok, true); assert.equal(s.serialize(), initial);
  assert.equal(s.undo().ok, false);
  build(s, 'road', line(7, 32, 13, 32)); s.tick();
  assert.equal(s.undo().ok, false);
});

test('facility demolition returns only a small fraction, never creating money', () => {
  const s = new CitySimulation();
  const initial = s.state.money;
  build(s, 'power', [{ x: 7, y: 31 }]);
  assert.equal(s.state.money, initial - 2500);
  const p = s.preview('bulldoze', [{ x: 7, y: 31 }]); assert.equal(p.cost, -500);
  build(s, 'bulldoze', [{ x: 7, y: 31 }]);
  assert.equal(s.state.money, initial - 2000);
});

test('loan is one-off, has three full grace months and twenty-four repayments', () => {
  const s = new CitySimulation();
  assert.equal(s.takeLoan().ok, false);
  s.state.money = 2000; assert.equal(s.takeLoan().ok, true);
  assert.equal(s.state.money, 8000); assert.equal(s.takeLoan().ok, false);
  run(s, 45); assert.equal(s.state.loan.remaining, 7200); assert.equal(s.state.loan.grace, 0);
  const before = s.state.money; run(s, 15);
  assert.equal(s.state.loan.remaining, 6900);
  assert.equal(s.state.money, before - s.state.lastMonthly.expenses);
  run(s, 345); assert.equal(s.state.loan.remaining, 0); assert.equal(s.state.loan.monthsPaid, 24);
  assert.equal(s.state.stats.breakdown.loanPayment, 0);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
});

test('town achievement persists independently of unrestricted bridge construction', () => {
  const s = new CitySimulation({ demo: true });
  assert.equal(s.preview('bridge', [{ x: 39, y: 22 }]).valid, true);
  run(s, 15); assert.equal(s.state.milestones.bridge, true);
  for (const b of s.state.buildings.filter(b => b.type === 'residential')) b.population = 0;
  s.recalculate(); assert.equal(s.state.milestones.bridge, true);
  assert.equal(s.preview('bridge', [{ x: 39, y: 23 }]).valid, true);
  const p = s.preview('bridge', [{ x: 39, y: 22 }]);
  assert.equal(p.valid, true); assert.equal(p.cost, 3500);
  build(s, 'bridge', [{ x: 39, y: 22 }]);
  const bridge = s.state.tiles.filter(t => t.bridge);
  assert(bridge.length >= 5); assert(bridge.every(t => t.road));
  assert.equal(bridge[0].terrain, 'land'); assert.equal(bridge.at(-1).terrain, 'land');
  assert.equal(s.preview('bridge', [{ x: 39, y: 22 }]).valid, false);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
});

test('save/load restores deterministic state and future simulation', () => {
  const a = starter(); run(a, 18);
  a.setDistrictName('测试河湾'); a.setTax(10);
  const b = CitySimulation.deserialize(a.serialize());
  assert.deepEqual(b.state, a.state);
  run(a, 17); run(b, 17);
  assert.deepEqual(b.state, a.state);
});

test('compact browser saves are much smaller, round-trip exactly and reject malformed tuples',()=>{
  for(const size of [64,80,96]){
    const city=new CitySimulation({mapSize:size}),regular=city.serialize(),compact=city.serializeCompact();
    assert(compact.length<regular.length*.35,`${size}: ${compact.length} / ${regular.length}`);
    assert.equal(CitySimulation.deserialize(compact).serialize(),regular);
  }
  const city=new CitySimulation({demo:true}),raw=JSON.parse(city.serializeCompact());
  raw.tiles[0]=[2];assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)),/损坏/);
  const buildingRaw=JSON.parse(city.serializeCompact());buildingRaw.buildings[0].push(0,0,0,0,0);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(buildingRaw)),/损坏/);
});

test('untrusted saves reject invalid structure, dangling IDs and impossible numerical states', () => {
  const s = new CitySimulation({ demo: true }); const data = s.serialize();
  for (const mutate of [
    x => { x.version = 2; }, x => { x.tiles.pop(); }, x => { x.money = '100000'; },
    x => { x.month += 1; }, x => { x.buildings[0].type = '__proto__'; },
    x => { x.buildings[0].id = x.buildings[1].id; }, x => { x.tiles[0].buildingId = 999; },
    x => { x.buildings[0].progress = 50; }, x => { x.buildings[0].x = -1; },
    x => { x.loan.remaining = 600; }, x => { x.districtName = 'x'.repeat(10000); },
    x => { x.buildings[0].active = 'yes'; }, x => { x.tiles[0].road = 999; },
  ]) { const bad = JSON.parse(data); mutate(bad); assert.throws(() => CitySimulation.deserialize(JSON.stringify(bad))); }
  assert.throws(() => CitySimulation.deserialize('{'));
  assert.throws(() => CitySimulation.deserialize('x'.repeat(5_000_001)));
  const injected = JSON.parse(data); injected.stats = { population: 99999999 }; injected.routes = [{ evil: true }]; injected.extra = { pollution: 1000000 };
  const clean = CitySimulation.deserialize(JSON.stringify(injected));
  assert.equal(clean.state.stats.population, s.state.stats.population); assert.equal(clean.state.extra, undefined);
});

test('demo is self-consistent, solvent, develops naturally and produces inspectable reasons', () => {
  const s = new CitySimulation({ demo: true });
  assert(s.state.stats.population >= 250 && s.state.stats.population <= 500);
  assert(s.state.stats.balance > 0); assert(s.state.stats.employmentRate >= 80);
  assert(s.state.buildings.every(b => b.connected));
  assert(s.state.tiles.every(t => t.terrain !== 'water' || (!t.road && t.buildingId === null)));
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
  run(s, 30);
  assert(s.state.stats.population >= 500);
  assert(s.state.stats.alerts.some(a => a.text.includes('电力')));
  assert(s.getObjective().title.length > 0);
  assert(s.getInfo(0, 32).title.length > 0);
});

test('an affordable expansion and density upgrade can achieve the 2,000-person objective', () => {
  const s = new CitySimulation({ demo: true });
  for(let i=0;i<2400&&s.state.money<75000;i++)s.tick();
  assert(s.state.money>=75000,'save a finite expansion budget without runaway monthly profits');
  for (const x of [8, 13, 18, 23, 28, 33]) build(s, 'road', line(x, 3, x, 20));
  for (const y of [3, 8, 13, 18]) build(s, 'road', line(8, y, 33, y));
  for (const [x, y, type] of [
    [9, 4, 'power'], [10, 4, 'water'], [14, 4, 'power'], [15, 4, 'water'], [16, 4, 'cityHall'],
    ...[7, 12].flatMap(y => [12, 17, 22, 27, 32].map(x => [x, y, 'park'])),
  ]) build(s, type, [{ x, y }]);
  const homes = [], shops = [];
  for (let y = 4; y <= 17; y++) for (let x = 9; x <= 32; x++) {
    const t = s.tile(x, y); if (t.road || t.buildingId !== null) continue;
    ((x + y) % 4 === 0 ? shops : homes).push({ x, y });
  }
  build(s, 'residential', homes); build(s, 'commercial', shops);
  run(s, 120);
  assert(s.state.milestones.density, 'normal growth unlocks density without editing simulation state');
  const shopBudget=Math.max(0,s.state.money-10000),shopUpgrades=s.state.buildings.filter(b => b.type === 'commercial' && b.level === 1).slice(0,Math.min(25,Math.floor(shopBudget/1000)));
  if(shopUpgrades.length)build(s, 'upgrade', shopUpgrades);
  const housingUpgrades=s.state.buildings.filter(b => b.type === 'residential' && b.level === 1).slice(0,50);
  const upgradeBudget=s.preview('upgrade',housingUpgrades).cost+6500;
  for(let i=0;i<1800&&s.state.money<upgradeBudget;i++)s.tick();
  build(s,'upgrade',housingUpgrades);
  build(s, 'power', [{ x: 9, y: 19 }]); build(s, 'water', [{ x: 10, y: 19 }]);
  const jobUpgrades=s.state.buildings.filter(b=>b.type==='commercial'&&b.level===1).slice(0,18),jobBudget=s.preview('upgrade',jobUpgrades).cost;
  for(let i=0;i<600&&s.state.money<jobBudget;i++)s.tick();
  build(s,'upgrade',jobUpgrades);
  const busyRoads = s.state.tiles.filter(t => t.road && t.traffic > 65);
  const affordableRoads=busyRoads.slice(0,Math.floor(s.state.money/30));
  if (affordableRoads.length) build(s, 'upgrade', affordableRoads);
  run(s, 100);
  assert(s.state.stats.population >= 2000,`population ${s.state.stats.population}, jobs ${s.state.stats.jobs}, employed ${s.state.stats.employed}, money ${s.state.money}, balance ${s.state.stats.balance}`);
  assert(s.state.stats.happiness >= 70);
  assert(s.state.stats.balance > 0 && s.state.money > 0);
  assert.equal(s.state.milestones.completed, true);
  build(s, 'landmark', [{ x: 11, y: 19 }]);
  assert.equal(s.state.stats.counts.landmark, 1);
  assert.equal(s.preview('landmark', [{ x: 12, y: 19 }]).valid, false);
  assert.doesNotThrow(() => CitySimulation.deserialize(s.serialize()));
});


test('bridges allow any river row without population and preserve bank upgrades, undo and saves', () => {
  for (const y of [0, 7, 23, 32, 56, 63]) {
    const s = new CitySimulation();
    const river = s.state.tiles.filter(t => t.y === y && t.terrain === 'water');
    const origin = { x: river[0].x, y };
    const bank = s.tile(origin.x - 1, y); bank.road = 4;
    assert.equal(s.state.milestones.bridge, false);
    const p = s.preview('bridge', [origin]);
    assert.equal(p.valid, true); assert.equal(p.cells.length, river.length + 2);
    assert.equal(s.preview('bridge', [bank]).valid, true);
    const before = s.serialize(), money = s.state.money;
    build(s, 'bridge', [origin]);
    assert.equal(s.state.money, money - 3500);
    assert.equal(bank.road, 4);
    assert.equal(s.preview('bridge', [origin]).valid, false);
    const loaded = CitySimulation.deserialize(s.serialize());
    assert(river.every(t => loaded.tile(t.x, y).bridge));
    assert.equal(loaded.tile(bank.x, y).road, 4);
    s.undo(); assert.equal(s.serialize(), before);
  }
});

test('bridge conditions reject inland sites, missing banks, occupied banks and insufficient money atomically', () => {
  const s = new CitySimulation(); const y = 17;
  const water = s.state.tiles.find(t => t.y === y && t.terrain === 'water');
  assert.equal(s.preview('bridge', [{ x: 3, y }]).valid, false);
  const bank = s.tile(water.x - 1, y);
  bank.buildingId = 999;
  assert.match(s.preview('bridge', [water]).reason, /建筑/);
  bank.buildingId = null;
  s.state.money = 3499;
  const before = s.serialize();
  assert.equal(s.build('bridge', [water]).ok, false);
  assert.equal(s.serialize(), before);
  s.state.money = 3500;
  for (const tile of s.state.tiles) tile.terrain = 'water';
  assert.match(s.preview('bridge', [water]).reason, /两岸/);
});
