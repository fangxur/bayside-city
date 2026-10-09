import * as THREE from 'three';
import {stoneBridgeLayout,stoneBridgeAt,roadSurfaceHeight} from './stone-bridges.js';
import {roadElevation,interchangeBounds} from './interchanges.js';
import {gridIndex,inGrid} from './grid.js';
import {matchesBuildingFilter} from './building-filter.js';
import {footprintSize} from './building-footprint.js';
import {LANDMARKS,completedLandmarkLevel,landmarkScale} from './landmarks.js';
import {isClassicalSculpture} from './decorations.js';

export const LIGHTING_MODES=['day','night','auto'];
export const LANDMARK_LIGHT_COLORS={gold:0xffd58b,cyan:0x72e8f1,pink:0xf4a7df,white:0xeaf7ff};
const landmarkLightColors=new Set(Object.values(LANDMARK_LIGHT_COLORS));
export const isLandmarkLight=(_kind,p)=>landmarkLightColors.has(p[0]);
// Pearl spheres and Eiffel lattice have a soft facade wash beneath their light strips.
export const isLandmarkWash=(kind,p)=>kind==='crown'&&p[0]===0xcb8f9d||p[0]===0x89674c||p[0]===0xaa8560;
export function nightAmount(mode,seconds){
 if(mode==='night')return 1;if(mode!=='auto')return 0;
 // A two-minute visual day, independent of the monthly economy.
 const phase=((seconds%120)+120)%120;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 return smooth((phase-45)/15)*(1-smooth((phase-100)/15));
}
export function isLuminousPart(kind,p){
 const [color,,y,,w,h,d]=p;
 if(kind==='box'&&(color===0xffefba||color===0xffdfaa))return true; // Existing street-lamp lenses.
 if(kind==='box'&&color===0x8ba096&&h>.045&&Math.min(w,d)<.065)return true; // Courtyard grey-green glazing.
 const r=color>>16&255,g=color>>8&255,b=color&255;
 return kind==='box'&&y>.15&&h>.045&&Math.min(w,d)<.065&&b>r*1.08&&g>r*1.02;
}
// These water colors belong exclusively to fountain basins, jets and tier bowls.
const fountainColors=new Set([0x68a8b1,0x70adb0,0x8cc5c7,0xbde2dd,0x8fc7c7,0xb4dcda,0xa9d7d4,0xc8e6df,0xbcd0c2]);
export function isFountainPart(kind,p){return (kind==='cylinder'||kind==='dome')&&fountainColors.has(p[0]);}
export class NightLighting {
 constructor(scene,geometries,baseMaterial){
  this.scene=scene;this.geometries=geometries;this.baseMaterial=baseMaterial;this.group=new THREE.Group();scene.add(this.group);
  this.windowMaterial=new THREE.MeshBasicMaterial({color:0xffd999,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  this.landmarkMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  this.landmarkWashMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  this.sculptureWashMaterial=this.landmarkWashMaterial.clone();this.sculptureWashMaterial.vertexColors=true;
  this.sculptureWashMaterial.polygonOffset=true;this.sculptureWashMaterial.polygonOffsetFactor=-1;this.sculptureWashMaterial.polygonOffsetUnits=-1;
  this.fountainMaterial=new THREE.MeshBasicMaterial({color:0xb2f3ed,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  this.basinMaterial=new THREE.ShaderMaterial({
   uniforms:{amount:{value:0},time:{value:0}},transparent:true,depthWrite:false,toneMapped:false,
   vertexShader:`varying vec3 localPosition;
    void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
   fragmentShader:`
    uniform float amount;uniform float time;varying vec3 localPosition;
    void main(){
     vec2 p=localPosition.xz;float radius=length(p);float spots=0.0;
     // Eight underwater lights leave the centre deeper and darker.
     for(int i=0;i<8;i++){
      float angle=float(i)*0.78539816;
      vec2 lamp=vec2(cos(angle),sin(angle))*0.40;
      spots+=exp(-dot(p-lamp,p-lamp)*110.0);
     }
     float ripple=pow(0.5+0.5*sin(radius*64.0-time*1.6),10.0);
     float rim=exp(-pow((radius-0.47)*48.0,2.0));
     vec3 color=vec3(0.018,0.16,0.20)+vec3(0.07,0.40,0.37)*spots;
     color+=vec3(0.05,0.12,0.12)*ripple+vec3(0.12,0.31,0.27)*rim;
     gl_FragColor=vec4(color,amount*0.88);
     #include <colorspace_fragment>
    }`
  });
  this.fountainGlowMaterial=new THREE.ShaderMaterial({
   uniforms:{amount:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
   fragmentShader:`uniform float amount;varying vec2 vUv;void main(){float r=length(vUv*2.0-1.0);float a=pow(max(0.0,1.0-r),2.5);gl_FragColor=vec4(0.19,0.72,0.66,a*amount*0.55);}`
  });
  // A soft, procedural pool of light avoids thousands of real point lights.
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);data[i]=255;data[i+1]=205;data[i+2]=126;data[i+3]=Math.round(Math.max(0,1-r)**2*130);}
  this.texture=new THREE.DataTexture(data,size,size);this.texture.needsUpdate=true;
  this.poolMaterial=new THREE.MeshBasicMaterial({map:this.texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
  this.landmarkPoolMaterial=new THREE.MeshBasicMaterial({map:this.texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
  this.plane=new THREE.PlaneGeometry(1,1);this.dummy=new THREE.Object3D();this.meshes=[];
 }
 clear(){for(const mesh of this.meshes){this.group.remove(mesh);mesh.dispose();}this.meshes=[];}
 rebuild(cityGroup,state,filter,roadFocus){
  this.clear();const panes=[],pools=[],poles=[],lamps=[],fountainGlows=[],rimGlows=[],landmarkPools=[];
  for(const mesh of cityGroup.children)for(const p of mesh.userData.nightParts||[])panes.push(p);
  if(!roadFocus)for(const mesh of cityGroup.children){
   this.addParts(mesh.userData.partKind,mesh.userData.nightLanternParts||[],this.windowMaterial);
   this.addParts(mesh.userData.partKind,mesh.userData.nightLandmarkParts||[],this.landmarkMaterial,this.geometries[mesh.userData.partKind],true);
   this.addParts(mesh.userData.partKind,mesh.userData.nightLandmarkWashParts||[],mesh.userData.partKind?.startsWith('sculpture')?this.sculptureWashMaterial:this.landmarkWashMaterial,this.geometries[mesh.userData.partKind],true);
  }
  const windowHalos=panes.filter(p=>p[0]===0x8ba096).map(p=>{
   const angle=p[8]||0;
   return [0xffffff,p[1]+Math.sin(angle)*.018,p[2],p[3]+Math.cos(angle)*.018,p[4]*3.5,p[5]*2.8,1,0,angle,0];
  });
  this.addParts('box',windowHalos,this.poolMaterial,this.plane);
  // Use the rendered geometry so upgraded, rotated and combined fountains align exactly.
  if(!roadFocus)for(const mesh of cityGroup.children){
   const parts=mesh.userData.nightFountainParts||[];
   const basin=p=>p[0]===0x68a8b1||p[0]===0x70adb0;
   this.addParts(mesh.userData.partKind,parts.filter(p=>!basin(p)),this.fountainMaterial);
   this.addParts(mesh.userData.partKind,parts.filter(basin),this.basinMaterial);
   for(const p of parts)if(!basin(p))fountainGlows.push([p[1],p[2]+p[5]*.51,p[3],p[4]*2.3,p[6]*2.3]);
   for(const p of parts)if(p[0]===0x68a8b1||p[0]===0x70adb0){
    fountainGlows.push([p[1],.075,p[3],p[4]*2.8,p[6]*2.8]);
    const radius=p[4]/2+.035;
    for(let i=0;i<8;i++){
     const angle=i*Math.PI/4,x=p[1]+Math.cos(angle)*radius,z=p[3]+Math.sin(angle)*radius;
     lamps.push([0xffefba,x,p[2]+.025,z,.025,.012,.025,0,0,0]);
     rimGlows.push([x,p[2]+.035,z,.20,.20]);
    }
   }
  }
  stoneBridgeLayout(state,true);
  for(const t of state.tiles)if(t.road){
   const x=t.x-31.5,z=t.y-31.5,y=t.bridge?.25:.10;
   const stone=stoneBridgeAt(state,t.x,t.y);
   if(stone){pools.push([x,roadSurfaceHeight(state,t.x,t.y,stone.axis)+.028,z,.5,.5]);continue;}
   if(t.interchange){
    const axis=t.interchange.axis,ew=axis==='ew';
    if(t.interchange.core)pools.push([x,.10,z,1.7,1.7]);
    const b=interchangeBounds(t.interchange),along=Math.abs(ew?t.x-b.cx:t.y-b.cy),cross=ew?t.y-b.cy:t.x-b.cx;
    if(Math.abs(cross)===((ew?b.height:b.width)-1)/2&&along===((ew?b.width:b.height)-1)/2){
     const inset=-Math.sign(cross)*.38;
     pools.push([x+(ew?0:inset),roadElevation(state,t.x,t.y,axis)+.102,z+(ew?inset:0),ew?1:1.6,ew?1.6:1]);
    }
    continue; // The model already carries its own elevated lamp posts.
   }
   pools.push([x,y,z,1.7,1.7]);
   if((t.x+t.y)%3===0){
    const east=inGrid(state,t.x+1,t.y)&&state.tiles[gridIndex(state,t.x+1,t.y)]?.road,side=east?0:.40;
    poles.push([0x526070,x+side,y+.27,z+(east?.40:0),.022,.54,.022,0,0,0]);
    lamps.push([0xffefba,x+side,y+.56,z+(east?.40:0),.095,.035,.095,0,0,0]);
   }
  }
  if(!roadFocus)for(const b of state.buildings){
   if(!matchesBuildingFilter(b,filter))continue;
   const n=footprintSize(b),x=b.x-31.5+(n-1)/2,z=b.y-31.5+(n-1)/2;
   if(LANDMARKS[b.type]&&b.active!==false&&completedLandmarkLevel(b)>0){
    const color=['orientalPearl','cantonTower'].includes(b.type)?LANDMARK_LIGHT_COLORS.pink:['observatory','museum'].includes(b.type)?LANDMARK_LIGHT_COLORS.cyan:LANDMARK_LIGHT_COLORS.gold;
    const scale=landmarkScale({...b,level:completedLandmarkLevel(b)}),y=.14*scale+.015;
    for(const side of [-1,1])landmarkPools.push([color,x+side*n*.34,y,z,n*1.1,n*1.1,1,-Math.PI/2,0,0]);
   }
   // Garden/entrance illumination also covers buildings without glass windows.
   if(isClassicalSculpture(b.type)&&b.active===false)continue;
   for(const side of [-1,1]){const a=x+side*(n/2-.10),d=z+n/2-.10;pools.push([a,.12,d,.9,.9]);lamps.push([0xffefba,a,.17,d,.06,.07,.06,0,0,0]);}
  }
  this.addBoxes(panes.concat(lamps),this.windowMaterial);this.addBoxes(poles,this.baseMaterial);
  this.addPools(fountainGlows,this.fountainGlowMaterial);
  this.addPools(rimGlows,this.poolMaterial);
  this.addPools(pools,this.poolMaterial);
  this.addParts('box',landmarkPools,this.landmarkPoolMaterial,this.plane,true);
 }
 addPools(pools,material){
  if(!pools.length)return;
  const mesh=new THREE.InstancedMesh(this.plane,material,pools.length);
  pools.forEach(([x,y,z,w,d],i)=>{this.dummy.position.set(x,y,z);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.set(w,d,1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);});
  mesh.frustumCulled=false;this.group.add(mesh);this.meshes.push(mesh);
 }
 addBoxes(parts,material){this.addParts('box',parts,material);}
 addParts(kind,parts,material,geometry=this.geometries[kind],preserveColors=false){
  if(!parts.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,parts.length);
  // Irregular sculpture surfaces must align exactly; inflating them opens dark patches.
  const shellScale=material===this.sculptureWashMaterial?1:1.025;
  parts.forEach((p,i)=>{this.dummy.position.set(p[1],p[2],p[3]);this.dummy.rotation.set(p[7]||0,p[8]||0,p[9]||0);this.dummy.scale.set(p[4]*shellScale,p[5]*shellScale,p[6]*shellScale);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(preserveColors)mesh.setColorAt(i,new THREE.Color(p[0]));});mesh.frustumCulled=false;this.group.add(mesh);this.meshes.push(mesh);
 }
 setAmount(amount,time=0){this.group.visible=amount>.01;this.windowMaterial.opacity=amount*.94;this.landmarkMaterial.opacity=amount*.9;this.landmarkWashMaterial.opacity=amount*.34;this.sculptureWashMaterial.opacity=amount*.34;this.landmarkPoolMaterial.opacity=amount*.72;this.poolMaterial.opacity=amount*.85;this.fountainMaterial.opacity=amount*.66;this.basinMaterial.uniforms.amount.value=amount;this.basinMaterial.uniforms.time.value=time;this.fountainGlowMaterial.uniforms.amount.value=amount;}
 dispose(){this.clear();this.group.removeFromParent();this.windowMaterial.dispose();this.landmarkMaterial.dispose();this.landmarkWashMaterial.dispose();this.sculptureWashMaterial.dispose();this.landmarkPoolMaterial.dispose();this.fountainMaterial.dispose();this.basinMaterial.dispose();this.fountainGlowMaterial.dispose();this.poolMaterial.dispose();this.texture.dispose();this.plane.dispose();}
}
