const bounded = n => Math.round(Math.max(0,Math.min(100,n)));
export function calculateDemand({population,jobs,workforce,housingCapacity,commercialJobs,taxRate}){
 const scale=Math.max(1,population/2000),tax=Math.max(0,taxRate-9);
 const parts={
  residential:[{label:population<80?'起步迁入需求':'基础迁居需求',value:population<80?90:48},{label:'岗位与劳动力差额',value:population<80?0:(jobs-workforce)*.5/scale},{label:'空置住房压力',value:-Math.max(0,housingCapacity-population-60*scale)*.2/scale},{label:'高税率抑制',value:-tax*7}],
  commercial:[{label:'基础商业需求',value:35},{label:'居民消费需求',value:population*.2/scale},{label:'现有商业供给',value:-commercialJobs*.8/scale},{label:'高税率抑制',value:-tax*5}],
 };
 const market=65+(population*.26-jobs*.6)/scale,labor=48+(workforce-jobs)*.6/scale;
 parts.industrial=market>=labor?[{label:'基础产业需求',value:65},{label:'城市市场需求',value:population*.26/scale},{label:'现有岗位供给',value:-jobs*.6/scale},{label:'高税率抑制',value:-tax*4}]:[{label:'基础就业需求',value:48},{label:'待吸纳劳动力 / 岗位差额',value:(workforce-jobs)*.6/scale},{label:'高税率抑制',value:-tax*4}];
 const demand={},details={};
 for(const [type,factors]of Object.entries(parts)){
  const raw=factors.reduce((sum,f)=>sum+f.value,0);demand[type]=bounded(raw);
  const negative=factors.filter(f=>f.value<0).sort((a,b)=>a.value-b.value)[0];
  details[type]={factors,raw,scale,summary:demand[type]>=12?'有开发需求':negative?negative.label:'供需暂时平衡'};
 }
 details.industrial.alternatives={market,labor};
 return {demand,details};
}
export function zoningReadiness(tiles,type){
 const status={total:0,ready:0,road:0,power:0,water:0};
 for(const t of tiles){if(t.zone!==type||t.buildingId!==null)continue;status.total++;
  if(!t.connected)status.road++;else if(!t.powered)status.power++;else if(!t.watered)status.water++;else status.ready++;
 }
 return status;
}

export function developmentSummary(demand,details){
 if(demand<12)return details.summary;
 const sites=details.sites;
 if(sites.ready>0)return `有开发需求 · ${sites.ready} 格可开工`;
 if(!sites.total)return '有开发需求 · 请规划临路分区';
 const blocked=[['road','缺连通道路'],['power','缺电'],['water','缺水']].filter(([key])=>sites[key]>0).map(([key,label])=>`${sites[key]} 格${label}`);
 return `等待开工 · ${blocked.join('、')}`;
}
