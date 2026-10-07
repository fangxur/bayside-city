import {Euler,Quaternion,Vector3} from 'three';
import {LANDMARK_LIGHT_COLORS} from './night-lighting.js';
export function drawCathedral(b,n,box,shape){
 const wall=0xe5ddc9,stone=0xc9bea3,trim=0xf1e8d4,roof=0x58646c,dark=0x526c7c;
 const lit=c=>b.active===false?0x89918a:c;
 const beam=(a,d,color=stone,width=.035)=>{
  const v=new Vector3((d[0]-a[0])*n,d[1]-a[1],(d[2]-a[2])*n);
  const e=new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),v.clone().normalize()));
  shape('cylinder',color,(a[0]+d[0])/2,(a[1]+d[1])/2,(a[2]+d[2])/2,width/n,v.length(),width/n,e.y,e.x,e.z);
 };
 const pointed=(x,y,z,w,h)=>{
  box(lit(dark),x,y+h*.38,z,w,h*.76,.013);shape('roof',lit(dark),x,y+h*.76,z,w,h*.24,.014);
  for(const side of [-1,1])box(stone,x+side*(w/2+.012),y+h*.38,z+.009,.018,h*.80,.018);
  beam([x-w/2,y+h*.76,z+.009],[x,y+h,z+.009],trim,.028);
  beam([x+w/2,y+h*.76,z+.009],[x,y+h,z+.009],trim,.028);
  box(stone,x,y+h*.36,z+.017,.009,h*.70,.012);
 };
 const cross=(x,y,z)=>{box(lit(LANDMARK_LIGHT_COLORS.gold),x,y,z,.012,.19,.012);box(lit(LANDMARK_LIGHT_COLORS.gold),x,y+.027,z,.065,.022,.012);};
 if(b.type==='gothicCathedral'){
  // Twin square west towers, long nave, transept and a ring of rear chapels.
  box(wall,0,.61,-.045,.35,1.09,.65);shape('roof',roof,0,1.18,-.045,.39,.61,.70);
  box(wall,0,.57,-.04,.69,1.00,.20);shape('roof',roof,0,1.10,-.04,.73,.45,.25,Math.PI/2);
  shape('cylinder',wall,0,.56,-.32,.35,1.0,.30);shape('cone',roof,0,1.17,-.32,.38,.35,.34);
  for(const side of [-1,1])for(const z of [-.27,-.10,.075]){
   box(stone,side*.33,.49,z,.06,.85,.055);shape('cone',trim,side*.33,1.005,z,.065,.19,.065);
   beam([side*.33,.91,z],[side*.26,1.14,z],trim,.055);
   beam([side*.26,1.14,z],[side*.175,1.29,z],trim,.055);
   beam([side*.33,.69,z],[side*.175,1.04,z],stone,.034);
   box(lit(dark),side*.179,.84,z,.014,.33,.055);
  }
  box(wall,0,.75,.30,.73,1.38,.17);
  for(const side of [-1,1]){
   box(wall,side*.267,1.10,.275,.20,2.06,.22);
   for(const x of [-.077,.077])box(trim,side*.267+x,1.12,.397,.017,2.10,.025);
   box(stone,side*.267,1.48,.275,.22,.08,.24);
   box(trim,side*.267,2.17,.275,.235,.10,.25);
   for(const dx of [-.042,.042])pointed(side*.267+dx,1.57,.397,.050,.42);
   for(const z of [.19,.26,.33])box(lit(dark),side*.372,1.78,z,.012,.31,.043);
   for(const dx of [-.09,.09])for(const dz of [-.10,.10])box(trim,side*.267+dx,2.265,.275+dz,.029,.16,.03);
  }
  for(const x of [-.235,0,.235])pointed(x,.11,.416,.13,.59);
  for(const y of [.77,1.51])box(trim,0,y,.410,.735,.048,.039);
  for(let i=0;i<11;i++){const x=(i-5)*.052;box(stone,x,.92,.415,.012,.22,.025);shape('crown',trim,x,.985,.421,.023,.10,.023);}
  // The rose faces the street: a ring of colored panes with radial stone tracery.
  shape('ring',stone,0,1.23,.419,.158,.474,.027);
  shape('cylinder',lit(dark),0,1.23,.421,.14,.025,.14,0,Math.PI/2);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=Math.cos(a)*.052,y=1.23+Math.sin(a)*.156;
   shape('crown',lit(i%2?LANDMARK_LIGHT_COLORS.cyan:LANDMARK_LIGHT_COLORS.pink),x,y,.437,.036,.11,.012);
   beam([0,1.23,.447],[Math.cos(a)*.071,1.23+Math.sin(a)*.213,.447],trim,.018);
  }
  shape('cylinder',stone,0,1.23,.453,.038,.018,.038,0,Math.PI/2);
  shape('cylinder',roof,0,1.87,-.035,.075,.46,.075);shape('cone',roof,0,2.35,-.035,.14,.75,.14);
  shape('cylinder',stone,0,2.81,-.035,.016,.21,.016);cross(0,3.005,-.035);
 }else{
  // Classical longitudinal nave, columned west portico and a prominent lead dome.
  box(wall,0,.52,-.06,.47,.91,.65);box(wall,0,.47,-.045,.78,.81,.22);
  shape('roof',roof,0,1.00,-.08,.52,.23,.66);
  for(const side of [-1,1])for(const z of [-.27,-.10,.08]){
   box(trim,side*.242,.49,z,.028,.87,.025);box(lit(dark),side*.255,.58,z,.015,.33,.07);
   box(trim,side*.30,.945,-.045,.20,.075,.25);
  }
  shape('cylinder',stone,0,1.15,-.07,.43,.25,.43);
  shape('cylinder',wall,0,1.49,-.07,.39,.50,.39);
  for(let i=0;i<16;i++){
   const a=i*Math.PI/8,x=Math.cos(a)*.191,z=-.07+Math.sin(a)*.191;
   shape('cylinder',trim,x,1.49,z,.020,.50,.020);
   shape('box',lit(dark),Math.cos(a+.10)*.194,1.50,-.07+Math.sin(a+.10)*.194,.033,.27,.012,Math.PI/2-a-.10);
  }
  shape('cylinder',trim,0,1.775,-.07,.435,.075,.435);
  shape('dome',roof,0,1.82,-.07,.44,1.23,.44);
  shape('cylinder',stone,0,2.46,-.07,.14,.12,.14);
  shape('cylinder',wall,0,2.69,-.07,.10,.35,.10);
  for(const a of [-.034,.034])box(lit(dark),a,2.70,-.017,.022,.19,.012);
  shape('dome',roof,0,2.88,-.07,.145,.32,.145);shape('crown',lit(LANDMARK_LIGHT_COLORS.gold),0,3.08,-.07,.038,.10,.038);cross(0,3.27,-.07);
  box(stone,0,.10,.35,.72,.10,.21);box(trim,0,.16,.35,.66,.045,.17);
  box(wall,0,.63,.29,.62,.89,.12);
  for(const x of [-.25,-.15,-.05,.05,.15,.25]){
   shape('cylinder',trim,x,.63,.39,.029,.92,.029);
   box(stone,x,.22,.39,.052,.065,.052);box(trim,x,1.095,.39,.052,.065,.052);
  }
  box(trim,0,1.17,.35,.69,.115,.23);shape('roof',stone,0,1.225,.35,.69,.29,.23);
  for(const x of [-.14,0,.14])box(lit(dark),x,.49,.361,.066,.51,.012);
  for(const side of [-1,1]){
   const x=side*.302;box(wall,x,1.18,.24,.15,.99,.18);
   box(trim,x,1.70,.24,.19,.08,.21);shape('cylinder',wall,x,1.85,.24,.115,.24,.115);
   shape('dome',roof,x,2.00,.24,.155,.33,.155);shape('crown',lit(LANDMARK_LIGHT_COLORS.gold),x,2.24,.24,.026,.10,.026);
   pointed(x,1.24,.338,.067,.30);
  }
 }
 // Lamps sit on the forecourt instead of competing with the roof silhouette.
 for(const x of [-.39,.39]){box(stone,x,.11,.42,.08,.12,.08);shape('crown',lit(LANDMARK_LIGHT_COLORS.gold),x,.25,.42,.034,.12,.034);}
}
