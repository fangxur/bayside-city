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
};

export const EUROPEAN_SCULPTURE_KINDS=Object.freeze(Object.keys(DECORATIONS).filter(type=>DECORATIONS[type].style==='europeanClassical'));
