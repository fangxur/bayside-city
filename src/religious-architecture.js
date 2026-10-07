import {RELIGIOUS_BUILDINGS} from './religious-buildings.js';
import {drawCathedral} from './cathedral-architecture.js';
import {drawBuddhistTemple} from './chinese-courtyard-architecture.js';
export function drawReligiousBuilding(batch,b){
 const n=b.footprint||RELIGIOUS_BUILDINGS[b.type].footprint,l=b.level||1,x=b.x-31.5+(n-1)/2,z=b.y-31.5+(n-1)/2;
 const box=(c,a,h,d,w,y,depth)=>batch.box(c,x+a*n,h,z+d*n,w*n,y,depth*n);
 const shape=(k,c,a,h,d,w,y,depth,ry=0,rx=0,rz=0)=>batch.add(k,c,x+a*n,h,z+d*n,w*n,y,depth*n,ry,rx,rz);
 if(b.type==='buddhistTemple'){drawBuddhistTemple(b,shape,box);return;}
 const wall=0xeee1c8,stone=0xc9c5ad,wood=0x855442;
 box(stone,0,.025,0,.94,.05,.94);box(0xe7ddc3,0,.058,0,.88,.025,.88);
 if(RELIGIOUS_BUILDINGS[b.type].architecture==='cathedral'){drawCathedral(b,n,box,shape);}
 else if(b.type==='chapel'){
  box(wall,0,.34,.02,.48,.53,.68);shape('roof',0x6a7777,0,.68,.02,.57,.30,.78);
  box(wall,-.22,.56,.26,.20,.98,.22);shape('cone',0x557769,-.22,1.12,.26,.29,.26,.29);
  box(0xa17a42,-.22,1.35,.26,.028,.22,.028);box(0xa17a42,-.22,1.37,.26,.15,.027,.028);
  box(wood,0,.20,.365,.17,.28,.025);
  for(const a of [-.15,.15]){box(0x709da6,a,.45,.365,.09,.17,.025);box(0xd7a95c,a,.45,.381,.012,.17,.01);}
  for(const d of [-.20,.02,.23])for(const a of [-.247,.247])box(0x80a4ac,a,.40,d,.018,.20,.1);
 }else if(b.type==='mosque'){
  box(wall,0,.36,-.10,.58,.59,.51);box(0xa4b9a3,0,.68,-.10,.63,.065,.56);
  shape('dome',0x529c97,0,.72,-.1,.48,.64,.43);shape('cylinder',0xc5a963,0,1.08,-.1,.018,.15,.018);
  for(const a of [-.17,0,.17]){box(0x4e7775,a,.3,.165,.09,.35,.018);shape('dome',0x4e7775,a,.475,.165,.09,.12,.02);}
  shape('cylinder',wall,.36,.65,-.30,.115,1.2,.115);shape('cylinder',0xd1bb7c,.36,1.17,-.30,.17,.08,.17);shape('dome',0x529c97,.36,1.28,-.30,.15,.32,.15);
  for(const a of [-.33,.33])for(const d of [.23,.36])shape('cylinder',wall,a,.28,d,.032,.43,.032);
  box(0xa4b9a3,0,.52,.34,.76,.06,.20);
 }else{
  const roof=b.type==='buddhistTemple'?0xb77b42:0x527971;
  box(wall,0,.29,-.18,.62,.43,.40);
  for(const a of [-.25,-.10,.10,.25])box(wood,a,.32,.035,.035,.48,.035);
  shape('roof',roof,0,.60,-.18,.77,.25,.54);shape('roof',roof,0,.76,-.18,.59,.20,.43);
  box(roof,0,.90,-.18,.60,.045,.035);
  for(const a of [-.35,.35])shape('roof',roof,a,.71,-.18,.10,.18,.53);
  for(const a of [-.37,.37]){box(wall,a,.19,.18,.13,.28,.36);shape('roof',roof,a,.37,.18,.19,.15,.42);}
  for(const a of [-.20,.20])box(wood,a,.24,.38,.04,.42,.04);
  shape('roof',roof,0,.48,.38,.56,.19,.18);
  if(b.type==='buddhistTemple'){
   shape('cylinder',0x877458,0,.17,.16,.13,.15,.13);shape('ring',0xb59a5b,0,.26,.16,.14,.14,.14);
   for(const a of [-.035,0,.035])box(0xa9703d,a,.34,.16,.009,.20,.009);
  }else{
   shape('cylinder',0x5d6962,0,.083,.15,.23,.018,.23);shape('cylinder',0xefead5,-.04,.097,.15,.11,.015,.18);shape('cylinder',0xefead5,.04,.10,.12,.035,.02,.035);shape('cylinder',0x5d6962,-.04,.11,.18,.035,.02,.035);
  }
 }
 // Higher tiers retain their identity and footprint, adding garden and craft details.
 for(let i=0;i<Math.min(l+1,6);i++){
  const a=i%2?-.40:.40,d=-.37+Math.floor(i/2)*.32;
  box(0x9a9275,a,.11,d,.095,.10,.095);shape('crown',0x729759,a,.24,d,.15,.22,.15);
 }
 if(l>=3)for(const a of [-.29,.29]){box(0xac935d,a,.15,.43,.015,.22,.015);shape('crown',0xffd388,a,.29,.43,.06,.08,.06);}
 if(l>=5)box(0xc8ad69,0,.079,.41,.36,.018,.045);
}
