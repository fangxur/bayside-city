import {ZONE_ECONOMY,privateMaintenance,economicLotArea,productivityGain} from './economy.js';
import { COMMUNITY_BUILDINGS, COMMUNITY_UPGRADES, communityService, isCommunityBusiness } from './community-buildings.js';
import { DECORATIONS } from './decorations.js';
import {requiresRoad} from './building-access.js';
import {businessKind} from './business-kinds.js';
import {utilityScale} from './utility-buildings.js';
import {LANDMARKS,MAX_LANDMARK_LEVEL,LANDMARK_HONOR_POINTS,landmarkUpgradePlan,landmarkRadius,landmarkStrength} from './landmarks.js';
import {mayorReputation} from './mayor-reputation.js';
export const BUILDING_TIERS = {
  park: { names: ['街心花园','花境公园','湖畔花园','城市植物园'], costs: [450,1000,2000], radii: [5,6,8,10], strengths: [16,20,24,28] },
  plaza: { names: ['喷泉广场','叠水喷泉广场','花园喷泉广场','城市庆典广场'], costs: [800,1800,3200], radii: [8,9,11,13], strengths: [24,28,32,36] },
  residential: { names: ['河湾住宅', '花园公寓', '滨城高层住宅', '云庭住宅塔楼'], capacities: [10, 32, 72, 128], costs: [900, 2600, 6500] },
  commercial: { names: ['街角商店', '社区商业楼', '城市购物中心', '金融商务塔楼'], capacities: [8, 22, 54, 110], costs: [1000, 3200, 8000] },
  industrial: { names: ['城市工坊', '标准化工厂', '综合制造厂', '先进制造中心'], capacities: [16, 38, 88, 156], costs: [1200, 4000, 9500] },
  power: { names: ['小型供电站', '区域能源站', '综合能源中心', '城市能源枢纽'], capacities: [750, 1600, 3200, 6000], costs: [1800, 3500, 6000] },
  water: { names: ['社区水塔', '区域供水站', '净水处理中心', '城市供水枢纽'], capacities: [900, 2000, 4000, 7500], costs: [1200, 2500, 4500] },
  fireStation: { names: ['社区消防站', '片区消防站', '城市消防中心', '综合应急指挥中心'], costs: [1400, 2800, 4800] },
  cityHall: { names: ['湾畔市政府', '市民服务中心', '城市行政中心', '都会市政厅'], costs: [2000, 4000, 6500] },
};
for(const [type,names] of Object.entries(COMMUNITY_UPGRADES))BUILDING_TIERS[type]={names,costs:[.5,1,1.6].map(factor=>Math.round(COMMUNITY_BUILDINGS[type].cost*factor/50)*50)};
export const MAX_BUILDING_LEVEL=6;
const lateNames={residential:['都会云庭','天际社区'],commercial:['都会商贸中心','国际商务中心'],industrial:['智能制造园','未来产业中心'],power:['智慧能源中心','城市能源网络'],water:['生态净水中心','智慧水务中心'],fireStation:['区域应急中心','城市安全总部'],cityHall:['都会行政中心','城市治理中心'],park:['生态景观园','都会生态花园'],plaza:['都会文化广场','城市庆典中心'],marina:['区域游艇母港','国际游艇港']};
// Late residential tiers deliberately grow faster than jobs. A city that has
// reached 20k/40k should be able to densify its existing neighbourhoods instead
// of repeatedly consuming the map with new one-storey housing.
const lateCapacityOverrides={residential:[400,800]};
for(const [type,tier] of Object.entries(BUILDING_TIERS)){
 tier.names=[...tier.names,...(lateNames[type]||[COMMUNITY_BUILDINGS[type].name+' · 卓越级',COMMUNITY_BUILDINGS[type].name+' · 旗舰级'])];
 const cost=tier.costs.at(-1);tier.costs.push(Math.ceil(cost*1.8/50)*50,Math.ceil(cost*3/50)*50);
 if(tier.capacities){const cap=tier.capacities.at(-1),late=lateCapacityOverrides[type]||[Math.round(cap*1.65),Math.round(cap*2.6)];tier.capacities.push(...late);}
 if(tier.radii)tier.radii.push(tier.radii.at(-1)+2,tier.radii.at(-1)+4);
 if(tier.strengths)tier.strengths.push(tier.strengths.at(-1)+4,tier.strengths.at(-1)+8);
}
export const CITY_STAGES = [
  {population:20000,milestone:'regional',name:'区域中心',reward:'五级道路随人口开放 · 完成四级领域协同后开放五级住宅、水电与区域设施'},
  {population:30000,milestone:'mature',name:'均衡大城',reward:'用五级道路串联各区 · 完成四级全领域协同后开放其余五级建筑'},
  {population:40000,milestone:'civic',name:'宜居中心城',reward:'完成含宗教与信仰的五级公共服务与市容协同后开放六级住宅、消防、教育和景观'},
  {population:50000,milestone:'global',name:'国际都会',reward:'六级道路随人口开放 · 完成五级领域协同后开放六级产业、水电与国际设施'},
  { population: 500, milestone: 'bridge', name: '河畔小镇', reward: '人口与就业达标' },
  { population: 1000, milestone: 'density', name: '繁荣街区', reward: '二级道路随人口开放 · 市政府办公后开放住商工与水电二级升级' },
  { population: 2000, milestone: 'completed', name: '宜居小城', reward: '地标与其他市政设施二级升级' },
  { population: 5000, milestone: 'metropolis', name: '活力都市', reward: '三级道路随人口开放 · 完成含休闲景观的二级领域协同后开放三级建筑' },
  { population: 10000, milestone: 'capital', name: '河湾都会', reward: '四级道路随人口开放 · 完成含休闲景观的三级领域协同后开放四级建筑' },
].sort((a,b)=>a.population-b.population);

const DOMAIN_STAGES={
  metropolis:{population:5000,tier:2,roads:8,coverage:60,landscapeCoverage:50,beauty:8,averageBeauty:6,traffic:60,clean:60,services:['fireStation','clinic']},
  capital:{population:10000,tier:3,roads:12,coverage:65,landscapeCoverage:60,beauty:10,averageBeauty:8,traffic:65,clean:70,services:['fireStation','clinic','school','library']},
  regional:{population:20000,tier:4,roads:16,coverage:70,landscapeCoverage:70,beauty:12,averageBeauty:10,traffic:70,clean:80,services:['fireStation','clinic','school','library','sportsHall','cityHall']},
  mature:{population:30000,tier:4,roadTier:5,roads:20,coverage:75,landscapeCoverage:75,beauty:14,averageBeauty:11,traffic:72,clean:82,services:['fireStation','clinic','school','library','sportsHall','cityHall']},
  civic:{population:40000,tier:5,roadTier:5,roads:24,coverage:80,landscapeCoverage:80,beauty:16,averageBeauty:12,traffic:75,clean:86,services:['fireStation','clinic','school','library','sportsHall','cityHall','spiritual']},
  global:{population:50000,tier:5,roadTier:6,roads:20,coverage:85,landscapeCoverage:85,beauty:18,averageBeauty:14,traffic:78,clean:90,services:['fireStation','clinic','school','library','sportsHall','cityHall']},
};
const DOMAIN_LABELS={fireStation:'消防',clinic:'医疗',school:'教育',library:'文化',sportsHall:'体育',cityHall:'市政',spiritual:'宗教与信仰'};
const operational=b=>!!b&&b.active!==false&&b.progress>=1&&(!requiresRoad(b.type)||b.connected)&&b.powered&&b.watered;
const serviceCategory=b=>b.type==='fireStation'?'fireStation':b.type==='cityHall'?'cityHall':COMMUNITY_BUILDINGS[b.type]?.service||businessKind(b.businessKind)?.service||b.type;
const rate=(part,total)=>total?Math.round(part/total*100):100;
const requirement=(label,met,detail,progress=met?1:0)=>({label,met,detail,progress:Math.max(0,Math.min(1,progress))});

// Higher tiers open only after the previous tier is working as a complete city
// system. Milestones latch in the simulation, so temporary outages never revoke
// upgrades that a city has already earned.
export function domainStageReadiness(state,milestone){
  const rule=DOMAIN_STAGES[milestone];
  if(!rule)return {met:true,progress:1,requirements:[]};
  const buildings=state?.buildings||[],tiles=state?.tiles||[],stats=state?.stats||{},cityHallReady=buildings.some(b=>b.type==='cityHall'&&operational(b));
  const population=Number(stats.population)||0,tier=rule.tier,roadTier=rule.roadTier||tier;
  const requirements=[requirement(`人口达到 ${rule.population.toLocaleString('zh-CN')}`,population>=rule.population,`${population.toLocaleString('zh-CN')} / ${rule.population.toLocaleString('zh-CN')} 人`,population/rule.population)];

  const roads=tiles.filter(t=>t.road>=roadTier&&t.connected).length;
  requirements.push(requirement(`${roadTier} 级道路形成骨架`,roads>=rule.roads,`${roads} / ${rule.roads} 格已连通道路达到 ${roadTier} 级`,roads/rule.roads));

  const power=buildings.some(b=>b.type==='power'&&b.level>=tier&&operational(b));
  const water=buildings.some(b=>b.type==='water'&&b.level>=tier&&operational(b));
  const powerReserve=(stats.powerCapacity||0)-(stats.powerUsed||0),waterReserve=(stats.waterCapacity||0)-(stats.waterUsed||0);
  const powerRatio=stats.powerCapacity?powerReserve/stats.powerCapacity:0,waterRatio=stats.waterCapacity?waterReserve/stats.waterCapacity:0;
  const utilities=power&&water&&powerRatio>=.1&&waterRatio>=.1;
  requirements.push(requirement(`${tier} 级水电稳定运行`,utilities,`供电 ${power?'已达级':'未达级'}、供水 ${water?'已达级':'未达级'} · 余量 ${Math.round(powerRatio*100)}% / ${Math.round(waterRatio*100)}%（均需 ≥10%）`,Math.min(power?1:0,water?1:0,powerRatio/.1,waterRatio/.1)));

  const privateReady=type=>buildings.some(b=>b.type===type&&b.level>=tier&&operational(b)&&(type==='residential'?b.population>0:b.workers>0));
  const privateStatus=['residential','commercial','industrial'].map(type=>privateReady(type));
  requirements.push(requirement(`${tier} 级住商工形成循环`,privateStatus.every(Boolean),`住宅 ${privateStatus[0]?'✓':'○'} · 商业 ${privateStatus[1]?'✓':'○'} · 工业 ${privateStatus[2]?'✓':'○'}（需入住或到岗）`,privateStatus.filter(Boolean).length/3));

  const occupied=buildings.filter(b=>b.type==='residential'&&b.population>0),residentTotal=occupied.reduce((sum,b)=>sum+b.population,0);
  const serviceStatus=rule.services.map(service=>{
    const provider=buildings.some(b=>serviceCategory(b)===service&&b.level>=tier&&operational(b)&&(!businessKind(b.businessKind)?.service||(b.workers||0)>0)&&(b.type!=='districtOffice'||cityHallReady));
    const covered=rate(occupied.filter(b=>(b.serviceLevels?.[service]||0)>=tier).reduce((sum,b)=>sum+b.population,0),residentTotal);
    return {service,provider,covered,met:provider&&covered>=rule.coverage};
  });
  requirements.push(requirement(`${tier} 级公共服务覆盖`,serviceStatus.every(item=>item.met),serviceStatus.map(item=>`${DOMAIN_LABELS[item.service]} ${item.provider?'':'缺少同级设施 · '}${item.covered}%`).join('；')+`（覆盖均需 ≥${rule.coverage}%）`,Math.min(...serviceStatus.map(item=>Math.min(item.provider?1:0,item.covered/rule.coverage)))));

  const landscapeProvider=buildings.some(b=>DECORATIONS[b.type]
    ? b.active!==false&&b.progress>=1
    : b.level>=tier&&(['park','plaza'].includes(b.type)?b.active!==false&&b.progress>=1:COMMUNITY_BUILDINGS[b.type]?.beauty&&operational(b)));
  const beautifulPopulation=occupied.filter(b=>(b.environment?.amenity||0)>=rule.beauty).reduce((sum,b)=>sum+b.population,0);
  const landscapeCoverage=rate(beautifulPopulation,residentTotal);
  const averageBeauty=residentTotal?occupied.reduce((sum,b)=>sum+(b.environment?.amenity||0)*b.population,0)/residentTotal:0;
  const landscapeReady=landscapeProvider&&landscapeCoverage>=rule.landscapeCoverage&&averageBeauty>=rule.averageBeauty;
  requirements.push(requirement(`${tier} 级休闲景观与社区美观`,landscapeReady,`${tier} 级景观 ${landscapeProvider?'✓':'○'} · 美观 ≥${rule.beauty} 的居民 ${landscapeCoverage}% / ${rule.landscapeCoverage}% · 人均美观 ${averageBeauty.toFixed(1)} / ${rule.averageBeauty}`,Math.min(landscapeProvider?1:0,landscapeCoverage/rule.landscapeCoverage,averageBeauty/rule.averageBeauty)));

  const cleanPopulation=occupied.filter(b=>(b.environment?.pollution??100)<=20).reduce((sum,b)=>sum+b.population,0),clean=rate(cleanPopulation,residentTotal),traffic=Number(stats.traffic)||0;
  const healthy=traffic>=rule.traffic&&clean>=rule.clean;
  requirements.push(requirement('交通与居住环境达标',healthy,`交通畅通度 ${traffic}% / ${rule.traffic}% · 低污染居民 ${clean}% / ${rule.clean}%`,Math.min(traffic/rule.traffic,clean/rule.clean)));
  return {requirements,met:requirements.every(item=>item.met),progress:Math.min(...requirements.map(item=>item.progress))};
}

export function latchDomainMilestones(state){
  if(state.milestones.completed&&domainStageReadiness(state,'metropolis').met)state.milestones.metropolis=true;
  if(state.milestones.metropolis&&domainStageReadiness(state,'capital').met)state.milestones.capital=true;
  if(state.milestones.capital&&domainStageReadiness(state,'regional').met)state.milestones.regional=true;
  if(state.milestones.regional&&domainStageReadiness(state,'mature').met)state.milestones.mature=true;
  if(state.milestones.mature&&domainStageReadiness(state,'civic').met)state.milestones.civic=true;
  if(state.milestones.civic&&domainStageReadiness(state,'global').met)state.milestones.global=true;
  return state.milestones;
}
export const buildingCapacity = b => (BUILDING_TIERS[b.type]?.capacities?.[(b.level || 1) - 1] || 0)*economicLotArea(b)*utilityScale(b);
export const residentialArrivalCohort=b=>(b.moveInWillingness>70?2:1)+((b.level||1)>=6?4:(b.level||1)>=5?2:0);
export const UTILITY_MAINTENANCE = {power:150,water:80};
export const isUtility = type => Object.hasOwn(UTILITY_MAINTENANCE,type);
// Upgrades keep the previous equipment running until the new capacity is ready.
export const utilityCapacity = b => !isUtility(b.type) ? 0 : b.progress < 1
  ? b.level > 1 ? buildingCapacity({...b,level:b.level-1}) : 0
  : buildingCapacity(b);
export const ROAD_TIERS = [
  null,
  { name: '社区道路', capacity: 34, maintenance: .7, travelCost: 1, asphalt: 0x626a6a, sidewalk: 0xd9d6bc },
  { name: '城市道路', capacity: 95, maintenance: 1.5, travelCost: .82, asphalt: 0x535e62, sidewalk: 0xd9d6bc },
  { name: '林荫大道', capacity: 160, maintenance: 2.4, travelCost: .70, asphalt: 0x515e5b, sidewalk: 0xd4ceb5 },
  { name: '都会大道', capacity: 240, maintenance: 3.6, travelCost: .60, asphalt: 0x45535d, sidewalk: 0xe2dccb },
  { name: '城市主干道', capacity: 400, maintenance: 5.8, travelCost: .52, asphalt: 0x3e5360, sidewalk: 0xd5dce0 },
  { name: '智慧主干道', capacity: 650, maintenance: 9, travelCost: .44, asphalt: 0x354951, sidewalk: 0xdce4df },
  { name: '都会快速路', capacity: 1000, maintenance: 14, travelCost: .36, asphalt: 0x293f49, sidewalk: 0xe3e8e5 },
];
export const MAX_ROAD_LEVEL=ROAD_TIERS.length-1;
export const ROAD_POPULATION_GATES=[1000,5000,10000,20000,50000,60000];
export const roadLevelForPopulation=population=>1+ROAD_POPULATION_GATES.filter(target=>(Number(population)||0)>=target).length;
export const unlockedRoadLevel=state=>Math.max(1,Math.min(MAX_ROAD_LEVEL,Math.max(state?.roadLevelUnlocked||1,roadLevelForPopulation(state?.stats?.population))));
export function roadUpgradeOffer(tile, state) {
  if (!tile?.road) return { allowed: false, reason: '请选择道路' };
  if (tile.road >= MAX_ROAD_LEVEL) return { allowed: false, reason: '这段道路已达到最高等级' };
  const target = ROAD_POPULATION_GATES[tile.road - 1];
  const cost = [30, 65, 120, 220, 380, 650][tile.road - 1];
  const name = ROAD_TIERS[tile.road + 1].name;
  const unlocked=unlockedRoadLevel(state)>tile.road;
  return { allowed: unlocked, cost, name, nextLevel: tile.road + 1,
    reason: unlocked ? `升级为${name} · ¥${cost} / 格 · 容量 ${ROAD_TIERS[tile.road+1].capacity}` : `人口达到 ${target.toLocaleString('zh-CN')} 后解锁${name}` };
}
export const maintenanceMultiplier = b => [1, 1.6, 2.5, 3.8, 5.5, 8][(b.level || 1) - 1] || 1;
export const utilityMaintenance = b => (UTILITY_MAINTENANCE[b.type]||0)*maintenanceMultiplier(b)*utilityScale(b);
export function upgradeOffer(b, progression) {
  const state=progression?.milestones&&progression?.stats?progression:null,milestones=state?.milestones||progression||{},population=Number(state?.stats?.population)||0;
  if(LANDMARKS[b.type]){
    if(b.progress<1)return {allowed:false,reason:'请等待当前名胜修缮完成'};
    if(b.level>=MAX_LANDMARK_LEVEL)return {allowed:false,reason:'已达到传世名胜最高等级'};
    const plan=landmarkUpgradePlan(b),next={...b,level:plan.nextLevel},honor=state?mayorReputation(state).level:1;
    const requirements=[
      {label:`人口达到 ${plan.population.toLocaleString('zh-CN')}`,met:population>=plan.population},
      {label:`完成${plan.stage}城市阶段`,met:!!milestones[plan.milestone]},
      {label:`市长荣誉达到 Lv.${plan.honorLevel}`,met:honor>=plan.honorLevel},
      {label:'名胜正常开放且道路、水电连通',met:!!(b.active&&b.connected&&b.powered&&b.watered)},
    ];
    const missing=requirements.filter(item=>!item.met),cost=plan.cost;
    const benefit=`完工后名胜荣誉积分 ${LANDMARK_HONOR_POINTS[b.level-1]} → ${LANDMARK_HONOR_POINTS[b.level]} · 环境半径 ${landmarkRadius(b)} → ${landmarkRadius(next)} 格 · 月维护 ¥${Math.round(LANDMARKS[b.type].maintenance*maintenanceMultiplier(b))} → ¥${Math.round(LANDMARKS[b.type].maintenance*maintenanceMultiplier(next))}`;
    return {allowed:!missing.length,cost,nextLevel:plan.nextLevel,name:plan.name,requirements,benefit,reason:missing.length?`修缮 ¥${cost} · 尚缺：${missing.map(item=>item.label).join('、')}`:`升级为${plan.name} · ¥${cost} · ${benefit}`};
  }
  if(COMMUNITY_BUILDINGS[b.type]?.fixedFacility)return {allowed:false,reason:'完整大型设施，无需升级；可增建以扩大服务范围'};
  const tier = BUILDING_TIERS[b.type];
  if (!tier) return { allowed: false, reason: '这类设施无需升级' };
  if (b.progress < 1) return { allowed: false, reason: '请等待当前施工完成' };
  if (b.level >= MAX_BUILDING_LEVEL) return { allowed: false, reason: '已达到最高等级' };
  const privateBuilding = ['residential', 'commercial', 'industrial', 'park', 'plaza'].includes(b.type),earlyUpgrade=privateBuilding||isUtility(b.type),populationGates=COMMUNITY_BUILDINGS[b.type]?.populationUpgrades;
  const growthTier=b.level===4&&['residential','power','water'].includes(b.type);
  const civicFinalTier=b.level===5&&(b.type==='residential'||['fireStation','cityHall','park','plaza'].includes(b.type)||(COMMUNITY_BUILDINGS[b.type]&&!isCommunityBusiness(b.type)));
  const gate = b.level === 4 ? growthTier?'regional':'mature' : b.level === 5 ? civicFinalTier?'civic':'global' : b.level === 1 ? earlyUpgrade ? 'density' : 'completed' : b.level === 2 ? 'metropolis' : 'capital';
  const target = populationGates?.[b.level-1]??(b.level === 4 ? growthTier?20000:30000 : b.level === 5 ? civicFinalTier?40000:50000 : b.level === 1 ? earlyUpgrade ? 1000 : 2000 : b.level === 2 ? 5000 : 10000);
  const stageReadiness=!populationGates&&target>=5000&&state&&!milestones[gate]?domainStageReadiness(state,gate):null;
  const stage=stageReadiness?{
    title:`${target.toLocaleString('zh-CN')} 人领域协同`,
    met:stageReadiness.met,
    completed:stageReadiness.requirements.filter(item=>item.met).length,
    total:stageReadiness.requirements.length,
    requirements:stageReadiness.requirements,
  }:null;
  const stageLabel=target>=5000?`完成 ${target.toLocaleString('zh-CN')} 人领域协同阶段`:`完成 ${target.toLocaleString('zh-CN')} 人阶段`;
  const requirements=populationGates?[{label:`人口达到 ${target.toLocaleString('zh-CN')}`,met:population>=target}]:[{label:stageLabel,met:!!milestones[gate],detail:stage?`${stage.completed} / ${stage.total} 项完成；尚缺 ${stage.requirements.filter(item=>!item.met).map(item=>item.label).join('、')}`:undefined}];
  if(b.type==='residential'&&b.level>=2){
    requirements.push({label:'消防覆盖',met:!!b.fireCovered},{label:'医疗覆盖',met:!!b.services?.clinic});
    if(b.level>=3)requirements.push({label:'休闲景观覆盖',met:!!b.services?.park},{label:'环境加成 ≥ 12',met:(b.environment?.amenity||0)>=12},{label:'污染 ≤ 20',met:(b.environment?.pollution??100)<=20});
  }
  if(b.type==='residential'&&b.level>=4)requirements.push({label:'教育覆盖',met:!!b.services?.school},{label:'文化覆盖',met:!!b.services?.library});
  if(b.type==='residential'&&b.level>=5)requirements.push({label:'体育覆盖',met:!!b.services?.sportsHall},{label:'市政府体系覆盖（市政府或已联动区政务中心）',met:!!b.services?.cityHall});
  const service=communityService({...b,level:b.level+1});
  const next={...b,level:b.level+1},utility=isUtility(b.type);
  const community=COMMUNITY_BUILDINGS[b.type];
  const upkeep=utility?` · 月维护 ¥${utilityMaintenance(b)} → ¥${utilityMaintenance(next)}`:ZONE_ECONOMY[b.type]?` · 升级后月配套维护 ¥${privateMaintenance(next)}`:community?` · 月维护 ¥${Math.round(community.maintenance*maintenanceMultiplier(b))} → ¥${Math.round(community.maintenance*maintenanceMultiplier(next))}`:'';
  const privateImprovement=b.type==='residential'?` · 容量 ${buildingCapacity(b)} → ${buildingCapacity(next)}`:['commercial','industrial'].includes(b.type)?` · 岗位 ${buildingCapacity(b)} → ${buildingCapacity(next)} · 人均经营税效率 +${productivityGain(next.level)}%`:'';
  const berthImprovement=b.type==='marina'?` · 泊位 ${COMMUNITY_BUILDINGS.marina.berths[b.level-1]} → ${COMMUNITY_BUILDINGS.marina.berths[b.level]}`:'';
  const improvement=utility?` · ${b.type==='power'?'供电':'供水'}容量 ${buildingCapacity(b).toLocaleString('zh-CN')} → ${buildingCapacity(next).toLocaleString('zh-CN')}`:service?` · 覆盖 ${service.radius} 格 · 满意度 +${service.bonus}${berthImprovement}`:privateImprovement;
  const missing=requirements.filter(r=>!r.met);
  const cost=tier.costs[b.level-1]*economicLotArea(b)*utilityScale(b);
  const stageMissing=stage?.requirements.filter(item=>!item.met)||[];
  const missingSummary=stage?stageMissing.length?`${stage.title}还缺 ${stageMissing.length} 项：${stageMissing.map(item=>item.label).join('、')}`:`${stage.title}条件已经达标，等待城市阶段确认`:missing.map(r=>r.label).join('、');
  const localMissing=stage?missing.filter(item=>item.label!==stageLabel).map(item=>item.label):[];
  return { allowed:!missing.length, cost,nextLevel:b.level+1,name:tier.names[b.level],requirements,stage,
    benefit:utility||b.type==='marina'?improvement.slice(3)+upkeep:'',
    reason:missing.length?`升级 ¥${cost} · 尚缺：${missingSummary}${localMissing.length?`；本建筑还需 ${localMissing.join('、')}`:''}`:`升级为${tier.names[b.level]} · ¥${cost}${improvement}${upkeep}` };

}

export const gardenRadius = b => LANDMARKS[b.type]?landmarkRadius(b):BUILDING_TIERS[b.type]?.radii?.[(b.level || 1)-1] || DECORATIONS[b.type]?.radius || 8;
export const gardenStrength = b => LANDMARKS[b.type]?landmarkStrength(b):BUILDING_TIERS[b.type]?.strengths?.[(b.level || 1)-1] || DECORATIONS[b.type]?.strength || 24;
