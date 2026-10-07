import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {developmentSummary} from '../src/city-demand.js';

test('development guidance distinguishes missing zoning, disconnected roads, utilities and low demand',()=>{
 const details={summary:'空置住房压力',sites:{total:0,ready:0,road:0,power:0,water:0}};
 assert.match(developmentSummary(52,details),/规划临路分区/);
 details.sites={total:6,ready:0,road:3,power:2,water:1};
 assert.equal(developmentSummary(52,details),'等待开工 · 3 格缺连通道路、2 格缺电、1 格缺水');
 assert.equal(developmentSummary(0,details),'空置住房压力');
 details.sites.ready=1;assert.match(developmentSummary(52,details),/1 格可开工/);
});

test('polluted occupied homes and disconnected vacant zones produce actionable map alerts',()=>{
 const s=new CitySimulation();s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
 const home=s._newBuilding(5,31,'residential',true);home.population=8;
 const factory=s._newBuilding(6,31,'industrial',true),second=s._newBuilding(4,31,'industrial',true);s.recalculate();
 const alert=s.state.stats.alerts.find(a=>a.text.includes('较重污染'));
 assert(alert);assert.deepEqual([alert.x,alert.y],[home.x,home.y]);assert(s.getInfo(alert.x,alert.y).problem.includes('污染'));
 assert(s.build('bulldoze',[factory,second]).ok);assert(!s.state.stats.alerts.some(a=>a.text.includes('较重污染')));
 s.tile(15,21).road=1;s.recalculate();
 assert(s.build('residential',[{x:15,y:20}]).ok);
 const blocked=s.state.stats.alerts.find(a=>a.text.includes('已规划分区缺少'));
 assert(blocked);assert.deepEqual([blocked.x,blocked.y],[15,20]);
});

test('long commutes that prevent further migration explain the stalled home and point to the population road unlock',()=>{
 const s=new CitySimulation();s.build('road',Array.from({length:25},(_,i)=>({x:i+7,y:32})));
 s.build('power',[{x:1,y:31}]);s.build('water',[{x:2,y:31}]);
 for(let x=24;x>=8;x--)for(const y of [31,33]){const b=s._newBuilding(x,y,'residential',true);b.population=8;}
 for(let x=25;x<=31;x++)for(const y of [31,33])s._newBuilding(x,y,'industrial',true);
 s.recalculate();
 const warning=s.state.stats.alerts.find(a=>a.text.includes('暂停入住'));
 assert(warning);const info=s.getInfo(warning.x,warning.y);assert.equal(info.problem,'通勤时间过长');
 assert(s.state.stats.alerts.some(a=>a.text.includes('人口达到 1,000 后可升级')));
});
