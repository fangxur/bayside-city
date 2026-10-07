export const JAPANESE_HOME_KINDS=['japanese','kyotoMachiya','sukiyaHouse','gasshoHouse','japaneseApartment'];
export const isJapaneseHome=b=>JAPANESE_HOME_KINDS.includes(b.businessKind);
const tier=b=>Math.max(1,Math.min(6,b.level||1));
const compactHeight=b=>.48+(tier(b)>=3?.26:0)+(tier(b)-1)*.018;
const machiyaHeight=b=>.63+(tier(b)-1)*.032;
const gardenHeight=b=>.40+(tier(b)-1)*.028;
const farmhouseHeight=b=>.43+(tier(b)-1)*.024;
const apartmentFloors=b=>[2,3,4,5,6,6][tier(b)-1];
export function japaneseHomeHeight(b){
 switch(b.businessKind){
  case 'kyotoMachiya':return machiyaHeight(b)+.36;
  case 'sukiyaHouse':return gardenHeight(b)+.40;
  case 'gasshoHouse':return farmhouseHeight(b)+.94;
  case 'japaneseApartment':return .16+apartmentFloors(b)*.27+.25+(tier(b)===6?.05:0);
  default:return compactHeight(b)+.42;
 }
}

// Coordinates occupy one normalized lot. The renderer scales X/Z to the saved
// footprint; low traditional houses improve their craft and gardens at each tier.
export function drawJapaneseHome(b,local,box){
 const level=tier(b),kind=b.businessKind;
 const plaster=0xe6e0cf,wood=0x765940,dark=0x443c34,cedar=0xa08561,tile=0x485451,stone=0xb1afa1;
 const glass=b.active===false?0x92978c:0x8ba096,lamp=b.active===false?0x92978c:0xffdfaa;
 box(0xc5c0ac,0,.032,0,.98,.064,.98);
 const roof=(x,z,w,d,y,rise=.16,color=tile,ridgeX=true)=>{
  local('roof',color,x,y,z,ridgeX?d:w,rise,ridgeX?w:d,ridgeX?Math.PI/2:0);
  box(dark,x,y+.009,z,w,.025,d);
  // Thin tile courses follow the slope without extra raised roof tiers.
  for(let i=1;i<=4;i++)for(const side of [-1,1]){
   const offset=(ridgeX?d:w)*.5*(1-i/5),top=y+rise*i/5+.009;
   box(color===tile?0x606963:0xa08a66,x+(ridgeX?0:side*offset),top,z+(ridgeX?side*offset:0),ridgeX?w*.98:.014,.009,ridgeX?.014:d*.98);
  }
  box(color===tile?0x353f3c:0x766044,x,y+rise+.016,z,ridgeX?w+.01:.027,.032,ridgeX?.027:d+.01);
 };
 const screen=(x,y,z,w,h,slats=5)=>{
  box(dark,x,y,z,w+.025,h+.024,.025);box(glass,x,y,z+.018,w,h,.012);
  for(let i=0;i<=slats;i++)box(wood,x-w/2+i*w/slats,y,z+.029,.009,h+.014,.01);
  box(wood,x,y,z+.03,w,.011,.01);
 };
 const sideWindow=(x,y,z,w,h,facing=Math.sign(x))=>{
  box(dark,x,y,z,.022,h+.025,w+.025);box(glass,x+facing*.016,y,z,.012,h,w);
  for(const s of [-1,0,1])box(wood,x+facing*.027,y,z+s*w*.34,.01,h,.009);
 };
 const deck=(x,z,w,d)=>{box(wood,x,.104,z,w,.072,d);for(let i=0;i<6;i++)box(cedar,x-w*.44+i*w*.176,.145,z,.012,.008,d*.96);};
 const stepping=(x,z,count=3)=>{for(let i=0;i<count;i++)box(stone,x+(i%2?.018:0),.072,z+i*.065,.10,.027,.043);};
 const lantern=(x,z,h=.24)=>{
  box(stone,x,.06,z,.082,.035,.082);box(dark,x,h*.48,z,.024,h-.07,.024);
  box(lamp,x,h-.045,z,.055,.067,.055);box(dark,x,h+.006,z,.077,.017,.077);
 };
 const tree=(x,z,scale=1,flower=false)=>{
  box(wood,x,.20*scale,z,.025,.31*scale,.028);
  for(const [dx,dy,dz,w]of [[-.045,.33,.01,.22],[.055,.29,.015,.18],[.006,.41,-.012,.18]])
   local('crown',flower?0xc99b95:0x708658,x+dx*scale,dy*scale,z+dz*scale,w*scale,.13*scale,w*.85*scale);
 };
 const garden=(x,z,w=.23,d=.24)=>{
  box(0xd9d3bb,x,.065,z,w,.027,d);
  for(let i=0;i<5;i++)box(0xc2bba3,x-w*.38+i*w*.19,.082,z,.007,.009,d*.85);
  local('rock',0x93958b,x-.035,.105,z-.028,.085,.07,.063);
  local('rock',0xaaa99a,x+.021,.099,z+.012,.052,.048,.061);
 };
 const planter=(x,z,w=.15,base=0)=>{box(0x938269,x,base+.093,z,w,.08,.067);local('crown',0x718956,x,base+.158,z,w,.085,.067);};
 if(kind==='japanese'){
  const h=compactHeight(b),front=.17;
  box(plaster,-.06,.09+h/2,-.12,.65,h,.57);
  for(const x of [-.375,-.06,.255])box(wood,x,.09+h/2,front,.026,h,.027);
  screen(-.20,.29,front+.012,.22,.25);screen(.08,.29,front+.012,.22,.25);
  if(level>=3){for(const x of [-.22,.08])screen(x,.67,front+.015,.22,.19);roof(-.06,.19,.76,.20,.49,.052);}
  sideWindow(.273,.31,-.12,.24,.22);
  roof(-.06,-.12,.84,.72,h+.105,.19);
  deck(-.10,.282,.67,.20);roof(-.08,.29,.78,.25,.46,.065);
  for(const x of [-.43,.26])box(wood,x,.30,.38,.022,.37,.022);
  garden(.365,.18,.14,.32);stepping(.20,.38,2);tree(.365,-.25,.72);
  lantern(-.36,.427,.23);
  if(level>=2)planter(-.19,.424,.19);
  if(level>=4){box(cedar,.453,.18,.15,.018,.23,.55);for(let i=0;i<7;i++)box(wood,.467,.18,-.09+i*.079,.008,.23,.014);}
  if(level>=5)tree(-.34,.38,.43,true);
  if(level===6)lantern(.37,.39,.20);
 }else if(kind==='kyotoMachiya'){
  const h=machiyaHeight(b);
  box(plaster,0,.085+h/2,-.055,.81,h,.76);
  box(wood,0,.24,.333,.81,.32,.04);
  for(const x of [-.39,-.13,.13,.39])box(dark,x,.085+h/2,.354,.027,h,.027);
  screen(-.18,.27,.360,.30,.28,8);screen(.175,.255,.360,.20,.26,5);
  // A low second floor and continuous frontage form a quiet town-house row.
  for(const x of [-.25,0,.25])screen(x,h-.06,.338,.16,.17,6);
  roof(0,-.055,.95,.84,h+.10,.14);
  roof(0,.356,.95,.25,.49,.065);
  box(wood,0,.105,.432,.83,.045,.055);stepping(.175,.45,1);
  sideWindow(.412,.28,-.05,.23,.23);
  lantern(.335,.421,.36);planter(-.29,.45,.16);
  if(level>=2)box(0x7e8e81,.18,.285,.394,.21,.12,.018);
  if(level>=3)for(const x of [-.06,.045])box(cedar,x,.27,.407,.006,.28,.009);
  if(level>=4)planter(-.06,.449,.14);
  if(level>=5){box(stone,-.355,.10,-.39,.12,.06,.10);tree(-.345,-.37,.50);}
  if(level===6)lantern(-.38,.429,.26);
 }else if(kind==='sukiyaHouse'){
  const h=gardenHeight(b);
  // Offset pavilions and an engawa surround an open gravel and moss garden.
  box(plaster,-.025,.11+h/2,-.265,.72,h,.31);
  box(plaster,-.285,.11+h/2,-.035,.21,h,.43);
  roof(-.025,-.265,.86,.42,h+.12,.14);roof(-.285,-.025,.32,.56,h+.12,.13, tile,false);
  deck(.055,-.045,.63,.13);deck(-.12,.12,.15,.43);
  for(const x of [-.28,-.05,.18])screen(x,.29,-.103,.19,.28);
  for(const z of [-.03,.13]){box(wood,-.16,.285,z,.02,.35,.02);sideWindow(-.17,.28,z,.12,.22,1);}
  roof(.06,-.045,.67,.18,h+.035,.035);
  garden(.11,.205,.31,.34);box(0x829469,.29,.076,.19,.15,.038,.45);tree(.30,.285,.95,level>=4);
  for(const x of [-.40,-.24,-.08])stepping(x,.385,1);
  lantern(-.05,.345,.22);local('cylinder',stone,.29,.10,-.055,.10,.07,.10);local('cylinder',0x739c99,.29,.14,-.055,.064,.018,.064);
  if(level>=2)box(cedar,-.46,.19,.18,.02,.25,.49);
  if(level>=3){for(let i=0;i<9;i++)box(wood,-.474,.19,-.04+i*.054,.008,.25,.012);planter(-.30,.37,.16);}
  if(level>=5){deck(.31,-.09,.21,.14);roof(.31,-.085,.27,.21,h-.025,.035);}
  if(level===6){lantern(.33,-.08,.23);local('rock',0x97978a,.11,.11,.32,.09,.07,.06);}
 }else if(kind==='gasshoHouse'){
  const h=farmhouseHeight(b),rise=.73+(level-1)*.018;
  box(0x887151,0,.095+h/2,-.095,.64,h,.60);
  for(const x of [-.29,-.10,.10,.29])box(dark,x,.095+h/2,.213,.025,h,.026);
  for(const x of [-.20,.20])screen(x,.30,.225,.18,.22,4);
  for(const x of [-.326,.326])for(const z of [-.25,.015])sideWindow(x,.29,z,.17,.20);
  roof(0,-.095,.83,.73,h+.10,rise,0x907855,false);
  // The tall triangular timber gable is inset below the thick thatch shell.
  local('roof',0xc4b28c,0,h+.095,-.091,.67,rise*.82,.735);
  for(let i=0;i<3;i++){
   const y=h+.23+i*.18,width=.42-i*.13;
   box(dark,0,y,.286,width,.02,.016);
   screen(0,y+.045,.292,Math.max(.065,width-.16),.075,3);
  }
  box(dark,0,h+rise*.41,.294,.024,rise*.70,.018);
  box(dark,0,.25,.238,.14,.29,.026);roof(0,.335,.35,.20,.46,.085,0x907855);
  stepping(0,.38,2);garden(-.32,.34,.19,.19);tree(.34,.34,.72);
  box(wood,-.37,.14,-.335,.12,.13,.15);
  if(level>=2)planter(.22,.38,.17);
  if(level>=3){for(const x of [-.43,.43])box(cedar,x,.17,-.05,.018,.21,.40);}
  if(level>=4)lantern(-.28,.42,.25);
  if(level>=5){roof(-.29,.12,.25,.28,.29,.10,0x907855);box(wood,-.29,.16,.12,.18,.22,.21);}
  if(level===6)tree(-.35,.29,.54,true);
 }else if(kind==='japaneseApartment'){
  const floors=apartmentFloors(b),h=floors*.27+(level===6?.05:0),slab=0xe0ddd0,rail=0x707975;
  box(plaster,0,.13+h/2,-.07,.82,h,.63);
  for(let f=0;f<floors;f++){
   const y=.29+f*.27;
   for(const x of [-.26,0,.26]){
    screen(x,y,.251,.19,.19,2);
    box(cedar,x+.109,y,.348,.017,.22,.19);
   }
   box(slab,0,y-.12,.318,.89,.037,.27);
   box(rail,0,y-.01,.441,.85,.017,.015);
   box(0xb8c5bb,0,y-.053,.435,.85,.080,.013);
   for(const x of [-.41,-.135,.135,.41])box(rail,x,y-.044,.448,.012,.145,.012);
   if(f%2===0)for(const x of [-.23,.29])planter(x,.39,.14,y-.18);
   sideWindow(.416,y,-.18,.22,.17);
   box(dark,-.23,y,-.39,.15,.20,.018);
   box(slab,0,y-.12,-.425,.90,.035,.11);
   box(rail,0,y-.025,-.474,.86,.015,.012);
  }
  box(slab,0,h+.155,-.07,.94,.07,.77);
  for(const x of [-.439,.439])box(slab,x,h+.23,-.07,.028,.13,.75);
  for(const z of [-.43,.29])box(slab,0,h+.23,z,.90,.13,.028);
  for(const x of [-.28,-.14,0])box(0xaab0a7,x,h+.235,-.25,.08,.10,.11);
  box(wood,.21,.12,.32,.20,.12,.12);roof(.20,.31,.26,.21,.23,.055);
  lantern(-.39,.40,.23);
  if(level>=3)box(0x6d8a87,.20,h+.205,-.20,.25,.025,.19);
  if(level>=4){box(0x83916a,-.22,h+.215,.10,.28,.04,.17);for(const x of [-.31,-.13])local('crown',0x789060,x,h+.29,.10,.13,.12,.13);}
  if(level===6)for(const x of [.13,.33])box(cedar,x,h+.27,.13,.013,.17,.22);
 }
}
