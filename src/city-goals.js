import {mayorReputation} from './mayor-reputation.js';
import {DEFAULT_MAP_SIZE,mapSize,validMapSize} from './grid.js';

export const DEFAULT_CITY_GOAL = 'population';
const freezeGoals=goals=>Object.freeze(goals.map(goal=>Object.freeze(goal)));
export const CITY_GOALS_BY_MAP_SIZE=Object.freeze({
  64:freezeGoals([
    {id:'population',name:'五万人口都会',summary:'将城市发展到 50,000 人',detail:'适合持续扩建住宅、岗位、道路和公共服务的长期经营。',populationTarget:50000},
    {id:'reputation',name:'荣誉市长',summary:'市长荣誉达到 Lv.8',detail:'满意度、人口、就业、财政与名胜都会推动荣誉提升。',honorTarget:8},
    {id:'livability',name:'宜居典范',summary:'达到 30,000 人且满意度达到 90%',detail:'在人口增长的同时兼顾就业、服务、环境与通勤。',populationTarget:30000,happinessTarget:90},
  ]),
  80:freezeGoals([
    {id:'population',name:'八万人区域中心',summary:'将城市发展到 80,000 人',detail:'在更广阔的城区中完善跨区交通、就业与公共服务网络。',populationTarget:80000},
    {id:'reputation',name:'卓越区域市长',summary:'市长荣誉达到 Lv.10',detail:'以更高满意度、稳健财政和多座名胜赢得区域声望。',honorTarget:10},
    {id:'livability',name:'宜居大城',summary:'达到 60,000 人且满意度达到 91%',detail:'让多个片区同时具备就业、教育、医疗、休闲与顺畅通勤。',populationTarget:60000,happinessTarget:91},
  ]),
  96:freezeGoals([
    {id:'population',name:'十二万人国际都会',summary:'将城市发展到 120,000 人',detail:'充分利用超大型版图，形成多中心、高承载的都会区。',populationTarget:120000},
    {id:'reputation',name:'传奇都会市长',summary:'市长荣誉达到 Lv.12',detail:'建设完整公共体系与多座名胜，成为城市传奇。',honorTarget:12},
    {id:'livability',name:'超级宜居都会',summary:'达到 100,000 人且满意度达到 92%',detail:'在十万人规模下维持高就业、完善服务、优良环境与高效通勤。',populationTarget:100000,happinessTarget:92},
  ]),
});

export function cityGoalsForMapSize(value=DEFAULT_MAP_SIZE){
  const size=Number(value);
  return CITY_GOALS_BY_MAP_SIZE[validMapSize(size)?size:DEFAULT_MAP_SIZE];
}

// Keep the original export as the standard-map profile for saved-game and API compatibility.
export const CITY_GOALS=cityGoalsForMapSize();

export const validCityGoal=id=>CITY_GOALS.some(goal=>goal.id===id);
export function newCityGoal(id=DEFAULT_CITY_GOAL){
  if(!validCityGoal(id))throw new Error('未知城市目标');
  return {id,completed:false,completedMonth:null};
}

export function loadCityGoal(value,month){
  if(value===undefined)return newCityGoal();
  if(!value||typeof value!=='object'||Array.isArray(value)||!validCityGoal(value.id)||typeof value.completed!=='boolean')return null;
  if(value.completed){if(!Number.isInteger(value.completedMonth)||value.completedMonth<1||value.completedMonth>month)return null;}
  else if(value.completedMonth!==null)return null;
  return {id:value.id,completed:value.completed,completedMonth:value.completedMonth};
}

export function cityGoalProgress(state){
  const stored=loadCityGoal(state?.cityGoal,state?.month||1)||newCityGoal();
  const definition=cityGoalsForMapSize(mapSize(state)).find(goal=>goal.id===stored.id);
  const population=Math.max(0,Number(state?.stats?.population)||0);
  const happiness=Math.max(0,Number(state?.stats?.happiness)||0);
  const honor=mayorReputation(state||{}).level;
  let met=false,progress=0,currentLabel='',targetLabel=definition.summary;
  if(stored.id==='population'){
    met=population>=definition.populationTarget;progress=population/definition.populationTarget;
    currentLabel=`${population.toLocaleString('zh-CN')} / ${definition.populationTarget.toLocaleString('zh-CN')} 人`;
  }else if(stored.id==='reputation'){
    met=honor>=definition.honorTarget;progress=honor/definition.honorTarget;
    currentLabel=`荣誉 Lv.${honor} / Lv.${definition.honorTarget}`;
  }else{
    met=population>=definition.populationTarget&&happiness>=definition.happinessTarget;
    progress=Math.min(population/definition.populationTarget,happiness/definition.happinessTarget);
    currentLabel=`${population.toLocaleString('zh-CN')} / ${definition.populationTarget.toLocaleString('zh-CN')} 人 · 满意度 ${Math.round(happiness)}% / ${definition.happinessTarget}%`;
  }
  return {...definition,progress:Math.max(0,Math.min(1,progress)),met,completed:stored.completed||met,completedMonth:stored.completedMonth,currentLabel,targetLabel};
}

export function latchCityGoal(state){
  const loaded=loadCityGoal(state.cityGoal,state.month);
  if(!state.cityGoal||!loaded)state.cityGoal=newCityGoal();
  const goal=cityGoalProgress(state);
  if(!state.cityGoal.completed&&goal.met){state.cityGoal.completed=true;state.cityGoal.completedMonth=state.month;}
  return cityGoalProgress(state);
}
