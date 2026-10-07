import {BUSINESS_KINDS,businessKind} from './business-kinds.js';
import {COMMUNITY_BUILDINGS,isCommunityBusiness} from './community-buildings.js';
import {DECORATIONS} from './decorations.js';
import {LANDMARKS} from './landmarks.js';
import {utilityScale} from './utility-buildings.js';
import {requiresRoad} from './building-access.js';

const STAFF_GROWTH=[1,1.25,1.55,1.9,2.3,2.8];
const PUBLIC_ROLES={
  medical:{label:'医生与医护人员',base:{clinic:8,hospital:36}},
  fire:{label:'消防员',base:{fireStation:8}},
  education:{label:'教师与教职工',base:{school:12}},
  government:{label:'政府工作人员',base:{cityHall:12,districtOffice:6}},
  utilities:{label:'水电运维人员',base:{power:6,water:5}},
  culture:{label:'公共文化人员',base:{library:8,grandGallery:24}},
  sports:{label:'公共体育人员',base:{sportsHall:10,stadium:20,grandStadium:60}},
};
const PUBLIC_ORDER=Object.keys(PUBLIC_ROLES);
const LEISURE_ROLES={
  performance:{label:'演艺与休闲服务',base:{operaStage:10,chessPavilion:3,marina:12}},
  community:{label:'社区与宗教服务',base:{chapel:4,gothicCathedral:16,domedCathedral:18,buddhistTemple:6,taoistTemple:6,mosque:6}},
  parks:{label:'园林与场地维护',base:{park:2,plaza:4,citySculpture:1,stoneLions:1,flowerBed:1,stoneLantern:1}},
  tourism:{label:'文博与城市景点',base:{landmark:5,lighthouse:3,pagoda:4,museum:12,observatory:8,orientalPearl:18,cantonTower:22,empireState:20,eiffelTower:18,bigBen:12}},
};

const sum=(items,key)=>items.reduce((total,item)=>total+(Number(item[key])||0),0);
const levelFactor=b=>STAFF_GROWTH[Math.max(0,Math.min(STAFF_GROWTH.length-1,(b.level||1)-1))];
const roleEntry=(roles,type)=>Object.entries(roles).find(([,role])=>Object.hasOwn(role.base,type));
const complete=b=>(b.progress??0)>=1;
const operational=b=>complete(b)&&b.active!==false&&(!requiresRoad(b.type)||!!b.connected)&&!!b.powered&&!!b.watered;
const staffFor=(b,base)=>complete(b)?Math.max(1,Math.round(base*levelFactor(b)*utilityScale(b))):0;

function emptyRow(key,label,kind){return {key,label,kind,places:0,workers:0,positions:0,tax:0,privatePayroll:0,publicPayroll:0};}
function addBuilding(row,b,{publicBase=0,privateJob=false}={}){
  row.places++;
  if(publicBase){const positions=staffFor(b,publicBase);row.positions+=positions;if(operational(b))row.workers+=positions;}
  if(privateJob){row.positions+=Number(b.jobs)||0;row.workers+=Number(b.workers)||0;row.tax+=Number(b.taxContribution)||0;row.privatePayroll+=Number(b.monthlyPayroll)||0;}
  row.publicPayroll+=Number(b.publicPayroll)||0;
}
function finishRows(rows){
  return rows.map(row=>({...row,tax:Math.round(row.tax),privatePayroll:Math.round(row.privatePayroll),publicPayroll:Math.round(row.publicPayroll),payroll:Math.round(row.privatePayroll+row.publicPayroll)}));
}
function section(id,label,note,rows){
  rows=finishRows(rows);
  return {id,label,note,rows,places:sum(rows,'places'),workers:sum(rows,'workers'),positions:sum(rows,'positions'),tax:sum(rows,'tax'),privatePayroll:sum(rows,'privatePayroll'),publicPayroll:sum(rows,'publicPayroll'),payroll:sum(rows,'payroll')};
}

function publicRows(buildings){
  const rows=new Map(PUBLIC_ORDER.map(key=>[key,emptyRow(key,PUBLIC_ROLES[key].label,'public')]));
  for(const b of buildings){
    const match=roleEntry(PUBLIC_ROLES,b.type);if(!match)continue;
    const [key,role]=match;addBuilding(rows.get(key),b,{publicBase:role.base[b.type]});
  }
  return [...rows.values()];
}
function leisureRows(buildings){
  const rows=new Map();
  for(const b of buildings){
    if(isCommunityBusiness(b.type))continue;
    let match=roleEntry(LEISURE_ROLES,b.type);
    if(!match&&(Object.hasOwn(LANDMARKS,b.type)||Object.hasOwn(DECORATIONS,b.type)))match=['tourism',LEISURE_ROLES.tourism];
    if(!match&&['entertainment','religion'].includes(COMMUNITY_BUILDINGS[b.type]?.category))match=['performance',LEISURE_ROLES.performance];
    if(!match)continue;
    const [key,role]=match;
    if(!rows.has(key))rows.set(key,emptyRow(key,role.label,'entertainment'));
    const fallback=Math.max(1,Math.round((COMMUNITY_BUILDINGS[b.type]?.maintenance||LANDMARKS[b.type]?.maintenance||DECORATIONS[b.type]?.maintenance||30)/30));
    addBuilding(rows.get(key),b,{publicBase:role.base[b.type]||fallback});
  }
  return ['performance','community','parks','tourism'].map(key=>rows.get(key)).filter(Boolean);
}
function privateRows(buildings,zone){
  const rows=new Map();
  for(const b of buildings){
    const isSpecial=zone==='commercial'&&isCommunityBusiness(b.type);
    if(b.type!==zone&&!isSpecial)continue;
    const kind=isSpecial?b.type:b.businessKind||`${zone}-general`;
    const label=isSpecial?COMMUNITY_BUILDINGS[b.type].name:(businessKind(b.businessKind)?.name||(zone==='commercial'?'综合商业':'综合工业'));
    if(!rows.has(kind))rows.set(kind,emptyRow(kind,label,zone));
    addBuilding(rows.get(kind),b,{privateJob:true});
  }
  const order=Object.keys(BUSINESS_KINDS).filter(key=>BUSINESS_KINDS[key].zone===zone);
  return [...rows.values()].sort((a,b)=>{
    const ai=order.indexOf(a.key),bi=order.indexOf(b.key);
    return (ai<0?999:ai)-(bi<0?999:bi)||a.label.localeCompare(b.label,'zh-CN');
  });
}

export function workforceDashboard(state){
  const buildings=state?.buildings||[],stats=state?.stats||{},breakdown=stats.breakdown||{};
  const sections=[
    section('public','事业单位与公共服务','在岗人数按已建成且正常运行的设施统计；岗位随设施等级扩大。',publicRows(buildings)),
    section('commercial','商业行业','经营税和企业工资均按实际到岗人数计算。',privateRows(buildings,'commercial')),
    section('industrial','工业行业','不同工厂分别列出岗位、工资与经营税贡献。',privateRows(buildings,'industrial')),
    section('entertainment','文化娱乐与休闲','包括演艺、宗教社区、园林维护和城市景点人员。',leisureRows(buildings)),
  ];
  const privateSections=sections.filter(item=>['commercial','industrial'].includes(item.id));
  const publicSections=sections.filter(item=>['public','entertainment'].includes(item.id));
  return {sections,summary:{
    privateWorkers:sum(privateSections,'workers'),publicWorkers:sum(publicSections,'workers'),
    positions:sum(sections,'positions'),businessTax:Math.round((breakdown.commercialIncome||0)+(breakdown.industrialIncome||0)),
    enterprisePayroll:Math.round(breakdown.enterprisePayroll||0),publicPayroll:Math.round(breakdown.publicPayroll||0),
  }};
}
