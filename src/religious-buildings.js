export const RELIGIOUS_BUILDINGS={
 gothicCathedral:{name:'哥特式双塔大教堂',architecture:'cathedral',footprint:3,cost:16800,maintenance:380,radius:15,bonus:4,height:3.2,description:'双塔石立面、玫瑰花窗、尖拱入口与飞扶壁；合唱、文化参观与社区分享'},
 domedCathedral:{name:'古典穹顶大教堂',architecture:'cathedral',footprint:3,cost:19200,maintenance:420,radius:15,bonus:4,height:3.45,description:'浅石柱廊、中央铅灰穹顶与双钟塔；社区合唱、建筑参观与邻里互助'},
 chapel:{name:'社区礼拜堂',footprint:1,cost:1800,maintenance:65,radius:9,bonus:2,height:1.3,description:'钟楼、彩色玻璃与小礼拜厅；合唱、邻里聚餐与圣诞分享'},
 buddhistTemple:{name:'佛教寺院',footprint:2,cost:3600,maintenance:120,radius:12,bonus:3,height:1.2,description:'黛瓦重檐主殿、朱木山门、两侧回廊与香炉庭院；暖灯映院，升级精修木作与园景'},
 taoistTemple:{name:'道观',footprint:2,cost:3200,maintenance:110,radius:12,bonus:3,height:1.2,description:'青瓦山门与太极庭院；传统文化交流、春节祈福与邻里互助'},
 mosque:{name:'清真寺',footprint:2,cost:3800,maintenance:125,radius:12,bonus:3,height:1.5,description:'穹顶礼拜厅与宣礼塔；社区公益、食物分享与开斋节相聚'},
};
for(const item of Object.values(RELIGIOUS_BUILDINGS))Object.assign(item,{category:'religion',service:'spiritual',icon:'landmark'});
