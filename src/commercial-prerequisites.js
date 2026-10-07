import {BUSINESS_KINDS,businessKindsFor} from './business-kinds.js';
export const COMMERCIAL_FACTORIES={
 market:'foodFactory',cafe:'foodFactory',bakery:'foodFactory',kissaten:'foodFactory',foodHall:'foodFactory',diner:'foodFactory',mediterranean:'foodFactory',teaHouse:'foodFactory',
 tavern:'brewery',izakaya:'brewery',oldStreet:'textile',flowerShop:'textile',japaneseMarket:'textile',artDeco:'furniture',bookstore:'furniture',europeanArcade:'furniture',hotel:'furniture',departmentStore:'furniture',office:'electronics',
 pharmacy:'pharmaceutical',repairGarage:'carFactory',laundry:'textile',hardware:'machinery',
};
export function commercialPrerequisite(state,kind){
 const required=COMMERCIAL_FACTORIES[kind];
 if(kind&&!required)return {allowed:true,reason:''};
 const ready=b=>b.type==='industrial'&&b.progress>=1&&b.active&&b.connected&&b.powered&&b.watered;
 if(!required){
  const allowed=Object.values(COMMERCIAL_FACTORIES).some(factory=>state.buildings.some(b=>b.businessKind===factory&&ready(b)));
  return {allowed,reason:allowed?'':'需先建成并运行一种商业供应工厂，才能规划混合商业'};
 }
 const name=BUSINESS_KINDS[required].name;
 const allowed=state.buildings.some(b=>b.businessKind===required&&ready(b));
 return {allowed,required,name,reason:allowed?'':`需先建成并运行${name}（完成施工、启用并接通道路水电）`};
}
export const availableCommercialKinds=state=>businessKindsFor('commercial').filter(kind=>commercialPrerequisite(state,kind).allowed);

// A matching factory is an opening prerequisite, not an exclusive delivery contract.
export function commercialSupply(state,shop){
 const required=COMMERCIAL_FACTORIES[shop.businessKind];
 if(!required)return null;
 const suppliers=state.buildings.filter(b=>b.type==='industrial'&&b.businessKind===required).map(b=>{
  const missing=[];
  if(b.progress<1)missing.push('施工中');
  if(!b.active)missing.push('已停用');
  if(!b.connected)missing.push('道路未接通');
  if(!b.powered)missing.push('缺电');
  if(!b.watered)missing.push('缺水');
  return {id:b.id,x:b.x,y:b.y,ready:!missing.length,status:missing.length?missing.join('、'):'运行正常'};
 }).sort((a,b)=>Number(b.ready)-Number(a.ready)||Math.hypot(a.x-shop.x,a.y-shop.y)-Math.hypot(b.x-shop.x,b.y-shop.y));
 return {required,name:BUSINESS_KINDS[required].name,suppliers};
}
