import {CoopClient} from './coop-client.js';
import {setupCoopUI} from './coop-ui.js';
import {setupAccountUI} from './account-ui.js';
import {SoloLibrary} from './solo-library.js';
import {setupCityImport} from './city-import.js';
import {setupCityVisit} from './city-visit.js';
import {setupTerrainEditor,terrainDraftThumbnail} from './terrain-editor.js';
import {newTerrainDraft,terrainDraftSummary} from './terrain-draft.js';
import {renderCoopInvite} from './coop-invite.js';
import {mayorIdentity} from './city-identity.js';
import {matchesBuildingFilter} from './building-filter.js';
import {mayorReputation,reputationMarkup} from './mayor-reputation.js';
import {celebrationSnapshot,reachedCelebrations,celebrationMarkup} from './milestone-celebration.js';
import {requiresRoad} from './building-access.js';
import {YACHT_TYPES,yachtRoutes,yachtPose,shipyardReady} from './marina.js';
import {LARGE_UTILITIES} from './utility-buildings.js';
import {newBuildingFootprint} from './building-footprint.js';
import {SERVICE_LAYERS} from './map-layers.js';
import {placementServiceCoverage,movedServiceCoverage} from './service-coverage.js';
import {FESTIVALS,FESTIVAL_CALENDAR_NOTE,festivalForMonth} from './festivals.js';
import {DRAGON_TEAMS,DRAGON_STAKES,FESTIVAL_REWARDS} from './dragon-boat.js';
import {cityHallRequirement} from './city-services.js';
import {commercialSupply} from './commercial-prerequisites.js';
import {commercialPrerequisite} from './commercial-prerequisites.js';
import {ZONE_ECONOMY,privateMaintenance} from './economy.js';
import {developmentSummary} from './city-demand.js';
import { DECORATIONS,EUROPEAN_SCULPTURE_KINDS } from './decorations.js';
import { BUSINESS_KINDS, businessKindsFor } from './business-kinds.js';
import {RESIDENTIAL_STYLE_GROUPS} from './residential-styles.js';
import {COMMERCIAL_STYLE_GROUPS,commercialConstructionKinds} from './commercial-styles.js';
import { TERRAIN_PRESETS, terrainPreview } from './terrain-presets.js';
import { COMMUNITY_BUILDINGS, isCommunityBusiness } from './community-buildings.js';
import { LANDMARKS,LANDMARK_LEVEL_NAMES } from './landmarks.js';
import { CitySimulation, SIZE, TOOLS } from './simulation.js';
import {MAP_SIZE_OPTIONS,mapSize} from './grid.js';
import {cityGoalsForMapSize,DEFAULT_CITY_GOAL,cityGoalProgress} from './city-goals.js';
import { CityRenderer } from './renderer.js';
import { getCitizenStory, eventTitle } from './city-life.js';
import { upgradeOffer, gardenStrength, isUtility, unlockedRoadLevel } from './progression.js';
import {getOnboarding,onboardingProgress,onboardingClock} from './onboarding.js';
import {CITY_INCIDENT_TYPES} from './city-incidents.js';
import {CATALOG_CATEGORIES,catalogPreview,cityCatalog} from './city-catalog.js';

const $ = id => document.getElementById(id);
const compactMedia=window.matchMedia('(max-width:760px), (max-width:960px) and (max-height:540px)');
const panelPreferences={desktop:{left:false,right:false},compact:{left:true,right:true}};
const mobileHudKey='bayside-v1:mobile-hud';
const mobileHudPreference={headerCollapsed:false,overviewCollapsed:false};
try{const saved=JSON.parse(localStorage.getItem(mobileHudKey));for(const key of Object.keys(mobileHudPreference))if(typeof saved?.[key]==='boolean')mobileHudPreference[key]=saved[key];}catch{}
$('game').classList.toggle('compact-ui',compactMedia.matches);
function saveMobileHudPreference(){try{localStorage.setItem(mobileHudKey,JSON.stringify(mobileHudPreference));}catch{}}
function syncMobileOverview(){
  const game=$('game');
  // Other panels only fold the dashboard temporarily; keep the user's preference.
  const obscured=game.matches('.menu-open,.view-open,.layers-open,:not(.left-collapsed),:not(.right-collapsed)');
  const collapsed=mobileHudPreference.overviewCollapsed||obscured;
  $('mobile-overview-body').hidden=collapsed;
  game.classList.toggle('overview-collapsed',collapsed);
  $('mobile-overview-toggle').setAttribute('aria-expanded',String(!collapsed));
  $('mobile-overview-toggle').setAttribute('aria-label',(collapsed?'展开':'收起')+'需求与水电看板');
}
function setMobileHeaderCollapsed(collapsed,persist=true){
  mobileHudPreference.headerCollapsed=collapsed;
  $('game').classList.toggle('header-collapsed',collapsed);
  for(const id of ['mobile-header-collapse','mobile-header-restore'])$(id).setAttribute('aria-expanded',String(!collapsed));
  if(persist)saveMobileHudPreference();
}
$('mobile-header-collapse').onclick=()=>{setMobileHeaderCollapsed(true);$('mobile-header-restore').focus();};
$('mobile-header-restore').onclick=()=>{setMobileHeaderCollapsed(false);$('mobile-header-collapse').focus();};
$('mobile-overview-toggle').onclick=()=>{
  const open=$('mobile-overview-body').hidden;
  mobileHudPreference.overviewCollapsed=!open;
  if(open){closeToolSubmenu();setMobileMapPanel(null);setPanelCollapsed('left',true);setPanelCollapsed('right',true);}
  syncMobileOverview();saveMobileHudPreference();
};
setMobileHeaderCollapsed(mobileHudPreference.headerCollapsed,false);
function fitVisualViewport(){
  const viewport=window.visualViewport;
  for(const [name,value] of Object.entries({width:viewport?.width??innerWidth,height:viewport?.height??innerHeight,left:viewport?.offsetLeft??0,top:viewport?.offsetTop??0}))document.documentElement.style.setProperty('--visual-'+name,value+'px');
}
function revealDialogInput(){
  const input=document.activeElement,dialog=input?.closest('dialog[open]');
  if(!compactMedia.matches||!dialog||!input.matches('input,textarea,select'))return;
  requestAnimationFrame(()=>{
    const field=input.getBoundingClientRect(),box=dialog.getBoundingClientRect();
    const heading=dialog.querySelector('.dialog-heading')?.getBoundingClientRect();
    if(field.bottom>box.bottom-16||field.top<Math.max(box.top+16,heading?.bottom??0))input.scrollIntoView({block:'center'});
  });
}
fitVisualViewport();
window.visualViewport?.addEventListener('resize',()=>{fitVisualViewport();revealDialogInput();});
window.visualViewport?.addEventListener('scroll',fitVisualViewport);
window.addEventListener('resize',fitVisualViewport);
document.addEventListener('focusin',revealDialogInput);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Math.round(Number(value) || 0).toLocaleString('zh-CN');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const paths = {
  home:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8',
  road:'M7 3 3 21M17 3l4 18M12 3v4m0 3v4m0 3v4',
  shop:'M3 10h18l-2-6H5l-2 6ZM4 10v11h16V10M9 21v-6h6v6M3 10q2 5 4 0 2 5 5 0 2 5 5 0 2 5 4 0',
  boat:'M3 14l2 6h14l2-6-9-3-9 3ZM8 12V7h8v5M12 7V3M2 22c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0',
  factory:'M3 21V9l6 4V8l7 5V4h4v17H3ZM6 17h1m4 0h1m4 0h1',
  power:'m13 2-9 12h7l-1 8 10-13h-8l1-7Z',
  water:'M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13ZM8 15c0 2 1 3 3 4',
  tree:'M12 2 5 10h3l-5 7h7v5h4v-5h7l-5-7h3L12 2Z',
  park:'M4 17h16M6 13h12M7 13V9h10v4M6 17v4m12-4v4M3 3h3m-3 4h2m14-4h2',
  bridge:'M2 18h20M5 18V7m14 11V7M5 9c5 8 9 8 14 0M9 13v5m6-5v5M3 7h4m10 0h4',
  upgrade:'M4 20h16M7 17V9m10 8V9M8 6l4-4 4 4M12 2v13',
  move:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  bulldoze:'M3 17h13l4 4h2v-8h-2l-3 4M5 17V9h7l4 8M6 9V5h5v4M4 20h11',
  landmark:'M12 2 5 8h3v11H5v3h14v-3h-3V8h3l-7-6ZM10 8h4M10 19h4',
  pointer:'M5 3 19 12l-7 1-3 7-4-17Z',
  trend:'m3 17 6-6 4 4 8-10M15 5h6v6',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8',
  happy:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14q4 5 8 0M8 8h.01M16 8h.01',
  sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  pause:'M8 4v16M16 4v16',play:'m7 3 14 9-14 9V3Z',menu:'M4 6h16M4 12h16M4 18h16',
  flag:'M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0',
  chevron:'m6 9 6 6 6-6',close:'m6 6 12 12M6 18 18 6',plus:'M12 4v16M4 12h16',minus:'M4 12h16',
  rotate:'M3 10a9 9 0 1 1 2 8M3 4v6h6',focus:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8v8m-4-4h8',
  layers:'m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6',
  catalog:'M4 4h6v7H4V4Zm10 0h6v7h-6V4ZM4 15h6v5H4v-5Zm10 0h6v5h-6v-5Z',
  undo:'M3 10h10a7 7 0 0 1 0 14M3 10l6-6M3 10l6 6',
  help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01',
  arrow:'M4 12h16m-6-6 6 6-6 6',save:'M4 3h14l3 3v15H3V3h1ZM7 3v6h10V3M7 21v-8h10v8',
  folder:'M3 7V4h6l3 3h9v14H3V7ZM3 9h18',check:'m5 12 4 4L19 6',
  alert:'M12 3 2 21h20L12 3ZM12 9v5m0 3h.01',traffic:'M4 17V8l2-5h12l2 5v9H4ZM4 9h16M7 13h.01m10 0h.01M5 17v4m14-4v4',
  chat:'M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM8 11h.01m4 0h.01m4 0h.01',
  signal:'M8 2h8v17H8V2ZM12 19v3M12 5h.01M12 10h.01M12 15h.01M4 4l4 3m12-3-4 3M4 11l4 3m12-3-4 3',
  fireStation:'M12 2c2 5 7 7 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 2 5 3 5 2-3 1-6 0-10ZM10 21c-3-3-1-6 2-8 0 3 4 4 2 8',
  medical:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  cityHall:'m3 8 9-6 9 6H3ZM5 11v8m5-8v8m4-8v8m5-8v8M3 22h18M2 19h20',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.home}"/></svg>`;
function renderIcons(parent = document) { parent.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
renderIcons();

const catalog = [
  {id:'inspect',label:'查看',icon:'pointer',help:'点击人、车或聊天气泡，听听街头见闻 · 点击建筑查看详情'},
  {id:'road',label:'道路',icon:'road',key:'1',help:'拖拽铺路 · 25 / 格 · 必须接通城外入口'},
  {id:'residential',label:'住宅',icon:'home',key:'2',help:'拖拽划出住宅区 · 临路并接通水电后自动生长'},
  {id:'commercial',label:'混合商业',icon:'shop',key:'3',help:'拖拽划出商业区 · 靠近居民才能吸引顾客'},
  {id:'industrial',label:'混合工业',icon:'factory',key:'4',help:'拖拽划出工业区 · 提供岗位，也带来污染'},
  {id:'power',label:'电力',icon:'power',key:'5',help:'1×1 供电站 · 容量 750 · 点击路边建设 · 2,500 · 月维护 150 · 点击已建设施可查看六级升级'},
  {id:'water',label:'供水',icon:'water',key:'6',help:'1×1 水塔 · 容量 900 · 点击路边建设 · 1,500 · 月维护 80 · 点击已建设施可查看六级升级'},
  {id:'park',label:'公园',icon:'tree',key:'7',help:'空地建设 · 600 · 无需道路水电 · 提供住宅休闲景观覆盖 · 社区美观最高 +16 · 半径 5 格'},
  {id:'plaza',label:'喷泉广场',icon:'park',help:'空地建设 · 1,400 · 无需道路水电 · 提供住宅休闲景观覆盖 · 社区美观最高 +24 · 半径 8 格'},
  {id:'fireStation',label:'消防站',icon:'fireStation',help:'点击路边建设消防站 · 2,200 · 标准月维护 120 · 需要水电，沿道路提供覆盖'},
  {id:'cityHall',label:'市政府',icon:'cityHall',help:'2×2 市政府 · 3,000 · 月维护 80 · 开放市政方针、住宅覆盖与消防管理'},
  {id:'bridge',label:'桥梁',icon:'bridge',help:'点击河面或岸边 · 两岸有落点且无建筑阻挡 · ¥3,500'},
  {id:'upgrade',label:'升级',icon:'upgrade',help:'道路等级只随人口开放 · 点击建筑查看其他升级条件'},
  {id:'landmark',label:'名胜',icon:'landmark',help:'选择城市名胜，随 500 至 50,000 人阶段逐步解锁'},
  {id:'move',label:'移动',icon:'move',key:'m',help:'从空地拖动可平移地图 · 按住建筑或单格道路拖到空地搬迁 · 免费并保留等级 · Esc 取消'},
  {id:'bulldoze',label:'拆除',icon:'bulldoze',key:'8',help:'点击或拖拽拆除 · 放置前可查看受影响数量'},
];
for(const [id,item] of Object.entries(LARGE_UTILITIES))catalog.push({id,label:item.name,icon:item.type,help:item.description+' · 临路连接城外道路 · ¥'+number(item.cost)});
for (const [id,item] of Object.entries(COMMUNITY_BUILDINGS)) catalog.push({id,label:item.name,icon:item.icon,help:`${item.name}${item.footprint>1?` · ${item.footprint}×${item.footprint} 占地`:' · 1×1 占地'} · ¥${item.cost} · 月维护 ${item.maintenance} · 服务半径 ${item.radius} 格 · ${item.fixedFacility?'完整设施，无需升级':'可升六级'}${item.category==='religion'?' · 精神慰藉满意度 +'+item.bonus+'，同类取最高值':''}${isCommunityBusiness(id)?` · 一级提供 ${item.jobs} 个岗位，发放企业工资并缴纳商业税`:''} · ${requiresRoad(id)?'需要道路水电':'无需临路，需要城市水电供应'}${id==='marina'?' · 需临水，升级仅随 1,000 / 5,000 / 10,000 / 20,000 / 50,000 人口阶段开放，居民购船需造船厂':''}${id==='districtOffice'?' · 依赖市政府运行；只扩展片区市政覆盖，不负责城市晋级、方针、预算和消防调度':''}`});
for(const [id,k] of Object.entries(BUSINESS_KINDS))catalog.push({id,label:k.name,icon:k.zone==='residential'?'home':k.zone==='commercial'?'shop':'factory',help:`${k.description} · ${k.footprint>1?'点击整栋建设，接通道路水电后施工':'拖拽规划'} · 沿用${k.zone==='residential'?'住宅':k.zone==='commercial'?'商业':'工业'}供需与升级规则`});
for(const [id,d] of Object.entries(DECORATIONS))catalog.push({id,label:d.name,icon:'landmark',help:`${d.description} · ¥${d.cost} · 月维护 ${d.maintenance} · 提供住宅休闲景观覆盖 · 美观最高 +${d.strength} · 半径 ${d.radius} 格 · 无需道路水电`});
const toolBuildCost=id=>BUSINESS_KINDS[id]?.cost??TOOLS[id]?.cost??TOOLS[BUSINESS_KINDS[id]?.zone]?.cost??0;
const footprintThenCost=(a,b)=>newBuildingFootprint(a)-newBuildingFootprint(b)||toolBuildCost(a)-toolBuildCost(b);
const gardenTools=['park','plaza',...Object.keys(COMMUNITY_BUILDINGS).filter(id=>COMMUNITY_BUILDINGS[id].category==='entertainment'&&!isCommunityBusiness(id)),...Object.keys(DECORATIONS).filter(id=>!EUROPEAN_SCULPTURE_KINDS.includes(id))].sort((a,b)=>TOOLS[a].cost-TOOLS[b].cost);
const toolGroups = {
  residential:{label:'住宅',icon:'home',sections:RESIDENTIAL_STYLE_GROUPS.map(group=>({...group,tools:[...group.tools].sort(footprintThenCost)})),tools:businessKindsFor('residential').sort(footprintThenCost)},
  commercial:{label:'商业',icon:'shop',sections:COMMERCIAL_STYLE_GROUPS.map(group=>({...group,tools:[...group.tools].sort(footprintThenCost)})),tools:commercialConstructionKinds().sort(footprintThenCost)},
  industrial:{label:'工业',icon:'factory',tools:businessKindsFor('industrial').sort(footprintThenCost)},
  roads: {label:'道路',icon:'road',tools:['road','bridge']},
  municipal: {
    label:'市政服务',icon:'cityHall',
    sections:[
      {label:'基础保障',tools:['power','water','largePower','largeWater','fireStation']},
      {label:'城市治理',tools:['cityHall','districtOffice']},
      {label:'教育与文化',tools:['school','library','grandGallery']},
      {label:'医疗服务',tools:['clinic','hospital']},
      {label:'体育服务',tools:['sportsHall','stadium','grandStadium']},
    ],
    tools:['power','water','largePower','largeWater','fireStation','cityHall','districtOffice','school','library','grandGallery','clinic','hospital','sportsHall','stadium','grandStadium'],
  },
  religion:{label:'宗教与信仰',icon:'landmark',tools:Object.keys(COMMUNITY_BUILDINGS).filter(id=>COMMUNITY_BUILDINGS[id].category==='religion').sort((a,b)=>TOOLS[a].cost-TOOLS[b].cost)},
  landscape: {label:'休闲景观',icon:'tree',sections:[{label:'公园与庭园',tools:gardenTools},{label:'欧洲古典雕塑',description:'1×1 石雕与青铜群像 · 自带暖色基座照明',tools:EUROPEAN_SCULPTURE_KINDS}],tools:[...gardenTools,...EUROPEAN_SCULPTURE_KINDS]},
};
for(const t of catalog){const zone=BUSINESS_KINDS[t.id]?.zone||t.id;if(ZONE_ECONOMY[zone])t.help+=` · 开发费 ¥${BUSINESS_KINDS[t.id]?.cost??TOOLS[zone].cost} / ${newBuildingFootprint(t.id)>1?'栋':'格'}（一次性） · 建成后一级月配套维护 ¥${privateMaintenance({type:zone,level:1,footprint:newBuildingFootprint(t.id)})} / 栋 · 空置也计费`; }
const primaryTools=['inspect','roads','municipal','industrial','residential','commercial','religion','landscape','upgrade','landmark','move','bulldoze'];
const toolPrice=t=>{if(['inspect','upgrade','landmark','move','bulldoze'].includes(t.id))return '';const base=BUSINESS_KINDS[t.id]?.zone||t.id;const cost=BUSINESS_KINDS[t.id]?.cost??TOOLS[base]?.cost;return Number.isFinite(cost)?`<small class="tool-price">¥${number(cost)}${newBuildingFootprint(t.id)>1&&BUSINESS_KINDS[t.id]?' / 栋':['road','residential','commercial','industrial'].includes(base)?' / 格':''}</small>`:'';};
const toolButton=t=>`<button class="tool-button" data-tool="${t.id}" aria-label="${t.label}" aria-pressed="${t.id==='inspect'}" title="${t.help}">${icon(t.icon)}<span>${t.label}</span>${toolPrice(t)}${toolGroups.landscape.tools.includes(t.id)?`<small>占地 ${newBuildingFootprint(t.id)}×${newBuildingFootprint(t.id)} 格</small><small>美观最高 +${COMMUNITY_BUILDINGS[t.id]?.beauty||gardenStrength({type:t.id,level:1})}${COMMUNITY_BUILDINGS[t.id]?.service==='entertainment'?` · 娱乐 +${COMMUNITY_BUILDINGS[t.id].bonus}`:''}</small><small>提供住宅休闲景观覆盖</small>`:''}${['residential','commercial','industrial'].includes(BUSINESS_KINDS[t.id]?.zone)||isCommunityBusiness(t.id)||COMMUNITY_BUILDINGS[t.id]?.category==='religion' ?`<small>占地 ${newBuildingFootprint(t.id)}×${newBuildingFootprint(t.id)} 格</small>`:''}${(isUtility(t.id)||LARGE_UTILITIES[t.id])?`<small>占地 ${newBuildingFootprint(t.id)}×${newBuildingFootprint(t.id)} 格 · 容量 ${number(LARGE_UTILITIES[t.id]?.capacity||(t.id==='power'?750:900))}</small><small>一级月维护 ¥${number(LARGE_UTILITIES[t.id]?.maintenance||(t.id==='power'?150:80))} · 可升六级</small>`:''}${isCommunityBusiness(t.id)?`<small>一级岗位 ${COMMUNITY_BUILDINGS[t.id].jobs} · 工资与商业税</small>${COMMUNITY_BUILDINGS[t.id].beauty?`<small>美观 +${COMMUNITY_BUILDINGS[t.id].beauty} · 娱乐 +${COMMUNITY_BUILDINGS[t.id].bonus||0}</small>`:''}`:''}${ZONE_ECONOMY[BUSINESS_KINDS[t.id]?.zone||t.id]?`<small>一级月维护 ¥${privateMaintenance({type:BUSINESS_KINDS[t.id]?.zone||t.id,level:1,footprint:newBuildingFootprint(t.id)})}</small>`:''}${COMMUNITY_BUILDINGS[t.id]?.minPopulation?`<small data-unlock-population="${COMMUNITY_BUILDINGS[t.id].minPopulation}" ${(sim?.state.stats.population||0)>=COMMUNITY_BUILDINGS[t.id].minPopulation?'hidden':''}>${COMMUNITY_BUILDINGS[t.id].minPopulation/10000} 万人口解锁</small>`:''}${t.key?`<small class="shortcut">${t.key}</small>`:''}</button>`;
$('build-toolbar').innerHTML=primaryTools.map(id=>toolGroups[id]?`<button class="tool-button tool-group" data-tool-group="${id}" aria-label="${toolGroups[id].label}" aria-expanded="false" aria-controls="tool-submenu" title="展开${toolGroups[id].label}">${icon(toolGroups[id].icon)}<span>${toolGroups[id].label}</span><small class="group-chevron">⌃</small></button>`:toolButton(catalog.find(t=>t.id===id))).join('');
const toolSubmenu=document.createElement('nav');toolSubmenu.id='tool-submenu';toolSubmenu.className='tool-submenu glass';toolSubmenu.hidden=true;toolSubmenu.setAttribute('aria-label','建设子菜单');$('build-toolbar').before(toolSubmenu);
let openToolGroup=null;
function closeToolSubmenu(restoreFocus=false){
  const trigger=document.querySelector(`[data-tool-group="${openToolGroup}"]`);
  toolSubmenu.hidden=true;openToolGroup=null;$('game').classList.remove('menu-open');
  syncMobileOverview();
  document.querySelectorAll('[data-tool-group]').forEach(b=>b.setAttribute('aria-expanded','false'));
  if(restoreFocus)trigger?.focus();
}
function syncToolSelection(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===(LANDMARKS[currentTool]?'landmark':currentTool))));
  document.querySelectorAll('[data-tool-group]').forEach(b=>b.classList.toggle('has-selection',toolGroups[b.dataset.toolGroup].tools.includes(currentTool)));
}
function toggleToolGroup(id){
  if(openToolGroup===id){closeToolSubmenu();return;}
  if(compactMedia.matches){setMobileMapPanel(null);setPanelCollapsed('left',true);setPanelCollapsed('right',true);}
  closeToolSubmenu();openToolGroup=id;const group=toolGroups[id];
  const columns=Math.min(5,group.sections?Math.max(...group.sections.map(section=>section.tools.length)):group.tools.length);
  toolSubmenu.style.setProperty('--submenu-width',`${columns*140+(columns-1)*7+24}px`);
  const contents=group.sections
    ?`<div class="submenu-sections">${group.sections.map((section,index)=>`<section class="submenu-section" aria-labelledby="submenu-section-${index}"><strong class="submenu-section-title" id="submenu-section-${index}">${section.label}</strong>${section.description?`<p class="submenu-section-description">${section.description}</p>`:''}<div class="submenu-tools">${section.tools.map(tool=>toolButton(catalog.find(t=>t.id===tool))).join('')}</div></section>`).join('')}</div>`
    :`<div class="submenu-tools">${group.tools.map(tool=>toolButton(catalog.find(t=>t.id===tool))).join('')}</div>`;
  toolSubmenu.innerHTML=`<div class="submenu-heading"><strong>${group.label}</strong><button class="submenu-close" aria-label="关闭子菜单">×</button></div><div id="submenu-notice" role="status" hidden></div>${contents}`;
  toolSubmenu.hidden=false;$('game').classList.add('menu-open');document.querySelector(`[data-tool-group="${id}"]`).setAttribute('aria-expanded','true');
  syncMobileOverview();
  toolSubmenu.querySelector('.submenu-close').onclick=()=>closeToolSubmenu(true);
  toolSubmenu.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>{selectTool(btn.dataset.tool);document.querySelector(`[data-tool-group="${id}"]`).focus();if(tutorial?.action.tool===btn.dataset.tool)requestAnimationFrame(()=>renderer.focusOnboarding(tutorial.action.target));});
  syncToolSelection();refreshCommercialLocks();
  toolSubmenu.querySelector('[data-tool]')?.focus();
}
function refreshCommercialLocks(){
  if(!sim)return;
  document.querySelectorAll('[data-tool]').forEach(btn=>{
    const id=btn.dataset.tool;if(id!=='commercial'&&BUSINESS_KINDS[id]?.zone!=='commercial')return;
    const requirement=commercialPrerequisite(sim.state,id==='commercial'?undefined:id);
    btn.setAttribute('aria-disabled',String(!requirement.allowed));
    btn.classList.toggle('locked',!requirement.allowed);
    let label=btn.querySelector('.factory-requirement');
    if(!label){label=document.createElement('small');label.className='factory-requirement';btn.appendChild(label);}
    label.textContent=requirement.name?`${requirement.allowed?'✓':'需'} ${requirement.name}`:requirement.allowed?'仅生成已解锁商业':'需先建设对应工厂';
    btn.title=requirement.allowed?catalog.find(t=>t.id===id).help:requirement.reason;
  });
}
document.querySelectorAll('[data-tool-group]').forEach(btn=>btn.onclick=()=>toggleToolGroup(btn.dataset.toolGroup));
document.addEventListener('pointerdown',event=>{if(!toolSubmenu.contains(event.target)&&!event.target.closest('[data-tool-group]'))closeToolSubmenu();});


for (const [id,item] of Object.entries(LANDMARKS)) if(id!=='landmark') catalog.push({id,label:item.name,icon:'landmark',help:`${item.name}${item.footprint>1?` · ${item.footprint}×${item.footprint} 占地`:''} · ¥${item.cost} · 月维护 ${item.maintenance} · 临路建设`});
const landmarkDialog=document.createElement('dialog');landmarkDialog.id='landmark-dialog';document.body.appendChild(landmarkDialog);
function chooseLandmark(){
  landmarkDialog.innerHTML=`<div class="dialog-heading"><h2>城市名胜</h2><button id="close-landmarks" class="plain-icon" aria-label="关闭名胜目录">${icon('close')}</button></div><p>每种限一座 · 可修缮至三级 · 环境半径 8 / 10 / 12 格 · 荣誉积分 2 / 4 / 6 分</p><div class="landmark-options">${Object.entries(LANDMARKS).sort(([,a],[,b])=>a.population-b.population||a.cost-b.cost).map(([id,item])=>{
    const building=sim.state.buildings.find(b=>b.type===id),built=!!building,unlocked=sim.state.milestones[item.gate];
    return `<button data-landmark="${id}" ${built||!unlocked?'disabled':''}><strong>${item.name}</strong><span class="landmark-stage">${number(item.population)} 人阶段 · ${unlocked?'已解锁':'待达成'}</span><span>${item.description}</span><span>¥${number(item.cost)} · 月维护 ${item.maintenance}</span><small>${built?`已建成 · ${LANDMARK_LEVEL_NAMES[building.level-1]} · 在地图中点击查看修缮条件`:unlocked?'选择并放置':`完成 ${number(item.population)} 人城市目标解锁`}</small></button>`;
  }).join('')}</div>`;
  landmarkDialog.querySelectorAll('[data-landmark]').forEach(btn=>btn.onclick=()=>{closeDialog('landmark-dialog');selectTool(btn.dataset.landmark);});
  $('close-landmarks').onclick=()=>closeDialog('landmark-dialog');openDialog('landmark-dialog');
}

let sim, renderer;
let selected = null, hover = null, dragStart = null;
let moveSourceId = null;
let moveRoadSource = null;
let dragVersion,moveVersion;
let movePickedOnDrag=false,moveDraggedAfterPick=false;
let selectedActor = null;
let selectedJourney = null;
let currentTool = 'inspect', overlay = 'none', paused = false, speed = 1, started = false;
let lastTime = performance.now(), accumulator = 0, lastEditTick = null, undoReady = false;
let guideExpanded = null;
let objectiveExpanded = true;
let tutorialProgress=onboardingProgress(),tutorial=null,tutorialClock=false,tutorialPhase=null;
let keyboardCell = {x:8,y:32}, keyboardMode = false, shiftDown = false;
let toastTimeout, lastCelebrationState = {population:0,milestones:{}}, confirmAction = null, modeName = '示范城市';
let pointer = {x:0,y:0}, lastHoverId = '', lastBudgetKey = '', lastWorkforceKey = '';
let catalogRenderer=null,catalogTab='building',catalogCategory='all',catalogStatus='all',catalogData=null;
const catalogSelection={building:null,vehicle:null};
const catalogLevelById={};
const PREFIX = 'bayside-v1:';
let soloResume=null,coopUI,accountUI,soloRecord=null;
const coop=new CoopClient({
 onAuthChange:change=>accountChanged(change),
 onStatus:message=>{if(coop.cityId)$('save-state').textContent=message;},
 onNotice:message=>toast(message),
 onState:(view,changed,reset)=>{
  if(!renderer)return;
  if(changed){
   const previous=celebrationSnapshot(sim?.state);
   sim=Object.create(CitySimulation.prototype);sim.state=view.state;sim._undo=null;
   if(reset){selected=null;moveSourceId=null;moveRoadSource=null;selectTool('inspect');toast('房主恢复了城市，已同步新进度。');}
   else if(started){milestoneQueue.push(...reachedCelebrations(previous,celebrationSnapshot(sim.state)));if(milestoneQueue.length&&!anyDialog())showNextMilestone();}
   lastCelebrationState=celebrationSnapshot(sim.state);
  }
  paused=view.paused;speed=view.speed;renderer.setSpeed(speed);undoReady=view.canUndo;lastEditTick=sim.state.tick;
  if(changed){syncWorld({sameWorld:started&&!reset});if(hover&&currentTool!=='inspect')previewAt(hover);}else updateUI();
 }
});
const soloLibrary=new SoloLibrary(coop,{onStatus:(record,message)=>{if(!coop.cityId&&soloRecord===record)$('save-state').textContent=message;}});
pruneLegacyAccountCopies(soloLibrary.owner());
function updateAccountUI(){
 const account=coop.identity?.account;
 $('account-start').textContent=account?`我的城市 · ${coop.identity.actor.name}`:'登录 / 注册账号';
 $('account-status').textContent=account?`账号 ${account.username} · 新建单人城市自动保存到账号`:'游客模式 · 单人进度保存在此浏览器';
 $('account-button').title=account?`账号 ${account.username} · 我的城市`:'登录账号 · 我的城市';
}
function accountChanged({external=false}={}){
 if(coop.cityId&&renderer)leaveCoop();
 if(soloRecord&&soloRecord.owner!==coop.identity?.actor?.id){
  if(started){const latest=snapshot();soloRecord.dirty ||= soloRecord.snapshot.city!==latest.city;soloRecord.snapshot=latest;try{soloLibrary.persist(soloRecord);}catch{toast('本机存储空间不足，请先导出城市',true);}}
  soloRecord=null;started=false;paused=true;
  if(renderer){sim=new CitySimulation({demo:true});selected=null;undoReady=false;syncWorld();document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='account-dialog')d.close();});if(!$('account-dialog')?.open)openDialog('welcome-dialog');}
 }
 pruneLegacyAccountCopies(soloLibrary.owner());
 updateAccountUI();refreshContinue();
 if(external)accountUI?.refresh();
}
function savePrefix(){return soloRecord?PREFIX+'account:'+soloRecord.owner+':':PREFIX;}
function guestSaves(){
 try{const checkpoints=JSON.parse(localStorage.getItem(PREFIX+'checkpoints'))||[],manual=JSON.parse(localStorage.getItem(PREFIX+'manual'));return [manual,...checkpoints].filter((s,i,a)=>s&&typeof s.city==='string'&&!s.accountCity&&a.findIndex(other=>other?.city===s.city)===i);}catch{return [];}
}
function removeGuestSave(save){
 if(!save?.city)throw Error('找不到这份本地存档');
 const manual=JSON.parse(localStorage.getItem(PREFIX+'manual')||'null');
 if(manual?.city===save.city)localStorage.removeItem(PREFIX+'manual');
 const checkpoints=JSON.parse(localStorage.getItem(PREFIX+'checkpoints')||'[]').filter(item=>item?.city!==save.city);
 if(checkpoints.length)localStorage.setItem(PREFIX+'checkpoints',JSON.stringify(checkpoints));else localStorage.removeItem(PREFIX+'checkpoints');
 refreshContinue();toast('本地游客存档已删除。');
}
async function removeAccountSolo(row){
 if(!row?.id)throw Error('找不到这座账号城市');
 const active=!coop.cityId&&started&&soloRecord?.id===row.id;
 await soloLibrary.remove(row.id);
 if(active){
  soloRecord=null;started=false;paused=true;speed=1;tutorialProgress=onboardingProgress();tutorialClock=false;tutorialPhase=null;
  selected=null;moveSourceId=null;moveRoadSource=null;undoReady=false;lastEditTick=null;milestoneQueue.length=0;activeCelebration=null;
  sim=new CitySimulation({demo:true});renderer.setSpeed(speed);syncWorld();renderer.resetCamera();$('save-state').textContent='本地单人城市';
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());openDialog('welcome-dialog');
 }
 refreshContinue();toast('账号单人存档已永久删除。');return {active};
}
async function removeCooperativeCity(row){
 if(!row?.id)throw Error('找不到这座合作城市');
 if(coop.cityId===row.id)throw Error('请先离开正在游玩的合作城市，再删除存档');
 await coop.request('/cities/'+row.id,{method:'DELETE'});toast('合作城市及其服务器存档已永久删除。');
}
function pruneLegacyAccountCopies(owner){
 if(!owner)return;
 try{
  const savedCities=new Map();
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);if(!key?.startsWith('bayside-solo:'+owner+':')||key.includes(':conflict:'))continue;
   try{const record=JSON.parse(localStorage.getItem(key));if(record?.id&&typeof record.snapshot?.city==='string')savedCities.set(record.id,record.snapshot.city);}catch{}
  }
  const duplicate=item=>item?.accountCity?.owner===owner&&savedCities.get(item.accountCity.id)===item.city;
  const prefix=PREFIX+'account:'+owner+':',checkpoints=JSON.parse(localStorage.getItem(prefix+'checkpoints'))||[],remaining=checkpoints.filter(item=>!duplicate(item));
  if(remaining.length)localStorage.setItem(prefix+'checkpoints',JSON.stringify(remaining));else localStorage.removeItem(prefix+'checkpoints');
  const manual=JSON.parse(localStorage.getItem(prefix+'manual'));if(duplicate(manual))localStorage.removeItem(prefix+'manual');
 }catch{}
}
function retireBoundLocalCopies(bound,owner){
 try{
  const checkpoints=JSON.parse(localStorage.getItem(PREFIX+'checkpoints'))||[],remaining=checkpoints.filter(item=>item?.city!==bound.city);
  if(remaining.length)localStorage.setItem(PREFIX+'checkpoints',JSON.stringify(remaining));else localStorage.removeItem(PREFIX+'checkpoints');
  const manual=JSON.parse(localStorage.getItem(PREFIX+'manual'));if(manual?.city===bound.city)localStorage.removeItem(PREFIX+'manual');
  pruneLegacyAccountCopies(owner);
 }catch{}
}
async function loadAccountCity(record){
 if(record.owner!==soloLibrary.owner())throw Error('请登录这座城市所属的账号');
 CitySimulation.deserialize(record.snapshot.city);
 if(coop.cityId&&(coop.busy||(!coop.accessDenied&&coop.pending().length)))throw Error('合作城市还有操作正在保存或核对，请稍后再点击继续建设');
 if(!coop.cityId&&started&&!autosave())throw Error('请先导出当前城市');
 if(!coop.cityId&&started&&soloRecord?.id===record.id&&soloRecord.owner===record.owner)record=soloRecord;
 soloLibrary.persist(record);
 if(coop.cityId)leaveCoop();
 soloRecord=record;
 restoreSnapshot({...record.snapshot,accountCity:{id:record.id,owner:record.owner}});
}
async function mutate(method,...args){return coop.cityId?coop.command(method,args):sim[method](...args);}
function coopVersion(){return coop.cityId&&coop.view?{epoch:coop.view.epoch,revision:coop.view.revision}:undefined;}
function currentMayors(){return mayorIdentity(sim.state,coop.cityId?coop.view?.members||[]:null);}
async function mutateAt(version,method,...args){return coop.cityId?coop.command(method,args,version):sim[method](...args);}
async function enterCoop(id){
 if(coop.busy||(!coop.accessDenied&&coop.pending().length))throw Error('请等未确认的操作核对完成');
 if(!coop.cityId){if(started&&!autosave())throw Error('请先导出单人存档');soloResume={sim,started,paused,speed,tutorialProgress,tutorialClock,tutorialPhase};}
 tutorialProgress=onboardingProgress();tutorialClock=false;tutorialPhase=null;
 started=false;
 try{await coop.enter(id);}catch(e){leaveCoop();throw e;}
 history.replaceState(null,'',location.pathname+'#city='+encodeURIComponent(id));
 started=true;modeName='好友合作城市';selected=null;moveSourceId=null;moveRoadSource=null;milestoneQueue.length=0;activeCelebration=null;selectTool('inspect');guideExpanded=false;
 for(const d of document.querySelectorAll('dialog[open]'))if(d.id!=='coop-dialog')d.close();
 syncWorld();renderer.resetCamera();if(sim.state.stats.population<5)renderer.focusCell(9,32);coop.status();
}
function leaveCoop(){
 history.replaceState(null,'',location.pathname);
 coop.leave();if(soloResume){({sim,started,paused,speed,tutorialProgress,tutorialClock,tutorialPhase}=soloResume);soloResume=null;}
 else{sim=new CitySimulation({demo:true});started=false;paused=true;speed=1;tutorialProgress=onboardingProgress();tutorialClock=false;}
 selected=null;moveSourceId=null;moveRoadSource=null;undoReady=false;milestoneQueue.length=0;activeCelebration=null;selectTool('inspect');renderer.setSpeed(speed);syncWorld();renderer.resetCamera();$('save-state').textContent='本地单人城市';if(!started)openDialog('welcome-dialog');
}

function safeRead(key, fallback=null) { try { const value=JSON.parse(localStorage.getItem(savePrefix()+key)); if(Array.isArray(fallback))return Array.isArray(value)?value.filter(item=>item&&typeof item.city==='string'):fallback;return value&&typeof value.city==='string'?value:fallback; } catch { return fallback; } }
function safeWrite(key, value) { try { localStorage.setItem(savePrefix()+key, JSON.stringify(value)); return true; } catch { toast('浏览器存储空间不足，请导出存档保留城市。',true); return false; } }
function toast(message,error=false) { clearTimeout(toastTimeout); $('toast').textContent=message; $('toast').classList.toggle('error',error); $('toast').hidden=false; toastTimeout=setTimeout(()=>$('toast').hidden=true,4000); }
const milestoneQueue=[];
let activeCelebration=null;
function showNextMilestone(){
  if(!milestoneQueue.length)return;
  closeToolSubmenu();
  activeCelebration=milestoneQueue.shift();
  $('milestone-dialog').innerHTML=celebrationMarkup(activeCelebration,sim.state.districtName);
  $('milestone-continue').onclick=()=>closeDialog('milestone-dialog');
  openDialog('milestone-dialog');
}
$('milestone-dialog').addEventListener('close',()=>{
  if(activeCelebration?.street){
    const grand=activeCelebration.fireworks==='grand';renderer.celebrateResidents({grand});
    toast(`${number(activeCelebration.population)} 人庆典开始！${grand?'全城烟花与居民庆祝持续约 36 秒。':'街坊们正沿街挥手庆祝，礼花绽放持续约 24 秒。'}`);
  }
  activeCelebration=null;
  if(milestoneQueue.length)showNextMilestone();
});
function anyDialog() { return [...document.querySelectorAll('dialog')].some(d=>d.open); }
function isStopped() { return paused || moveSourceId !== null || moveRoadSource !== null || !started || document.hidden || anyDialog(); }
function openDialog(id) { if (!$(id).open) $(id).showModal(); $('map-tooltip').hidden=true; accumulator=0; renderer?.setPaused(true); }
function closeDialog(id) { $(id).close(); lastTime=performance.now(); renderer?.setPaused(isStopped()); }
document.querySelectorAll('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',()=>closeDialog(btn.closest('dialog').id)));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{lastTime=performance.now();accumulator=0;renderer?.setPaused(isStopped());}));
$('welcome-dialog').addEventListener('cancel',e=>e.preventDefault());
function confirm(title,description,action) { $('confirm-title').textContent=title;$('confirm-description').textContent=description;confirmAction=action;openDialog('confirm-dialog'); }
$('confirm-cancel').addEventListener('click',()=>{confirmAction=null;closeDialog('confirm-dialog');});
$('confirm-ok').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;closeDialog('confirm-dialog');action?.();});

function cellsFor(start,end) {
  if (!start || !end) return [];
  if (currentTool==='road' || (currentTool==='upgrade' && sim.tile(start.x,start.y)?.road)) {
    const cells=[];
    const pushLine=(a,b)=>{ const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y); for(let i=0;i<=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));i++)cells.push({x:a.x+dx*i,y:a.y+dy*i}); };
    const bend = shiftDown ? {x:start.x,y:end.y} : {x:end.x,y:start.y};
    pushLine(start,bend);pushLine(bend,end);
    return [...new Map(cells.map(c=>[c.x+','+c.y,c])).values()];
  }
  if(newBuildingFootprint(currentTool)>1)return [end];
  if (BUSINESS_KINDS[currentTool] || ['residential','commercial','industrial','bulldoze'].includes(currentTool)) {
    const cells=[];for(let y=Math.min(start.y,end.y);y<=Math.max(start.y,end.y);y++)for(let x=Math.min(start.x,end.x);x<=Math.max(start.x,end.x);x++)cells.push({x,y});return cells;
  }
  return [end];
}
function previewAt(cell) {
  if (!renderer || !sim || !started || currentTool==='inspect' || !cell) { renderer?.setPreview([],true);$('preview-cost').textContent='';return; }
  if(currentTool==='move' && moveSourceId===null && moveRoadSource===null){
    const tile=sim.tile(cell.x,cell.y),b=sim.state.buildings.find(b=>b.id===tile?.buildingId);
    const road=!!tile?.road&&!tile.bridge&&!(cell.x===0&&cell.y===32),selectable=!!b||road;
    renderer.setPreview(selectable?[cell]:[],selectable);
    $('preview-cost').textContent=b?'按住拖动这座建筑':road?'按住拖动这段道路':tile?.bridge?'桥梁需保持完整跨河结构':tile?.road?'城市入口道路不能移动':'请选择建筑或道路';
    $('preview-cost').classList.toggle('negative',false);return;
  }
  const start=dragStart||cell;
  const preview=sim.preview(currentTool,cellsFor(start,cell),{buildingId:moveSourceId,roadSource:moveRoadSource,roadsOnly:currentTool==='upgrade'&&!!sim.tile(start.x,start.y)?.road});
  const coverage=currentTool==='move'?(moveSourceId?movedServiceCoverage(sim.state,moveSourceId,cell):null):placementServiceCoverage(sim.state,currentTool,cell);
  renderer.setPreview(preview.cells?.length?preview.cells:cellsFor(dragStart||cell,cell),preview.valid,coverage?.cells);
  $('preview-cost').textContent=preview.valid?`${preview.cost<0?'+':'¥ '}${number(Math.abs(preview.cost))}${preview.affected?` · 影响 ${preview.affected} 处`:''}`:`${preview.reason||'无法在这里建设'}${preview.cost>0?' · ¥ '+number(preview.cost):''}`;
  $('preview-cost').classList.toggle('negative',!preview.valid);
  if(currentTool==='move'){
    $('preview-cost').textContent=preview.reason;
    if(moveRoadSource)renderer.previewMovingRoad(moveRoadSource,cell,preview.valid);
    else renderer.previewMovingBuilding(moveSourceId,cell,preview.valid);
  }
  if(coverage)$('preview-cost').textContent+=` · ${coverage.description}`;
}
function selectTool(id) {
  clearResidentJourney();
  if(id==='commercial'||BUSINESS_KINDS[id]?.zone==='commercial'){
    const requirement=commercialPrerequisite(sim.state,id==='commercial'?undefined:id);
    if(!requirement.allowed){
      if(openToolGroup){const notice=$('submenu-notice');notice.hidden=false;notice.innerHTML=esc(requirement.reason)+(requirement.required?'<button class="text-button" id="build-required-factory">去建设'+esc(requirement.name)+'</button>':'');$('build-required-factory')?.addEventListener('click',()=>selectTool(requirement.required));}
      else toast(requirement.reason,true);
      return;
    }
  }
  renderer?.setBuildingFilter(null);syncBuildingFilterUI();
  currentTool=id;dragStart=null;moveSourceId=null;moveRoadSource=null;dragVersion=undefined;moveVersion=undefined;movePickedOnDrag=false;moveDraggedAfterPick=false;accumulator=0;
  closeToolSubmenu();syncToolSelection();
  if(compactMedia.matches){setMobileMapPanel(null);setPanelCollapsed('left',true);setPanelCollapsed('right',true);}
  renderer?.setTool(id);
  $('toggle-upgrade-markers').hidden=id!=='upgrade';
  $('upgrade-map-actions').hidden=id!=='upgrade';
  updateAllRoadsButton();
  setRoadFocus(false);
  const tool=catalog.find(t=>t.id===id);
  $('tool-context-text').textContent=tool.help;
  $('tool-context').firstElementChild.innerHTML=icon(tool.icon);
  if(id==='upgrade'){if(compactMedia.matches)setMobileMapPanel('view');else setPanelCollapsed('right',false);}
  if(id==='bridge') toast('指向河面或岸边预览整座桥；两岸有落点、无建筑阻挡且资金足够即可建设。');
  if(id!=='inspect') {selected=null;renderer?.selectCell(null);updateInspector();}
  previewAt(hover);
}
document.querySelectorAll('[data-tool]').forEach(btn=>btn.addEventListener('click',()=>btn.dataset.tool==='landmark'?chooseLandmark():selectTool(btn.dataset.tool)));
function syncBuildingFilterUI(){
  const filter=renderer?.buildingFilter;
  document.querySelectorAll('[data-building-filter]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.buildingFilter===filter)));
  const status=$('building-filter-status');status.hidden=!filter;
  if(filter){const count=sim.state.buildings.filter(b=>matchesBuildingFilter(b,filter)).length;status.textContent='正在查看'+({residential:'住宅',commercial:'商业',industrial:'工业与水电'})[filter]+' · '+count+' 栋 · 点击地图空地恢复全部';}
}
document.querySelectorAll('[data-building-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  const filter=renderer.buildingFilter===btn.dataset.buildingFilter?null:btn.dataset.buildingFilter;
  if(currentTool!=='upgrade')selectTool('inspect');
  else {dragStart=null;closeToolSubmenu();}
  renderer.setBuildingFilter(filter);selected=null;renderer.selectCell(null);renderer.setPreview([]);updateInspector();syncBuildingFilterUI();
}));
document.querySelectorAll('[data-select-tool]').forEach(btn=>btn.addEventListener('click',()=>selectTool(btn.dataset.selectTool)));
let buildPending=false;
function finishMoveSelection(){
  renderer.clearMoveGhost();moveSourceId=null;moveRoadSource=null;selected=null;renderer.selectCell(null);$('tool-context-text').textContent=catalog.find(t=>t.id==='move').help;
}
async function commitBuild(start,end,confirmUpgrade=false,version) {
  if(buildPending || !started || currentTool==='inspect' || !start || !end || anyDialog())return;
  if(isUtility(currentTool)||LARGE_UTILITIES[currentTool]){
    const b=sim.state.buildings.find(b=>b.id===sim.tile(end.x,end.y)?.buildingId);
    if(b?.type===(LARGE_UTILITIES[currentTool]?.type||currentTool)){selectTool('inspect');handleSelect({x:b.x,y:b.y});return;}
  }
  if(currentTool==='upgrade'&&!confirmUpgrade&&!sim.tile(start.x,start.y)?.road){
    const b=sim.state.buildings.find(b=>b.id===sim.tile(end.x,end.y)?.buildingId);
    if(b){showUpgradeDetails(b);return;}
  }
  if(currentTool==='move' && moveSourceId===null && moveRoadSource===null){
    const tile=sim.tile(end.x,end.y),b=sim.state.buildings.find(b=>b.id===tile?.buildingId);
    if(!b&&!tile?.road){toast('请先点击要移动的建筑或道路',true);return;}
    if(!b&&tile.bridge){toast('桥梁需保持完整跨河结构，请使用桥梁工具重新规划',true);return;}
    if(!b&&end.x===0&&end.y===32){toast('城市入口道路不能移动',true);return;}
    moveSourceId=b?.id??null;moveRoadSource=b?null:{x:end.x,y:end.y};moveVersion=version??coopVersion();selected=b?{x:b.x,y:b.y}:{...moveRoadSource};renderer.selectCell(selected);updateInspector();accumulator=0;
    $('tool-context-text').textContent=`已选中${b?'建筑':'道路'} · 拖动后松开放下，也可点击空地放下 · ${coop.cityId?'其他成员可继续建设':'搬迁期间暂停'} · Esc 取消`;
    previewAt(end);return;
  }
  if(currentTool==='move'&&moveSourceId!==null){
    const preview=sim.previewMove(moveSourceId,end);
    if(preview.unchanged){finishMoveSelection();toast(preview.reason);previewAt(end);return;}
  }
  const placedTool=currentTool,guideStep=tutorialProgress.status==='active'?getOnboarding(sim,tutorialProgress):null;
  const previousHonor=mayorReputation(sim.state);
  const previousDrill=sim.state.civic?.incident;
  buildPending=true;
  let result;
  try{result=await mutateAt(currentTool==='move'?moveVersion:version,'build',currentTool,cellsFor(start,end),{buildingId:moveSourceId,roadSource:moveRoadSource,roadsOnly:currentTool==='upgrade'&&!!sim.tile(start.x,start.y)?.road});}
  finally{buildPending=false;}
  if(result.ok){if(currentTool==='move')finishMoveSelection();if(result.changed!==false){lastEditTick=sim.state.tick;undoReady=coop.cityId?!!coop.view?.canUndo:true;}syncWorld();const honor=mayorReputation(sim.state);const honorGain=honor.landmarkBonus-previousHonor.landmarkBonus;toast((result.message||'建设完成')+civicOutcome(previousDrill)+(honorGain>0?` · 名胜荣誉积分 +${honorGain} · 当前 Lv.${honor.level}`:''));}
  else{if(currentTool==='move'&&['TARGET_CHANGED','STALE','CITY_RESTORED'].includes(result.code)){selectTool('move');toast('建筑、道路或地块已有变化，请重新选择后移动。',true);}else toast(result.message||'无法建设',true);}
  if(result.ok&&guideStep?.action.tool===placedTool&&currentTool===placedTool){
    const next=getOnboarding(sim,tutorialProgress);
    if(next.id!==guideStep.id||next.action.kind!=='build')selectTool('inspect');
  }
  previewAt(end);
}
function showUpgradeDetails(b){
  if(!started||anyDialog())return;
  setPanelCollapsed('right',false);selected={x:b.x,y:b.y};renderer.selectCell(selected);updateInspector();
}
function handleSelect(cell) {if(!started||anyDialog()||currentTool!=='inspect')return;
  if(renderer.buildingFilter){const b=sim.state.buildings.find(b=>b.id===sim.tile(cell.x,cell.y)?.buildingId);if(!matchesBuildingFilter(b,renderer.buildingFilter)){renderer.setBuildingFilter(null);syncBuildingFilterUI();selected=null;renderer.selectCell(null);updateInspector();return;}}
setPanelCollapsed('right',false);selected=cell;renderer.selectCell(cell);updateInspector();}
function handleActor(actor) {
  if(!started || !actor || (anyDialog()&&!$('citizen-dialog').open))return;
  const story=getCitizenStory(sim.state,actor);
  if(!story){toast('这位市民已经离开了，去另一条街看看吧。');return;}
  clearResidentJourney();selectedActor=actor;selected=null;renderer.selectCell(null);updateInspector();
  renderCitizen(story);openDialog('citizen-dialog');
  if(tutorialProgress.status==='active'&&actor.kind!=='freight'&&story.home){tutorialProgress.metCitizen=true;updateUI();autosave();}
}
function renderFestivalCalendar(){
  const month=(sim?.state.month||1)-1,current=month%12+1;
  $('festival-calendar-title').textContent=`第 ${Math.floor(month/12)+1} 年 · 节庆日历`;
  $('festival-calendar-note').textContent=FESTIVAL_CALENDAR_NOTE;
  renderDragonRace();renderFestivalRewards();
  $('festival-calendar-months').innerHTML=Array.from({length:12},(_,i)=>{
    const f=FESTIVALS.find(item=>item.month===i+1);
    return `<section class="festival-month ${current===i+1?'current':''}" ${current===i+1?'aria-current="date"':''}><small>${i+1} 月${current===i+1?' · 本月':''}</small><strong>${f?`${f.symbol} ${esc(f.name)}`:'街区日常'}</strong><p>${f?esc(f.description):'逛逛街角小店，与邻居享受平常日子。'}</p></section>`;
  }).join('');
}
function renderFestivalRewards(){
  const games=sim.state.festivalGames,festival=festivalForMonth(sim.state.month),claimed=games.claims.includes(sim.state.month);
  $('festival-rewards').innerHTML='<h3>节庆装饰 · '+number(games.points)+' 积分</h3><p>永久解锁，随时切换或收起；装饰所有开放的公园和广场，不影响维护费。每个节日月份可领取 100 积分。</p><button class="secondary-button" id="festival-claim" '+(!festival||claimed?'disabled':'')+'>'+(festival?(claimed?'本次节日已领取':festival.name+' · 领取 100 积分'):'下个节日再来领取')+'</button><div class="reward-list">'+FESTIVAL_REWARDS.map(r=>'<button data-reward="'+r.id+'" aria-pressed="'+(games.decoration===r.id)+'" '+(!games.rewards.includes(r.id)&&games.points<r.cost?'disabled':'')+' title="'+esc(r.description)+'">'+esc(r.name)+'<br><small>'+(games.rewards.includes(r.id)?(games.decoration===r.id?'使用中 · 点击收起':'已解锁 · 点击使用'):r.cost+' 积分兑换')+'</small></button>').join('')+'</div>';
  const finish=result=>{let saved=true;if(result.ok){undoReady=false;syncWorld();saved=autosave();}renderFestivalCalendar();toast(result.message+(saved?'':'。请导出存档保留进度。'),!result.ok||!saved);};
  $('festival-claim').onclick=async()=>finish(await mutate('claimFestivalPoints'));
  $('festival-rewards').querySelectorAll('[data-reward]').forEach(btn=>btn.onclick=async()=>finish(await mutate('redeemFestivalReward',btn.dataset.reward)));
}
function renderDragonRace(){
  const {points,lastRace:race}=sim.state.festivalGames,year=Math.floor((sim.state.month-1)/12)+1;
  const available=(sim.state.month-1)%12===5&&race?.year!==year;
  $('dragon-race-panel').innerHTML=`<div class="dragon-heading"><h3>🐉 端午龙舟赛</h3><strong>节庆积分 ${number(points)}</strong></div><p>每年六月限一次 · 三队竞猜 · 猜中返还 3 倍（含本金），未中扣除下注积分。初始 1,000 积分，仅用于游戏节庆，不兑换现金，不消耗城市资金。</p>${available?`<div class="dragon-form"><label>支持的队伍<select id="dragon-team">${DRAGON_TEAMS.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>下注积分<select id="dragon-stake">${DRAGON_STAKES.map(n=>`<option value="${n}" ${points<n?'disabled':''}>${n} 积分</option>`).join('')}</select></label><button class="primary-button" id="dragon-start" ${points<50?'disabled':''}>确认竞猜并开赛</button></div>${points<50?'<p>积分不足，仍可查看往届赛果。</p>':''}`:`<p>${race?.year===year?'今年已完赛，明年六月再次开放。':'六月端午节开放竞猜。'}</p>`}${race?`<div class="dragon-results"><strong>第 ${race.year} 年赛果 · ${DRAGON_TEAMS[race.winner]}夺冠</strong>${DRAGON_TEAMS.map((name,i)=>`<div class="dragon-lane"><span>${name}${race.team===i?' · 你的选择':''}</span><div><i style="--finish:${race.winner===i?90:62+i*5}%">🛶</i></div></div>`).join('')}<p role="status">下注 ${race.stake} · 返还 ${race.payout} · 净${race.payout?'得':'失'} ${Math.abs(race.payout-race.stake)} 积分</p></div>`:''}`;
  $('dragon-start')?.addEventListener('click',async()=>{
    const result=await mutate('enterDragonRace',Number($('dragon-team').value),Number($('dragon-stake').value));
    let saved=true;if(result.ok){undoReady=false;saved=autosave();}
    renderDragonRace();renderFestivalRewards();toast(result.message+(saved?'':'。自动保存失败，请手动导出存档。'),!result.ok||!saved);
  });
}
$('festival-calendar-button').addEventListener('click',()=>{renderFestivalCalendar();openDialog('festival-calendar');});
$('close-festival-calendar').addEventListener('click',()=>closeDialog('festival-calendar'));

function renderCitizen(story) {
  const mood={happy:'心情不错',neutral:'街头日常',upset:'有点烦心'}[story.mood]||'街头日常';
  $('citizen-title').textContent=story.title;
  const event=story.event;
  $('citizen-content').innerHTML=`
    <div class="citizen-person"><span class="citizen-avatar ${esc(story.mood)}">${icon(selectedActor.kind==='yacht'?'boat':selectedActor.kind==='pedestrian'?'people':'traffic')}</span><div><strong>${esc(story.name)}</strong><small>${esc(story.role)}</small></div><span class="citizen-mood ${esc(story.mood)}">${mood}</span></div>
    <blockquote class="citizen-quote">“${esc(story.quote)}”</blockquote>
    ${story.personal?`<section class="citizen-diary"><div class="citizen-tags"><span>${esc(story.personal.occupation)}</span><span>${esc(story.personal.tag)}</span></div><h3>${esc(story.personal.title)}</h3><p>${esc(story.personal.text)}</p></section>`:''}
    ${story.journey?`<section class="citizen-trip"><small>此刻的出行 · ${esc(story.journey.label)}</small><strong>${esc(story.journey.from.name)} <span>→</span> ${esc(story.journey.to.name)}</strong><p>预计 ${number(story.journey.minutes)} 分钟 · ${story.journey.roadCells} 格道路${story.journey.companion?' · 和'+esc(story.journey.companion):''}</p><button class="primary-button" id="citizen-journey">在地图上看路线 ${icon('arrow')}</button></section>`:story.personal?'<p class="tip-note">暂时没有可显示的出行路线，看看住宅旁的道路是否通畅。</p>':''}
    ${story.festival?`<div class="citizen-festival"><strong>${story.festival.symbol} 第 ${story.festival.year} 年 · ${esc(story.festival.name)}</strong><p>${esc(story.festival.description)}</p></div>`:''}
    <details class="citizen-data"><summary>看看街区生活数据</summary><div class="citizen-facts">${(story.details||[]).map(d=>`<div><span>${esc(d.label)}</span><strong>${esc(d.value)}</strong></div>`).join('')}</div></details>
    ${story.home?`<button class="citizen-suggestion citizen-home" id="citizen-home">${icon('home')}<span>${selectedActor.kind==='freight'?'定位关联住宅':'定位到家'} · (${story.home.x}, ${story.home.y})</span>${icon('focus')}</button>`:''}
    ${story.suggestion?`<button class="citizen-suggestion" id="citizen-suggestion">${icon('focus')}<span>${esc(story.suggestion.label)}</span>${icon('arrow')}</button>`:''}
    ${story.social?`<section class="citizen-event"><div class="eyebrow">${icon('people')} ${esc(story.social.category||'邻里日常')} · ${esc(story.social.stage||'')}</div><h3>${esc(story.social.title)}</h3><p>${esc(story.social.description)}</p><button class="citizen-suggestion" id="citizen-social-venue">${icon('shop')}<span>见面地点 · ${esc(story.social.venue.name)} (${story.social.venue.x}, ${story.social.venue.y})</span>${icon('focus')}</button><button class="citizen-suggestion" id="citizen-social-neighbor">${icon('home')}<span>定位街坊${esc(story.social.neighbor.name)}的住宅</span>${icon('focus')}</button></section>`:''}
    ${event?`<section class="citizen-event"><div class="eyebrow">${icon('flag')} 街区小事件</div>${story.social?'<p>支持街坊把这场活动办起来</p>':`<h3>${esc(event.title)}</h3><p>${esc(event.description)}</p>`}<div class="event-effect">${icon('happy')}${esc(event.effect)}</div><button class="primary-button" id="citizen-event-action" ${event.available?'':'disabled'}>${esc(event.actionLabel)}<span>¥ ${number(event.cost)}</span></button>${event.reason?`<small>${esc(event.reason)}</small>`:''}</section>`:''}`;
  if(story.journey)$('citizen-journey').addEventListener('click',()=>{
    const actor=renderer.getActorDescriptor(selectedActor.id)||selectedActor;
    const current=getCitizenStory(sim.state,actor);
    if(!current?.journey){toast('这趟出行已经变化，请换位街坊聊聊。');return;}
    closeDialog('citizen-dialog');selectTool('inspect');
    selected=null;renderer.selectCell(null);renderer.setBuildingFilter(null);updateInspector();
    setPanelCollapsed('left',true);setPanelCollapsed('right',true);
    document.querySelector('[data-overlay="none"]').click();
    selectedJourney={actor,returning:!!actor.returning};refreshResidentJourney();renderer.focusResidentJourney();
  });
  if(story.social){
    const locateSocial=(target,venue)=>{
      const current=getCitizenStory(sim.state,selectedActor)?.social;
      if(!current||current.id!==story.social.id){
        const updated=getCitizenStory(sim.state,selectedActor);if(updated)renderCitizen(updated);
        toast('街坊的安排已经变化，请查看最新日常。');return;
      }
      const b=sim.state.buildings.find(b=>b.id===target.id);
      if(!b){toast('这个地点已经不存在了。',true);return;}
      closeDialog('citizen-dialog');selectTool('inspect');
      document.querySelector('[data-overlay="none"]').click();
      renderer.viewSize=Math.min(renderer.viewSize,14);renderer.focusCell(b.x,b.y);handleSelect({x:b.x,y:b.y});
      toast(venue?`已定位${current.venue.name}`:`已定位街坊${current.neighbor.name}的住宅`);
    };
    $('citizen-social-venue').addEventListener('click',()=>locateSocial(story.social.venue,true));
    $('citizen-social-neighbor').addEventListener('click',()=>locateSocial(story.social.neighbor.home,false));
  }
  if(story.home)$('citizen-home').addEventListener('click',()=>{
    const home=sim.state.buildings.find(b=>b.id===story.home.id&&b.type==='residential');
    if(!home){toast('这座住宅已经不存在了，请换位居民聊聊。',true);return;}
    closeDialog('citizen-dialog');selectTool('inspect');
    document.querySelector('[data-overlay="none"]').click();
    renderer.viewSize=Math.min(renderer.viewSize,14);renderer.focusCell(home.x,home.y);
    handleSelect({x:home.x,y:home.y});
    toast(`${selectedActor.kind==='freight'?'已定位关联住宅':`已定位${story.name}的家`} · (${home.x}, ${home.y})`);
  });
  if(story.suggestion)$('citizen-suggestion').addEventListener('click',()=>{
    const {suggestion}=story,location=suggestion.location||story.location;closeDialog('citizen-dialog');
    if(suggestion.action==='budget'){openBudget();return;}
    if(location)renderer.focusCell(location.x,location.y);
    if(['traffic','pollution','power','water'].includes(suggestion.overlay))document.querySelector(`[data-overlay="${suggestion.overlay}"]`).click();
    selectTool(catalog.some(t=>t.id===suggestion.tool)?suggestion.tool:'inspect');
    if(currentTool==='inspect'&&location)handleSelect(location);
    toast(suggestion.label);
  });
  if(event)$('citizen-event-action').addEventListener('click',async()=>{
    const result=await mutate('resolveCityEvent',event.id,selectedActor);
    let saved=true;
    if(result.ok){undoReady=false;syncWorld();saved=autosave();}
    const updated=getCitizenStory(sim.state,selectedActor);
    if(updated)renderCitizen(updated);
    toast(result.message+(saved?'':'。自动保存失败，请在菜单导出存档。'),!result.ok||!saved);
  });
}
function visitCitizen(){
  if(!started)return;
  selectTool('inspect');
  const actor=renderer.visitActor();
  if(actor)handleActor(actor);
  else toast(sim.state.stats.population>0?'附近暂时没有出行的居民，看看住宅旁的道路是否还在。':'等第一批居民入住后，街上就会有行人。先接通水电，再规划临路住宅。');
}
$('life-button').addEventListener('click',visitCitizen);
$('next-citizen').addEventListener('click',visitCitizen);
function clearResidentJourney(){selectedJourney=null;if(renderer?.residentRoute)renderer.setResidentJourney(null);$('resident-journey').hidden=true;$('game').classList.remove('journey-visible');}
function refreshResidentJourney(){
  if(!selectedJourney)return;
  const actor=renderer.getActorDescriptor(selectedJourney.actor.id)||selectedJourney.actor;
  const story=getCitizenStory(sim.state,{...actor,returning:selectedJourney.returning});
  if(!story?.journey){clearResidentJourney();toast('出行安排已变化，原路线已收起。');return;}
  selectedJourney.journey=story.journey;
  renderer.setResidentJourney(story.journey);$('resident-journey').hidden=false;
  $('game').classList.add('journey-visible');
  $('journey-title').textContent=story.name+' · '+story.journey.label;
  $('journey-summary').textContent=`${story.journey.from.name} → ${story.journey.to.name} · 预计 ${number(story.journey.minutes)} 分钟 · ${story.journey.roadCells} 格道路`;
  $('journey-return').textContent=selectedJourney.returning?'看出门路线':'看回家路线';
}
$('journey-close').addEventListener('click',clearResidentJourney);
$('journey-fit').addEventListener('click',()=>renderer.focusResidentJourney());
for(const [id,key]of [['journey-origin','from'],['journey-destination','to']])$(id).addEventListener('click',()=>{const place=selectedJourney?.journey?.[key];if(place){renderer.viewSize=Math.min(renderer.viewSize,14);renderer.focusCell(place.x,place.y);}});
$('journey-return').addEventListener('click',()=>{if(selectedJourney){selectedJourney.returning=!selectedJourney.returning;refreshResidentJourney();}});
$('signal-button').addEventListener('click',()=>{
  if(!started)return;
  selectTool('inspect');
  const cell=renderer.visitSignal();
  if(!cell){toast('三岔或十字路口会自动安装信号灯。先把几条陆地道路连起来。');return;}
  handleSelect(cell);
  toast(paused?'已定位路口。按 P 继续，观察车辆等灯与放行。':'红灯停、绿灯行；路口内的车辆会先驶离。');
});
function onHover(cell) {
  hover=cell;
  if(cell){keyboardCell={...cell};$('coordinate').textContent=`${cell.x} · ${cell.y}`;}
  if(!started||anyDialog()){ $('map-tooltip').hidden=true;return; }
  if(currentTool!=='inspect'){
    previewAt(cell);
    const b=currentTool==='upgrade'&&cell?sim.state.buildings.find(b=>b.id===sim.tile(cell.x,cell.y)?.buildingId):null;
    $('map-tooltip').classList.toggle('building-preview',!!b);
    $('map-tooltip').hidden=!b;
    if(b){
      const info=sim.getInfo(b.x,b.y),offer=sim.preview('upgrade',[{x:b.x,y:b.y}]);
      const basics=(info.metrics||[]).filter(m=>['居民 / 容量','员工 / 岗位','满意度','电力 / 供水','供电容量','供水容量','月维护','服务覆盖范围'].includes(m.label)).slice(0,4);
      $('map-tooltip').textContent=[info.title,`等级 ${b.level} / 6`,...basics.map(m=>`${m.label}：${m.value}`),offer.valid?`升级费用：¥${number(offer.cost)}`:offer.reason,'点击查看详情，再选择升级'].join('\n');
      positionTooltip();
    }
    return;
  }
  $('map-tooltip').classList.remove('building-preview');
  const id=cell?`${cell.x},${cell.y}`:'';
  if(id!==lastHoverId){lastHoverId=id;if(cell){const info=sim.getInfo(cell.x,cell.y);$('map-tooltip').textContent=info?.title||'河湾土地';} }
  $('map-tooltip').hidden=!cell;
  positionTooltip();
}
function positionTooltip(){const t=$('map-tooltip');if(t.hidden)return;t.style.left=clamp(pointer.x+15,10,innerWidth-t.offsetWidth-15)+'px';t.style.top=clamp(pointer.y+16,105,innerHeight-145)+'px';}
$('world').addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};positionTooltip();});
$('world').addEventListener('pointerleave',()=>{$('map-tooltip').hidden=true;});

// Reserve the actual legend height, including wrapped text and collapsed controls.
function layoutOverlayPanels(){
  if(compactMedia.matches){
    document.querySelectorAll('.left-rail,.right-rail').forEach(rail=>rail.style.maxHeight='');
    $('overlay-legend').style.bottom='';
    return;
  }
  const game=$('game').getBoundingClientRect();
  const controls=document.querySelector('.overlay-controls').getBoundingClientRect();
  const legend=$('overlay-legend');
  legend.style.bottom=Math.max(0,game.bottom-controls.top+8)+'px';
  const boundaries=[legend.hidden?controls:legend.getBoundingClientRect(),document.querySelector('.map-controls').getBoundingClientRect()];
  if(!$('upgrade-map-actions').hidden)boundaries.push($('upgrade-map-actions').getBoundingClientRect());
  for(const rail of document.querySelectorAll('.left-rail,.right-rail')){
    const rect=rail.getBoundingClientRect();
    if(!rect.width)continue;
    const overlapping=boundaries.filter(boundary=>boundary.width&&rect.left<boundary.right&&rect.right>boundary.left);
    rail.style.maxHeight=overlapping.length?Math.max(0,Math.min(...overlapping.map(boundary=>boundary.top))-rect.top-12)+'px':'';
  }
}
const overlayLayoutObserver=new ResizeObserver(layoutOverlayPanels);
overlayLayoutObserver.observe(document.querySelector('.overlay-controls'));
overlayLayoutObserver.observe($('overlay-legend'));
overlayLayoutObserver.observe(document.querySelector('.map-controls'));
overlayLayoutObserver.observe($('upgrade-map-actions'));
document.querySelectorAll('.left-rail,.right-rail').forEach(rail=>overlayLayoutObserver.observe(rail));
window.addEventListener('resize',layoutOverlayPanels);
const facilityLegend='<span>发光描边为本领域设施</span>';
const overlayDescriptions={none:'',traffic:'<span>道路拥堵</span><i class="legend-square" style="background:#6ca779"></i>畅通<i class="legend-square" style="background:#dbb15a"></i>繁忙<i class="legend-square" style="background:#c66b53"></i>拥堵',power:'<i class="legend-square" style="background:#d8c968"></i>已供电<i class="legend-square" style="background:#c86e58"></i>缺电 / 未连接'+facilityLegend,water:'<i class="legend-square" style="background:#63aebe"></i>已供水<i class="legend-square" style="background:#c86e58"></i>缺水 / 未连接'+facilityLegend,pollution:'<span>工业污染</span><i class="legend-square" style="background:#9aad71"></i>低<i class="legend-square" style="background:#ae8254"></i>高'+facilityLegend};
overlayDescriptions.fire='<i class="legend-square" style="background:#69b596"></i>消防可达<i class="legend-square" style="background:#c88765"></i>未覆盖 · 按道路计算'+facilityLegend;
for(const [id,layer] of Object.entries(SERVICE_LAYERS)){
  const button=document.createElement('button');button.dataset.overlay=id;button.textContent=layer.label;button.setAttribute('aria-pressed','false');button.title=`查看${layer.label}服务覆盖`;
  $('overlay-options').appendChild(button);
  overlayDescriptions[id]=`<span>${layer.label}覆盖</span><i class="legend-square" style="background:#${layer.color.toString(16).padStart(6,'0')}"></i>已覆盖<i class="legend-square" style="background:#d98354"></i>未覆盖街区 · 仅计正常运行设施${facilityLegend}`;
}
$('overlay-toggle').addEventListener('click',()=>{
  if(compactMedia.matches){setMobileMapPanel(null);$('mobile-layers-toggle').focus();return;}
  const collapsed=!$('overlay-options').hidden;
  $('overlay-options').hidden=collapsed;
  $('overlay-toggle').setAttribute('aria-expanded',String(!collapsed));
  $('overlay-toggle').setAttribute('aria-label',collapsed?'展开图层栏':'收起图层栏');
  $('overlay-toggle').title=collapsed?'展开图层栏':'收起图层栏';
  $('overlay-toggle-text').textContent=collapsed?'图层':'收起';
  layoutOverlayPanels();
});
overlayDescriptions.landscape='<span>休闲景观</span><i class="legend-square" style="background:#97bd87"></i>低<i class="legend-square" style="background:#40996b"></i>高<i class="legend-square" style="background:#d98354"></i>未覆盖街区 · 综合美观与娱乐服务'+facilityLegend;
document.querySelectorAll('[data-overlay]').forEach(btn=>btn.addEventListener('click',()=>{
  overlay=btn.dataset.overlay;renderer.setOverlay(overlay);
  document.querySelectorAll('[data-overlay]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.overlay===overlay)));
  $('overlay-legend').innerHTML=overlayDescriptions[overlay];$('overlay-legend').hidden=overlay==='none'||(renderer.roadFocus&&overlay!=='traffic');
  $('mobile-layer-label').textContent='图层 · '+btn.textContent;
  if(compactMedia.matches){setMobileMapPanel(null);$('mobile-layers-toggle').focus();}
}));
function setRoadFocus(enabled){
  renderer?.setRoadFocus(enabled);
  $('road-focus').setAttribute('aria-pressed',String(enabled));
  $('road-focus').textContent=enabled?'恢复建筑':'道路专注';
  $('overlay-legend').hidden=overlay==='none'||(enabled&&overlay!=='traffic');
}
function updateLightingButton(){
  const mode=renderer.lightingMode,labels={day:'☀ 白天',night:'☾ 夜晚',auto:'◐ 自动昼夜'};
  $('lighting-mode').textContent=labels[mode];
  $('lighting-mode').setAttribute('aria-label','昼夜模式：'+labels[mode]+'，点击切换');
  $('lighting-mode').title='白天 → 夜晚 → 自动昼夜；自动模式约两分钟一轮，随模拟速度变化，暂停时停止';
}
$('lighting-mode').addEventListener('click',()=>{
  const modes=['day','night','auto'];renderer.setLightingMode(modes[(modes.indexOf(renderer.lightingMode)+1)%3]);updateLightingButton();
  try{localStorage.setItem(PREFIX+'lighting-mode',renderer.lightingMode);}catch{}
});
$('road-focus').addEventListener('click',()=>{setRoadFocus(!renderer?.roadFocus);previewAt(hover);});
function updateAllRoadsButton(){
  if(currentTool!=='upgrade')return;
  const offer=sim.previewUpgradeAllRoads(),button=$('upgrade-all-roads');
  button.coopVersion=coopVersion();
  button.disabled=!offer.valid;
  button.innerHTML=offer.cells.length?`全部道路升至 ${offer.targetLevel} 级<small>${offer.cells.length} 格 · ¥${number(offer.cost)} · 月维护 +¥${number(offer.maintenanceIncrease)}</small>`:offer.reason;
  button.title=offer.reason||'包含桥梁，逐级费用合计；点击立即升级，可在时间推进前撤销';
  if(!offer.valid&&offer.cells.length)button.innerHTML+=`<small>${esc(offer.reason)}</small>`;
}
$('upgrade-all-roads').addEventListener('click',async()=>{
  if(!started||anyDialog()||currentTool!=='upgrade')return;
  const result=await mutateAt($('upgrade-all-roads').coopVersion,'upgradeAllRoads');
  if(result.ok){lastEditTick=sim.state.tick;undoReady=coop.cityId?!!coop.view?.canUndo:true;syncWorld();autosave();}
  toast(result.message,!result.ok);updateAllRoadsButton();
});
$('toggle-upgrade-markers').addEventListener('click',()=>{
  const visible=renderer.upgradeMarkersVisible===false;
  renderer.setUpgradeMarkersVisible(visible);
  $('toggle-upgrade-markers').setAttribute('aria-pressed',String(visible));
  $('toggle-upgrade-markers').textContent=visible?'隐藏升级箭头':'显示升级箭头';
  $('toggle-upgrade-markers').title=visible?'隐藏建筑上方的可升级箭头':'显示满足升级条件且资金足够的建筑箭头';
});
$('zoom-in').addEventListener('click',()=>renderer.zoomBy(1/1.2));
$('zoom-out').addEventListener('click',()=>renderer.zoomBy(1.2));
$('rotate').addEventListener('click',()=>renderer.rotate(1));
$('home-view').addEventListener('click',()=>{renderer.resetCamera();if(sim.state.stats.population<5)renderer.focusCell(9,32);});

function bar(label,value,max,iconName) {const percent=max>0?value/max*100:0;return `<div class="service-row">${icon(iconName)}<div class="service-data"><div class="service-numbers"><span>${label}</span><strong>${number(value)} / ${number(max)}</strong></div><div class="service-track"><i class="${percent>90||!max?'warning':''}" style="width:${clamp(percent,0,100)}%"></i></div></div></div>`;}
function setPanelCollapsed(side,collapsed){
  panelPreferences[compactMedia.matches?'compact':'desktop'][side]=collapsed;
  $('game').classList.toggle(side+'-collapsed',collapsed);
  const button=$('toggle-'+side+'-panel');button.setAttribute('aria-expanded',String(!collapsed));button.textContent=(collapsed?'展开':'收起')+(side==='left'?'城市面板':'详情面板');
  if(!collapsed&&compactMedia.matches){setPanelCollapsed(side==='left'?'right':'left',true);closeToolSubmenu();setMobileMapPanel(null);}
  syncMobileOverview();
}
for(const side of ['left','right'])$('toggle-'+side+'-panel').onclick=()=>{
  const collapsed=!$('game').classList.contains(side+'-collapsed');
  setPanelCollapsed(side,collapsed);
  if(compactMedia.matches&&!collapsed)$(side==='left'?'close-mobile-city':'close-inspector').focus({preventScroll:true});
};
function setMobileMapPanel(panel){
  for(const name of ['view','layers']){
    $('game').classList.toggle(name+'-open',panel===name);
    $('mobile-'+name+'-toggle').setAttribute('aria-expanded',String(panel===name));
  }
  if(panel){closeToolSubmenu();setPanelCollapsed('left',true);setPanelCollapsed('right',true);}
  if(panel==='layers'){
    $('overlay-options').hidden=false;
    $('overlay-toggle').setAttribute('aria-expanded','true');
    $('overlay-toggle').setAttribute('aria-label','收起图层栏');
    $('overlay-toggle').title='收起图层栏';
    $('overlay-toggle-text').textContent='收起图层';
  }
  syncMobileOverview();
}
for(const name of ['view','layers'])$('mobile-'+name+'-toggle').onclick=()=>setMobileMapPanel($('game').classList.contains(name+'-open')?null:name);
$('close-mobile-city').onclick=()=>{setPanelCollapsed('left',true);$('toggle-left-panel').focus();};
$('close-mobile-map').onclick=()=>{setMobileMapPanel(null);$('mobile-view-toggle').focus();};
function syncCompactLayout(){
  $('game').classList.toggle('compact-ui',compactMedia.matches);
  closeToolSubmenu();setMobileMapPanel(null);
  const preference={...panelPreferences[compactMedia.matches?'compact':'desktop']};
  for(const side of ['left','right'])setPanelCollapsed(side,preference[side]);
  $('close-inspector').hidden=!selected&&!compactMedia.matches;
  $('close-inspector').setAttribute('aria-label',compactMedia.matches?'收起详情面板':'返回城市概览');
  layoutOverlayPanels();
}
compactMedia.addEventListener('change',syncCompactLayout);
syncCompactLayout();
function updateInspector() {
  if(!sim)return;
  const s=sim.state.stats;
  $('inspector').classList.toggle('city-overview',!selected);
  $('close-inspector').hidden=!selected&&!compactMedia.matches;
  const upgradePanel=$('inspector-upgrade');
  upgradePanel.replaceChildren();upgradePanel.hidden=true;
  if(selected){
    const info=sim.getInfo(selected.x,selected.y);
    $('inspector-eyebrow').textContent=`街区档案 · ${selected.x}, ${selected.y}`;
    $('inspector-title').textContent=renderer.getSignalInfo(selected.x,selected.y)?'信号灯路口':info.title||'城市土地';$('inspector-subtitle').textContent=info.subtitle||'';
    const panel=$('inspector-content'),key=info.buildingId??`${selected.x},${selected.y}`;
    if(panel.dataset.selection!==String(key))$('inspector').scrollTop=0;
    const expanded=panel.dataset.selection===String(key)&&panel.querySelector('details')?.open;
    const priorities=['居民 / 容量','满意度','员工 / 岗位','道路连接','电力 / 供水','周边污染','平均通勤','供电容量','供水容量','服务覆盖范围','当前覆盖','月维护','下一阶段'];
    const mayors=currentMayors();
    const metrics=(info.metrics||[]).map(m=>mayors.cooperative&&m.label==='市长姓名'?{label:'合作市长',value:mayors.names.join('、')}:m),core=metrics.length>12?priorities.flatMap(label=>metrics.filter(m=>m.label===label)):metrics;
    const extra=metrics.filter(m=>!core.includes(m));
    const rows=list=>list.map(m=>`<div class="fact-row"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('');
    panel.dataset.selection=String(key);
    panel.innerHTML=(info.problem?`<div class="problem-note">${esc(info.problem)}</div>`:'')+rows(core)+(info.tip?`<p class="tip-note">${esc(info.tip)}</p>`:'');
    const details=extra.length?`<details class="inspector-details" ${expanded?'open':''}><summary>服务覆盖与建筑详情（${extra.length} 项）</summary>${rows(extra)}</details>`:'';

    const b=sim.state.buildings.find(b=>b.id===sim.tile(selected.x,selected.y)?.buildingId),inspectionVersion=coopVersion();
    if(b?.type==='marina'){
      const card=document.createElement('section');card.className='supply-card';
      const routes=yachtRoutes(sim.state).filter(e=>e.marina.id===b.id);
      card.innerHTML='<strong>码头游艇</strong><p>富裕居民每月积累购船资金；一户一艇，当前 '+marinaBerths(sim.state,b).length+' 个泊位，升级码头可继续扩容。</p>'+(!shipyardReady(sim.state)?'<p>缺少正常运营的造船厂，暂不能购买新游艇。</p><button data-build-shipyard>去建设造船厂</button>':'')+(routes.length?routes.map(e=>'<button data-yacht="'+e.boat.id+'">'+esc(YACHT_TYPES[e.boat.kind].name)+' · 查看船主与航行状态</button>').join(''):'<p>暂无游艇，等待高级住宅居民积蓄足够。</p>');
      card.querySelector('[data-build-shipyard]')?.addEventListener('click',()=>selectTool('shipyard'));
      card.querySelectorAll('[data-yacht]').forEach(btn=>btn.onclick=()=>{const entry=routes.find(e=>e.boat.id===Number(btn.dataset.yacht)),pose=yachtPose(entry,renderer.yachtClock||sim.state.tick*3);handleActor({id:'yacht-'+entry.boat.id,yachtId:entry.boat.id,kind:'yacht',...pose});});panel.prepend(card);
    }
    if(b?.type==='commercial'){
      const supply=commercialSupply(sim.state,b);
      if(supply){
        const card=document.createElement('section');card.className='supply-card';
        card.innerHTML='<strong>对应工厂 · '+esc(supply.name)+'</strong><p>'+(supply.suppliers.some(f=>f.ready)?'开店条件已满足':'暂时没有正常运行的对应工厂')+'</p><p>对应工厂用于开店解锁；已开业商铺不会因此停业。</p>'+supply.suppliers.slice(0,3).map(f=>'<button data-supplier="'+f.id+'">定位工厂 ('+f.x+', '+f.y+') · '+esc(f.status)+'</button>').join('')+'<button data-build-supplier>建设'+esc(supply.name)+'</button>';
        card.querySelectorAll('[data-supplier]').forEach(btn=>btn.onclick=()=>{const factory=sim.state.buildings.find(f=>f.id===Number(btn.dataset.supplier));if(factory){selectTool('inspect');renderer.focusCell(factory.x,factory.y);handleSelect({x:factory.x,y:factory.y});}});
        card.querySelector('[data-build-supplier]').onclick=()=>selectTool(supply.required);
        panel.prepend(card);
      }
    }
    if(b&&currentTool!=='move'){
      const rotation=document.createElement('section');rotation.className='building-rotation';rotation.setAttribute('aria-label','旋转选中建筑');
      const label=document.createElement('small');label.textContent='建筑朝向 · '+((b.rotation||0)*90)+'°';rotation.appendChild(label);
      for(const [direction,text]of [[-1,'向左旋转 90°'],[1,'向右旋转 90°']]){
        const button=document.createElement('button');button.className='secondary-button';button.textContent=text;
        button.onclick=async()=>{const result=await mutateAt(inspectionVersion,'rotateBuilding',b.id,direction);if(result.ok){lastEditTick=sim.state.tick;undoReady=coop.cityId?!!coop.view?.canUndo:true;syncWorld();autosave();}toast(result.message,!result.ok);};rotation.appendChild(button);
      }
      panel.prepend(rotation);

      const btn=document.createElement('button');btn.className='secondary-button facility-toggle';btn.textContent='移动这座建筑';btn.addEventListener('click',()=>{const cell={x:b.x,y:b.y};selectTool('move');commitBuild(cell,cell);});$('inspector-content').appendChild(btn);
    }
    if(b&&['inspect','upgrade'].includes(currentTool)){
      const offer=upgradeOffer(b,sim.state);
      if(offer.cost!==undefined){
        upgradePanel.hidden=false;
        const preview=sim.preview('upgrade',[{x:b.x,y:b.y}]);
        const btn=document.createElement('button');btn.className='primary-button';
        btn.textContent=`↑ 升至 ${b.level+1} 级 · ¥${number(preview.cost||offer.cost)}`;
        btn.disabled=!preview.valid;btn.title=preview.valid?offer.reason:preview.reason;
        btn.addEventListener('click',()=>{const cell={x:b.x,y:b.y};if(currentTool!=='upgrade')selectTool('upgrade');commitBuild(cell,cell,true,inspectionVersion);showUpgradeDetails(b);});
        upgradePanel.appendChild(btn);
        if(offer.benefit){const benefit=document.createElement('small');benefit.textContent=offer.benefit;upgradePanel.appendChild(benefit);}
        const note=document.createElement('small');note.textContent=preview.valid?(isUtility(b.type)?'改造期间保持原有容量，完工后提升供应。':LANDMARKS[b.type]?'修缮期间保留已有荣誉积分，完工后增加 2 分并提升景观与夜景；占地不变。':b.type==='marina'?'码头改造完成后增加泊位、岗位与娱乐服务范围。':'升级后可继续选择其他建筑'):preview.reason;
        upgradePanel.appendChild(note);
        if(offer.stage){
          const card=document.createElement('section');card.className='upgrade-stage-card';
          card.innerHTML=`<div class="upgrade-stage-heading"><strong>${esc(offer.stage.title)}</strong><span>${offer.stage.completed} / ${offer.stage.total} 项完成</span></div><p>这是全城共同条件，任意建筑达到要求都会更新这里的进度。</p><div class="upgrade-stage-list">${offer.stage.requirements.map(item=>`<div class="growth-requirement ${item.met?'met':''}"><strong>${item.met?'✓':'○'} ${esc(item.label)}</strong><span>${esc(item.detail||'')}</span></div>`).join('')}</div>`;
          panel.appendChild(card);
        }
      }
    }
    if(b&&['fireStation','cityHall'].includes(b.type)){
      const btn=document.createElement('button');btn.className='primary-button facility-toggle';btn.textContent='打开城市政务';btn.addEventListener('click',openCivic);$('inspector-content').appendChild(btn);
    }
    const drill=sim.state.civic?.incident;
    if(drill&&drill.x===selected.x&&drill.y===selected.y){
      const note=document.createElement('div');note.className='civic-incident-note';note.innerHTML=`${icon('fireStation')}<div><strong>安全消防演练 · ${drill.stage==='responding'?'消防车出动中':'现场处置中'}</strong><p>本阶段剩余约 ${number(drill.remainingTicks*3)} 模拟秒。${paused?'继续模拟后推进。':'居民与建筑不会受损。'}</p></div>`;$('inspector-content').appendChild(note);
    }
    if(b&&['power','water','park','plaza',...Object.keys(LANDMARKS),...Object.keys(COMMUNITY_BUILDINGS),...Object.keys(DECORATIONS),'fireStation','cityHall'].includes(b.type)){
      const btn=document.createElement('button');btn.className='secondary-button facility-toggle';btn.textContent=b.active?'暂停设施，节省维护':'重新启用设施';btn.addEventListener('click',async()=>{const previousDrill=sim.state.civic?.incident;const result=await mutate('setBuildingActive',b.id,!b.active);undoReady=false;syncWorld();toast(result.message+civicOutcome(previousDrill),!result.ok);});$('inspector-content').appendChild(btn);
    }
    if(details)panel.insertAdjacentHTML('beforeend',details);
    $('city-alerts').innerHTML='';
  }else{
    delete $('inspector-content').dataset.selection;
    if(currentTool==='upgrade'){
      const hall=cityHallRequirement(sim.state.buildings),unlocked=sim.state.milestones.density,roadLevel=unlockedRoadLevel(sim.state),roadsUnlocked=roadLevel>1;
      upgradePanel.hidden=false;
      upgradePanel.innerHTML=unlocked?'<strong>升级模式</strong><small>当前人口已开放 '+roadLevel+' 级道路；道路后续等级仍只看人口。供电站、水塔、住商工与公园广场二级升级已开放，其他公共设施需完成 2,000 人阶段；三级建筑起还要完成包含景观覆盖与社区美观的领域协同。</small>':
        roadsUnlocked?'<strong>'+roadLevel+' 级道路已按人口开放</strong><small>从道路上拖动即可逐级升级。供电站、水塔、住宅、商业和工业二级升级还需市政府正常办公。</small><small>'+esc(hall.label+'：'+hall.detail)+'</small><button id="upgrade-hall" class="secondary-button">'+(hall.exists?'定位市政府':'建设市政府 · ¥3,000')+'</button>':
        '<strong>人口达到 1,000，开放道路升级</strong><small>道路升级只看人口；供电、供水和私人建筑二级升级还需市政府正常办公。</small><small>当前人口 '+number(s.population)+' / 1,000</small><small>'+esc(hall.label+'：'+hall.detail)+'</small>'+(!sim.state.milestones.bridge?'<small>城市成长任务仍会继续记录人口与就业进度。</small>':'')+'<button id="upgrade-hall" class="secondary-button">'+(hall.exists?'定位市政府':'建设市政府 · ¥3,000')+'</button>';
      $('upgrade-hall')?.addEventListener('click',()=>{const b=sim.state.buildings.find(b=>b.type==='cityHall');if(b){selectTool('inspect');renderer.focusCell(b.x,b.y);handleSelect({x:b.x,y:b.y});}else selectTool('cityHall');});
    }
    $('inspector-eyebrow').textContent='城市脉搏';$('inspector-title').textContent=s.population?'小城，正在生长':'从第一条路开始';$('inspector-subtitle').textContent=s.population?'看看街区需要什么，再决定下一步。':'把入口道路延伸到你想建设的地方。';
    const gathering=sim.state.cityLife?.activeEvent;
    $('inspector-content').innerHTML=bar('电力容量',s.powerUsed,s.powerCapacity,'power')+bar('供水容量',s.waterUsed,s.waterCapacity,'water')+`<hr class="inspector-rule"><div class="fact-row"><span>民营就业 / 岗位</span><strong>${number(s.employed)} / ${number(s.jobs)}</strong></div><div class="fact-row"><span>事业单位在岗</span><strong>${number(s.workforceReport?.summary.publicWorkers)} 人</strong></div><div class="fact-row"><span>交通畅通度</span><strong>${number(s.traffic)}%</strong></div><div class="fact-row"><span>已建建筑</span><strong>${sim.state.buildings.length} 栋</strong></div>`+(gathering?`<div class="city-event-badge">${icon('happy')}${esc(eventTitle(gathering.kind))}进行中 · 满意度 +${number(gathering.bonus)}</div>`:'');
    const alerts=(s.alerts||[]).slice(0,3);
    $('city-alerts').innerHTML=alerts.length?alerts.map((a,i)=>`<button class="alert-item ${a.severity==='danger'?'danger':''}" data-alert="${i}">${icon('alert')}<span>${esc(a.text)}</span></button>`).join(''):`<div class="all-good">${icon('check')}城市运转良好</div>`;
    $('city-alerts').querySelectorAll('[data-alert]').forEach(btn=>btn.addEventListener('click',()=>{
      const a=alerts[Number(btn.dataset.alert)];
      if(Number.isFinite(a.x)&&Number.isFinite(a.y)){renderer.focusCell(a.x,a.y);selectTool('inspect');handleSelect({x:a.x,y:a.y});}
      else if(/供电站|电力容量/.test(a.text))selectTool('power');
      else if(/水塔|供水容量/.test(a.text))selectTool('water');
      else if(/缺少工作/.test(a.text))selectTool('industrial');
      else if(/道路拥堵/.test(a.text)){document.querySelector('[data-overlay="traffic"]').click();selectTool('road');}
      else if(/消防|市政府/.test(a.text))openCivic();
      else openBudget();
    }));
  }
  updateSignalPanel();
}
function updateSignalPanel(){
  const panel=$('signal-inspector');
  const info=selected&&renderer?.getSignalInfo(selected.x,selected.y);
  panel.hidden=!info;
  if(!info){panel.dataset.state='';return;}
  const seconds=Math.max(0,Math.ceil(info.remaining));
  const key=[info.ns,info.ew,seconds,info.waiting].join(':');
  if(panel.dataset.state===key)return;
  panel.dataset.state=key;
  const colors={red:'红灯',yellow:'黄灯',green:'绿灯'};
  const row=(label,color)=>`<div class="signal-direction"><span>${label}</span><span class="signal-lamps" aria-hidden="true">${['red','yellow','green'].map(c=>`<i class="${c} ${color===c?'lit':''}"></i>`).join('')}</span><strong>${colors[color]||'红灯'}</strong></div>`;
  panel.innerHTML=`<div class="signal-heading"><span>${icon('signal')}路口信号</span><b>${seconds} 秒后切换</b></div>${row('南北向',info.ns)}${row('东西向',info.ew)}<div class="signal-queue"><span>当前排队</span><strong>${number(info.waiting)} 辆</strong></div><p>黄灯停止新车进入；路口内车辆先通过，再切换方向。</p>`;
}
$('close-inspector').addEventListener('click',()=>{if(compactMedia.matches){setPanelCollapsed('right',true);$('toggle-right-panel').focus();return;}selected=null;renderer.selectCell(null);updateInspector();});

$('objective-action').addEventListener('click',event=>selectTool(event.currentTarget.dataset.action==='upgrade'?'upgrade':'cityHall'));
function updateOnboarding(){
  const active=started&&tutorialProgress.status==='active';
  $('onboarding-card').hidden=!active;$('game').classList.toggle('onboarding-active',active);
  document.querySelectorAll('.onboarding-tool').forEach(el=>el.classList.remove('onboarding-tool'));
  if(!active){tutorial=null;renderer?.setOnboardingHint(null);return;}
  tutorial=getOnboarding(sim,tutorialProgress);
  const phase=tutorial.id+':'+tutorial.action.kind;
  const clock=onboardingClock(tutorial,{automatic:tutorialClock,shared:!!coop.cityId});
  if(clock&&(paused!==clock.paused||speed!==clock.speed)){paused=clock.paused;speed=clock.speed;accumulator=0;renderer?.setPaused(isStopped());}
  if(phase!==tutorialPhase){$('onboarding-card').classList.remove('details-open');$('onboarding-details').setAttribute('aria-expanded','false');$('onboarding-details').textContent='说明';}
  tutorialPhase=phase;
  $('onboarding-count').textContent=tutorial.id==='complete'?'建城第一课 · 已完成':`建城第一课 · ${tutorial.index+1} / ${tutorial.steps.length}`;
  $('onboarding-title').textContent=tutorial.title;$('onboarding-description').textContent=tutorial.description;
  $('onboarding-status').textContent=tutorial.status;
  const meter=$('onboarding-meter');meter.hidden=!Number.isFinite(tutorial.progress);meter.setAttribute('aria-valuenow',String(tutorial.progress||0));meter.firstElementChild.style.width=(tutorial.progress||0)+'%';
  const action=tutorial.action,sharedLocked=coop.cityId&&coop.view?.role!=='owner';
  $('onboarding-action').textContent=tutorial.waiting?(paused?sharedLocked?'等待房主继续模拟':'继续模拟，看看变化':'正在发展中…'):action.label;
  $('onboarding-action').disabled=!!tutorial.waiting&&(!paused||!!sharedLocked);
  $('onboarding-locate').hidden=!action.target;
  $('onboarding-locate').textContent=action.kind==='build'?'看推荐位置':'看看现场';
  $('onboarding-clock').textContent=coop.cityId?'合作城市共用时间，可随时跳过引导。':paused?'时间已暂停，可以慢慢规划。':speed===3?'正在 3 倍速发展；顶部可随时暂停或调速。':'城市正在运行；顶部可随时暂停。';
  $('onboarding-skip').textContent=tutorial.id==='complete'?'收起':'跳过引导';
  renderer?.setOnboardingHint(tutorial.hint);
  if(action.tool){
    document.querySelector(`[data-tool="${action.tool}"]`)?.classList.add('onboarding-tool');
    for(const [id,group]of Object.entries(toolGroups))if(group.tools.includes(action.tool)||id===action.tool)document.querySelector(`[data-tool-group="${id}"]`)?.classList.add('onboarding-tool');
  }
}
function locateOnboarding(){
  const action=tutorial?.action,target=action?.target;if(!target)return;
  setPanelCollapsed('left',true);setPanelCollapsed('right',true);setMobileMapPanel(null);
  if(action.kind==='build'&&action.tool){
    const group=Object.keys(toolGroups).find(id=>toolGroups[id].tools.includes(action.tool));
    if(group){
      if(openToolGroup!==group)toggleToolGroup(group);
      const button=toolSubmenu.querySelector(`[data-tool="${action.tool}"]`);
      button?.classList.add('onboarding-tool');button?.scrollIntoView({block:'nearest',inline:'nearest'});button?.focus({preventScroll:true});
      document.querySelector(`[data-tool-group="${group}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }else closeToolSubmenu();
  keyboardCell={...target};keyboardMode=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>renderer.focusOnboarding(target)));
}
$('onboarding-details').onclick=()=>{
  closeToolSubmenu();setPanelCollapsed('left',true);setPanelCollapsed('right',true);
  const expanded=$('onboarding-card').classList.toggle('details-open');
  $('onboarding-details').setAttribute('aria-expanded',String(expanded));
  $('onboarding-details').textContent=expanded?'收起说明':'说明';
};
function closeOnboarding(){
  tutorialProgress.status=tutorial?.id==='complete'?'complete':'skipped';
  if(tutorialClock&&!coop.cityId){paused=false;accumulator=0;}
  tutorialClock=false;tutorialPhase=null;updateUI();renderer.setPaused(isStopped());autosave();
}
$('onboarding-skip').onclick=closeOnboarding;
$('onboarding-locate').onclick=locateOnboarding;
$('onboarding-open').onclick=()=>{
  closeDialog('help-dialog');tutorialProgress.status='active';tutorialClock=!coop.cityId;tutorialPhase=null;
  clearResidentJourney();setPanelCollapsed('left',true);setPanelCollapsed('right',true);updateUI();locateOnboarding();autosave();
};
$('onboarding-action').onclick=()=>{
  updateOnboarding();const action=tutorial?.action;if(!action)return;
  if(action.kind==='finish'){
    if(!coop.cityId){speed=1;paused=false;accumulator=0;}
    closeOnboarding();return;
  }
  if(action.kind==='citizen'){visitCitizen();return;}
  if(action.kind==='budget'){openBudget();return;}
  if(action.kind==='resume'){
    if(coop.cityId){$('pause').click();return;}
    tutorialClock=true;paused=false;speed=3;accumulator=0;renderer.setPaused(isStopped());updateUI();locateOnboarding();return;
  }
  if(action.kind==='inspect'){selectTool('inspect');locateOnboarding();handleSelect(action.target);return;}
  selectTool(action.tool);locateOnboarding();
};
new ResizeObserver(entries=>{for(const entry of entries)if(entry.contentRect.height)$('game').style.setProperty('--onboarding-height',Math.ceil(entry.target.getBoundingClientRect().height)+'px');}).observe($('onboarding-card'));
function updateGuide() {
  const o=sim.getObjective(),s=sim.state.stats;
  const goal=cityGoalProgress(sim.state),goalCard=$('city-goal-card');
  goalCard.classList.toggle('completed',goal.completed);
  $('city-goal-name').textContent=goal.name;
  $('city-goal-status').textContent=goal.completed?'✓ 已达成':'进行中';
  $('city-goal-description').textContent=goal.targetLabel;
  $('city-goal-fill').style.width=goal.progress*100+'%';
  $('city-goal-current').textContent=goal.completed&&goal.completedMonth?`${goal.currentLabel} · 第 ${goal.completedMonth} 月达成`:goal.currentLabel;
  document.querySelectorAll('[data-unlock-population]').forEach(el=>el.hidden=s.population>=Number(el.dataset.unlockPopulation));
  $('objective-requirements').hidden=!o.requirements;
  $('objective-requirements').innerHTML=(o.requirements||[]).map(r=>`<div class="growth-requirement ${r.met?'met':''}"><strong>${r.met?'✓':'○'} ${esc(r.label)}</strong><span>${esc(r.detail)}</span></div>`).join('');
  $('objective-action').hidden=!o.action;
  $('objective-action').dataset.action=o.action||'';
  $('objective-action').textContent=o.actionLabel||(o.action==='upgrade'?'体验升级道路':o.action==='cityHall'?'建设市政府 · ¥3,000':'');
  $('objective-title').textContent=o.title;$('objective-description').textContent=o.description;
  $('growth-stages').innerHTML=sim.getGrowthStages().map(stage=>`<span class="growth-stage ${stage.reached?'reached':stage.population===o.target?'current':''}" title="${stage.name} · ${stage.reward}" aria-label="${number(stage.population)} 人：${stage.name}，${stage.reached?'已达成':'未达成'}，${stage.reward}">${stage.reached?'✓ ':''}${stage.population>=1000?stage.population/1000+'k':stage.population}</span>`).join('');
  const fraction=Number(o.progress)||0;
  $('objective-fill').style.width=clamp(fraction*100,0,100)+'%';
  $('objective-current').textContent=number(o.current??s.population);
  $('objective-target').textContent=number(o.target||100)+(o.target===2?' 项基础设施':' 位居民');
  const steps=(tutorial||getOnboarding(sim,tutorialProgress)).steps;
  $('guide-steps').innerHTML=steps.map((step,i)=>`<div class="guide-step ${step.done?'done':''}"><i>${step.done?'✓':i+1}</i>${step.label}</div>`).join('')+'<button class="text-button" id="guide-resume">打开分步引导</button>';
  $('guide-resume').onclick=()=>$('onboarding-open').click();
  const expanded=guideExpanded??!steps.every(step=>step.done);
  $('guide-steps').hidden=!expanded;$('growth-stages').hidden=!expanded||tutorialProgress.status==='active';
  $('objective-body').hidden=!objectiveExpanded;
  $('toggle-guide').setAttribute('aria-expanded',String(objectiveExpanded));
  $('toggle-guide').setAttribute('aria-label',objectiveExpanded?'收起城市成长':'展开城市成长');
  $('toggle-guide').title=objectiveExpanded?'收起城市成长':'展开城市成长';
}
$('toggle-guide').addEventListener('click',()=>{objectiveExpanded=!objectiveExpanded;updateGuide();});
function updateUI() {
  updateOnboarding();
  updateAllRoadsButton();
  refreshCommercialLocks();
  const state=sim.state,s=state.stats;
  renderer?.setSpeed(speed);
  const cityName=state.districtName||'湾畔市',mayors=currentMayors();
  const reputation=mayorReputation(state);
  $('city-name').textContent=cityName;
  $('city-subtitle').textContent=mayors.cooperative?mayors.text:`${state.mayorName?mayors.text:'市长档案'} · 荣誉 Lv.${reputation.level}`;
  $('city-subtitle').title=mayors.text;
  $('city-coop-honor').hidden=!mayors.cooperative;$('city-coop-honor').textContent=`荣誉 Lv.${reputation.level}`;
  $('city-name-button').classList.toggle('cooperative',mayors.cooperative);
  $('city-name-button').title=`${cityName} · ${mayors.text} · 名誉 ${reputation.score} 分 · ${reputation.title} · ${coop.cityId?'点击查看合作市长、邀请码与城市档案':'点击查看档案'}`;
  $('city-name-button').setAttribute('aria-label',coop.cityId?'查看合作城市邀请码与城市档案':'修改城市名称和市长姓名');
  document.title=cityName+' · 城市建设';
  $('money').textContent=number(state.money);$('money').classList.toggle('negative',state.money<0);
  $('population').textContent=number(s.population);$('happiness').textContent=number(s.happiness)+'%';
  $('balance').textContent=(s.balance>=0?'+':'−')+number(Math.abs(s.balance));$('balance').className=s.balance>=0?'positive':'negative';
  const month=(state.month||1)-1;$('date').textContent=`${1+Math.floor(month/12)} 年 · ${month%12+1} 月`;
  const festival=festivalForMonth(state.month);
  $('festival-calendar-button').textContent=festival?`${festival.symbol} ${festival.name}`:'节庆日历';
  $('festival-calendar-button').title=festival?festival.description:'查看每年循环的节日与活动';
  if($('festival-calendar').open)renderFestivalCalendar();
  $('pause').innerHTML=icon(paused?'play':'pause');$('pause').setAttribute('aria-label',paused?'继续模拟':'暂停模拟');$('pause').setAttribute('aria-pressed',String(paused));
  document.querySelectorAll('[data-speed]').forEach(btn=>btn.setAttribute('aria-pressed',String(Number(btn.dataset.speed)===speed&&!paused)));
  $('undo').disabled=coop.cityId?(!coop.view?.canUndo||coop.busy||!coop.connected):(!undoReady||lastEditTick!==state.tick);
  $('pause').disabled=!!coop.cityId&&coop.view?.role!=='owner';
  document.querySelectorAll('[data-speed]').forEach(btn=>btn.disabled=!!coop.cityId&&coop.view?.role!=='owner');
  for(const type of ['residential','commercial','industrial']){const d=clamp(Number(s.demand?.[type])||0,0,100);$('demand-'+type).style.height=d+'%';$('demand-'+type+'-value').textContent=Math.round(d);}
  updateMobileOverview(s);
  syncBuildingFilterUI();
  const demandTypes=[['residential','住宅'],['commercial','商业'],['industrial','工业']];
  $('demand-reasons').innerHTML=demandTypes.map(([type,label])=>{const d=s.demandDetails?.[type];if(!d)return '';const sites=d.sites;return `<div><b>${label}</b><span>${esc(developmentSummary(s.demand[type],d))}</span></div>`;}).join('');

  const upgradeButton=document.querySelector('[data-tool="upgrade"]'),roadLevel=unlockedRoadLevel(state),roadsUnlocked=roadLevel>1;
  upgradeButton.classList.toggle('locked',!roadsUnlocked);
  upgradeButton.title=roadsUnlocked?`当前人口已开放 ${roadLevel} 级道路 · 拖动升级道路，点击建筑查看其他条件`:'人口达到 1,000 后开放二级道路升级';
  document.querySelector('[data-tool="landmark"]').classList.toggle('locked',!state.milestones?.bridge);
  updateGuide();updateInspector();
  if($('budget-dialog').open)updateBudget();
  if($('workforce-dialog').open)updateWorkforce();
  if($('civic-dialog').open)updateCivic();
  if($('name-dialog').open)updateIdentityMayors();
  const incident=state.civic?.incident;
  $('civic-dispatch').hidden=!incident;
  if(incident)$('civic-dispatch').innerHTML=`${icon('fireStation')}<span>消防演练 · ${incident.stage==='responding'?'出动中':'处置中'}<small>点击观察现场${paused?' · 当前已暂停':''}</small></span>${icon('arrow')}`;
}
function updateMobileOverview(stats){
  for(const type of ['residential','commercial','industrial']){
    const demand=clamp(Number(stats.demand?.[type])||0,0,100);
    $('mobile-demand-'+type).style.width=demand+'%';
    $('mobile-demand-'+type+'-value').textContent=Math.round(demand);
  }
  for(const type of ['power','water']){
    const used=Number(stats[type+'Used'])||0,capacity=Number(stats[type+'Capacity'])||0;
    const percent=capacity>0?used/capacity*100:0;
    const value=$('mobile-'+type+'-value'),fill=$('mobile-'+type+'-fill'),meter=$('mobile-'+type+'-meter');
    value.textContent=number(used)+' / '+number(capacity);value.title=value.textContent;
    fill.style.width=clamp(percent,0,100)+'%';
    fill.classList.toggle('warning',percent>90||!capacity);
    meter.setAttribute('aria-valuenow',String(Math.round(clamp(percent,0,100))));
    meter.setAttribute('aria-valuetext',value.textContent+'（已用 / 总容量）');
  }
}
function syncWorld(options){sim.state.mapSize=mapSize(sim.state);const max=sim.state.mapSize-1;$('target-x').max=String(max);$('target-y').max=String(max);renderer.setState(sim.state,options);refreshResidentJourney();updateUI();}

$('pause').addEventListener('click',async()=>{if(coop.cityId){const r=await mutate('setClock',{paused:!paused,speed});toast(r.message,!r.ok);return;}tutorialClock=false;paused=!paused;accumulator=0;renderer.setPaused(isStopped());updateUI();});
document.querySelectorAll('[data-speed]').forEach(btn=>btn.addEventListener('click',async()=>{if(coop.cityId){const r=await mutate('setClock',{paused:false,speed:Number(btn.dataset.speed)});toast(r.message,!r.ok);return;}tutorialClock=false;speed=Number(btn.dataset.speed);paused=false;renderer.setPaused(isStopped());updateUI();}));
async function undo(){const result=await mutate('undo');toast(result.message|| (result.ok?'已撤销':'无法撤销'),!result.ok);undoReady=false;if(result.ok){if(currentTool==='move')selectTool('move');syncWorld();previewAt(keyboardMode?keyboardCell:hover);}else updateUI();}
$('undo').addEventListener('click',undo);

function snapshot(){return {savedAt:new Date().toISOString(),name:sim.state.districtName||'湾畔市',mayorName:sim.state.mayorName||'',population:sim.state.stats.population,month:sim.state.month,city:sim.serializeCompact(),onboarding:{...tutorialProgress},...(soloRecord?{accountCity:{id:soloRecord.id,owner:soloRecord.owner}}:{})};}
function autosave(){
  if(coop.cityId){coop.status();return coop.connected&&!coop.pending().length;}
  if(!started)return true;
  const current=snapshot();
  if(soloRecord){try{soloLibrary.save(soloRecord,current);return true;}catch(e){toast(e.message,true);return false;}}
  const checkpoints=safeRead('checkpoints',[]).filter(item=>item.city!==current.city);
  const next=[current,...checkpoints].slice(0,3);
  while(next.length){
    try{localStorage.setItem(savePrefix()+'checkpoints',JSON.stringify(next));if(!soloRecord)$('save-state').textContent='已自动保存 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});return true;}
    catch{if(next.length===1)break;next.pop();}
  }
  $('save-state').textContent='自动保存失败 · 请导出存档';
  toast('存储空间不足，当前城市仍保留。请先在菜单导出存档。',true);return false;
}
async function manualSave(){
 if(coop.cityId){const r=await mutate('saveSnapshot',['纪念 · '+new Date().toLocaleString('zh-CN')].join(''));toast(r.message,!r.ok);return;}
 if(!autosave())return;
 if(soloRecord){try{await soloLibrary.flush(soloRecord);toast('单人城市已保存到账号。');}catch(e){toast('本机进度已保存。'+e.message,true);}renderMenu();return;}
 if(safeWrite('manual',snapshot())){toast('城市已保存，可以安心离开。');$('save-state').textContent='已手动保存';renderMenu();}
}
function restoreSnapshot(item){try{const restored=CitySimulation.deserialize(item.city);if(item.accountCity){if(item.accountCity.owner!==soloLibrary.owner())throw Error('请先登录这座城市所属的账号');const record=soloLibrary.local().find(r=>r.id===item.accountCity.id);if(!record)throw Error('请从我的城市重新打开存档');soloRecord=record;}else soloRecord=null;sim=restored;tutorialProgress=onboardingProgress(item.onboarding,{fresh:sim.state.stats.population===0&&sim.state.buildings.length<8});tutorialClock=tutorialProgress.status==='active';tutorialPhase=null;guideExpanded=false;modeName='本地存档';selected=null;undoReady=false;lastEditTick=null;lastCelebrationState=celebrationSnapshot(sim.state);paused=tutorialClock;started=true;accumulator=0;selectTool('inspect');syncWorld();renderer.resetCamera();if(sim.state.stats.population<5)renderer.focusCell(9,32);document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('save-state').textContent=soloRecord?(soloRecord.error?'存档版本冲突 · 请打开我的城市':soloRecord.dirty||soloRecord.pending?'已保存到本机 · 等待同步到账号':'已保存到账号 · 单人城市'):'本地游客城市';if(tutorialProgress.status==='active')locateOnboarding();toast('欢迎回来，城市已经恢复。');}catch(error){toast('存档无法读取：'+error.message,true);}}
function requestLoad(item){if(coop.cityId){toast('请先离开合作城市，再读取单人存档',true);return;}if(!item)return;if(started){confirm('读取这个存档？','当前城市会先保存到自动检查点，再读取所选存档。',()=>{if(autosave())restoreSnapshot(item);});}else restoreSnapshot(item);}
function renderMenu(){
  const shared=!!coop.cityId;$('load-manual').hidden=shared;$('import-save').hidden=shared;
  $('checkpoints').hidden=shared;$('checkpoints').previousElementSibling.hidden=shared;
  $('coop-menu').textContent=shared?'建设日志 · 合作存档':'好友共建城市';
  const manual=safeRead('manual');$('load-manual').disabled=!manual;$('manual-date').textContent=manual?`${manual.name} · ${number(manual.population)} 人${manual.mayorName?' · 市长 '+manual.mayorName:''}`:'还没有手动存档';
  const checks=safeRead('checkpoints',[]);
  $('checkpoints').innerHTML=checks.length?checks.map((c,i)=>`<button class="checkpoint-item" data-checkpoint="${i}"><span>${esc(c.name)} · ${number(c.population)} 人${c.mayorName?`<small class="checkpoint-mayor">市长 · ${esc(c.mayorName)}</small>`:''}</span><small>${new Date(c.savedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></button>`).join(''):'<div class="empty-note">每个模拟月结束时保存一次，保留最近三次。</div>';
  $('checkpoints').querySelectorAll('[data-checkpoint]').forEach(btn=>btn.addEventListener('click',()=>requestLoad(checks[Number(btn.dataset.checkpoint)])));
}
$('menu-button').addEventListener('click',()=>{renderMenu();openDialog('menu-dialog');});
$('save-manual').addEventListener('click',manualSave);
$('load-manual').addEventListener('click',()=>requestLoad(safeRead('manual')));
$('export-save').addEventListener('click',()=>{
  const blob=new Blob([sim.serialize()],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${sim.state.districtName.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_')}-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出城市存档。');
});
async function createImportedCity(item,{kind='solo',name=item.name}={}){
 if(!['solo','cooperative'].includes(kind))throw Error('请选择有效的城市类型');
 if(coop.cityId)throw Error('请先离开当前合作城市，再从存档创建新城市');
 const city=CitySimulation.deserialize(item.city),identity=city.setCityIdentity({cityName:name,mayorName:soloLibrary.owner()?coop.identity.actor.name:city.state.mayorName||''});
 if(!identity.ok)throw Error(identity.message);
 if(kind==='cooperative'&&!soloLibrary.owner())throw Error('请先登录账号，再创建合作城市');
 if(started&&!autosave())throw Error('当前城市尚未保存，请先导出当前进度后再导入');
 const imported={city:city.serializeCompact(),savedAt:new Date().toISOString(),name:city.state.districtName,mayorName:city.state.mayorName,population:city.state.stats.population,month:city.state.month};
 if(kind==='cooperative'){
  const created=await coop.request('/cities',{method:'POST',body:{name:imported.name,city:imported.city}});
  await enterCoop(created.cityId);closeDialog('coop-dialog');toast('已从存档创建新的合作城市。');return created;
 }
 // Persist a new identity before switching away; imported account metadata is ignored.
 const record=soloLibrary.owner()?soloLibrary.create(imported):null;
 if(record)imported.accountCity={id:record.id,owner:record.owner};
 else{
  const checkpoints=safeRead('checkpoints',[]).filter(saved=>saved.city!==imported.city);
  if(!safeWrite('checkpoints',[imported,...checkpoints].slice(0,3)))throw Error('本机存储空间不足，导入未完成；当前城市仍保留。');
 }
 restoreSnapshot(imported);paused=true;tutorialClock=false;speed=1;renderer.setSpeed(speed);renderer.setPaused(true);updateUI();refreshContinue();
 if(record)soloLibrary.flush(record).catch(()=>{});
 toast(record?'已导入为新的账号单人城市，进度将同步到账号。':'已导入为新的本地城市，点击继续即可开始建设。');return record;
}
const cityImport=setupCityImport({account:()=>soloLibrary.owner()?coop.identity.actor:null,create:createImportedCity});
$('import-save').addEventListener('click',()=>cityImport.open());
$('start-import').addEventListener('click',()=>cityImport.open());
$('new-game').addEventListener('click',()=>{if(coop.cityId){if(coop.busy||(!coop.accessDenied&&coop.pending().length)){toast('请等待保存结果核对完成',true);return;}leaveCoop();}confirm('开始另一座城市？','当前城市会先自动保存。你可以从零建设、导入城市存档，或体验示范城。',()=>{if(!autosave())return;document.querySelectorAll('dialog[open]').forEach(d=>d.close());openDialog('welcome-dialog');refreshContinue();});});

function updateBudget(){
  const state=sim.state,s=state.stats;
  const key=[state.money,s.income,s.expenses,state.taxRate,JSON.stringify(state.loan),JSON.stringify(s.breakdown)].join('|');
  if(key===lastBudgetKey)return;lastBudgetKey=key;
  const open=[...$('budget-summary').querySelectorAll('details')].map(v=>v.open);
  $('budget-summary').innerHTML=`<div class="eyebrow">可用城市资金</div><div class="budget-number">¥ ${number(state.money)}</div><div class="budget-row"><span>预计每月财政收入</span><b class="positive">+${number(s.income)}</b></div><div class="budget-row"><span>预计每月财政支出</span><b>−${number(s.expenses)}</b></div><div class="budget-row"><span>月结余</span><b class="${s.balance>=0?'positive':'negative'}">${s.balance>=0?'+':'−'}${number(Math.abs(s.balance))}</b></div>`;
  $('budget-summary').insertAdjacentHTML('beforeend',`<details ${open[0]?'open':''}><summary>每月收入明细</summary>${[['居民缴税',s.breakdown.residentialIncome],['商业经营税',s.breakdown.commercialIncome],['工业经营税',s.breakdown.industrialIncome]].map(([label,value])=>`<div class="budget-row"><span>${label}</span><b class="positive">+¥${number(value)}</b></div>`).join('')}<p class="muted">居民税包含就业工资税 ¥${number(s.breakdown.wageTax)} 与居住服务费 ¥${number(s.breakdown.residentServiceTax)}。企业按实际到岗人数和建筑效率纳税。</p></details><details ${open[1]?'open':''}><summary>每月支出明细</summary>${[['住宅街区配套',s.breakdown.districtMaintenance.residential],['商业街区配套',s.breakdown.districtMaintenance.commercial],['工业街区配套',s.breakdown.districtMaintenance.industrial],['道路与桥梁',s.breakdown.roadMaintenance],['公共设施运行',s.breakdown.facilityMaintenance],['公共部门工资',s.breakdown.publicPayroll],['贷款还款',s.breakdown.loanPayment]].map(([label,cost])=>`<div class="budget-row"><span>${label}</span><b>¥${number(cost)}</b></div>`).join('')}<p class="muted">企业每月另向居民发放工资 ¥${number(s.breakdown.enterprisePayroll)}，属于居民与企业之间的资金流，不从市财政扣除。街区配套即使空置也会计费；开发费与升级费为一次性支出。</p></details>`);
  $('tax-rate').value=state.taxRate;$('tax-value').value=state.taxRate+'%';
  const loan=state.loan||{};
  $('loan-info').textContent=loan.taken?`应急贷款已使用 · 尚欠 ${number(loan.remaining)}。按约定宽限期结束后，每月偿还 300。`:'资金低于 3,000 时可申请一次应急贷款 6,000。宽限 3 个月，随后每月偿还 300，共 24 期。';
  $('take-loan').disabled=loan.taken||state.money>=3000;
}
function openBudget(){lastBudgetKey='';updateBudget();openDialog('budget-dialog');}
$('budget-button').addEventListener('click',openBudget);$('income-button').addEventListener('click',openBudget);

function workforcePayroll(row){
  const parts=[];
  if(row.privatePayroll)parts.push(`企业 ¥${number(row.privatePayroll)}`);
  if(row.publicPayroll)parts.push(`财政 ¥${number(row.publicPayroll)}`);
  return parts.length?parts.join('<br>'):'—';
}
function workforceRow(row){
  const fill=row.positions?Math.round(row.workers/row.positions*100):0;
  return `<div class="workforce-row" role="row">
    <div class="workforce-name" role="cell"><strong>${esc(row.label)}</strong><small>${number(row.places)} 处场所</small></div>
    <div role="cell" data-label="场所">${number(row.places)}</div>
    <div class="workforce-staff" role="cell" data-label="在岗 / 岗位"><strong>${number(row.workers)} / ${number(row.positions)}</strong><small>${row.positions?`到岗 ${fill}%`:'暂无岗位'}</small></div>
    <div class="workforce-tax ${row.tax?'positive':''}" role="cell" data-label="经营税 / 月">${row.tax?`+¥${number(row.tax)}`:'—'}</div>
    <div class="workforce-payroll" role="cell" data-label="工资 / 月">${workforcePayroll(row)}</div>
  </div>`;
}
function updateWorkforce(){
  const report=sim.state.stats.workforceReport;
  if(!report)return;
  const key=JSON.stringify(report);if(key===lastWorkforceKey)return;lastWorkforceKey=key;
  const summary=report.summary;
  $('workforce-content').innerHTML=`
    <section class="workforce-summary" aria-label="就业和行业汇总">
      <div><small>民营实际到岗</small><strong>${number(summary.privateWorkers)} 人</strong></div>
      <div><small>事业单位在岗</small><strong>${number(summary.publicWorkers)} 人</strong></div>
      <div><small>全市登记岗位</small><strong>${number(summary.positions)} 个</strong></div>
      <div><small>行业经营税 / 月</small><strong class="positive">+¥${number(summary.businessTax)}</strong></div>
      <div><small>企业发放工资 / 月</small><strong>¥${number(summary.enterprisePayroll)}</strong></div>
      <div><small>财政工资支出 / 月</small><strong>¥${number(summary.publicPayroll)}</strong></div>
    </section>
    <p class="workforce-caption">数据随城市运行实时更新。民营行业显示实际到岗人数；事业单位只有在建成、启用并正常获得道路与水电服务时才计入在岗。</p>
    ${report.sections.map(section=>`<section class="workforce-sector" aria-labelledby="workforce-${section.id}">
      <div class="workforce-sector-heading"><div><h3 id="workforce-${section.id}">${esc(section.label)}</h3><p>${esc(section.note)}</p></div><strong>${number(section.workers)} / ${number(section.positions)} 人</strong></div>
      <div class="workforce-table" role="table" aria-label="${esc(section.label)}统计">
        <div class="workforce-table-head" role="row"><span role="columnheader">行业或岗位</span><span role="columnheader">场所</span><span role="columnheader">在岗 / 岗位</span><span role="columnheader">经营税 / 月</span><span role="columnheader">工资 / 月</span></div>
        ${section.rows.length?section.rows.map(workforceRow).join(''):'<div class="workforce-empty">这座城市还没有相关行业。</div>'}
      </div>
    </section>`).join('')}
    <p class="workforce-footnote">居民工资税和居住服务费计入城市财政，但不重复算作行业经营税。企业工资由企业承担；事业单位、公共文化和休闲设施的工资由城市财政承担。</p>`;
}
function openWorkforce(){if(!started)return;lastWorkforceKey='';updateWorkforce();openDialog('workforce-dialog');}
$('workforce-button').addEventListener('click',openWorkforce);
$('workforce-budget').addEventListener('click',()=>{closeDialog('workforce-dialog');openBudget();});

const vehicleCatalogCategories=[{id:'all',label:'全部'},{id:'road',label:'道路车辆'},{id:'service',label:'公共车辆'},{id:'water',label:'水上交通'}];
const catalogCategoryLabel=id=>[...CATALOG_CATEGORIES,...vehicleCatalogCategories].find(item=>item.id===id)?.label||'其他';
function catalogStatusText(item){
  if(!item.unlocked)return `未解锁 · ${item.unlockReason}`;
  if(item.kind==='vehicle'){
    const unit=item.category==='water'?'艘':'条活跃路线';
    return item.count?`已解锁 · 当前 ${number(item.count)} ${unit}`:`已解锁 · 当前没有${item.category==='water'?'已购游艇':'活跃路线'}`;
  }
  return item.count?`已解锁 · 城市中已有 ${number(item.count)} 座`:'已解锁 · 尚未建设';
}
function catalogItemMarkup(item){
  const price=item.cost===0?'发展奖励':Number.isFinite(item.cost)?`¥${number(item.cost)}`:'随分区发展';
  const facts=item.kind==='building'?`${item.footprint}×${item.footprint} 格 · ${price}`:catalogCategoryLabel(item.category);
  return `<button type="button" class="catalog-card ${item.unlocked?'unlocked':'locked'} ${item.icon==='medical'?'medical':''}" data-catalog-id="${esc(item.id)}" aria-pressed="${catalogSelection[catalogTab]===item.id}" aria-label="${esc(item.name)}，${item.unlocked?'已解锁':'未解锁'}">
    <span class="catalog-card-symbol" aria-hidden="true">${item.kind==='vehicle'?icon(item.category==='water'?'boat':item.category==='service'?'traffic':'traffic'):icon(item.icon||(item.category==='residential'?'home':item.category==='commercial'?'shop':item.category==='industrial'?'factory':item.category==='landscape'?'tree':item.category==='municipal'?'cityHall':'landmark'))}</span>
    <span class="catalog-card-copy"><strong>${esc(item.name)}</strong><small>${esc(facts)}</small><em>${item.unlocked?'✓ 已解锁':'◇ 未解锁'}</em></span>
  </button>`;
}
function ensureCatalogRenderer(){
  if(catalogRenderer)return catalogRenderer;
  catalogRenderer=new CityRenderer($('catalog-preview'));
  catalogRenderer.setCatalogMode(true);catalogRenderer.setPaused(true);catalogRenderer.setUpgradeMarkersVisible(false);
  return catalogRenderer;
}
function showCatalogEntry(entry){
  if(!entry)return;
  catalogSelection[catalogTab]=entry.id;
  $('catalog-list').querySelectorAll('[data-catalog-id]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.catalogId===entry.id)));
  const status=$('catalog-preview-status');status.textContent=entry.unlocked?'已解锁':'未解锁';status.className=entry.unlocked?'unlocked':'locked';
  $('catalog-preview-name').textContent=entry.name;
  const levels=$('catalog-levels'),maxLevel=entry.kind==='building'?(entry.maxLevel||1):0;
  const level=maxLevel?Math.max(1,Math.min(maxLevel,catalogLevelById[entry.id]||1)):1;
  if(maxLevel){
    levels.hidden=false;
    levels.innerHTML=maxLevel===1?'<span class="catalog-level-label">固定外观</span>':`<span class="catalog-level-label">建筑等级</span>${Array.from({length:maxLevel},(_,index)=>`<button type="button" data-catalog-level="${index+1}" aria-pressed="${index+1===level}" aria-label="查看 ${index+1} 级外观">${index+1}级</button>`).join('')}`;
    levels.querySelectorAll('[data-catalog-level]').forEach(button=>button.onclick=()=>{catalogLevelById[entry.id]=Number(button.dataset.catalogLevel);showCatalogEntry(entry);});
  }else{levels.hidden=true;levels.innerHTML='';}
  const levelText=maxLevel>1?` · 当前查看 ${level} 级外观`:maxLevel===1?' · 固定外观':'';
  $('catalog-preview-description').textContent=`${entry.description} ${catalogStatusText(entry)}${levelText}`;
  const view=catalogPreview(entry,level),preview=ensureCatalogRenderer();
  preview.setState(view.state,{sameWorld:!!preview.state});preview.viewSize=view.viewSize;preview.azimuth=Math.PI/4;preview.focusCell(view.focus.x,view.focus.y);preview.target.y=view.focus.elevation||0;preview._resize();preview.renderer.shadowMap.needsUpdate=true;
}
function renderCatalog(){
  catalogData=cityCatalog(sim.state);
  const all=catalogTab==='building'?catalogData.buildings:catalogData.vehicles;
  const categories=catalogTab==='building'?CATALOG_CATEGORIES:vehicleCatalogCategories;
  if(!categories.some(item=>item.id===catalogCategory))catalogCategory='all';
  const filtered=all.filter(item=>(catalogCategory==='all'||item.category===catalogCategory)&&(catalogStatus==='all'||(catalogStatus==='unlocked')===item.unlocked));
  $('catalog-summary').innerHTML=`<div><strong>${number(catalogData.unlocked)} / ${number(catalogData.total)}</strong><span>当前城市已解锁</span></div><p>图鉴随人口、城市阶段、产业链和公共设施实时更新。未解锁条目也可以查看模型与条件。</p>`;
  document.querySelectorAll('[data-catalog-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.catalogTab===catalogTab)));
  document.querySelectorAll('[data-catalog-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.catalogStatus===catalogStatus)));
  $('catalog-category-filters').innerHTML=categories.map(item=>`<button type="button" data-catalog-category="${item.id}" aria-pressed="${item.id===catalogCategory}">${item.label}</button>`).join('');
  $('catalog-category-filters').querySelectorAll('[data-catalog-category]').forEach(button=>button.onclick=()=>{catalogCategory=button.dataset.catalogCategory;renderCatalog();});
  if(!filtered.some(item=>item.id===catalogSelection[catalogTab]))catalogSelection[catalogTab]=filtered[0]?.id||null;
  $('catalog-list').innerHTML=filtered.length?filtered.map(catalogItemMarkup).join(''):'<p class="catalog-empty">当前筛选下没有图鉴条目。</p>';
  $('catalog-list').querySelectorAll('[data-catalog-id]').forEach(button=>button.onclick=()=>showCatalogEntry(all.find(item=>item.id===button.dataset.catalogId)));
  const selected=all.find(item=>item.id===catalogSelection[catalogTab])||filtered[0];
  if(selected)showCatalogEntry(selected);
}
function openCatalog(){
  if(!started)return;
  const dialog=$('catalog-dialog');
  catalogTab='building';catalogCategory='all';catalogStatus='all';
  dialog.scrollTop=0;
  openDialog('catalog-dialog');
  requestAnimationFrame(()=>{dialog.scrollTop=0;ensureCatalogRenderer();renderCatalog();});
}
$('catalog-button').addEventListener('click',openCatalog);
document.querySelectorAll('[data-catalog-tab]').forEach(button=>button.addEventListener('click',()=>{catalogTab=button.dataset.catalogTab;catalogCategory='all';renderCatalog();}));
document.querySelectorAll('[data-catalog-status]').forEach(button=>button.addEventListener('click',()=>{catalogStatus=button.dataset.catalogStatus;renderCatalog();}));
$('catalog-rotate-left').addEventListener('click',()=>catalogRenderer?.rotateBy(-Math.PI/4));
$('catalog-rotate-right').addEventListener('click',()=>catalogRenderer?.rotateBy(Math.PI/4));
$('catalog-zoom-out').addEventListener('click',()=>catalogRenderer?.zoomBy(1.22));
$('catalog-zoom-in').addEventListener('click',()=>catalogRenderer?.zoomBy(.82));
$('catalog-reset-view').addEventListener('click',()=>{if(!catalogRenderer)return;catalogRenderer.azimuth=Math.PI/4;catalogRenderer._updateCamera();});
$('catalog-dialog').addEventListener('close',()=>{catalogRenderer?.dispose();catalogRenderer=null;catalogData=null;});

function civicOutcome(previous){
  if(!previous||sim.state.civic?.incident)return '';
  const record=sim.state.civic.history.find(item=>item.id===previous.id);
  return record?' · '+record.message:'';
}
function openCivic(){if(!started)return;updateCivic();openDialog('civic-dialog');}
function observeCivic(type){
  if($('civic-dialog').open)closeDialog('civic-dialog');
  selectTool('inspect');
  const cell=renderer.visitCivic(type);
  if(cell){handleSelect(cell);return;}
  toast(type==='incident'?'当前没有进行中的消防演练。':'先在道路旁建设这座公共建筑，再来查看。');
}
function updateCivic(){
  const c=sim.getCivicInfo(),incident=c.incident;
  const hall=sim.state.buildings.find(b=>b.type==='cityHall');
  const budgets=[{value:70,label:'节约',range:8,cost:84},{value:100,label:'标准',range:14,cost:120},{value:130,label:'加强',range:20,cost:156}];
  const policyCards={balanced:{lead:'住宅满意度 +2',foot:'标准公共成本'},livability:{lead:'住宅满意度 +4',foot:'公共支出 +12%'},development:{lead:'商工需求 +10',foot:'经营税 +8% · 住宅 +1'}};
  const activePolicy=c.policyOptions.find(policy=>policy.id===c.policy);
  const reputationExpanded=$('civic-content').querySelector('.mayor-reputation details')?.open;
  $('civic-content').innerHTML=`
    <button class="civic-identity" id="civic-edit-identity"><span class="civic-identity-seal">${icon('cityHall')}</span><span><strong>${esc(sim.state.districtName)}</strong><small>${esc(currentMayors().text)}</small></span><span class="civic-identity-edit">编辑档案 ${icon('arrow')}</span></button>
    ${reputationMarkup(sim.state)}
    <div class="civic-intro"><span class="civic-emblem">${icon('cityHall')}</span><div><strong>${c.hallReady?'市政府正在办公':hall?'市政府暂未运转':'建立你的市政中心'}</strong><p>${c.hallReady?'市政方针、街区服务与消防管理已经开放；道路等级始终只随人口开放。':'市政府接通道路与水电、正常启用后，即可选择方针、覆盖住宅并管理消防；道路升级不受市政府状态影响。'}</p></div><span class="civic-state ${c.hallReady?'ready':''}">${c.hallReady?'办公中':hall?'待启用':'待建设'}</span></div>
    <div class="civic-metrics"><div><small>市政服务人口</small><strong>${number(c.municipalCoveredPopulation||0)}</strong><span>覆盖住宅居民</span></div><div><small>居民消防覆盖</small><strong>${c.servicePopulation?number(c.coverage)+'%':'—'}</strong><span>${number(c.coveredPopulation)} / ${number(c.servicePopulation)} 人</span></div><div><small>营业消防站</small><strong>${number(c.stations)}<em> / ${number(c.totalStations)}</em></strong><span>需要道路与水电</span></div><div><small>市府与消防维护</small><strong>¥ ${number(c.monthlyCost)}</strong><span>当前方针已计入</span></div></div>
    <div class="civic-build-actions"><button class="secondary-button" data-civic-build="fireStation">${icon('fireStation')}建设消防站 <small>¥ 2,200</small></button><button class="secondary-button" ${hall?'id="civic-locate-hall"':'data-civic-build="cityHall"'}>${icon('cityHall')}${hall?'前往市政府':'建设市政府'}${hall?'':'<small>¥ 3,000</small>'}</button></div>
    <section class="civic-section"><div class="civic-section-heading"><h3>${icon('cityHall')}市政方针</h3><span>${c.policyActive?'当前 '+esc(activePolicy.label):'市政府办公后生效'}</span></div><div class="civic-budgets civic-policies" role="group" aria-label="市政方针">${c.policyOptions.map(policy=>`<button data-civic-policy="${policy.id}" aria-pressed="${c.policy===policy.id}" ${c.canChangePolicy?'':'disabled'}><span>${esc(policy.label)}</span><strong>${esc(policyCards[policy.id].lead)}</strong><small>${esc(policyCards[policy.id].foot)}</small></button>`).join('')}</div><p class="civic-note">合作城市由房主选择方针。市政府停运时方针暂停，恢复办公后自动继续生效。</p></section>
    <section class="civic-section"><div class="civic-section-heading"><h3>消防预算</h3><span>当前 ${number(c.budget)}%</span></div><div class="civic-budgets" role="group" aria-label="消防预算">${budgets.map(b=>`<button data-fire-budget="${b.value}" aria-pressed="${c.budget===b.value}" ${c.canChangeBudget?'':'disabled'}><span>${b.label}</span><strong>${b.value}%</strong><small>基础范围 ${b.range} 格</small><small>一级站 ¥ ${b.cost} / 月</small></button>`).join('')}</div><p class="civic-note">覆盖按连通道路计算，受保护住宅满意度 +2。消防站升级每级增加 3 格范围，市政厅升级每级增加 2 格调度范围；高级设施的维护费随等级提高。费用在月末结算。</p></section>
    <section class="civic-drill"><div class="civic-section-heading"><h3>${icon('fireStation')}消防演练</h3><span>${incident?'进行中':'每月一次 · 免费'}</span></div><p>${incident?`消防车${incident.stage==='responding'?'正在沿道路前往演练地点':'已抵达，正在完成现场处置'} (${number(incident.x)}, ${number(incident.y)})。本阶段剩余约 ${number(incident.remainingTicks*3)} 模拟秒。`:'调度消防车前往覆盖范围内的建筑，观察出动、抵达与处置。演练不损伤建筑，也不会伤及居民。'}</p>${incident?`<button class="primary-button" id="civic-watch-drill">返回现场观察 ${icon('arrow')}</button>`:`<button class="primary-button" id="civic-start-drill" ${c.canStartDrill?'':'disabled'}>开始演练并观察 ${icon('arrow')}</button>${!c.canStartDrill?`<small class="civic-drill-reason">${esc(c.drillReason||'建好并启用市政府、消防站后即可组织演练。')}</small>`:''}`}</section>
    <section class="civic-history"><h3>最近出动记录</h3>${c.history.length?c.history.slice(-3).reverse().map(item=>`<div><span class="civic-history-dot ${item.status==='completed'?'completed':''}"></span><p>${esc(item.message)}<small>第 ${number(item.month)} 月 · (${number(item.x)}, ${number(item.y)})</small></p></div>`).join(''):'<p class="civic-note">完成首次演练后，这里会记录处置结果。</p>'}</section>`;
  if(reputationExpanded)$('civic-content').querySelector('.mayor-reputation details').open=true;
  $('civic-edit-identity').addEventListener('click',()=>{closeDialog('civic-dialog');openIdentity();});
  $('civic-content').querySelectorAll('[data-civic-build]').forEach(btn=>btn.addEventListener('click',()=>{
    closeDialog('civic-dialog');selectTool(btn.dataset.civicBuild);
    if(btn.dataset.civicBuild==='fireStation')document.querySelector('[data-overlay="fire"]').click();
    toast('选择道路旁的空地放置，接通水电后开始提供服务。');
  }));
  $('civic-locate-hall')?.addEventListener('click',()=>observeCivic('cityHall'));
  $('civic-content').querySelectorAll('[data-civic-policy]').forEach(btn=>btn.addEventListener('click',async()=>{
    const result=await mutate('setCivicPolicy',btn.dataset.civicPolicy);
    let saved=true;if(result.ok){undoReady=false;syncWorld();saved=autosave();}
    if(!result.ok)updateCivic();
    toast(result.message+(saved?'':'。请导出存档保留调整。'),!result.ok||!saved);
  }));
  $('civic-content').querySelectorAll('[data-fire-budget]').forEach(btn=>btn.addEventListener('click',async()=>{
    const previousDrill=sim.state.civic?.incident;
    const result=await mutate('setFireBudget',Number(btn.dataset.fireBudget));
    let saved=true;if(result.ok){undoReady=false;syncWorld();saved=autosave();}
    toast(result.message+civicOutcome(previousDrill)+(saved?'':'。请导出存档保留调整。'),!result.ok||!saved);
  }));
  $('civic-watch-drill')?.addEventListener('click',()=>observeCivic('incident'));
  $('civic-start-drill')?.addEventListener('click',async()=>{
    const result=await mutate('startFireDrill');
    if(!result.ok){updateCivic();toast(result.message,true);return;}
    undoReady=false;paused=false;syncWorld();const saved=autosave();observeCivic('incident');
    toast('消防演练已开始，镜头跟随消防车；拖动或缩放地图可自由观察。'+(saved?'':'请导出存档保留本次进度。'),!saved);
  });
}
$('civic-button').addEventListener('click',openCivic);
$('civic-dispatch').addEventListener('click',()=>observeCivic('incident'));
$('civic-show-coverage').addEventListener('click',()=>{closeDialog('civic-dialog');selected=null;renderer.selectCell(null);selectTool('inspect');updateInspector();document.querySelector('[data-overlay="fire"]').click();});
$('tax-rate').addEventListener('change',async event=>{const result=await mutate('setTax',Number(event.target.value));undoReady=false;updateUI();if(!result.ok)toast(result.message,true);});
$('take-loan').addEventListener('click',async()=>{const result=await mutate('takeLoan');toast(result.message,!result.ok);syncWorld();});
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('locate-cell').addEventListener('click',()=>{const x=Number($('target-x').value),y=Number($('target-y').value),size=mapSize(sim.state);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=size||y>=size){toast(`坐标范围为 0–${size-1} 的整数。`,true);return;}keyboardCell={x,y};keyboardMode=true;renderer.focusCell(x,y);renderer.selectCell(keyboardCell);closeDialog('help-dialog');previewAt(keyboardCell);toast(`施工光标已定位 (${x}, ${y})，选择工具后按 Enter 施工。`);});
function updateIdentityMayors(){
  const mayors=currentMayors(),shared=mayors.cooperative;
  $('identity-title').textContent=shared?'合作城市档案':'为城市命名，也留下你的名字';
  $('identity-intro').textContent=shared?'这座城市，由你们一起建设。':'这座城市的故事，由你署名。';
  $('identity-mayors').hidden=!shared;
  $('identity-mayors').innerHTML=shared?`<h3>合作市长 · ${mayors.names.length} 人</h3><div class="mayor-name-list">${mayors.names.map(name=>`<span>${esc(name)}</span>`).join('')}</div><p>按合作城市成员自动署名，暂时离线仍保留名字。</p>`:'';
  $('mayor-label').hidden=shared;$('mayor-input').hidden=shared;$('mayor-input').disabled=shared;
  const canEdit=!shared||coop.view?.role==='owner';
  $('name-input').disabled=!canEdit;$('identity-save').hidden=!canEdit;
  $('identity-hint').textContent=shared?'合作市长名单随成员加入或移除自动更新；城市名称由房主修改。':'保存后会显示在城市页和政务档案里，并随这座城市的存档保留。你可以随时修改。';
}
function openIdentity(){
  if(!started)return;
  $('name-input').value=sim.state.districtName||'湾畔市';$('mayor-input').value=sim.state.mayorName||'';
  $('identity-reputation').innerHTML=reputationMarkup(sim.state);
  const goal=cityGoalProgress(sim.state),goalPercent=Math.round(goal.progress*100);
  $('identity-goal').innerHTML=`<section class="mayor-current-goal${goal.completed?' completed':''}">
    <div class="mayor-current-goal-heading"><span>当前任务 · 本局目标</span><b>${goal.completed?'✓ 已达成':'进行中'}</b></div>
    <h3>${esc(goal.name)}</h3>
    <p>${esc(goal.targetLabel)}</p>
    <div class="mayor-current-goal-progress" role="progressbar" aria-label="${esc(goal.name)}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${goalPercent}"><span style="width:${goalPercent}%"></span></div>
    <div class="mayor-current-goal-current"><strong>${esc(goal.currentLabel)}</strong><small>${goal.completed&&goal.completedMonth?`第 ${goal.completedMonth} 月达成`:`已完成 ${goalPercent}%`}</small></div>
    <small class="mayor-current-goal-note">${esc(goal.detail)}</small>
  </section>`;
  updateIdentityMayors();
  renderCoopInvite($('identity-invite'),coop,toast);
  $('identity-error').hidden=true;openDialog('name-dialog');
}
$('city-name-button').addEventListener('click',openIdentity);
$('name-form').addEventListener('input',()=>{$('identity-error').hidden=true;});
$('name-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const result=await mutate('setCityIdentity',{cityName:$('name-input').value,mayorName:coop.cityId?sim.state.mayorName||'':$('mayor-input').value});
  if(!result.ok){$('identity-error').textContent=result.message;$('identity-error').hidden=false;return;}
  undoReady=false;updateUI();const saved=autosave();closeDialog('name-dialog');
  toast(saved?(coop.cityId?'城市名称已保存，合作市长按成员自动署名。':'城市名称与市长署名已保存。'):'城市档案已更新，但自动保存失败。请在菜单导出存档。',!saved);
});
function latestSave(){return [safeRead('checkpoints',[])[0],safeRead('manual')].filter(Boolean).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)))[0];}
function refreshContinue(){$('continue-save').hidden=!latestSave();$('continue-save').textContent=soloRecord?'继续这座账号单人城市':'继续本地游客城市';}
const terrainDialog=document.createElement('dialog');terrainDialog.id='terrain-dialog';terrainDialog.className='terrain-dialog';document.body.appendChild(terrainDialog);
let chosenTerrain='bayside',chosenMapSize=SIZE,chosenCityGoal=null;
const terrainDrafts=new Map(),terrainEditor=setupTerrainEditor({notify:toast});
const chosenTerrainDraft=()=>terrainDrafts.get(chosenMapSize+':'+chosenTerrain);
function openTerrainPicker(){
  closeDialog('welcome-dialog');
 chosenCityGoal=null;
 terrainDialog.innerHTML=`<form id="city-setup-form"><div class="terrain-heading"><small>新城市 · 名称、规模、目标与地形</small><h2>从你的城市名字开始</h2><p>先选择城市规模，再从该规模对应的长期目标中确认一项。地图人口为常规规划下的参考值，并非城市上限。</p></div><div class="new-city-name"><label for="new-city-name">城市名称 <small>最多 24 个字符</small></label><input id="new-city-name" name="cityName" type="text" maxlength="24" required autocomplete="off" placeholder="请输入城市名称，例如：星河市"><p id="new-city-error" role="alert" hidden></p></div><section class="map-size-section"><div class="setup-label">1. 城市规模 <small>目标会随规模调整</small></div><div class="map-size-grid" role="group" aria-label="城市规模">${MAP_SIZE_OPTIONS.map(item=>`<button type="button" class="map-size-card" data-map-size="${item.size}" aria-pressed="${item.size===chosenMapSize}"><strong>${item.name}</strong><span>${item.detail}</span><small>${item.populationEstimate}</small></button>`).join('')}</div></section><section class="city-goal-section"><div class="setup-label">2. 本局目标 <small id="city-goal-scale-note">根据城市规模生成，创建前必须确认一项</small></div><div id="city-goal-grid" class="city-goal-grid" role="group" aria-label="本局目标"></div><p id="city-goal-error" role="alert" hidden>请选择并确认一个本局目标</p></section><div class="setup-label">3. 地形预设</div><div class="terrain-grid" role="group" aria-label="地形预设">${Object.entries(TERRAIN_PRESETS).map(([id,item])=>`<button type="button" class="terrain-card" data-terrain="${id}" aria-pressed="${id===chosenTerrain}">${terrainPreview(id)}<strong>${item.name}</strong><span>${item.feature}</span></button>`).join('')}</div><p id="terrain-description"></p><div class="terrain-actions"><button type="button" id="terrain-back" class="text-button">返回</button><button type="submit" id="terrain-start" class="primary-button" disabled>按此规模与目标创建城市</button></div></form>`;
 terrainDialog.querySelector('.terrain-heading').insertAdjacentHTML('beforeend','<div class="city-import-shortcut"><span>已经有城市存档？保留原来的地图与建设进度。</span><button type="button" id="terrain-import" class="secondary-button">导入城市存档</button></div>');
 $('terrain-import').onclick=()=>cityImport.open();
 terrainDialog.querySelector('.terrain-actions').insertAdjacentHTML('beforebegin','<section class="terrain-editor-shortcut"><img id="terrain-draft-thumbnail" alt="待创建地图的地形预览"><div><strong id="terrain-draft-title">亲手设计这张地图</strong><p id="terrain-draft-summary">调整河流、海岸与树林，先预览，再开始建城。</p><button type="button" class="text-button" id="terrain-use-preset" hidden>恢复所选地形预设</button></div><button type="button" class="secondary-button" id="terrain-edit">编辑地图</button></section>');
 const renderGoals=()=>{
  const option=MAP_SIZE_OPTIONS.find(item=>item.size===chosenMapSize),grid=$('city-goal-grid');
  $('city-goal-scale-note').textContent=`${option.name}目标 · 创建前必须确认一项`;
  grid.innerHTML=cityGoalsForMapSize(chosenMapSize).map(goal=>`<button type="button" class="city-goal-option" data-city-goal="${goal.id}" aria-pressed="${goal.id===chosenCityGoal}"><strong>${goal.name}</strong><span>${goal.summary}</span><small>${goal.detail}</small></button>`).join('');
  grid.querySelectorAll('[data-city-goal]').forEach(b=>b.onclick=()=>{chosenCityGoal=b.dataset.cityGoal;$('city-goal-error').hidden=true;update();});
 };
 const update=()=>{terrainDialog.querySelectorAll('[data-terrain]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.terrain===chosenTerrain)));terrainDialog.querySelectorAll('[data-map-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.mapSize)===chosenMapSize)));terrainDialog.querySelectorAll('[data-city-goal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cityGoal===chosenCityGoal)));$('terrain-start').disabled=!chosenCityGoal;$('terrain-description').textContent=TERRAIN_PRESETS[chosenTerrain].description;
  const draft=chosenTerrainDraft(),summary=terrainDraftSummary(draft||newTerrainDraft(chosenTerrain,chosenMapSize));
  $('terrain-draft-thumbnail').src=terrainDraftThumbnail(draft||newTerrainDraft(chosenTerrain,chosenMapSize));$('terrain-use-preset').hidden=!draft;
  $('terrain-draft-title').textContent=draft?'已使用自定义地图':'亲手设计这张地图';$('terrain-edit').textContent=draft?'继续编辑地图':'编辑地图';
  $('terrain-draft-summary').textContent=draft?`${chosenMapSize} × ${chosenMapSize} · 陆地 ${summary.landPercent}% · 水域 ${summary.waterPercent}% · 手绘树林 ${number(summary.forest)} 格`:'调整河流、海岸与树林，先预览，再开始建城。';
 };
 $('terrain-edit').onclick=()=>terrainEditor.open({terrainPreset:chosenTerrain,mapSize:chosenMapSize,draft:chosenTerrainDraft(),apply:draft=>{chosenTerrain=draft.terrainPreset;terrainDrafts.set(chosenMapSize+':'+chosenTerrain,draft);update();}});
 $('terrain-use-preset').onclick=()=>{terrainDrafts.delete(chosenMapSize+':'+chosenTerrain);update();};
 terrainDialog.querySelectorAll('[data-terrain]').forEach(b=>b.onclick=()=>{chosenTerrain=b.dataset.terrain;update();});
 terrainDialog.querySelectorAll('[data-map-size]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.mapSize);if(next!==chosenMapSize){chosenMapSize=next;chosenCityGoal=null;$('city-goal-error').hidden=true;renderGoals();}update();});
 $('terrain-back').onclick=()=>{closeDialog('terrain-dialog');openDialog('welcome-dialog');};
 $('city-setup-form').onsubmit=event=>{event.preventDefault();if(!chosenCityGoal){$('city-goal-error').hidden=false;return;}startCity(false,chosenTerrain,$('new-city-name').value,chosenMapSize,chosenCityGoal,chosenTerrainDraft());};
 $('new-city-name').oninput=()=>{$('new-city-error').hidden=true;};
 renderGoals();update();openDialog('terrain-dialog');$('new-city-name').focus();
}
terrainDialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog('terrain-dialog');openDialog('welcome-dialog');});
function startCity(demo,terrainPreset='bayside',cityName='',selectedMapSize=SIZE,selectedCityGoal=DEFAULT_CITY_GOAL,terrainDraft){
  const city=new CitySimulation({demo,seed:2026,terrainPreset,mapSize:selectedMapSize,cityGoal:selectedCityGoal,terrainDraft});
  if(!demo){
    const result=city.setCityIdentity({cityName,mayorName:''});
    if(!result.ok){$('new-city-error').textContent=result.message;$('new-city-error').hidden=false;$('new-city-name').focus();return;}
  }
  soloRecord=null;sim=city;
  tutorialProgress=onboardingProgress(null,{fresh:!demo});tutorialClock=!demo;tutorialPhase=null;
  if(soloLibrary.owner()){city.setCityIdentity({cityName:city.state.districtName,mayorName:coop.identity.actor.name});try{soloRecord=soloLibrary.create(snapshot());}catch{toast('账号存档暂未建立，城市先保存在本机。可稍后在我的城市中绑定。',true);}}
  modeName=demo?'示范城市 · 自由经营':'新建城市 · 从零开始';
  guideExpanded=false;selected=null;undoReady=false;started=true;paused=!demo;speed=1;lastEditTick=null;lastCelebrationState=celebrationSnapshot(sim.state);accumulator=0;
  selectTool('inspect');$('guide-steps').hidden=demo;
  syncWorld();renderer.resetCamera();if(!demo)renderer.focusCell(9,32);
  closeDialog('welcome-dialog');closeDialog('terrain-dialog');
  if(!demo){setPanelCollapsed('left',true);setPanelCollapsed('right',true);locateOnboarding();}
  if(autosave())toast(demo?'小镇交给你了。先试试沿着街道规划新的住宅。':`欢迎来到${sim.state.districtName}！从城外入口延伸第一条路，再在路边接通水电。`);
}
$('start-new').addEventListener('click',openTerrainPicker);$('start-demo').addEventListener('click',()=>startCity(true));
$('continue-save').addEventListener('click',()=>requestLoad(latestSave()));

document.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.closest('button')&&['Enter',' '].includes(event.key))return;
  shiftDown=event.shiftKey;
  if(anyDialog())return;
  if(event.key==='Escape'){if(openToolGroup){event.preventDefault();closeToolSubmenu(true);return;}if(compactMedia.matches&&$('game').matches('.view-open,.layers-open')){event.preventDefault();setMobileMapPanel(null);return;}dragStart=null;selectTool('inspect');selected=null;renderer.selectCell(null);updateInspector();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();manualSave();return;}
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.key.toLowerCase()==='p'){$('pause').click();return;}
  if(event.key.toLowerCase()==='q'){renderer.rotate(-1);return;}
  if(event.key.toLowerCase()==='e'){renderer.rotate(1);return;}
  if(event.key==='?'){$('help-button').click();return;}
  const tool=catalog.find(t=>t.key===event.key);if(tool){selectTool(tool.id);return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();const size=mapSize(sim.state);keyboardMode=true;keyboardCell={x:clamp(keyboardCell.x+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0),0,size-1),y:clamp(keyboardCell.y+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0),0,size-1)};renderer.selectCell(keyboardCell);previewAt(keyboardCell);$('coordinate').textContent=`${keyboardCell.x} · ${keyboardCell.y}`;
  }
  if(event.key==='Enter'&&keyboardMode){event.preventDefault();if(currentTool==='inspect')handleSelect(keyboardCell);else commitBuild(keyboardCell,keyboardCell);}
});
document.addEventListener('keyup',event=>{shiftDown=event.shiftKey;});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();accumulator=0;renderer?.setPaused(isStopped());if(document.hidden&&started)autosave();});
window.addEventListener('beforeunload',()=>{if(started)autosave();});

function advance(){
  if(coop.cityId){renderer.setPaused(isStopped()||!coop.connected);return;}
  const now=performance.now(),elapsed=Math.min(now-lastTime,500);lastTime=now;
  renderer.setPaused(isStopped());if(isStopped())return;
  accumulator+=elapsed*speed;
  if(accumulator<3000)return;
  while(accumulator>=3000){
    const oldHonor=mayorReputation(sim.state);
    const oldMonth=sim.state.month,oldIncident=sim.state.civic?.incident,oldRiskIds=new Set((sim.state.cityIncidents?.active||[]).map(event=>event.id));sim.tick();undoReady=false;accumulator-=3000;
    const newRisk=(sim.state.cityIncidents?.active||[]).find(event=>!oldRiskIds.has(event.id));
    if(newRisk){const type=CITY_INCIDENT_TYPES[newRisk.kind];toast(`${type.title}：${type.alert}`,true);}
    if(oldIncident&&!sim.state.civic?.incident){
      const record=sim.state.civic.history.find(item=>item.id===oldIncident.id);
      if(record)toast(record.message,record.status==='cancelled');
      autosave();
    }
    if(sim.state.month!==oldMonth)autosave();
    const newHonor=mayorReputation(sim.state);
    if(newHonor.landmarkBonus>oldHonor.landmarkBonus)toast(`名胜建设 / 修缮完成，荣誉积分 +${newHonor.landmarkBonus-oldHonor.landmarkBonus} · 当前 Lv.${newHonor.level} · ${newHonor.title}`);
    const currentCelebrationState=celebrationSnapshot(sim.state);
    milestoneQueue.push(...reachedCelebrations(lastCelebrationState,currentCelebrationState));
    lastCelebrationState=currentCelebrationState;
    if(milestoneQueue.length){autosave();showNextMilestone();break;}
  }
  syncWorld();if(hover&&currentTool!=='inspect')previewAt(hover);
}

try {
  sim=new CitySimulation({demo:true,seed:2026});
  renderer=new CityRenderer($('world'),{
    onHover,
    onActorSelect:handleActor,
    onSelect:handleSelect,
    onBuildingFilterClear:()=>{renderer.setBuildingFilter(null);syncBuildingFilterUI();},
    shouldPanEmptyMove:()=>currentTool==='move'&&moveSourceId===null&&moveRoadSource===null,
    getUpgradePreview:b=>sim.preview('upgrade',[{x:b.x,y:b.y}]),
    onUpgrade:b=>{
      if(!started||anyDialog())return;
      selected=null;renderer.selectCell(null);updateInspector();
      commitBuild({x:b.x,y:b.y},{x:b.x,y:b.y},true,coopVersion());
    },
    onDragStart:cell=>{if(started&&!anyDialog()&&currentTool!=='inspect'){
      dragVersion=coopVersion();
      movePickedOnDrag=false;moveDraggedAfterPick=false;
      if(currentTool==='move'&&moveSourceId===null&&moveRoadSource===null){
        const tile=sim.tile(cell.x,cell.y);
        if(tile?.buildingId==null&&!tile?.road)return;
        commitBuild(cell,cell,false,dragVersion);
        if(tile?.buildingId==null&&(tile.bridge||(cell.x===0&&cell.y===32)))return;
        movePickedOnDrag=true;
      }
      dragStart=cell;previewAt(cell);
    }},
    onDragMove:cell=>{if(dragStart){if(movePickedOnDrag&&(cell.x!==dragStart.x||cell.y!==dragStart.y))moveDraggedAfterPick=true;previewAt(cell);}},
    onDragEnd:cell=>{if(dragStart){const start=dragStart,version=dragVersion;dragStart=null;dragVersion=undefined;
      if(currentTool==='move'&&!cell){selectTool('move');return;}
      if(currentTool==='move'&&movePickedOnDrag&&cell.x===start.x&&cell.y===start.y&&!moveDraggedAfterPick){movePickedOnDrag=false;return;}
      movePickedOnDrag=false;moveDraggedAfterPick=false;commitBuild(start,cell,false,version);
    }},
  });
  try{renderer.setLightingMode(localStorage.getItem(PREFIX+'lighting-mode')||'day');}catch{}
  updateLightingButton();
  lastCelebrationState=celebrationSnapshot(sim.state);syncWorld();renderer.setPaused(true);refreshContinue();
  coopUI=setupCoopUI({client:coop,enter:enterCoop,currentCity:()=>started&&!coop.cityId?sim.serialize():null,leave:leaveCoop,notify:toast,openAccount:options=>accountUI.open(options),importCity:()=>cityImport.open('cooperative'),mapEditor:terrainEditor,locate:log=>{
   const b=sim.state.buildings.find(b=>log.objects.includes(b.id)),cell=b||log.cells[0];
   selectTool('inspect');renderer.focusCell(cell.x,cell.y);selected={x:cell.x,y:cell.y};renderer.selectCell(selected);
   if(!b){renderer.setPreview(log.cells,true);toast('显示当时的建设范围；建筑可能已移动或拆除。');}updateInspector();
  }});
  accountUI=setupAccountUI({client:coop,library:soloLibrary,
   current:()=>started&&!coop.cityId?{snapshot:snapshot(),record:soloRecord}:null,
   localSaves:guestSaves,load:loadAccountCity,loadLocal:requestLoad,removeSolo:removeAccountSolo,removeLocal:removeGuestSave,removeShared:removeCooperativeCity,notify:toast,
   openCoop:()=>coopUI.open(),enterCoop,
   bind:async()=>{
    if(!started||coop.cityId)throw Error('请先打开一座单人城市');if(!autosave())throw Error('请先导出存档');
    if(!soloRecord){const local=snapshot();soloRecord=await soloLibrary.bind(local);retireBoundLocalCopies(local,soloRecord.owner);try{soloLibrary.persist(soloRecord);}catch{/* The server copy is already safe; later saves can retry the local cache. */}}
    if(!autosave()&&!soloRecord.cacheLimited)throw Error('本机存储不足');await soloLibrary.flush(soloRecord);toast(soloRecord.cacheLimited?'城市已绑定并保存到账号；此浏览器空间不足，将优先使用账号存档。':'这座单人城市已绑定并保存到账号。');
   },
   prepareLogout:async()=>{if(started&&!coop.cityId&&!autosave())throw Error('请先导出当前进度');if(soloRecord){try{await soloLibrary.flush(soloRecord);}catch{toast('未同步的进度保留在本机，下次登录原账号后继续同步。');}}}
  });
  for(const id of ['account-start','account-menu','account-button'])$(id).onclick=()=>accountUI.open();
  const cityVisit=setupCityVisit({isLoggedIn:()=>!!coop.identity,openAccount:options=>accountUI.open(options),onClose:()=>{if(!started&&!anyDialog())openDialog('welcome-dialog');},join:async code=>{
   if(coop.busy||(!coop.accessDenied&&coop.pending().length))throw Error('正在提交建设，请稍后再加入');
   const joined=await coop.request('/join',{method:'POST',body:{code}});await enterCoop(joined.cityId);
  }});
  $('account-dialog').addEventListener('close',()=>{if(!started&&!$('welcome-dialog').open&&!$('city-visit-dialog').open)openDialog('welcome-dialog');});
  const openCooperation=()=>coop.identity?coopUI.open():accountUI.open({then:()=>coopUI.open()});
  $('coop-start').onclick=openCooperation;$('coop-menu').onclick=openCooperation;
  updateAccountUI();
  setInterval(()=>soloLibrary.sync(),15000);
  window.addEventListener('online',()=>soloLibrary.sync());
  $('loading').hidden=true;openDialog('welcome-dialog');
  try{await coop.refreshIdentity();}catch{ /* Keep saved identity during a temporary outage. */ }
  updateAccountUI();
  const sharedLink=new URLSearchParams(location.hash.slice(1));
  if(sharedLink.has('join')){closeDialog('welcome-dialog');cityVisit.open(sharedLink.get('join'));}
  else if(sharedLink.has('city')&&coop.identity)enterCoop(sharedLink.get('city')).catch(e=>{toast(e.message,true);coopUI.open();});
  else if(sharedLink.has('city'))openCooperation();
  setInterval(advance,100);
  setInterval(updateSignalPanel,250);
} catch(error){
  console.error(error);$('loading').innerHTML=`<div class="loading-error"><span class="loading-logo">湾畔市</span><p>城市暂时没有加载成功。</p><p>${esc(error.message)}</p><p>请使用支持 WebGL 2 的桌面浏览器，开启硬件加速后重试。</p><button class="primary-button" onclick="location.reload()">重新加载</button></div>`;
}
