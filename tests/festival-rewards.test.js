import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {dragonWinner} from '../src/dragon-boat.js';
const checkSave=s=>assert.deepEqual(CitySimulation.deserialize(s.serialize()).state.festivalGames,s.state.festivalGames);
test('festival grants and permanent decorations persist across races, saves and repeated selections',()=>{
 const s=new CitySimulation(),money=s.state.money;
 assert(s.claimFestivalPoints().ok);assert(!s.claimFestivalPoints().ok);checkSave(s);
 assert(s.redeemFestivalReward('bunting').ok);assert.equal(s.state.festivalGames.points,900);checkSave(s);
 assert(s.redeemFestivalReward('bunting').ok);assert.equal(s.state.festivalGames.decoration,null);
 assert.equal(s.state.festivalGames.points,900);
 s.state.month=6;s.state.tick=75;
 assert(s.enterDragonRace(dragonWinner(s.state.seed,1),100).ok);checkSave(s);
 assert(s.claimFestivalPoints().ok);assert(s.redeemFestivalReward('lanterns').ok);checkSave(s);
 assert.equal(s.state.festivalGames.points,900);
 assert.equal(s.state.money,money);assert.equal(s.undo().ok,false);
 s.state.month=18;s.state.tick=255;
 assert(s.enterDragonRace(0,50).ok);checkSave(s);
});
test('reward requests reject invalid choices, insufficient points, duplicates and corrupt saves',()=>{
 const s=new CitySimulation();
 s.state.month=7;s.state.tick=90;
 const before=s.serialize();assert(!s.claimFestivalPoints().ok);assert(!s.redeemFestivalReward('unknown').ok);assert.equal(s.serialize(),before);
 s.state.festivalGames.points=0;assert(!s.redeemFestivalReward('bunting').ok);
 const clean=new CitySimulation();clean.claimFestivalPoints();clean.redeemFestivalReward('bunting');
 for(const edit of [g=>g.points++,g=>g.claims.push(1),g=>g.claims.push(4),g=>g.rewards.push('unknown'),g=>g.rewards.push('bunting'),g=>g.decoration='lanterns']){
  const raw=JSON.parse(clean.serialize());edit(raw.festivalGames);assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
 }
});
test('pre-reward saves with a settled race migrate without changing points',()=>{
 const s=new CitySimulation();s.state.month=6;s.state.tick=75;s.enterDragonRace(0,50);
 const raw=JSON.parse(s.serialize());
 for(const key of ['claims','rewards','decoration'])delete raw.festivalGames[key];
 delete raw.festivalGames.lastRace.claimsBefore;delete raw.festivalGames.lastRace.spentBefore;
 const loaded=CitySimulation.deserialize(JSON.stringify(raw));assert.equal(loaded.state.festivalGames.points,s.state.festivalGames.points);
 assert(loaded.claimFestivalPoints().ok);assert(loaded.redeemFestivalReward('lanterns').ok);checkSave(loaded);
});
