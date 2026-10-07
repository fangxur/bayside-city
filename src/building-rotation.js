import {Euler,Quaternion,Vector3} from 'three';

// Rotate geometry around the occupied square without changing tile ownership.
export function rotatedBuildingBatch(batch,x,z,turns=0){
 const angle=turns*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
 const position=(a,d)=>[x+(a-x)*c+(d-z)*s,z-(a-x)*s+(d-z)*c];
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle),orientation=new Quaternion(),euler=new Euler();
 return {
  add:(kind,color,a,y,d,w,h,l,ry=0,rx=0,rz=0)=>{
   const [px,pz]=position(a,d);
   // Tilted tower beams need a world-axis turn, not an added local Euler angle.
   if(rx||rz){euler.set(rx,ry,rz);orientation.setFromEuler(euler).premultiply(rotation);euler.setFromQuaternion(orientation);batch.add(kind,color,px,y,pz,w,h,l,euler.y,euler.x,euler.z);}
   else batch.add(kind,color,px,y,pz,w,h,l,ry+angle,rx,rz);
  },
  box:(color,a,y,d,w,h,l,ry=0)=>{const [px,pz]=position(a,d);batch.box(color,px,y,pz,w,h,l,ry+angle);},
 };
}
