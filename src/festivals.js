// Fictional monthly city calendar: lunar / regional dates are intentionally simplified.
export const FESTIVALS = [
 {id:'eid',month:4,name:'开斋节',symbol:'☾',activity:'节日相聚与互助',description:'自愿参加社区相聚、分享食物并关怀街坊。游戏固定安排在四月，现实日期每年变化。',venues:['mosque']},
 {id:'buddhaBirthday',month:5,name:'浴佛节',symbol:'🪷',activity:'庭院文化交流',description:'了解传统、分享素食，在庭院交流与休息。游戏固定安排在五月，不对应现实历法。',venues:['buddhistTemple','market']},
 {id:'newYear',month:1,name:'新年',symbol:'🎉',activity:'迎新相聚',description:'和街坊互道新年祝福，聊聊新一年的愿望。',venues:['cafe','diner','tavern']},
 {id:'springFestival',month:2,name:'春节',symbol:'🏮',activity:'新春团圆',description:'约街坊喝茶拜年，交换新春祝福，一起感受团圆的热闹。',venues:['teaHouse','oldStreet','market']},
 {id:'holi',month:3,name:'洒红节',symbol:'🌈',activity:'春日色彩聚会',description:'和邻居聊聊春天的色彩，分享甜点与节日祝福。',venues:['bakery','cafe','mediterranean']},
 {id:'dragonBoat',month:6,name:'端午节',symbol:'🐉',activity:'邻里粽香',description:'和街坊聊聊家乡的粽子口味，分享端午故事。',venues:['market','teaHouse','oldStreet']},
 {id:'midAutumn',month:9,name:'中秋节',symbol:'🥮',activity:'月饼与团圆',description:'约邻居分享月饼，聊聊家人和各自的团圆记忆。',venues:['bakery','teaHouse','cafe']},
 {id:'halloween',month:10,name:'万圣节',symbol:'🎃',activity:'南瓜主题聚会',description:'和街坊交流装扮点子，一起聊聊有趣的南瓜与糖果故事。',venues:['tavern','bakery','diner']},
 {id:'diwali',month:11,name:'排灯节',symbol:'🪔',activity:'灯火与祝福',description:'和邻居分享甜点、谈谈灯火装饰，为彼此送上祝福。',venues:['bakery','artDeco','cafe']},
 {id:'christmas',month:12,name:'圣诞节',symbol:'🎄',activity:'冬日暖聚',description:'约街坊喝杯热饮、挑选小礼物、看看街区灯饰，分享冬日里的温暖。',venues:['bakery','tavern','artDeco','cafe','teaHouse','diner','market','oldStreet','park','plaza','library','chapel','gothicCathedral','domedCathedral']},
].sort((a,b)=>a.month-b.month);
export const FESTIVAL_CALENDAR_NOTE='游戏节庆按固定月份循环；农历及各地节日日期已简化，不对应现实公历。';
export function festivalForMonth(absoluteMonth){
 if(!Number.isInteger(absoluteMonth)||absoluteMonth<1)return null;
 const festival=FESTIVALS.find(f=>f.month===(absoluteMonth-1)%12+1);
 return festival?{...festival,year:Math.floor((absoluteMonth-1)/12)+1,occurrence:`${Math.floor((absoluteMonth-1)/12)+1}:${festival.id}`}:null;
}
