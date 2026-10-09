import * as THREE from 'three';
import {stoneDeckHeight,stoneArchHeight,stoneArchAt} from './stone-bridges.js';
import {ROAD_TIERS} from './progression.js';
import {boulevardLanes} from './city-layout.js';
const WORLD=31.5;

// Reuse the approach roads' lane positions and dash phase in world coordinates.
function bridgeRoadStripes(b,level){
 const white=level>=6?0xffffff:0xf1eee0,lines=[];
 const line=(cross,color,width,dash=0)=>lines.push({cross,color,width,dash});
 for(const side of [-1,1])line(b.cross+side*(b.width/2-.255),white,.018);
 if(b.width===1){
  if(level===1)line(b.cross,0xdedcc7,.023,.27);
  else{line(b.cross,0xeadfa9,.023);line(b.cross+.047,0xeadfa9,.015);}
  return lines;
 }
 const layout={axis:b.axis,min:b.min,max:b.max,level,fourLane:b.width===2&&level>=2,sharedLanes:b.width>2||level>=2};
 let median=0;
 for(let cross=b.min;cross<=b.max;cross++){
  if(layout.sharedLanes){
   if(cross!==b.min&&cross!==b.max)continue;
   const lanes=boulevardLanes({x:cross,y:cross},layout);median=lanes.median;
   for(const divider of lanes.dividers)line(cross+divider,white,.022,.34);
  }else if(Math.abs(cross-b.cross)>.06)line(cross,white,.022,.34);
 }
 if(median)line(b.cross,0xaab8b7,median);
 else for(const side of [-1,1])line(b.cross+side*.034,layout.fourLane?0xedce77:0xeadfa9,layout.fourLane?.025:.016);
 return lines;
}

// Continuous masonry with open vaults and solid piers between each pair of arches.
export function stoneVaultGeometry(b,{lining=false}={}){
 const positions=[],colors=[],ew=b.axis==='ew',color=new THREE.Color();
 const vertex=(a,h,c)=>ew?[a-WORLD,h,c-WORLD]:[c-WORLD,h,a-WORLD];
 const quad=(a,c,d,e,tint)=>{color.set(tint);for(const p of [a,c,d,a,d,e]){positions.push(...p);colors.push(color.r,color.g,color.b);}};
 const steps=Math.max(48,Math.ceil(b.length*12)),half=b.width/2-.025;
 const samples=new Set(Array.from({length:steps+1},(_,i)=>b.start-.5+b.length*i/steps));
 // Include spring points and denser samples near the arch ends so even narrow
 // piers and nearly vertical intrados edges remain solid at every river width.
 for(const arch of b.arches)for(let i=0;i<=32;i++)samples.add(arch.center+arch.opening*Math.cos(Math.PI*i/32));
 const along=[...samples].sort((a,z)=>a-z);
 for(let i=0;i<along.length-1;i++){
  const a=along[i],z=along[i+1];if(z-a<1e-8)continue;
  const topA=stoneDeckHeight(b,a)-.016,topZ=stoneDeckHeight(b,z)-.016,lowA=stoneArchHeight(b,a),lowZ=stoneArchHeight(b,z);
  const l=b.cross-half,r=b.cross+half;
  if(lining){
   if(!stoneArchAt(b,(a+z)/2))continue;
   quad(vertex(a,lowA-.004,l),vertex(z,lowZ-.004,l),vertex(z,lowZ-.004,r),vertex(a,lowA-.004,r),0xffcc83);continue;
  }
  quad(vertex(a,topA,l),vertex(a,topA,r),vertex(z,topZ,r),vertex(z,topZ,l),0xc7c1aa);
  quad(vertex(a,lowA,l),vertex(z,lowZ,l),vertex(z,lowZ,r),vertex(a,lowA,r),0xb1aa92);
  const tint=i%7===0?0xb6ae96:0xc6bda4;
  quad(vertex(a,lowA,l),vertex(a,topA,l),vertex(z,topZ,l),vertex(z,lowZ,l),tint);
  quad(vertex(z,lowZ,r),vertex(z,topZ,r),vertex(a,topA,r),vertex(a,lowA,r),tint);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function drawStoneBridge(b,batch,group){
 const ew=b.axis==='ew',point=(a,c)=>ew?[a-WORLD,c-WORLD]:[c-WORLD,a-WORLD];
 const part=(color,a,c,h,w,height,length,kind='box',slope=0)=>{const [x,z]=point(a,c);batch.add(kind,color,x,h,z,ew?length:w,height,ew?w:length,0,ew?0:-slope,ew?slope:0);};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide});
 const vault=new THREE.Mesh(stoneVaultGeometry(b),material);vault.castShadow=true;vault.receiveShadow=true;vault.userData={ownGeometry:true,ownMaterial:true,stoneVault:true};group.add(vault);
 const slices=Math.ceil(b.length*12),edge=b.width/2-.055;
 const stripes=new Map([...new Set(b.roadLevels)].map(level=>[level,bridgeRoadStripes(b,level)]));
 for(let i=0;i<slices;i++){
  const a=b.start-.5+b.length*i/slices,z=b.start-.5+b.length*(i+1)/slices,m=(a+z)/2,h0=stoneDeckHeight(b,a),h1=stoneDeckHeight(b,z),h=(h0+h1)/2,slope=Math.atan2(h1-h0,z-a),length=Math.hypot(z-a,h1-h0)+.002;
  // Use the same asphalt palette as the roads; retain the stone footways and parapets.
  const level=b.roadLevels[Math.min(b.length-1,Math.max(0,Math.floor(m+.5)-b.start))];
  part(ROAD_TIERS[level].asphalt,m,b.cross,h-.007,b.width-.12,.018,length,'flat',slope);
  for(const mark of stripes.get(level)){
   const center=Math.round(m),lo=mark.dash?Math.max(a,center-mark.dash/2):a,hi=mark.dash?Math.min(z,center+mark.dash/2):z;
   if(hi-lo<1e-6)continue;
   // Subdivide each painted dash at the deck slices, including the ramps.
   const low=h0+(h1-h0)*(lo-a)/(z-a),high=h0+(h1-h0)*(hi-a)/(z-a);
   part(mark.color,(lo+hi)/2,mark.cross,(low+high)/2+.008,mark.width,.003,Math.hypot(hi-lo,high-low)+.0005,'flat',slope);
  }
  for(const side of [-1,1]){
   part(0xdfd9c3,m,b.cross+side*(edge-.095),h+.008,.17,.024,length,'flat',slope);
   part(0xd3cbb4,m,b.cross+side*edge,h+.061,.09,.115,length,'box',slope);
   part(0xeee6d1,m,b.cross+side*edge,h+.34,.09,.06,length,'box',slope);
   // Recessed warm strip beneath the coping, following the entire curve.
   part(0xffdfaa,m,b.cross+side*(edge-.042),h+.302,.013,.014,length,'box',slope);
  }
 }
 // Submerged stone footings make the intermediate piers read clearly from the bank.
 for(const a of b.piers)part(0xb7ae94,a,b.cross,-.06,b.width+.12,.24,b.pierWidth-.02);
 const posts=Math.ceil(b.length/.48);
 for(let i=0;i<=posts;i++){
  const a=b.start-.46+(b.length-.08)*i/posts,h=stoneDeckHeight(b,a);
  for(const side of [-1,1]){
   const c=b.cross+side*edge;
   part(0xe1d9c3,a,c,h+.21,.075,.40,.075);
   part(0xf1e8d1,a,c,h+.426,.105,.048,.105);
   part(0xdad2bb,a,c,h+.474,.064,.065,.064,'crown');
  }
 }
 // Pale radial arch stones, individually jointed, on both visible faces.
 const ringSteps=32,glowPositions=[];
 const glowVertex=(a,h,c)=>ew?[a-WORLD,h,c-WORLD]:[c-WORLD,h,a-WORLD];
 for(const arch of b.arches)for(let i=0;i<ringSteps;i++){
  const a=Math.PI*i/ringSteps+.008,z=Math.PI*(i+1)/ringSteps-.008;
  const x0=arch.center+Math.cos(a)*arch.opening,x1=arch.center+Math.cos(z)*arch.opening;
  // The trim and lighting use exactly the same curve as the opening, including
  // its clearance below the approach. They can never float above the deck.
  const h0=stoneArchHeight(b,x0),h1=stoneArchHeight(b,x1);
  const slope=Math.atan2(h1-h0,x1-x0),length=Math.hypot(x1-x0,h1-h0);
  for(const side of [-1,1]){
   part(i%3?0xe3d9bd:0xccc2a7,(x0+x1)/2,b.cross+side*(b.width/2-.015),(h0+h1)/2+.054,.055,.12,length,'box',slope);
   const c=b.cross+side*(b.width/2+.015),p=[glowVertex(x0,h0,c),glowVertex(x1,h1,c),glowVertex(x1,h1+.11,c),glowVertex(x0,h0+.11,c)];
   for(const j of [0,1,2,0,2,3])glowPositions.push(...p[j]);
  }
 }
 const glowGeometry=new THREE.BufferGeometry();glowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(glowPositions,3));
 const archGlow=new THREE.Mesh(glowGeometry,new THREE.MeshBasicMaterial({color:0xffc777,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));archGlow.userData={ownGeometry:true,ownMaterial:true,stoneBridgeNight:'arch'};group.add(archGlow);
 const lining=new THREE.Mesh(stoneVaultGeometry(b,{lining:true}),new THREE.MeshBasicMaterial({color:0xffcf83,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
 lining.userData={ownGeometry:true,ownMaterial:true,stoneBridgeNight:'vault'};group.add(lining);
 const size=96,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=(x+.5)/size*2-1,v=(y+.5)/size;
   const arch=.15+Math.sqrt(Math.max(0,1-u*u))*.48;
   const ripple=Math.sin(v*95+u*17)*.025;
   const band=Math.max(0,1-Math.abs(v-arch+ripple)*9)**2;
   const halo=Math.max(0,1-Math.abs(u)*1.25)*Math.max(0,1-v*1.4)*.17;
   const fade=Math.max(0,1-Math.abs(u))*Math.max(0,1-v);
   const i=(y*size+x)*4;pixels[i]=255;pixels[i+1]=182;pixels[i+2]=83;pixels[i+3]=Math.round(255*Math.min(1,(band*.95+halo*2)*Math.sqrt(fade)*1.65*(.8+.2*Math.sin(v*125))));
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 for(const [i,arch] of b.arches.entries())for(const side of [-1,1]){
  const reflection=new THREE.Mesh(new THREE.PlaneGeometry(arch.opening*2.6,2.5),new THREE.MeshBasicMaterial({map:texture,color:0xffba61,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  const [x,z]=point(arch.center,b.cross+side*(b.width/2+1.22));reflection.position.set(x,-.049,z);reflection.rotation.set(-Math.PI/2,0,ew?(side>0?Math.PI:0):(side>0?Math.PI/2:-Math.PI/2));reflection.userData={ownGeometry:true,ownMaterial:true,ownTexture:i===0&&side===-1,stoneBridgeNight:'reflection'};group.add(reflection);
 }
}
export function animateStoneBridgeLights(parts,amount,time=0){
 for(const mesh of parts){
  mesh.visible=amount>.01;
  mesh.material.opacity=amount*(mesh.userData.stoneBridgeNight==='reflection'?.85+Math.sin(time*.8)*.1:.82);
 }
}
