export const LANDMARKS = {
  orientalPearl: {name:'上海 · 东方明珠',footprint:3,cost:65000,maintenance:900,gate:'regional',population:20000,height:4.6,description:'3×3 · 大小珠体、三足支撑与观景天线'},
  cantonTower: {name:'广州 · 广州塔',footprint:3,cost:90000,maintenance:1200,gate:'civic',population:40000,height:5.0,description:'3×3 · 扭转网格塔身、纤细腰线与观景平台'},
  empireState: {name:'纽约 · 帝国大厦',footprint:3,cost:120000,maintenance:1600,gate:'global',population:50000,height:4.7,description:'3×3 · 装饰艺术退台、石色立面与银色尖顶'},
  eiffelTower: {name:'巴黎 · 埃菲尔铁塔',footprint:3,cost:60000,maintenance:850,gate:'mature',population:30000,height:4.4,description:'3×3 · 四座弧形桁架塔腿、拱门、低位双平台与细长塔尖'},
  bigBen: {name:'伦敦 · 大本钟钟楼',footprint:2,cost:35000,maintenance:500,gate:'capital',population:10000,height:3.7,heightScales:[1.45,1.65,1.85],description:'2×2 · 哥特式钟楼、四面钟盘与尖顶'},
  landmark: { name: '河湾之帆', cost: 0, maintenance: 100, gate: 'landmark', population: 2000, height: 2.2, description: '城市纪念钟楼 · 首座发展奖励' },
  lighthouse: { name: '望海灯塔', cost: 4200, maintenance: 90, gate: 'bridge', population: 500, height: 1.9, description: '白色塔身与金色灯室，守望河湾' },
  pagoda: { name: '听风古塔', cost: 6800, maintenance: 120, gate: 'metropolis', population: 5000, height: 2.2, description: '三层飞檐与朱红廊柱，城市中的古典风景' },
  museum: { name: '河湾艺术馆', cost: 8000, maintenance: 160, gate: 'density', population: 1000, height: 1.1, description: '玻璃中庭与层叠展厅，收藏城市记忆' },
  observatory: { name: '星海天文台', cost: 12000, maintenance: 220, gate: 'capital', population: 10000, height: 1.7, description: '银色穹顶与观星望远镜，仰望都会星空' },
};

export const MAX_LANDMARK_LEVEL=3;
export const LANDMARK_LEVEL_NAMES=['城市名胜','精修名胜','传世名胜'];
export const LANDMARK_HONOR_POINTS=[2,4,6];
export const landmarkLevel=b=>Math.max(1,Math.min(MAX_LANDMARK_LEVEL,b.level||1));
// Renovation retains earned honor; only completion adds the new tier.
export const completedLandmarkLevel=b=>(b.progress??1)>=1?landmarkLevel(b):Math.max(0,landmarkLevel(b)-1);
export const landmarkHonor=b=>LANDMARK_HONOR_POINTS[completedLandmarkLevel(b)-1]||0;
export const landmarkScale=b=>(LANDMARKS[b.type]?.heightScales||(LANDMARKS[b.type]?.footprint?[1.8,2.05,2.3]:[1.25,1.45,1.65]))[landmarkLevel(b)-1];
export const landmarkHeight=b=>(LANDMARKS[b.type]?.height||0)*landmarkScale(b);
export const landmarkRadius=b=>8+(landmarkLevel(b)-1)*2;
export const landmarkStrength=b=>24+(landmarkLevel(b)-1)*4;
export function landmarkUpgradePlan(b){
 const def=LANDMARKS[b.type],level=landmarkLevel(b);
 if(!def||level>=MAX_LANDMARK_LEVEL)return null;
 return {nextLevel:level+1,name:LANDMARK_LEVEL_NAMES[level],honorLevel:level===1?6:9,
  population:level===1?Math.max(10000,Math.ceil(def.population*1.5/5000)*5000):Math.max(50000,def.population*2),
  milestone:level===1?'capital':'global',stage:level===1?'河湾都会':'国际都会',
  cost:Math.max(level===1?1500:3000,Math.ceil(def.cost*(level===1?.4:.7)/50)*50)};
}
