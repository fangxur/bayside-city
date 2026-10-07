import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';
import { ROAD_TIERS, roadUpgradeOffer, roadLevelForPopulation, unlockedRoadLevel } from '../src/progression.js';
import { boulevardLanes, wideRoadLayout } from '../src/city-layout.js';

test('roads unlock seven stages, charge each upgrade once and retain capacity and names on load', () => {
  const s = new CitySimulation();
  const cells = [1, 2, 3, 4].map(x => ({ x, y: 32 }));
  assert.equal(s.preview('upgrade', cells).valid, false);
  for (const [population, level, cost] of [[1000, 2, 30], [5000, 3, 65], [10000, 4, 120], [20000, 5, 220], [50000, 6, 380], [60000, 7, 650]]) {
    assert.equal(roadUpgradeOffer(s.tile(1, 32), s.state).allowed, false);
    s.state.stats.population=population;s.state.roadLevelUnlocked=roadLevelForPopulation(population);
    const snapshot = s.serialize(), money = s.state.money;
    assert.equal(s.preview('upgrade', [...cells, cells[0]], { roadsOnly: true }).cost, cost * 4);
    assert.equal(s.serialize(), snapshot);
    assert(s.build('upgrade', [...cells, cells[0]], { roadsOnly: true }).ok);
    assert.equal(s.state.money, money - cost * 4);
    for (const c of cells) {
      assert.equal(s.tile(c.x, c.y).road, level);
      assert.equal(s.tile(c.x, c.y).trafficCapacity, ROAD_TIERS[level].capacity);
      assert.equal(s.getInfo(c.x, c.y).title, ROAD_TIERS[level].name);
    }
    const loaded = CitySimulation.deserialize(s.serialize());
    assert.equal(loaded.tile(1, 32).road, level);
    assert.equal(loaded.tile(1, 32).trafficCapacity, ROAD_TIERS[level].capacity);
    assert(s.undo().ok); assert.equal(s.serialize(), snapshot);
    assert(s.build('upgrade', cells, { roadsOnly: true }).ok);
  }
  const maxed = s.serialize();
  assert.equal(s.build('upgrade', cells, { roadsOnly: true }).ok, false);
  assert.equal(s.serialize(), maxed);
  const raw = JSON.parse(maxed); raw.tiles[32 * 64 + 1].road = 8;
  assert.throws(() => CitySimulation.deserialize(JSON.stringify(raw)));
});

test('mixed-level strokes respect population locks and funds without partial edits', () => {
  const s = new CitySimulation(); s.state.roadLevelUnlocked = 2;
  assert(s.build('upgrade', [{ x: 1, y: 32 }]).ok);
  const cells = [1, 2, 3].map(x => ({ x, y: 32 }));
  assert.equal(s.preview('upgrade', cells, { roadsOnly: true }).cost, 60);
  s.state.roadLevelUnlocked = 3;
  assert.equal(s.preview('upgrade', cells, { roadsOnly: true }).cost, 125);
  s.state.money = 124; const before = s.serialize();
  assert.equal(s.build('upgrade', cells, { roadsOnly: true }).ok, false);
  assert.equal(s.serialize(), before);
});

test('paired avenues use four or six marked lanes outside the median and reconcile mixed grades', () => {
  for (const vertical of [false, true]) for (const level of [3, 4, 5, 6, 7]) {
    const tiles = Array.from({ length: 10 }, (_, i) => [0, 1].map(lane => ({ x: vertical ? 8 + lane : 5 + i, y: vertical ? 5 + i : 8 + lane, road: level, terrain: 'land' }))).flat();
    const layout = wideRoadLayout(tiles);
    const pair = tiles.slice(4, 6);
    const halves = pair.map(t => boulevardLanes(t, layout.get(`${t.x},${t.y}`)));
    assert.equal(halves[0].centers.length,level>=5?3:2);
    assert.equal(halves[0].dividers.length,level>=5?2:1);
    assert.equal(halves[0].median, level === 3 ? .1 : .14);
    assert.equal(halves[0].direction, -halves[1].direction);
    for (let i = 0; i < 2; i++) for (const center of halves[i].centers) {
      const absolute = (vertical ? pair[i].x : pair[i].y) + center;
      assert(Math.abs(absolute - 8.5) > halves[i].median / 2 + .1);
      assert(absolute > 7.64 && absolute < 9.36);
    }
    pair[0].road = 2;
    const mixed = wideRoadLayout(tiles).get(`${pair[1].x},${pair[1].y}`);
    assert.equal(mixed.level, 2);
    assert.equal(boulevardLanes(pair[1], mixed).median, 0);
  }
});

test('late roads reduce real commute pressure and seventh-level bridges survive saves',()=>{
 const s=new CitySimulation();s.state.money=100000;
 for(let x=0;x<28;x++)s.tile(x,32).road=4;
 for(const [type,x] of [['power',1],['water',2],...Array.from({length:8},(_,i)=>['residential',3+i]),...Array.from({length:6},(_,i)=>['industrial',18+i])]){
  const b=s._newBuilding(x,31,type,true);b.level=6;if(type==='residential')b.population=333;
 }
 s.recalculate();
 const commute=()=>s.state.buildings.filter(b=>b.type==='residential').reduce((sum,b)=>sum+b.commute,0);
 const before=commute(),congested=s.state.tiles.filter(t=>t.road&&t.traffic>80).length;
 s.state.roadLevelUnlocked=7;
 const roads=s.state.tiles.filter(t=>t.road).map(t=>({x:t.x,y:t.y}));
 assert(s.build('upgrade',roads,{roadsOnly:true}).ok);assert(s.build('upgrade',roads,{roadsOnly:true}).ok);assert(s.build('upgrade',roads,{roadsOnly:true}).ok);
 assert(commute()<before);assert(s.state.tiles.filter(t=>t.road&&t.traffic>80).length<congested);
 const river=s.state.tiles.find(t=>t.terrain==='water');river.bridge=true;river.road=4;s.recalculate();
 assert(s.build('upgrade',[river],{roadsOnly:true}).ok);assert(s.build('upgrade',[river],{roadsOnly:true}).ok);assert(s.build('upgrade',[river],{roadsOnly:true}).ok);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.tile(river.x,river.y).road,7);assert.equal(copy.tile(river.x,river.y).trafficCapacity,1000);assert(copy.tile(river.x,river.y).bridge);
});

test('the seventh road level unlocks at sixty thousand residents',()=>{
 const s=new CitySimulation();s.tile(1,32).road=6;
 s.state.stats.population=59999;s.state.roadLevelUnlocked=roadLevelForPopulation(59999);
 let offer=roadUpgradeOffer(s.tile(1,32),s.state);assert(!offer.allowed);assert.match(offer.reason,/60,000/);
 s.state.stats.population=60000;s.state.roadLevelUnlocked=roadLevelForPopulation(60000);
 offer=roadUpgradeOffer(s.tile(1,32),s.state);assert(offer.allowed);assert.equal(offer.nextLevel,7);assert.equal(offer.cost,650);assert.equal(ROAD_TIERS[7].capacity,1000);
});

test('five thousand residents open third-level roads without domain coordination',()=>{
 const s=new CitySimulation();s.tile(1,32).road=2;s.state.stats.population=5000;
 assert.equal(s.state.milestones.metropolis,false);
 const offer=roadUpgradeOffer(s.tile(1,32),s.state);
 assert(offer.allowed);assert.equal(offer.nextLevel,3);assert.equal(offer.cost,65);
 assert(s.preview('upgrade',[{x:1,y:32}],{roadsOnly:true}).valid);
});

test('population road unlocks latch and older saves retain previously earned road tiers',()=>{
 const s=new CitySimulation(),home=s._newBuilding(1,31,'residential',true);home.population=5000;s.recalculate();
 assert.equal(s.state.roadLevelUnlocked,3);home.population=0;s.recalculate();assert.equal(unlockedRoadLevel(s.state),3);
 const legacy=new CitySimulation(),raw=JSON.parse(legacy.serialize());delete raw.roadLevelUnlocked;
 Object.assign(raw.milestones,{density:true,metropolis:true});
 const loaded=CitySimulation.deserialize(JSON.stringify(raw));assert.equal(unlockedRoadLevel(loaded.state),3);
});
