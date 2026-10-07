import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesBuildingFilter} from '../src/building-filter.js';
test('commercial focus includes shops and commercial complexes, and excludes other facilities',()=>{
 for(const b of [{type:'commercial',businessKind:'tavern'},{type:'commercial',businessKind:'office'},{type:'shoppingComplex'}])assert(matchesBuildingFilter(b,'commercial'));
 for(const type of ['residential','industrial','chapel','cityHall','park'])assert(!matchesBuildingFilter({type},'commercial'));
 assert(!matchesBuildingFilter(undefined,'commercial'));
 assert(matchesBuildingFilter({type:'park'},null));
 assert(matchesBuildingFilter({type:'residential'},'residential'));
 assert(matchesBuildingFilter({type:'industrial'},'industrial'));
 assert(matchesBuildingFilter({type:'power'},'industrial'));
 assert(matchesBuildingFilter({type:'water'},'industrial'));
 assert(!matchesBuildingFilter({type:'cityHall'},'industrial'));
});
