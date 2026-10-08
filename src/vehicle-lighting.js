import * as THREE from 'three';

const level=amount=>Math.max(0,Math.min(1,Number(amount)||0));

// Painted pools give moving lights a visible footprint without a separate
// shadow-casting light for every vehicle. The same shader works on boats.
export function lightPoolMaterial(color,{beam=false}={}){
 return new THREE.ShaderMaterial({
  uniforms:{amount:{value:0},color:{value:new THREE.Color(color)}},
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.0);
   #ifdef USE_INSTANCING
   p=instanceMatrix*p;
   #endif
   gl_Position=projectionMatrix*modelViewMatrix*p;}`,
  fragmentShader:`uniform float amount;uniform vec3 color;varying vec2 vUv;
   void main(){
    ${beam?`float width=0.15+vUv.y*0.85;
    float edge=exp(-pow(abs(vUv.x*2.0-1.0)/width,4.0)*3.0);
    float alpha=edge*pow(1.0-vUv.y,1.6)*smoothstep(0.0,0.06,vUv.y);`:
    `float alpha=pow(max(0.0,1.0-length(vUv*2.0-1.0)),2.0);`}
    gl_FragColor=vec4(color,alpha*amount*0.65);
   }`
 });
}

export class RoadVehicleLighting{
 constructor(parent,capacity=140){
  this.capacity=capacity;this.group=new THREE.Group();parent.add(this.group);
  this.box=new THREE.BoxGeometry();this.plane=new THREE.PlaneGeometry().rotateX(Math.PI/2);
  this.headMaterial=new THREE.MeshBasicMaterial({color:0xfff1c9,transparent:true,opacity:0,toneMapped:false,depthWrite:false});
  this.tailMaterial=new THREE.MeshLambertMaterial({color:0xb63224,emissive:0xff3a27,emissiveIntensity:0,toneMapped:false});
  this.beamMaterial=lightPoolMaterial(0xffedb5,{beam:true});this.tailPoolMaterial=lightPoolMaterial(0xff392b);
  this.heads=new THREE.InstancedMesh(this.box,this.headMaterial,capacity*2);
  this.tails=new THREE.InstancedMesh(this.box,this.tailMaterial,capacity*2);
  this.beams=new THREE.InstancedMesh(this.plane,this.beamMaterial,capacity*2);
  this.tailPools=new THREE.InstancedMesh(this.plane,this.tailPoolMaterial,capacity*2);
  this.meshes=[this.heads,this.tails,this.beams,this.tailPools];this.dummy=new THREE.Object3D();
  for(const mesh of this.meshes){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);}
  this.setAmount(0);
 }
 setCount(count){for(const mesh of this.meshes)mesh.count=Math.max(0,Math.min(this.capacity,count))*2;}
 setAmount(amount,hidden=false){
  const n=level(amount);this.group.visible=!hidden;
  this.headMaterial.opacity=n;this.tailMaterial.emissiveIntensity=n*1.8;
  this.beamMaterial.uniforms.amount.value=n;this.tailPoolMaterial.uniforms.amount.value=n;
  for(const mesh of [this.heads,this.beams,this.tailPools])mesh.visible=n>.01;
 }
 update(index,{x=0,y=0,z=0,angle=0,pitch=0,length=.4,width=.18,visible=true}){
  const cp=Math.cos(pitch),sp=Math.sin(pitch),sa=Math.sin(angle),ca=Math.cos(angle),d=this.dummy;
  const place=(mesh,i,long,lateral,height,w,h,depth)=>{
   const forward=long*cp+height*sp,vertical=height*cp-long*sp;
   d.position.set(x+sa*forward+ca*lateral,y+vertical,z+ca*forward-sa*lateral);
   d.rotation.set(pitch,angle,0,'YXZ');d.scale.set(w,h,depth);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
  };
  if(!visible){
   d.position.set(0,-10,0);d.scale.set(0,0,0);d.updateMatrix();
   for(const mesh of this.meshes)for(let j=0;j<2;j++)mesh.setMatrixAt(index*2+j,d.matrix);
   return;
  }
  for(let j=0;j<2;j++){
   const lateral=(j?1:-1)*width*.31;
   place(this.heads,index*2+j,length/2+.010,lateral,.008,.040,.032,.023);
   place(this.tails,index*2+j,-length/2-.010,lateral,.008,.036,.032,.023);
   place(this.beams,index*2+j,length/2+.57,lateral,-.052,.52,1,1.12);
   place(this.tailPools,index*2+j,-length/2-.10,lateral,-.051,.24,1,.30);
  }
 }
 finish(){for(const mesh of this.meshes)mesh.instanceMatrix.needsUpdate=true;}
 dispose(){this.group.removeFromParent();for(const mesh of this.meshes)mesh.dispose();for(const m of [this.headMaterial,this.tailMaterial,this.beamMaterial,this.tailPoolMaterial])m.dispose();this.box.dispose();this.plane.dispose();}
}

export class YachtLighting{
 constructor(parent,kind){
  this.group=new THREE.Group();parent.add(this.group);this.box=new THREE.BoxGeometry();this.plane=new THREE.PlaneGeometry().rotateX(Math.PI/2);
  const lens=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  this.white=lens(0xfff3d6);this.warm=lens(0xffd99b);this.port=lens(0xff4939);this.starboard=lens(0x4df1a3);
  this.reflection=lightPoolMaterial(0xffdea6);this.materials=[this.white,this.warm,this.port,this.starboard,this.reflection];
  const part=(material,name,x,y,z,w,h,d,geometry=this.box)=>{
   const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(w,h,d);this.group.add(mesh);return mesh;
  };
  // Bow is local +Z: port is +X and starboard is -X.
  part(this.port,'port-light',.174,.20,.14,.033,.032,.040);
  part(this.starboard,'starboard-light',-.174,.20,.14,.033,.032,.040);
  part(this.white,'stern-light',0,.19,-.315,.042,.034,.025);
  part(this.white,'mast-light',0,kind==='cruiser'?.44:.39,.02,.035,.038,.035);
  for(const x of [-.127,.127])part(this.warm,'cabin-window',x,.215,.06,.012,.065,.18);
  part(this.warm,'cabin-window',0,.215,.199,.19,.065,.012);
  if(kind==='cruiser')part(this.warm,'upper-cabin-window',0,.36,.112,.18,.022,.012);
  // Yacht actors sit at Y=.23; the river surface is Y=-.055. Keep the
  // reflection on the water, just above it, rather than inside the hull.
  part(this.reflection,'water-reflection',0,-.272,-.05,1.05,1,1.40,this.plane);
  this.setAmount(0);
 }
 setAmount(amount){const n=level(amount);this.group.visible=n>.01;for(const m of [this.white,this.warm,this.port,this.starboard])m.opacity=n;this.reflection.uniforms.amount.value=n;}
 dispose(){this.group.removeFromParent();this.materials.forEach(m=>m.dispose());this.box.dispose();this.plane.dispose();}
}
