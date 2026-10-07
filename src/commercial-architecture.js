import {drawTeaHouse,teaHouseHeight} from './chinese-courtyard-architecture.js';
export const specialtyShopHeight = b => b.businessKind==='teaHouse'?teaHouseHeight(b):.42 + ((b.level || 1)-1)*.25 + .30;

export function drawSpecialtyShop(b,local,box){
  if(b.businessKind==='teaHouse'){drawTeaHouse(b,local,box);return;}
  const k=b.businessKind,level=b.level||1,h=.42+(level-1)*.25;
  const wood=0x74513b,trim=({tavern:0x345d50,izakaya:0x654737,kissaten:0x5a4638,flowerShop:0x68866b,bookstore:0x31584c,departmentStore:0xa9825d,foodHall:0xa95f46,europeanArcade:0xb3945e,japaneseMarket:0x514b3e,diner:0x75b5a6,mediterranean:0x467fa2,artDeco:0xc6aa65,pharmacy:0x3f8b69,repairGarage:0xc87545,laundry:0x5596ae,hardware:0xb86d3f})[k]??0xb78663;
  const wall=({tavern:0xb7866e,izakaya:0xd4c3a6,kissaten:0xc7b696,flowerShop:0xe1ddc8,bookstore:0xa7775d,departmentStore:0xd9cfba,foodHall:0xd5aa82,europeanArcade:0xe3d8bd,japaneseMarket:0xc9b999,diner:0xd6ddd2,mediterranean:0xf6f0dc,artDeco:0x405f59,pharmacy:0xe8eee4,repairGarage:0xb9b7ad,laundry:0xe4eee9,hardware:0xd8c3a3})[k]??0xf1e3bf;
  const glass=b.active===false?0x88918c:0x8ba096,upperGlass=b.active===false?0x88918c:0x8ba8a1,lamp=b.active===false?0x88918c:0xffdfaa;
  box(0xcac1a9,0,.04,0,.94,.08,.94);
  box(wall,0,h/2+.06,-.13,.76,h,.53);
  // Upper floors grow while the street-level shopfront stays recognisable.
  for(let f=1;f<level;f++){
    for(const x of [-.23,0,.23]){
      box(trim,x,.49+(f-1)*.25,.145,.17,.19,.025);
      box(upperGlass,x,.49+(f-1)*.25,.162,.115,.135,.014);
      box(upperGlass,.388,.49+(f-1)*.25,x-.13,.014,.135,.12);
    }
    box(trim,0,.38+f*.25,-.13,.79,.023,.56);
  }
  box(trim,0,.23,.15,.76,.35,.04);
  for(const x of [-.23,.23])box(glass,x,.23,.175,.23,.24,.016);
  box(wood,0,.20,.18,.13,.28,.025);
  box(glass,0,.25,.198,.085,.13,.012);
  box(0xd6b56c,.04,.17,.217,.016,.023,.012);
  const table=(x,z)=>{
    local('cylinder',0xb99362,x,.19,z,.14,.025,.14);
    box(wood,x,.12,z,.025,.14,.025);
    for(const dx of [-.105,.105]){box(wood,x+dx,.095,z,.065,.035,.075);box(wood,x+dx,.045,z,.022,.09,.025);}
  };
  if(k==='tavern'){
    box(0x5b6264,0,h+.09,-.13,.82,.07,.59);
    box(trim,0,.43,.22,.82,.045,.20);
    // Hanging sign with a gold mug silhouette.
    box(wood,.32,.55,.26,.025,.24,.025);
    box(trim,.32,.56,.31,.17,.16,.025);
    box(0xe6c17a,.31,.56,.33,.064,.085,.012);
    box(0xe6c17a,.355,.56,.33,.025,.045,.012);
    box(0xf1dfb3,.31,.61,.33,.073,.02,.014);
    for(const x of [-.30,.30]){
      local('cylinder',0x916742,x,.16,.40,.14,.22,.14);
      for(const y of [.09,.22])local('cylinder',0x525952,x,y,.40,.146,.018,.146);
    }
    table(0,.38);
    for(const x of [-.34,.34])box(0xf8d68c,x,.33,.205,.045,.09,.04);
  }else if(k==='izakaya'){
    local('roof',0x4c5856,0,h+.06,-.13,.88,.22,.66);
    local('roof',0x4c5856,0,.43,.22,.87,.10,.24);
    for(const x of [-.12,0,.12])box(0x506b77,x,.345,.245,.105,.15,.015);
    for(const x of [-.33,.33]){
      box(wood,x,.32,.30,.018,.25,.018);
      local('cylinder',0xc45e46,x,.33,.30,.10,.14,.10);
      for(const y of [.26,.40])box(0xecd4a1,x,y,.30,.085,.014,.085);
      box(0xecc391,x,.33,.354,.018,.065,.012);
    }
    box(wood,0,.12,.40,.46,.035,.10);
    for(const x of [-.18,.18])box(wood,x,.065,.40,.035,.10,.065);
    for(const x of [-.29,-.23,.23,.29])box(wood,x,.23,.195,.012,.24,.018);
  }else if(k==='kissaten'){
    // A quiet Japanese coffee house: tiled eaves, timber grid and a short noren.
    local('roof',0x45514f,0,h+.06,-.13,.88,.19,.66);
    local('roof',0x53605c,0,.43,.22,.87,.09,.25);
    for(const x of [-.27,-.18,-.09,0,.09])box(wood,x,.25,.193,.012,.27,.018);
    for(const x of [-.15,-.05,.05,.15])box(0x657d79,x,.335,.247,.09,.15,.015);
    box(wood,.27,.25,.20,.18,.29,.025);box(glass,.27,.25,.217,.13,.23,.012);
    for(const x of [.225,.315])box(wood,x,.25,.231,.010,.27,.011);
    for(const x of [-.12,0,.12])box(0xd3b07b,x,.43,.292,.10,.12,.014);
    box(wood,-.30,.50,.31,.022,.26,.022);box(trim,-.30,.54,.333,.17,.15,.025);
    local('cylinder',lamp,-.30,.55,.351,.055,.025,.055,0,Math.PI/2);
    box(wood,.15,.10,.39,.38,.035,.10);for(const x of [.02,.28])box(wood,x,.055,.39,.035,.10,.065);
  }else if(k==='flowerShop'){
    // Glazed flower room, striped awning and overflowing pavement buckets.
    box(0xf1eddd,0,h+.08,-.13,.84,.055,.61);
    for(let i=0;i<8;i++)box(i%2?0xf1e9d5:trim,-.35+i*.10,.43,.245,.10,.038,.24);
    box(trim,0,.39,.363,.78,.055,.045);
    for(const x of [-.27,-.09,.09,.27]){
      box(0xe9e5d5,x,.22,.35,.17,.30,.035);box(glass,x,.23,.373,.13,.24,.014);
      for(const dx of [-.045,.045])box(wood,x+dx,.23,.384,.008,.25,.009);
    }
    for(const x of [-.32,-.16,0,.16,.32]){
      local('cylinder',[0x9a725b,0xb68a65,0x718569][(Math.round((x+.32)*10))%3],x,.11,.43,.10,.13,.10);
      local('crown',[0xd99f93,0xd8b46f,0x899c69][(Math.round((x+.32)*10))%3],x,.22,.43,.14,.15,.12);
    }
    box(trim,.32,.59,.29,.18,.20,.035);local('crown',0xe4c078,.32,.59,.313,.10,.10,.03);box(wood,.32,.43,.29,.024,.20,.024);
    if(level>=3){box(0xb4b9a9,0,h+.13,-.13,.52,.14,.39);box(glass,0,h+.14,.075,.46,.10,.014);local('crown',0x759260,0,h+.18,-.13,.25,.14,.21);}
  }else if(k==='bookstore'){
    // Deep green bays reveal rows of books behind warm glass.
    box(0x6f5948,0,h+.08,-.13,.84,.065,.61);
    box(trim,0,.44,.245,.82,.06,.20);
    for(const x of [-.25,.25]){
      box(0xe2d5bb,x,.23,.36,.28,.30,.045);box(glass,x,.235,.389,.23,.24,.014);
      for(const y of [.16,.23,.30])box(wood,x,y,.403,.21,.014,.018);
      for(let i=0;i<5;i++)box([0xb46d55,0x668186,0xc2a360,0x7b6d8c,0x55745d][i],x-.08+i*.04,.22,.416,.026,.11,.009);
    }
    box(trim,0,.21,.37,.16,.31,.045);box(wood,0,.20,.397,.11,.25,.018);
    box(wood,.34,.55,.30,.022,.28,.022);box(0xd7c49b,.34,.57,.323,.18,.16,.025);
    for(let i=0;i<3;i++)box(trim,.29+i*.045,.57,.338,.022,.09-i*.018,.012,.22);
    box(0xc6b18a,-.30,.09,.43,.23,.06,.11);local('crown',0x6e8658,-.30,.17,.43,.20,.13,.10);
    if(level>=3){for(const x of [-.23,0,.23])box(0x31584c,x,h+.13,-.10,.15,.10,.18);}
  }else if(k==='departmentStore'){
    // Regular display bays and a centered clock keep the larger block legible.
    box(0xeee5d3,0,h+.08,-.13,.86,.065,.62);
    box(trim,0,.43,.235,.86,.065,.19);
    for(const x of [-.30,-.10,.10,.30]){
      box(0xe8dfcc,x,.235,.358,.17,.30,.045);box(glass,x,.235,.388,.13,.24,.014);
      box(trim,x,.10,.407,.15,.045,.055);
    }
    box(0x76543d,0,.22,.385,.15,.30,.035);box(lamp,0,.26,.407,.09,.18,.014);
    box(0xb4976d,0,.49,.355,.55,.06,.23);for(const x of [-.24,.24])box(0xd9cfba,x,.30,.385,.045,.38,.045);
    box(trim,0,h+.20,.18,.26,.16,.035);local('cylinder',0xe9dfc9,0,h+.20,.203,.10,.025,.10,0,Math.PI/2);
    box(0x5e655f,0,h+.20,.221,.012,.11,.012);box(0x5e655f,.035,h+.22,.222,.07,.012,.012,.5);
    box(0x74875f,0,h+.15,-.14,.54,.06,.38);for(const x of [-.20,0,.20])local('crown',0x718c5b,x,h+.21,-.14,.13,.13,.12);
  }else if(k==='foodHall'){
    // Two brick market halls share a glazed ridge and an outdoor dining terrace.
    for(const x of [-.22,.22]){
      local('roof',0x6f6257,x,h+.05,-.13,.39,.17,.59);
      box(0xe8d5b7,x,.27,.35,.31,.28,.04);box(lamp,x,.28,.378,.25,.22,.014);
      for(const dx of [-.09,0,.09])box(trim,x+dx,.28,.392,.012,.24,.012);
    }
    box(0x7d9b96,0,h+.12,-.13,.14,.16,.46);box(glass,0,h+.13,.075,.10,.11,.018);
    for(let i=0;i<8;i++){const x=-.35+i*.10;box(i%2?0xf0d6a1:trim,x,.43,.255,.10,.045,.23);box(i%2?0xf0d6a1:trim,x,.39,.365,.10,.06,.025);}
    for(const x of [-.28,0,.28]){table(x,.41);local('cylinder',lamp,x,.34,.43,.04,.025,.04);}
    box(0x684c3d,.33,.58,.30,.025,.28,.025);box(trim,.33,.60,.323,.18,.15,.025);for(const x of [.29,.33,.37])box(0xf2dcab,x,.60,.338,.016,.08,.012);
  }else if(k==='europeanArcade'){
    // Stone arcades, round-headed windows and a small corner cupola.
    box(0xf0ead8,0,h+.06,-.13,.86,.07,.61);box(trim,0,.45,.24,.86,.055,.19);
    for(const x of [-.30,-.10,.10,.30]){
      box(0xeadfc7,x,.25,.36,.17,.25,.045);box(lamp,x,.24,.389,.12,.18,.014);
      local('cylinder',lamp,x,.345,.389,.12,.025,.12,0,Math.PI/2);box(trim,x-.075,.25,.402,.016,.26,.014);box(trim,x+.075,.25,.402,.016,.26,.014);
    }
    for(const x of [-.40,-.20,0,.20,.40])box(trim,x,h/2+.08,.19,.022,h+.06,.028);
    local('roof',0x8ba8a1,0,h+.12,-.13,.55,.16,.39);for(const x of [-.18,0,.18])box(0xd5bd82,x,h+.12,.075,.018,.12,.018);
    local('cylinder',wall,.29,h+.15,-.17,.17,.16,.17);local('roof',0x596966,.29,h+.17,-.17,.23,.13,.23);local('crown',0xd0aa5e,.29,h+.27,-.17,.05,.09,.05);
    box(trim,0,.56,.31,.36,.15,.028);for(const x of [-.13,-.065,0,.065,.13])box(0xf3df9d,x,.56,.329,.025,.075,.012);
  }else if(k==='japaneseMarket'){
    // A 2×2 group of machiya storefronts gathered around a narrow entry lane.
    for(const x of [-.24,.24]){
      local('roof',0x465251,x,h+.06,-.13,.43,.19,.64);box(wood,x,.26,.20,.36,.31,.032);
      for(const dx of [-.12,-.04,.04,.12])box(0xc1ad87,x+dx,.25,.225,.012,.27,.018);
      box(lamp,x,.26,.245,.28,.20,.014);
    }
    box(0x65513f,0,.22,.20,.12,.30,.035);box(lamp,0,.25,.224,.07,.16,.014);
    local('roof',0x59635e,0,.43,.245,.22,.10,.24);for(const x of [-.07,0,.07])box(0xb44f3f,x,.39,.315,.06,.11,.014);
    for(const x of [-.34,.34]){box(wood,x,.40,.31,.018,.31,.018);local('cylinder',0xc65e49,x,.42,.31,.08,.12,.08);box(0xe8d3a1,x,.42,.354,.06,.014,.06);}
    box(0xc6b68e,0,.045,.40,.30,.025,.18);for(const x of [-.11,.11])local('crown',0x71865b,x,.13,.43,.13,.13,.10);
    if(level>=3){box(wood,0,h+.12,-.13,.34,.13,.29);for(const x of [-.11,0,.11])box(lamp,x,h+.13,.025,.07,.07,.014);}
  }else if(k==='diner'){
    box(0xc5d1cb,0,h+.10,-.13,.85,.08,.61);
    for(const y of [.10,.37,.43])box(0xd9dfd9,0,y,.22,.82,.025,.05);
    box(0xc05b4d,0,.45,.20,.82,.025,.12);
    for(const x of [-.27,.27]){
      box(0xbb574b,x,.15,.38,.17,.16,.12);
      box(0xd06b59,x,.24,.43,.17,.11,.03);
    }
    box(0xe7ddc1,0,.22,.36,.19,.025,.16);
    box(0x9aaba7,0,.13,.36,.025,.17,.025);
    box(0xa4b7b0,.32,.38,.32,.025,.61,.025);
    box(0xc96852,.32,.64,.32,.20,.14,.04);
    for(const x of [.26,.32,.38])box(0xffe0a0,x,.64,.345,.02,.065,.012);
  }else if(k==='mediterranean'){
    box(0xdad9c3,0,h+.08,-.13,.83,.05,.60);
    for(const x of [-.38,.38])box(0xf5efdc,x,h+.16,-.13,.035,.17,.59);
    box(0xf5efdc,0,h+.16,-.41,.79,.17,.035);
    for(let i=0;i<8;i++)box(i%2?0xf8f0d9:trim,-.35+i*.10,.43,.24,.10,.035,.24);
    table(-.17,.38);
    local('cylinder',0xba7e58,.30,.14,.37,.14,.16,.14);
    local('crown',0x628854,.30,.32,.37,.19,.25,.18);
    box(0x5585a0,.20,h+.12,-.15,.20,.055,.24);
  }else if(k==='artDeco'){
    for(const [w,y] of [[.82,.09],[.58,.17],[.30,.25]])box(wall,0,h+y,-.13,w,.08,.58);
    for(const x of [-.33,-.28,.28,.33])box(trim,x,h/2+.12,.20,.02,h+.10,.025);
    box(trim,0,.42,.26,.42,.045,.20);
    box(0x314841,0,.46,.25,.30,.04,.15);
    box(trim,0,h+.27,.17,.12,.06,.025);
    local('box',trim,0,.55,.225,.10,.10,.023,0,0,Math.PI/4);
    for(const x of [-.31,.31]){
      box(0x394f49,x,.12,.38,.13,.15,.13);
      local('crown',0x809266,x,.24,.38,.13,.18,.13);
    }
  }else if(k==='pharmacy'){
    box(0xf3f1df,0,h+.08,-.13,.84,.06,.61);
    box(trim,0,.43,.235,.82,.055,.18);
    for(const x of [-.25,.25])box(0xd8eee1,x,.22,.385,.20,.26,.035);
    // Green illuminated pharmacy cross and a low medicine display cabinet.
    box(0xf4f2df,.31,.58,.285,.19,.24,.035);
    box(trim,.31,.58,.307,.055,.18,.018);
    box(trim,.31,.58,.309,.17,.055,.018);
    box(0xd7e4d8,-.19,.12,.39,.29,.13,.11);
    for(const y of [.085,.13,.175])box(0x7aa58a,-.19,y,.452,.23,.015,.012);
  }else if(k==='repairGarage'){
    box(0x626966,0,h+.08,-.13,.84,.07,.62);
    box(0x4f5957,-.10,.235,.305,.49,.36,.035);
    for(const x of [-.28,-.16,.02,.14])box(0x8d9994,x,.235,.326,.025,.31,.014);
    box(trim,.29,.26,.30,.19,.31,.04);
    // Service canopy, tool board, tyres and a simple wrench-shaped sign.
    box(trim,-.10,.46,.37,.57,.055,.23);
    for(const y of [.13,.25,.37])box(0x313836,.34,y,.39,.12,.045,.10);
    box(0xead6a3,.28,.59,.30,.055,.24,.025,.55);
    box(0xead6a3,.22,.66,.30,.13,.055,.025,-.55);
  }else if(k==='laundry'){
    box(0xf0f4e8,0,h+.08,-.13,.84,.055,.61);
    box(trim,0,.43,.235,.82,.055,.18);
    // Three front-loading machines make the shop readable at map scale.
    for(const x of [-.25,0,.25]){
      box(0xd5dedb,x,.20,.36,.20,.29,.045);
      local('cylinder',0x5b7f89,x,.21,.392,.12,.035,.12,0,Math.PI/2);
      local('cylinder',0x9fc6cf,x,.21,.414,.077,.038,.077,0,Math.PI/2);
      box(0x4f6870,x,.31,.413,.10,.025,.012);
    }
    box(0xe9f0e7,-.22,.56,.29,.25,.15,.025);
    for(const x of [-.30,-.22,-.14])box(0x5d9eb2,x,.56,.306,.025,.10,.012);
  }else if(k==='hardware'){
    box(0x5d625d,0,h+.08,-.13,.84,.07,.62);
    box(trim,0,.43,.235,.82,.055,.18);
    for(const x of [-.26,0,.26]){
      box(0x6d756f,x,.23,.36,.20,.30,.04);
      for(const y of [.13,.22,.31])box(0xd3a56b,x,y,.405,.15,.018,.045);
    }
    // A hammer silhouette and outdoor bins distinguish the hardware store.
    box(0xf1dbad,.25,.61,.30,.055,.22,.025,.18);
    box(0xf1dbad,.18,.69,.30,.19,.07,.025,.18);
    for(const x of [-.28,.28]){box(0x8b765d,x,.10,.44,.16,.15,.12);box(0xb98a58,x,.19,.44,.18,.035,.14);}
  }else{
    box(0xb58369,0,h+.10,-.13,.82,.08,.59);
    for(let i=0;i<8;i++){
      const x=-.35+i*.10,c=i%2?0xf7e8c7:0xad775d;
      box(c,x,.43,.245,.10,.045,.24);
      box(c,x,.39,.365,.10,.065,.022);
    }
    for(const x of [-.29,-.21,.21,.29]){
      local('crown',0xdca85e,x,.19,.197,.058,.045,.03);
      local('crown',0xf0c584,x,.29,.197,.055,.038,.03);
    }
    table(-.19,.39);
    box(wood,.27,.14,.38,.13,.23,.04);
    box(0x455f54,.27,.15,.405,.10,.17,.014);
    for(const y of [.11,.15,.19])box(0xe9dfbe,.27,y,.416,.065,.009,.006);
  }
}
