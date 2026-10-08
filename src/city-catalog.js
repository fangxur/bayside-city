import {BUSINESS_KINDS} from './business-kinds.js';
import {isEuropeanStreet,europeanHomeHeight} from './european-residential.js';
import {isJapaneseHome,japaneseHomeHeight} from './japanese-residential.js';
import {teaHouseHeight,buddhistTempleHeight} from './chinese-courtyard-architecture.js';
import {COMMUNITY_BUILDINGS,isCommunityBusiness} from './community-buildings.js';
import {DECORATIONS} from './decorations.js';
import {LANDMARKS,MAX_LANDMARK_LEVEL,landmarkHeight} from './landmarks.js';
import {YACHT_TYPES} from './marina.js';
import {commercialPrerequisite} from './commercial-prerequisites.js';
import {LARGE_UTILITIES} from './utility-buildings.js';
import {newBuildingFootprint,buildingCells} from './building-footprint.js';
import {publicVehicleRoutes} from './public-vehicles.js';
import {ZONE_ECONOMY} from './economy.js';

const SIZE=64;
const BASE_BUILDINGS={
  residential:{name:'河湾基础住宅',category:'residential',cost:120,description:'城市自然生长出的基础住宅，提供居民容量。'},
  commercial:{name:'街角基础商店',category:'commercial',cost:180,description:'城市早期形成的街角商店，提供岗位与商业税收。'},
  industrial:{name:'城市基础工坊',category:'industrial',cost:240,description:'城市早期形成的生产工坊，提供岗位与工业货源。'},
  power:{name:'小型供电站',category:'municipal',cost:2500,description:'为连通街区提供电力，可随城市阶段持续升级。'},
  water:{name:'社区水塔',category:'municipal',cost:1500,description:'为连通街区提供供水，可随城市阶段持续升级。'},
  fireStation:{name:'社区消防站',category:'municipal',cost:2200,description:'沿道路提供消防覆盖，并派出消防车巡行或响应火灾。'},
  cityHall:{name:'湾畔市政府',category:'municipal',cost:3000,description:'2×2 全城唯一治理中心；开放城市晋级、市政方针、预算、住宅覆盖与消防调度。'},
  park:{name:'街心花园',category:'landscape',cost:600,description:'无需道路水电，为周边街区增加环境与美观。'},
  plaza:{name:'滨水广场',category:'landscape',cost:1400,description:'带喷泉的开放广场，为更大范围街区增加环境与美观。'},
};

export const CATALOG_CATEGORIES=Object.freeze([
  {id:'all',label:'全部'},
  {id:'residential',label:'住宅'},
  {id:'commercial',label:'商业'},
  {id:'industrial',label:'工业'},
  {id:'municipal',label:'市政'},
  {id:'religion',label:'宗教'},
  {id:'landscape',label:'景观'},
  {id:'landmark',label:'名胜'},
]);

const categoryForCommunity=(type,item)=>isCommunityBusiness(type)?'commercial':item.category==='religion'?'religion':item.category==='entertainment'?'landscape':'municipal';
const operating=building=>building&&building.active!==false&&building.progress>=1&&building.connected&&building.powered&&building.watered;
const buildingCount=(state,preview)=>state.buildings.filter(building=>building.type===preview.type&&(!['power','water'].includes(preview.type)||(building.footprint||1)===(preview.footprint||1))&&(preview.businessKind?building.businessKind===preview.businessKind:!building.businessKind)).length;

function buildingBlueprints(){
  const result=Object.entries(BASE_BUILDINGS).map(([type,item])=>({id:`building:${type}`,kind:'building',...item,maxLevel:6,preview:{kind:'building',type},footprint:newBuildingFootprint(type)}));
  for(const [tool,item] of Object.entries(LARGE_UTILITIES))result.push({id:`building:${tool}`,kind:'building',name:item.name,category:'municipal',description:item.description,cost:item.cost,footprint:item.footprint,maxLevel:6,preview:{kind:'building',type:item.type,footprint:item.footprint}});
  for(const [businessKind,item] of Object.entries(BUSINESS_KINDS))result.push({id:`business:${businessKind}`,kind:'building',name:item.name,category:item.zone,description:item.description,cost:item.cost??ZONE_ECONOMY[item.zone].cost,footprint:newBuildingFootprint(businessKind),maxLevel:6,preview:{kind:'building',type:item.zone,businessKind}});
  for(const [type,item] of Object.entries(COMMUNITY_BUILDINGS))result.push({id:`community:${type}`,kind:'building',name:item.name,category:categoryForCommunity(type,item),description:item.description,cost:item.cost,footprint:newBuildingFootprint(type),maxLevel:item.fixedFacility?1:6,preview:{kind:'building',type},minPopulation:item.minPopulation||0});
  for(const [type,item] of Object.entries(DECORATIONS))result.push({id:`decoration:${type}`,kind:'building',name:item.name,category:'landscape',description:item.description,cost:item.cost,footprint:1,maxLevel:1,preview:{kind:'building',type}});
  for(const [type,item] of Object.entries(LANDMARKS))result.push({id:`landmark:${type}`,kind:'building',name:item.name,category:'landmark',description:item.description,cost:item.cost,footprint:newBuildingFootprint(type),maxLevel:MAX_LANDMARK_LEVEL,preview:{kind:'building',type},landmark:item});
  return result;
}

const BUILDING_BLUEPRINTS=Object.freeze(buildingBlueprints());
const VEHICLE_BLUEPRINTS=Object.freeze([
  {id:'vehicle:car',kind:'vehicle',name:'城市轿车',category:'road',sourceKind:'car',description:'低矮流畅的四门轿车，是居民通勤、约会、购物和回家出行的主力。',preview:{kind:'roadVehicle',vehicleKind:'car'}},
  {id:'vehicle:compact',kind:'vehicle',name:'灵巧微型车',category:'road',sourceKind:'car',description:'轴距短、车顶高的小型代步车，适合穿行早期街区。',preview:{kind:'roadVehicle',vehicleKind:'compact'}},
  {id:'vehicle:hatchback',kind:'vehicle',name:'家用掀背车',category:'road',sourceKind:'car',minPopulation:500,description:'拥有完整尾舱和小型扰流板的家用车辆，适合日常采购与家庭出行。',preview:{kind:'roadVehicle',vehicleKind:'hatchback'}},
  {id:'vehicle:suv',kind:'vehicle',name:'城市越野车',category:'road',sourceKind:'car',minPopulation:1000,description:'车身更高、带有车顶行李架的城市越野车。',preview:{kind:'roadVehicle',vehicleKind:'suv'}},
  {id:'vehicle:taxi',kind:'vehicle',name:'城市出租车',category:'road',sourceKind:'car',minPopulation:1000,description:'带有醒目顶灯的黄色出租车，为成长中的城区提供出行服务。',preview:{kind:'roadVehicle',vehicleKind:'taxi'}},
  {id:'vehicle:minivan',kind:'vehicle',name:'家庭多用途车',category:'road',sourceKind:'car',minPopulation:2000,description:'车厢宽敞、侧窗修长的多用途车，服务家庭和多人出行。',preview:{kind:'roadVehicle',vehicleKind:'minivan'}},
  {id:'vehicle:pickup',kind:'vehicle',name:'城市皮卡',category:'road',sourceKind:'freight',minPopulation:500,description:'前排驾驶舱配开放货斗，承担轻量生产与街区配送。',preview:{kind:'roadVehicle',vehicleKind:'pickup'}},
  {id:'vehicle:delivery-van',kind:'vehicle',name:'厢式配送车',category:'road',sourceKind:'freight',minPopulation:1000,description:'封闭高顶货厢和侧面识别带让城市配送更醒目。',preview:{kind:'roadVehicle',vehicleKind:'delivery-van'}},
  {id:'vehicle:freight',kind:'vehicle',name:'城市货车',category:'road',description:'在工业与商业之间运送货物，沿道路通行并遵守路口信号。',preview:{kind:'roadVehicle',vehicleKind:'freight'}},
  {id:'vehicle:police',kind:'vehicle',name:'城市警车',category:'service',description:'警察局正常运行后沿道路巡逻，抢劫事件发生时赶往现场。',preview:{kind:'roadVehicle',vehicleKind:'police'}},
  {id:'vehicle:bus',kind:'vehicle',name:'城市公交车',category:'service',description:'两座正常运行的公交站接通同一道路网络后自动开通往返公交，减少沿线通勤车流。',preview:{kind:'roadVehicle',vehicleKind:'bus'}},
  {id:'vehicle:ambulance',kind:'vehicle',name:'城市救护车',category:'service',description:'由正常运行的诊所或医院派出，平时巡行，医疗事件发生时赶往现场。',preview:{kind:'roadVehicle',vehicleKind:'ambulance'}},
  {id:'vehicle:fire-engine',kind:'vehicle',name:'城市消防车',category:'service',description:'由正常运行的消防站派出，平时巡行，火灾发生时赶往现场。',preview:{kind:'roadVehicle',vehicleKind:'fire-engine'}},
  ...Object.entries(YACHT_TYPES).map(([yachtKind,item])=>({id:`vehicle:yacht:${yachtKind}`,kind:'vehicle',name:item.name,category:'water',description:yachtKind==='cruiser'?'居民拥有的豪华游艇，会从码头出航并返回泊位。':'居民拥有的小型游艇，会从码头出航并返回泊位。',preview:{kind:'yacht',yachtKind}})),
]);

function buildingUnlock(state,item){
  if(item.landmark){const unlocked=!!state.milestones?.[item.landmark.gate];return {unlocked,reason:unlocked?'':`完成 ${item.landmark.population.toLocaleString('zh-CN')} 人城市目标后解锁`};}
  if(item.minPopulation){const population=state.stats?.population||0,unlocked=population>=item.minPopulation;return {unlocked,reason:unlocked?'':`城市达到 ${item.minPopulation.toLocaleString('zh-CN')} 人后解锁`};}
  if(item.preview.type==='commercial'){
    const requirement=commercialPrerequisite(state,item.preview.businessKind);
    return {unlocked:requirement.allowed,reason:requirement.reason};
  }
  return {unlocked:true,reason:''};
}

function vehicleEntries(state){
  const routes=state.routes||[],publicRoutes=publicVehicleRoutes(state),boats=state.marinaLife?.boats||[];
  return VEHICLE_BLUEPRINTS.map(item=>{
    const type=item.preview.vehicleKind,yachtKind=item.preview.yachtKind;
    let unlocked=false,count=0,reason='';
    if(item.sourceKind){
      const population=state.stats?.population||0;
      count=routes.filter(route=>item.sourceKind==='freight'?route.kind==='freight':route.kind!=='freight').length;
      unlocked=count>0&&population>=(item.minPopulation||0);
      reason=!count?(item.sourceKind==='freight'?'工业与商业形成可达货运路线后解锁':'居民拥有可达的日常出行路线后解锁'):`城市达到 ${(item.minPopulation||0).toLocaleString('zh-CN')} 人后解锁`;
    }else if(type==='freight'){
      count=routes.filter(route=>route.kind==='freight').length;unlocked=count>0;
      reason='工业与商业形成可达货运路线后解锁';
    }else if(type==='police'||type==='bus'){
      count=publicRoutes.filter(route=>route.kind===type).length;
      unlocked=type==='police'?state.buildings.some(b=>b.type==='policeStation'&&operating(b)):count>0;
      reason=type==='police'?'警察局完成施工并接通道路、水电后解锁':'两座公交站完成施工，接通同一道路网络与水电后解锁';
    }else if(type==='ambulance'){
      unlocked=state.buildings.some(building=>['clinic','hospital'].includes(building.type)&&operating(building));
      count=publicRoutes.filter(route=>route.kind==='ambulance').length;reason='让诊所或医院完成施工并接通道路、水电后解锁';
    }else if(type==='fire-engine'){
      unlocked=state.buildings.some(building=>building.type==='fireStation'&&operating(building));
      count=publicRoutes.filter(route=>route.kind==='fire-engine').length;reason='让消防站完成施工并接通道路、水电后解锁';
    }else{
      count=boats.filter(boat=>boat.kind===yachtKind).length;unlocked=count>0;
      reason='建设游艇码头和造船厂，由符合条件的居民购入后解锁';
    }
    return {...item,unlocked,count,unlockReason:unlocked?'':reason};
  });
}

export function cityCatalog(state){
  const buildings=BUILDING_BLUEPRINTS.map(item=>{
    const unlock=buildingUnlock(state,item),count=buildingCount(state,item.preview);
    return {...item,...unlock,count,unlockReason:unlock.reason};
  });
  const vehicles=vehicleEntries(state);
  return {buildings,vehicles,unlocked:buildings.filter(item=>item.unlocked).length+vehicles.filter(item=>item.unlocked).length,total:buildings.length+vehicles.length};
}

const tile=(x,y,terrain='land')=>({x,y,terrain,road:0,zone:null,buildingId:null,connected:false,pollution:0,traffic:0,powered:false,watered:false,bridge:false});
function previewBase(terrain='land'){
  const tiles=Array.from({length:SIZE*SIZE},(_,index)=>tile(index%SIZE,Math.floor(index/SIZE),terrain));
  return {version:1,catalogPreview:true,terrainPreset:'bayside',seed:2026,rng:1,tick:0,month:1,money:0,taxRate:9,tiles,buildings:[],nextId:10,districtName:'城市图鉴',mayorName:'',milestones:{named:false,bridge:false,density:false,landmark:false,completed:false,metropolis:false,capital:false,regional:false,mature:false,civic:false,global:false},roadLevelUnlocked:1,loan:{taken:false,remaining:0,grace:0,monthsPaid:0},profitableMonths:0,cityLife:{lastEventMonth:0,activeEvent:null},cityIncidents:{active:[],history:[]},festivalGames:{},marinaLife:{accounts:[],boats:[],nextId:1,lastMonth:0},civic:{fireBudget:100,policy:'balanced',lastDrillMonth:0,incident:null,history:[]},routes:[],stats:{population:0},history:[],lastMonthly:null};
}
const at=(state,x,y)=>state.tiles[y*SIZE+x];

function buildingPreview(preview,requestedLevel=1,maxLevel=6){
  const state=previewBase(),size=preview.footprint||newBuildingFootprint(preview.businessKind||preview.type),x=Math.floor(32-size/2),y=Math.floor(32-size/2);
  const level=Math.max(1,Math.min(maxLevel,Math.round(Number(requestedLevel)||1)));
  const building={id:1,x,y,type:preview.type,level,progress:1,population:preview.type==='residential'?12:0,jobs:0,workers:0,active:true,connected:true,powered:true,watered:true,happiness:80,problem:'',commute:0,age:10,variant:2,shortageTicks:0,services:{},fireCovered:true};
  if(preview.businessKind)building.businessKind=preview.businessKind;
  if(size>1)building.footprint=size;
  state.buildings.push(building);state.stats.population=building.population;
  for(const cell of buildingCells(building)){const target=at(state,cell.x,cell.y);target.buildingId=building.id;target.zone=['residential','commercial','industrial'].includes(building.type)?building.type:null;if(preview.businessKind)target.businessKind=preview.businessKind;target.powered=true;target.watered=true;}
  if(preview.type==='marina'){
    for(let waterY=y-2;waterY<=y+size+2;waterY++)for(let waterX=x+size;waterX<=x+size+5;waterX++)if(waterY>=0&&waterY<SIZE&&waterX<SIZE)at(state,waterX,waterY).terrain='water';
  }
  if(LANDMARKS[building.type]){const height=landmarkHeight(building);return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:height*.45},viewSize:Math.max(size*2.6+(level-1)*.3,height*1.35),level,maxLevel};}
  if(DECORATIONS[building.type]?.style==='europeanClassical'){const height=DECORATIONS[building.type].height;return {state,focus:{x,y,elevation:height*.44},viewSize:Math.max(2,height*1.65),level,maxLevel};}
  if(isEuropeanStreet(building)){const height=europeanHomeHeight(building);return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:height*.43},viewSize:Math.max(size*2.15,height*1.85)+(level-1)*.01,level,maxLevel};}
  if(isJapaneseHome(building)){const height=japaneseHomeHeight(building);return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:height*.40},viewSize:Math.max(size*1.85,height*1.9)+(level-1)*.025,level,maxLevel};}
  if(building.businessKind==='teaHouse'||building.type==='buddhistTemple'){const height=building.businessKind==='teaHouse'?teaHouseHeight(building):buddhistTempleHeight(building);return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:height*.42},viewSize:Math.max(size*1.9,height*2.5)+(level-1)*.025,level,maxLevel};}
  if(COMMUNITY_BUILDINGS[building.type]?.architecture==='cathedral'){const height=COMMUNITY_BUILDINGS[building.type].height;return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:height*.43},viewSize:5.8,level,maxLevel};}
  const baseViewSize=size>=3?7.2:size===2?5.2:3.8;
  const levelZoomStep=size>=3?.55:size===2?.68:.85;
  return {state,focus:{x:x+(size-1)/2,y:y+(size-1)/2,elevation:.35+(level-1)*.45},viewSize:baseViewSize+(level-1)*levelZoomStep,level,maxLevel};
}

function roadVehiclePreview(kind,sourceKind){
  const state=previewBase(),points=[];
  state.catalogRoadsHidden=true;
  for(let x=29;x<=35;x++){const road=at(state,x,32);road.road=1;road.connected=true;points.push({x,y:32});}
  state.routes=[{kind:sourceKind||kind,vehicleKind:kind,load:1,points}];
  return {state,focus:{x:32,y:32,elevation:.20},viewSize:1.35};
}

function yachtPreview(kind){
  const state=previewBase(),marina={id:1,x:29,y:31,type:'marina',footprint:2,level:1,progress:1,population:0,jobs:0,workers:0,active:true,connected:true,powered:true,watered:true,happiness:80,problem:'',commute:0,age:0,variant:1,shortageTicks:0},home={id:2,x:27,y:31,type:'residential',level:4,progress:1,population:18,jobs:0,workers:8,active:true,connected:true,powered:true,watered:true,happiness:85,problem:'',commute:3,age:12,variant:1,shortageTicks:0};
  state.buildings.push(marina,home);state.stats.population=18;
  for(const building of state.buildings)for(const cell of buildingCells(building))at(state,cell.x,cell.y).buildingId=building.id;
  for(let y=28;y<=35;y++)for(let x=31;x<=45;x++)at(state,x,y).terrain='water';
  state.marinaLife={accounts:[{homeId:2,balance:0}],boats:[{id:1,homeId:2,marinaId:1,kind,boughtMonth:1}],nextId:2,lastMonth:1};state.tick=8;
  return {state,focus:{x:34.5,y:31.5},viewSize:2.5};
}

export function catalogPreview(entry,level=1){
  if(entry.preview.kind==='building')return buildingPreview(entry.preview,level,entry.maxLevel||1);
  if(entry.preview.kind==='yacht')return yachtPreview(entry.preview.yachtKind);
  return roadVehiclePreview(entry.preview.vehicleKind,entry.sourceKind);
}
