import {businessKindsFor} from './business-kinds.js';
import {COMMUNITY_BUILDINGS,isCommunityBusiness} from './community-buildings.js';

export const COMMERCIAL_STYLE_GROUPS=[
 {id:'food',label:'餐饮与夜生活',description:'咖啡、烘焙、小酒馆与各地餐饮，兼有 2×2 美食广场',tools:['cafe','bakery','kissaten','tavern','izakaya','diner','mediterranean','foodHall']},
 {id:'boutique',label:'特色商店街',description:'花店、书店、町家商馆与欧式拱廊，用橱窗和招牌形成步行商业街',tools:['flowerShop','bookstore','artDeco','oldStreet','japaneseMarket','europeanArcade']},
 {id:'services',label:'社区生活服务',description:'药店、洗衣、五金与汽车服务，依赖对应城市产业',tools:['pharmacy','laundry','hardware','repairGarage']},
 {id:'city',label:'街市与都会商业',description:'从传统市场、茶楼到办公、酒店和百货商场',tools:['market','teaHouse','office','hotel','departmentStore']},
 {id:'destinations',label:'商业娱乐设施',description:'提供岗位、商业税与休闲服务的城市目的地',tools:Object.keys(COMMUNITY_BUILDINGS).filter(isCommunityBusiness)},
];

export const commercialStyleGroup=kind=>COMMERCIAL_STYLE_GROUPS.find(group=>group.tools.includes(kind));
export const commercialConstructionKinds=()=>[
 ...businessKindsFor('commercial'),
 ...Object.keys(COMMUNITY_BUILDINGS).filter(isCommunityBusiness),
];
