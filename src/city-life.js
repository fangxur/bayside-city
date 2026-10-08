import {requiresRoad} from './building-access.js';
import {YACHT_TYPES} from './marina.js';
// Street-level stories are a read-only view of the simulation. No story uses
// Math.random or the city's evolution RNG, so inspecting people cannot change it.
import {businessKind} from './business-kinds.js';
import {COMMUNITY_BUILDINGS} from './community-buildings.js';
import {NEIGHBORHOOD_ACTIVITIES} from './neighborhood-activities.js';
import {festivalForMonth} from './festivals.js';
import {residentCommute,residentJourney} from './resident-journeys.js';
import {residentVignette} from './resident-stories.js';
import {gridIndex,mapSize} from './grid.js';
const TRAFFIC_COMPLAINT_COMMUTE_MINUTES = 15;
const hash = text => {
  let n = 2166136261;
  for (const char of String(text)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
};
const point = (state,value) => value && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= -0.5 && value.x < mapSize(state) - 0.5 && value.y >= -0.5 && value.y < mapSize(state) - 0.5;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => distance(a, b) < 0.8;
const tileAt = (state, p) => state.tiles[gridIndex(state,Math.round(p.x),Math.round(p.y))];
const pick = (items, seed) => items[seed % items.length];
const surname = ['林', '陈', '许', '周', '何', '叶', '吴', '程', '顾', '沈', '余', '苏'];
const givenName = ['晓雨', '一帆', '小满', '知远', '清禾', '晨', '安宁', '向阳', '映秋', '小川', '若林', '乐予'];
const residentName = seed => surname[seed % surname.length] + givenName[Math.floor(seed / surname.length) % givenName.length];
const socialReady = b => b.active && b.progress>=1 && (b.connected || !requiresRoad(b.type)) && b.powered && b.watered;

function neighborhoodActivity(state,home,homes,seed){
  if(!socialReady(home))return null;
  const neighbors=homes.filter(b=>b.id!==home.id&&socialReady(b)&&distance(b,home)<=8).sort((a,b)=>a.id-b.id);
  if(!neighbors.length)return null;
  const festival=festivalForMonth(state.month);
  const venues=state.buildings.filter(b=>b.active&&b.progress>=1&&distance(b,home)<=10&&
    (['park','plaza'].includes(b.type)||socialReady(b))).sort((a,b)=>a.id-b.id);
  const options=[];
  for(const venue of venues){
    const companions=neighbors.filter(n=>distance(n,venue)<=10);
    if(!companions.length)continue;
    for(const activity of NEIGHBORHOOD_ACTIVITIES){
      if(activity.festival&&activity.festival!==festival?.id)continue;
      if(!activity.venues.includes(venue.businessKind||venue.type))continue;
      options.push({venue,companions,activity});
    }
  }
  if(!options.length)return null;
  const rotation=(seed+(state.month||0))>>>0;
  const festive=options.filter(o=>o.activity.festival),ordinary=options.filter(o=>!o.activity.festival);
  const pool=festive.length&&(rotation%3!==0||!ordinary.length)?festive:ordinary.length?ordinary:festive;
  // Pick a category before a venue so numerous shops do not drown out civic activities.
  const categories=[...new Set(pool.map(o=>o.activity.category))].sort();
  const category=pick(categories,rotation);
  const {venue,companions,activity}=pick(pool.filter(o=>o.activity.category===category),hash(seed+':'+state.month+':activity'));
  const neighbor=pick(companions,hash(seed+':'+state.month+':companion'));
  const name=residentName(hash(state.seed+':neighbor:'+neighbor.id));
  const venueName=businessKind(venue.businessKind)?.name||COMMUNITY_BUILDINGS[venue.type]?.name||({park:'社区公园',plaza:'喷泉广场'})[venue.type]||'社区场所';
  const phase=Math.floor(((state.tick||0)%15)/5);
  const stage=['筹备中','进行中','活动回顾'][phase];
  const prefix=activity.festival?festival.name+' · ':'';
  const quote=phase===0?'我跟'+name+'约好去'+venueName+'，打算'+activity.action+'。':phase===1?'我跟'+name+'在'+venueName+'呢。我们'+activity.action+'。':'前两天跟'+name+'去了'+venueName+'。'+activity.outcome+'。';
  return {
    id:['neighborhood',state.month,home.id,neighbor.id,venue.id,activity.id,phase].join(':'),
    category,stage,activityId:activity.id,
    title:prefix+activity.title,
    description:'参与街坊：'+name+'（住宅 '+neighbor.x+', '+neighbor.y+'）。'+(phase===2?activity.outcome+'。':activity.action+'。'),
    quote:(activity.festival?'今年'+festival.name+'，':'')+quote,
    venue:{id:venue.id,x:venue.x,y:venue.y,name:venueName},
    neighbor:{name,home:{id:neighbor.id,x:neighbor.x,y:neighbor.y}},
  };
}

const STORIES = {
  disconnected: { title: '这条路走不通了', mood: 'upset', quotes: ['家门口明明有路，怎么出不了街区？接上外面的主路就好了。', '路在这里断了，邻居上班、商店进货都犯愁。'], suggestion: { label: '接通街区与对外入口', tool: 'road', overlay: 'traffic' } },
  power: { title: '街区需要电力', mood: 'upset', quotes: ['这一片还缺电，晚饭和店里的生意都受影响。先让灯亮起来吧。', '大家都在等供电恢复。电站没接上路，或容量不够，都得看看。'], suggestion: { label: '检查供电站与剩余容量', tool: 'power', overlay: 'power' } },
  water: { title: '水塔那边有消息吗', mood: 'upset', quotes: ['这一带供水不够，大家出门前都在问什么时候恢复。', '街区有水才住得安心。水塔的连接和容量都检查一下吧。'], suggestion: { label: '检查水塔与剩余容量', tool: 'water', overlay: 'water' } },
  pollution: { title: '想要更清新的空气', mood: 'upset', quotes: ['这附近的空气不太好，工厂能不能离住宅远一点？', '我喜欢这里的邻居，只是工业污染让人不太想开窗。'], suggestion: { label: '查看污染，调整工厂与住宅距离', overlay: 'pollution' } },
  traffic: { title: '眼前这段路有点挤', mood: 'upset', quotes: ['我现在经过的这段路有点挤，想请你看看这里的车流。', '这里的车流比较集中，可以看看有没有合适的分流道路。'], suggestion: { label: '定位当前拥堵路段', overlay: 'traffic' } },
  commute: { title: '住宅平均通勤偏长', mood: 'upset', quotes: ['我们这栋住宅的平均通勤时间偏长，希望附近能有更多合适的工作。'], suggestion: { label: '定位住宅，检查通勤与附近岗位', overlay: 'traffic' } },
  freight: { title: '货物都在车上等着', mood: 'upset', quotes: ['货得先运进街区，可这段路堵得厉害。商店还在等补货呢。', '车里装的是街区要用的货，给货车留一条更顺的路，大家都省心。'], suggestion: { label: '查看货运道路的拥堵', tool: 'road', overlay: 'traffic' } },
  jobs: { title: '想在附近找到工作', mood: 'upset', quotes: ['住下来了，却还没找到合适的岗位。附近能多几家商店或工坊吗？', '街区里找工作的人不少，有新的商业和工业机会，大家才留得住。'], suggestion: { label: '增加可达的商业或工业岗位', tool: 'industrial' } },
  tax: { title: '这个月想省着点过', mood: 'neutral', quotes: ['最近税率有点高，邻居们都在精打细算。希望能兼顾城市开销和生活。', '城市要建设我理解，只是税负再轻一点，大家会更愿意留下。'], suggestion: { label: '在财政面板查看税率与月结余', action: 'budget' } },
  park: { title: '想有个歇脚的地方', mood: 'neutral', quotes: ['下班回家总想在附近走走。要是街角有一座小公园就好了。', '街区开始热闹起来了，留一块绿地让大家见面聊天，会很不错。'], suggestion: { label: '在住宅附近建一座公园', tool: 'park' } },
  market: { title: '邻里又有话聊了', mood: 'happy', quotes: ['社区集市把大家都聚到一起了，我正和隔壁街的新邻居聊天。', '集市真热闹，散步时总有人笑着打招呼。'], suggestion: null },
  warm: { title: '这座城有了生活的样子', mood: 'happy', quotes: ['下班去街角买点东西，再绕公园走一圈。这种普通的日子挺好。', '路通了，家里水电也稳，邻居陆续搬进来。我开始喜欢这里了。', '早上遇到熟悉的面孔，傍晚能顺顺当当地回家。这就是我的湾畔市。', '街区还在长大，但已经有家的感觉了。希望绿地能一直留着。'], suggestion: null },
  delivery: { title: '这一趟送得挺顺', mood: 'happy', quotes: ['路况还不错，货能按时送到。街区有稳定的生意，我们也就有活干。', '今天送货一路顺畅。看见商店开门、街上有人，跑这一趟就踏实。'], suggestion: null },
};

/**
 * Actor coordinates use simulation grid coordinates (not centered world space).
 * Car endpoints, when supplied, must match the endpoints of a current route.
 * A person can remain on a disconnected street and explain its actual problem.
 */
export const yachtOwnerName=(state,homeId)=>residentName(hash(state.seed+':neighbor:'+homeId));
export function getYachtStory(state,actor){
 const boat=state.marinaLife?.boats.find(b=>b.id===actor.yachtId);if(!boat)return null;
 const home=state.buildings.find(b=>b.id===boat.homeId),marina=state.buildings.find(b=>b.id===boat.marinaId);if(!home)return null;
 const spec=YACHT_TYPES[boat.kind],status=marina?(actor.status||'停泊中'):'等待新泊位';
 return {name:yachtOwnerName(state,home.id),role:'居民船主',title:spec.name+' · '+status,mood:'happy',quote:status==='出航中'?'今天开自己的游艇沿河兜一圈，待会儿回码头。':status==='返港中'?'看完沿岸的风景，准备回自己的泊位了。':'游艇是我用积蓄买的，有空就约街坊一起出航。',details:[{label:'船型',value:spec.name},{label:'购买价格',value:'¥'+spec.price+' · 居民个人积蓄'},{label:'购入时间',value:'第 '+(Math.floor((boat.boughtMonth-1)/12)+1)+' 年 '+((boat.boughtMonth-1)%12+1)+' 月'},{label:'航行状态',value:status},{label:'所属住宅',value:'('+home.x+', '+home.y+')'}],home:{id:home.id,x:home.x,y:home.y},location:{x:home.x,y:home.y},suggestion:marina?{label:'定位停靠码头',tool:'inspect',location:{x:marina.x,y:marina.y}}:null,event:null,social:null};
}
export function getCitizenStory(state, actor) {
  if(state?.buildings&&actor?.kind==='yacht')return getYachtStory(state,actor);
  if (!state || !Array.isArray(state.tiles) || state.tiles.length !== mapSize(state) ** 2 || !Array.isArray(state.buildings) || !actor || !point(state,actor)) return null;
  if (!['pedestrian', 'car', 'freight'].includes(actor.kind) || !['string', 'number'].includes(typeof actor.id) || !String(actor.id).length || String(actor.id).length > 160 || (typeof actor.id === 'number' && !Number.isFinite(actor.id))) return null;
  if ((actor.origin !== undefined && !point(state,actor.origin)) || (actor.destination !== undefined && !point(state,actor.destination))) return null;
  const homes = state.buildings.filter(b => b.type === 'residential' && b.population > 0 && b.progress >= 1);
  if (!homes.length) return null;
  const nearbyRoads = [];
  for (let y = Math.max(0, Math.floor(actor.y) - 1); y <= Math.min(mapSize(state) - 1, Math.ceil(actor.y) + 1); y++)
    for (let x = Math.max(0, Math.floor(actor.x) - 1); x <= Math.min(mapSize(state) - 1, Math.ceil(actor.x) + 1); x++) {
      const t = state.tiles[gridIndex(state,x,y)];
      if (t.road && distance(actor, t) <= 1.65) nearbyRoads.push(t);
    }
  if (!nearbyRoads.length) return null;
  nearbyRoads.sort((a, b) => distance(a, actor) - distance(b, actor));
  let route = null;
  if (actor.kind !== 'pedestrian') {
    const routeKind = actor.kind === 'freight' ? 'freight' : 'commute';
    route = (state.routes || []).find(r => r.kind === routeKind && r.load > 0 && Array.isArray(r.points) && r.points.length &&
      (!actor.homeId||r.homeId===actor.homeId)&&(!actor.workplaceId||r.workplaceId===actor.workplaceId)&&
      (!actor.origin || samePoint(actor.origin, r.points[0])) && (!actor.destination || samePoint(actor.destination, r.points.at(-1))) &&
      r.points.some(p => distance(p, actor) <= 1.25));
    if (!route) return null; // A demolished/changed route cannot keep issuing events.
  }
  const origin = actor.origin || route?.points[0] || actor;
  homes.sort((a, b) => distance(a, origin) - distance(b, origin) || a.id - b.id);
  let home = homes[0];
  if (actor.kind === 'freight') home = [...homes].sort((a, b) => distance(a, actor) - distance(b, actor) || a.id - b.id)[0];
  const homeId=actor.kind==='freight'?null:actor.homeId||route?.homeId;
  if(homeId){home=homes.find(b=>b.id===homeId);if(!home)return null;}
  if (actor.kind === 'pedestrian' && !homeId && distance(home, actor) > 10) return null;
  const homeTile = tileAt(state, home);
  const road = nearbyRoads[0];
  const trafficRoad=[road,...nearbyRoads.filter(t=>distance(t,actor)<0.8)].sort((a,b)=>(b.traffic||0)-(a.traffic||0))[0];
  const traffic = trafficRoad.traffic || 0;
  const pollution = Math.max(homeTile?.pollution || 0, tileAt(state, actor)?.pollution || 0);
  const workforce = Math.floor(home.population * 0.55);
  const amenity = homeTile?.amenity || 0;
  const activeEvent = state.cityLife?.activeEvent;
  const eventActive = activeEvent && activeEvent.expiresMonth > state.month;
  const marketActive = eventActive && activeEvent.kind === 'market';
  let topic;
  if (!home.connected) topic = 'disconnected';
  else if (!home.powered) topic = 'power';
  else if (!home.watered) topic = 'water';
  else if (actor.kind === 'freight' && traffic >= 70) topic = 'freight';
  else if (pollution >= 35) topic = 'pollution';
  else if (actor.kind!=='freight' && home.workers>0 && home.commute>22) topic = 'commute';
  else if (traffic >= 75 && home.workers > 0 && home.commute >= TRAFFIC_COMPLAINT_COMMUTE_MINUTES) topic = 'traffic';
  else if (workforce > 0 && home.workers < workforce * 0.65) topic = 'jobs';
  else if (state.taxRate >= 12) topic = 'tax';
  else if (marketActive) topic = 'market';
  else if (actor.kind === 'freight') topic = 'delivery';
  else if (amenity < 3) topic = 'park';
  else topic = 'warm';
  const seed = hash(`${state.seed}:${actor.id}:${actor.nameSeed ?? ''}`);
  const selected = STORIES[topic];
  const social=actor.kind!=='freight'?neighborhoodActivity(state,home,homes,seed):null;
  const commute=actor.kind!=='freight'?residentCommute(state,home,seed,actor.workplaceId||route?.workplaceId):null;
  const journey=actor.kind!=='freight'?residentJourney(state,home,seed,social,{returning:!!actor.returning,commuter:actor.kind==='car',workplaceId:actor.workplaceId||route?.workplaceId}):null;
  const personal=actor.kind!=='freight'?residentVignette(state,seed,journey,commute):null;
  const socialHeadline=social&&['warm','park','market'].includes(topic);
  const proposal=social?{kind:social.activityId,title:social.title,description:social.description,host:state.buildings.find(b=>b.id===social.venue.id)}:null;
  const details = [
    { label: '附近居民', value: `${home.population} 人 · 住宅 (${home.x}, ${home.y})` },
    { label: home.workers > 0 && home.commute >= TRAFFIC_COMPLAINT_COMMUTE_MINUTES ? '附近道路拥堵' : '附近道路负载', value: `${Math.round(traffic)}%` },
    { label: '居住环境污染', value: `${Math.round(pollution)} / 100` },
    { label: '住宅水电', value: `${home.powered ? '有电' : '缺电'} / ${home.watered ? '有水' : '缺水'}` },
  ];
  const yacht=state.marinaLife?.boats.find(b=>b.homeId===home.id);if(yacht)details.push({label:'邻里游艇',value:yachtOwnerName(state,home.id)+'拥有'+YACHT_TYPES[yacht.kind].name});
  if (actor.kind !== 'freight') details.push({ label: '住宅就业', value: `${home.workers} / ${workforce} 位劳动力` },{label:'住宅平均通勤',value:home.workers?`${home.commute} 分钟`:'暂无通勤'});
  if (route) details.push({ label: actor.kind === 'freight' ? '当前货运路线' : '当前通勤路线', value: `${route.points.length} 格道路` });
  if (topic === 'tax') details.push({ label: '当前税率', value: `${state.taxRate}%` });
  if (eventActive) details.push({ label: eventTitle(activeEvent.kind), value: `满意度 +4 · 持续至第 ${activeEvent.expiresMonth - 1} 月末` });
  const host = proposal?.host||state.buildings.find(b => ['park', 'plaza'].includes(b.type) && b.active && b.progress >= 1 && distance(b, home) <= 8);
  let reason = '';
  if (eventActive) reason = `${eventTitle(activeEvent.kind)}进行中，第 ${activeEvent.expiresMonth} 月起可再举办`;
  else if (state.cityLife?.lastEventMonth === state.month) reason = '本月已经支持过一次社区活动';
  else if (!home.connected || !home.powered || !home.watered) reason = '先恢复附近住宅的道路、水电，再举办活动';
  else if ((state.stats?.population || 0) < 80) reason = '至少有 80 位居民后，才有足够邻居举办活动';
  else if (!host) reason = '附近需要一座正在开放的公园或广场';
  else if (state.money < 300) reason = '需要 ¥300 城市资金';
  const identity = hash(`${state.seed}:${actor.id}:${actor.kind}:${actor.nameSeed ?? ''}:${home.id}:${host?.id || 0}`);
  return {
    name: residentName(seed),
    role: actor.kind === 'freight' ? '送货司机' : actor.kind === 'car' ? '通勤居民' : pick(['附近居民', '散步的街坊', '社区居民'], seed >>> 8),
    mood: socialHeadline?'happy':selected.mood, title: socialHeadline?social.title:selected.title,
    quote:socialHeadline?`${marketActive?'社区集市也在热闹进行。':''}${social.quote}`:topic==='commute'?`我们这栋住宅平均通勤要 ${home.commute} 分钟，路上都够想好两顿晚饭了。要是附近有合适的工作，回家就能从容一点。`:topic==='traffic'?`${pick(selected.quotes,seed>>>4)}当前路段拥堵 ${Math.round(traffic)}%。${home.workers?`我们住宅平均通勤 ${home.commute} 分钟，比起整趟路，我现在更盼着这个路口快点顺起来。`:''}`:pick(selected.quotes, seed >>> 4),
    personal,journey,commute,
    social,
    festival:festivalForMonth(state.month),
    home: {id:home.id,x:home.x,y:home.y},
    details, location: { x: Math.round(actor.x), y: Math.round(actor.y) },
    suggestion: selected.suggestion ? { ...selected.suggestion,...(['traffic','freight'].includes(topic)?{location:{x:trafficRoad.x,y:trafficRoad.y}}:topic==='commute'?{location:{x:home.x,y:home.y}}:{}) } : null,
    event: {
      id: `${proposal?.kind||'market'}:${state.month}:${identity.toString(36)}`, kind:proposal?.kind||'market', title:proposal?.title||'社区周末集市',
      description: proposal?`支持街坊在${social.venue.name}举办${social.title}。${proposal.description}`:'支持街坊在附近公园办一场集市。居民一起摆摊、聊天，为忙碌的城市添一点邻里温度。',
      cost: 300, actionLabel: proposal?'支持这场活动':'支持社区集市', effect: '全市居民满意度 +4，持续本月及下月；水电、污染和交通问题仍需单独改善。',
      available: reason === '', reason,
    },
  };
}

export function eventTitle(kind){return kind==='market'?'社区周末集市':NEIGHBORHOOD_ACTIVITIES.find(a=>a.id===kind)?.title;}
