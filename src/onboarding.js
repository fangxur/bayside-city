import {buildingCells,newBuildingFootprint} from './building-footprint.js';
import {BUSINESS_KINDS} from './business-kinds.js';
import {COMMERCIAL_FACTORIES,commercialPrerequisite} from './commercial-prerequisites.js';

const adjacent=p=>[{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1},{x:p.x-1,y:p.y}];
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const ready=b=>b.active&&b.connected&&b.powered&&b.watered&&b.progress>=1;
const point=b=>({x:b.x,y:b.y});
export const ONBOARDING_STEPS=[
  ['road','延伸入口道路'],['power','让供电站运行'],['water','接通供水'],
  ['housing','规划第一片住宅'],['arrival','迎接居民入住'],['work','准备岗位与货源'],
  ['shop','开一家街坊小店'],['life','认识一位街坊'],
];

// Progress is local UI metadata. All construction checks come from the city itself.
export function onboardingProgress(saved,{fresh=false}={}){
  return {status:['active','skipped','complete'].includes(saved?.status)?saved.status:fresh?'active':'skipped',metCitizen:saved?.metCitizen===true};
}

function roadSuggestion(sim,roads,needed){
  const start={x:8,y:32},seen=new Set();
  let frontier=roads.flatMap(adjacent).filter(p=>{const t=sim.tile(p.x,p.y),key=p.x+','+p.y;if(seen.has(key)||!t||t.terrain!=='land'||t.road||t.zone||t.buildingId!==null)return false;seen.add(key);return true;});
  frontier.sort((a,b)=>distance(a,start)-distance(b,start));
  for(const first of frontier){
    const cells=[first],visited=new Set([first.x+','+first.y]);
    while(cells.length<needed){
      const next=adjacent(cells.at(-1)).filter(p=>{const t=sim.tile(p.x,p.y);return t&&t.terrain==='land'&&!t.road&&!t.zone&&t.buildingId===null&&!visited.has(p.x+','+p.y);}).sort((a,b)=>distance(a,{x:14,y:32})-distance(b,{x:14,y:32}))[0];
      if(!next)break;cells.push(next);visited.add(next.x+','+next.y);
    }
    if(cells.length===needed&&sim.preview('road',cells).valid)return cells;
  }
  return [];
}

function placementSuggestion(sim,tool,roads){
  const size=newBuildingFootprint(tool),seen=new Set(),candidates=[];
  const homes=sim.state.buildings.filter(b=>b.type==='residential');
  const anchor=tool==='power'?{x:2,y:31}:tool==='water'?{x:4,y:31}:tool==='foodFactory'?{x:2,y:33}:{x:12,y:31};
  for(const road of roads)for(const edge of adjacent(road))for(let dx=0;dx<size;dx++)for(let dy=0;dy<size;dy++){
    const p={x:edge.x-dx,y:edge.y-dy},key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);
    const t=sim.tile(p.x,p.y);if(!t||t.road||t.zone||t.buildingId!==null||t.terrain!=='land')continue;
    if(!sim.preview(tool,[p]).valid)continue;
    const penalty=tool==='foodFactory'?homes.reduce((n,b)=>n+Math.max(0,7-distance(p,b))*12,0):(t.pollution||0)*2;
    candidates.push({...p,score:distance(p,anchor)+penalty});
  }
  candidates.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
  return candidates[0]&&point(candidates[0]);
}

function buildStep(sim,step,tool,roads,description){
  const target=placementSuggestion(sim,tool,roads);
  const price=BUSINESS_KINDS[tool]?.cost??({power:2500,water:1500,residential:120,foodFactory:240})[tool];
  if(!target)return {...step,description,status:Number.isFinite(price)&&sim.state.money<price?'资金不足，先看看财政与可用资金。':'现有道路旁没有合适空地，先延长一段连通道路。',action:{kind:Number.isFinite(price)&&sim.state.money<price?'budget':'build',tool:'road',label:Number.isFinite(price)&&sim.state.money<price?'查看财政':'选择道路'},hint:null};
  const cells=buildingCells({...target,footprint:newBuildingFootprint(tool)});
  return {...step,description,status:'光框是推荐位置，也可以选择其他合适空地。',action:{kind:'build',tool,target,label:'选择并放置'},hint:{cells,target,label:'推荐位置 · '+(BUSINESS_KINDS[tool]?.name||({power:'供电站',water:'水塔',residential:'住宅'})[tool])}};
}

function inspectStep(sim,step,site,description){
  const info=sim.getInfo(site.x,site.y),b=sim.state.buildings.find(b=>b.id===sim.tile(site.x,site.y).buildingId);
  const blocked=!site.connected||!site.powered||!site.watered||(b&&!b.active)||(!b&&(sim.state.stats.demand[site.zone]<12||site.zone==='commercial'&&!commercialPrerequisite(sim.state,site.businessKind).allowed));
  const waiting=!blocked;
  return {...step,description,status:waiting?(b&&b.progress<1?`施工中 · ${Math.round(b.progress*100)}%，建好后会自动投入使用。`:b?'房屋已建好，正在等待居民搬入。':'等待开发商开工，接下来会自动施工。'):(info.problem||'检查道路与水电是否正常。'),
    waiting,progress:b&&b.progress<1?Math.round(b.progress*100):null,
    action:{kind:waiting?'resume':'inspect',target:point(site),label:waiting?'继续模拟':'定位并查看原因'},
    hint:{target:point(site),cells:buildingCells(b||site),label:waiting?'这里正在发展':'这里需要处理'}};
}

export function getOnboarding(sim,progress={}){
  const {state}=sim,s=state.stats,roads=state.tiles.filter(t=>t.road&&t.connected);
  const extension=roads.filter(t=>!(t.y===32&&t.x<=7)).length;
  const homes=state.buildings.filter(b=>b.type==='residential');
  const homeSites=state.tiles.filter(t=>t.zone==='residential'&&t.buildingId===null);
  const factories=state.buildings.filter(b=>b.type==='industrial'&&Object.values(COMMERCIAL_FACTORIES).includes(b.businessKind));
  const supplier=factories.find(b=>ready(b)&&b.jobs>0);
  const shops=state.buildings.filter(b=>b.type==='commercial');
  const shopSites=state.tiles.filter(t=>t.zone==='commercial'&&t.buildingId===null);
  const done=[extension>=6,s.powerCapacity>0,s.waterCapacity>0,homes.length+homeSites.length>0,s.population>0,!!supplier,shops.some(ready),!!progress.metCitizen];
  const steps=ONBOARDING_STEPS.map(([id,label],i)=>({id,label,done:done[i]}));
  const index=done.indexOf(false);
  if(index===-1)return {steps,index:8,id:'complete',title:'这片街区，已经有了生活',description:'道路、水电、住家与商店都已运转。街坊故事里还可以查看赴约、购物和回家的路线。',status:'接下来，按自己的节奏继续建设。',action:{kind:'finish',label:'开始自由建设'},hint:null};
  const step={steps,index,id:steps[index].id,title:steps[index].label,waiting:false};
  if(index===0){
    const cells=roadSuggestion(sim,roads,6-extension),target=cells[0]||point(roads.at(-1)||{x:7,y:32});
    return {...step,description:'从已有道路的尽头接出 6 格道路，给水电和住宅留出位置。',status:`已接通 ${Math.min(6,extension)} / 6 格 · 按住拖动铺路，也可以逐格点击。`,action:{kind:'build',tool:'road',target,label:'定位入口并选道路'},hint:cells.length?{cells,target,label:'从这里接路 · 光框为建议方向'}:null};
  }
  if(index===1||index===2){
    const type=index===1?'power':'water',description=index===1?'供电站接上城外道路后，就能向全城供电，无需另铺电线。':'水塔也要临路，并由供电站供电；无需另铺水管。';
    const existing=state.buildings.filter(b=>b.type===type).sort((a,b)=>Number(b.connected)-Number(a.connected))[0];
    return existing?inspectStep(sim,step,existing,description):buildStep(sim,step,type,roads,description);
  }
  if(index===3)return buildStep(sim,step,'nordic',roads,'在道路旁规划住宅。先从一栋开始，接通水电后房屋会自动生长。');
  if(index===4){
    const sites=[...homes,...homeSites].sort((a,b)=>Number(b.connected&&b.powered&&b.watered)-Number(a.connected&&a.powered&&a.watered)||((b.progress||0)-(a.progress||0)));
    const result=inspectStep(sim,step,sites[0],'住宅要经过开工、施工和搬入三个阶段。引导会自动以 3 倍速等待，也可用顶部按钮调整。');
    if(result.waiting&&homes.some(ready)&&state.tick>90&&s.jobs<=s.employed){
      const site=factories[0]||state.tiles.find(t=>t.zone==='industrial'&&t.buildingId===null&&Object.values(COMMERCIAL_FACTORIES).includes(t.businessKind));
      const description='起步迁入期已过，居民正在等待工作机会。先建设食品加工厂，运行后居民就能搬来。';
      return site?inspectStep(sim,step,site,description):buildStep(sim,step,'foodFactory',roads,description);
    }
    else if(result.waiting&&homes.some(b=>ready(b)&&b.happiness<42)){result.waiting=false;result.status='住宅满意度偏低，暂时没有居民愿意搬入。点击查看环境与服务。';result.action.kind='inspect';result.action.label='查看住宅';}
    return result;
  }
  if(index===5){
    const description='食品加工厂提供岗位，也为生鲜市场等商店准备货源。工厂尽量与住宅保持距离。';
    const site=factories[0]||state.tiles.find(t=>t.zone==='industrial'&&t.buildingId===null&&Object.values(COMMERCIAL_FACTORIES).includes(t.businessKind));
    return site?inspectStep(sim,step,site,description):buildStep(sim,step,'foodFactory',roads,description);
  }
  if(index===6){
    const description='工厂运行后，对应商店就能开业。这里为你选择已具备货源的店铺。';
    const site=shops[0]||shopSites[0];if(site)return inspectStep(sim,step,site,description);
    const kind=Object.keys(COMMERCIAL_FACTORIES).find(k=>commercialPrerequisite(state,k).allowed);
    return buildStep(sim,step,kind,roads,description);
  }
  return {...step,description:'认识住在这里的人，听听他的生活小事，再从故事里看看这次出门的路线。',status:'点街上的行人，或点下面的按钮。',action:{kind:'citizen',label:'和街坊聊聊'},hint:null};
}

// Manual clock controls and shared-city clocks always take precedence.
export function onboardingClock(step,{automatic,shared=false}){
  if(!automatic||shared)return null;
  if(step.waiting||step.index>=4)return {paused:false,speed:3};
  return {paused:true,speed:1};
}
