export const DECORATIONS = {
  citySculpture: {name:'城市雕塑',cost:800,maintenance:8,radius:4,strength:8,height:1.25,description:'铜色抽象雕塑与石质基座'},
  stoneLions: {name:'镇园石狮',cost:500,maintenance:5,radius:3,strength:6,height:.85,description:'成对石狮与中式石台'},
  flowerBed: {name:'缤纷花坛',cost:250,maintenance:6,radius:3,strength:8,height:.35,description:'花卉、矮篱与环形花池'},
  stoneLantern: {name:'园林石灯',cost:350,maintenance:4,radius:3,strength:6,height:1.05,description:'石质灯亭、暖色灯芯与庭院绿植'},
  laurelStatue: {name:'月桂女神像',style:'europeanClassical',cost:1100,maintenance:9,radius:4,strength:10,height:1.52,description:'象牙白石雕、垂褶长袍与高举的月桂环，适合欧式庭园'},
  thinkerStatue: {name:'沉思者坐像',style:'europeanClassical',cost:1200,maintenance:10,radius:4,strength:10,height:1.14,description:'托腮静坐的青铜人物与石座，适合书院、林荫道和小广场'},
  threeGraces: {name:'三美神群像',style:'europeanClassical',cost:1600,maintenance:12,radius:5,strength:12,height:1.24,description:'三位披纱人物相依而立，圆形石台与花卉点缀庭园中心'},
  wingedVictory: {name:'胜利女神像',style:'europeanClassical',cost:1800,maintenance:14,radius:5,strength:14,height:1.63,description:'展开羽翼的白石女神、迎风衣褶与高台，适合轴线和广场入口'},
  equestrianStatue: {name:'青铜骑士像',style:'europeanClassical',cost:2200,maintenance:16,radius:5,strength:14,height:1.57,description:'抬蹄骏马、披风骑士与铭牌石座，适合市政广场和欧式大道'},
  davidStatue: {name:'大卫雕像',style:'famousClassical',footprint:1,cost:4800,maintenance:28,radius:7,strength:18,height:1.65,description:'以完整雕像扫描重现卷发、人体与重心偏移站姿，搭配石材高台'},
  venusDeMilo: {name:'断臂维纳斯',style:'famousClassical',footprint:1,cost:4200,maintenance:24,radius:7,strength:18,height:1.55,description:'米洛的维纳斯，保留断臂轮廓、转身姿态与腰间垂褶，置于大理石庭园'},
  samothraceVictory: {name:'萨莫色雷斯胜利女神',style:'famousClassical',footprint:1,cost:5600,maintenance:32,radius:8,strength:20,height:1.675,description:'无头断臂的展翼女神，细致羽翼与迎风衣褶立于石材高台，适合滨水广场'},
  discobolusStatue: {name:'掷铁饼者',style:'famousClassical',footprint:1,cost:3800,maintenance:22,radius:6,strength:16,height:1.4,description:'古希腊运动员俯身转体、持盘蓄势的白石雕像，配圆形展示石台'},
};

export const EUROPEAN_SCULPTURE_KINDS=Object.freeze(Object.keys(DECORATIONS).filter(type=>DECORATIONS[type].style==='europeanClassical'));

export const FAMOUS_SCULPTURE_KINDS=Object.freeze(Object.keys(DECORATIONS).filter(type=>DECORATIONS[type].style==='famousClassical'));
export const isClassicalSculpture=type=>['europeanClassical','famousClassical'].includes(DECORATIONS[type]?.style);
