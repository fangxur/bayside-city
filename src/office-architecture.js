export const officeHeight=b=>1.1+(b.level||1)*.38;
export function drawOffice(b,local,box){
 const level=b.level||1,h=officeHeight(b)-.16,glass=b.active===false?0x82999e:0x5f9dbb;
 const silver=0xe7ece7,stone=0xf0ecdf,steel=0x9fbac3;
 box(stone,0,.07,0,.96,.12,.96);
 box(0xd7e0db,0,.20,-.04,.85,.25,.72);
 box(glass,0,h/2+.12,-.08,.63,h,.54);
 // Continuous glazing with bright reflected strips and fine silver mullions.
 for(const x of [-.30,-.15,0,.15,.30]){
  box(silver,x,h/2+.13,.195,.016,h,.018);
  box(0x90bed1,x+.025,h/2+.13,.207,.024,h-.04,.012);
 }
 for(const z of [-.335,-.20,-.065,.07,.195]){
  box(silver,.32,h/2+.13,z,.016,h,.015);
  box(0xa0c9d6,-.32,h/2+.13,z,.014,h,.018);
 }
 for(let f=1;f<=level+3;f++){
  const y=.20+f*(h-.15)/(level+3);box(steel,0,y,.211,.65,.014,.016);box(silver,.326,y,-.07,.014,.014,.56);
 }
 box(silver,0,h+.13,-.08,.68,.045,.59);
 box(0x91b7c5,0,h+.19,-.08,.49,.09,.40);
 box(0xd6e8ea,0,h+.24,-.08,.54,.025,.45);
 // Glass lobby, brass canopy, entrance steps and planted forecourt.
 box(0x8ab4c1,0,.23,.31,.39,.27,.13);box(0xe0c28c,0,.39,.34,.54,.035,.26);
 for(const x of [-.235,.235])box(silver,x,.23,.41,.017,.30,.017);
 box(stone,0,.10,.42,.54,.08,.15);box(0xcdd7d4,0,.06,.47,.62,.04,.06);
 for(const x of [-.36,.36]){box(0xc4d0cb,x,.14,.33,.14,.16,.17);local('crown',0x6d987a,x,.27,.33,.16,.20,.17);}
 if(level>=3){box(0xcbb578,.30,h+.32,-.25,.018,.35,.018);box(0xe3ede7,.30,h+.51,-.25,.055,.03,.055);}
 if(level>=5){box(0x93b6c1,-.23,h+.30,-.20,.12,.22,.20);box(silver,-.23,h+.42,-.20,.15,.025,.23);}
}
