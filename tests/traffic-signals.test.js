import test from 'node:test';
import assert from 'node:assert/strict';
import { TrafficController, detectIntersections, signalPhaseAt } from '../src/traffic-signals.js';
import { CitySimulation } from '../src/simulation.js';

const line = (x, y, X, Y) => Array.from({ length: Math.max(Math.abs(X - x), Math.abs(Y - y)) + 1 }, (_, i) => ({ x: x + Math.sign(X - x) * i, y: y + Math.sign(Y - y) * i }));
const roadTiles = points => [...new Map(points.map(p => [`${p.x},${p.y}`, { ...p, terrain: 'land', road: 1, bridge: false, traffic: 0 }])).values()];
const crossroads = () => roadTiles([...line(6, 10, 14, 10), ...line(10, 6, 10, 14)]);
const vehicle = (id, points, travel = 0, reverse = false, kind = 'car') => ({ id, points, travel, reverse, kind });
const controller = (cars, tiles = crossroads()) => { const c = new TrafficController(); c.sync(tiles, cars); return c; };

test('traffic updates reuse road geometry but refresh phases and invalidate structural changes',()=>{
 const tiles=crossroads(),c=controller([],tiles),wide=c.wideRoads,intersections=c.intersections;
 c.time=8;const updated=structuredClone(tiles);updated[0].traffic=90;c.sync(updated,[]);
 assert.equal(c.wideRoads,wide);assert.equal(c.intersections,intersections);
 assert.equal(c._tiles.get(`${updated[0].x},${updated[0].y}`),updated[0]);
 assert.equal(c.signals[0].phase,signalPhaseAt(c.time,c.signals[0].offset).phase);
 updated.find(t=>t.x===10&&t.y===10).bridge=true;c.sync(updated,[]);
 assert.notEqual(c.wideRoads,wide);assert.equal(c.signals.length,0);
 const changed=c.wideRoads;updated[0].road=3;c.sync(updated,[]);assert.notEqual(c.wideRoads,changed);
});

test('only real land T and four-way junctions get signals; turns, straight roads and bridges do not', () => {
  assert.equal(detectIntersections(roadTiles(line(2, 2, 8, 2))).length, 0);
  assert.equal(detectIntersections(roadTiles([...line(2, 2, 5, 2), ...line(5, 2, 5, 5)])).length, 0);
  const cross = crossroads();
  const signals = detectIntersections(cross);
  assert.equal(signals.length, 1); assert.deepEqual(signals[0].arms, ['N', 'E', 'S', 'W']);
  const tJunction = cross.filter(t => !(t.x === 10 && t.y < 10));
  assert.equal(detectIntersections(tJunction)[0].arms.length, 3);
  cross.find(t => t.x === 10 && t.y === 10).bridge = true;
  assert.equal(detectIntersections(cross).length, 0);
  cross.find(t => t.x === 10 && t.y === 10).bridge = false;
  cross.find(t => t.x === 10 && t.y === 10).terrain = 'water';
  assert.equal(detectIntersections(cross).length, 0);
});

test('phases alternate green, yellow and all-red with never-conflicting green axes and coordinate offsets', () => {
  const phases = new Set();
  for (let t = 0; t < 35; t += 0.025) {
    const signal = signalPhaseAt(t);
    assert(!(signal.ns === 'green' && signal.ew === 'green'));
    assert(signal.remaining > 0); phases.add(signal.phase);
    if (signal.ns === 'yellow') assert.equal(signal.ew, 'red');
    if (signal.ew === 'yellow') assert.equal(signal.ns, 'red');
  }
  assert.equal(phases.size, 6);
  const grid = roadTiles([...line(3, 10, 20, 10), ...line(10, 7, 10, 13), ...line(15, 7, 15, 13)]);
  const c = controller([], grid);
  assert.equal(c.signals.length, 2);
  assert.notEqual(c.signals[0].remaining, c.signals[1].remaining);
});

test('red stops before the painted line and green releases the real vehicle', () => {
  const c = controller([vehicle('west', line(8, 10, 12, 10))]);
  assert.equal(c.getSignalInfo(10, 10).ew, 'red');
  c.step(3);
  const stopped = c.getPose('west');
  assert(Math.abs(stopped.x - 9.17) < 1e-6);
  assert.equal(stopped.waiting, true); assert.equal(stopped.reason, 'signal');
  assert.equal(c.getSignalInfo(10, 10).waiting, 1);
  c.step(4);
  assert.equal(c.getSignalInfo(10, 10).ew, 'green');
  assert(c.getPose('west').x > stopped.x + 0.3);
});

test('yellow blocks new entries while a car already across its stop line clears the junction', () => {
  const points = line(10, 8, 10, 12);
  const clearing = new TrafficController(); clearing.time = 3.45;
  clearing.sync(crossroads(), [vehicle('clearing', points, 1.18)]);
  const before = clearing.getPose('clearing').distance;
  clearing.step(0.3);
  assert.equal(clearing.getSignalInfo(10, 10).ns, 'yellow');
  assert(clearing.getPose('clearing').distance > before + 0.2);
  const arriving = new TrafficController(); arriving.time = 3.6;
  arriving.sync(crossroads(), [vehicle('arriving', points, 1.1)]);
  arriving.step(1.4);
  assert(Math.abs(arriving.getPose('arriving').distance - 1.17) < 1e-6);
  assert.equal(arriving.getPose('arriving').waiting, true);
});

test('opposing traffic phases preserve junction occupancy while turning cars clear', () => {
  const cars = [
    vehicle('north', [...line(10, 6, 10, 10), ...line(11, 10, 14, 10)], 2),
    vehicle('west', line(6, 10, 14, 10), 1.8),
    vehicle('east', line(6, 10, 14, 10), 2.4, true),
    vehicle('south', line(10, 6, 10, 14), 2.9, true),
  ];
  const c = controller(cars);
  let sawWaiting = false, sawCleared = false;
  for (let i = 0; i < 900; i++) {
    c.step(0.04);
    const poses = cars.map(car => c.getPose(car.id)).filter(p => p.visible);
    const inside = poses.filter(p => Math.abs(p.x - 10) + Math.abs(p.y - 10) < 0.825);
    assert(inside.length <= 1, 'only one representative owns the junction until its rear clears');
    sawWaiting ||= poses.some(p => p.waiting);
    sawCleared ||= poses.some(p => p.x > 11 || p.y > 11);
  }
  assert(sawWaiting && sawCleared);
});

test('adjacent T junctions reserve their overlapping conflict area together and cannot deadlock opposing cars', () => {
  const points = line(6, 10, 15, 10);
  const tiles = roadTiles([...points, { x: 10, y: 9 }, { x: 11, y: 11 }]);
  const c = controller([vehicle('east', points, 2.9), vehicle('west', points, 2.9, true)], tiles);
  assert.equal(c.signals.length, 2);
  assert.equal(c.signals[0].groupId, c.signals[1].groupId);
  let eastCrossed = false, westCrossed = false;
  for (let i = 0; i < 600; i++) {
    c.step(0.1);
    assert.equal(c.signals[0].phase, c.signals[1].phase);
    const east = c.getPose('east'), west = c.getPose('west');
    eastCrossed ||= east.visible && east.x > 14;
    westCrossed ||= west.visible && west.x < 7;
    const inCluster = [east, west].filter(p => p.visible && p.x > 9.171 && p.x < 11.829);
    assert(inCluster.length <= 1);
  }
  assert(eastCrossed && westCrossed, 'both directions can clear the complete cluster');
});

test('cars on different routes share a physical lane queue and never overtake a slower truck', () => {
  const cars = [
    vehicle('truck', line(2, 10, 22, 10), 10, false, 'freight'),
    vehicle('follower-a', line(4, 10, 22, 10), 7),
    vehicle('follower-b', line(6, 10, 22, 10), 4.35),
  ];
  const c = controller(cars, roadTiles(line(2, 10, 22, 10)));
  for (let i = 0; i < 250; i++) {
    c.step(0.04);
    const a = c.getPose('truck'), b = c.getPose('follower-a'), d = c.getPose('follower-b');
    assert(a.x - b.x >= 0.529 - 1e-6);
    assert(b.x - d.x >= 0.479 - 1e-6);
  }
});

test('a trip ending before a red-light queue respects the tail beyond its destination', () => {
  const c = controller([vehicle('queued', line(8, 10, 12, 10), 1.17), vehicle('short-trip', line(6, 10, 9, 10), 2.5)]);
  c.step(2);
  const head = c.getPose('queued'), tail = c.getPose('short-trip');
  assert(tail.visible);
  assert(head.x - tail.x >= 0.479);
  assert(tail.x < 9, 'the trip must wait before disappearing at its endpoint');
});

test('reverse cars stop on the correct approach and expose original-route distance plus actual direction', () => {
  const c = controller([vehicle('east', line(8, 10, 12, 10), 0, true)]);
  assert.equal(c.getPose('east').distance, 4);
  assert.equal(c.getPose('east').dx, -1);
  c.step(3);
  const stopped = c.getPose('east');
  assert(Math.abs(stopped.x - 10.83) < 1e-6);
  assert(Math.abs(stopped.distance - 2.83) < 1e-6);
  c.step(4);
  assert(c.getPose('east').x < stopped.x - 0.3);
});

test('zero dt freezes signals and cars; larger 3x time steps still obey the stop line', () => {
  const cars = [vehicle('west', line(8, 10, 12, 10))];
  const c = controller(cars);
  c.step(1);
  const pose = c.getPose('west'), signals = JSON.stringify(c.signals), time = c.time;
  for (let i = 0; i < 30; i++) c.step(0);
  assert.deepEqual(c.getPose('west'), pose); assert.equal(JSON.stringify(c.signals), signals); assert.equal(c.time, time);
  c.step(2);
  assert(Math.abs(c.getPose('west').x - 9.17) < 1e-6);
});

test('a completed route waits offscreen instead of looping into a standing queue', () => {
  const points = line(9, 10, 12, 10);
  const c = controller([vehicle('looping', points, 2.95), vehicle('queue', points, 0.17)]);
  c.step(0.15);
  assert.equal(c.getPose('looping').visible, false);
  c.step(4.5);
  assert.equal(c.getPose('looping').visible, false);
  assert.equal(c.getPose('queue').waiting, true);
  c.step(3);
  assert.equal(c.getPose('looping').visible, true);
  const first = c.getPose('queue'), second = c.getPose('looping');
  if (first.visible) assert(first.x - second.x >= 0.479);
});

test('sync preserves stable cars and clock, rebuilds changed roads, and removes invalid routes and reservations', () => {
  const tiles = crossroads(), car = vehicle('west', line(8, 10, 12, 10));
  const c = controller([car], tiles);
  c.step(2); const before = c.getPose('west'), time = c.time, originalKey = c.signalsKey;
  c.sync(tiles, [car]);
  assert.deepEqual(c.getPose('west'), before); assert.equal(c.time, time);
  const demolished = tiles.filter(t => !(t.x === 10 && t.y === 10));
  c.sync(demolished, [car]);
  assert.equal(c.getPose('west'), null);
  assert.equal(c.getSignalInfo(10, 10), null); assert.notEqual(c.signalsKey, originalKey);
  c.sync(tiles, [car]);
  assert(c.getPose('west')); assert.equal(c.signalsKey, originalKey);
  assert.equal(c.time, time);
});

test('the controller never mutates input city tiles or renderer actor definitions', () => {
  const tiles = crossroads(), cars = [vehicle('test', line(8, 10, 12, 10), 0.5)];
  const before = JSON.stringify({ tiles, cars });
  const c = controller(cars, tiles); c.step(20); c.sync(tiles, cars);
  assert.equal(JSON.stringify({ tiles, cars }), before);
});

test('demo routes maintain physical same-lane spacing across a full minute of signals, merges and looping', () => {
  const sim = new CitySimulation({ demo: true });
  const cars = sim.state.routes.filter(r => r.points.length > 1).slice(0, 100).map((route, i) => vehicle(i, route.points,
    (i * 0.618 % 1) * (route.points.length - 1), i % 2 === 1, route.kind === 'freight' ? 'freight' : 'car'));
  const c = controller(cars, sim.state.tiles);
  let waiting = 0;
  for (let frame = 0; frame < 1000; frame++) {
    c.step(0.06);
    const poses = cars.map(car => ({ ...c.getPose(car.id), kind: car.kind })).filter(p => p.visible);
    waiting = Math.max(waiting, poses.filter(p => p.waiting).length);
    for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) {
      const a = poses[i], b = poses[j];
      if (a.dx !== b.dx || a.dy !== b.dy) continue;
      const across = (a.x - b.x) * a.dy - (a.y - b.y) * a.dx;
      if (Math.abs(across) > 1e-6) continue;
      const gap = Math.abs((a.x - b.x) * a.dx + (a.y - b.y) * a.dy);
      const minimum = ((a.kind === 'freight' ? 0.45 : 0.35) + (b.kind === 'freight' ? 0.45 : 0.35)) / 2 + 0.13;
      assert(gap >= minimum - 1e-5, 'representatives on a shared physical lane never overlap');
    }
  }
  assert(waiting > 0, 'real queues form in the demo city');
});
