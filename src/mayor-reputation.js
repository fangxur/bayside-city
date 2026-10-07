import {LANDMARKS,landmarkHonor,completedLandmarkLevel} from './landmarks.js';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
const round=n=>Math.round(n*10)/10;
export const HONOR_THRESHOLDS=[0,20,45,75,110,150,195,245,300,360,430,510,600,700,815,945];
const DEVELOPMENT_HONORS=[
 ['density','繁荣街区',10],['completed','宜居小城',10],['metropolis','活力都市',20],
 ['capital','河湾都会',25],['regional','区域中心',30],['mature','均衡大城',15],
 ['civic','宜居中心城',30],['global','国际都会',40],
];
const honorLevel=points=>HONOR_THRESHOLDS.filter(threshold=>points>=threshold).length;

// All points derive from saved city state. Moving/rebuilding cannot farm honors.
export function mayorReputation(state){
 const s=state.stats||{},population=Math.max(0,s.population||0),inhabited=population>0;
 const factors=[
  {label:'市民满意度',weight:50,value:inhabited?clamp(s.happiness):0,note:inhabited?`满意度 ${clamp(s.happiness)}%`:'尚无居民评价'},
  {label:'人口规模',weight:25,value:clamp(Math.sqrt(population/50000)*100),note:`${population.toLocaleString('zh-CN')} 人；5 万以上人口继续贡献发展荣誉积分`},
  {label:'就业情况',weight:15,value:inhabited?clamp(s.employmentRate):0,note:inhabited?`就业率 ${clamp(s.employmentRate)}%`:'尚无居民就业'},
  {label:'财政健康',weight:10,value:inhabited?clamp(50+50*((s.income||0)-(s.expenses||0))/Math.max(1,s.income||0,s.expenses||0)):0,note:`月税收 ¥${Math.round(s.income||0)} / 支出 ¥${Math.round(s.expenses||0)}，收支平衡为 50 分`},
 ].map(f=>({...f,points:f.value*f.weight/100}));
 const unique=new Map();
 for(const b of state.buildings||[])if(LANDMARKS[b.type]&&landmarkHonor(b)>(unique.get(b.type)?.points||0))unique.set(b.type,{type:b.type,level:completedLandmarkLevel(b),points:landmarkHonor(b)});
 const landmarkDetails=[...unique.values()],landmarks=landmarkDetails.map(item=>item.type);
 const baseScore=round(factors.reduce((sum,f)=>sum+f.points,0)),score=baseScore;
 const populationBonus=round(60*Math.log2(1+population/10000));
 const development=DEVELOPMENT_HONORS.filter(([key])=>state.milestones?.[key]).map(([key,name,points])=>({key,name,points}));
 const developmentBonus=development.reduce((sum,item)=>sum+item.points,0);
 const landmarkBonus=landmarkDetails.reduce((sum,item)=>sum+item.points,0);
 const basePoints=round(baseScore+populationBonus+developmentBonus),honorPoints=round(basePoints+landmarkBonus);
 const baseLevel=honorLevel(basePoints),level=honorLevel(honorPoints),nextPoints=HONOR_THRESHOLDS[level]??null;
 const title=level>=12?'城市传奇':level>=9?'卓越领航者':level>=6?'荣誉市长':level>=4?'民望市长':level>=2?'尽责市长':'新任市长';
 return {score,baseScore,landmarkBonus,populationBonus,developmentBonus,development,honorPoints,nextPoints,factors,landmarks,landmarkDetails,baseLevel,level,title};
}
export function reputationMarkup(state){
 const r=mayorReputation(state),floor=HONOR_THRESHOLDS[r.level-1],span=r.nextPoints===null?1:r.nextPoints-floor,progress=r.nextPoints===null?1:r.honorPoints-floor;
 const landmarkNames=r.landmarkDetails.map(item=>`${LANDMARKS[item.type].name} · ${item.level} 级（${item.points} 分）`);
 return `<div class="mayor-reputation"><div class="mayor-reputation-heading"><span>市长名誉<strong>${r.score.toFixed(1)}<small> / 100</small></strong></span><span class="mayor-honor">荣誉 Lv.${r.level}<b>${r.title}</b></span></div><progress max="${span}" value="${progress}" aria-label="荣誉积分 ${r.honorPoints}，${r.nextPoints===null?'已达最高等级':'下一级需要 '+r.nextPoints}"></progress><p>荣誉积分 ${r.honorPoints.toFixed(1)}${r.nextPoints===null?' · 已达最高等级':` / ${r.nextPoints} · 距 Lv.${r.level+1} 还需 ${round(r.nextPoints-r.honorPoints)} 分`}</p><details><summary>评分来源与荣誉规则</summary>${r.factors.map(f=>`<div class="mayor-factor"><span>${f.label} · 名誉权重 ${f.weight}%<small>${f.note}</small></span><b>+${f.points.toFixed(1)}</b></div>`).join('')}<div class="mayor-factor"><span>人口发展荣誉<small>随人口持续增加，5 万人口后仍可成长；规模越大，增长越平缓</small></span><b>+${r.populationBonus.toFixed(1)}</b></div><div class="mayor-factor"><span>城市晋级荣誉<small>${r.development.length?r.development.map(item=>`${item.name} +${item.points}`).join('、'):'完善住商工、水电与公共服务，完成城市阶段后获得积分'}</small></span><b>+${r.developmentBonus}</b></div><div class="mayor-factor mayor-landmark-factor"><span>名胜建设与升级<small>${landmarkNames.length?landmarkNames.join('；'):'尚未建成名胜'}</small></span><b>+${r.landmarkBonus}</b></div><p>荣誉由市长名誉、人口发展、城市晋级和名胜积分共同决定，按逐渐提高的积分门槛升级。每座名胜一级贡献 2 分、二级 4 分、三级 6 分；建成或升级只增加积分，不直接赠送等级。</p><p>名胜修缮需达到相应人口、城市阶段与荣誉等级；完工后提高外观、环境覆盖和积分。施工保留原等级积分，搬迁或暂停不扣积分；拆除扣回该名胜积分，重建不重复累计。</p></details></div>`;
}
