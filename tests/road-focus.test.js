import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
test('road focus hides obstructions, preserves traffic overlay, and restores scene visibility',()=>{
 const r=Object.create(CityRenderer.prototype);let rebuilt=0;
 Object.assign(r,{state:{},renderer:{shadowMap:{}},_buildCity(){rebuilt++;},_buildOverlay(){},overlay:'medical',overlayGroup:{visible:true},coverageGroup:{visible:true},signalGroup:{visible:true},civicEffects:{visible:true},dynamicMeshes:[{visible:true}]});
 r.setRoadFocus(true);assert.equal(rebuilt,1);
 for(const group of [r.overlayGroup,r.coverageGroup,r.signalGroup,r.civicEffects,...r.dynamicMeshes])assert.equal(group.visible,false);
 r.setRoadFocus(true);assert.equal(rebuilt,1);
 r.setOverlay('traffic');assert(r.overlayGroup.visible);r.setOverlay('medical');assert(!r.overlayGroup.visible);
 r.setRoadFocus(false);assert.equal(rebuilt,2);
 for(const group of [r.overlayGroup,r.coverageGroup,r.signalGroup,r.civicEffects,...r.dynamicMeshes])assert.equal(group.visible,true);
 assert.equal(r.overlay,'medical');
});
