import {RELIGIOUS_BUILDINGS} from './religious-buildings.js';
export const COMMUNITY_BUILDINGS = {
  ...RELIGIOUS_BUILDINGS,
  marina:{name:'游艇码头',footprint:2,category:'entertainment',business:'commercial',jobs:40,service:'entertainment',cost:6500,maintenance:180,radius:9,bonus:4,beauty:10,height:.8,icon:'boat',populationUpgrades:[1000,5000,10000,20000,50000],berths:[2,3,4,5,6,8],description:'2×2 岸边游艇商业；随城市人口升级，逐步扩建会所与 2–8 个泊位，增加岗位、商业税、娱乐服务和社区美观'},
  districtOffice:{name:"区政务中心",footprint:1,minPopulation:5000,category:"utilities",service:"cityHall",cost:2600,maintenance:70,radius:6,bonus:1,height:1.05,icon:"cityHall",description:"1×1 片区办事服务站，可重复建设；在市政府正常办公时扩展市政方针与住宅服务覆盖，不负责城市晋级、预算和消防调度"},
  grandStadium:{fixedFacility:true,name:'都会大体育场',footprint:3,minPopulation:40000,service:'sportsHall',cost:42000,maintenance:1100,radius:18,bonus:6,height:1.6,icon:'park',description:'4 万人口解锁的 3×3 环形看台、顶棚与比赛场地，服务大型城市'},
  grandGallery:{fixedFacility:true,name:'都会大美术馆',footprint:3,minPopulation:40000,service:'library',cost:36000,maintenance:850,radius:16,bonus:6,height:1.9,icon:'landmark',description:'4 万人口解锁的 3×3 多馆展厅、雕塑庭院与玻璃连廊'},
  shoppingComplex:{fixedFacility:true,name:'都会商业综合体',footprint:3,minPopulation:50000,category:'commercial',service:'shopping',cost:50000,maintenance:1000,radius:14,bonus:4,jobs:500,height:2.6,icon:'shop',description:'3×3 购物中心、办公双塔与屋顶花园，提供 500 个基础岗位'},
  operaStage: {name:'梨园戏台', footprint:2, business:'commercial', jobs:32, service:'entertainment', beauty:12, category:'entertainment', cost:4200, maintenance:150, radius:9, bonus:4, height:1.35, icon:'landmark', description:'2×2 戏曲舞台与观演庭院，提供 32 个演艺与经营岗位、商业税收、娱乐服务和社区美观'},
  chessPavilion: {name:'弈趣棋亭', footprint:2, business:'commercial', jobs:12, service:'entertainment', beauty:8, category:'entertainment', cost:1600, maintenance:55, radius:6, bonus:2, height:.95, icon:'park', description:'中式凉亭、棋桌与庭院，提供 12 个休闲经营岗位、商业税收并提升社区美观'},
  school: { name: '社区学校', cost: 2800, maintenance: 100, radius: 7, bonus: 3, height: .95, icon: 'home', description: '教学楼与操场，为附近家庭提供教育服务' },
  clinic: { name: '社区诊所', cost: 2400, maintenance: 120, radius: 6, bonus: 4, height: .85, icon: 'medical', description: '白色诊疗楼与醒目的红十字标识，照顾街区居民' },
  library: { name: '城市图书馆', cost: 3200, maintenance: 90, radius: 8, bonus: 2, height: 1, icon: 'cityHall', serviceAliases: ['school'], coverageLabel: '文化与教育', description: '落地窗、阅览室与公共课堂，同时提供文化和教育覆盖' },
  sportsHall: { footprint: 1, name: '社区体育馆', cost: 3600, maintenance: 140, radius: 6, bonus: 3, height: .95, icon: 'park', description: '1×1 拱顶运动馆，为周边居民提供健身空间' },
  hospital: { name: '城市综合医院', footprint: 2, minPopulation: 20000, service: 'clinic', cost: 15000, maintenance: 650, radius: 16, bonus: 6, height: 1.75, icon: 'medical', description: '2 万人口解锁，门诊与住院双楼以红十字标识，提供大范围医疗服务' },
  stadium: { name: '城市体育场', footprint: 2, service: 'sportsHall', cost: 9000, maintenance: 320, radius: 12, bonus: 4, height: .9, icon: 'park', description: '开放式球场、环形跑道与阶梯看台' },
};

export const isCommunityBusiness=type=>COMMUNITY_BUILDINGS[type]?.business==='commercial'||COMMUNITY_BUILDINGS[type]?.category==='commercial';

export const COMMUNITY_UPGRADES = {
  marina:['社区游艇码头','滨水游艇港','城市游艇港','都会游艇中心'],
  districtOffice:["区政务中心","区综合政务中心","区行政服务中心","区智慧政务中心"],
  grandStadium:['都会大体育场','都会体育中心','区域赛事中心','国际赛事中心'],
  grandGallery:['都会大美术馆','综合艺术中心','区域艺术中心','国际艺术中心'],
  shoppingComplex:['都会商业综合体','都会商贸城','区域商贸中心','国际商贸中心'],
  clinic:['社区诊所','街区卫生中心','综合门诊中心','区域医疗中心'],
  hospital:['城市综合医院','区域综合医院','三级医疗中心','城市医学中心'],
  school:['社区学校','综合学校','示范学校','城市教育中心'],
  library:['城市图书馆','综合图书馆','区域文化馆','城市文化中心'],
  sportsHall:['社区体育馆','综合体育馆','区域体育中心','全民健身中心'],
  stadium:['城市体育场','综合体育场','城市竞技中心','都会体育公园'],
  operaStage:['梨园戏台','梨园剧场','戏曲文化园','城市戏曲中心'],
  chessPavilion:['弈趣棋亭','弈趣棋苑','棋艺雅苑','城市棋艺馆'],
};
for(const [type,item] of Object.entries(RELIGIOUS_BUILDINGS))COMMUNITY_UPGRADES[type]=[item.name,item.name+' · 修缮',item.name+' · 雅院',item.name+' · 华庭'];
export function communityService(b){
  const base=COMMUNITY_BUILDINGS[b.type];if(!base)return null;
  const tier=Math.max(0,Math.min(5,(b.level||1)-1));
  return {...base,...(base.beauty?{beauty:base.beauty+tier*4}:{}),...(base.jobs?{jobs:Math.round(base.jobs*(1+tier*.4))}:{}),radius:base.radius+2*tier,bonus:base.bonus+tier};
}
