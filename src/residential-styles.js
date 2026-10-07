import {BUSINESS_KINDS} from './business-kinds.js';
import {JAPANESE_HOME_KINDS} from './japanese-residential.js';
export const RESIDENTIAL_STYLE_GROUPS=[
 {id:'europeanStreet',label:'欧洲城市街区',description:'统一檐口与克制配色，适合沿街、滨河成片建设',tools:['parisApartment','seineTownhouse','londonTerrace','thamesWarehouse','dutch']},
 {id:'europeanGarden',label:'欧洲花园与乡居',description:'庭院、公馆与独立住宅，适合低密度社区',tools:['french','british','spanish','italian','nordic','chalet']},
 {id:'chinese',label:'中式院落与地域民居',description:'传统院落与地域建筑',tools:Object.keys(BUSINESS_KINDS).filter(id=>BUSINESS_KINDS[id].zone==='residential'&&BUSINESS_KINDS[id].chinese)},
 {id:'japanese',label:'日式住宅',description:'町屋街巷、庭院和宅、合掌乡居与现代阳台公寓',tools:[...JAPANESE_HOME_KINDS]},
];
export const residentialStyleGroup=kind=>RESIDENTIAL_STYLE_GROUPS.find(group=>group.tools.includes(kind));
