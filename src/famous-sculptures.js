import {BufferGeometry,BufferAttribute} from 'three';
import david from '../assets/sculptures/david.js';
import venus from '../assets/sculptures/venus.js';
import victory from '../assets/sculptures/victory.js';
import discobolus from '../assets/sculptures/discobolus.js';
import {SCULPTURE_COLORS} from './european-sculptures.js';

const models={davidStatue:david,venusDeMilo:venus,samothraceVictory:victory,discobolusStatue:discobolus};
export const FAMOUS_SCULPTURE_MESH_KINDS=new Set(Object.values(models).map(m=>m.kind));

// Shared indexed meshes, packed as little-endian uint16 positions and indices.
// Module assets also work in catalog previews and self-contained cloud packages.
export function createFamousSculptureGeometries(){
 return Object.fromEntries(Object.values(models).map(model=>{
  const bytes=Uint8Array.from(atob(model.data),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  const positions=new Float32Array(model.vertices*3),indices=new Uint16Array(model.triangles*3);
  for(let i=0;i<positions.length;i++){
   const axis=i%3,min=model.bounds[0][axis],max=model.bounds[1][axis];
   positions[i]=min+(max-min)*view.getUint16(i*2,true)/65535;
  }
  for(let i=0;i<indices.length;i++)indices[i]=view.getUint16((positions.length+i)*2,true);
  const colors=new Float32Array(model.vertices*3),aoOffset=(positions.length+indices.length)*2;
  for(let i=0;i<model.vertices;i++)colors.fill(bytes[aoOffset+i]/255,i*3,i*3+3);
  const geometry=new BufferGeometry();geometry.setAttribute('color',new BufferAttribute(colors,3));
  geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(new BufferAttribute(indices,1));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return [model.kind,geometry];
 }));
}

// Museum-derived forms retain the original anatomy and drapery. See asset credits.
export function drawFamousSculpture(b,emit){
 const model=models[b.type];if(!model)return;
 // Uniform scaling preserves scanned anatomy and fits both statue and garden in one cell.
 const shape=(kind,color,x,y,z,w,h,d,...rotation)=>emit(kind,color,x*.5,y*.5,z*.5,w*.5,h*.5,d*.5,...rotation);
 const active=b.active!==false,marble=SCULPTURE_COLORS.marble-(active?0:0x010101);
 const box=(c,x,y,z,w,h,d)=>shape('box',c,x,y,z,w,h,d);
 const round=(c,x,y,z,w,h,d)=>shape('crown',c,x,y,z,w,h,d);
 const isVictory=b.type==='samothraceVictory',px=isVictory?.10:0,pz=isVictory?.21:0;
 const plinth=(c,x,y,z,w,h,d)=>box(c,x+px,y,z+pz,w,h,d);
 const base=b.type==='discobolusStatue'?.67:b.type==='venusDeMilo'?.70:.65;
 // Limestone paving, a simple stepped plinth and a recessed bronze plaque.
 box(0xd7d2bf,0,.04,0,1.9,.08,1.9);
 plinth(0xbeb9a8,0,.105,0,1.30,.05,1.30);
 plinth(0xe1dbca,0,.157,0,1.16,.055,1.16);
 plinth(0xbcb8aa,0,(base+.18)/2,0,.98,base-.18,.98);
 plinth(0xe5dfcf,0,base+.015,0,1.10,.07,1.10);
 plinth(0x786948,0,base*.57,.497,.30,.125,.015);
 for(let row=0;row<2;row++)plinth(0xb8a47b,0,base*.57+.022-row*.038,.507,.21-row*.05,.010,.005);
 for(const side of [-1,1]){
  box(0xb3ae99,side*.73,.115,-.72,.29,.07,.29);
  round(0x718962,side*.73,.21,-.72,.27,.20,.27);
  box(0x5e6657,side*.76,.115,.75,.14,.08,.14);
  box(active?0xffdfaa:0x8b8d84,side*.76,.164,.75,.10,.018,.10);
 }
 const scale=isVictory?.95:1;
 shape(model.kind,marble,isVictory?-.18:0,base+.05,isVictory?-.15:0,scale,scale,scale);
}
