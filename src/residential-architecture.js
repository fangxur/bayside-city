import {isEuropeanStreet,europeanHomeHeight,drawEuropeanHome} from './european-residential.js';
import {isJapaneseHome,japaneseHomeHeight,drawJapaneseHome} from './japanese-residential.js';

// Compact architectural interpretations, retaining their identity at all six levels.
export const specialtyHeight = b => isEuropeanStreet(b)?europeanHomeHeight(b):isJapaneseHome(b)?japaneseHomeHeight(b):Math.max(.16 + (b.level || 1) * .28 + .36,.90);

function drawMiaoVillage(b,local,box){
  const level=b.level||1,floors=1+Math.floor((level-1)/2),bodyHeight=.24+floors*.12;
  const wood=0x6f4b35,darkWood=0x4c382d,tile=0x46524f,stone=0xaaa58f,glass=b.active===false?0x89918a:0x79a5a0;
  box(0x9c9074,0,.035,0,.96,.07,.96);
  // Three stepped terraces make the settlement read as a hillside village.
  for(const [z,y,width] of [[-.28,.07,.88],[.02,.12,.72],[.29,.17,.54]]){
    box(stone,0,y/2,z,width,y,.27);
    box(0xb8ad8e,0,y+.012,z+.11,width,.025,.05);
  }
  const homes=[[-.28,-.27,0],[.23,-.25,0],[-.18,.01,1],[.26,.04,1],[-.05,.29,2],[-.34,.27,2],[.36,.28,2]];
  const count=Math.min(homes.length,4+Math.floor(level/2));
  for(let i=0;i<count;i++){
    const [x,z,tier]=homes[i],base=.07+tier*.055,bodyY=base+.12+bodyHeight/2,front=z+.11;
    for(const dx of [-.09,.09])for(const dz of [-.075,.075])box(darkWood,x+dx,base+.11,z+dz,.025,.22,.025);
    box(wood,x,bodyY,z,.24,bodyHeight,.20);
    for(let floor=0;floor<floors;floor++){
      const y=base+.22+floor*.12;
      box(glass,x-.055,y,front,.065,.065,.012);box(glass,x+.055,y,front,.065,.065,.012);
      box(darkWood,x,y+.055,front+.008,.23,.018,.016);
    }
    // Projecting gallery, railings and deep roofs are the key diaojiaolou silhouette.
    box(darkWood,x,base+.18,z+.145,.30,.035,.10);
    for(const dx of [-.13,-.065,0,.065,.13])box(darkWood,x+dx,base+.245,z+.19,.012,.13,.012);
    box(darkWood,x,base+.31,z+.19,.29,.018,.018);
    local('roof',tile,x,base+bodyHeight+.23,z,.34,.15,.31);
    box(0x394340,x,base+bodyHeight+.325,z,.025,.025,.34);
  }
  // Stone stair and timber covered passage connect the staggered homes.
  for(let i=0;i<6;i++)box(stone,.03,.075+i*.027,.43-i*.105,.13,.035,.08);
  if(level>=4){
    const towerHeight=.54+(level-4)*.10;
    for(const x of [-.10,.10])box(darkWood,x,.16,.15,.025,.28,.025);
    box(wood,0,.19+towerHeight/2,.15,.27,towerHeight,.24);
    local('roof',0x3f4b49,0,.24+towerHeight,.15,.39,.17,.36);
    for(const x of [-.08,0,.08])box(0xd4b05f,x,.34+towerHeight,.33,.018,.10,.018);
  }
  local('crown',0x668451,-.40,.27,-.02,.17,.34,.16);
}

function drawTulou(b,local,box){
  const level=b.level||1,height=.25+level*.18,earth=0xb48760,tile=0x505956,wood=0x654738,glass=b.active===false?0x89918a:0x739b96;
  box(0xb9ae91,0,.035,0,.96,.07,.96);
  const segments=12,radius=.34;
  for(let i=0;i<segments;i++){
    if(i===3)continue; // Street-facing gate opens into the central courtyard.
    const angle=i*Math.PI*2/segments,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,turn=angle+Math.PI/2;
    box(earth,x,height/2+.07,z,.24,height,.18,turn);
    box(0xd3b48c,x,height+.055,z,.255,.04,.19,turn);
    local('roof',tile,x,height+.13,z,.30,.14,.22,turn);
    for(let floor=0;floor<level;floor++){
      const y=.21+floor*.17,outerRadius=.435;
      local('box',glass,Math.cos(angle)*outerRadius,y,Math.sin(angle)*outerRadius,.065,.075,.018,turn);
      if(floor>0)local('box',wood,Math.cos(angle)*.235,y-.055,Math.sin(angle)*.235,.20,.022,.025,turn);
    }
    box(wood,Math.cos(angle)*.245,height*.58+.06,Math.sin(angle)*.245,.025,height*.80,.025);
  }
  // Gatehouse, stone threshold and a visible inner gallery preserve the round enclosed plan.
  for(const x of [-.14,.14])box(earth,x,height*.43+.07,.34,.13,height*.86,.20);
  box(wood,0,.20,.43,.16,.28,.035);box(0x302f2b,0,.20,.449,.09,.20,.012);
  local('roof',tile,0,height*.86+.13,.34,.43,.15,.29);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,x=Math.cos(angle)*.215,z=Math.sin(angle)*.215,turn=angle+Math.PI/2;
    box(wood,x,.22,z,.025,.34,.025);
    local('box',wood,x,.37,z,.22,.022,.025,turn);
  }
  for(const z of [.42,.34,.26])box(0x9b927e,0,.065,z,.15,.035,.065);
  local('cylinder',0x8b897b,0,.085,0,.14,.08,.14);
  local('cylinder',0x719092,0,.13,0,.09,.025,.09);
  if(level>=4){
    box(earth,0,height+.19,-.34,.28,.28,.18);
    local('roof',tile,0,height+.39,-.34,.36,.14,.26);
  }
  local('crown',0x668451,-.13,.22,.08,.14,.28,.13);
}

function drawJiangnanHome(b,local,box){
  const level=b.level||1,floors=1+Math.floor((level-1)/2),h=.32+level*.09;
  const wall=0xf0eee1,tile=0x171b1b,wood=0x684b3b,glass=b.active===false?0x89918a:0x739d9a,stone=0xaaa899;
  const roof=(x,z,w,d,y,rise,ridgeX=true)=>{
    local('roof',tile,x,y,z,ridgeX?d:w,rise,ridgeX?w:d,ridgeX?Math.PI/2:0);
    box(0x202424,x,y+.003,z,w,.018,d);
    // Subtle courses and a black ridge retain readable slopes in sunlight.
    for(let i=1;i<=3;i++)for(const side of [-1,1]){
      const offset=(ridgeX?d:w)*.5*(1-i/4);
      box(0x303636,x+(ridgeX?0:side*offset),y+rise*i/4+.004,z+(ridgeX?side*offset:0),ridgeX?w*.98:.008,.006,ridgeX?.008:d*.98);
    }
    box(0x101414,x,y+rise+.009,z,ridgeX?w:.025,.022,ridgeX?.025:d);
  };
  box(0xbdb69e,0,.035,0,.96,.07,.96);
  // A narrow canal, landing and stone footbridge make this a waterside home rather than another white courtyard.
  box(0x6f9fa3,.39,.065,0,.15,.025,.86);
  for(let i=0;i<5;i++)box(stone,.20+i*.055,.105,.30,.045,.035,.22);
  box(wall,-.12,h/2+.07,-.16,.56,h,.43);roof(-.12,-.16,.69,.55,h+.10,.14);
  const wingH=h*.72;
  box(wall,-.34,wingH/2+.07,.14,.18,wingH,.38);roof(-.34,.14,.29,.49,wingH+.10,.12,false);
  box(wall,.08,wingH/2+.07,.18,.30,wingH,.25);roof(.08,.18,.40,.35,wingH+.10,.12);
  for(let floor=0;floor<floors;floor++)for(const x of [-.30,-.12,.06]){
    const y=.21+floor*.19;box(wood,x,y,.065,.12,.14,.025);box(glass,x,y,.081,.075,.10,.012);
    for(const dx of [-.026,.026])box(wood,x+dx,y,.092,.008,.13,.011);
  }
  // Covered gallery faces the water, with a small moon-gate-like segmented entrance.
  box(wood,.21,.13,.05,.28,.045,.60);
  for(const z of [-.20,-.02,.16,.34])box(wood,.33,.24,z,.025,.26,.025);
  box(wood,.33,.38,.07,.025,.025,.59);roof(.31,.07,.20,.68,.46,.10,false);
  for(const side of [-1,1])box(wall,-.08+side*.09,.21,.35,.045,.28,.055);
  for(let i=0;i<7;i++){const a=i*Math.PI/6;local('box',wall,-.08+Math.cos(a)*.09,.33+Math.sin(a)*.09,.35,.055,.045,.065,0,0,-(a+Math.PI/2));}
  box(wood,-.08,.18,.38,.11,.22,.025);
  local('crown',0x6a8958,-.27,.20,.31,.16,.24,.14);
  if(level>=4){box(wall,.06,h+.17,-.17,.26,.24,.25);roof(.06,-.17,.35,.34,h+.34,.12);}
}

function drawTibetanHouse(b,local,box){
  const level=b.level||1,floors=1+Math.floor((level-1)/2),h=.34+level*.14;
  const white=0xe7e0cf,stone=0xaaa28f,red=0x8d4d3f,dark=0x343c3b,wood=0x674b39;
  box(stone,0,.045,0,.96,.09,.96);
  // Receding stone courses create the battered fortress profile of a traditional diaofang.
  box(stone,0,.19,-.05,.82,.28,.71);box(white,0,h/2+.13,-.05,.74,h-.12,.65);
  box(white,-.10,h+.015,-.08,.54,.14,.51);box(red,0,h-.015,.274,.76,.09,.045);
  box(dark,0,h+.105,-.08,.59,.035,.56);
  for(const x of [-.35,.35])box(white,x,h+.10,-.05,.055,.25,.69);
  for(const z of [-.35,.25])box(white,0,h+.10,z,.75,.25,.055);
  for(let floor=0;floor<floors;floor++)for(const x of [-.23,0,.23]){
    const y=.29+floor*.22;box(dark,x,y,.292,.10,.15,.025);box(0xb98d68,x,y,.307,.055,.10,.012);
    for(const side of [-1,1])box(dark,x+side*.065,y-.015,.309,.025,.18,.014);
  }
  box(dark,0,.22,.296,.14,.30,.035);box(red,0,.41,.30,.22,.055,.07);
  for(let i=0;i<6;i++){box(wood,-.32,.15+i*.07,.34,.13,.018,.025);box(wood,-.37,.32,.34,.025,.47,.025);box(wood,-.27,.32,.34,.025,.47,.025);}
  // Rooftop incense tower and prayer flags keep the flat silhouette legible from the isometric view.
  local('cylinder',0xc49d59,.17,h+.20,-.08,.10,.23,.10);local('cone',0xd6b76f,.17,h+.36,-.08,.16,.18,.16);
  for(const x of [-.28,-.09,.10,.29]){
    box(wood,x,h+.26,-.31,.018,.32,.018);
    box(x<-.1?0x557c87:x<.05?0xd3a64e:x<.2?0xa94f43:0x688153,x+.035,h+.34,-.31,.085,.055,.012);
  }
  if(level>=5){box(red,-.20,h+.26,.10,.24,.22,.25);box(dark,-.20,h+.39,.10,.29,.035,.30);}
}

function drawShanxiCourtyard(b,local,box){
  const level=b.level||1,h=.31+level*.10,brick=0x756d62,tile=0x3f4848,wood=0x74483b,stone=0xaaa18f,glass=b.active===false?0x89918a:0x789b96;
  box(stone,0,.035,0,.97,.07,.97);
  // Tall brick perimeter walls frame three successive courtyards and a deep central axis.
  box(brick,-.45,.24,-.04,.055,.40,.86);box(brick,.45,.24,-.04,.055,.40,.86);box(brick,0,.24,-.44,.92,.40,.055);
  const hall=(x,z,w,d,height)=>{
    box(0xb9ad95,x,height/2+.07,z,w,height,d);local('roof',tile,x,height+.11,z,w+.10,.15,d+.12);
    box(0x2f3838,x,height+.19,z,.025,.025,d+.14);
  };
  hall(0,-.31,.75,.23,h);hall(0,.03,.43,.18,h*.78);
  hall(-.34,-.02,.18,.53,h*.70);hall(.34,-.02,.18,.53,h*.70);
  for(const z of [-.31,.03])for(const x of [-.22,0,.22]){
    box(wood,x,.22,z+.13,.12,.25,.025);box(glass,x,.23,z+.146,.07,.14,.012);
    for(const dx of [-.025,.025])box(wood,x+dx,.23,z+.157,.008,.18,.010);
  }
  for(const z of [-.18,.16,.33])for(const x of [-.17,0,.17])box(stone,x,.075,z,.13,.025,.10);
  // A raised carved gatehouse and paired stone drums distinguish the merchant compound.
  for(const x of [-.30,.30])box(brick,x,.23,.42,.24,.38,.10);
  box(wood,0,.22,.42,.22,.31,.045);box(0x2f3433,0,.22,.448,.14,.24,.016);
  for(const x of [-.17,.17])box(wood,x,.37,.43,.045,.18,.045);
  local('roof',tile,0,.52,.42,.58,.15,.27);local('roof',0x505958,0,.65,.42,.39,.10,.20);
  for(const x of [-.18,.18]){local('cylinder',0x9d9585,x,.11,.48,.12,.12,.12);local('cylinder',0x81796d,x,.15,.48,.08,.04,.08);}
  for(const x of [-.12,.12])local('cylinder',0xa94f43,x,.39,.48,.065,.09,.065);
  if(level>=4){hall(0,-.30,.43,.18,h+.25);for(const x of [-.16,.16])box(wood,x,h+.06,-.17,.035,.32,.035);}
}

function drawHakkaWeilong(b,local,box){
  const level=b.level||1,height=.28+level*.15,earth=0xa78968,tile=0x495452,wood=0x66483a,glass=b.active===false?0x89918a:0x779b95;
  box(0xbcb094,0,.035,0,.97,.07,.97);
  // The low semicircular rear ring stays open toward the forecourt, unlike the closed round tulou.
  const segments=11,radius=.35;
  for(let i=0;i<segments;i++){
    const angle=Math.PI+i*Math.PI/(segments-1),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius-.04,turn=angle+Math.PI/2;
    box(earth,x,height/2+.07,z,.24,height,.18,turn);local('roof',tile,x,height+.10,z,.29,.12,.23,turn);
    local('box',glass,Math.cos(angle)*.43,.24,Math.sin(angle)*.43-.04,.065,.09,.018,turn);
    box(wood,Math.cos(angle)*.245,height*.52+.07,Math.sin(angle)*.245-.04,.023,height*.72,.023);
  }
  const hall=(z,w,h)=>{box(0xd5c5aa,0,h/2+.07,z,w,h,.20);local('roof',tile,0,h+.11,z,w+.10,.14,.31);};
  hall(-.18,.48,height+.05);hall(.09,.38,height*.76);
  for(const x of [-.34,.34]){box(earth,x,height*.34+.07,.18,.18,height*.68,.39);local('roof',tile,x,height*.68+.11,.18,.28,.12,.50,Math.PI/2);}
  for(const x of [-.26,-.13,0,.13,.26]){box(wood,x,.19,.20,.025,.24,.025);box(wood,x,.32,.20,.025,.025,.13);}
  box(wood,0,.19,.31,.15,.27,.035);box(0x343735,0,.19,.331,.09,.20,.014);local('roof',tile,0,.39,.31,.32,.11,.22);
  for(const z of [.23,.34,.44])box(0xa39b88,0,.065,z,.16,.035,.07);
  local('cylinder',0x8f8b7f,.22,.09,.30,.12,.07,.12);local('cylinder',0x719092,.22,.13,.30,.075,.018,.075);
  if(level>=4){box(earth,0,height+.17,-.36,.27,.25,.17);local('roof',tile,0,height+.35,-.36,.36,.13,.26);}
}

function drawRegionalHome(b,local,box){
  const kind=b.businessKind,level=b.level||1,floors=1+Math.floor((level-1)/2),h=.30+level*.12;
  const glass=b.active===false?0x89918a:0x719c99,wood=0x6b4d3a,stone=0xb6ad98;
  const supported=new Set(['nordic','british','spanish','italian','french','huizhou','bai','dutch','chalet']);
  if(!supported.has(kind))return false;
  const window=(x,y,z,w=.09,trim=0xf0e6cf)=>{box(trim,x,y,z,w+.035,.15,.023);box(glass,x,y,z+.015,w,.11,.013);};
  const windows=(center,z,width,count=3)=>{for(let f=0;f<floors;f++)for(let i=0;i<count;i++)window(center+(i-(count-1)/2)*width/(count+.2),.22+f*.22,z,width/(count+1.8));};
  box(0xc2b99e,0,.04,0,.95,.08,.95);
  if(kind==='nordic'){
    const red=0xa34f48,slate=0x46545d,white=0xf2ead8;
    box(red,-.13,h/2+.07,-.08,.58,h,.55);box(level>=4?0x557a73:0xc0775e,.27,h*.34+.07,.09,.25,h*.68,.33);
    local('roof',slate,-.13,h+.12,-.08,.79,.22,.72);local('roof',0x64757a,.27,h*.68+.16,.09,.39,.18,.47,Math.PI/2);
    for(let y=.14;y<h;y+=.07)box(0xc27a69,-.13,y,.205,.53,.012,.016);
    windows(-.13,.215,.55,3);
    for(const x of [-.40,.14])box(white,x,h/2+.07,.205,.035,h,.024);
    box(wood,-.10,.10,.34,.72,.06,.18);for(const x of [-.42,-.24,-.06,.12,.30])box(white,x,.23,.42,.025,.26,.025);
    box(white,-.06,.36,.42,.76,.027,.025);box(0x816f61,.08,h+.19,-.25,.075,.26,.075);
    for(const x of [-.31,-.20,-.09])box(0x87684d,x,.09,.39,.08,.07,.24);
    if(level>=4){box(0xb7aa82,.31,.075,-.29,.22,.05,.18);local('crown',0x6e8757,.31,.21,-.29,.20,.27,.19);}
  }else if(kind==='british'){
    const brick=0xa46e57,slate=0x555e63,cream=0xe8d7ba;
    box(brick,0,h/2+.07,-.08,.76,h,.57);local('roof',slate,0,h+.12,-.08,.86,.18,.67);
    for(const x of [-.23,.23]){
      box(brick,x,h*.62+.07,.19,.29,h*.76,.20);local('roof',0x667075,x,h*.76+.17,.19,.36,.22,.32,Math.PI/2);
      box(cream,x,.26,.305,.19,.33,.12);box(glass,x,.28,.372,.14,.22,.016);
      for(const dx of [-.055,0,.055])box(cream,x+dx,.28,.384,.012,.25,.014);
    }
    windows(0,.218,.66,4);
    for(const x of [-.29,.29]){box(0x8f5d49,x,h+.20,-.21,.085,.30,.085);box(cream,x,h+.36,-.21,.11,.035,.11);}
    box(0x31504a,0,.21,.235,.14,.29,.035);box(cream,0,.39,.24,.20,.045,.09);
    for(const x of [-.38,-.19,0,.19,.38])local('crown',0x5f814e,x,.13,.41,.16,.17,.11);
    if(level>=5)for(const x of [-.13,.13])box(0xd6be9b,x,h+.22,.15,.12,.14,.08);
  }else if(kind==='dutch'){
    const colors=[0xa5513d,0xc07852,0x856352],slate=0x505c62;
    for(let i=0;i<3;i++){
      const x=(i-1)*.25,top=h-(i===1?0:.07);box(colors[i],x,top/2+.07,-.06,.22,top,.62);
      windows(x,.263,.21,1);
      for(const [width,rise] of [[.22,.07],[.16,.14],[.10,.21],[.045,.27]]){
        box(colors[i],x,top+.07+rise/2,.23,width,rise,.055);box(0xe1cfad,x,top+.07+rise,.244,width+.018,.018,.07);
      }
      box(wood,x,top+.35,.33,.025,.025,.17);local('roof',slate,x,top+.08,-.25,.20,.06,.19);
      box(i===1?0x31564f:0x52676a,x,.18,.264,.10,.25,.025);
    }
    for(const x of [-.34,-.17,0,.17,.34])box(stone,x,.07,.37,.13,.045,.20);
    for(const x of [-.31,0,.31]){box(wood,x,.105,.43,.15,.07,.10);local('crown',0x709150,x,.19,.43,.14,.12,.09);}
    if(level>=4)box(0x405b58,0,.08,-.43,.79,.05,.08);
  }else if(kind==='chalet'){
    const timber=0x936940,roof=0x4f463b;
    box(0x929486,0,.19,-.08,.73,.28,.58);box(timber,0,h/2+.15,-.08,.74,h-.16,.57);
    local('roof',roof,0,h+.13,-.07,.95,.27,.84);local('roof',0x665746,0,h+.20,.15,.48,.19,.43,Math.PI/2);
    for(let y=.34;y<h;y+=.08)box(0xb68d61,0,y,.213,.68,.015,.02);
    for(const x of [-.34,0,.34])box(wood,x,h*.52+.11,.23,.035,h-.05,.035);
    for(let f=0;f<floors;f++){
      const y=.30+f*.22;box(wood,0,y,.32,.86,.05,.25);box(wood,0,y+.11,.438,.85,.025,.025);
      for(const x of [-.36,-.24,-.12,0,.12,.24,.36])box(wood,x,y+.055,.438,.022,.13,.022);
    }
    for(const x of [-.24,.24]){window(x,.30,.224,.13,0xe8d6b8);local('crown',0x789153,x,.41,.45,.19,.07,.07);local('crown',0xc27d78,x,.45,.45,.12,.05,.06);}
    box(0x7e7468,.27,h+.22,-.23,.075,.28,.075);box(wood,0,.10,.34,.77,.07,.18);
  }else if(kind==='spanish'){
    const wall=0xf2e2c9,tile=0xb85e3d;
    box(wall,0,h/2+.07,-.25,.73,h,.29);box(wall,-.29,h*.38+.07,.05,.20,h*.76,.42);box(wall,.29,h*.38+.07,.05,.20,h*.76,.42);
    local('roof',tile,0,h+.12,-.25,.84,.17,.40);local('roof',0xc97049,-.29,h*.76+.16,.05,.31,.14,.53,Math.PI/2);local('roof',0xc97049,.29,h*.76+.16,.05,.31,.14,.53,Math.PI/2);
    for(const x of [-.28,0,.28]){
      for(const side of [-1,1])box(wall,x+side*.08,.19,.31,.035,.25,.055);
      for(let j=0;j<7;j++){const a=j*Math.PI/6;local('box',wall,x+Math.cos(a)*.08,.30+Math.sin(a)*.08,.31,.05,.045,.065,0,0,-(a+Math.PI/2));}
    }
    windows(0,-.095,.64,4);
    local('cylinder',0xd4b271,0,.10,.08,.18,.08,.18);local('cylinder',0x6f9994,0,.15,.08,.12,.025,.12);
    box(wall,-.29,h+.18,-.25,.19,.23,.18);local('roof',tile,-.29,h+.34,-.25,.28,.10,.27,Math.PI/2);
    for(const x of [-.35,.35])local('crown',0x718e52,x,.18,.38,.16,.23,.14);
  }else if(kind==='french'){
    const wall=0xe7dcc7,slate=0x586779;
    box(wall,0,h/2+.07,-.10,.66,h,.55);for(const x of [-.34,.34])local('cylinder',wall,x,h*.47+.07,-.08,.24,h*.84,.24);
    local('roof',slate,0,h+.12,-.10,.77,.27,.66);box(0x687687,0,h+.33,-.10,.48,.08,.39);
    for(const x of [-.34,.34])local('cone',0x536274,x,h*.84+.25,-.08,.34,.42,.34);
    for(const x of [-.22,0,.22]){box(wall,x,h+.20,.18,.15,.19,.09);window(x,h+.20,.232,.08);local('roof',slate,x,h+.31,.18,.20,.07,.15);}
    windows(0,.186,.58,3);
    for(const x of [-.39,-.13,.13,.39])box(0xf3ead8,x,.31,.28,.055,.49,.07);
    box(0x3f5e58,0,.20,.205,.13,.27,.03);for(const x of [-.28,.28]){local('crown',0x60824f,x,.20,.38,.18,.29,.18);box(0xb69d81,x,.08,.38,.19,.05,.19);}
    if(level>=5)box(0xa58a71,.16,h+.38,-.24,.07,.24,.07);
  }else if(kind==='italian'){
    const wall=0xe1b676,tile=0xb36943,green=0x526f58;
    box(wall,0,h/2+.07,-.17,.68,h,.39);box(wall,-.29,h*.36+.07,.07,.20,h*.72,.40);box(wall,.29,h*.36+.07,.07,.20,h*.72,.40);
    local('roof',tile,0,h+.11,-.17,.78,.14,.49);local('roof',0xc47a4e,-.29,h*.72+.14,.07,.30,.11,.50,Math.PI/2);local('roof',0xc47a4e,.29,h*.72+.14,.07,.30,.11,.50,Math.PI/2);
    box(wall,.18,h+.20,-.17,.23,.24,.23);for(const x of [.12,.24])box(green,x,h+.20,-.292,.035,.13,.016);local('roof',tile,.18,h+.36,-.17,.31,.10,.31,Math.PI/2);
    for(const x of [-.27,-.09,.09,.27]){box(wood,x,.26,.31,.035,.39,.035);box(green,x-.035,.26,.327,.025,.18,.015);box(green,x+.035,.26,.327,.025,.18,.015);}
    for(const x of [-.34,-.17,0,.17,.34])box(wood,x,.49,.30,.025,.035,.27);for(const z of [.24,.39])box(wood,0,.47,z,.73,.035,.025);
    for(const x of [-.27,0,.27])local('crown',0x7d9557,x,.53,.30,.19,.08,.17);
    for(const x of [-.38,.38]){local('cylinder',0x7b5d43,x,.19,.15,.045,.31,.045);local('crown',0x5e7f49,x,.43,.15,.12,.40,.12);}
    local('cylinder',0xb67a51,.28,.13,.36,.12,.16,.12);
  }else if(kind==='huizhou'){
    const wall=0xf1efe2,tile=0x424c4d;
    for(const [x,z,w,d,rise] of [[-.20,-.16,.47,.42,.00],[.24,-.08,.33,.52,.10],[-.10,.24,.55,.24,-.08]]){
      const top=h+rise;box(wall,x,top/2+.07,z,w,top,d);local('roof',tile,x,top+.12,z,w+.08,.16,d+.10);
      for(const side of [-1,1])for(const [offset,height] of [[-.12,.10],[.02,.22],[.14,.12]]){box(wall,x+side*(w/2+.015),top+height/2+.05,z+offset,.055,height,.18);box(tile,x+side*(w/2+.015),top+height+.055,z+offset,.075,.03,.20);}
    }
    for(let f=0;f<floors;f++)for(const x of [-.27,-.09,.09,.27]){window(x,.22+f*.21,.285,.075,wood);for(const dx of [-.028,.028])box(wood,x+dx,.22+f*.21,.302,.009,.13,.012);}
    for(const z of [.30,.39,.47])box(stone,.18,.065,z,.18,.035,.06);box(wood,.18,.20,.27,.14,.27,.025);
    box(wall,-.31,.20,.37,.27,.31,.06);local('roof',tile,-.31,.42,.37,.35,.10,.17);local('crown',0x66844f,.32,.20,.35,.17,.26,.16);
  }else if(kind==='bai'){
    const wall=0xf3eddf,tile=0x536772,blue=0x4f7e99;
    box(wall,0,h/2+.07,-.25,.72,h,.28);box(wall,-.30,h*.38+.07,.02,.18,h*.76,.44);box(wall,.30,h*.38+.07,.02,.18,h*.76,.44);
    local('roof',tile,0,h+.12,-.25,.84,.17,.39);local('roof',tile,-.30,h*.76+.15,.02,.29,.13,.55,Math.PI/2);local('roof',tile,.30,h*.76+.15,.02,.29,.13,.55,Math.PI/2);
    for(let f=0;f<floors;f++){const y=.22+f*.22;box(blue,0,y+.07,-.096,.64,.03,.025);for(const x of [-.24,0,.24])window(x,y,-.096,.09,blue);}
    box(wall,-.12,.25,.36,.50,.40,.055);box(blue,-.12,.25,.395,.35,.25,.018);box(0xf4eddd,-.12,.25,.412,.27,.18,.012);local('box',blue,-.12,.25,.425,.08,.08,.015,0,0,Math.PI/4);local('roof',tile,-.12,.49,.36,.58,.09,.16);
    box(wall,.27,.20,.36,.18,.30,.06);box(blue,.27,.20,.397,.12,.20,.015);local('roof',tile,.27,.39,.36,.27,.09,.18,Math.PI/2);
    for(const [z,w] of [[.28,.18],[.36,.24],[.44,.30]])box(stone,.25,.06,z,w,.035,.055);
    for(const x of [-.35,.35])local('crown',0x72925b,x,.17,.25,.15,.22,.14);
  }
  return true;
}

export function drawSpecialtyHome(b, local, box) {
  if(isJapaneseHome(b)){drawJapaneseHome(b,local,box);return;}
  if(isEuropeanStreet(b)){drawEuropeanHome(b,local,box);return;}
  const level=b.level||1, h=.16+level*.28, kind=b.businessKind;
  if(kind==='miaoVillage'){drawMiaoVillage(b,local,box);return;}
  if(kind==='tulou'){drawTulou(b,local,box);return;}
  if(kind==='jiangnan'){drawJiangnanHome(b,local,box);return;}
  if(kind==='tibetan'){drawTibetanHouse(b,local,box);return;}
  if(kind==='shanxiCourtyard'){drawShanxiCourtyard(b,local,box);return;}
  if(kind==='hakkaWeilong'){drawHakkaWeilong(b,local,box);return;}
  if(drawRegionalHome(b,local,box))return;
  const wood=0x71513c, glass=b.active===false?0x89918a:0x709e9b;
  const wall=({spanish:0xf4e6cf,french:0xe8dcc5,nordic:0xa34f48,british:0xa87860,italian:0xe4bb78,huizhou:0xf1efe0,bai:0xf5eddb,dutch:0xa85640,chalet:0x996e46})[kind]??0xe6dfc9;
  box(0xc6bd9f,0,.04,0,.94,.08,.94);
  box(wall,0,h/2+.06,-.08,.72,h,.58);
  for(let f=0;f<level;f++){
    const y=.23+f*.28;
    for(const x of [-.22,0,.22]){
      box(kind==='japanese'?wood:0xf9efda,x,y,.221,.17,.21,.025);
      box(glass,x,y,.238,.115,.16,.012);
      box(glass,.367,y,-.08+x,.014,.16,.12);
      if(kind==='japanese'){
        for(const dx of [-.035,.035])box(wood,x+dx,y,.252,.012,.18,.014);
      }else if(kind==='french'){
        box(0xf2e9d6,x,y-.12,.28,.20,.025,.14);
        box(0x535e60,x,y-.025,.345,.19,.012,.014);
        for(const dx of [-.08,0,.08])box(0x535e60,x+dx,y-.067,.345,.012,.09,.012);
      }
    }
    if(kind==='french')box(0xf6edda,0,y+.13,-.08,.76,.027,.62);
    if(kind==='japanese'&&f>0)local('roof',0x4e5956,0,y-.13,-.06,.86,.10,.72);
  }
  if(kind==='japanese'){
    const tile=0x4b5754,ridge=0x35413f;
    // Broad layered eaves and a transverse upper gable give the house a clear pagoda-like silhouette.
    local('roof',tile,0,h+.02,-.08,.95,.18,.82);
    local('roof',0x59645f,0,h+.15,-.10,.38,.16,.51,Math.PI/2);
    box(ridge,0,h+.225,-.08,.035,.035,.84);
    for(const side of [-1,1]){
      box(ridge,side*.45,h+.075,-.08,.045,.035,.84);
      box(wood,side*.38,.30,.30,.035,.38,.035);
    }
    local('roof',tile,0,.43,.31,.91,.10,.25);
    box(0xc8c0a8,0,.075,.39,.55,.025,.18);
    for(const x of [-.23,.23]){
      box(0xb5ad98,x,.08,.38,.17,.03,.13);
      local('crown',x<0?0x718b58:0x8b9270,x,.17,.38,.13,.15,.12);
    }
  }else if(kind==='huizhou'){
    local('roof',0x4a5353,0,h+.06,-.08,.82,.20,.70);
    // Stepped fire walls silhouette both ends of the tiled roof.
    for(const side of [-1,1])for(const [z,rise] of [[-.31,.12],[-.08,.26],[.15,.12]]){
      box(wall,side*.39,h+rise/2+.06,z,.055,rise,.23);
      box(0x424b4b,side*.39,h+rise+.07,z,.075,.035,.25);
    }
    for(let f=0;f<level;f++){
      const y=.23+f*.28;
      for(const x of [-.22,0,.22])for(const dx of [-.04,0,.04])box(wood,x+dx,y,.253,.012,.18,.018);
      box(0x626963,0,y-.13,.235,.75,.025,.03);
    }
    for(const x of [-.39,.39])box(wall,x,.16,.35,.055,.26,.22);
    for(const z of [.28,.38,.45])box(0xaaa99a,0,.094,z,.16,.025,.065);
    box(wood,0,.19,.25,.13,.26,.028);
    for(const x of [-.27,.27]){box(0x777c70,x,.12,.37,.14,.09,.14);local('crown',0x66845a,x,.24,.37,.17,.20,.17);}
  }else if(kind==='bai'){
    const blue=0x567f97;
    local('roof',0x586974,0,h+.06,-.08,.86,.20,.73);
    for(const side of [-1,1])local('roof',0x586974,side*.38,h+.16,-.08,.12,.10,.76);
    for(let f=0;f<level;f++){
      const y=.23+f*.28;
      box(blue,0,y+.12,.239,.73,.035,.024);
      for(const x of [-.22,0,.22]){box(blue,x,y,.258,.012,.17,.018);box(blue,x,y,.26,.12,.012,.018);}
    }
    // A freestanding decorated screen leaves a passage into the planted yard.
    box(wall,-.14,.23,.40,.47,.37,.045);box(blue,-.14,.23,.428,.31,.22,.013);
    box(0xf3ecd9,-.14,.23,.439,.24,.16,.012);local('box',blue,-.14,.23,.45,.075,.075,.015,0,0,Math.PI/4);
    local('roof',0x586974,-.14,.43,.40,.55,.075,.14);
    for(const x of [.17,.39])box(wall,x,.20,.35,.045,.29,.055);
    local('roof',0x586974,.28,.36,.35,.31,.10,.20);
    box(0xb4bba4,.28,.08,.40,.16,.025,.18);
    local('crown',0x72965c,-.35,.20,.24,.13,.20,.12);
  }else if(kind==='dutch'){
    local('roof',0x59646b,0,h+.06,-.08,.78,.25,.64);
    // Narrow steps rise towards the hoisting beam, with pale stone coping.
    for(const [width,rise] of [[.72,.09],[.51,.17],[.30,.25],[.12,.31]]){
      box(wall,0,h+.06+rise/2,.24,width,rise,.055);
      box(0xe8d8b8,0,h+.06+rise,.25,width+.025,.018,.07);
    }
    box(wood,0,h+.31,.34,.035,.035,.22);
    for(let f=0;f<level;f++){
      const y=.23+f*.28;
      for(const x of [-.22,0,.22]){box(0xf0dfbd,x,y,.251,.012,.17,.018);box(0xf0dfbd,x,y,.253,.12,.012,.018);}
      box(0xe0c49d,0,y+.13,.24,.73,.018,.025);
    }
    box(0x34594e,0,.20,.25,.12,.28,.03);
    for(const [z,w] of [[.28,.17],[.34,.22],[.40,.27]])box(0xa79b86,0,.07+( .40-z)*.3,z,w,.05,.065);
    for(const x of [-.28,.28]){box(wood,x,.12,.36,.18,.09,.11);local('crown',0x709651,x,.20,.36,.17,.12,.10);local('crown',0xc88994,x,.26,.36,.12,.06,.09);}
  }else if(kind==='chalet'){
    box(0x9d9e8d,0,.15,-.08,.75,.20,.60);
    local('roof',0x594b3d,0,h+.06,-.07,.94,.29,.85);
    for(let y=.30;y<h;y+=.07)box(0xb08b62,0,y,.224,.70,.014,.02);
    for(const x of [-.34,.34])box(wood,x,h/2+.06,.24,.035,h,.035);
    for(let f=0;f<level;f++){
      const y=.18+f*.28;
      box(wood,0,y,.32,.83,.045,.24);
      box(wood,0,y+.18,.425,.82,.025,.03);
      for(const x of [-.37,-.24,-.12,0,.12,.24,.37])box(wood,x,y+.10,.425,.025,.16,.025);
      for(const x of [-.23,.23]){box(wood,x,y+.14,.448,.21,.055,.055);local('crown',0x799454,x,y+.19,.447,.20,.06,.06);local('crown',0xc17b7b,x,y+.23,.447,.14,.04,.06);}
    }
    box(0x857b6b,.24,h+.20,-.25,.075,.24,.075);
    box(wood,0,.19,.255,.13,.25,.03);
  }else if(kind==='spanish'){
    const tile=0xb85f3f,highlight=0xd88a59;
    // An L-shaped set of low tiled roofs wraps the courtyard instead of reading as one generic gable.
    local('roof',tile,-.14,h+.04,-.13,.58,.20,.67);
    local('roof',0xc66f49,.25,h+.09,.04,.31,.16,.49,Math.PI/2);
    for(let i=-2;i<=2;i++)box(highlight,-.14+i*.105,h+.235-Math.abs(i*.105)*.53,-.13,.028,.022,.62);
    for(let i=-1;i<=1;i++)box(highlight,.25,h+.255-Math.abs(i*.09)*.50,.04,.43,.022,.027,Math.PI/2);
    box(0xf0d4ae,-.14,h+.255,-.13,.035,.045,.69);
    // Three open, segmented arches over a shaded front porch.
    for(const x of [-.25,0,.25]){
      for(const side of [-1,1])box(wall,x+side*.10,.19,.36,.045,.27,.055);
      for(let j=0;j<7;j++){
        const a=j*Math.PI/6;
        local('box',wall,x+Math.cos(a)*.10,.32+Math.sin(a)*.10,.36,.065,.055,.07,0,0,-(a+Math.PI/2));
      }
    }
    box(0xc87850,-.30,.12,.43,.18,.13,.10);
    local('crown',0x718f51,-.30,.23,.43,.17,.16,.12);
    local('crown',0xc17f98,-.30,.30,.43,.12,.09,.10);
  }else if(kind==='french'){
    // A broad steep lower roof and a narrow cap suggest a mansard silhouette.
    local('roof',0x596778,0,h+.06,-.08,.84,.30,.72);
    box(0x667586,0,h+.31,-.08,.53,.08,.43);
    for(const x of [-.23,.23]){
      box(wall,x,h+.19,.20,.16,.22,.09);
      box(glass,x,h+.19,.251,.09,.13,.015);
      local('roof',0x596778,x,h+.30,.20,.20,.06,.14);
    }
    box(0xa78a72,.25,h+.27,-.22,.085,.22,.085);
    box(wood,0,.19,.25,.12,.26,.025);
    for(const x of [-.30,.30]){
      box(0xb5ab94,x,.09,.37,.16,.09,.16);
      local('crown',0x618350,x,.21,.37,.18,.23,.18);
    }
    box(0xe0d7bf,0,.07,.36,.20,.045,.24);
  }else if(kind==='nordic'){
    const slate=0x4c5962;
    local('roof',slate,0,h+.04,-.08,.88,.32,.74);
    // A small cross-gable and pale skylights break the long, steep A-frame.
    local('roof',0x65737a,.23,h+.12,.08,.37,.20,.43,Math.PI/2);
    for(const x of [-.20,0])box(0x9eb9bd,x,h+.135,-.15,.13,.025,.20);
    box(0x3d484d,0,h+.34,-.08,.035,.035,.77);
    for(const x of [-.34,.34])box(0xf2ead5,x,h/2+.06,.222,.045,h,.025);
    for(let y=.12;y<h;y+=.085)box(0xc17967,0,y,.215,.66,.012,.015);
    for(let f=0;f<level;f++)for(const x of [-.22,0,.22]){
      box(0xf4ebd8,x,.23+f*.28,.251,.012,.17,.012);
      box(0xf4ebd8,x,.23+f*.28,.253,.12,.012,.012);
    }
    box(wood,0,.09,.34,.80,.065,.25);
    for(const x of [-.35,.35])box(0xf3e9d1,x,.22,.43,.035,.27,.035);
    box(0xf3e9d1,0,.34,.43,.74,.025,.025);
    box(0x8a796e,.25,h+.20,-.23,.075,.25,.08);
  }else if(kind==='british'){
    const slate=0x5d646a;
    local('roof',slate,0,h+.04,-.10,.80,.20,.67);
    // Twin street-facing gables reinforce the paired brick-house roofline.
    for(const x of [-.23,.23]){
      local('roof',0x697176,x,h+.10,.13,.28,.22,.36,Math.PI/2);
      box(wall,x,h+.11,.23,.22,.16,.11);
      box(glass,x,h+.13,.291,.11,.10,.014);
    }
    for(const x of [-.28,.28]){
      box(0x96654f,x,h+.20,-.20,.095,.27,.095);
      box(0xd2bda0,x,h+.34,-.20,.12,.03,.12);
    }
    box(wall,-.19,.24,.28,.28,.34,.15);
    box(glass,-.19,.27,.36,.21,.19,.016);
    for(const x of [-.30,-.19,-.08])box(0xf2e4ca,x,.27,.372,.015,.22,.016);
    local('roof',0x626a6d,-.19,.42,.29,.32,.09,.20);
    box(0x354d49,.19,.21,.25,.13,.30,.04);
    box(0xd7c5a5,.19,.39,.26,.19,.045,.09);
    for(const x of [-.34,-.20,0,.34])local('crown',0x638250,x,.15,.42,.15,.18,.10);
  }else if(kind==='italian'){
    const tile=0xb56b47;
    local('roof',tile,0,h+.03,-.08,.87,.16,.72);
    // A square rooftop belvedere distinguishes the villa from the Spanish courtyard roof.
    box(wall,.22,h+.15,-.15,.22,.20,.23);
    for(const side of [-1,1])box(0x5e7860,.22+side*.065,h+.17,-.272,.045,.10,.015);
    local('roof',0xc37a50,.22,h+.25,-.15,.30,.10,.31,Math.PI/2);
    for(const z of [-.31,.15])box(0xd79562,0,h+.12,z,.80,.022,.027);
    for(let f=0;f<level;f++)for(const x of [-.22,0,.22])for(const side of [-1,1]){
      box(0x5e7860,x+side*.08,.23+f*.28,.258,.038,.17,.023);
    }
    for(const x of [-.32,.32])box(wood,x,.27,.41,.035,.44,.035);
    for(const x of [-.32,-.16,0,.16,.32])box(wood,x,.49,.32,.03,.035,.27);
    for(const z of [.24,.41])box(wood,0,.47,z,.72,.04,.03);
    for(const x of [-.25,0,.25])local('crown',0x81975c,x,.52,.31,.20,.07,.18);
    local('cylinder',0xb47752,.31,.14,.27,.12,.16,.12);
    local('crown',0x617f48,.31,.31,.27,.12,.25,.12);
  }else{
    local('roof',0x505b59,0,h+.06,-.08,.91,.27,.80);
    box(0x6a7470,0,h+.34,-.08,.035,.045,.83);
    box(wood,0,.09,.29,.78,.08,.14);
    box(0xe1d6bb,.20,.08,.40,.34,.035,.13);
    for(const x of [.08,.15,.22,.29])box(0xc7bca3,x,.102,.40,.008,.006,.11);
    local('crown',0x92958a,.20,.14,.39,.10,.09,.08);
    box(wood,-.31,.18,.38,.035,.27,.035);
    local('crown',0x688853,-.31,.32,.38,.22,.22,.19);
    for(const x of [-.34,.34])box(wood,x,h/2+.06,.23,.035,h,.035);
  }
}
