// Local coordinates share the landmark renderer's height scale and occupied lot.
// The two broad decks sit low on the tower; the upper lattice is one long spire.
export function drawEiffelTower({box,beam,shape,light,lit=true}){
 const iron=lit?0x89674c:0x88674c,brace=lit?0xaa8560:0xa98560,trim=0xc09b6f;
 const legs=[[.16,1.16,.135],[.36,1.015,.13],[.59,.85,.12],[.82,.72,.11],[1.05,.605,.10],[1.30,.49,.09],[1.60,.40,.078]];
 for(const a of [-1,1])for(const d of [-1,1]){
  box(0xc2b69d,a*1.16,.13,d*1.16,.37,.15,.37);
  box(iron,a*1.16,.22,d*1.16,.29,.06,.29);
  for(let j=1;j<legs.length;j++){
   const [lo,r0,t0]=legs[j-1],[hi,r1,t1]=legs[j];
   const point=(r,y,t,u,v)=>[a*r+u*t,y,d*r+v*t];
   for(const u of [-1,1])for(const v of [-1,1]){
    beam(point(r0,lo,t0,u,v),point(r1,hi,t1,u,v),iron,.045);
    beam(point(r1,hi,t1,u,v),point(r1,hi,t1,-u,v),brace,.026);
   }
   // Each foot is a four-sided lattice pylon; the central archway stays open.
   for(const side of [-1,1]){
    beam(point(r0,lo,t0,-1,side),point(r1,hi,t1,1,side),brace,.025);
    beam(point(r0,lo,t0,1,side),point(r1,hi,t1,-1,side),brace,.025);
    beam(point(r0,lo,t0,side,-1),point(r1,hi,t1,side,1),brace,.025);
    beam(point(r0,lo,t0,side,1),point(r1,hi,t1,side,-1),brace,.025);
   }
   beam(point(r0,lo,t0+.027,a,d),point(r1,hi,t1+.027,a,d),light,.018);
  }
 }
 // Four bowed arches, joining the feet to the underside of the first floor.
 // Both depth and height vary, so the arch follows the inward curve of the legs.
 for(const axis of [0,1])for(const side of [-1,1]){
  const arc=(t,offset=0)=>{
   const c=Math.cos(t),u=.98*c,y=.22+.515*Math.sin(t)+offset,v=side*(.94+.18*Math.pow(Math.abs(c),1.5));
   return axis?[v,y,u]:[u,y,v];
  };
  for(let i=0;i<16;i++){
   const t0=i*Math.PI/16,t1=(i+1)*Math.PI/16;
   beam(arc(t0),arc(t1),iron,.054);
   beam(arc(t0,.065),arc(t1,.065),trim,.038);
   beam(arc(t0,.017),arc(t1,.017),light,.016);
   beam(arc(t0),arc(t0,.065),brace,.024);
   if(i>2&&i<14){const p=arc(t0,.065);if(p[1]<.77)beam(p,[p[0],.77,p[2]],brace,.023);}
  }
 }
 const deck=(y,width,hole)=>{
  const rim=(width-hole)/2,center=(width+hole)/4;
  for(const side of [-1,1]){
   box(iron,0,y,side*center,width,.075,rim);
   box(iron,side*center,y,0,rim,.075,hole);
   box(trim,0,y+.052,side*width/2,width+.055,.027,.07);
   box(trim,side*width/2,y+.052,0,.07,.027,width+.055);
   box(iron,0,y+.16,side*width/2,width+.035,.022,.026);
   box(iron,side*width/2,y+.16,0,.026,.022,width+.035);
   box(light,0,y-.008,side*(width/2+.026),width+.06,.018,.018);
   box(light,side*(width/2+.026),y-.008,0,.018,.018,width+.06);
   for(let pos=-width/2+.08;pos<width/2;pos+=.12){
    box(iron,pos,y+.10,side*width/2,.014,.11,.018);
    box(iron,side*width/2,y+.10,pos,.018,.11,.014);
   }
  }
 };
 deck(.82,1.92,.78);
 deck(1.60,1.12,.38);
 // Small enclosed galleries, held behind the outer railings.
 for(const side of [-1,1]){
  box(0x765a45,0,.915,side*.83,.90,.105,.16);
  for(const a of [-.34,-.17,0,.17,.34])box(0x627b7b,a,.925,side*.916,.105,.056,.018);
 }
 const spire=[[1.66,.385],[1.90,.315],[2.18,.255],[2.48,.202],[2.78,.160],[3.08,.128],[3.36,.104],[3.63,.090],[3.78,.084]];
 for(let j=1;j<spire.length;j++){
  const [lo,r0]=spire[j-1],[hi,r1]=spire[j];
  for(const a of [-1,1])for(const d of [-1,1]){
   beam([a*r0,lo,d*r0],[a*r1,hi,d*r1],iron,.038);
   beam([a*(r0+.021),lo,d*(r0+.021)],[a*(r1+.021),hi,d*(r1+.021)],light,.014);
  }
  for(const side of [-1,1]){
   beam([-r1,hi,side*r1],[r1,hi,side*r1],brace,.025);
   beam([side*r1,hi,-r1],[side*r1,hi,r1],brace,.025);
   beam([-r0,lo,side*r0],[r1,hi,side*r1],brace,.025);
   beam([r0,lo,side*r0],[-r1,hi,side*r1],brace,.025);
   beam([side*r0,lo,-r0],[side*r1,hi,r1],brace,.025);
   beam([side*r0,lo,r0],[side*r1,hi,-r1],brace,.025);
  }
 }
 deck(3.79,.34,.12);
 box(iron,0,3.91,0,.24,.16,.24);
 for(const side of [-1,1]){
  box(light,0,3.93,side*.123,.17,.055,.013);
  box(light,side*.123,3.93,0,.013,.055,.17);
 }
 shape('dome',iron,0,4.005,0,.25,.17,.25);
 shape('cylinder',iron,0,4.235,0,.027,.25,.027);
}
