import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CitySimulation} from '../src/simulation.js';
import {CityRenderer} from '../src/renderer.js';
import {SERVICE_LAYERS,serviceLayerCell,buildingMatchesMapLayer,mapLayerBuildings} from '../src/map-layers.js';
import {calculateServiceCoverage} from '../src/service-coverage.js';
test('map layers use live coverage aliases and stop showing paused facilities',()=>{
 const s=new CitySimulation();
 const pairs=[['hospital','medical'],['school','education'],['grandGallery','culture'],['grandStadium','sports'],['districtOffice','civic'],['chapel','religion'],['buddhistTemple','religion'],['taoistTemple','religion'],['mosque','religion']];
 for(const [type,mode] of pairs){
  const b={id:1,type,x:10,y:20,active:true,progress:1,level:1,connected:true,powered:true,watered:true};
  s.state.buildings=type==='districtOffice'?[{id:2,type:'cityHall',x:63,y:63,active:true,progress:1,level:1,connected:true,powered:true,watered:true},b]:[b];calculateServiceCoverage(s.state);
  const t=s.tile(11,20);t.zone='residential';
  assert.equal(serviceLayerCell(mode,t).color,SERVICE_LAYERS[mode].color,type);
  b.active=false;calculateServiceCoverage(s.state);
  assert.deepEqual(serviceLayerCell(mode,t),{color:0xd98354,visible:true},type);
  assert.equal(serviceLayerCell(mode,s.tile(0,0)).visible,false);
 }
});

test('library coverage appears in both culture and education layers',()=>{
 const s=new CitySimulation(),library={id:1,type:'library',x:10,y:20,active:true,progress:1,level:2,connected:true,powered:true,watered:true};
 s.state.buildings=[library];calculateServiceCoverage(s.state);
 const tile=s.tile(11,20);
 assert.equal(serviceLayerCell('culture',tile).color,SERVICE_LAYERS.culture.color);
 assert.equal(serviceLayerCell('education',tile).color,SERVICE_LAYERS.education.color);
 assert(tile.services.spiritual);
 assert.equal(serviceLayerCell('religion',tile).visible,false,'secular spiritual support is not religious coverage');
 library.active=false;calculateServiceCoverage(s.state);
 assert.equal(serviceLayerCell('culture',tile).visible,false);
 assert.equal(serviceLayerCell('education',tile).visible,false);
});

test('each map domain identifies all corresponding facility buildings',()=>{
 const buildings=[
  {id:1,type:'power'},{id:2,type:'water'},{id:3,type:'industrial'},{id:4,type:'fireStation'},
  {id:5,type:'clinic'},{id:6,type:'hospital'},{id:7,type:'school'},{id:8,type:'library'},
  {id:9,type:'grandGallery'},{id:10,type:'sportsHall'},{id:11,type:'stadium'},{id:12,type:'grandStadium'},
  {id:13,type:'cityHall'},{id:14,type:'districtOffice'},{id:15,type:'park'},{id:16,type:'plaza'},
  {id:17,type:'flowerBed'},{id:18,type:'operaStage'},{id:19,type:'lighthouse'},{id:20,type:'residential'},
  {id:21,type:'commercial',businessKind:'pharmacy'},
  {id:22,type:'chapel'},{id:23,type:'buddhistTemple'},{id:24,type:'taoistTemple'},{id:25,type:'mosque',active:false},
 ];
 const ids=mode=>mapLayerBuildings({buildings},mode).map(b=>b.id);
 assert.deepEqual(ids('power'),[1]);assert.deepEqual(ids('water'),[2]);assert.deepEqual(ids('pollution'),[1,3]);assert.deepEqual(ids('fire'),[4]);
 assert.deepEqual(ids('medical'),[5,6,21]);assert.deepEqual(ids('education'),[7,8]);assert.deepEqual(ids('culture'),[8,9]);
 assert.deepEqual(ids('sports'),[10,11,12]);assert.deepEqual(ids('civic'),[13,14]);
 assert.deepEqual(ids('religion'),[22,23,24,25]);
 for(const id of [15,16,17,18,19])assert(ids('landscape').includes(id),`landscape ${id}`);
 assert.equal(buildingMatchesMapLayer('traffic',buildings[19]),false);
});

test('domain highlights build a strong fill, frame, roof ring and pointer for every matching facility',()=>{
 const renderer=Object.create(CityRenderer.prototype),geometries={box:new THREE.BoxGeometry(1,1,1),ring:new THREE.TorusGeometry(.5,.075,5,16),cone:new THREE.ConeGeometry(.5,1,8)};
 Object.assign(renderer,{state:{buildings:[{id:1,type:'power',x:4,y:5,level:1,progress:1},{id:2,type:'water',x:7,y:8,level:1,progress:1}]},overlay:'power',buildingFilter:null,roadFocus:false,layerBuildingHighlightKey:null,layerBuildingHighlightGroup:new THREE.Group(),geometries,_buildingVisualHeight:()=>1});
 renderer._buildLayerBuildingHighlights();
 assert.equal(renderer.layerBuildingHighlightGroup.children.length,4);
 assert.deepEqual(renderer.layerBuildingHighlightGroup.children.map(mesh=>mesh.count).sort((a,b)=>a-b),[1,1,1,12]);
 assert(renderer.layerBuildingHighlightGroup.children.some(mesh=>mesh.userData.highlightFill));
 assert.equal(renderer.layerBuildingHighlightGroup.children.filter(mesh=>mesh.userData.highlightLocator).length,2);
 renderer._clear(renderer.layerBuildingHighlightGroup);for(const geometry of Object.values(geometries))geometry.dispose();
});

 test('landscape unifies gardens, entertainment and beauty in one layer',()=>{
  assert.equal(SERVICE_LAYERS.leisure,undefined);assert.equal(SERVICE_LAYERS.park,undefined);
  for(const tile of [{amenity:8},{services:{park:true}},{services:{plaza:true}},{services:{entertainment:true},communityServices:{entertainment:4}}]){
   const cell=serviceLayerCell('landscape',tile);assert(cell.visible);assert.equal(cell.color,SERVICE_LAYERS.landscape.color);
  }
  assert.deepEqual(serviceLayerCell('landscape',{zone:'residential'}),{color:0xd98354,visible:true});
  assert.equal(serviceLayerCell('landscape',{}).visible,false);
  assert(serviceLayerCell('landscape',{amenity:12,communityServices:{entertainment:4}}).amount>serviceLayerCell('landscape',{amenity:12}).amount);
 });
