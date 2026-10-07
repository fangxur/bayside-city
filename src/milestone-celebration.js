import {LANDMARKS} from './landmarks.js';

export const MILESTONE_CELEBRATIONS = [
 {key:'bridge',population:500,title:'河畔小镇，初具规模',reward:'人口与就业目标达成',next:'建设并启用市政府，向 1,000 人的繁荣街区迈进。'},
 {key:'density',population:1000,street:true,title:'繁荣街区，灯火渐盛',reward:'人口已开放二级道路；市政府正常办公后，住商工、供电与供水二级升级也已开放',next:'点击继续建设，一起观看街头礼花和居民庆祝！下一站，2,000 位居民。'},
 {key:'landmark',population:2000,title:'宜居小城，属于你我',reward:'地标与其他市政设施二级升级已开放',next:'河湾之帆可免费建造，留下这座城市的成长纪念。'},
 {key:'metropolis',population:5000,populationTriggered:true,street:true,title:'活力都市，欣欣向荣',reward:'5,000 人口里程碑达成，三级道路已开放',next:'街坊们已经走上街头庆祝。继续完善水电、产业、公共服务与休闲景观，完成领域协同后开放三级建筑升级。'},
 {key:'capital',population:10000,populationTriggered:true,street:true,title:'万家灯火，汇成都会',reward:'10,000 人口里程碑达成，四级道路已开放',next:'让礼花照亮万人都会。继续完善含休闲景观的三级领域协同，开放四级建筑升级。'},
 {key:'regional',population:20000,populationTriggered:true,street:true,fireworks:'grand',title:'区域中心，新的篇章',reward:'20,000 人口里程碑达成，五级道路已开放',next:'大型烟花庆典即将点亮城市夜空。再补齐各领域服务和休闲景观，向更高等级迈进。'},
 {key:'mature',population:30000,populationTriggered:true,street:true,title:'百业共兴，均衡大城',reward:'30,000 人口里程碑达成',next:'居民将在街头共同庆祝。让五级道路与四级公共服务协同运行，即可开放完整的五级建设体系。'},
 {key:'civic',population:40000,populationTriggered:true,street:true,title:'宜居中心城，服务再升级',reward:'40,000 人口里程碑达成',next:'全城将举行庆祝活动。完成包含宗教与信仰的五级公共服务和市容协同，可开放六级住宅与公共设施。'},
 {key:'global',population:50000,populationTriggered:true,street:true,fireworks:'grand',title:'国际都会，梦想成真',reward:'50,000 人口里程碑达成，六级道路已开放',next:'全城烟花将为这段旅程绽放。城市仍会生长，新的故事由你续写。'},
];
export const celebrationSnapshot=state=>({
 population:Number(state?.stats?.population)||0,
 milestones:{...(state?.milestones||{})},
});
export const reachedCelebrations=(previous,current)=>MILESTONE_CELEBRATIONS.filter(stage=>stage.populationTriggered
 ? previous.population<stage.population&&current.population>=stage.population
 : current.milestones[stage.key]&&!previous.milestones[stage.key]);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function celebrationMarkup(stage,cityName){
 const landmarks=stage.populationTriggered?[]:Object.values(LANDMARKS).filter(item=>item.gate===stage.key).map(item=>item.name);
 return `<div class="milestone-confetti" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i style="--x:${(i*37)%100}%;--delay:${(i%8)*.12}s;--turn:${i*47}deg;--color:${['#d8b66d','#589b83','#efb69c','#fbebaa'][i%4]}"></i>`).join('')}</div>
 <div class="milestone-emblem" aria-hidden="true">${stage.fireworks==='grand'?'🎆':'✦'}</div><p class="milestone-eyebrow">${stage.fireworks==='grand'?'城市成长 · 全城烟花庆典':'城市成长 · 里程碑达成'}</p>
 <p class="milestone-city">${escape(cityName)}</p><div class="milestone-population">${stage.population.toLocaleString('zh-CN')}<span>位居民的共同家园</span></div>
 <h2 id="milestone-title">${escape(stage.title)}</h2><div class="milestone-reward"><strong>${escape(stage.reward)}</strong>${landmarks.length?`<p>新解锁名胜：${escape(landmarks.join('、'))}</p>`:''}</div>
 <p id="milestone-description">${escape(stage.next)}</p><button type="button" class="primary-button" id="milestone-continue" autofocus>太棒了，继续建设！</button><small class="milestone-pause-note">庆祝期间城市已暂停，关闭后恢复原来的状态</small>`;
}
