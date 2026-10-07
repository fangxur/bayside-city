import {CitySimulation,TOOLS} from './simulation.js';
import {BUSINESS_KINDS} from './business-kinds.js';
import {MAX_MAP_SIZE,gridIndex,inGrid,mapSize} from './grid.js';

export const CITY_METHODS=new Set(['build','rotateBuilding','setBuildingActive','upgradeAllRoads','setTax','takeLoan','setCityIdentity','claimFestivalPoints','redeemFestivalReward','enterDragonRace','resolveCityEvent','setFireBudget','setCivicPolicy','startFireDrill']);
export const OWNER_METHODS=new Set(['setTax','takeLoan','setCityIdentity','setFireBudget','setCivicPolicy']);
export const EDIT_METHODS=new Set(['build','rotateBuilding','upgradeAllRoads']);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const point=p=>p&&int(p.x,0,MAX_MAP_SIZE-1)&&int(p.y,0,MAX_MAP_SIZE-1);
export function validateCommand(method,args){
 if(!CITY_METHODS.has(method)||!Array.isArray(args))throw Error('不支持的城市操作');
 const [a,b,c]=args;let valid=false;
 switch(method){
 case 'build':valid=args.length===3&&(Object.hasOwn(TOOLS,a)||Object.hasOwn(BUSINESS_KINDS,a))&&Array.isArray(b)&&b.length>0&&b.length<=MAX_MAP_SIZE**2&&b.every(point)&&c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).every(k=>['buildingId','roadSource','roadsOnly'].includes(k))&&(c.buildingId==null||int(c.buildingId,1,1e9))&&(c.roadSource==null||point(c.roadSource))&&(c.roadsOnly===undefined||typeof c.roadsOnly==='boolean')&&(a!=='move'||((c.buildingId!=null)!==(c.roadSource!=null)));break;
 case 'rotateBuilding':valid=args.length===2&&int(a,1,1e9)&&[-1,1].includes(b);break;
 case 'setBuildingActive':valid=args.length===2&&int(a,1,1e9)&&typeof b==='boolean';break;
 case 'setTax':valid=args.length===1&&int(a,6,15);break;
 case 'setFireBudget':valid=args.length===1&&[70,100,130].includes(a);break;
 case 'setCivicPolicy':valid=args.length===1&&['balanced','livability','development'].includes(a);break;
 case 'setCityIdentity':valid=args.length===1&&a&&typeof a.cityName==='string'&&a.cityName.trim().length>0&&a.cityName.length<=24&&typeof a.mayorName==='string'&&a.mayorName.length<=24;break;
 case 'redeemFestivalReward':valid=args.length===1&&typeof a==='string'&&a.length<80;break;
 case 'enterDragonRace':valid=args.length===2&&int(a,0,2)&&int(b,0,10000);break;
 case 'resolveCityEvent':valid=args.length===2&&typeof a==='string'&&a.length<240&&b&&typeof b==='object'&&JSON.stringify(b).length<2048;break;
 default:valid=args.length===0;
 }
 if(!valid)throw Error('城市操作参数不正确');
}
export function hydrateCity(state){const sim=Object.create(CitySimulation.prototype);sim.state=structuredClone(state);sim.state.mapSize=mapSize(sim.state);sim._undo=null;return sim;}
export function executeCityCommand(sim,method,args){validateCommand(method,args);return sim[method](...args)||{ok:true,message:'城市设置已更新'};}
const buildingKey=b=>b?[b.id,b.x,b.y,b.type,b.businessKind,b.footprint||1,b.level,b.rotation||0,b.active,b.progress>=1]:null;
const tileKey=t=>t?[t.x,t.y,t.road,t.zone,t.buildingId,t.bridge||false,t.businessKind||null]:null;
// Explicit edit dependencies allow unrelated neighbourhoods to be edited concurrently.
// Rules such as funds, roadside placement and prerequisites are checked again at commit.
export function commandGuard(sim,method,args){
 validateCommand(method,args);const s=sim.state,[a,b,c]=args;let guard;
 if(method==='build'){
  const preview=sim.preview(a,b,c),cells=[...b,...(preview.cells||[])];if(c.roadSource)cells.push(c.roadSource);
  const ids=new Set(cells.map(p=>sim.tile(p.x,p.y)?.buildingId));if(c.buildingId)ids.add(c.buildingId);
  const buildings=s.buildings.filter(v=>ids.has(v.id));
  for(const v of buildings)for(let y=v.y;y<v.y+(v.footprint||1);y++)for(let x=v.x;x<v.x+(v.footprint||1);x++)cells.push({x,y});
  const indices=[...new Set(cells.filter(p=>point(p)&&inGrid(s,p.x,p.y)).map(p=>gridIndex(s,p.x,p.y)))].sort((x,y)=>x-y);
  guard=[indices.map(i=>tileKey(s.tiles[i])),buildings.map(buildingKey).sort((x,y)=>x[0]-y[0])];
 }else if(['rotateBuilding','setBuildingActive'].includes(method))guard=buildingKey(s.buildings.find(v=>v.id===a));
 else if(method==='upgradeAllRoads')guard=[s.tiles.filter(t=>t.road).map(tileKey),s.roadLevelUnlocked,s.stats.population];
 else if(method==='setTax')guard=s.taxRate;
 else if(method==='takeLoan')guard=s.loan;
 else if(method==='setCityIdentity')guard=[s.districtName,s.mayorName];
 else if(method==='setFireBudget')guard=s.civic.fireBudget;
 else if(method==='setCivicPolicy')guard=s.civic.policy;
 else if(method==='startFireDrill')guard=[s.month,s.civic.lastDrillMonth,s.civic.incident];
 else if(method==='resolveCityEvent')guard=[s.month,s.cityLife];
 else guard=[s.month,s.festivalGames];
 return JSON.stringify(guard);
}
export function commandChanges(before,after){
 const old=new Map(before.buildings.map(b=>[b.id,b])),next=new Map(after.buildings.map(b=>[b.id,b]));
 const buildings=[...new Set([...old.keys(),...next.keys()])].filter(id=>JSON.stringify(buildingKey(old.get(id)))!==JSON.stringify(buildingKey(next.get(id)))).map(id=>({id,before:buildingKey(old.get(id)),after:buildingKey(next.get(id))}));
 const cells=after.tiles.filter((t,i)=>JSON.stringify(tileKey(t))!==JSON.stringify(tileKey(before.tiles[i]))).map(t=>({x:t.x,y:t.y}));
 for(const b of buildings)for(const v of [b.before,b.after])if(v&&!cells.some(c=>c.x===v[1]&&c.y===v[2]))cells.push({x:v[1],y:v[2]});
 return {buildings,cells,moneyDelta:after.money-before.money};
}
export function commandLabel(method,args){
 const names={rotateBuilding:'旋转建筑',setBuildingActive:args[1]?'启用设施':'暂停设施',upgradeAllRoads:'升级全部道路',setTax:'调整税率',takeLoan:'申请城市贷款',setCityIdentity:'更新城市档案',claimFestivalPoints:'领取节庆积分',redeemFestivalReward:'调整节庆装饰',enterDragonRace:'参加龙舟活动',resolveCityEvent:'支持街坊活动',setFireBudget:'调整消防预算',setCivicPolicy:'调整市政方针',startFireDrill:'开展消防演练'};
 if(method==='build')return args[0]==='move'?(args[2]?.roadSource?'移动道路':'移动建筑'):({upgrade:'升级建筑或道路',bulldoze:'拆除建设'})[args[0]]||'建设'+(BUSINESS_KINDS[args[0]]?.name||TOOLS[args[0]]?.name||args[0]);
 return names[method]||method;
}
