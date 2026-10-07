import { businessKind } from './business-kinds.js';
export const BUILDING_STYLES = [
 {name:'河湾经典',wall:0xe6dcc1,trim:0xf3e9d0,roof:0x829d76,glass:0x638f91},
 {name:'江南雅居',wall:0xf2edda,trim:0xd9d2bc,roof:0x4c6261,glass:0x718d87,chinese:true},
 {name:'暖砖街区',wall:0xbe826a,trim:0xe9d4b1,roof:0x77695d,glass:0x557d80},
 {name:'现代玻璃',wall:0x7faaa7,trim:0xd9e3d7,roof:0x496d73,glass:0x416f7b},
 {name:'退台花园',wall:0xe3d7b9,trim:0xf5edda,roof:0x729568,glass:0x719a90},
 {name:'新中式',wall:0xd9d5c1,trim:0xb28b64,roof:0x466662,glass:0x62857f,chinese:true},
];
export const RESIDENTIAL_ROOFS = [
 {name:'砖红',color:0xa95f50}, {name:'陶土',color:0xbd8865},
 {name:'蓝灰',color:0x697f96}, {name:'深灰',color:0x626568},
 {name:'米砂',color:0xc2b394}, {name:'暖褐',color:0x927d70},
 {name:'雾蓝',color:0x8da5b1}, {name:'鼠尾草绿',color:0x8b9f7c},
];
export function residentialRoof(b){
 let hash=Math.imul(b.id||0,1597334677)^Math.imul((b.variant||0)+1,3812015801);
 hash=Math.imul(hash^(hash>>>16),2246822507);hash^=hash>>>13;
 return RESIDENTIAL_ROOFS[(hash>>>0)%RESIDENTIAL_ROOFS.length];
}
export function buildingStyle(b){
 const index=businessKind(b.businessKind)?.chinese?1:(b.variant||0)%BUILDING_STYLES.length,level=b.level||1;
 const variation=((b.id*17+(b.variant||0)*13)%11)/10;
 const floors=[1,3,6,9,12,16][level-1]+(variation>.7?1:0);
 const floorHeight=level===1?.27:level===2?.25:.27;
 const height=b.type==='industrial'?.65+level*.18:floors*floorHeight+.22+(BUILDING_STYLES[index].chinese ? .35 : .12);
 return {...BUILDING_STYLES[index],...(b.type==='residential'?{roof:residentialRoof(b).color}:{}),index,variation,floors,floorHeight,height,width:.64+variation*.12,depth:.58+(1-variation)*.14};
}
