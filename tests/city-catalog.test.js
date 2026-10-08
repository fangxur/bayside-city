import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS_KINDS} from '../src/business-kinds.js';
import {COMMUNITY_BUILDINGS} from '../src/community-buildings.js';
import {DECORATIONS} from '../src/decorations.js';
import {LANDMARKS} from '../src/landmarks.js';
import {YACHT_TYPES} from '../src/marina.js';
import {CitySimulation} from '../src/simulation.js';
import {catalogPreview,cityCatalog} from '../src/city-catalog.js';

test('the city catalog covers every building family and every visible vehicle type',()=>{
  const sim=new CitySimulation(),before=JSON.stringify(sim.state),catalog=cityCatalog(sim.state);
  const expectedBuildings=11+Object.keys(BUSINESS_KINDS).length+Object.keys(COMMUNITY_BUILDINGS).length+Object.keys(DECORATIONS).length+Object.keys(LANDMARKS).length;
  assert.equal(catalog.buildings.length,expectedBuildings);
  assert.equal(catalog.vehicles.length,13+Object.keys(YACHT_TYPES).length);
  for(const id of ['vehicle:compact','vehicle:hatchback','vehicle:suv','vehicle:taxi','vehicle:minivan','vehicle:pickup','vehicle:delivery-van'])assert(catalog.vehicles.some(item=>item.id===id),id);
  assert.equal(new Set([...catalog.buildings,...catalog.vehicles].map(item=>item.id)).size,catalog.total);
  assert.equal(catalog.buildings.find(item=>item.id==='building:residential').maxLevel,6);
  assert.equal(catalog.buildings.find(item=>item.id==='decoration:citySculpture').maxLevel,1);
  assert.equal(catalog.buildings.find(item=>item.id==='landmark:eiffelTower').maxLevel,3);
  assert.equal(catalog.buildings.find(item=>item.id==='community:marina').maxLevel,6);
  assert.equal(catalog.buildings.find(item=>item.id==='building:cityHall').footprint,2);
  assert.equal(catalog.buildings.find(item=>item.id==='community:districtOffice').footprint,1);
  for(const type of ['chessPavilion','operaStage','marina'])assert.equal(catalog.buildings.find(item=>item.id===`community:${type}`).category,'commercial',type);
  assert.equal(JSON.stringify(sim.state),before,'opening the catalog is read only');
});

test('catalog unlocks follow live population, milestones, suppliers and service facilities',()=>{
  const sim=new CitySimulation();
  let catalog=cityCatalog(sim.state);
  assert.equal(catalog.buildings.find(item=>item.id==='community:hospital').unlocked,false);
  assert.equal(catalog.buildings.find(item=>item.id==='landmark:lighthouse').unlocked,false);
  assert.equal(catalog.buildings.find(item=>item.id==='business:cafe').unlocked,false);
  assert.equal(catalog.vehicles.find(item=>item.id==='vehicle:ambulance').unlocked,false);
  assert.equal(catalog.vehicles.find(item=>item.id==='vehicle:fire-engine').unlocked,false);

  sim.state.stats.population=20000;sim.state.milestones.bridge=true;
  const factory=sim._newBuilding(10,10,'industrial',true);Object.assign(factory,{businessKind:'foodFactory',active:true,connected:true,powered:true,watered:true});
  const clinic=sim._newBuilding(12,10,'clinic',true);Object.assign(clinic,{active:true,connected:true,powered:true,watered:true});
  const station=sim._newBuilding(14,10,'fireStation',true);Object.assign(station,{active:true,connected:true,powered:true,watered:true});
  catalog=cityCatalog(sim.state);
  assert.equal(catalog.buildings.find(item=>item.id==='community:hospital').unlocked,true);
  assert.equal(catalog.buildings.find(item=>item.id==='landmark:lighthouse').unlocked,true);
  assert.equal(catalog.buildings.find(item=>item.id==='business:cafe').unlocked,true);
  assert.equal(catalog.vehicles.find(item=>item.id==='vehicle:ambulance').unlocked,true);
  assert.equal(catalog.vehicles.find(item=>item.id==='vehicle:fire-engine').unlocked,true);
});

test('every catalog card has a finite, isolated preview using its real model identity',()=>{
  const catalog=cityCatalog(new CitySimulation().state);
  for(const entry of [...catalog.buildings,...catalog.vehicles]){
    const preview=catalogPreview(entry);
    assert.equal(preview.state.tiles.length,64*64,entry.id);
    assert(Number.isFinite(preview.focus.x)&&Number.isFinite(preview.focus.y)&&Number.isFinite(preview.viewSize),entry.id);
    if(entry.preview.kind==='building'){
      assert.equal(preview.state.buildings.length,1,entry.id);
      assert.equal(preview.state.buildings[0].type,entry.preview.type,entry.id);
      assert.equal(preview.state.buildings[0].businessKind,entry.preview.businessKind,entry.id);
      assert(preview.state.tiles.every(tile=>!tile.road),`${entry.id} building preview should not include roads`);
      const highest=catalogPreview(entry,99);
      assert.equal(highest.state.buildings[0].level,entry.maxLevel,entry.id);
      assert.equal(highest.level,entry.maxLevel,entry.id);
      if(COMMUNITY_BUILDINGS[entry.preview.type]?.architecture==='cathedral'){
        assert.deepEqual(highest.focus,preview.focus,'cathedral renovations preserve the silhouette');
        assert.equal(highest.viewSize,preview.viewSize);
      }else if(entry.maxLevel>1){
        assert(highest.viewSize>preview.viewSize,`${entry.id} high-level preview should zoom out`);
        assert(highest.focus.elevation>preview.focus.elevation,`${entry.id} high-level preview should frame upward`);
      }
    }else if(entry.preview.kind==='roadVehicle'){
      assert.equal(preview.state.catalogRoadsHidden,true,entry.id);
      assert.equal(preview.viewSize,1.35,entry.id);
      assert.equal(preview.focus.elevation,.20,entry.id);
      assert.equal(preview.state.routes[0].kind,entry.sourceKind||entry.preview.vehicleKind,entry.id);
      assert.equal(preview.state.routes[0].vehicleKind,entry.preview.vehicleKind,entry.id);
      assert(preview.state.routes[0].points.every(point=>preview.state.tiles[point.y*64+point.x].road),entry.id);
    }else assert.equal(preview.state.marinaLife.boats[0].kind,entry.preview.yachtKind,entry.id);
  }
});
