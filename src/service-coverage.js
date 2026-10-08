import {policeCoverageCells,servedBusStops} from './network-services.js';
import { DECORATIONS } from './decorations.js';
import { COMMUNITY_BUILDINGS, communityService } from './community-buildings.js';
import { LANDMARKS } from './landmarks.js';
import { gardenRadius, utilityCapacity } from './progression.js';
import { civicBuildingReady, civicServiceReady, fireRange, fireStationCells } from './city-services.js';
import {civicGardenGroups} from './city-layout.js';
import {gridIndex} from './grid.js';
import {businessKind} from './business-kinds.js';
export const SERVICE_LABELS={policeStation:'治安',busStop:'公交',spiritual:'精神慰藉',gothicCathedral:'精神慰藉',domedCathedral:'精神慰藉',chapel:'精神慰藉',buddhistTemple:'精神慰藉',taoistTemple:'精神慰藉',mosque:'精神慰藉',marina:'滨水休闲',districtOffice:'市政服务',grandStadium:'体育',grandGallery:'文化',shoppingComplex:'商业配套',shopping:'商业配套',entertainment:'休闲娱乐',operaStage:'戏曲娱乐',chessPavilion:'邻里休闲',hospital:'医疗',stadium:'体育',clinic:'医疗',fireStation:'消防',school:'教育',sportsHall:'体育',library:'文化',park:'休闲景观',plaza:'喷泉广场',cityHall:'市政服务',power:'电力',water:'供水'};
export function serviceDefinition(state,b){
 if(DECORATIONS[b.type])return {radius:DECORATIONS[b.type].radius,label:'景观环境',garden:true};
 if(COMMUNITY_BUILDINGS[b.type])return {radius:communityService(b).radius,label:COMMUNITY_BUILDINGS[b.type].coverageLabel||SERVICE_LABELS[b.type],roads:!!COMMUNITY_BUILDINGS[b.type].roadService};
 const privateKind=businessKind(b.businessKind);
 if(privateKind?.service)return {radius:(privateKind.serviceRadius||4)+Math.max(0,(b.level||1)-1)*(privateKind.serviceRadiusGrowth||1),label:privateKind.serviceLabel||SERVICE_LABELS[privateKind.service],service:privateKind.service,staffed:true};
 if(['park','plaza'].includes(b.type))return {radius:gardenRadius(b),label:SERVICE_LABELS[b.type],garden:true};
 if(b.type==='cityHall')return {radius:10+2*((b.level||1)-1),label:'市政'};
 if(b.type==='fireStation')return {radius:fireRange(state,b),label:'消防',roads:true};
 if(['power','water'].includes(b.type))return {label:SERVICE_LABELS[b.type],network:true};
 if(LANDMARKS[b.type])return {radius:gardenRadius(b),label:'名胜环境',landmark:true};
 return null;
}
export function calculateServiceCoverage(state){
 const busStops=new Set(servedBusStops(state).map(b=>b.id));
 for(const t of state.tiles){t.services={};t.serviceLevels={};}
 for(const b of state.buildings){
  const def=serviceDefinition(state,b);b.coverageCells=[];b.coverageDescription='';
  if(!def)continue;
  b.coverageDescription=def.network?'连通道路网络，受总容量限制':def.roads?`沿道路 ${def.radius} 格`:`半径 ${def.radius} 格`;
  const ready=def.network?b.active&&b.connected&&b.powered&&utilityCapacity(b)>0:def.garden?b.active&&b.progress>=1:def.landmark?b.active&&b.connected&&b.progress>=1:civicServiceReady(state,b)&&(!def.staffed||(b.workers||0)>0);
  if(!ready||(b.type==='busStop'&&!busStops.has(b.id)))continue;
  if(def.roads)b.coverageCells=b.type==='policeStation'?policeCoverageCells(state,b):fireStationCells(state,b);
  else b.coverageCells=state.tiles.filter(t=>{
   if(t.terrain!=='land')return false;
   if(def.network)return t.connected&&(b.type==='power'?t.powered:t.watered);
   const d=Math.hypot(t.x-b.x,t.y-b.y);
   return def.garden||def.landmark?d<def.radius:d<=def.radius;
  }).map(t=>gridIndex(state,t.x,t.y));
  for(const i of b.coverageCells){
   const tile=state.tiles[i],level=b.level||1;tile.services[b.type]=true;tile.serviceLevels[b.type]=Math.max(tile.serviceLevels[b.type]||0,level);
   // Every item in the leisure-landscape palette provides the same umbrella
   // service used by residential upgrades. Radius and beauty remain specific
   // to each item, so small decorations usually need to be combined.
   if(def.garden){tile.services.park=true;tile.serviceLevels.park=Math.max(tile.serviceLevels.park||0,level);}
   const category=def.service||COMMUNITY_BUILDINGS[b.type]?.service;if(category){tile.services[category]=true;tile.serviceLevels[category]=Math.max(tile.serviceLevels[category]||0,level);}
   for(const alias of COMMUNITY_BUILDINGS[b.type]?.serviceAliases||[]){tile.services[alias]=true;tile.serviceLevels[alias]=Math.max(tile.serviceLevels[alias]||0,level);}
   if(['park','plaza','library','grandGallery'].includes(b.type)){tile.services.spiritual=true;tile.serviceLevels.spiritual=Math.max(tile.serviceLevels.spiritual||0,level);}
  }
 }
 for(const b of state.buildings){
  const t=state.tiles[gridIndex(state,b.x,b.y)];b.services={...t.services,fireStation:!!b.fireCovered};b.serviceLevels={...t.serviceLevels,fireStation:b.fireServiceLevel||0};
  b.environment={pollution:t.pollution,amenity:t.amenity};
 }
}

// Preview a functioning facility without adding it to or mutating the city.
function previewCoverage(state,b){
 const def=serviceDefinition(state,b);
 if(!def||def.network)return null;
 const cells=def.roads?(b.type==='policeStation'?policeCoverageCells(state,b):fireStationCells(state,b)):state.tiles.filter(t=>{
  if(t.terrain!=='land')return false;
  const distance=Math.hypot(t.x-b.x,t.y-b.y);
  return def.garden||def.landmark?distance<def.radius:distance<=def.radius;
 }).map(t=>gridIndex(state,t.x,t.y));
 return {cells,description:`${def.label} · ${def.roads?'沿道路':'半径'} ${def.radius} 格 · 覆盖 ${cells.length} 格${def.roads&&!cells.length?'（需连接对外道路）':''} · 正常运营后生效`};
}

export function placementServiceCoverage(state,type,cell){
 if(!cell)return null;
 const kind=businessKind(type);
 return previewCoverage(state,{type:kind?.zone||type,...(kind?{businessKind:type}:{}),x:cell.x,y:cell.y,level:1,active:true,progress:1,connected:true,powered:true,watered:true});
}

export function movedServiceCoverage(state,buildingId,cell){
 if(!cell)return null;
 const source=(state.buildings||[]).find(building=>building.id===buildingId);if(!source)return null;
 const group=civicGardenGroups(state.buildings).get(source.id),ids=new Set(group?.members||[source.id]),dx=cell.x-source.x,dy=cell.y-source.y,cells=new Set(),descriptions=[];
 for(const building of state.buildings.filter(item=>ids.has(item.id))){
  const preview=previewCoverage(state,{...building,x:building.x+dx,y:building.y+dy,active:true,progress:1,connected:true,powered:true,watered:true});
  if(!preview)continue;for(const index of preview.cells)cells.add(index);descriptions.push(preview.description);
 }
 if(!descriptions.length)return null;
 const definition=serviceDefinition(state,{...source,x:cell.x,y:cell.y});
 return {cells:[...cells],description:`移动后${definition.label}影响 ${cells.size} 格`};
}
