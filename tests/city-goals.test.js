import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CITY_GOALS,cityGoalsForMapSize,cityGoalProgress,latchCityGoal,newCityGoal} from '../src/city-goals.js';
import {CitySimulation} from '../src/simulation.js';

test('new cities offer three explicit long-term goals',()=>{
  assert.deepEqual(CITY_GOALS.map(goal=>goal.id),['population','reputation','livability']);
  assert.deepEqual(CITY_GOALS.map(goal=>goal.summary),[
    '将城市发展到 50,000 人','市长荣誉达到 Lv.8','达到 30,000 人且满意度达到 90%',
  ]);
});

test('each city scale offers goals calibrated to its expected capacity',()=>{
  assert.deepEqual(cityGoalsForMapSize(64).map(goal=>goal.summary),[
    '将城市发展到 50,000 人','市长荣誉达到 Lv.8','达到 30,000 人且满意度达到 90%',
  ]);
  assert.deepEqual(cityGoalsForMapSize(80).map(goal=>goal.summary),[
    '将城市发展到 80,000 人','市长荣誉达到 Lv.10','达到 60,000 人且满意度达到 91%',
  ]);
  assert.deepEqual(cityGoalsForMapSize(96).map(goal=>goal.summary),[
    '将城市发展到 120,000 人','市长荣誉达到 Lv.12','达到 100,000 人且满意度达到 92%',
  ]);
  assert.equal(cityGoalProgress({mapSize:80,month:1,cityGoal:newCityGoal('population'),stats:{population:79999},buildings:[]}).met,false);
  assert.equal(cityGoalProgress({mapSize:80,month:1,cityGoal:newCityGoal('population'),stats:{population:80000},buildings:[]}).met,true);
  assert.equal(cityGoalProgress({mapSize:96,month:1,cityGoal:newCityGoal('livability'),stats:{population:100000,happiness:91},buildings:[]}).met,false);
});

test('the selected goal persists while older saves receive the population goal',()=>{
  const city=new CitySimulation({cityGoal:'reputation'});
  assert.equal(city.state.cityGoal.id,'reputation');
  assert.deepEqual(CitySimulation.deserialize(city.serialize()).state.cityGoal,city.state.cityGoal);
  const legacy=JSON.parse(city.serialize());delete legacy.cityGoal;
  assert.deepEqual(CitySimulation.deserialize(JSON.stringify(legacy)).state.cityGoal,newCityGoal('population'));
  assert.throws(()=>new CitySimulation({cityGoal:'unknown'}),/未知城市目标/);
  const corrupt=JSON.parse(city.serialize());corrupt.cityGoal={id:'unknown',completed:false,completedMonth:null};
  assert.throws(()=>CitySimulation.deserialize(JSON.stringify(corrupt)));
});

test('population, honor and livability goals report and latch their own progress',()=>{
  const population={month:8,cityGoal:newCityGoal('population'),stats:{population:50000},buildings:[]};
  assert.equal(latchCityGoal(population).completed,true);assert.equal(population.cityGoal.completedMonth,8);

  const reputation={month:12,cityGoal:newCityGoal('reputation'),stats:{population:50000,happiness:100,employmentRate:100,income:1000,expenses:0},buildings:[{type:'lighthouse',progress:1},{type:'museum',progress:1}]};
  const honor=cityGoalProgress(reputation);assert.equal(honor.met,true);assert.equal(honor.currentLabel,'荣誉 Lv.8 / Lv.8');

  const livability={month:20,cityGoal:newCityGoal('livability'),stats:{population:30000,happiness:89},buildings:[]};
  assert.equal(cityGoalProgress(livability).met,false);
  livability.stats.happiness=90;assert.equal(latchCityGoal(livability).completed,true);assert.equal(livability.cityGoal.completedMonth,20);
});

test('previously completed honor goals stay complete after honor is recalculated',()=>{
 const city=new CitySimulation({cityGoal:'reputation'});city.state.month=1;
 city.state.cityGoal={id:'reputation',completed:true,completedMonth:1};
 const loaded=CitySimulation.deserialize(city.serialize());
 const goal=latchCityGoal(loaded.state);assert.equal(goal.met,false);assert.equal(goal.completed,true);assert.equal(goal.completedMonth,1);
});

test('new-city setup requires a goal confirmation and shows it in the city panel',async()=>{
  const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(source,/chosenCityGoal=null/);
  assert.match(source,/按此规模与目标创建城市/);
  assert.match(source,/terrain-start'\)\.disabled=!chosenCityGoal/);
  assert(source.indexOf('<section class="map-size-section"')<source.indexOf('<section class="city-goal-section"'));
  assert.match(source,/cityGoalsForMapSize\(chosenMapSize\)/);
  assert.match(source,/chosenMapSize=next;chosenCityGoal=null/);
  assert.match(html,/id="city-goal-card"/);
  assert.match(html,/id="identity-goal"/);
  assert.match(source,/当前任务 · 本局目标/);
  assert.match(source,/mayor-current-goal-progress/);
  assert.match(source,/goal\.completedMonth/);
  assert.match(source,/city:sim\.serializeCompact\(\)/);
});
