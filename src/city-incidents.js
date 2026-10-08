export const CITY_INCIDENT_TYPES=Object.freeze({
  robbery:{title:'街区抢劫事件',alert:'失业率过高，街区发生抢劫，居民开始担心夜间安全',solution:'增加可达的商业或工业岗位，恢复稳定就业；建设警察局并覆盖街区，降低风险和事件影响',radius:5,duration:2,happinessPenalty:9,migrationPenalty:10,demandPenalty:10,severity:'danger'},
  fire:{title:'建筑失火',alert:'消防覆盖不足，一座建筑发生火灾并暂时影响周边街区',solution:'让消防站接通道路、水电并把覆盖延伸到事发建筑',radius:4,duration:2,happinessPenalty:14,migrationPenalty:14,demandPenalty:9,severity:'danger',targetEfficiency:.45,blockTargetMoveIn:true},
  medical:{title:'社区医疗挤兑',alert:'缺少医疗覆盖，居民就诊延误，社区健康风险上升',solution:'建设或升级诊所、药店、综合医院并覆盖事发住宅',radius:5,duration:2,happinessPenalty:10,migrationPenalty:12,demandPenalty:10,severity:'danger',blockTargetMoveIn:true},
  education:{title:'家庭教育危机',alert:'缺少教育覆盖，适龄家庭开始考虑搬离街区',solution:'建设或升级学校、图书馆并覆盖事发住宅',radius:6,duration:3,happinessPenalty:8,migrationPenalty:11,demandPenalty:8,severity:'warning'},
  culture:{title:'社区文化生活萎缩',alert:'长期缺少图书馆和文化空间，居民对街区归属感下降',solution:'建设图书馆或都会大美术馆，补齐文化服务',radius:7,duration:3,happinessPenalty:5,migrationPenalty:6,demandPenalty:4,severity:'warning'},
  wellness:{title:'居民健康活力下降',alert:'缺少体育设施，居民健康与社区活力持续走低',solution:'建设体育馆、体育场或都会大体育场并覆盖街区',radius:7,duration:3,happinessPenalty:5,migrationPenalty:5,demandPenalty:4,severity:'warning'},
});

const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const occupiedHomes=state=>(state.buildings||[]).filter(b=>b.type==='residential'&&b.population>0&&b.progress>=1&&b.active!==false);
const privateBuildings=state=>(state.buildings||[]).filter(b=>['residential','commercial','industrial'].includes(b.type)&&b.progress>=1&&b.active!==false&&b.connected&&b.powered&&b.watered);
const weightedShare=(homes,predicate)=>{const total=homes.reduce((sum,b)=>sum+b.population,0),missing=homes.filter(predicate).reduce((sum,b)=>sum+b.population,0);return {total,missing,share:total?missing/total:0};};
const targetScore=(kind,b)=>kind==='fire'?(b.population||0)+(b.workers||0)*2+(b.jobs||0):kind==='robbery'?Math.max(1,b.population)*(1-(b.workers||0)/Math.max(1,Math.floor(b.population*.55))):b.population||0;
const hashRoll=(state,kind,month,salt=0)=>{
  let h=((state.seed||1)^Math.imul(month+17,0x9e3779b1)^Math.imul(salt+31,0x85ebca6b))>>>0;
  for(let i=0;i<kind.length;i++){h=Math.imul(h^kind.charCodeAt(i),16777619)>>>0;h^=h>>>13;}
  return (h>>>0)/4294967296;
};
const pickTarget=(state,kind,candidates)=>[...candidates].sort((a,b)=>targetScore(kind,b)-targetScore(kind,a)||hashRoll(state,kind,state.month,b.id)-hashRoll(state,kind,state.month,a.id)||a.id-b.id).at(-1)||null;

export function ensureCityIncidents(state){
  if(state.cityIncidents===undefined)state.cityIncidents={active:[],history:[]};
  return state.cityIncidents;
}

export function refreshCityIncidents(state){
  const incidents=ensureCityIncidents(state);
  if(!Array.isArray(incidents.active)||!Array.isArray(incidents.history))return incidents;
  const buildings=new Set((state.buildings||[]).map(b=>b.id)),active=[];
  for(const event of incidents.active){
    const expired=event.expiresMonth<=state.month,cleared=!buildings.has(event.targetId);
    if(!expired&&!cleared){active.push(event);continue;}
    incidents.history.push({...event,endedMonth:state.month,status:cleared?'site-cleared':'expired'});
  }
  incidents.active=active;incidents.history=incidents.history.slice(-24);
  return incidents;
}

export function incidentRisks(state){
  const incidents=ensureCityIncidents(state),homes=occupiedHomes(state),population=state.stats?.population??homes.reduce((sum,b)=>sum+b.population,0),risks=[];
  if(population<100||!homes.length)return risks;
  const add=(kind,candidates,pressure,probability,reason)=>{const target=pickTarget(state,kind,candidates);if(target)risks.push({kind,targetId:target.id,x:target.x,y:target.y,pressure:clamp(pressure),probability:clamp(probability,.05,.92),reason});};
  const employmentRate=state.stats?.employmentRate??100,unemployment=1-employmentRate/100;
  if(population>=200&&employmentRate<80){
    const coverage=1-weightedShare(homes,b=>!b.services?.policeStation).share;
    add('robbery',homes.filter(b=>!b.services?.policeStation).length?homes.filter(b=>!b.services?.policeStation):homes,unemployment*(1-coverage*.7),(unemployment>=.35?.82:.30+unemployment)*(1-coverage*.7),`失业率 ${Math.round(unemployment*100)}% · 治安覆盖 ${Math.round(coverage*100)}%`);
  }
  const uncovered=privateBuildings(state).filter(b=>!b.fireCovered),protectedPrivate=privateBuildings(state);
  if(population>=500&&uncovered.length){const share=uncovered.length/Math.max(1,protectedPrivate.length);if(share>=.25)add('fire',uncovered,share,.22+share*.58,`未获消防覆盖建筑 ${uncovered.length} / ${protectedPrivate.length}`);}
  for(const [kind,service,minPopulation,base] of [['medical','clinic',500,.26],['education','school',800,.21],['culture','library',2000,.14],['wellness','sportsHall',3000,.14]]){
    if(population<minPopulation)continue;
    const missing=weightedShare(homes,b=>!b.services?.[service]);
    if(missing.share>=.35)add(kind,homes.filter(b=>!b.services?.[service]),missing.share,base+missing.share*.55,`${Math.round(missing.share*100)}% 居民未获${({clinic:'医疗',school:'教育',library:'文化',sportsHall:'体育'})[service]}覆盖`);
  }
  return risks.filter(r=>!incidents.active.some(event=>event.kind===r.kind));
}

export function createCityIncident(state,kind,targetId){
  const type=CITY_INCIDENT_TYPES[kind],incidents=ensureCityIncidents(state),target=(state.buildings||[]).find(b=>b.id===targetId);
  if(!type||!target||incidents.active.length>=1||incidents.active.some(event=>event.kind===kind))return null;
  const startedMonth=state.month,id=`incident-${kind}-${startedMonth}-${target.id}`;
  const event={id,kind,targetId:target.id,x:target.x,y:target.y,startedMonth,expiresMonth:startedMonth+type.duration};
  incidents.active.push(event);return event;
}

export function advanceCityIncidents(state){
  const incidents=refreshCityIncidents(state);
  if(!Array.isArray(incidents.active)||incidents.active.length>=1)return null;
  const lastMonth=kind=>Math.max(0,...incidents.active.filter(e=>e.kind===kind).map(e=>e.startedMonth),...incidents.history.filter(e=>e.kind===kind).map(e=>e.startedMonth));
  const lastAny=Math.max(0,...incidents.active.map(e=>e.startedMonth),...incidents.history.map(e=>e.startedMonth));
  if(state.month-lastAny<5)return null;
  const eligible=incidentRisks(state).filter(r=>!lastMonth(r.kind)||state.month-lastMonth(r.kind)>=12).map(r=>({...r,roll:hashRoll(state,r.kind,state.month,r.targetId)})).filter(r=>r.roll<r.probability);
  eligible.sort((a,b)=>(b.pressure+b.probability-b.roll)-(a.pressure+a.probability-a.roll)||a.kind.localeCompare(b.kind));
  const selected=eligible[0];return selected?createCityIncident(state,selected.kind,selected.targetId):null;
}

export function buildingIncidentEffects(state,b){
  const effects={happinessPenalty:0,migrationPenalty:0,efficiency:1,moveInBlocked:false,kinds:[]};
  for(const event of ensureCityIncidents(state).active||[]){
    const type=CITY_INCIDENT_TYPES[event.kind];if(!type)continue;
    const distance=Math.hypot(b.x-event.x,b.y-event.y);if(distance>type.radius)continue;
    const weight=Math.max(.45,1-distance/(type.radius*1.8))*(event.kind==='robbery'&&b.services?.policeStation ? .5 : 1);effects.kinds.push(event.kind);
    if(b.type==='residential'){
      effects.happinessPenalty+=Math.round(type.happinessPenalty*weight);
      effects.migrationPenalty+=Math.round(type.migrationPenalty*weight);
      if(type.blockTargetMoveIn&&event.targetId===b.id)effects.moveInBlocked=true;
    }
    if(event.targetId===b.id&&type.targetEfficiency)effects.efficiency=Math.min(effects.efficiency,type.targetEfficiency);
  }
  effects.happinessPenalty=Math.min(28,effects.happinessPenalty);effects.migrationPenalty=Math.min(30,effects.migrationPenalty);return effects;
}

export const cityIncidentDemandPenalty=state=>Math.min(25,(ensureCityIncidents(state).active||[]).reduce((sum,event)=>sum+(CITY_INCIDENT_TYPES[event.kind]?.demandPenalty||0),0));
export const incidentAlert=event=>{const type=CITY_INCIDENT_TYPES[event.kind];return type?{text:`${type.title}：${type.alert}。${type.solution}`,severity:type.severity,x:event.x,y:event.y,incidentId:event.id}:null;};
export const incidentTitle=kind=>CITY_INCIDENT_TYPES[kind]?.title||'城市风险事件';
