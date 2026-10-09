import * as THREE from 'three';
import {stoneBridgeAt,stoneArchHeight} from './stone-bridges.js';
import {YACHT_TYPES,yachtPose} from './marina.js';
import {YachtLighting} from './vehicle-lighting.js';
// Boats remain narrower than one water cell so orthogonal routes cannot cut across shore.
export function createYachtModel(kind){
 const group=new THREE.Group(),materials=new Map(),geometries=[];
 const part=(color,x,y,z,w,h,d,shape='box')=>{
  let material=materials.get(color);if(!material){material=new THREE.MeshLambertMaterial({color});materials.set(color,material);}
  const geometry=shape==='bow'?new THREE.ConeGeometry(1,1,3):new THREE.BoxGeometry(1,1,1);geometries.push(geometry);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);if(shape==='bow')mesh.rotation.x=Math.PI/2;group.add(mesh);return mesh;
 };
 const white=YACHT_TYPES[kind].color,luxury=kind==='cruiser';
 part(0x426c77,0,.04,0,.32,.09,.60);part(white,0,.10,0,.35,.08,.60);
 part(white,0,.10,.30,.18,.20,.07,'bow');part(0xb6976c,0,.145,-.10,.29,.014,.32);
 part(0x5c8b98,0,.20,.06,.25,.12,.27);part(white,0,.27,.06,.29,.035,.31);
 if(luxury){part(white,0,.31,.02,.23,.07,.24);part(0x578490,0,.36,.09,.20,.03,.04);part(white,0,.41,.01,.26,.025,.26);for(const x of [-.10,.10])part(white,x,.37,-.08,.012,.08,.012);}
 else{part(0x627971,0,.32,.02,.013,.12,.013);part(0xe1ba65,.035,.35,.02,.07,.04,.012);}
 for(const x of [-.155,.155]){part(white,x,.19,-.14,.01,.035,.24);for(const z of [-.24,-.05])part(white,x,.17,z,.01,.08,.01);}
 // A visible helmsman ties the moving boat to its resident owner.
 part(0x617e82,0,.23,-.17,.045,.08,.04);part(0xd8b693,0,.29,-.17,.045,.04,.04);
 const wake=part(0xc5e2dc,0,.006,-.46,.24,.007,.18);wake.visible=false;
 const lighting=new YachtLighting(group,kind);
 group.userData={wake,lighting,dispose:()=>{lighting.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};return group;
}
export function updateYachtActor(actor,entry,seconds,hidden=false,night=0,state=null){
 const pose=yachtPose(entry,seconds),bridge=state&&stoneBridgeAt(state,pose.x,pose.y);
 const clearArch=!!bridge&&stoneArchHeight(bridge,bridge.axis==='ew'?pose.x:pose.y)>.73;
 const visible=!hidden&&(!pose.underBridge||clearArch);actor.x=pose.x;actor.y=pose.y;actor.status=pose.status;actor.visible=visible;
 actor.position.set(pose.x-31.5,.23,pose.y-31.5);actor.model.position.copy(actor.position);actor.model.rotation.y=pose.angle;actor.model.visible=visible;
 actor.model.userData.wake.visible=visible&&(pose.status==='出航中'||pose.status==='返港中');
 actor.model.userData.lighting.setAmount(night);
}
