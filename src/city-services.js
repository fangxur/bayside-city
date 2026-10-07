import {requiresRoad} from './building-access.js';
import { buildingCells } from './building-footprint.js';
import { maintenanceMultiplier } from './progression.js';
import {gridIndex,gridNeighbors} from './grid.js';

const PRIVATE_TYPES = ['residential', 'commercial', 'industrial'];
const neighbors = (state,x,y) => gridNeighbors(state,x,y).map(([nextX,nextY])=>gridIndex(state,nextX,nextY));

export const FIRE_BUDGETS = {
  70: { value: 70, label: '省预算', range: 8, monthlyCost: 84 },
  100: { value: 100, label: '标准', range: 14, monthlyCost: 120 },
  130: { value: 130, label: '加强', range: 20, monthlyCost: 156 },
};

export const CIVIC_POLICIES={
 balanced:{id:'balanced',label:'均衡治理',happinessBonus:2,publicCostMultiplier:1,businessTaxMultiplier:1,demandBoost:0,description:'市政覆盖住宅满意度 +2，公共服务按标准成本运行'},
 livability:{id:'livability',label:'民生优先',happinessBonus:4,publicCostMultiplier:1.12,businessTaxMultiplier:1,demandBoost:0,description:'市政覆盖住宅满意度 +4；公共设施运行与工资支出 +12%'},
 development:{id:'development',label:'招商促进',happinessBonus:1,publicCostMultiplier:1,businessTaxMultiplier:1.08,demandBoost:10,description:'商业、工业需求 +10，经营税 +8%；市政覆盖住宅满意度 +1'},
};

export const civicBuildingReady = building => !!building && building.active && (building.connected || !requiresRoad(building.type)) && building.powered && building.watered && building.progress >= 1;
export const civicServiceReady=(state,building)=>civicBuildingReady(building)&&(building.type!=='districtOffice'||state.buildings.some(b=>b.type==='cityHall'&&civicBuildingReady(b)));
export const activeCivicPolicy=state=>state.buildings.some(b=>b.type==='cityHall'&&civicBuildingReady(b))?CIVIC_POLICIES[state.civic.policy]||CIVIC_POLICIES.balanced:null;
export function fireRange(state, station) {
  const hallLevel = Math.max(1, ...state.buildings.filter(b => b.type === 'cityHall' && civicBuildingReady(b)).map(b => b.level || 1));
  return FIRE_BUDGETS[state.civic.fireBudget].range + ((station.level || 1) - 1) * 3 + (hallLevel - 1) * 2;
}

function roadSearch(state, station, range) {
  const distance = new Map(), previous = new Map(), queue = [];
  for (const i of neighbors(state,station.x, station.y)) {
    if (!state.tiles[i]?.road || !state.tiles[i].connected) continue;
    distance.set(i, 0); queue.push(i);
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor], tile = state.tiles[current], d = distance.get(current);
    if (d >= range) continue;
    for (const i of neighbors(state,tile.x, tile.y)) {
      if (!state.tiles[i]?.road || !state.tiles[i].connected || distance.has(i)) continue;
      distance.set(i, d + 1); previous.set(i, current); queue.push(i);
    }
  }
  return { station, distance, previous };
}

function searches(state) {
  return state.buildings.filter(b => b.type === 'fireStation' && civicBuildingReady(b)).map(station => roadSearch(state, station, fireRange(state, station)));
}

function nearestRoad(state,target, search) {
  let best = null;
  for (const i of new Set(buildingCells(target).flatMap(c=>neighbors(state,c.x,c.y)))) {
    const distance = search.distance.get(i);
    if (distance !== undefined && (!best || distance < best.distance || (distance === best.distance && i < best.index))) best = { index: i, distance };
  }
  return best;
}

export function calculateCivicServices(state) {
  const policy = FIRE_BUDGETS[state.civic.fireBudget],administration=activeCivicPolicy(state),costMultiplier=administration?.publicCostMultiplier||1;
  const working = searches(state);
  for (const tile of state.tiles) {tile.fireCoverage = 0;tile.fireServiceLevel=0;}
  for (const search of working) {
    for (const index of search.distance.keys()) {
      const tile = state.tiles[index]; tile.fireCoverage = 100;tile.fireServiceLevel=Math.max(tile.fireServiceLevel,search.station.level||1);
      for (const i of neighbors(state,tile.x, tile.y)) if (state.tiles[i].terrain === 'land' && !state.tiles[i].road) {state.tiles[i].fireCoverage = 100;state.tiles[i].fireServiceLevel=Math.max(state.tiles[i].fireServiceLevel,search.station.level||1);}
    }
  }
  let servicePopulation = 0, coveredPopulation = 0;
  for (const b of state.buildings) {
    b.fireServiceLevel=b.connected?Math.max(0,...working.filter(search=>nearestRoad(state,b,search)!==null).map(search=>search.station.level||1)):0;
    b.fireCovered = b.fireServiceLevel>0;
    if (b.type === 'residential') {
      servicePopulation += b.population;
      if (b.fireCovered) coveredPopulation += b.population;
    }
  }
  const stations = state.buildings.filter(b => b.type === 'fireStation');
  const halls = state.buildings.filter(b => b.type === 'cityHall');
  const fireMonthlyCost = stations.reduce((sum, b) => sum + policy.monthlyCost * maintenanceMultiplier(b) * (b.active ? 1 : 0.15), 0)*costMultiplier;
  const hallMonthlyCost = halls.reduce((sum, b) => sum + 80 * maintenanceMultiplier(b) * (b.active ? 1 : 0.15), 0)*costMultiplier;
  return {
    hallReady: halls.some(civicBuildingReady), stations: working.length, totalStations: stations.length,
    coverage: servicePopulation ? Math.round(coveredPopulation / servicePopulation * 100) : 0,
    coveredPopulation, servicePopulation, range: Math.max(policy.range, ...working.map(s => fireRange(state, s.station))),
    monthlyCost: Math.round((fireMonthlyCost + hallMonthlyCost) * 10) / 10,
    fireMonthlyCost: Math.round(fireMonthlyCost * 10) / 10,policy:state.civic.policy,policyEffect:administration||null,
  };
}

export function planFireDrill(state) {
  if (!state.buildings.some(b => b.type === 'cityHall' && civicBuildingReady(b))) return { ready: false, reason: '先建设并启用有道路、水电的市政府' };
  if (state.civic.incident) return { ready: false, reason: '消防演练正在进行，请等待本次演练结束' };
  if (state.civic.lastDrillMonth >= state.month) return { ready: false, reason: '本月已经安排过消防演练，下个模拟月可再次发起' };
  const working = searches(state);
  if (!working.length) return { ready: false, reason: '需要一座启用且道路、水电正常的消防站' };
  let best = null;
  for (const target of state.buildings) {
    if (!PRIVATE_TYPES.includes(target.type) || !civicBuildingReady(target) || (target.type === 'residential' && target.population <= 0)) continue;
    let response = null;
    for (const search of working) {
      const road = nearestRoad(state,target, search);
      if (road && (!response || road.distance < response.road.distance || (road.distance === response.road.distance && search.station.id < response.search.station.id))) response = { search, road };
    }
    if (response && (!best || response.road.distance > best.response.road.distance || (response.road.distance === best.response.road.distance && target.id < best.target.id))) best = { target, response };
  }
  if (!best) return { ready: false, reason: '消防站覆盖范围内没有可演练的已使用私人建筑；请接通道路或扩大消防覆盖' };
  const path = [best.response.road.index]; let current = path[0];
  while (best.response.search.previous.has(current)) { current = best.response.search.previous.get(current); path.push(current); }
  return { ready: true, reason: '', target: best.target, station: best.response.search.station, path: path.reverse(), distance: best.response.road.distance };
}

export function validateFireDrill(state, incident) {
  const station = state.buildings.find(b => b.id === incident.stationId && b.type === 'fireStation');
  const target = state.buildings.find(b => b.id === incident.targetId && PRIVATE_TYPES.includes(b.type));
  if (!station) return '消防站已被拆除，演练中止';
  if (!civicBuildingReady(station)) return '消防站已暂停或失去道路、水电，演练中止';
  if (!target) return '演练目标已被拆除，演练中止';
  if (!civicBuildingReady(target) || (target.type === 'residential' && !target.population)) return '演练目标已失去服务或居民，演练中止';
  if (incident.path.some(i => !state.tiles[i]?.road || !state.tiles[i].connected)) return '响应道路已中断，演练中止；修复后可在下个模拟月再试';
  const reach = roadSearch(state, station, fireRange(state, station));
  if (!nearestRoad(state,target, reach)) return '目标超出当前消防预算的覆盖范围，演练中止';
  return '';
}

export function fireStationCells(state,station){
  if(!civicBuildingReady(station))return [];
  const found=new Set();
  for(const i of roadSearch(state,station,fireRange(state,station)).distance.keys()){
    found.add(i);const t=state.tiles[i];
    for(const n of neighbors(state,t.x,t.y))if(state.tiles[n].terrain==='land'&&!state.tiles[n].road)found.add(n);
  }
  return [...found];
}

export function cityHallRequirement(buildings) {
  const hall=buildings.find(b=>b.type==='cityHall');
  if(!hall)return {met:false,exists:false,label:'市政府正常办公',detail:'尚未建设 · 造价 ¥3,000，月维护 ¥80'};
  const missing=[];
  if(hall.progress<1)missing.push('等待施工完成');
  if(!hall.active)missing.push('启用市政府');
  if(!hall.connected)missing.push('接通对外道路');
  if(!hall.powered)missing.push('恢复供电');
  if(!hall.watered)missing.push('恢复供水');
  return {met:missing.length===0,exists:true,label:'市政府正常办公',detail:missing.length?missing.join('、'):'市政方针、住宅覆盖与消防调度已开放'};
}
