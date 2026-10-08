import test from 'node:test';
import assert from 'node:assert/strict';
import { wideRoadLayout, civicGardenGroups, boulevardLanes } from '../src/city-layout.js';
import { detectIntersections, TrafficController } from '../src/traffic-signals.js';
import { CitySimulation } from '../src/simulation.js';

const road = (x, y) => ({ x, y, road: 1, terrain: 'land' });
const strip = (vertical = false, width = 2) => Array.from({ length: 12 }, (_, x) => Array.from({ length: width }, (_, y) => vertical ? road(10 + y, 4 + x) : road(4 + x, 10 + y))).flat();

test('parallel roads become continuous wide streets in either direction without false signals', () => {
  for (const vertical of [false, true]) for (const width of [2, 3]) {
    const tiles = strip(vertical, width);
    const before = structuredClone(tiles);
    const layout = wideRoadLayout(tiles);
    assert.equal(layout.size, tiles.length);
    assert([...layout.values()].every(v => v.axis === (vertical ? 'ns' : 'ew') && v.max - v.min + 1 === width));
    assert.deepEqual(detectIntersections(tiles), []);
    assert.deepEqual(tiles, before);
  }
});

test('wide streets retain a shared signal at real T junctions and crossroads', () => {
  for (const vertical of [false, true]) {
    const transpose = t => vertical ? { ...t, x: t.y, y: t.x } : t;
    const tiles = [...strip(), road(8, 9), road(8, 8), road(8, 12), road(8, 13)].map(transpose);
    const c = new TrafficController(); c.sync(tiles, []);
    assert.equal(c.signals.length, 2);
    assert.equal(c.signals[0].groupId, c.signals[1].groupId);
    assert.equal(c.signals[0].phase, c.signals[1].phase);
    const tJunction = tiles.filter(t => vertical ? t.x < 12 : t.y < 12);
    assert.equal(detectIntersections(tJunction).length, 2);
  }
  const cross = [...new Map([...strip(), ...strip(true)].map(t => [`${t.x},${t.y}`, t])).values()];
  const c = new TrafficController(); c.sync(cross, []);
  assert.equal(c.signals.length, 4);
  assert.equal(new Set(c.signals.map(s => s.groupId)).size, 1);
});

test('demolition restores single roads while parallel bridge decks form a unified span', () => {
  const tiles = strip();
  assert.equal(wideRoadLayout(tiles.filter(t => t.y === 10)).size, 0);
  const bridges = tiles.map(t => ({ ...t, road: 2, bridge: true, terrain: 'water' }));
  const layout = wideRoadLayout(bridges);
  assert.equal(layout.size, bridges.length);
  assert([...layout.values()].every(v => v.bridge && v.overWater && v.fourLane));
  assert.deepEqual(detectIntersections(bridges), []);
});

test('vehicles can clear both directions of a wide-road junction', () => {
  const tiles = [...strip(), road(8, 8), road(8, 9), road(8, 12), road(8, 13)];
  const cars = [
    { id: 'along', points: Array.from({ length: 12 }, (_, i) => ({ x: 4 + i, y: 10 })) },
    { id: 'across', points: Array.from({ length: 6 }, (_, i) => ({ x: 8, y: 8 + i })) },
  ];
  const c = new TrafficController(); c.sync(tiles, cars);
  let along = false, across = false;
  for (let i = 0; i < 600; i++) {
    c.step(.1);
    along ||= c.getPose('along').x > 9;
    across ||= c.getPose('across').y > 12;
    assert.equal(c.signals[0].phase, c.signals[1].phase);
  }
  assert(along && across, 'neither road axis becomes stuck in the shared intersection');
});

const garden = (x, y, type = 'park') => ({ id: y * 64 + x, x, y, type, progress: 1 });
const square = (type = 'park') => [garden(4, 4, type), garden(5, 4, type), garden(4, 5, type), garden(5, 5, type)];

test('four matching gardens form one stable 2x2 landmark without changing the saved buildings', () => {
  for (const type of ['park', 'plaza']) {
    const buildings = square(type), before = structuredClone(buildings);
    const groups = civicGardenGroups(buildings);
    assert.equal(groups.size, 4);
    assert.equal(new Set(groups.values()).size, 1);
    assert.deepEqual(groups.get(buildings[0].id).members, buildings.map(b => b.id));
    assert.deepEqual(civicGardenGroups([...buildings].reverse()), groups);
    assert.deepEqual(buildings, before);
    assert.equal(civicGardenGroups(buildings.slice(1)).size, 0);
  }
});

test('mixed, incomplete and line-shaped gardens remain individual; larger clusters never overlap', () => {
  assert.equal(civicGardenGroups([...square().slice(0, 3), garden(5, 5, 'plaza')]).size, 0);
  assert.equal(civicGardenGroups(square().map((b, i) => ({ ...b, progress: i === 0 ? .5 : 1 }))).size, 0);
  assert.equal(civicGardenGroups([0, 1, 2, 3].map(x => garden(x, 4))).size, 0);
  const cluster = Array.from({ length: 4 }, (_, x) => [garden(x, 4), garden(x, 5)]).flat();
  const groups = civicGardenGroups(cluster);
  assert.equal(groups.size, 8);
  assert.equal(new Set(groups.values()).size, 2);
});

test('existing saves derive combined layouts and demolition/undo rebuilds them without migration', () => {
  const s = new CitySimulation();
  for (let x = 8; x <= 20; x++) for (const y of [31, 32]) assert(s.build('road', [{ x, y }]).ok);
  for (const x of [9, 10]) for (const y of [29, 30]) assert(s.build('park', [{ x, y }]).ok);
  const restored = CitySimulation.deserialize(s.serialize());
  assert.deepEqual(wideRoadLayout(restored.state.tiles), wideRoadLayout(s.state.tiles));
  assert.deepEqual(civicGardenGroups(restored.state.buildings), civicGardenGroups(s.state.buildings));
  assert.equal(civicGardenGroups(restored.state.buildings).size, 4);
  assert(restored.build('bulldoze', [{ x: 9, y: 29 }]).ok);
  assert.equal(civicGardenGroups(restored.state.buildings).size, 0);
  assert(restored.undo().ok);
  assert.equal(civicGardenGroups(restored.state.buildings).size, 4);
  assert.equal(restored.state.money, s.state.money);
});


test('a four-lane boulevard requires both parallel roads to be upgraded', () => {
  for (const vertical of [false, true]) {
    const tiles = strip(vertical);
    for (const t of tiles) if ((vertical ? t.x : t.y) === 10) t.road = 2;
    assert([...wideRoadLayout(tiles).values()].every(v => !v.fourLane));
    for (const t of tiles) t.road = 2;
    const layout = wideRoadLayout(tiles);
    assert([...layout.values()].every(v => v.fourLane));
    const pair = tiles.filter(t => (vertical ? t.y : t.x) === 8);
    const lanes = pair.map(t => boulevardLanes(t, layout.get(`${t.x},${t.y}`)));
    assert.equal(lanes[0].direction, -lanes[1].direction);
    assert.equal(lanes[0].direction, vertical ? 1 : -1);
    const centers = pair.flatMap((t, i) => lanes[i].centers.map(offset => (vertical ? t.x : t.y) + offset)).sort((a, b) => a - b);
    assert.equal(centers.length, 4);
    for (let i = 1; i < centers.length; i++) assert(Math.abs(centers[i] - centers[i - 1] - .43) < 1e-9);
    assert(centers[1] < 10.5 && centers[2] > 10.5, 'two lanes on each side of the shared centerline');
    pair[0].road = 1;
    assert.equal(wideRoadLayout(tiles).get(`${pair[1].x},${pair[1].y}`).fourLane, false);
  }
});
