const tier=b=>Math.max(1,Math.min(6,b.level||1));
const teaTop=b=>.83+(tier(b)-1)*.043;
const templeTop=b=>.62+(tier(b)-1)*.024;
export const teaHouseHeight=b=>teaTop(b)+.26;
export const buddhistTempleHeight=b=>templeTop(b)+.43;

// Normalized lot coordinates: the caller scales X/Z to the saved footprint.
// Only upright or Y-rotated pieces are used, so roofs stay proportionate on 2×2 lots.
function courtyardParts(b,shape,box){
 const tile=0x171b1b,ridge=0x101414,wood=0x674735,stone=0xb8b2a0;
 const glass=b.active===false?0x92958e:0x8ba096,lamp=b.active===false?0x92958e:0xffdfaa;
 const roof=(x,z,w,d,y,rise=.10)=>{
  box(0x252a28,x,y,z,w,.024,d);
  shape('mansard',tile,x,y+rise/2,z,w,rise,d);
  shape('roof',tile,x,y+rise,z,d*.66,.055,w*.66,Math.PI/2);
  box(ridge,x,y+rise+.066,z,w*.69,.025,.027);
  // Fine tile courses and lifted corner tiles outline the low, wide eaves.
  for(const side of [-1,1]){
   for(const t of [.30,.64])box(0x303633,x,y+rise*t+.005,z+side*d*(.5-.17*t),w*(1-.34*t),.006,.009);
   for(const end of [-1,1])shape('roof',tile,x+side*(w/2-.037),y+.014,z+end*(d/2-.028),.069,.034,.053,Math.PI/2);
  }
 };
 const screen=(x,y,z,w,h)=>{
  box(wood,x,y,z,w+.025,h+.027,.023);box(glass,x,y,z+.018,w,h,.014);
  for(let i=0;i<5;i++)box(wood,x-w*.43+i*w*.215,y,z+.030,.008,h,.012);
  for(const off of [-.26,.26])box(wood,x,y+h*off,z+.031,w,.009,.012);
 };
 const sideWindow=(x,y,z,w,h)=>{
  box(wood,x,y,z,.022,h+.025,w+.025);box(glass,x+Math.sign(x)*.017,y,z,.014,h,w);
  for(const side of [-1,0,1])box(wood,x+Math.sign(x)*.029,y,z+side*w*.32,.011,h,.008);
 };
 const lantern=(x,y,z)=>{
  box(wood,x,y+.08,z,.009,.07,.009);
  shape('cylinder',b.active===false?0x925a43:0xba7252,x,y,z,.059,.083,.059);
  for(const dy of [-.045,.045])box(0xc3a369,x,y+dy,z,.058,.009,.058);
  box(lamp,x,y,z+.032,.015,.045,.009);box(0xb19253,x,y-.07,z,.010,.045,.010);
 };
 const tree=(x,z,scale=1)=>{
  box(wood,x,.19*scale+.05,z,.020,.26*scale,.022);
  shape('crown',0x647f50,x-.025*scale,.31*scale+.05,z,.15*scale,.19*scale,.14*scale);
  shape('crown',0x7a915c,x+.035*scale,.26*scale+.05,z+.02,.13*scale,.13*scale,.14*scale);
 };
 const stoneLamp=(x,z)=>{
  box(stone,x,.09,z,.077,.06,.077);box(stone,x,.17,z,.028,.13,.028);
  box(lamp,x,.25,z,.051,.075,.051);roof(x,z,.103,.103,.298,.019);
 };
 return {roof,screen,sideWindow,lantern,tree,stoneLamp,wood,stone,lamp};
}

export function drawTeaHouse(b,shape,box){
 const l=tier(b),top=teaTop(b),wall=0xece5d2;
 const {roof,screen,sideWindow,lantern,tree,wood,stone,lamp}=courtyardParts(b,shape,box);
 box(stone,0,.035,0,.97,.07,.97);box(0xd7cbb0,0,.083,-.015,.90,.027,.87);
 // A broad ground-floor tea room and a recessed upper room make two readable eaves.
 box(wall,0,.305,-.14,.72,.42,.54);box(wall,0,(.54+top)/2,-.17,.58,top-.54,.39);
 roof(0,-.135,.91,.68,.49,.078);roof(0,-.17,.85,.61,top+.025,.125);
 for(const x of [-.31,0,.31])box(wood,x,.30,.149,.029,.43,.029);
 for(const x of [-.23,.23])screen(x,.29,.142,.17,.24);
 box(wood,0,.26,.147,.14,.32,.030);box(lamp,0,.32,.167,.085,.15,.013);
 for(const x of [-.19,0,.19])screen(x,top-.135,.034,.12,.185);
 for(const side of [-1,1]){
  sideWindow(side*.367,.30,-.14,.25,.23);sideWindow(side*.297,top-.135,-.16,.19,.185);
  for(const z of [-.28,-.06])box(wood,side*.295,(.55+top)/2,z,.022,top-.55,.022);
 }
 // Timber balcony, carved rail and a central tea sign stay visible as the tier rises.
 box(wood,0,.605,.108,.67,.033,.20);
 for(const x of [-.30,-.20,-.10,0,.10,.20,.30])box(wood,x,.67,.201,.014,.115,.014);
 box(wood,0,.729,.201,.67,.021,.023);
 box(wood,0,.454,.252,.245,.105,.030);box(0xc5a66b,0,.454,.271,.204,.068,.010);
 // A simple cup emblem reads at city scale without miniature text.
 box(0x493c2c,0,.451,.279,.068,.029,.008);box(0x493c2c,.044,.452,.279,.021,.018,.008);
 box(0x493c2c,0,.432,.279,.102,.008,.008);
 for(const x of [-.33,.33]){box(wood,x,.29,.31,.026,.40,.026);lantern(x,.39,.31);}
 const teaTable=(x,z)=>{
  shape('cylinder',0xa58052,x,.205,z,.135,.027,.135);box(wood,x,.145,z,.025,.12,.025);
  for(const side of [-1,1]){box(wood,x+side*.09,.132,z,.054,.035,.07);box(wood,x+side*.09,.095,z,.020,.07,.025);}
  shape('cylinder',0xe0d2af,x,.233,z,.027,.027,.027);
 };
 teaTable(-.19,.372);teaTable(.19,.372);
 for(let i=0;i<3;i++)box(stone,0,.075+i*.013,.47-i*.055,.20,.024,.055);
 tree(-.402,-.347,.61);tree(.402,-.347,.61);
 if(l>=2)for(const x of [-.39,.39]){box(0x8d7760,x,.11,.40,.10,.09,.105);shape('crown',0x71915e,x,.188,.40,.105,.09,.10);}
 if(l>=3)for(const x of [-.255,.255])lantern(x,top-.042,.075);
 if(l>=4){box(0x6b5039,0,top+.065,-.045,.19,.10,.020);box(0xc4ae7b,0,top+.065,-.032,.15,.057,.010);}
 if(l>=5)for(const x of [-.19,.19]){box(wood,x,.65,.21,.13,.07,.053);shape('crown',0x769267,x,.70,.21,.13,.06,.05);}
 if(l===6)for(const x of [-.40,.40]){box(wood,x,.14,-.08,.075,.20,.075);box(lamp,x,.23,-.08,.055,.065,.055);}
}

export function drawBuddhistTemple(b,shape,box){
 const l=tier(b),top=templeTop(b),wall=0xeae6d7,pillar=0x85503c;
 const {roof,screen,lantern,tree,stoneLamp,stone,wood}=courtyardParts(b,shape,box);
 box(stone,0,.035,0,.97,.07,.97);box(0xdad5c2,0,.075,0,.90,.035,.90);
 // Raised main hall, double roof and red-brown pillars anchor the rear of the court.
 box(0xc9c2ad,0,.135,-.245,.72,.10,.39);
 box(wall,0,(.18+top)/2,-.255,.61,top-.18,.28);
 for(const x of [-.27,-.09,.09,.27])box(pillar,x,(.17+top)/2,-.085,.028,top-.17,.031);
 for(const x of [-.20,0,.20])screen(x,.37,-.102,.13,.27);
 box(wood,0,top-.018,-.074,.65,.050,.035);
 roof(0,-.245,.86,.45,top+.005,.105);
 box(wall,0,top+.173,-.245,.42,.16,.21);
 for(const x of [-.14,0,.14])screen(x,top+.17,-.131,.082,.084);
 roof(0,-.245,.61,.33,top+.245,.085);
 box(wood,0,.555,-.05,.22,.086,.025);box(0xc5aa6d,0,.555,-.034,.18,.055,.013);
 for(let i=0;i<3;i++)box(stone,0,.105+i*.024,-.015-i*.042,.35-i*.035,.035,.058);
 // Covered side galleries frame open space instead of filling it with another hall.
 for(const side of [-1,1]){
  box(wall,side*.403,.215,.125,.064,.25,.43);
  box(wood,side*.345,.115,.125,.17,.04,.46);
  for(const z of [-.055,.105,.27]){box(pillar,side*.303,.255,z,.025,.28,.025);box(wood,side*.339,.387,z,.12,.035,.026);}
  roof(side*.365,.125,.23,.51,.40,.067);
  box(wall,side*.345,.205,.405,.21,.22,.064);box(0x242a26,side*.345,.325,.405,.23,.025,.088);
 }
 // Three-bay mountain gate, open central passage and paired warm lanterns.
 for(const x of [-.21,-.09,.09,.21])box(pillar,x,.245,.378,.029,.31,.031);
 for(const x of [-.165,.165]){box(wood,x,.245,.397,.10,.27,.023);box(0x9e7350,x,.255,.414,.068,.20,.012);}
 box(wood,0,.407,.378,.50,.064,.042);roof(0,.378,.59,.22,.444,.078);
 box(wood,0,.434,.452,.18,.069,.022);box(0xc3a367,0,.434,.466,.14,.037,.009);
 for(const x of [-.25,.25])lantern(x,.34,.422);
 for(const z of [.27,.36,.45])box(stone,0,.097,z,.14,.024,.063);
 // Bronze incense burner sits on a stone plinth along the ceremonial axis.
 box(stone,0,.11,.125,.17,.033,.16);
 for(const x of [-.045,.045])box(0x766b4d,x,.17,.125,.021,.09,.021);
 shape('cylinder',0x847759,0,.22,.125,.12,.08,.12);shape('cylinder',0xa18c5d,0,.269,.125,.143,.018,.143);
 for(const x of [-.03,0,.03])box(0x72513a,x,.325,.125,.007,.105,.007);
 for(const x of [-.074,.074])box(0x958053,x,.25,.125,.029,.055,.021);
 tree(-.205,.238,.57);tree(.205,.238,.57);
 if(l>=2)for(const x of [-.24,.24])box(stone,x,.12,-.02,.09,.075,.08);
 if(l>=3)for(const x of [-.245,.245])stoneLamp(x,.285);
 if(l>=4)for(const side of [-1,1])for(const z of [-.055,.105,.27])box(0xb6a080,side*.303,.358,z,.065,.033,.044);
 if(l>=5)for(const x of [-.27,.27])lantern(x,.49,-.042);
 if(l===6)for(const side of [-1,1]){box(stone,side*.20,.103,.02,.082,.026,.07);shape('crown',0x72875b,side*.20,.15,.02,.073,.075,.06);}
}
