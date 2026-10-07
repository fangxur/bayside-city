export const specialtyFactoryHeight=b=>.35+(b.level||1)*.13+.40;

export function drawSpecialtyFactory(b,local,box){
 const k=b.businessKind,l=b.level||1,h=.35+l*.13;
 const wall=({shipyard:0x8ca4a6,carFactory:0xa8b5ab,textile:0xb57f6b,furniture:0xb99c71,brewery:0xb58565,pharmaceutical:0xe4e9de,machinery:0x7e9498,recycling:0x8caa83})[k];
 const trim=0xced2bd,steel=0x849d9e,glass=b.active===false?0x89928b:0x678f9a;
 box(0xbdb9a5,0,.045,0,.94,.08,.94);
 box(wall,0,h/2+.06,-.13,.76,h,.53);
 for(let f=0;f<l;f++)for(const x of [-.24,0,.24]){
  box(glass,x,.27+f*.13,.145,.15,.075,.016);
  box(glass,.387,.27+f*.13,x-.13,.014,.075,.14);
 }
 box(0x5c7071,0,.19,.165,.21,.26,.025);
 for(const y of [.10,.15,.20,.25,.30])box(0x9caeaa,0,y,.18,.19,.009,.008);
 box(trim,0,h+.07,-.13,.81,.04,.58);
 const pallet=(x,z,color)=>{box(0x9c8058,x,.095,z,.18,.055,.16);box(color,x,.18,z,.15,.12,.13);};
 if(k==='shipyard'){
  for(const x of [-.34,.34])box(0xcdbb6a,x,.41,.30,.035,.72,.04);
  box(0xcdbb6a,0,.77,.30,.74,.035,.06);box(0x566967,.13,.53,.30,.012,.45,.012);
  box(0x586e70,0,.12,.32,.55,.07,.22);box(0xede7cf,0,.23,.32,.48,.14,.18);box(glass,-.04,.33,.32,.16,.09,.12);
  box(steel,0,h+.12,-.13,.8,.05,.58);
 }else if(k==='carFactory'){
  for(const x of [-.25,0,.25]){local('roof',0x7c9995,x,h+.10,-.13,.26,.17,.59);box(0xb7d3c9,x,h+.17,-.13,.08,.025,.46);}
  for(const [i,color]of [0xe8dbc0,0x6794a4,0xc97f6a].entries()){
   const x=(i-1)*.27;box(0xe1dfc7,x,.091,.34,.23,.006,.28);box(color,x,.15,.34,.19,.09,.23);box(glass,x,.22,.32,.14,.06,.13);
   for(const dx of [-.1,.1])for(const z of [.27,.41])box(0x455451,x+dx,.12,z,.022,.07,.046);
  }
 }else if(k==='textile'){
  for(const x of [-.26,0,.26]){
   local('roof',0x7b8982,x,h+.09,-.13,.26,.17,.58);
   box(0xa1c3bc,x+.06,h+.16,-.13,.065,.06,.48);
  }
  for(const [i,color]of [0xb97673,0x779faa,0xd6bb76].entries()){
   const x=(i-1)*.25;pallet(x,.35,color);
   local('cylinder',color,x,.28,.35,.14,.14,.14,0,Math.PI/2);
  }
 }else if(k==='furniture'){
  local('roof',0x7a7960,0,h+.09,-.13,.83,.22,.61);
  for(let i=0;i<3;i++)for(let row=0;row<2;row++)box(row?0xc4a57a:0xa98960,-.24,.12+row*.055,.26+i*.065,.29,.045,.05);
  box(0x8d7254,.22,.25,.34,.22,.035,.18);
  for(const x of [.14,.30])for(const z of [.28,.40])box(0x8d7254,x,.16,z,.025,.17,.025);
  local('cylinder',steel,.27,h+.19,-.26,.10,.22,.10);
 }else if(k==='brewery'){
  for(const x of [-.24,0,.24]){
   local('cylinder',0xbc9565,x,h+.20,-.13,.19,.24,.19);
   local('dome',0xd4b17d,x,h+.32,-.13,.19,.12,.19);
   box(steel,x,h+.13,.05,.035,.035,.18);
  }
  box(steel,0,h+.13,.13,.53,.035,.035);
  for(const x of [-.30,.30]){
   local('cylinder',0x96704c,x,.19,.34,.16,.21,.16);
   for(const y of [.12,.26])local('cylinder',0x59635c,x,y,.34,.165,.018,.165);
  }
 }else if(k==='pharmaceutical'){
  for(const x of [-.24,.24]){
   box(0xb9c8c3,x,h+.17,-.14,.20,.17,.30);
   for(const z of [-.23,-.14,-.05])box(0x7f9b9d,x,h+.26,z,.15,.012,.016);
  }
  box(steel,0,h+.15,-.13,.035,.04,.48);
  box(0x6aaba7,0,h+.07,.16,.20,.12,.025);
  box(0xe9f2dc,0,h+.07,.18,.025,.085,.012);
  box(0xe9f2dc,0,h+.07,.18,.085,.025,.012);
  for(const x of [-.27,.27])pallet(x,.35,0xd9e4d5);
 }else if(k==='machinery'){
  for(const x of [-.34,.34])box(0x617a7e,x,h/2+.09,.16,.035,h+.06,.035);
  for(const x of [-.32,.32])box(0xd2b55f,x,.31,.37,.045,.52,.045);
  box(0xd2b55f,0,.59,.37,.70,.05,.07);
  box(0x566967,.12,.48,.37,.015,.19,.015);
  local('ring',0x647777,.12,.37,.37,.08,.08,.035,0,Math.PI/2);
  for(const x of [-.24,.24]){pallet(x,.28,steel);local('cylinder',0x536b72,x,.25,.28,.12,.12,.12);}
  for(const x of [-.25,0,.25])box(0xa5b9b6,x,h+.15,-.16,.16,.12,.25);
 }else{
  box(0x527a61,0,h+.13,-.13,.82,.09,.60);
  for(const [i,color]of [0x739da9,0xc4ad69,0x8ca779].entries()){
   const x=(i-1)*.25;box(color,x,.17,.35,.19,.19,.17);box(0x465b51,x,.27,.35,.15,.012,.13);
  }
  box(0x566d64,0,.30,.24,.18,.045,.42);
  for(const z of [.10,.18,.26,.34,.42])box(0xa8b4a1,0,.328,z,.16,.012,.013);
  for(const x of [-.25,.25])box(0xb6ba9d,x,h+.17,-.15,.18,.16,.20);
 }
}
