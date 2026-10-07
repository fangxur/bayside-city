import {Euler,Quaternion,Vector3} from 'three';

// Reserved stone/bronze shades receive a subtle wash from the plinth uplights.
export const SCULPTURE_COLORS={marble:0xe6dfce,fold:0xcac3b1,bronze:0x627765,patina:0x8a9772};
const washColors=new Set(Object.values(SCULPTURE_COLORS));
export const isSculptureWash=(_kind,p)=>washColors.has(p[0]);
const uplightColors=new Map([[SCULPTURE_COLORS.marble,0xffebca],[SCULPTURE_COLORS.fold,0xdcc6a5],[SCULPTURE_COLORS.bronze,0xc3b383],[SCULPTURE_COLORS.patina,0xd0c395]]);
export const sculptureWashColor=color=>uplightColors.get(color)??color;

export function drawEuropeanSculpture(b,shape){
 const active=b.active!==false;
 const colors=Object.fromEntries(Object.entries(SCULPTURE_COLORS).map(([key,color])=>[key,active?color:color-0x010101]));
 const {marble,fold,bronze,patina}=colors,stone=0xc7c4b3,trim=0xe2dcc7,metal=0x756649;
 const box=(c,x,y,z,w,h,d,ry=0)=>shape('box',c,x,y,z,w,h,d,ry);
 const round=(c,x,y,z,w,h,d,ry=0,rx=0,rz=0)=>shape('crown',c,x,y,z,w,h,d,ry,rx,rz);
 const up=new Vector3(0,1,0),direction=new Vector3(),rotation=new Quaternion(),euler=new Euler();
 const limb=(c,from,to,w,d=w,kind='crown')=>{
  direction.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);const length=direction.length();
  rotation.setFromUnitVectors(up,direction.normalize());euler.setFromQuaternion(rotation);
  shape(kind,c,(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2,w,length+(kind==='crown'?w*.45:0),d,euler.y,euler.x,euler.z);
 };
 const arm=(c,shoulder,elbow,hand,w=.042)=>{
  limb(c,shoulder,elbow,w*1.2);round(c,...elbow,w,w,w);limb(c,elbow,hand,w);round(c,...hand,w*.95,w*1.3,w*.8);
 };
 const head=(c,x,y,z,s=1,angle=0)=>{
  shape('cylinder',c,x,y-.072*s,z,.033*s,.075*s,.035*s);
  round(c,x,y,z,.091*s,.122*s,.097*s,angle);
  round(c===marble?fold:patina,x,y+.033*s,z-.018*s,.094*s,.077*s,.087*s,angle);
  round(c,x+Math.sin(angle)*.047*s,y-.01*s,z+Math.cos(angle)*.047*s,.023*s,.034*s,.025*s,angle);
 };
 const figure=(x,y,z,s=1,angle=0)=>{
  // A weight-bearing leg and a relaxed knee keep the robe asymmetric.
  const local=(a,h,d)=>[x+(a*Math.cos(angle)+d*Math.sin(angle))*s,y+h*s,z+(-a*Math.sin(angle)+d*Math.cos(angle))*s];
  const form=(c,a,h,d,w,height,depth,rz=0)=>round(c,...local(a,h,d),w*s,height*s,depth*s,angle,0,rz);
  form(marble,-.042,.025,.022,.075,.045,.145);form(marble,.062,.035,.04,.07,.045,.135);
  limb(marble,local(-.02,.04,0),local(.025,.40,0),.18*s,.13*s);
  form(marble,.025,.40,0,.155,.18,.13);form(marble,.005,.535,0,.16,.21,.10,-.12);
  form(marble,0,.61,0,.205,.066,.12);
  for(let i=0;i<5;i++){
   const a=(i-2)*.031;
   limb(i%2?fold:marble,local(a-.014,.068,.056),local(a*.54+.023,.425,.058),.017*s,.018*s,'cylinder');
  }
  limb(fold,local(-.08,.59,.05),local(.065,.44,.062),.035*s,.022*s);
  head(marble,...local(.005,.73,.004),s,angle);return local;
 };
 const plinth=(kind='square',height=.39,width=.43,depth=width)=>{
  box(0xd7d2be,0,.037,0,.94,.06,.94);
  const block=(c,y,w,h,d)=>kind==='round'?shape('cylinder',c,0,y,0,w,h,d):box(c,0,y,0,w,h,d);
  block(0xb7b6a7,.093,width+.16,.06,depth+.16);
  block(trim,.145,width+.08,.048,depth+.08);
  block(stone,(height+.17)/2,width,height-.17,depth);
  block(trim,height+.016,width+.08,.048,depth+.08);
  box(metal,0,height*.61,depth/2+.008,.14,.055,.012);
  for(const side of [-1,1]){
   box(0x687162,side*.40,.105,.40,.087,.085,.087);
   box(active?0xffdfaa:0x8b8d84,side*.40,.155,.40,.061,.018,.061);
   box(0x91a178,side*.34,.079,-.33,.15,.035,.13);
  }
  return height+.04;
 };

 if(b.type==='laurelStatue'){
  const base=plinth(),p=figure(-.025,base,0,1.05,-.1);
  arm(marble,p(-.09,.60,0),p(-.15,.40,.01),p(-.06,.37,.085));
  arm(marble,p(.09,.60,0),p(.20,.73,.015),p(.23,.86,.02));
  const wreath=p(.235,.915,.02);
  shape('ring',metal,...wreath,.18,.18,.13,0,-.14);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   round(0xa29b68,wreath[0]+Math.cos(a)*.088,wreath[1]+Math.sin(a)*.088,wreath[2],.036,.061,.022,0,0,a-.4);
  }
  round(fold,-.05,base+.80,-.06,.07,.08,.07);
 }else if(b.type==='wingedVictory'){
  const base=plinth('square',.48,.34),p=figure(0,base,.05,1.03,.12);
  for(const side of [-1,1]){
   limb(fold,[side*.07,base+.54,-.01],[side*.24,base+.89,-.05],.13,.075);
   limb(marble,[side*.24,base+.89,-.05],[side*.33,base+1.04,-.04],.105,.052);
   for(let i=0;i<7;i++){
    const t=i/6;
    limb(i%2?fold:marble,[side*(.13+t*.10),base+.48+t*.32,-.065],[side*(.30+t*.115),base+.63+t*.43,-.04],.051,.037);
   }
   arm(marble,p(side*.085,.60,0),p(side*.15,.46,.07),p(side*.20,.50,.11));
  }
  // A trailing fold connects the wind-swept robe to the pedestal.
  limb(marble,[.02,base+.35,-.005],[-.15,base+.035,-.10],.115,.065);
 }else if(b.type==='thinkerStatue'){
  const base=plinth('square',.28,.42,.40);
  shape('rock',0x989b86,-.025,base+.15,-.035,.30,.31,.28);
  round(bronze,-.01,base+.31,-.018,.23,.14,.19);
  limb(bronze,[-.02,base+.32,0],[.005,base+.55,.105],.22,.14);
  round(bronze,.005,base+.55,.095,.25,.14,.16);
  head(bronze,.005,base+.68,.15,1.04,-.12);
  for(const side of [-1,1]){
   arm(bronze,[side*.073,base+.31,0],[side*.12,base+.26,.18],[side*.12,base+.065,.20],.095);
   round(bronze,side*.12,base+.03,.23,.081,.057,.14);
  }
  arm(bronze,[.105,base+.55,.10],[.12,base+.32,.205],[.038,base+.62,.205],.057);
  arm(bronze,[-.105,base+.55,.10],[-.16,base+.38,.12],[-.12,base+.275,.20],.057);
  limb(patina,[-.05,base+.35,-.06],[-.06,base+.54,.025],.043,.03);
 }else if(b.type==='equestrianStatue'){
  const base=plinth('square',.33,.64,.33),hip=base+.39;
  round(bronze,-.045,hip,0,.49,.235,.22);
  round(bronze,-.22,hip+.015,0,.24,.255,.215);
  limb(bronze,[.12,hip+.01,0],[.24,hip+.28,0],.16,.145);
  round(bronze,.26,hip+.285,.005,.185,.135,.12,0,0,.2);
  round(bronze,.33,hip+.245,.005,.145,.082,.10,0,0,-.4);
  for(const z of [-.045,.045])shape('cone',bronze,.23,hip+.395,z,.048,.10,.036,0,0,-.20);
  for(const z of [-.077,.077]){
   arm(bronze,[-.21,hip-.06,z],[-.26,base+.17,z],[-.21,base+.035,z],.063);
   box(0x465743,-.205,base+.03,z,.088,.054,.067);
   if(z<0){arm(bronze,[.105,hip-.06,z],[.16,base+.21,z],[.12,base+.033,z],.055);box(0x465743,.12,base+.03,z,.084,.045,.06);}
   else{arm(bronze,[.105,hip-.06,z],[.245,base+.245,z],[.25,base+.15,z],.055);box(0x465743,.275,base+.135,z,.083,.046,.06);}
  }
  limb(bronze,[-.31,hip+.035,0],[-.39,hip-.16,0],.063,.052);
  limb(bronze,[-.39,hip-.16,0],[-.35,hip-.26,.015],.065,.043);
  for(let i=0;i<5;i++)round(patina,.13+i*.016,hip+.08+i*.049,-.005,.065,.067,.165);
  box(metal,-.045,hip+.117,0,.19,.032,.235);
  round(bronze,-.055,hip+.18,0,.18,.15,.15);
  limb(bronze,[-.055,hip+.19,0],[-.065,hip+.41,0],.17,.11);
  round(bronze,-.065,hip+.40,0,.23,.08,.115);
  head(bronze,-.065,hip+.52,0,1.04,Math.PI/2);
  shape('dome',patina,-.065,hip+.54,0,.12,.095,.115);
  round(patina,-.08,hip+.615,0,.05,.065,.105);
  limb(patina,[-.12,hip+.385,-.018],[-.255,hip+.08,-.02],.19,.055);
  for(const side of [-1,1]){
   arm(bronze,[-.05,hip+.18,side*.05],[.055,hip+.035,side*.145],[-.005,hip-.105,side*.155],.068);
   arm(bronze,[-.065,hip+.39,side*.078],[.075,hip+.29,side*.11],[.155,hip+.315,side*.048],.043);
   limb(metal,[.155,hip+.315,side*.048],[.31,hip+.225,side*.065],.012,.012,'cylinder');
   box(bronze,.015,hip-.13,side*.156,.09,.038,.047);
  }
 }else if(b.type==='threeGraces'){
  const base=plinth('round',.29,.60),figures=[[-.17,-.035,.25],[0,.09,0],[.17,-.035,-.25]];
  const poses=figures.map(([x,z,angle],i)=>figure(x,base+(i===1?.035:0),z,.91,angle));
  poses.forEach((p,i)=>{
   for(const side of [-1,1]){
    const outer=i===0&&side<0||i===2&&side>0;
    arm(marble,p(side*.085,.60,0),p(side*(outer?.155:.13),outer?.44:.58,.035),p(side*(outer?.095:.14),outer?.36:.49,.08),.033);
   }
  });
  for(const side of [-1,1])for(let i=0;i<3;i++)round([0xc88f7e,0xe0be80,0xac97a9][i],side*(.32+i*.023),.12,-.31+i*.052,.064,.061,.064);
 }
}
