export const EUROPEAN_STREET_KINDS=['parisApartment','seineTownhouse','londonTerrace','thamesWarehouse'];
export const isEuropeanStreet=b=>EUROPEAN_STREET_KINDS.includes(b.businessKind);
const floorsFor=b=>[2,3,4,5,6,6][Math.max(0,Math.min(5,(b.level||1)-1))];
export const europeanHomeHeight=b=>.10+floorsFor(b)*.26+((b.level||1)===6?.10:0)+.43;

// All four streets share a restrained slate / stone / brick palette. Upgrades
// add floors and craft details while retaining the same street-facing massing.
export function drawEuropeanHome(b,local,box){
 const kind=b.businessKind,floors=floorsFor(b),level=b.level||1,h=.10+floors*.26+(level===6?.10:0);
 const stone=0xe4dac5,trim=0xf1e8d6,slate=0x576470,iron=0x465458,glass=b.active===false?0x89918a:0x668f9b;
 box(0xc9c4b3,0,.035,0,.98,.07,.98);
 const win=(x,y,z,w=.085,height=.15)=>{
  box(trim,x,y,z,w+.024,height+.026,.018);box(glass,x,y,z+.012,w,height,.012);
  box(trim,x,y,z+.021,.009,height,.008);box(trim,x,y,z+.021,w,.009,.008);
  box(trim,x,y-height/2-.025,z+.012,w+.038,.019,.037);
 };
 const sideWindows=(x,zs)=>{for(let f=0;f<floors;f++)for(const z of zs){
  const y=.245+f*.26;box(trim,x,y,z,.018,.176,.106);box(glass,x+Math.sign(x)*.012,y,z,.012,.15,.082);
  box(trim,x+Math.sign(x)*.02,y,z,.01,.01,.082);
 }};
 const balcony=(x,y,z,w)=>{
  box(trim,x,y-.10,z-.016,w+.028,.03,.095);box(iron,x,y+.015,z+.03,w,.013,.013);
  for(let a=-w/2;a<=w/2+.001;a+=.045)box(iron,x+a,y-.04,z+.03,.008,.11,.009);
 };
 const mansard=(x,z,w,d,base,dormers=3)=>{
  local('mansard',slate,x,base+.13,z,w,.26,d);box(0x7c878d,x,base+.267,z,w*.66,.017,d*.66);
  for(let i=0;i<dormers;i++){
   const a=x+(i-(dormers-1)/2)*w/(dormers+.3),front=z+d*.43;
   box(stone,a,base+.13,front,.10,.15,.08);win(a,base+.135,front+.047,.055,.095);
   local('roof',slate,a,base+.21,front,.125,.063,.13);
  }
  for(const a of [-1,1]){
   box(0xb2997d,x+a*w*.29,base+.29,z-d*.20,.052,.20,.065);
   for(const dx of [-.013,.013])local('cylinder',0x8f6e56,x+a*w*.29+dx,base+.401,z-d*.20,.013,.03,.022);
  }
 };
 if(kind==='parisApartment'){
  // A street wall and two returns frame a visible interior courtyard.
  box(stone,0,(h+.08)/2,.23,.91,h-.08,.30);
  for(const side of [-1,1])box(stone,side*.335,(h+.08)/2,-.10,.24,h-.08,.60);
  box(0xb2ad98,0,.10,-.18,.41,.045,.37);local('crown',0x6f855f,0,.21,-.18,.20,.22,.22);
  for(let f=0;f<floors;f++){
   const y=.245+f*.26;
   box(trim,0,y+.123,.235,.925,.025,.31);
   for(const x of [-.35,-.21,-.07,.07,.21,.35])win(x,y,.386,.081);
   if(f===1||f===floors-1)balcony(0,y,.417,.89);
   else if(f>0)for(const x of [-.35,-.07,.21])balcony(x,y,.417,.105);
  }
  sideWindows(.461,[-.28,-.07,.14,.31]);sideWindows(-.461,[-.28,-.07,.14,.31]);
  box(trim,0,.15,.393,.25,.20,.025);box(iron,0,.155,.412,.16,.20,.025);
  box(trim,0,h+.015,.23,.955,.054,.35);for(const side of [-1,1])box(trim,side*.335,h+.015,-.10,.29,.054,.62);
  mansard(0,.23,.95,.35,h+.04,5);
  for(const side of [-1,1])mansard(side*.335,-.13,.28,.57,h+.04,1);
 }else if(kind==='seineTownhouse'){
  // Two narrow, slightly staggered old quay houses: plaster, tall windows, slate.
  for(const [i,x] of [-.225,.225].entries()){
   const top=h-i*.055,wall=i?0xd4c3a8:stone;
   box(wall,x,(top+.08)/2,-.035,.442,top-.08,.75);
   for(let f=0;f<floors;f++){
    const y=.245+f*.26-i*.012;for(const dx of [-.108,.108])win(x+dx,y,.349,.09);
    box(trim,x,y+.123,.353,.446,.022,.035);
    if(f===1||f===floors-1)balcony(x,y,.405,.40);
   }
   box(trim,x,.22,.372,.17,.28,.026);box(i?0x506760:0x465b6b,x,.205,.392,.12,.25,.023);
   mansard(x,-.035,.46,.78,top+.02,2);
  }
  sideWindows(.455,[-.26,0,.25]);sideWindows(-.455,[-.26,0,.25]);
  for(const x of [-.35,.35]){box(0x9a8064,x,.09,.445,.19,.08,.06);local('crown',0x75845d,x,.155,.445,.18,.095,.07);}
 }else if(kind==='londonTerrace'){
  const brick=0xa58a70;
  for(const [i,x] of [-.298,0,.298].entries()){
   box(brick,x,(h+.08)/2,-.04,.295,h-.08,.69);
   box(0xe6ded0,x,.23,.316,.295,.30,.04);
   for(let f=0;f<floors;f++)for(const dx of [-.072,.072])win(x+dx,.245+f*.26,.319,.072,f===floors-1?.125:.15);
   box(trim,x,h+.035,-.04,.30,.057,.72);local('roof',slate,x,h+.056,-.06,.30,.16,.71);
   box(trim,x,h+.115,.306,.302,.12,.035);
   box(trim,x+.071,.23,.347,.11,.27,.025);box([0x36534e,0x3c4e60,0x584a44][i],x+.071,.205,.368,.082,.22,.019);
   local('crown',glass,x+.071,.354,.37,.082,.062,.018);
   for(let j=0;j<3;j++)box(0xb8b2a2,x+.071,.075+j*.017,.426-j*.024,.125,.025,.045);
   for(const side of [-1,1]){box(0x8d705b,x+side*.115,h+.21,-.23,.043,.27,.065);for(const dx of [-.01,.01])local('cylinder',0x74523c,x+side*.115+dx,h+.369,-.23,.014,.05,.017);}
   // Front railings keep the rhythm of individual doorways along the terrace.
   box(iron,x-.069,.19,.447,.15,.018,.018);for(const dx of [-.13,-.08,-.03])box(iron,x+dx,.13,.447,.01,.14,.012);
  }
  sideWindows(.451,[-.23,.02,.23]);sideWindows(-.451,[-.23,.02,.23]);
 }else if(kind==='thamesWarehouse'){
  const brick=0x9d6b53,dress=0xbd9674;
  box(brick,0,(h+.08)/2,-.035,.91,h-.08,.73);
  for(let f=0;f<floors;f++){
   const y=.245+f*.26;box(dress,0,y+.126,.337,.92,.022,.025);
   for(const x of [-.35,-.175,0,.175,.35]){
    box(dress,x,y,.340,.126,.208,.03);box(glass,x,y,.363,.089,.17,.015);
    box(iron,x,y,.373,.009,.17,.009);box(iron,x,y,.373,.089,.01,.009);
   }
   if(f>0&&level>=3)for(const x of [-.26,.26])balcony(x,y,.422,.22);
  }
  for(const x of [-.446,-.09,.09,.446])box(dress,x,(h+.08)/2,.354,.035,h-.02,.065);
  for(const x of [-.305,0,.305]){
   local('roof',slate,x,h+.026,-.04,.322,.24,.79);
   box(dress,x,h+.095,.346,.27,.13,.035);box(glass,x,h+.102,.370,.09,.11,.013);
   box(dress,x,h+.20,.355,.13,.06,.045);
  }
  sideWindows(.461,[-.25,-.05,.16]);sideWindows(-.461,[-.25,-.05,.16]);
  box(iron,0,h+.26,.33,.028,.18,.032);box(iron,0,h+.34,.392,.028,.028,.21);box(iron,0,h+.24,.475,.01,.19,.01);
  box(iron,0,.22,.4,.125,.28,.035);box(0xab9b83,0,.07,.425,.28,.04,.11);
 }
 if(level===6)for(const x of [-.34,.34]){box(0x9c8769,x,.105,.447,.10,.10,.07);local('crown',0x6b845a,x,.21,.447,.13,.19,.08);}
}
