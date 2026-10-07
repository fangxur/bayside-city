import test from 'node:test';
import assert from 'node:assert/strict';
import {celebrationSnapshot,reachedCelebrations,celebrationMarkup} from '../src/milestone-celebration.js';
const snapshot=(population,milestones={})=>({population,milestones});
test('new achievements are ordered and completed stages never repeat',()=>{
 const state={bridge:true,density:true,landmark:true,completed:true};
 assert.deepEqual(reachedCelebrations(snapshot(2000,{bridge:true}),snapshot(2000,state)).map(s=>s.population),[1000,2000]);
 assert.deepEqual(reachedCelebrations(snapshot(2000,state),snapshot(2000,state)),[]);
 assert.deepEqual(reachedCelebrations(snapshot(20),snapshot(20,{named:true})),[]);
});
test('celebration displays actual unlocks and escapes city names',()=>{
 const [stage]=reachedCelebrations(snapshot(2000),snapshot(2000,{landmark:true}));const html=celebrationMarkup(stage,'<测试城>');
 assert(html.includes('2,000'));assert(html.includes('河湾之帆'));assert(html.includes('&lt;测试城&gt;'));assert(!html.includes('<测试城>'));
 assert(html.includes('milestone-continue'));
});
test('the one-thousand celebration announces power and water upgrades',()=>{
 const [stage]=reachedCelebrations(snapshot(1000),snapshot(1000,{density:true}));const html=celebrationMarkup(stage,'湾畔市');
 assert(html.includes('供电'));assert(html.includes('供水'));assert(html.includes('1,000'));
});
test('later population celebrations fire immediately without waiting for domain coordination',()=>{
 const stages=reachedCelebrations(snapshot(4999,{landmark:true}),snapshot(10001,{landmark:true}));
 assert.deepEqual(stages.map(stage=>stage.population),[5000,10000]);
 assert(stages.every(stage=>stage.populationTriggered&&stage.street));
 assert.deepEqual(reachedCelebrations(snapshot(5000,{landmark:true}),snapshot(5000,{landmark:true,metropolis:true})),[]);
 const html=celebrationMarkup(stages[0],'湾畔市');
 assert(html.includes('三级道路已开放'));assert(html.includes('领域协同后开放三级建筑升级'));assert(!html.includes('听风古塔'));
});
test('every late population stage celebrates while twenty and fifty thousand use grand fireworks',()=>{
 const stages=reachedCelebrations(snapshot(19999),snapshot(50000));
 assert.deepEqual(stages.map(stage=>stage.population),[20000,30000,40000,50000]);
 assert.deepEqual(stages.filter(stage=>stage.fireworks==='grand').map(stage=>stage.population),[20000,50000]);assert(stages.every(stage=>stage.street));
 const html=celebrationMarkup(stages[0],'湾畔市');assert(html.includes('全城烟花庆典'));assert(html.includes('🎆'));
});
test('celebration snapshots copy population and milestone state',()=>{
 const state={stats:{population:5000},milestones:{landmark:true}},copy=celebrationSnapshot(state);
 state.stats.population=6000;state.milestones.landmark=false;
 assert.deepEqual(copy,{population:5000,milestones:{landmark:true}});
});
