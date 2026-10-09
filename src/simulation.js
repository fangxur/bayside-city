import {RouteHeap as Heap,vehicleNetwork,vehicleRoadPath} from './vehicle-routing.js';
import {isBankrupt,latchBankruptcy,BANKRUPTCY_MESSAGE} from './city-bankruptcy.js';
import {roadPath} from './road-network.js';
import {INTERCHANGE_MAINTENANCE,interchangeOffer,interchangeBounds,interchangeAt,interchangeCells,interchangeGeometryReason,refreshInterchanges,groundRoadAccess,roadNodes,roadSteps,roadIndex} from './interchanges.js';
import {busRoutes,servedBusStops,busCommuteAvailable,policeCoverageCells} from './network-services.js';
import {LARGE_UTILITIES,utilityScale} from './utility-buildings.js';
import {LEGACY_WIDE_PRIVATE_KINDS} from './business-kinds.js';
import {requiresRoad} from './building-access.js';
import {newMarinaLife,marinaPlacement,marinaBerths,refreshMarinaLife,settleMarinaMonth,loadMarinaLife,shipyardReady,YACHT_TYPES} from './marina.js';
import {ZONE_ECONOMY,ECONOMY_RULES,privateMaintenance,privatePayroll,privateBusinessTax,publicPayroll} from './economy.js';
import { DECORATIONS } from './decorations.js';
import { BUSINESS_KINDS, businessKindsFor, businessKind } from './business-kinds.js';
import { TERRAIN_PRESETS, terrainAt } from './terrain-presets.js';
import {validateTerrainDraft} from './terrain-draft.js';
import { buildingStyle } from './building-styles.js';
import { calculateDemand, zoningReadiness } from './city-demand.js';
import { calculateServiceCoverage, SERVICE_LABELS } from './service-coverage.js';
import { buildingCells, footprintSize, newBuildingFootprint, compactFamousSculpturePlots } from './building-footprint.js';
import { COMMUNITY_BUILDINGS, communityService, isCommunityBusiness } from './community-buildings.js';
import { LANDMARKS,MAX_LANDMARK_LEVEL,LANDMARK_LEVEL_NAMES,landmarkHonor } from './landmarks.js';
import { getCitizenStory, eventTitle } from './city-life.js';
import {commercialPrerequisite,availableCommercialKinds} from './commercial-prerequisites.js';
import {newFestivalGames,enterDragonRace,loadFestivalGames,claimFestivalPoints,redeemFestivalReward} from './dragon-boat.js';
import { civicGardenGroups, privateBuildingGroups } from './city-layout.js';
import { gardenRadius, gardenStrength, BUILDING_TIERS, CITY_STAGES, ROAD_TIERS, MAX_ROAD_LEVEL, roadUpgradeOffer, roadLevelForPopulation, unlockedRoadLevel, buildingCapacity, maintenanceMultiplier, upgradeOffer, UTILITY_MAINTENANCE, isUtility, utilityCapacity, domainStageReadiness, latchDomainMilestones, residentialArrivalCohort } from './progression.js';
import { FIRE_BUDGETS, CIVIC_POLICIES, activeCivicPolicy, cityHallRequirement, civicBuildingReady, civicServiceReady, calculateCivicServices, fireRange, planFireDrill, validateFireDrill } from './city-services.js';
import {CITY_INCIDENT_TYPES,ensureCityIncidents,refreshCityIncidents,advanceCityIncidents,buildingIncidentEffects,cityIncidentDemandPenalty,incidentAlert,incidentTitle} from './city-incidents.js';
import {workforceDashboard} from './workforce-dashboard.js';
import {DEFAULT_MAP_SIZE,validMapSize} from './grid.js';
import {cityEntrances,entranceRoadIndexes,ENTRANCE_SIDE_NAMES} from './city-entrances.js';
import {DEFAULT_CITY_GOAL,loadCityGoal,latchCityGoal,newCityGoal,validCityGoal} from './city-goals.js';

export const SIZE = DEFAULT_MAP_SIZE;
export const TOOLS = {
  road: { label: '道路', cost: 25, description: '拖动铺路；接到地图边缘可增设对外入口', key: '1' },
  residential: { label: '住宅', cost: ZONE_ECONOMY.residential.cost, description: '规划住宅区，临路且通水电后自动成长', key: '2' },
  commercial: { label: '商业', cost: ZONE_ECONOMY.commercial.cost, description: '提供消费与岗位，需要居民支持', key: '3' },
  industrial: { label: '工业', cost: ZONE_ECONOMY.industrial.cost, description: '提供大量岗位与货源，也产生污染', key: '4' },
  power: { label: '供电站', cost: 2500, description: '容量 750；月维护 150；可随城市阶段升至六级', key: '5' },
  water: { label: '水塔', cost: 1500, description: '容量 900；月维护 80；可随城市阶段升至六级', key: '6' },
  park: { label: '小公园', cost: 600, description: '无需道路水电，改善半径 5 格环境；月维护 18', key: '7' },
  plaza: { label: '滨水广场', cost: 1400, description: '无需道路水电，改善半径 8 格环境；月维护 35' },
  interchangeNS:{label:'立交 · 南北高架',cost:6000,description:'预览并改造三格及以上宽的十字路口，南北高架、东西地面；高架两端需各两格坡道及平路接头'},
  interchangeEW:{label:'立交 · 东西高架',cost:6000,description:'预览并改造三格及以上宽的十字路口，东西高架、南北地面；高架两端需各两格坡道及平路接头'},
  interchangeFlat:{label:'恢复平面路口',cost:0,description:'移除立交结构并保留全部道路，恢复平面转弯与红绿灯'},
  bridge: { label: '桥梁', cost: 3500, description: '选择河面或岸边；两岸有落点、无建筑阻挡且资金足够即可建造' },
  upgrade: { label: '升级', cost: 30, description: '道路升级只看人口；建筑升级按城市阶段、服务与景观条件解锁' },
  bulldoze: { label: '拆除', cost: 0, description: '拆除道路、建筑与分区；设施回收部分费用', key: '8' },
  move: { label: '移动', cost: 0, description: '先选建筑，再点空地；保留居民和建筑等级', key: 'm' },
  landmark: { label: '河湾地标', cost: 0, description: '完成首阶段后获得；月维护 100' },
  fireStation: { label: '消防站', cost: 2200, description: '沿真实道路覆盖街区；标准预算范围 14 格、月维护 120' },
  cityHall: { label: '市政府', cost: 3000, description: '2×2 全城唯一；负责城市晋级、市政方针、预算、住宅覆盖和消防调度；月维护 80' },
};

for (const [type, item] of Object.entries({...LARGE_UTILITIES, ...LANDMARKS, ...COMMUNITY_BUILDINGS, ...DECORATIONS})) TOOLS[type] = { label: item.name, cost: item.cost, description: item.description };

const PRIVATE = ['residential', 'commercial', 'industrial'];
const PUBLIC = [...Object.keys(DECORATIONS), 'power', 'water', 'park', 'plaza', ...Object.keys(LANDMARKS), ...Object.keys(COMMUNITY_BUILDINGS), 'fireStation', 'cityHall'];
const GARDENS = ['park', 'plaza', ...Object.keys(DECORATIONS)];
function beautyEffect(b) {
  if(!b.active||b.progress<1)return null;
  if(GARDENS.includes(b.type))return {radius:gardenRadius(b),strength:gardenStrength(b)};
  if(LANDMARKS[b.type]&&b.connected)return {radius:gardenRadius(b),strength:gardenStrength(b)};
  const service=communityService(b);
  return service?.beauty&&civicBuildingReady(b)?{radius:service.radius,strength:service.beauty}:null;
}
const TYPES = [...PRIVATE, ...PUBLIC];
const MAINTENANCE = { ...UTILITY_MAINTENANCE, park: 18, plaza: 35, landmark: 100, fireStation: 120, cityHall: 80 };
const NAMES = { residential: '河湾住宅', commercial: '街角商店', industrial: '城市工坊', power: '小型供电站', water: '社区水塔', park: '街心花园', plaza: '滨水广场', landmark: '河湾之帆', fireStation: '社区消防站', cityHall: '湾畔市政府' };
for (const [type, item] of Object.entries({...LANDMARKS, ...COMMUNITY_BUILDINGS, ...DECORATIONS})) { MAINTENANCE[type] = item.maintenance; NAMES[type] = item.name; }
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const index = (x, y, size = SIZE) => y * size + x;
const inBounds = (x, y, size = SIZE) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
const clone = value => JSON.parse(JSON.stringify(value));
const round = n => Math.round(n * 10) / 10;
const capacity = b => PRIVATE.includes(b.type) ? buildingCapacity(b) : communityService(b)?.jobs||0;
const neighbors = (x, y, size = SIZE) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => inBounds(a, b, size));

export class CitySimulation {
  constructor({ demo = false, seed = 2026, terrainPreset = 'bayside', mapSize = SIZE, cityGoal = DEFAULT_CITY_GOAL, terrainDraft } = {}) {
    if(!Object.hasOwn(TERRAIN_PRESETS,terrainPreset))throw new Error('未知地形预设');
    if(!validMapSize(mapSize))throw new Error('未知地图尺寸');
    if(!validCityGoal(cityGoal))throw new Error('未知城市目标');
    if(demo)terrainPreset='bayside';
    if(demo)mapSize=SIZE;
    const draft=!demo&&terrainDraft!==undefined?validateTerrainDraft(terrainDraft,mapSize):null;
    if(draft)terrainPreset=draft.terrainPreset;
    const cleanSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 2026;
    this.state = {
      version: 1, mapSize, terrainPreset, seed: cleanSeed, rng: cleanSeed || 1, tick: 0, month: 1, money: 30000,
      taxRate: 9, tiles: [], buildings: [], nextId: 1, districtName: terrainPreset==='bayside'?'湾畔市':TERRAIN_PRESETS[terrainPreset].name+'新城', mayorName: '', cityGoal:newCityGoal(cityGoal),
      interchanges:[],
      milestones: { named: false, bridge: false, density: false, landmark: false, completed: false, metropolis: false, capital: false, regional:false, mature:false, civic:false, global:false }, roadLevelUnlocked:1,
      loan: { taken: false, remaining: 0, grace: 0, monthsPaid: 0 }, bankruptcy:null, profitableMonths: 0,
      cityLife: { lastEventMonth: 0, activeEvent: null },
      cityIncidents:{active:[],history:[]},
      festivalGames:newFestivalGames(),marinaLife:newMarinaLife(),
      civic: { fireBudget: 100, policy:'balanced', lastDrillMonth: 0, incident: null, history: [] },
      routes: [], stats: {}, history: [], lastMonthly: null,
      ...(draft?{customTerrain:true}:{}),
    };
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) this.state.tiles.push({ x, y,
        terrain: terrainAt(terrainPreset,x,y,mapSize), road: 0, zone: null,
        buildingId: null, connected: false, pollution: 0, traffic: 0, powered: false, watered: false, bridge: false,
      });
    }
    if(draft)for(let i=0;i<this.state.tiles.length;i++){
      const code=draft.cells[i],tile=this.state.tiles[i];tile.terrain=code==='w'?'water':'land';
      if(code==='f'||code==='g')tile.vegetation=code==='f'?1:0;
    }
    for (let x = 0; x <= 7; x++) this.tile(x, 32).road = 1;
    this._undo = null;
    if (demo) this._makeDemo();
    this.recalculate();
  }

  _index(x,y){return index(x,y,this.state.mapSize);}
  _inBounds(x,y){return inBounds(x,y,this.state.mapSize);}
  _neighbors(x,y){return neighbors(x,y,this.state.mapSize);}
  tile(x, y) { return this._inBounds(x, y) ? this.state.tiles[this._index(x, y)] : null; }

  _random() {
    let t = this.state.rng += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state.rng >>>= 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  _newBuilding(x, y, type, complete = false, size = newBuildingFootprint(type)) {
    const b = { id: this.state.nextId++, x, y, type, level: 1, progress: complete ? 1 : 0.05,
      population: 0, jobs: 0, workers: 0, active: true, connected: false, powered: false,
      watered: false, happiness: 75, problem: '', commute: 0, age: 0,
      variant: Math.floor(this._random() * 6), shortageTicks: 0 };
    if(type==='residential' && this.tile(x,y).businessKind)b.businessKind=this.tile(x,y).businessKind;
    if (['commercial','industrial'].includes(type)) {
      const unlocked=type==='commercial'?availableCommercialKinds(this.state):[];
      const available=unlocked.length?unlocked:businessKindsFor(type),kinds=type==='commercial'?available.filter(kind=>newBuildingFootprint(kind)===size):available;
      b.businessKind=this.tile(x,y).businessKind || (kinds.length?kinds:available)[(b.id+b.variant)%(kinds.length||available.length)];
      this.tile(x,y).businessKind=b.businessKind;
    }
    if (size>1) b.footprint = size;
    this.state.buildings.push(b); for (const c of buildingCells(b)) { this.tile(c.x,c.y).buildingId=b.id; this.tile(c.x,c.y).zone=PRIVATE.includes(type)?type:null;if(!PRIVATE.includes(type))delete this.tile(c.x,c.y).businessKind;else if(b.businessKind)this.tile(c.x,c.y).businessKind=b.businessKind; }
    return b;
  }

  _makeDemo() {
    this.state.money = 24000;
    this.state.tick = 75; this.state.month = 6;
    for (let x = 7; x <= 8; x++) this.tile(x, 32).road = 1;
    for (const x of [8, 13, 18, 23, 28, 33]) for (let y = 20; y <= 45; y++) if (this.tile(x, y).terrain === 'land') this.tile(x, y).road = 1;
    for (const y of [20, 25, 30, 35, 40, 45]) for (let x = 8; x <= 34; x++) if (this.tile(x, y).terrain === 'land') this.tile(x, y).road = 1;
    const add = (x, y, type) => { if (PRIVATE.includes(type)) this.tile(x, y).zone = type; return this._newBuilding(x, y, type, true, type==='plaza'?1:newBuildingFootprint(type)); };
    add(31, 44, 'power'); add(9, 36, 'water');
    for (const [x, y] of [[12, 24], [17, 24], [22, 24], [12, 29], [17, 29], [22, 29], [9, 34], [17, 34]]) add(x, y, 'park');
    add(24, 29, 'plaza');
    // Give each actual street block a turn before adding another building to
    // it. This avoids a scan-line settlement while retaining expansion room.
    const sites = (left, top, right, bottom, count) => {
      const blocks = new Map();
      const spatialHash = ({ x, y }) => {
        let n = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263) + this.state.seed;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return (n ^ (n >>> 16)) >>> 0;
      };
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        const t = this.tile(x, y);
        if (t.terrain === 'water' || t.road || t.buildingId !== null || !this._neighbors(x, y).some(([a, b]) => this.tile(a, b).road)) continue;
        const block = `${Math.floor((x - 8) / 5)},${Math.floor((y - 20) / 5)}`;
        if (!blocks.has(block)) blocks.set(block, []);
        blocks.get(block).push({ x, y });
      }
      for (const candidates of blocks.values()) candidates.sort((a, b) => spatialHash(a) - spatialHash(b));
      const selected = [];
      while (selected.length < count) {
        let available = false;
        for (const candidates of blocks.values()) {
          if (!candidates.length || selected.length === count) continue;
          selected.push(candidates.shift()); available = true;
        }
        if (!available) break;
      }
      return selected;
    };
    sites(9, 21, 22, 34, 52).forEach(({ x, y }, i) => {
      const b = add(x, y, 'residential'); b.population = i % 4 === 0 ? 9 : 8; b.age = 50;
      if ([8, 21, 37].includes(i)) { b.level = 2; b.population = 16; }
    });
    for (const { x, y } of sites(19, 26, 26, 34, 14)) add(x, y, 'commercial');
    for (const { x, y } of sites(27, 36, 34, 44, 10)) add(x, y, 'industrial');
    this.state.milestones.named = true;
  }

  _adjacentRoads(x, y, size = 1) {
    return [...new Set(buildingCells({x,y,footprint:size}).flatMap(c => this._neighbors(c.x,c.y)).map(([a, b]) => this._index(a, b)))].filter(i => this.state.tiles[i].road && this.state.tiles[i].connected && groundRoadAccess(this.state.tiles[i]));
  }

  _workplaceRoads(building) {
    const adjacent=this._adjacentRoads(building.x,building.y,footprintSize(building));
    if(adjacent.length||!isCommunityBusiness(building.type))return adjacent;
    const cells=buildingCells(building);let nearest=Infinity,result=[];
    for(let i=0;i<this.state.tiles.length;i++){
      const tile=this.state.tiles[i];if(!tile.road||!tile.connected||!groundRoadAccess(tile))continue;
      const distance=Math.min(...cells.map(cell=>Math.abs(cell.x-tile.x)+Math.abs(cell.y-tile.y)));
      if(distance>4||distance>nearest)continue;
      if(distance<nearest){nearest=distance;result=[];}
      result.push(i);
    }
    return result;
  }

  _hasRoadside(x,y,size=1) {
    return buildingCells({x,y,footprint:size}).some(c=>this._neighbors(c.x,c.y).some(([a,b])=>this.tile(a,b)?.road&&groundRoadAccess(this.tile(a,b))));
  }

  preview(tool, inputCells, options = {}) {
    if(isBankrupt(this.state))return {valid:false,cost:0,cells:[],affected:0,reason:BANKRUPTCY_MESSAGE};
    const kind=businessKind(tool);
    if(kind) return this.preview(kind.zone,inputCells,{...options,businessKind:tool});
    if (tool === 'move') return options.roadSource
      ? this.previewMoveRoad(options.roadSource, inputCells?.[0])
      : this.previewMove(options.buildingId, inputCells?.[0]);
    const invalid = reason => ({ valid: false, cost: 0, cells: [], reason, affected: 0 });
    if(tool==='commercial'){
      const prerequisite=commercialPrerequisite(this.state,options.businessKind);
      if(!prerequisite.allowed)return invalid(prerequisite.reason);
    }
    if (!Object.hasOwn(TOOLS, tool)) return invalid('请选择有效的建设工具');
    if (!Array.isArray(inputCells) || !inputCells.length || inputCells.length > this.state.mapSize ** 2) return invalid('请选择地图上的位置');
    if (inputCells.some(c => !c || !this._inBounds(c.x, c.y))) return invalid('不能在地图之外建设');
    if(tool.startsWith('interchange'))return interchangeOffer(this.state,inputCells[0],tool==='interchangeNS'?'ns':tool==='interchangeEW'?'ew':null);
    let cells = [...new Map(inputCells.map(c => [this._index(c.x, c.y), { x: c.x, y: c.y }])).values()];
    if (PUBLIC.includes(tool)) cells = cells.slice(0, 1);
    if (tool === 'upgrade' && !options.roadsOnly) {
      const groups=civicGardenGroups(this.state.buildings);
      const expanded=cells.flatMap(c=>{
        const group=groups.get(this.tile(c.x,c.y).buildingId);
        return group?this.state.buildings.filter(b=>group.members.includes(b.id)).map(b=>({x:b.x,y:b.y})): [c];
      });
      cells=[...new Map(expanded.map(c=>[this._index(c.x,c.y),c])).values()];
    }
    if (tool === 'cityHall' && this.state.buildings.some(b => b.type === tool)) return invalid('城市已有市政府，暂停的市政府也不能重复建设');
    const facility = COMMUNITY_BUILDINGS[tool];
    if (facility?.minPopulation && this.state.stats.population < facility.minPopulation) return invalid(`城市达到 ${facility.minPopulation.toLocaleString('zh-CN')} 人后解锁${facility.name}`);
    if (LANDMARKS[tool] && !this.state.milestones[LANDMARKS[tool].gate]) return invalid(`完成 ${LANDMARKS[tool].population.toLocaleString()} 人城市目标后解锁${LANDMARKS[tool].name}`);
    if (LANDMARKS[tool] && this.state.buildings.some(b => b.type === tool)) return invalid(`${LANDMARKS[tool].name}已建成，每种名胜限一座`);
    const placementType=options.businessKind||tool,placementSize=newBuildingFootprint(placementType),placementCost=businessKind(placementType)?.cost??TOOLS[tool].cost;
    if(tool==='marina'){const reason=marinaPlacement(this.state,{...cells[0],footprint:2});if(reason)return {valid:false,cost:placementCost,cells:buildingCells({...cells[0],footprint:2}).filter(c=>this._inBounds(c.x,c.y)),reason,affected:0};}
    if (placementSize > 1) {
      const size=placementSize;
      const footprint=buildingCells({...cells[0],footprint:size});
      const blocked=footprint.some(c=>!this._inBounds(c.x,c.y))?`${size}×${size} 建筑必须完整放在地图内`:footprint.some(c=>{const t=this.tile(c.x,c.y);return t.terrain!=='land'||t.road||t.buildingId!==null||t.zone;})?`需要连续 ${size}×${size} 陆地空地，不能覆盖道路或建筑`:requiresRoad(tool)&&!this._hasRoadside(cells[0].x,cells[0].y,size)?'建筑必须临路放置，请先在建筑边缘铺设道路':this.state.money<placementCost?'城市资金不足':'';
      return {valid:!blocked,cost:placementCost,cells:footprint.filter(c=>this._inBounds(c.x,c.y)),reason:blocked||`${size}×${size} ${businessKind(placementType)?.name||facility?.name||TOOLS[tool].label} · ${size*size} 格整体建设`,affected:0};
    }
    if (tool === 'bridge') {
      const { x, y } = cells[0];
      const seed=[[x,y],[x-1,y],[x+1,y],[x,y-1],[x,y+1]].find(([a,b])=>this.tile(a,b)?.terrain==='water');
      if(!seed)return invalid('请选择河面或紧邻河流的岸边');
      const spans=[];
      for(const [dx,dy]of [[1,0],[0,1]]){
        let left=0,right=0;
        while(this.tile(seed[0]+dx*left,seed[1]+dy*left)?.terrain==='water')left--;
        while(this.tile(seed[0]+dx*right,seed[1]+dy*right)?.terrain==='water')right++;
        if(!this.tile(seed[0]+dx*left,seed[1]+dy*left)||!this.tile(seed[0]+dx*right,seed[1]+dy*right))continue;
        spans.push(Array.from({length:right-left+1},(_,i)=>({x:seed[0]+dx*(left+i),y:seed[1]+dy*(left+i)})));
      }
      if(!spans.length)return invalid('桥梁需要两岸都有可落脚的陆地');
      cells=spans.sort((a,b)=>a.length-b.length)[0];
      if (cells.some(c => this.tile(c.x, c.y).buildingId !== null)) return { valid: false, cost: 3500, cells, reason: '桥梁两岸有建筑，请先移动或拆除', affected: 0 };
      if (cells.every(c => this.tile(c.x, c.y).road)) return invalid('这段桥梁已经建成');
      if (this.state.money < 3500) return { valid: false, cost: 3500, cells, reason: '资金不足：桥梁需要 ¥3,500', affected: 0 };
      return { valid: true, cost: 3500, cells, reason: '自动铺设完整桥面与两岸接头；请连接两岸道路', affected: 0 };
    }
    if (tool === 'cityHall' && this.state.buildings.some(b => b.type === 'cityHall')) return invalid('城市已有市政府，暂停的市政府也不能重复建设');
    const handledBuildings = new Set();
    const changes = []; let cost = 0; let affected = 0;
    for (const c of cells) {
      const t = this.tile(c.x, c.y); const b = this.state.buildings.find(v => v.id === t.buildingId);
      if (tool === 'bulldoze') {
        if (c.x === 0 && c.y === 32) continue;
        if (!t.road && !t.zone && !b) continue;
        if (b && handledBuildings.has(b.id)) continue;
        if (b) handledBuildings.add(b.id);
        // Refund only public facilities at 20%; zoning and bridge refunds are never profitable.
        if (b && PUBLIC.includes(b.type)) cost -= Math.floor(TOOLS[b.type].cost * utilityScale(b) * 0.2);
        affected += b ? 1 : 0; changes.push(...(b ? buildingCells(b) : [c])); continue;
      }
      if (PRIVATE.includes(tool)) {
        if (t.terrain === 'water' || t.road || b || (t.zone === tool && (t.businessKind||null)===(options.businessKind||null))) continue;
        if(!this._hasRoadside(c.x,c.y)){if(cells.length>1)continue;return {valid:false,cost:0,cells,reason:'住宅、商业和工业分区必须临路，请先铺设道路',affected:0};}
        changes.push(c); cost += placementCost; continue;
      }
      if (tool === 'upgrade') {
        if (t.road) {
          const offer = roadUpgradeOffer(t, this.state);
          if (offer.allowed) { changes.push(c); cost += offer.cost; }
          else if (cells.length === 1) return invalid(offer.reason);
        }
        else if (b && !options.roadsOnly) {
          if (handledBuildings.has(b.id)) continue;
          handledBuildings.add(b.id);
          const offer = upgradeOffer(b, this.state);
          if (offer.allowed) { changes.push(c); cost += offer.cost; }
          else if (cells.length === 1) return invalid(offer.reason);
        }
        continue;
      }
      if (t.terrain === 'water') return invalid('水面上只能在指定河段修桥');
      if (b) return invalid('这里已有建筑，请先拆除');
      if (tool === 'road' && t.road) continue;
      if (PUBLIC.includes(tool) && t.road) return invalid('设施必须建在道路旁，不能覆盖道路');
      if(PUBLIC.includes(tool)&&requiresRoad(tool)&&!this._hasRoadside(c.x,c.y))return {valid:false,cost:0,cells,reason:'建筑必须临路放置，请先铺设道路',affected:0};
      changes.push(c); cost += TOOLS[tool].cost;
    }
    if (!changes.length) return invalid(tool === 'upgrade' ? '所选路段或建筑已满级，或尚未解锁下一阶段' : PRIVATE.includes(tool)?'所选位置没有可规划的临路空地，请先铺设道路':'所选位置没有可修改的地块');
    if (tool === 'bulldoze' && changes.some(c => this.tile(c.x, c.y).road)) {
      const removed = new Set(changes.map(c => this._index(c.x, c.y)));
      const seen = this._connectedRoads(removed);
      affected = this.state.buildings.filter(b => b.connected && !buildingCells(b).flatMap(c=>this._neighbors(c.x,c.y)).some(([x, y]) => seen.has(this._index(x, y)))).length;
    }
    const sufficient = this.state.money >= cost;
    return { valid: sufficient, cost, cells: changes, affected,
      reason: !sufficient ? '城市资金不足' : tool === 'bulldoze' && affected ? `拆除后 ${affected} 栋建筑可能失去道路连接` :
        PUBLIC.includes(tool) && requiresRoad(tool) && !this._adjacentRoads(changes[0].x, changes[0].y).length ? '建成后需要连接对外道路才能工作' :
          PRIVATE.includes(tool) ? `${changes.length} 格分区；临路、通水电后自动建设` : `共 ${changes.length} 格` };
  }

  build(tool, cells, options = {}) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const kind=businessKind(tool);
    if(kind) return this.build(kind.zone,cells,{...options,businessKind:tool});
    if (tool === 'move') return options.roadSource
      ? this.moveRoad(options.roadSource, cells?.[0])
      : this.moveBuilding(options.buildingId, cells?.[0]);
    const p = this.preview(tool, cells, options);
    if (!p.valid) return { ok: false, message: p.reason, cost: p.cost };
    this._undo = { tick: this.state.tick, state: clone(this.state) };
    this.state.money -= p.cost;
    if(tool.startsWith('interchange')){
      this.state.interchanges=(this.state.interchanges||[]).filter(item=>item.x!==p.center.x||item.y!==p.center.y);
      if(p.axis)this.state.interchanges.push({...p.center,axis:p.axis});
      this.recalculate();
      return {ok:true,cost:p.cost,message:p.axis?`已设置${p.axis==='ns'?'南北':'东西'}高架立交桥`:'已恢复平面路口，道路已保留'};
    }
    if(tool==='bulldoze')this.state.interchanges=(this.state.interchanges||[]).filter(item=>!interchangeCells(item).some(c=>p.cells.some(p=>p.x===c.x&&p.y===c.y)));
    const size=newBuildingFootprint(options.businessKind||tool);
    for (const { x, y } of size > 1 ? p.cells.slice(0,1) : p.cells) {
      const t = this.tile(x, y);
      if (tool === 'bulldoze') {
        this.state.buildings = this.state.buildings.filter(b => b.id !== t.buildingId);
        t.buildingId = null; delete t.businessKind; t.zone = null; t.road = 0; t.bridge = false;
      } else if (tool === 'road' || tool === 'bridge') {
        t.road = Math.max(1, t.road); t.zone = null; delete t.businessKind; if (tool === 'bridge') t.bridge = true;
      } else if (PRIVATE.includes(tool)) {t.zone = tool; if(options.businessKind)t.businessKind=options.businessKind;else delete t.businessKind;if(size>1)this._newBuilding(x,y,tool,false,size);}
      else if (tool === 'upgrade') {
        if (t.road) t.road++;
        else { const b = this.state.buildings.find(v => v.id === t.buildingId); b.level++; b.progress = GARDENS.includes(b.type) ? 1 : 0.6; }
      } else { t.zone = null; delete t.businessKind; this._newBuilding(x, y, LARGE_UTILITIES[tool]?.type||tool, true, size); }
    }
    this.recalculate();
    return { ok: true, message: tool === 'upgrade' ? `已升级 ${p.cells.length} 处` : tool === 'bulldoze' ? `已拆除 ${p.cells.length} 格${p.affected ? `，影响 ${p.affected} 栋建筑` : ''}` : tool === 'cityHall' ? '市政府已建成：市政方针、住宅覆盖与消防管理已开放；达到 1,000 人后解锁供电、供水和私人建筑二级升级' : `${TOOLS[tool].label}已${PRIVATE.includes(tool) ? '规划' : '建造'}`, cost: p.cost };
  }

  previewUpgradeAllRoads(){
    if(isBankrupt(this.state))return {valid:false,cost:0,cells:[],affected:0,reason:BANKRUPTCY_MESSAGE};
    let targetLevel=1;
    while(roadUpgradeOffer({road:targetLevel},this.state).allowed)targetLevel++;
    const cells=[];let cost=0,maintenanceIncrease=0;
    const maintenance=(tile,level)=>tile.bridge?11+Math.max(0,ROAD_TIERS[level].maintenance-1.5):ROAD_TIERS[level].maintenance;
    for(const tile of this.state.tiles){
      if(!tile.road||tile.road>=targetLevel)continue;
      for(let level=tile.road;level<targetLevel;level++)cost+=roadUpgradeOffer({road:level},this.state).cost;
      maintenanceIncrease+=maintenance(tile,targetLevel)-maintenance(tile,tile.road);
      cells.push({x:tile.x,y:tile.y});
    }
    const reason=targetLevel===1?'人口达到 1,000 后解锁二级道路':!cells.length?'全部道路已达到当前人口开放的最高等级':this.state.money<cost?'资金不足，还差 ¥'+Math.ceil(cost-this.state.money).toLocaleString('zh-CN'):'';
    return {valid:!reason,reason,cost,cells,targetLevel,name:ROAD_TIERS[targetLevel].name,maintenanceIncrease:round(maintenanceIncrease)};
  }
  upgradeAllRoads(){
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const offer=this.previewUpgradeAllRoads();
    if(!offer.valid)return {ok:false,message:offer.reason,cost:offer.cost};
    this._undo={tick:this.state.tick,state:clone(this.state)};
    this.state.money-=offer.cost;
    for(const cell of offer.cells)this.tile(cell.x,cell.y).road=offer.targetLevel;
    this.recalculate();
    return {ok:true,cost:offer.cost,message:'已将 '+offer.cells.length+' 格道路（含桥梁）升至 '+offer.targetLevel+' 级 · '+offer.name};
  }

  previewMove(buildingId, destination) {
    if(isBankrupt(this.state))return {valid:false,cost:0,cells:[],affected:0,reason:BANKRUPTCY_MESSAGE};
    const invalid = (reason, cells = []) => ({ valid: false, cost: 0, cells, reason, affected: 0 });
    const b = this.state.buildings.find(b => b.id === buildingId);
    if (!b) return invalid('请先选择要移动的建筑');
    if (!destination || !this._inBounds(destination.x, destination.y)) return invalid('请选择地图内的空地');
    const group = civicGardenGroups(this.state.buildings).get(b.id);
    const ids = group?.members || [b.id];
    const dx = destination.x - b.x, dy = destination.y - b.y;
    const cells = this.state.buildings.filter(b => ids.includes(b.id)).flatMap(b => buildingCells(b).map(c=>({x:c.x+dx,y:c.y+dy,buildingId:b.id})));
    if (!dx && !dy) return {valid:true,cost:0,cells,affected:0,unchanged:true,reason:'放回原位 · 结束移动'};
    for (const c of cells) {
      const t = this.tile(c.x, c.y);
      if (!t) return invalid('整个建筑必须放在地图内', cells);
      if (t.terrain !== 'land') return invalid('建筑只能移动到陆地空地', cells);
      if (t.road) return invalid('不能覆盖道路，请选择空地', cells);
      if (t.buildingId !== null && !ids.includes(t.buildingId)) return invalid('这里已有其他建筑，请选择空地', cells);
    }
    if(b.type==='marina'){const reason=marinaPlacement(this.state,{...b,...destination});if(reason)return invalid(reason,cells);}
    if(requiresRoad(b.type)&&!this._hasRoadside(destination.x,destination.y,footprintSize(b)))return invalid('建筑必须临路放置，请先在目标位置旁铺设道路',cells);
    return { valid: true, cost: 0, cells, affected: cells.length, reason: group ? '整体移动 2×2 绿地 · 免费' : '免费移动，保留居民、等级和施工进度' };
  }

  moveBuilding(buildingId, destination) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const p = this.previewMove(buildingId, destination);
    if (!p.valid) return { ok: false, message: p.reason, cost: 0 };
    if (p.unchanged) return {ok:true,cost:0,changed:false,message:'建筑已放回原位'};
    this._undo = { tick: this.state.tick, state: clone(this.state) };
    const ids = new Set(p.cells.map(c => c.buildingId));
    const incident = this.state.civic.incident;
    if (incident && (ids.has(incident.stationId) || ids.has(incident.targetId))) this._finishFireDrill('cancelled', '消防站或演练目标已迁移，本次演练中止');
    const moving = this.state.buildings.filter(b => ids.has(b.id));
    for (const b of moving) {
      for(const c of buildingCells(b)){const t=this.tile(c.x,c.y);t.buildingId=null;t.zone=null;delete t.businessKind;}
    }
    for (const b of moving) {
      const anchor=p.cells.find(c=>c.buildingId===b.id);b.x=anchor.x;b.y=anchor.y;
      for(const c of buildingCells(b)){const t=this.tile(c.x,c.y);t.buildingId=b.id;t.zone=PRIVATE.includes(b.type)?b.type:null;if(b.businessKind)t.businessKind=b.businessKind;}
    }
    this.recalculate();
    return { ok: true, cost: 0, message: p.cells.length > 1 ? '整座建筑或绿地已移动' : '建筑已移动，居民与等级已保留' };
  }

  previewMoveRoad(source, destination) {
    if(isBankrupt(this.state))return {valid:false,cost:0,cells:[],affected:0,reason:BANKRUPTCY_MESSAGE};
    const invalid = (reason, cells = []) => ({ valid: false, cost: 0, cells, reason, affected: 0 });
    if (!source || !this._inBounds(source.x, source.y)) return invalid('请先选择要移动的道路');
    const from = this.tile(source.x, source.y);
    if (!from?.road) return invalid('原道路已发生变化，请重新选择');
    if (source.x === 0 && source.y === 32) return invalid('城市入口道路不能移动');
    if(interchangeAt(this.state,source))return invalid('立交桥道路需保持完整，请先恢复平面路口再移动');
    if (from.bridge) return invalid('桥梁需保持完整跨河结构，请使用桥梁工具重新规划');
    if (!destination || !this._inBounds(destination.x, destination.y)) return invalid('请选择地图内的空地');
    const cells = [{ x: destination.x, y: destination.y }];
    if (source.x === destination.x && source.y === destination.y) return invalid('请选择新的位置，Esc 取消移动', cells);
    const target = this.tile(destination.x, destination.y);
    if (target.terrain !== 'land') return invalid('道路只能移动到陆地空地', cells);
    if (target.road) return invalid('这里已有道路，请选择空地', cells);
    if (target.buildingId !== null) return invalid('这里已有建筑，请选择空地', cells);
    if (target.zone) return invalid('这里已有规划分区，请选择未规划空地', cells);
    return { valid: true, cost: 0, cells, affected: 1, reason: `免费移动 ${ROAD_TIERS[from.road].name} · 保留 ${from.road} 级` };
  }

  moveRoad(source, destination) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const p = this.previewMoveRoad(source, destination);
    if (!p.valid) return { ok: false, message: p.reason, cost: 0 };
    this._undo = { tick: this.state.tick, state: clone(this.state) };
    const from = this.tile(source.x, source.y), target = this.tile(destination.x, destination.y);
    const level = from.road;
    from.road = 0; from.bridge = false; from.traffic = 0; from.trafficLoad = 0;
    target.road = level; target.bridge = false; target.zone = null; delete target.businessKind;
    this.recalculate();
    return { ok: true, cost: 0, message: `${ROAD_TIERS[level].name}已移动，等级与城市资金均已保留` };
  }

  undo() {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    if (!this._undo || this._undo.tick !== this.state.tick) return { ok: false, message: '只能撤销尚未推进时间的最近一次建设' };
    this.state = this._undo.state; this._undo = null; this.recalculate();
    return { ok: true, message: '已撤销最近一次建设，资金已恢复' };
  }

  _connectedRoads(removed = new Set()) {
    const seen=new Set();
    const queue=entranceRoadIndexes(this.state,{removed}).flatMap(i=>roadNodes(this.state,i)),visited=new Set(queue);
    for(let head=0;head<queue.length;head++){
      const node=queue[head];seen.add(roadIndex(node));
      for(const next of roadSteps(this.state,node,{removed}))if(!visited.has(next)){visited.add(next);queue.push(next);}
    }
    return seen;
  }

  _path(starts, goals, extraLoad = 0, {includeStartCost=false,vehicle=false,from,to} = {}) {
    if(vehicle){
      const cost=i=>{const t=this.state.tiles[i],load=(t.trafficLoad+extraLoad)/t.trafficCapacity;return ROAD_TIERS[t.road].travelCost*(1+Math.max(0,load-.6)**2*4);};
      return vehicleRoadPath(this.state,starts,goals,{from,to,network:this._vehicleNetwork,cost,startCost:includeStartCost?cost:()=>0});
    }
    if(!starts.length||!goals.length)return [];
    const target=new Set(goals.flatMap(i=>roadNodes(this.state,i))),dist=new Map(),prev=new Map(),heap=new Heap();
    for(const node of starts.flatMap(i=>roadNodes(this.state,i))){
      const t=this.state.tiles[roadIndex(node)],load=(t.trafficLoad+extraLoad)/t.trafficCapacity;
      const cost=includeStartCost?ROAD_TIERS[t.road].travelCost*(1+Math.max(0,load-.6)**2*4):0;
      dist.set(node,cost);heap.push([cost,node]);
    }
    while(heap.items.length){
      const [d,node]=heap.pop();if(d!==dist.get(node))continue;
      if(target.has(node)){
        const path=[roadIndex(node)];let at=node;
        while(prev.has(at)){at=prev.get(at);path.push(roadIndex(at));}
        return path.reverse();
      }
      for(const nextNode of roadSteps(this.state,node,{connected:true})){
        const n=this.state.tiles[roadIndex(nextNode)],load=(n.trafficLoad+extraLoad)/n.trafficCapacity;
        const next=d+ROAD_TIERS[n.road].travelCost*(1+Math.max(0,load-.6)**2*4);
        if(next<(dist.get(nextNode)??Infinity)){dist.set(nextNode,next);prev.set(nextNode,node);heap.push([next,nextNode]);}
      }
    }
    return [];
  }

  recalculate() {
    const s = this.state, tiles = s.tiles, buildings = s.buildings;
    refreshInterchanges(s);
    const vehicleKey=s.mapSize+'|'+tiles.filter(t=>t.road).map(t=>`${t.x},${t.y}:${t.road}:${t.interchange?.axis||''}:${t.interchange?.core||false}`).join('|');
    if(this._vehicleState!==s||this._vehicleKey!==vehicleKey){this._vehicleNetwork=vehicleNetwork(s);this._vehicleKey=vehicleKey;this._vehicleState=s;}
    ensureCityIncidents(s);refreshCityIncidents(s);
    if (s.cityLife.activeEvent && s.cityLife.activeEvent.expiresMonth <= s.month) s.cityLife.activeEvent = null;
    const cityEventBonus = s.cityLife.activeEvent?.bonus || 0;
    const connected = this._connectedRoads();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]; t.connected = connected.has(i); t.powered = false; t.watered = false;
      t.pollution = 0; t.traffic = 0; t.trafficLoad = 0; t.trafficCapacity = t.road ? ROAD_TIERS[t.road].capacity : 34;
      t.amenity = 0; t.communityServices = {}; t.communityBonus = 0;
    }
    for (const b of buildings) {
      b.connected = this._adjacentRoads(b.x, b.y, footprintSize(b)).length > 0;
      this.tile(b.x, b.y).connected = b.connected;
      const incident=buildingIncidentEffects(s,b);
      b.jobs = 0; b.workers = 0; b.commute = 0;b.monthlyPayroll=0;b.taxContribution=0;b.publicPayroll=0;
      b.incidentHappinessPenalty=incident.happinessPenalty;b.incidentMigrationPenalty=incident.migrationPenalty;
      b.incidentEfficiency=incident.efficiency;b.moveInBlocked=incident.moveInBlocked;b.incidentKinds=incident.kinds;
    }
    const facilities = type => buildings.filter(b => b.type === type && b.connected && b.active);
    const powerCapacity = facilities('power').reduce((sum, b) => sum + utilityCapacity(b), 0);
    const waterCapacity = powerCapacity > 0 ? facilities('water').reduce((sum, b) => sum + utilityCapacity(b), 0) : 0;
    let powerUsed = 0, waterUsed = 0;
    const demand = b => (PRIVATE.includes(b.type)||COMMUNITY_BUILDINGS[b.type]?.jobs) ? Math.max(4, b.type === 'residential' ? b.population : capacity(b) * 0.7) : 2*utilityScale(b);
    const servicePriority = b => ['power', 'water'].includes(b.type) ? 2 : ['fireStation', 'cityHall','policeStation','busStop'].includes(b.type) ? 1 : 0;
    const serviceOrder = [...buildings].sort((a, b) => servicePriority(b) - servicePriority(a) || a.id - b.id);
    for (const b of serviceOrder) {
      if (GARDENS.includes(b.type)) {
        // Open-air gardens need neither road delivery nor utility capacity.
        b.powered = b.watered = b.active;
        const t = this.tile(b.x, b.y); t.powered = b.powered; t.watered = b.watered;
        continue;
      }
      const hasAccess = b.connected || !requiresRoad(b.type);
      const use = demand(b); const needsWater = !['power', 'water'].includes(b.type);
      b.powered = hasAccess && b.active && (b.type === 'power' || powerUsed + use <= powerCapacity);
      b.watered = hasAccess && b.active && (!needsWater || waterUsed + use <= waterCapacity);
      if (hasAccess && b.active && b.type !== 'power') powerUsed += use;
      if (hasAccess && b.active && needsWater) waterUsed += use;
      const t = this.tile(b.x, b.y); t.powered = b.powered; t.watered = b.watered;
      if (b.progress >= 1 && hasAccess && b.active && b.powered && b.watered && (['commercial', 'industrial'].includes(b.type)||COMMUNITY_BUILDINGS[b.type]?.jobs)) b.jobs = Math.max(0,Math.floor(capacity(b)*(b.incidentEfficiency||1)));
    }
    for (const t of tiles) if (t.terrain === 'land' && t.buildingId === null) {
      if (!t.road) t.connected = this._adjacentRoads(t.x, t.y).length > 0;
      t.powered = t.connected && powerCapacity > powerUsed;
      t.watered = t.connected && waterCapacity > waterUsed;
    }
    for (const b of buildings) {
      if (!b.active || (!b.connected && requiresRoad(b.type)) || (b.progress < 1 && !utilityCapacity(b))) continue;
      const industrial = b.type === 'industrial' && b.jobs > 0;
      const power = b.type === 'power';
      const green = beautyEffect(b);
      if (!industrial && !power && !green) continue;
      const radius = industrial ? 7 : power ? 5 : green.radius;
      for (let y = Math.max(0, b.y - radius); y <= Math.min(this.state.mapSize - 1, b.y + radius); y++)
        for (let x = Math.max(0, b.x - radius); x <= Math.min(this.state.mapSize - 1, b.x + radius); x++) {
          const d = Math.hypot(b.x - x, b.y - y); if (d >= radius) continue;
          const t = this.tile(x, y);
          if (green) t.amenity = clamp(t.amenity + (1 - d / radius) * green.strength, 0, 28);
          else t.pollution = clamp(t.pollution + (1 - d / radius) * (industrial ? 24 : 13));
        }
    }
    const transitRoutes=busRoutes(s),busStops=servedBusStops(s,transitRoutes),busStopIds=new Set(busStops.map(b=>b.id));
    for (const b of buildings) {
      const service = communityService(b);
      if (!service || !civicServiceReady(s,b)||(b.type==='busStop'&&!busStopIds.has(b.id))) continue;
      const roadCells=service.roadService?new Set(policeCoverageCells(s,b)):null,extent=service.radius+(service.roadService?1:0);
      for (let y = Math.max(0,b.y-extent); y <= Math.min(this.state.mapSize-1,b.y+extent); y++)
        for (let x = Math.max(0,b.x-extent); x <= Math.min(this.state.mapSize-1,b.x+extent); x++) {
          if (roadCells?!roadCells.has(this._index(x,y)):Math.hypot(x-b.x,y-b.y)>service.radius) continue;
          const t=this.tile(x,y);
          const category=service.service||b.type,previous=t.communityServices[category]||0;
          if(service.bonus>previous){t.communityServices[category]=service.bonus;t.communityBonus+=service.bonus-previous;}
        }
    }
    // Secular public spaces offer the same need; spiritual coverage never stacks.
    for(const b of buildings){
      if(!['park','plaza','library','grandGallery'].includes(b.type)||!b.active||b.progress<1)continue;
      const garden=['park','plaza'].includes(b.type);
      if(!garden&&!civicBuildingReady(b))continue;
      const radius=garden?gardenRadius(b):communityService(b).radius,bonus=2+Math.max(0,(b.level||1)-1);
      for(const t of tiles){const distance=Math.hypot(t.x-b.x,t.y-b.y);if(garden?distance>=radius:distance>radius)continue;
        const previous=t.communityServices.spiritual||0;
        if(bonus>previous){t.communityServices.spiritual=bonus;t.communityBonus+=bonus-previous;}
      }
    }
    const homes = buildings.filter(b => b.type === 'residential');
    const firms = buildings.filter(b => b.jobs > 0);
    const population = homes.reduce((a, b) => a + b.population, 0);
    const jobs = firms.reduce((a, b) => a + b.jobs, 0);
    let employed = 0; s.routes = [];
    const addRoute = (path, kind, load, assignment = {}, returning = []) => {
      load = round(load);
      if (!path.length || load <= 0) return;
      const roadLoad=assignment.walking?0:load;
      for (const i of path) tiles[i].trafficLoad += returning.length?roadLoad/2:roadLoad;
      for (const i of returning) tiles[i].trafficLoad += roadLoad/2;
      const route={ points: path.map(i => ({ x: tiles[i].x, y: tiles[i].y })), kind, load: round(load), ...assignment, returnPoints:returning.map(i=>({x:tiles[i].x,y:tiles[i].y})) };
      s.routes.push(route);return route;
    };
    for(const route of transitRoutes)for(const p of route.points.slice(0,route.outboundLength||(route.points.length+1)/2))this.tile(p.x,p.y).trafficLoad+=1;
    let transitCommuters=0;
    for (const home of homes) {
      if (!home.connected || !home.active || !home.powered || !home.watered) continue;
      let seekers = Math.floor(home.population * 0.55); let commuteSum = 0; let assigned = 0;
      const nearest = [...firms].filter(f => f.workers < f.jobs).sort((a, b) =>
        (Math.abs(a.x - home.x) + Math.abs(a.y - home.y)) - (Math.abs(b.x - home.x) + Math.abs(b.y - home.y)) || a.id - b.id);
      for (const firm of nearest) {
        if (!seekers) break;
        const amount = Math.min(seekers, firm.jobs - firm.workers);
        // Nearby jobs use sidewalks rather than creating a motor trip around
        // the block merely to reach the opposite curb.
        const nearby=Math.abs(home.x-firm.x)+Math.abs(home.y-firm.y)<=footprintSize(home)+footprintSize(firm)+7?roadPath(s,home,firm):[];
        const walking=nearby.length>0&&nearby.length<=8&&!busCommuteAvailable(busStops,home,firm);
        const path = walking?nearby.map(p=>this._index(p.x,p.y)):this._path(this._adjacentRoads(home.x, home.y,footprintSize(home)), this._workplaceRoads(firm), amount, {vehicle:true,from:home,to:firm});
        if (!path.length) continue;
        const returning=walking?[...path].reverse():this._path([path.at(-1)],[path[0]],amount,{vehicle:true,from:firm,to:home});
        if(!returning.length)continue;
        seekers -= amount; firm.workers += amount; employed += amount; assigned += amount;
        const transit=path.length>=4&&busCommuteAvailable(busStops,home,firm);
        if(transit)transitCommuters+=amount;
        const route=addRoute(path, 'commute', amount*(transit ? .6 : 1), {homeId:home.id,workplaceId:firm.id,commuters:amount,transit,walking},returning);
        const duration = walking?1+path.length*.65:path.reduce((a, i) => a + 0.65 * (1 + Math.max(0, tiles[i].trafficLoad / tiles[i].trafficCapacity - 0.6) ** 2 * 1.5), 1)*(transit ? .85 : 1);
        route.duration=round(duration);
        commuteSum += duration * amount;
      }
      home.workers = assigned; home.commute = assigned ? round(commuteSum / assigned) : 0;
    }
    const entrances=cityEntrances(s),entryRoads=entrances.flatMap(p=>p.roadIndexes);
    for (const firm of firms) {
      if (!firm.workers) continue;
      let remaining=round(firm.workers*(firm.type==='industrial'?.15:.06));
      // Assign deliveries in batches: a large employer can use several routes
      // as each previous delivery adds pressure to its chosen gateway.
      const batch=entryRoads.length>1?Math.max(17,Math.ceil(remaining/8*10)/10):remaining;
      const routes=new Map();
      while(remaining>0){
        const load=Math.min(batch,remaining),path=this._path(entryRoads,this._workplaceRoads(firm),load,{includeStartCost:true,vehicle:true,to:firm});
        if(!path.length)break;
        const returning=this._path([path.at(-1)],[path[0]],load,{vehicle:true,from:firm});
        if(!returning.length)break;
        const key=path.join(',')+'|'+returning.join(','),existing=routes.get(key);
        if(existing){for(const i of path)tiles[i].trafficLoad+=load/2;for(const i of returning)tiles[i].trafficLoad+=load/2;existing.load=round(existing.load+load);}
        else routes.set(key,addRoute(path,'freight',load,{workplaceId:firm.id,entrance:{x:tiles[path[0]].x,y:tiles[path[0]].y}},returning));
        remaining=round(remaining-load);
      }
    }
    const freightByEntry=new Map();
    for(const route of s.routes)if(route.kind==='freight'){
      const i=this._index(route.points[0].x,route.points[0].y),entry=freightByEntry.get(i)||{load:0,routes:0};
      entry.load+=route.load;entry.routes++;freightByEntry.set(i,entry);
    }
    const entranceStats=entrances.map(p=>({...p,lanes:p.roadIndexes.length,
      capacity:p.roadIndexes.reduce((sum,i)=>sum+tiles[i].trafficCapacity,0),
      freightLoad:round(p.roadIndexes.reduce((sum,i)=>sum+(freightByEntry.get(i)?.load||0),0)),
      routes:p.roadIndexes.reduce((sum,i)=>sum+(freightByEntry.get(i)?.routes||0),0)}));
    let trafficWeight = 0, trafficScore = 0;
    for (const t of tiles) if (t.road) {
      t.traffic = clamp(Math.round(t.trafficLoad / t.trafficCapacity * 70));
      trafficScore += (100 - Math.min(95, Math.max(0, t.trafficLoad / t.trafficCapacity - 0.55) * 60)) * t.trafficLoad;
      trafficWeight += t.trafficLoad;
    }
    const workforce = homes.reduce((a, b) => a + Math.floor(b.population * 0.55), 0);
    const employmentRate = workforce ? Math.round(employed / workforce * 100) : 100;
    const civic = calculateCivicServices(s);
    calculateServiceCoverage(s);
    civic.municipalCoveredPopulation=homes.filter(b=>b.services?.cityHall).reduce((sum,b)=>sum+b.population,0);
    const civicPolicy=activeCivicPolicy(s);
    let happinessTotal = 0;
    for (const b of buildings) {
      const t = this.tile(b.x, b.y),incident=buildingIncidentEffects(s,b);
      b.incidentHappinessPenalty=incident.happinessPenalty;b.incidentMigrationPenalty=incident.migrationPenalty;
      let score = 77 + t.amenity + t.communityBonus - t.pollution * 0.55 - Math.max(0, s.taxRate - 9) * 4;
      if (b.type === 'residential') {
        score += cityEventBonus;
        if (b.fireCovered) score += 2;
        if (b.services.cityHall) score += civicPolicy?.happinessBonus??2;
        const labor = Math.floor(b.population * 0.55);
        score -= labor > 0 ? (1 - b.workers / labor) * 30 : 0;
        score -= Math.max(0, b.commute - 12) * 0.65;
        score -= b.incidentHappinessPenalty||0;
      }
      if (!b.connected) score -= 42;
      if (!b.powered) score -= 26;
      if (!b.watered) score -= 24;
      b.happiness = Math.round(clamp(score));
      b.moveInWillingness=b.type==='residential'?Math.round(clamp(b.happiness-(b.incidentMigrationPenalty||0))):b.happiness;
      b.problem = !b.active ? '设施已暂停' : !b.connected && requiresRoad(b.type) ? '未连接对外道路' : !b.powered ? '缺少电力' : !b.watered ? '缺少供水' : b.progress < 1 ? '正在施工' : b.type==='districtOffice'&&!buildings.some(v=>v.type==='cityHall'&&civicBuildingReady(v))?'等待市政府统筹' :
        b.type === 'residential' && b.incidentKinds?.length ? `受${incidentTitle(b.incidentKinds[0])}影响` :
        b.incidentKinds?.includes('fire') ? '火灾处置期间暂停部分运营' :
        b.type === 'residential' && t.pollution > 35 ? '周边工业污染较高' :
        b.type === 'residential' && b.commute > 22 ? '通勤时间过长' :
        b.type === 'residential' && b.population > 3 && b.workers < Math.floor(b.population * 0.55) * 0.6 ? '附近可达岗位不足' :
        (['industrial', 'commercial'].includes(b.type)||isCommunityBusiness(b.type)) && b.workers < b.jobs * 0.3 ? '等待居民前来就业' : '';
      if (b.type === 'residential') happinessTotal += b.happiness * b.population;
    }
    const counts = Object.fromEntries(TYPES.map(type => [type, buildings.filter(b => b.type === type).length]));
    const roadCount = tiles.filter(t => t.road).length;
    const roadMaintenance = (s.interchanges||[]).length*INTERCHANGE_MAINTENANCE+tiles.reduce((a, t) => a + (t.road ? (t.bridge ? 11 + Math.max(0, ROAD_TIERS[t.road].maintenance - 1.5) : ROAD_TIERS[t.road].maintenance) : 0), 0);
    const facilityCostMultiplier=civicPolicy?.publicCostMultiplier||1;
    const facilityMaintenance = buildings.filter(b=>!isCommunityBusiness(b.type)).reduce((a, b) => a + (b.type === 'fireStation' ? FIRE_BUDGETS[s.civic.fireBudget].monthlyCost : MAINTENANCE[b.type] || 0) * maintenanceMultiplier(b) * utilityScale(b) * (b.active ? 1 : 0.15), 0)*facilityCostMultiplier;
    const publicSectorPayroll=publicPayroll(facilityMaintenance);
    for(const b of buildings){
      if(!PUBLIC.includes(b.type))continue;
      if(isCommunityBusiness(b.type)){b.publicPayroll=0;continue;}
      const operations=(b.type==='fireStation'?FIRE_BUDGETS[s.civic.fireBudget].monthlyCost:MAINTENANCE[b.type]||0)*maintenanceMultiplier(b)*utilityScale(b)*(b.active?1:.15);
      b.publicPayroll=publicPayroll(operations*facilityCostMultiplier);
    }
    const districtMaintenance=Object.fromEntries(PRIVATE.map(type=>[type,buildings.filter(b=>b.type===type).reduce((sum,b)=>sum+privateMaintenance(b),0)]));
    districtMaintenance.commercial+=buildings.filter(b=>isCommunityBusiness(b.type)).reduce((sum,b)=>sum+(MAINTENANCE[b.type]||0)*maintenanceMultiplier(b)*(b.active?1:.15),0);
    const privateTotal=Object.values(districtMaintenance).reduce((sum,cost)=>sum+cost,0);
    const taxFactor = s.taxRate / 9;
    const privateFirms=firms.filter(b=>['commercial','industrial'].includes(b.type)||isCommunityBusiness(b.type));
    const enterprisePayroll=privateFirms.reduce((sum,b)=>{b.monthlyPayroll=privatePayroll(b);return sum+b.monthlyPayroll;},0);
    const wageTax=enterprisePayroll*s.taxRate/100;
    const residentServiceTax=homes.reduce((sum,b)=>sum+b.population*ECONOMY_RULES.residentServiceFee*(b.connected&&b.powered&&b.watered?1:.35),0)*taxFactor;
    const residentialIncome=wageTax+residentServiceTax;
    const industryWorkers = firms.filter(b => b.type === 'industrial').reduce((a, b) => a + b.workers, 0);
    const businessTaxMultiplier=civicPolicy?.businessTaxMultiplier||1;
    const commercialIncome=privateFirms.filter(b=>b.type==='commercial'||isCommunityBusiness(b.type)).reduce((sum,b)=>{b.taxContribution=privateBusinessTax(b,taxFactor)*businessTaxMultiplier;return sum+b.taxContribution;},0);
    const industrialIncome=privateFirms.filter(b=>b.type==='industrial').reduce((sum,b)=>{b.taxContribution=privateBusinessTax(b,taxFactor)*businessTaxMultiplier;return sum+b.taxContribution;},0);
    const averageWage=employed?enterprisePayroll/employed:0;
    for(const b of homes)b.taxContribution=(b.workers*averageWage*s.taxRate/100+b.population*ECONOMY_RULES.residentServiceFee*(b.connected&&b.powered&&b.watered?1:.35)*taxFactor);
    const loanPayment = s.loan.taken && s.loan.grace === 0 && s.loan.remaining > 0 ? Math.min(300, s.loan.remaining) : 0;
    const income = Math.round(residentialIncome + commercialIncome + industrialIncome);
    const expenses = Math.round(roadMaintenance + facilityMaintenance + publicSectorPayroll + privateTotal + loanPayment);
    const happiness = population ? Math.round(happinessTotal / population) : 75;
    const housingCapacity = homes.reduce((a, b) => a + capacity(b), 0);
    const commercialJobs = firms.filter(b => b.type === 'commercial'||COMMUNITY_BUILDINGS[b.type]?.jobs).reduce((a, b) => a + b.jobs, 0);
    const marketDemand=calculateDemand({population,jobs,workforce,housingCapacity,commercialJobs,taxRate:s.taxRate});
    if(civicPolicy?.demandBoost)for(const type of ['commercial','industrial']){
      const detail=marketDemand.details[type];detail.factors.push({label:'市政招商促进',value:civicPolicy.demandBoost});detail.raw+=civicPolicy.demandBoost;
      marketDemand.demand[type]=Math.round(clamp(detail.raw));detail.summary=marketDemand.demand[type]>=12?'有开发需求':detail.summary;
    }
    const incidentDemandPenalty=cityIncidentDemandPenalty(s);
    if(incidentDemandPenalty){
      const detail=marketDemand.details.residential;detail.factors.push({label:'城市风险事件与入住顾虑',value:-incidentDemandPenalty});detail.raw-=incidentDemandPenalty;
      marketDemand.demand.residential=Math.round(clamp(detail.raw));
      if(marketDemand.demand.residential<12)detail.summary='风险事件降低入住意愿';
    }
    for(const type of PRIVATE)marketDemand.details[type].sites=zoningReadiness(tiles,type);
    s.stats = {
      population, jobs, employed, employmentRate, workforce, happiness, income, expenses, balance: income - expenses,
      powerUsed: Math.round(powerUsed), powerCapacity, waterUsed: Math.round(waterUsed), waterCapacity,
      traffic: trafficWeight ? Math.round(trafficScore / trafficWeight) : 100,
      entrances:entranceStats,
      roadCount, counts, profitableMonths: s.profitableMonths, housingCapacity,
      cityEventBonus,
      transit:{routes:transitRoutes.length,stops:busStops.length,commuters:transitCommuters},
      incidentDemandPenalty,
      incidents:ensureCityIncidents(s).active.map(event=>({...event,title:incidentTitle(event.kind)})),
      civic,
      breakdown: { districtMaintenance, privateMaintenance:privateTotal, residentialIncome: Math.round(residentialIncome), wageTax:Math.round(wageTax), residentServiceTax:Math.round(residentServiceTax), commercialIncome: Math.round(commercialIncome), industrialIncome: Math.round(industrialIncome), enterprisePayroll:Math.round(enterprisePayroll), roadMaintenance: Math.round(roadMaintenance), facilityMaintenance: Math.round(facilityMaintenance), publicPayroll:Math.round(publicSectorPayroll), loanPayment },
      demand: marketDemand.demand,
      demandDetails: marketDemand.details,
      alerts: [],
    };
    s.stats.workforceReport=workforceDashboard(s);
    s.roadLevelUnlocked=Math.max(s.roadLevelUnlocked||1,roadLevelForPopulation(population));
    const alerts = s.stats.alerts;
    for(const event of ensureCityIncidents(s).active){const alert=incidentAlert(event);if(alert)alerts.push(alert);}
    if (!powerCapacity) alerts.push({ text: '建设供电站并连接入口道路，让城市亮起来', severity: 'warning' });
    else if (powerUsed >= powerCapacity * 0.9) alerts.push(this._utilityCapacityAlert('power'));
    if (!waterCapacity) alerts.push({ text: '需要一座有道路和电力的水塔', severity: 'warning' });
    else if (waterUsed >= waterCapacity * 0.9) alerts.push(this._utilityCapacityAlert('water'));
    const disconnected = buildings.find(b => !b.connected && requiresRoad(b.type));
    if (disconnected) alerts.push({ text: '部分建筑未连接入口道路', severity: 'warning', x: disconnected.x, y: disconnected.y });
    if (population > 60 && employmentRate < 75) alerts.push({ text: '居民缺少工作，增加商业或工业分区', severity: 'warning' });
    const pollutedHomes=homes.filter(b=>b.population>0&&this.tile(b.x,b.y).pollution>=30).sort((a,b)=>this.tile(b.x,b.y).pollution-this.tile(a.x,a.y).pollution);
    if(pollutedHomes.length){const worst=pollutedHomes[0];alerts.push({text:`${pollutedHomes.length} 栋已入住住宅受较重污染，点击定位并调整工业与住宅距离`,severity:'warning',x:worst.x,y:worst.y});}
    const stalledHome=homes.find(b=>!pollutedHomes.some(p=>p.id===b.id)&&b.active&&b.connected&&b.powered&&b.watered&&b.progress>=1&&b.population<capacity(b)&&b.happiness<42);
    if(stalledHome)alerts.push({text:stalledHome.commute>22?'部分住宅因通勤过长暂停入住，点击定位；增加跨区道路或就近安排岗位':'部分住宅满意度过低，暂停入住；点击定位查看原因并改善环境',severity:'warning',x:stalledHome.x,y:stalledHome.y});
    const blockedZone=tiles.find(t=>t.zone&&t.buildingId===null&&s.stats.demand[t.zone]>=12&&!t.connected);
    if(blockedZone)alerts.push({text:'已规划分区缺少连通道路，点击定位后接通入口路网',severity:'warning',x:blockedZone.x,y:blockedZone.y});
    if (s.stats.traffic < 65) alerts.push({ text: unlockedRoadLevel(s)>1?'部分道路拥堵，增加连接或升级道路':'部分道路拥堵，请增加平行道路；人口达到 1,000 后可升级道路', severity: 'warning' });
    if(isBankrupt(s))alerts.push({text:BANKRUPTCY_MESSAGE,severity:'danger'});
    else if(s.money<=0)alerts.push({text:'资金已耗尽；尚有一次 ¥6,000 应急贷款机会，请尽快到城市财政申请',severity:'danger'});
    else if(s.stats.balance<0)alerts.push({text:`每月赤字 ¥${-s.stats.balance}，资金约可支撑 ${Math.floor(s.money/-s.stats.balance)} 个月${s.loan.taken?'；应急贷款已用完，资金耗尽将破产':'；低于 ¥3,000 可申请一次应急贷款'}`,severity:s.money<3000?'danger':'info'});
    if (population >= 100) s.milestones.named = true;
    if (population >= 500 && employmentRate >= 65) s.milestones.bridge = true;
    if (population >= 1000 && s.milestones.bridge && cityHallRequirement(buildings).met) s.milestones.density = true;
    if (population >= 2000 && s.milestones.density && happiness >= 70 && s.profitableMonths >= 3) { s.milestones.landmark = true; s.milestones.completed = true; }
    latchDomainMilestones(s);
    latchCityGoal(s);
    if (s.civic.incident) {
      const problem = validateFireDrill(s, s.civic.incident);
      if (problem) this._finishFireDrill('cancelled', problem);
    }
    refreshMarinaLife(s);
    this._refreshDrillReadiness();
    if(latchBankruptcy(s))this._undo=null;
    return s.stats;
  }

  _utilityCapacityAlert(type) {
    const label=type==='power'?'电力':'供水';
    const facility=this.state.buildings.find(b=>{
      if(b.type!==type||!b.active||!b.connected)return false;
      const offer=upgradeOffer(b,this.state);
      return this.state.milestones.density&&offer.allowed&&offer.cost<=this.state.money;
    });
    return facility
      ? {text:`${label}容量即将不足，点击定位并升级${TOOLS[type].label}`,severity:'warning',x:facility.x,y:facility.y}
      : {text:`${label}容量即将不足，${type==='power'?'建设新的供电站':'增加水塔'}`,severity:'warning'};
  }

  tick() {
    const s = this.state;
    if(latchBankruptcy(s)){this._undo=null;return s.stats;}
    this._undo = null; s.tick++;
    this.recalculate();
    // Projects appear only beside connected roads with available utility capacity.
    let started = 0;
    const startOffset = (s.tick * 29) % s.tiles.length;
    for (let j = 0; j < s.tiles.length && started < 5; j++) {
      const t = s.tiles[(startOffset + j) % s.tiles.length];
      if (!t.zone || t.buildingId !== null || !t.connected || !t.powered || !t.watered) continue;
      if (s.stats.demand[t.zone] < 12) continue;
      if(t.zone==='commercial'&&!commercialPrerequisite(s,t.businessKind).allowed)continue;
      this._newBuilding(t.x, t.y, t.zone); started++;
    }
    for (const b of s.buildings) {
      b.age++;
      const serviced = b.active && (b.connected || !requiresRoad(b.type)) && b.powered && b.watered;
      if (b.progress < 1 && serviced) b.progress = Math.min(1, round(b.progress + 0.2));
      if (b.type !== 'residential') continue;
      if (b.progress < 1) continue;
      if (!serviced) {
        b.shortageTicks = (b.shortageTicks || 0) + 1;
        if (b.shortageTicks > 4) b.population = Math.max(0, b.population - Math.max(1, Math.ceil(b.population * 0.12)));
        continue;
      }
      b.shortageTicks = 0;
      const pioneer = s.stats.population < 80 && s.tick <= 90;
      const openJobs = s.stats.jobs - s.stats.employed;
      if (b.happiness < 38 || (s.taxRate >= 14 && b.happiness < 58)) b.population = Math.max(0, b.population - 1);
      else if (b.population < capacity(b) && (pioneer || openJobs > 0) && !b.moveInBlocked && b.moveInWillingness >= 42) {
        // Small cohorts avoid a whole city arriving or leaving in one frame.
        // Regional high-rises accept larger cohorts so their extra capacity is
        // useful while new commercial and industrial jobs are being staffed.
        b.population = Math.min(capacity(b), b.population + residentialArrivalCohort(b));
      }
    }
    this.recalculate();
    this._advanceFireDrill();
    if (s.tick % 15 === 0) {
      const { income, expenses, balance } = s.stats;
      s.money = Math.round(s.money + balance);
      s.profitableMonths = balance >= 0 ? s.profitableMonths + 1 : 0;
      s.lastMonthly = { month: s.month, income, expenses, balance };
      if (s.loan.taken && s.loan.remaining > 0) {
        if (s.loan.grace > 0) s.loan.grace--;
        else { s.loan.remaining = Math.max(0, s.loan.remaining - s.stats.breakdown.loanPayment); s.loan.monthsPaid++; }
      }
      s.month++;
      settleMarinaMonth(s);
      advanceCityIncidents(s);
      s.history.push({ month: s.month - 1, population: s.stats.population, money: s.money, happiness: s.stats.happiness, balance });
      if (s.history.length > 120) s.history.shift();
      this.recalculate();
    }
    return s.stats;
  }

  setTax(rate) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const n = Number(rate); if (!Number.isFinite(n)) return { ok: false, message: '税率无效' };
    this.state.taxRate = Math.round(clamp(n, 6, 15)); this._undo = null; this.recalculate();
    return { ok: true, message: `税率已调整为 ${this.state.taxRate}%` };
  }

  rotateBuilding(id,direction=1){
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const b=this.state.buildings.find(b=>b.id===Number(id));
    if(!b||![1,-1].includes(direction))return {ok:false,message:'请先选择要旋转的建筑'};
    this._undo={tick:this.state.tick,state:clone(this.state)};
    const group=civicGardenGroups(this.state.buildings).get(b.id),ids=group?.members||[b.id];
    for(const member of this.state.buildings.filter(v=>ids.includes(v.id)))member.rotation=((member.rotation||0)+direction+4)%4;
    this.recalculate();return {ok:true,message:'建筑已旋转 '+(direction===1?'向右':'向左')+' 90°，当前 '+b.rotation*90+'°'};
  }

  setBuildingActive(id, active) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const b = this.state.buildings.find(b => b.id === Number(id));
    if (!b || !PUBLIC.includes(b.type)) return { ok: false, message: '只能暂停市政设施' };
    b.active = !!active; this._undo = null; this.recalculate();
    return { ok: true, message: active ? '设施恢复运行' : '设施暂停，仍保留 15% 基础维护费' };
  }

  setDistrictName(name) {
    const text = String(name).trim().slice(0, 24);
    if (!text) return { ok: false, message: '请输入城市名称' };
    this.state.districtName = text; this._undo = null; return { ok: true, message: `欢迎来到${text}` };
  }

  setCityIdentity(identity) {
    if (!identity || typeof identity !== 'object' || Array.isArray(identity) || typeof identity.cityName !== 'string' || typeof identity.mayorName !== 'string') return { ok: false, message: '城市名称和市长姓名都必须是文字' };
    const cityName = identity.cityName.trim(), mayorName = identity.mayorName.trim();
    if (!cityName || cityName.length > 24) return { ok: false, message: '城市名称需要 1–24 个字符' };
    if (mayorName.length > 24) return { ok: false, message: '市长姓名最多 24 个字符，也可以留空' };
    this.state.districtName = cityName;
    this.state.mayorName = mayorName;
    this._undo = null;
    return { ok: true, message: mayorName ? `${cityName}的市长署名已保存为${mayorName}` : `${cityName}的城市资料已保存` };
  }

  takeLoan() {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    if (this.state.loan.taken) return { ok: false, message: '应急贷款只能申请一次' };
    if (this.state.money >= 3000) return { ok: false, message: '城市资金低于 ¥3,000 时开放应急贷款' };
    this.state.loan = { taken: true, remaining: 7200, grace: 3, monthsPaid: 0 };
    this.state.money += 6000; this._undo = null; this.recalculate();
    return { ok: true, message: '已收到 ¥6,000；宽限 3 个月后每月还款 ¥300，共 24 期' };
  }

  claimFestivalPoints(){if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};const result=claimFestivalPoints(this.state);if(result.ok)this._undo=null;return result;}
  redeemFestivalReward(id){if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};const result=redeemFestivalReward(this.state,id);if(result.ok)this._undo=null;return result;}

  enterDragonRace(team,stake){
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const result=enterDragonRace(this.state,team,stake);
    if(result.ok){this._undo=null;latchBankruptcy(this.state);}
    return result;
  }

  resolveCityEvent(eventId, actor) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const story = getCitizenStory(this.state, actor);
    if (typeof eventId !== 'string' || eventId.length > 160 || !story?.event || story.event.id !== eventId) return { ok: false, message: '这条街坊提议已经变化，请重新点选街上的居民或车辆' };
    if (!story.event.available) return { ok: false, message: story.event.reason };
    this.state.money -= story.event.cost;
    this.state.cityLife = { lastEventMonth: this.state.month, activeEvent: { kind: story.event.kind, expiresMonth: this.state.month + 2, bonus: 4 } };
    // An older construction snapshot must never refund the event or re-open it.
    this._undo = null;
    this.recalculate();
    return { ok: true, message: story.event.title+'开始了！本月及下月，全市居民满意度 +4' };
  }

  _refreshDrillReadiness() {
    const plan = planFireDrill(this.state);
    this.state.stats.civic.drillReady = plan.ready;
    this.state.stats.civic.drillReason = plan.reason;
  }

  _finishFireDrill(status, message) {
    const s = this.state, incident = s.civic.incident;
    if (!incident) return;
    s.civic.history.push({ id: incident.id, month: s.month, tick: s.tick, x: incident.x, y: incident.y, status, message });
    if (s.civic.history.length > 12) s.civic.history.shift();
    s.civic.incident = null;
  }

  _advanceFireDrill() {
    const incident = this.state.civic.incident;
    if (!incident) return;
    incident.remainingTicks--;
    incident.progress = 1 - incident.remainingTicks / incident.totalTicks;
    if (incident.remainingTicks <= 0) {
      if (incident.stage === 'responding') {
        incident.stage = 'controlling'; incident.progress = 0; incident.remainingTicks = 3; incident.totalTicks = 3;
      } else this._finishFireDrill('completed', '消防演练完成：沿道路抵达目标并完成安全处置，没有伤亡或建筑损失');
    }
    this._refreshDrillReadiness();
  }

  getCivicInfo() {
    return { ...this.state.stats.civic, budget: this.state.civic.fireBudget,
      budgetOptions: Object.values(FIRE_BUDGETS).map(value => ({ ...value })),
      policy: this.state.civic.policy, policyOptions: Object.values(CIVIC_POLICIES).map(value => ({ ...value })),
      policyActive: this.state.stats.civic.hallReady, canChangePolicy: this.state.stats.civic.hallReady,
      canChangeBudget: this.state.stats.civic.hallReady, canStartDrill: this.state.stats.civic.drillReady,
      incident: this.state.civic.incident ? clone(this.state.civic.incident) : null,
      history: clone(this.state.civic.history),
    };
  }

  setFireBudget(value) {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    if (![70, 100, 130].includes(value)) return { ok: false, message: '消防预算只能选择省预算 70%、标准 100% 或加强 130%' };
    if (!this.state.buildings.some(b => b.type === 'cityHall' && civicBuildingReady(b))) return { ok: false, message: '需要正在营业且道路、水电正常的市政府，才能调整预算' };
    if (this.state.civic.fireBudget === value) return { ok: false, message: '当前已经使用这个消防预算档位' };
    this.state.civic.fireBudget = value; this._undo = null; this.recalculate();
    return { ok: true, message: `消防预算已调整为${FIRE_BUDGETS[value].label}：基础覆盖 ${FIRE_BUDGETS[value].range} 格，一级站基础月维护 ¥${FIRE_BUDGETS[value].monthlyCost}；升级加成另计` };
  }

  setCivicPolicy(value){
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const policy=CIVIC_POLICIES[value];if(!policy)return {ok:false,message:'请选择有效的市政方针'};
    if(!this.state.buildings.some(b=>b.type==='cityHall'&&civicBuildingReady(b)))return {ok:false,message:'需要正在办公且道路、水电正常的市政府，才能调整市政方针'};
    if(this.state.civic.policy===value)return {ok:false,message:`当前已经实行${policy.label}`};
    this.state.civic.policy=value;this._undo=null;this.recalculate();
    return {ok:true,message:`市政方针已调整为${policy.label}：${policy.description}`};
  }

  startFireDrill() {
    if(isBankrupt(this.state))return {ok:false,message:BANKRUPTCY_MESSAGE};
    const s = this.state, plan = planFireDrill(s);
    if (!plan.ready) return { ok: false, message: plan.reason };
    const responseTicks = Math.max(3, Math.ceil(plan.path.length / 2));
    s.civic.lastDrillMonth = s.month;
    s.civic.incident = { id: `drill-${s.month}-${s.tick}-${plan.station.id}-${plan.target.id}`, kind: 'drill',
      targetId: plan.target.id, stationId: plan.station.id, x: plan.target.x, y: plan.target.y,
      path: plan.path, stage: 'responding', progress: 0, remainingTicks: responseTicks, totalTicks: responseTicks,
      startedTick: s.tick, startedMonth: s.month,
    };
    this._undo = null; this._refreshDrillReadiness();
    return { ok: true, message: '消防演练已发起，消防车正在沿道路出发；本次演练免费，不会损伤居民或建筑' };
  }

  getObjective() {
    const s = this.state, n = s.stats.population;
    if (!s.stats.powerCapacity || !s.stats.waterCapacity) return { title: '点亮第一片街区', description: '接通入口道路，在路边建设供电站和水塔', progress: (s.stats.powerCapacity > 0 ? 0.5 : 0) + (s.stats.waterCapacity > 0 ? 0.5 : 0), current: Number(s.stats.powerCapacity > 0) + Number(s.stats.waterCapacity > 0), target: 2 };
    if (!s.milestones.named) return { title: '一座小镇的诞生', description: '规划临路住宅、商店和工坊，迎来 100 位居民', progress: clamp(n / 100, 0, 1), current: n, target: 100 };
    if (!s.milestones.bridge) return { title: '成长为河畔小镇', description: '达到 500 人、就业率 ≥65%，让小镇站稳脚跟', progress: Math.min(clamp(n / 500, 0, 1), clamp(s.stats.employmentRate / 65, 0, 1)), current: n, target: 500 };
    if (!s.milestones.density) {
      const hall=cityHallRequirement(s.buildings);
      return {title:'建立市政，迈向城市',description:'道路等级只随人口开放；达到 1,000 人可升级二级道路，同时让市政府正常办公即可开放供电、供水和私人建筑二级升级。',progress:(clamp(n/1000,0,1)+Number(hall.met))/2,current:n,target:1000,requirements:[{label:'人口达到 1,000',met:n>=1000,detail:`${n.toLocaleString('zh-CN')} / 1,000 人 · 达标后开放二级道路`},hall],action:!hall.exists?'cityHall':n>=1000?'upgrade':null};
    }
    if (!s.milestones.completed) return { title: `属于你的${s.districtName}`, description: `2,000 人 · 满意度 ≥70% · 连续盈利 ${Math.min(3, s.profitableMonths)}/3 个月`, progress: Math.min(clamp(n / 2000, 0, 1), clamp(s.stats.happiness / 70, 0, 1), clamp(s.profitableMonths / 3, 0, 1)), current: n, target: 2000 };
    const domainObjective=(milestone,title,target,description)=>{const readiness=domainStageReadiness(s,milestone);return {title,description,progress:readiness.progress,current:n,target,requirements:readiness.requirements,action:'upgrade',actionLabel:'查看升级条件，补齐领域'};};
    if (!s.milestones.metropolis) return domainObjective('metropolis','迈向活力都市',5000,'5,000 人单独开放三级道路；完成二级水电、住商工、公共服务、休闲景观和环境协同后开放三级建筑。');
    if (!s.milestones.capital) return domainObjective('capital','万家灯火的河湾',10000,'10,000 人单独开放四级道路；完成三级全领域协同后开放四级建筑。');
    if(!s.milestones.regional)return domainObjective('regional','迈向区域中心',20000,'20,000 人单独开放五级道路；完成四级全领域协同后开放五级住宅、水电、医院和区域名胜。');
    if(!s.milestones.mature)return domainObjective('mature','建设均衡大城',30000,'用五级道路连接主要街区，并保持四级水电、住商工、消防、医疗、教育、文化、体育、市政和景观达标，开放其余五级建筑。');
    if(!s.milestones.civic)return domainObjective('civic','建设宜居中心城',40000,'完成包含宗教与信仰的五级全领域协同，开放六级住宅、消防、医疗、教育、文化、体育、市政与景观，并解锁都会大体育场和大美术馆。');
    if(!s.milestones.global)return domainObjective('global','建设国际都会',50000,'50,000 人单独开放六级道路；完成五级全领域协同和六级道路骨架，开放六级产业、水电、商业休闲与国际设施。');
    if(n<60000)return {title:'迈向都会快速路',description:'城市达到 60,000 人后永久开放七级都会快速路；道路与桥梁均可升级，容量由 650 提升至 1,000。',progress:clamp(n/60000,0,1),current:n,target:60000,action:'upgrade',actionLabel:'查看道路升级'};
    const target=Math.max(55000,(Math.floor(n/5000)+1)*5000);
    return {title:'城市，继续生长',description:`下一站 ${target.toLocaleString('zh-CN')} 人 · 无人口硬上限，查看需求来源与服务缺口`,progress:clamp(n/target,0,1),current:n,target};
  }

  getCommunityBeauty(x,y) {
    const sources=this.state.buildings.filter(b=>beautyEffect(b)).map(b=>{
      const {radius,strength}=beautyEffect(b);
      const value=Math.max(0,(1-Math.hypot(b.x-x,b.y-y)/radius)*strength);
      return {id:b.id,name:DECORATIONS[b.type]?.name||BUILDING_TIERS[b.type]?.names[b.level-1]||NAMES[b.type],value};
    }).filter(s=>s.value>0).sort((a,b)=>b.value-a.value||a.id-b.id);
    return {value:this.tile(x,y)?.amenity||0,cap:28,sources};
  }

  getGrowthStages() { return CITY_STAGES.map(stage => ({ ...stage, reward: stage.reward+' · 名胜：'+Object.values(LANDMARKS).filter(item=>item.population===stage.population).map(item=>item.name).join('、'), reached: !!this.state.milestones[stage.milestone] })); }

  getInfo(x, y) {
    const t = this.tile(x, y);
    if (!t) return { title: '地图之外', subtitle: '', metrics: [], problem: '', tip: '' };
    const b = this.state.buildings.find(b => b.id === t.buildingId);
    if (b) {
      if(DECORATIONS[b.type])return {
        title:DECORATIONS[b.type].name,subtitle:`景观装饰 · ${footprintSize(b)} × ${footprintSize(b)} 格 · (${b.x}, ${b.y})`,
        metrics:[{label:'道路 / 水电',value:'无需连接'},{label:'美观影响半径',value:`${gardenRadius(b)} 格`},{label:'社区美观加成',value:`最高 +${gardenStrength(b)} · 随距离递减`},{label:'状态',value:b.active?'开放中':'已暂停'},{label:'月维护',value:`¥${round(DECORATIONS[b.type].maintenance*(b.active?1:.15))}`}],
        problem:b.active?'':'设施已暂停',tip:DECORATIONS[b.type].description+'。空地即可摆放，无需道路水电；暂停后美观与照明停止。',buildingId:b.id,active:b.active,
      };
      if (GARDENS.includes(b.type)) return {
        title: BUILDING_TIERS[b.type].names[b.level-1], subtitle: `等级 ${b.level} / 6 · 开放式绿地 · (${x}, ${y})`,
        metrics: [{label:'占地',value:`${footprintSize(b)} × ${footprintSize(b)} 格`},{label:'下一阶段',value:upgradeOffer(b,this.state).reason},{ label: '道路 / 水电', value: '无需连接' }, { label: '美观影响半径', value: `${gardenRadius(b)} 格` }, {label:'社区美观加成',value:`最高 +${gardenStrength(b)} · 随距离递减`}, { label: '状态', value: b.active ? '开放中' : '已暂停' }, { label: '月维护', value: `¥${round(MAINTENANCE[b.type] * maintenanceMultiplier(b) * (b.active ? 1 : .15))}` }],
        problem: b.active ? '' : '设施已暂停', tip: '放在陆地空地即可改善周围环境并提供休闲景观覆盖。四座同类单格绿地摆成 2×2 会组成大型绿地，升级和移动时整组处理；暂停后覆盖与环境加成都会停止。', buildingId: b.id, active: b.active,
      };
      const metrics = [{label:'占地',value:`${footprintSize(b)} × ${footprintSize(b)} 格`},{ label: '道路连接', value: !requiresRoad(b.type) ? '无需连接' : b.connected ? '已连通' : '未连通' }, { label: '电力 / 供水', value: `${b.powered ? '有电' : '缺电'} / ${b.watered ? '有水' : '缺水'}` }];
      if(b.coverageDescription)metrics.push({label:'服务覆盖范围',value:b.coverageDescription},{label:'当前覆盖',value:b.coverageCells.length?`${b.coverageCells.length} 格（地图高亮）`:'未生效，请检查设施状态'});
      if(b.type==='residential'){
        for(const type of ['policeStation','busStop','clinic','school','sportsHall','library','spiritual','entertainment','shopping','park','cityHall']){const level=b.serviceLevels?.[type]||0;metrics.push({label:SERVICE_LABELS[type]+'覆盖',value:level?`${level} 级覆盖`:'未覆盖'});}
        metrics.push({label:'市政覆盖说明',value:'市政府一级覆盖 10 格；区政务中心依托市政府提供 6 格片区覆盖。两者每升一级均增加 2 格。'});
        const beauty=this.getCommunityBeauty(x,y);
        metrics.push({label:'社区美观',value:`${beauty.value.toFixed(1)} / ${beauty.cap} · 升四级需 12`});
        metrics.push({label:'美观来源',value:beauty.sources.length?beauty.sources.map(s=>`${s.name} +${s.value.toFixed(1)}`).join('；'):'附近暂无生效景观'});
        metrics.push({label:'美观规则',value:'附近景观叠加，合计上限 28；随距离递减，提高居住满意度'});
        for(const requirement of upgradeOffer(b,this.state).requirements||[])metrics.push({label:'升级条件 · '+requirement.label,value:requirement.met?'已满足':'未满足'});
      }
      if(PRIVATE.includes(b.type)){const group=privateBuildingGroups(this.state.buildings,this.state.tiles).get(b.id);metrics.push({label:'建筑形态',value:group?`${group.members.length===2?'双':'三'}联排 · ${group.level} 级整体立面`:'独栋'});}
      if(b.businessKind)metrics.push({label:'建筑类型',value:BUSINESS_KINDS[b.businessKind].name});
      if(PRIVATE.includes(b.type))metrics.push({label:'建筑风格',value:buildingStyle(b).name});
      if(b.type==='policeStation')metrics.push({label:'巡逻范围',value:`沿道路 ${communityService(b).radius} 格`},{label:'治安保护',value:'覆盖居民降低抢劫风险，事件满意度与迁出影响减半'});
      if(b.type==='busStop'){const routes=busRoutes(this.state).filter(r=>r.facilityId===b.id||r.targetId===b.id);metrics.push({label:'公交线路',value:routes.length?`${routes.length} 条往返线路`:'尚未开通 · 需要另一座连通道路、水电正常的公交站'},{label:'通勤减负',value:'两端站点 4 格内：车流 −40%，通勤时间 −15%'},{label:'全城公交通勤',value:`${this.state.stats.transit?.commuters||0} 人`});}
      if (COMMUNITY_BUILDINGS[b.type]) metrics.push({ label: COMMUNITY_BUILDINGS[b.type].roadService?'道路服务范围':'服务半径', value: `${communityService(b).radius} 格` }, { label: '住宅满意度', value: `+${communityService(b).bonus}，同类取最高值` });
      if (COMMUNITY_BUILDINGS[b.type]?.beauty) metrics.push({label:'社区美观加成',value:`最高 +${communityService(b).beauty} · 随距离递减`},{label:'休闲娱乐加成',value:`满意度 +${communityService(b).bonus} · 同类取最高值`});
      if(b.type==='marina'){
        const boats=this.state.marinaLife.boats.filter(v=>v.marinaId===b.id);
        metrics.push({label:'游艇泊位',value:`${boats.length} / ${marinaBerths(this.state,b).length}`},{label:'造船供应',value:shipyardReady(this.state)?'造船厂正在运营':'需先建成并运行造船厂，才能购买新船'},{label:'购船条件',value:'三级以上住宅，或二级以上大庭院住宅；有居民入住且道路水电正常'},{label:'居民购船积蓄',value:'每月积累住宅等级 × ¥1,000；小游艇 ¥8,000，豪华游艇 ¥16,000；不扣城市资金'},{label:'泊位船只',value:boats.map(v=>YACHT_TYPES[v.kind].name+' · 住宅 #'+v.homeId).join('；')||'暂无游艇，等待居民积蓄与造船供应'});
      }
      if(b.type==='residential'){
        const yacht=this.state.marinaLife.boats.find(v=>v.homeId===b.id),account=this.state.marinaLife.accounts.find(a=>a.homeId===b.id);
        if(yacht||account)metrics.push({label:'家庭游艇',value:yacht?YACHT_TYPES[yacht.kind].name+(yacht.marinaId?' · 停靠码头 #'+yacht.marinaId:' · 待安排泊位'):'购船积蓄 ¥'+account.balance});
      }
      if(COMMUNITY_BUILDINGS[b.type]?.category==='religion')metrics.push({label:'精神慰藉',value:'与其他信仰设施、公园及文化空间取最高值，不重复叠加'},{label:'社区活动',value:COMMUNITY_BUILDINGS[b.type].description});
      if (b.type === 'residential') metrics.push({ label: '社区服务加成', value: `+${t.communityBonus}` });
      if (b.type === 'residential') metrics.push({ label: '居民 / 容量', value: `${b.population} / ${capacity(b)}` }, { label: '满意度', value: `${b.happiness}%${b.incidentHappinessPenalty?` · 事件 −${b.incidentHappinessPenalty}`:''}` }, {label:'入住意愿',value:b.moveInBlocked?'事件期间暂停入住':`${b.moveInWillingness}%${b.incidentMigrationPenalty?` · 事件额外 −${b.incidentMigrationPenalty}`:''}`}, { label: '平均通勤', value: b.workers ? `${b.commute} 分钟` : '暂无通勤' }, { label: '就业居民', value: `${b.workers} 人` });
      if (['commercial', 'industrial'].includes(b.type)||COMMUNITY_BUILDINGS[b.type]?.jobs) metrics.push({ label: '员工 / 岗位', value: `${b.workers} / ${b.jobs}` });
      if(b.type==='residential')metrics.push({label:'预计居民税',value:`¥${Math.round(b.taxContribution||0)} / 月 · 工资税与居住服务费`});
      if(['commercial','industrial'].includes(b.type)||isCommunityBusiness(b.type))metrics.push({label:'企业发放工资',value:`¥${Math.round(b.monthlyPayroll||0)} / 月 · 不由市财政承担`},{label:'预计经营税',value:`¥${Math.round(b.taxContribution||0)} / 月 · 按实际到岗人数`});
      if (isUtility(b.type)) metrics.push({ label: b.type==='power'?'供电容量':'供水容量', value: b.progress<1 ? `${utilityCapacity(b)} · 改造完成后 ${buildingCapacity(b)}` : String(buildingCapacity(b)) });
      if (PRIVATE.includes(b.type)) metrics.push({label:'月维护',value:`¥${privateMaintenance(b)} · 街区配套，空置也计费`});
      if (PUBLIC.includes(b.type)&&!isCommunityBusiness(b.type)) metrics.push({ label: '月维护', value: `¥${round((b.type === 'fireStation' ? FIRE_BUDGETS[this.state.civic.fireBudget].monthlyCost : MAINTENANCE[b.type]) * maintenanceMultiplier(b) * utilityScale(b) * (b.active ? 1 : 0.15) * (activeCivicPolicy(this.state)?.publicCostMultiplier||1))}` },{label:'公共部门工资',value:`¥${round(b.publicPayroll||0)} / 月`});
      if(isCommunityBusiness(b.type))metrics.push({label:'月经营维护',value:`¥${round((MAINTENANCE[b.type]||0)*maintenanceMultiplier(b)*(b.active?1:.15))} · 计入商业配套维护`});
      if (b.type === 'fireStation') metrics.push({ label: '消防预算 / 道路范围', value: `${this.state.civic.fireBudget}% / ${fireRange(this.state, b)} 格` });
      if (b.type === 'districtOffice') metrics.push({label:'片区职能',value:'将市政府方针延伸到周边住宅 · 可重复建设'},{label:'不具备的权限',value:'城市晋级 · 市政方针制定 · 预算调整 · 消防调度'},{label:'与市政府关系',value:this.state.buildings.some(v=>v.type==='cityHall'&&civicBuildingReady(v))?'市政府正常办公，片区服务已生效':'市政府未正常办公，片区服务暂停'});
      if (b.type === 'cityHall') {
        const policy=CIVIC_POLICIES[this.state.civic.policy],ready=civicBuildingReady(b);
        metrics.push({label:'全城治理职能',value:'城市晋级 · 市政方针制定 · 预算调整 · 消防调度 · 区政务中心统筹'},{label:'当前市政方针',value:`${policy.label}${ready?'正在生效':'已暂停'} · ${policy.description}`},{label:'市政服务人口',value:`${this.state.stats.civic.municipalCoveredPopulation||0} 人 · 一级半径 10 格，每级 +2 格`},{ label: '消防调度范围加成', value: `+${(b.level - 1) * 2} 格` });
      }
      if(LANDMARKS[b.type]){
        metrics.push({label:'名胜等级',value:LANDMARK_LEVEL_NAMES[b.level-1]},{label:'名胜荣誉积分',value:String(landmarkHonor(b))+(b.progress<1?' · 修缮完工后增加 2 分':'')},{label:'美观影响半径',value:`${gardenRadius(b)} 格`},{label:'社区美观加成',value:`最高 +${gardenStrength(b)}`});
        for(const requirement of upgradeOffer(b,this.state).requirements||[])metrics.push({label:'修缮条件 · '+requirement.label,value:requirement.met?'已满足':'未满足'});
      }
      if (BUILDING_TIERS[b.type]||LANDMARKS[b.type]) metrics.push({ label: '下一阶段', value: upgradeOffer(b, this.state).reason });
      if (b.type === 'cityHall') metrics.push({ label: '城市名称', value: this.state.districtName }, { label: '市长姓名', value: this.state.mayorName || '尚未署名' }, { label: '市政管理', value: civicBuildingReady(b) ? '可以调整方针、消防预算与发起演练' : '等待恢复道路、水电或营业' });
      if (PRIVATE.includes(b.type)) metrics.push({ label: '消防覆盖', value: b.fireServiceLevel ? `${b.fireServiceLevel} 级覆盖` : '未覆盖' });
      metrics.push({ label: '周边污染', value: `${Math.round(t.pollution)} / 100` });
      const localIncident=ensureCityIncidents(this.state).active.find(event=>Math.hypot(b.x-event.x,b.y-event.y)<=CITY_INCIDENT_TYPES[event.kind].radius);
      if(localIncident){const type=CITY_INCIDENT_TYPES[localIncident.kind];metrics.push({label:'当前风险事件',value:`${type.title} · 持续至第 ${localIncident.expiresMonth-1} 月末`},{label:'改善方向',value:type.solution});}
      return { title: b.type === 'cityHall' ? `${this.state.districtName} · ${b.level === 1 ? '市政府' : BUILDING_TIERS.cityHall.names[b.level - 1]}` : (utilityScale(b)>1 ? (b.level===1?(b.type==='power'?'大型供电站':'大型供水站'):'大型'+BUILDING_TIERS[b.type].names[b.level-1]) : businessKind(b.businessKind)?.name || BUILDING_TIERS[b.type]?.names[b.level - 1] || NAMES[b.type]), subtitle: `${COMMUNITY_BUILDINGS[b.type]?.fixedFacility ? (b.type==='busStop'?'公交设施（无需升级）':'完整大型设施')+(b.level>1?' · 保留原有 '+b.level+' 级效益':'') : LANDMARKS[b.type] ? '名胜等级 '+b.level+' / '+MAX_LANDMARK_LEVEL : BUILDING_TIERS[b.type] ? '等级 ' + b.level + ' / 6' : '市政设施'} · ${b.progress < 1 ? `施工 ${Math.round(b.progress * 100)}%` : `(${x}, ${y})`}`, metrics, problem: b.problem,
        tip: localIncident?CITY_INCIDENT_TYPES[localIncident.kind].solution:LANDMARKS[b.type]?'名胜可逐步修缮至三级，需要人口、城市阶段和市长荣誉共同达标。每级贡献 2 / 4 / 6 点荣誉积分，完工后增加积分、提升外观与环境覆盖，占地不变。':isUtility(b.type) ? '连接入口道路并启用后供应全城。点击升级按钮扩容，二级起依次随 1,000 / 5,000 / 10,000 / 20,000 / 50,000 人城市阶段解锁；改造期间维持原等级容量，完工后提升供应，占地不变。' : b.type==='busStop'?COMMUNITY_BUILDINGS.busStop.description:b.type==='policeStation'?COMMUNITY_BUILDINGS.policeStation.description:b.type==='districtOffice'?'区政务中心是市政府的片区服务站：可重复建设并扩展方针与住宅市政覆盖，但只有市政府正常办公时才生效。':COMMUNITY_BUILDINGS[b.type] ? `${requiresRoad(b.type)?'接通对外道路和水电':'无需临路，城市水电供应充足'}、完成施工后提供服务；暂停或搬离后原街区加成消失，同类服务不叠加。` : !b.connected ? '为建筑相邻的一格接上道路，并将道路连到任一对外入口。' : !b.powered || !b.watered ? '检查设施是否运行且临路，以及水电容量是否足够。' : b.problem.includes('污染') ? '将工厂与住宅隔开；公园能改善环境，但不能消除污染。' : b.problem.includes('通勤') ? '补充有竞争力的连接、升级拥堵道路，或把工作机会搬近。' : b.type === 'residential' ? '岗位、公园和低污染让居民愿意留下；满员后可扩张街区。' : b.type === 'commercial' ? '商业提供消费与工作；本地工业可以降低进货成本。' : b.type === 'industrial' ? '工厂提供工作与货源，也带来污染和货运。' : b.type === 'fireStation' ? '消防覆盖沿真实连通道路计算。通过市政府调整预算，覆盖住宅满意度 +2。消防演练不会造成损失。' : b.type === 'cityHall' ? '打开城市政务选择市政方针。市政府正常办公时，方针会立即影响覆盖住宅、公共支出或企业经营，并开放消防管理。' : '市政设施需要连接道路。暂停可节约 85% 维护费。', buildingId: b.id, active: b.active };
    }
    if(t.road&&t.interchange){const item=t.interchange,b=interchangeBounds(item);return {title:`${b.width}×${b.height} 立交桥`,subtitle:`${item.axis==='ns'?'南北高架 · 东西地面':'东西高架 · 南北地面'} · 等级 ${t.road} / 7`,problem:t.traffic>=75?'高峰时段拥堵':undefined,metrics:[{label:'对外连通',value:t.connected?'已连接':'未连接'},{label:'高峰负荷 / 容量',value:`${Math.round((t.trafficLoad||0)*10)/10} / ${t.trafficCapacity}`},{label:'拥堵程度',value:Math.round(t.traffic||0)+'%'},{label:'高架方向',value:item.axis==='ns'?'南北':'东西'},{label:'路口通行',value:'上下层分别直行，转弯需走外围道路'},{label:'额外月维护',value:'¥'+INTERCHANGE_MAINTENANCE}],tip:'交通图层同时显示地面与桥面负荷。可预览改向，或恢复平面路口。'};}

    if(t.road){
      const entrance=this.state.stats.entrances.find(p=>p.roadIndexes.includes(this._index(x,y)));
      if(entrance)return {title:'城市对外入口',subtitle:`${ENTRANCE_SIDE_NAMES[entrance.side]} · ${entrance.lanes} 格宽 · 等级 ${t.road} / ${MAX_ROAD_LEVEL} · (${x}, ${y})`,metrics:[
        {label:'入口外部货运 / 容量',value:`${entrance.freightLoad} / ${entrance.capacity}`},
        {label:'本格总负荷 / 容量',value:`${round(t.trafficLoad)} / ${t.trafficCapacity}`},
        {label:'拥堵程度',value:`${Math.round(t.traffic)}%`},
        {label:'全城对外入口',value:`${this.state.stats.entrances.length} 处`},
        {label:'下一阶段',value:roadUpgradeOffer(t,this.state).reason}],problem:t.traffic>80?'高峰时段拥堵':'',
        tip:'四周陆地道路接到地图边缘并通向城内，即可形成入口。企业货运按距离、道路容量和拥堵选择入口；相邻边缘车道合为一个宽入口。'};
    }
    if (t.road) return { title: t.bridge ? '跨河大桥 · ' + ROAD_TIERS[t.road].name : ROAD_TIERS[t.road].name, subtitle: `等级 ${t.road} / ${MAX_ROAD_LEVEL} · (${x}, ${y})`, metrics: [{ label: '对外连通', value: t.connected ? '已连接' : '断开' }, { label: '高峰负荷 / 容量', value: `${round(t.trafficLoad)} / ${t.trafficCapacity}` }, { label: '拥堵程度', value: `${Math.round(t.traffic)}%` }, { label: '下一阶段', value: roadUpgradeOffer(t, this.state).reason }], problem: !t.connected ? '未连通入口' : t.traffic > 80 ? '高峰时段拥堵' : '', tip: '道路升级只随人口阶段开放。居民通勤沿城内道路计算；企业货运可由任一对外入口进入。将道路接到地图边缘增设入口，或升级拥堵道路，可以分担压力。' };
    if (t.zone) return { title: `${businessKind(t.businessKind)?.name || TOOLS[t.zone].label}规划地块`, subtitle: `(${x}, ${y})`, metrics: [{ label: '当前需求', value: `${this.state.stats.demand[t.zone]}%` }], problem: t.zone==='commercial'&&!commercialPrerequisite(this.state,t.businessKind).allowed?commercialPrerequisite(this.state,t.businessKind).reason:!t.connected ? '缺少连接入口的临街道路' : !t.powered ? '缺少电力容量' : !t.watered ? '缺少供水容量' : this.state.stats.demand[t.zone] < 12 ? '当前市场需求不足' : '等待开发商开工', tip: '建筑只会在与道路相邻的分区上生长；道路需要连接到任一对外入口。' };
    return { title: t.terrain === 'water' ? '河湾水域' : '待规划的土地', subtitle: `(${x}, ${y})`, metrics: [{ label: '污染', value: `${Math.round(t.pollution)} / 100` }, { label: '社区美观', value: `${t.amenity.toFixed(1)} / 28` }], problem: '', tip: t.terrain === 'water' ? '选择桥梁工具，在河面或岸边预览整座桥；两岸无建筑阻挡、资金足够即可建设。' : '选择道路、分区或设施，开始规划。住宅需要临路与水电。' };
  }

  serialize() {
    // Derived grids and routes are rebuilt on load. Compact saves leave room for
    // several recovery checkpoints within the browser's localStorage quota.
    const { stats, routes, ...persistent } = this.state;
    return JSON.stringify({ ...persistent,
      tiles: this.state.tiles.map(({ x, y, terrain, road, zone, buildingId, bridge, businessKind,vegetation }) => ({ ...(vegetation!==undefined?{vegetation}:{}), ...(businessKind?{businessKind}:{}), x, y, terrain, road, zone, buildingId, bridge })),
      buildings: this.state.buildings.map(({ id, x, y, type, level, progress, population, active, age, variant, shortageTicks, footprint, businessKind, rotation, legacyLotArea }) => ({ ...(legacyLotArea?{legacyLotArea}:{}), ...(rotation!==undefined?{rotation}:{}), ...(businessKind?{businessKind}:{}), ...(footprint ? {footprint} : {}), id, x, y, type, level, progress, population, active, age, variant, shortageTicks })),
    });
  }

  serializeCompact() {
    // Browser saves use positional tuples instead of repeating object keys for
    // every map cell. The regular JSON format remains available for tools,
    // collaborative snapshots and backwards-compatible tests.
    const { stats, routes, ...persistent } = this.state;
    const tiles=this.state.tiles.map(tile=>{
      const row=[tile.terrain==='water'?1:0,tile.road||0,tile.zone===null?0:PRIVATE.indexOf(tile.zone)+1,tile.buildingId||0,tile.bridge?1:0,tile.businessKind||''];
      if(tile.vegetation!==undefined)row.push(tile.vegetation+1);
      while(row.length&&[0,''].includes(row.at(-1)))row.pop();
      return row;
    });
    const buildings=this.state.buildings.map(building=>{
      const row=[building.id,building.x,building.y,building.type,building.level,building.progress,building.population,building.active?1:0,building.age,building.variant,building.shortageTicks,building.footprint||0,building.businessKind||'',building.rotation??-1,building.legacyLotArea||0];
      while(row.length>11&&[0,'',-1].includes(row.at(-1)))row.pop();
      return row;
    });
    return JSON.stringify({...persistent,storageEncoding:'tuple-v1',tiles,buildings});
  }

  static deserialize(text) {
    if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('存档格式或大小无效');
    let raw; try { raw = JSON.parse(text); } catch { throw new Error('存档不是有效的 JSON'); }
    const fail = () => { throw new Error('存档数据不完整或已损坏'); };
    const num = (n, min, max, integer = false) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
    const mapSize=raw?.mapSize??SIZE;
    if(raw?.storageEncoding!==undefined){
      if(raw.storageEncoding!=='tuple-v1'||!validMapSize(mapSize)||!Array.isArray(raw.tiles)||!Array.isArray(raw.buildings))fail();
      const tiles=raw.tiles.map((row,i)=>{
        if(!Array.isArray(row)||row.length>7)fail();
        const [terrain=0,road=0,zone=0,buildingId=0,bridge=0,kind='',vegetation=0]=row;
        if(![0,1].includes(terrain)||!num(road,0,MAX_ROAD_LEVEL,true)||!num(zone,0,PRIVATE.length,true)||!num(buildingId,0,1e9,true)||![0,1].includes(bridge)||typeof kind!=='string')fail();
        if(![0,1,2].includes(vegetation))fail();
        return {x:i%mapSize,y:Math.floor(i/mapSize),terrain:terrain?'water':'land',road,zone:zone?PRIVATE[zone-1]:null,buildingId:buildingId||null,bridge:!!bridge,...(kind?{businessKind:kind}:{}),...(vegetation?{vegetation:vegetation-1}:{})};
      });
      const buildings=raw.buildings.map(row=>{
        if(!Array.isArray(row)||row.length<11||row.length>15)fail();
        const [id,x,y,type,level,progress,population,active,age,variant,shortageTicks,footprint=0,kind='',rotation=-1,legacyLotArea=0]=row;
        if(![0,1].includes(active)||typeof kind!=='string'||!num(footprint,0,3,true)||!num(rotation,-1,3,true)||!num(legacyLotArea,0,9,true))fail();
        return {id,x,y,type,level,progress,population,active:!!active,age,variant,shortageTicks,...(footprint?{footprint}:{}),...(kind?{businessKind:kind}:{}),...(rotation>=0?{rotation}:{}),...(legacyLotArea?{legacyLotArea}:{})};
      });
      raw={...raw,tiles,buildings};delete raw.storageEncoding;
    }
    if (!raw || raw.version !== 1 || !validMapSize(mapSize) || !Array.isArray(raw.tiles) || raw.tiles.length !== mapSize * mapSize || !Array.isArray(raw.buildings) || raw.buildings.length > mapSize * mapSize) fail();
    if (!num(raw.seed, 0, 4294967295, true) || !num(raw.rng, 0, 4294967295, true) || !num(raw.tick, 0, 1e9, true) || !num(raw.month, 1, 1e8, true) || raw.month !== Math.floor(raw.tick / 15) + 1 || !num(raw.money, -1e12, 1e12) || !num(raw.taxRate, 6, 15, true) || !num(raw.nextId, 1, 1e9, true)) fail();
    const terrainPreset=raw.terrainPreset??'bayside';
    if(!Object.hasOwn(TERRAIN_PRESETS,terrainPreset))fail();
    if(raw.customTerrain!==undefined&&typeof raw.customTerrain!=='boolean')fail();
    const sim = new CitySimulation({ seed: raw.seed, terrainPreset, mapSize });
    const cleanTiles = raw.tiles.map((t, i) => {
      if (!t || t.x !== i % mapSize || t.y !== Math.floor(i / mapSize) || !['land', 'water'].includes(t.terrain) || !num(t.road,0,MAX_ROAD_LEVEL,true) || !(t.zone === null || PRIVATE.includes(t.zone)) || !(t.buildingId === null || num(t.buildingId, 1, 1e9, true)) || (t.road && t.zone) || (t.terrain === 'water' && (t.zone || t.buildingId !== null || (t.road && !t.bridge)))) fail();
      if(t.businessKind!==undefined && businessKind(t.businessKind)?.zone!==t.zone)fail();
      if(t.vegetation!==undefined&&(![0,1].includes(t.vegetation)||t.terrain==='water'))fail();
      return { ...(t.vegetation!==undefined?{vegetation:t.vegetation}:{}), ...(t.businessKind?{businessKind:t.businessKind}:{}), x: t.x, y: t.y, terrain: t.terrain, road: t.road, zone: t.zone, buildingId: t.buildingId, bridge: !!t.bridge, connected: false, pollution: 0, traffic: 0, powered: false, watered: false };
    });
    const ids = new Set(); const positions = new Set();
    const cleanBuildings = raw.buildings.map(b => {
      if (!b || !num(b.id, 1, 1e9, true) || ids.has(b.id) || !inBounds(b.x, b.y,mapSize) || positions.has(index(b.x, b.y,mapSize)) || !TYPES.includes(b.type) || !(LANDMARKS[b.type] ? [1,2,3] : BUILDING_TIERS[b.type] ? [1, 2, 3, 4, 5, 6] : [1, 2]).includes(b.level) || !num(b.progress, 0, 1) || !num(b.population, 0, b.type === 'residential' ? capacity(b) : 0, true) || typeof b.active !== 'boolean' || !num(b.age, 0, 1e9, true) || !num(b.variant, 0, 5, true) || !num(b.shortageTicks, 0, 1e9, true)) fail();
      if(b.businessKind!==undefined && businessKind(b.businessKind)?.zone!==b.type)fail();
      if(b.rotation!==undefined&&!num(b.rotation,0,3,true))fail();
      const legacyPrivate=['residential','commercial'].includes(b.type)&&LEGACY_WIDE_PRIVATE_KINDS.has(b.businessKind);
      const legacyEstate=legacyPrivate&&['french','hotel'].includes(b.businessKind);
      if(b.legacyLotArea!==undefined&&!(legacyPrivate&&((b.legacyLotArea===4&&b.footprint===1)||(legacyEstate&&b.legacyLotArea===9&&[1,2].includes(b.footprint)))))fail();
      const legacyLarge=(b.footprint===2&&(legacyPrivate||DECORATIONS[b.type]?.style==='famousClassical'||['shoppingComplex','sportsHall','districtOffice'].includes(b.type)))||(b.footprint===3&&(legacyEstate||b.type==='shoppingComplex'));
      if (!legacyLarge && !(DECORATIONS[b.type]?.style==='famousClassical'&&b.footprint===1) && !(isUtility(b.type)&&[1,2].includes(b.footprint)) && b.footprint !== undefined && !(PRIVATE.includes(b.type)&&[1,newBuildingFootprint(b.businessKind)].includes(b.footprint)) && !(b.type==='shoppingComplex'&&b.footprint===1) && !(newBuildingFootprint(b.type) > 1 && (b.footprint===newBuildingFootprint(b.type) || (['sportsHall','cityHall','plaza','chessPavilion'].includes(b.type) && b.footprint===1) || (b.type==='operaStage'&&b.footprint===3)))) fail();
      if(newBuildingFootprint(b.type)===3&&b.type!=='operaStage'&&b.footprint!==3&&!(b.type==='shoppingComplex'&&[1,2].includes(footprintSize(b))))fail();
      if ((['hospital','stadium'].includes(b.type)||LANDMARKS[b.type]?.footprint===2||DECORATIONS[b.type]?.footprint===2) && b.footprint!==2) fail();
      for(const c of buildingCells(b)){
        if(!inBounds(c.x,c.y,mapSize)||positions.has(index(c.x,c.y,mapSize)))fail();
        const t=cleanTiles[index(c.x,c.y,mapSize)];
        if(t.buildingId!==b.id||t.road||t.terrain==='water'||(PRIVATE.includes(b.type)?t.zone!==b.type:t.zone!==null))fail();
        positions.add(index(c.x,c.y,mapSize));
      }
      ids.add(b.id); positions.add(index(b.x, b.y,mapSize));
      return { ...(b.legacyLotArea?{legacyLotArea:b.legacyLotArea}:{}), ...(b.rotation!==undefined?{rotation:b.rotation}:{}), ...(b.businessKind?{businessKind:b.businessKind}:{}), ...(b.footprint ? {footprint:b.footprint} : {}), id: b.id, x: b.x, y: b.y, type: b.type, level: b.level, progress: b.progress, population: b.population, active: b.active, age: b.age, variant: b.variant, shortageTicks: b.shortageTicks, jobs: 0, workers: 0, connected: false, powered: false, watered: false, happiness: 0, problem: '', commute: 0 };
    });
    if (cleanBuildings.filter(b => b.type === 'cityHall').length > 1) fail();
    if (cleanTiles.some(t => t.buildingId !== null && (!ids.has(t.buildingId) || !positions.has(index(t.x,t.y,mapSize)))) || [...ids].some(id => id >= raw.nextId) || cleanTiles[index(0, 32,mapSize)].road === 0) fail();
    if (!raw.loan || typeof raw.loan.taken !== 'boolean' || !num(raw.loan.remaining, 0, 7200, true) || raw.loan.remaining % 300 !== 0 || !num(raw.loan.grace, 0, 3, true) || !num(raw.loan.monthsPaid, 0, 24, true) || (!raw.loan.taken && (raw.loan.remaining || raw.loan.grace || raw.loan.monthsPaid)) || (raw.loan.taken && raw.loan.remaining !== 7200 - raw.loan.monthsPaid * 300)) fail();
    if(raw.bankruptcy!==undefined&&raw.bankruptcy!==null){
      const b=raw.bankruptcy;
      if(typeof b!=='object'||Array.isArray(b)||!raw.loan.taken||raw.money>0||b.tick!==raw.tick||b.month!==raw.month||b.money!==raw.money)fail();
    }
    if (typeof raw.districtName !== 'string' || raw.districtName.length > 24 || !raw.districtName.trim() || !num(raw.profitableMonths, 0, 1e8, true)) fail();
    if (raw.mayorName !== undefined && (typeof raw.mayorName !== 'string' || raw.mayorName.length > 24)) fail();
    const cityGoal=loadCityGoal(raw.cityGoal,raw.month);if(!cityGoal)fail();
    if (!raw.milestones || Object.keys(sim.state.milestones).some(k => typeof raw.milestones[k] !== 'boolean' && !(['metropolis', 'capital','regional','mature','civic','global'].includes(k) && raw.milestones[k] === undefined))) fail();
    if(raw.roadLevelUnlocked!==undefined&&!num(raw.roadLevelUnlocked,1,MAX_ROAD_LEVEL,true))fail();
    const legacyRoadLevel=1+['density','metropolis','capital','regional','global'].reduce((level,key,index)=>raw.milestones[key]?index+1:level,0);
    // Version 1 saves made before street stories have no cityLife field.
    let cityLife = { lastEventMonth: 0, activeEvent: null };
    if (raw.cityLife !== undefined) {
      const life = raw.cityLife;
      if (!life || typeof life !== 'object' || Array.isArray(life) || !num(life.lastEventMonth, 0, raw.month, true) || !(life.activeEvent === null || (life.activeEvent && typeof life.activeEvent === 'object' && !Array.isArray(life.activeEvent)))) fail();
      if (life.activeEvent !== null) {
        const event = life.activeEvent;
        if (!eventTitle(event.kind) || event.bonus !== 4 || life.lastEventMonth < 1 || !num(event.expiresMonth, raw.month + 1, raw.month + 2, true) || event.expiresMonth !== life.lastEventMonth + 2) fail();
        cityLife.activeEvent = { kind: event.kind, expiresMonth: event.expiresMonth, bonus: 4 };
      }
      cityLife.lastEventMonth = life.lastEventMonth;
    }
    let cityIncidents={active:[],history:[]};
    if(raw.cityIncidents!==undefined){
      const source=raw.cityIncidents;
      if(!source||typeof source!=='object'||Array.isArray(source)||!Array.isArray(source.active)||source.active.length>1||!Array.isArray(source.history)||source.history.length>24)fail();
      const incidentIds=new Set();
      const cleanIncident=(event,history=false)=>{
        const type=event&&CITY_INCIDENT_TYPES[event.kind];
        if(!type||!num(event.targetId,1,1e9,true)||!inBounds(event.x,event.y,mapSize)||!num(event.startedMonth,1,raw.month,true)||event.expiresMonth!==event.startedMonth+type.duration||event.id!==`incident-${event.kind}-${event.startedMonth}-${event.targetId}`||incidentIds.has(event.id))fail();
        if(history){if(!['expired','site-cleared'].includes(event.status)||!num(event.endedMonth,event.startedMonth,raw.month,true))fail();}
        else {const target=cleanBuildings.find(b=>b.id===event.targetId);if(event.expiresMonth<=raw.month||!target||target.x!==event.x||target.y!==event.y)fail();}
        incidentIds.add(event.id);
        return {id:event.id,kind:event.kind,targetId:event.targetId,x:event.x,y:event.y,startedMonth:event.startedMonth,expiresMonth:event.expiresMonth,...(history?{endedMonth:event.endedMonth,status:event.status}:{})};
      };
      cityIncidents={active:source.active.map(event=>cleanIncident(event)),history:source.history.map(event=>cleanIncident(event,true))};
    }
    let civic = { fireBudget: 100, policy:'balanced', lastDrillMonth: 0, incident: null, history: [] };
    if (raw.civic !== undefined) {
      const source = raw.civic;
      if (!source || typeof source !== 'object' || Array.isArray(source) || ![70, 100, 130].includes(source.fireBudget) || (source.policy!==undefined&&!CIVIC_POLICIES[source.policy]) || !num(source.lastDrillMonth, 0, raw.month, true) || !Array.isArray(source.history) || source.history.length > 12) fail();
      const historyIds = new Set();
      const history = source.history.map(h => {
        if (!h || typeof h.id !== 'string' || !/^drill-\d+-\d+-\d+-\d+$/.test(h.id) || h.id.length > 100 || historyIds.has(h.id) || !num(h.month, 1, raw.month, true) || !num(h.tick, 0, raw.tick, true) || !inBounds(h.x, h.y,mapSize) || !['completed', 'cancelled'].includes(h.status) || typeof h.message !== 'string' || !h.message.length || h.message.length > 180) fail();
        historyIds.add(h.id);
        return { id: h.id, month: h.month, tick: h.tick, x: h.x, y: h.y, status: h.status, message: h.message };
      });
      civic = { fireBudget: source.fireBudget, policy:source.policy||'balanced', lastDrillMonth: source.lastDrillMonth, incident: null, history };
      if (source.incident !== null) {
        const event = source.incident;
        if (!event || event.kind !== 'drill' || !['responding', 'controlling'].includes(event.stage) || !num(event.startedTick, 0, raw.tick, true) || !num(event.startedMonth, 1, raw.month, true) || event.startedMonth !== Math.floor(event.startedTick / 15) + 1 || source.lastDrillMonth !== event.startedMonth || !num(event.targetId, 1, 1e9,true) || !num(event.stationId, 1, 1e9, true) || event.id !== `drill-${event.startedMonth}-${event.startedTick}-${event.stationId}-${event.targetId}` || historyIds.has(event.id) || !inBounds(event.x, event.y,mapSize) || !Array.isArray(event.path) || event.path.length < 1 || event.path.length > mapSize * mapSize * 4) fail();
        const station = cleanBuildings.find(b => b.id === event.stationId && b.type === 'fireStation');
        const target = cleanBuildings.find(b => b.id === event.targetId && PRIVATE.includes(b.type));
        if (!station || !target || target.x !== event.x || target.y !== event.y || new Set(event.path.slice(1).map((i,p)=>`${event.path[p]},${i}`)).size !== event.path.length-1 || event.path.some((i, p) => !num(i, 0, mapSize * mapSize - 1, true) || !cleanTiles[i].road || (p > 0 && Math.abs(i % mapSize - event.path[p - 1] % mapSize) + Math.abs(Math.floor(i / mapSize) - Math.floor(event.path[p - 1] / mapSize)) !== 1))) fail();
        if (!neighbors(station.x, station.y,mapSize).some(([x, y]) => index(x, y,mapSize) === event.path[0]) || !neighbors(target.x, target.y,mapSize).some(([x, y]) => index(x, y,mapSize) === event.path.at(-1))) fail();
        const responseTicks = Math.max(3, Math.ceil(event.path.length / 2));
        const elapsed = raw.tick - event.startedTick;
        const expectedStage = elapsed < responseTicks ? 'responding' : 'controlling';
        const expectedTotal = expectedStage === 'responding' ? responseTicks : 3;
        const expectedRemaining = expectedStage === 'responding' ? responseTicks - elapsed : responseTicks + 3 - elapsed;
        if (event.stage !== expectedStage || event.totalTicks !== expectedTotal || event.remainingTicks !== expectedRemaining || expectedRemaining < 1 || !num(event.progress, 0, 1) || Math.abs(event.progress - (1 - expectedRemaining / expectedTotal)) > 1e-9) fail();
        civic.incident = { id: event.id, kind: 'drill', targetId: event.targetId, stationId: event.stationId, x: event.x, y: event.y, path: [...event.path], stage: event.stage, progress: event.progress, remainingTicks: event.remainingTicks, totalTicks: event.totalTicks, startedTick: event.startedTick, startedMonth: event.startedMonth };
      }
    }
    sim.state = { ...sim.state, mapSize, seed: raw.seed, rng: raw.rng, tick: raw.tick, month: raw.month, money: raw.money, taxRate: raw.taxRate,
      ...(raw.customTerrain!==undefined?{customTerrain:raw.customTerrain}:{}),
      tiles: cleanTiles, buildings: cleanBuildings, nextId: raw.nextId, districtName: raw.districtName, mayorName: raw.mayorName ?? '', cityGoal,
      loan: { taken: raw.loan.taken, remaining: raw.loan.remaining, grace: raw.loan.grace, monthsPaid: raw.loan.monthsPaid },
      bankruptcy:raw.bankruptcy?{tick:raw.bankruptcy.tick,month:raw.bankruptcy.month,money:raw.bankruptcy.money}:null,
      milestones: Object.fromEntries(Object.keys(sim.state.milestones).map(k => [k, raw.milestones[k] ?? (['mature','civic'].includes(k)&&raw.milestones.global===true)])), roadLevelUnlocked:raw.roadLevelUnlocked??legacyRoadLevel, profitableMonths: raw.profitableMonths,
      cityLife, cityIncidents, civic,festivalGames:loadFestivalGames(raw.festivalGames,raw.seed,raw.month),marinaLife:loadMarinaLife(raw.marinaLife,cleanBuildings,raw.month),
      history: Array.isArray(raw.history) ? raw.history.slice(-120).filter(h => h && ['month', 'population', 'money', 'happiness', 'balance'].every(k => num(h[k], k === 'money' || k === 'balance' ? -1e12 : 0, 1e12))).map(h => ({ month: h.month, population: h.population, money: h.money, happiness: h.happiness, balance: h.balance })) : [],
      lastMonthly: raw.lastMonthly && ['month', 'income', 'expenses', 'balance'].every(k => num(raw.lastMonthly[k], k === 'balance' ? -1e12 : 0, 1e12)) ? { month: raw.lastMonthly.month, income: raw.lastMonthly.income, expenses: raw.lastMonthly.expenses, balance: raw.lastMonthly.balance } : null,
    };
    if(raw.interchanges!==undefined){
      if(!Array.isArray(raw.interchanges)||raw.interchanges.length>mapSize*mapSize/9)fail();
      const ids=new Set();
      sim.state.interchanges=raw.interchanges.map(item=>{
        if(!item||typeof item!=='object'||!num(item.x,0,mapSize-1,true)||!num(item.y,0,mapSize-1,true)||!['ns','ew'].includes(item.axis)||ids.has(item.x+','+item.y))fail();
        if((item.width===undefined)!==(item.height===undefined)||item.width!==undefined&&(!num(item.width,3,mapSize,true)||!num(item.height,3,mapSize,true)))fail();
        ids.add(item.x+','+item.y);return {x:item.x,y:item.y,axis:item.axis,...(item.width!==undefined?{width:item.width,height:item.height}:{})};
      });
      if(sim.state.interchanges.some(item=>interchangeGeometryReason(sim.state,item)))fail();
    }
    const hadIncident = !!civic.incident;
    sim._undo = null; sim.recalculate();
    if (hadIncident && !sim.state.civic.incident) fail();
    // Validate the original occupied cells first, then compact obsolete oversized lots.
    // Already compacted 1x1 buildings stay that size so loading never occupies a neighbor.
    let resized=compactFamousSculpturePlots(sim.state);
    for(const b of sim.state.buildings.filter(b=>{
      const size=b.type==='residential'?2:b.type==='commercial'?newBuildingFootprint(b.businessKind):1;
      return (['residential','commercial'].includes(b.type)||b.type==='districtOffice')&&footprintSize(b)>size;
    })){
      const oldSize=footprintSize(b),size=b.type==='residential'?2:b.type==='commercial'?newBuildingFootprint(b.businessKind):1,oldCells=buildingCells(b),area=b.legacyLotArea||oldCells.length;
      const options=oldCells.filter(p=>p.x+size<=b.x+oldSize&&p.y+size<=b.y+oldSize);
      const score=p=>sim._adjacentRoads(p.x,p.y,size).length?2:sim._hasRoadside(p.x,p.y,size)?1:0;
      options.sort((a,b)=>score(b)-score(a));
      for(const c of oldCells){const t=sim.tile(c.x,c.y);t.buildingId=null;t.zone=null;delete t.businessKind;}
      Object.assign(b,options[0]);if(b.type==='districtOffice'&&size===1)delete b.footprint;else b.footprint=size;
      if(['residential','commercial'].includes(b.type))b.legacyLotArea=area;
      for(const c of buildingCells(b)){const t=sim.tile(c.x,c.y);t.buildingId=b.id;t.zone=PRIVATE.includes(b.type)?b.type:null;if(b.businessKind)t.businessKind=b.businessKind;}
      resized=true;
    }
    if(resized)sim.recalculate();
    return sim;
  }
}
