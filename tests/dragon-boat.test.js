import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {dragonWinner} from '../src/dragon-boat.js';
const june=()=>{const s=new CitySimulation();s.state.month=6;s.state.tick=75;return s;};
test('annual race settles once, keeps city money and RNG unchanged, and survives saves',()=>{
 const s=june(),money=s.state.money,rng=s.state.rng,winner=dragonWinner(s.state.seed,1);
 assert(s.enterDragonRace(winner,100).ok);assert.equal(s.state.festivalGames.points,1200);
 assert.equal(s.state.money,money);assert.equal(s.state.rng,rng);assert.equal(s._undo,null);
 assert(!s.enterDragonRace(winner,100).ok);
 const copy=CitySimulation.deserialize(s.serialize());assert.deepEqual(copy.state.festivalGames,s.state.festivalGames);
 assert(!copy.enterDragonRace(winner,100).ok);
 copy.state.month=18;copy.state.tick=255;assert(copy.enterDragonRace(0,50).ok);
});
test('losing bets deduct only the stake; invalid bets and out-of-season requests cannot mutate state',()=>{
 const s=june(),winner=dragonWinner(s.state.seed,1);
 const before=s.serialize();
 for(const [team,stake] of [[-1,50],[3,50],[1.5,50],[0,-100],[0,51],[0,NaN]])assert(!s.enterDragonRace(team,stake).ok);
 assert.equal(s.serialize(),before);
 assert(s.enterDragonRace((winner+1)%3,200).ok);assert.equal(s.state.festivalGames.points,800);
 const fresh=new CitySimulation();assert(!fresh.enterDragonRace(0,50).ok);
});
test('old saves start with free points and invalid race ledgers are rejected',()=>{
 const s=june(),raw=JSON.parse(s.serialize());delete raw.festivalGames;
 assert.equal(CitySimulation.deserialize(JSON.stringify(raw)).state.festivalGames.points,1000);
 s.enterDragonRace(0,50);const race=JSON.parse(s.serialize());race.festivalGames.points++;
 assert.throws(()=>CitySimulation.deserialize(JSON.stringify(race)));
 const race2=JSON.parse(s.serialize());race2.festivalGames.lastRace.year=2;
 assert.throws(()=>CitySimulation.deserialize(JSON.stringify(race2)));
});
