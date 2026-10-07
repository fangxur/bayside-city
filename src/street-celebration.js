import * as THREE from 'three';
import {gridIndex,inGrid} from './grid.js';

// Only use connected, straight land streets; keep gatherings on their outer curbs.
export function celebrationStreets(state){
 const road=(x,y)=>inGrid(state,x,y)&&state.tiles[gridIndex(state,x,y)]?.road;
 const candidates=state.tiles.filter(t=>t.road&&t.connected&&!t.bridge&&t.terrain==='land').map(t=>{
  const horizontal=road(t.x-1,t.y)&&road(t.x+1,t.y)&&!road(t.x,t.y-1)&&!road(t.x,t.y+1);
  const vertical=road(t.x,t.y-1)&&road(t.x,t.y+1)&&!road(t.x-1,t.y)&&!road(t.x+1,t.y);
  const homes=state.buildings.filter(b=>b.type==='residential'&&b.population>0&&Math.hypot(t.x-b.x,t.y-b.y)<6);
  return {...t,horizontal,eligible:horizontal||vertical,score:homes.length};
 }).filter(t=>t.eligible&&t.score>0).sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);
 const selected=[];
 for(const t of candidates){if(selected.every(v=>Math.hypot(t.x-v.x,t.y-v.y)>=3))selected.push(t);if(selected.length===4)break;}
 return selected;
}
export class StreetCelebration {
 constructor(state,{reducedMotion=false,grand=false}={}){
  this.sites=celebrationStreets(state);this.elapsed=0;this.grand=grand;this.duration=grand?36:24;this.reducedMotion=reducedMotion;
  this.group=new THREE.Group();this.people=[];this.geometry=new THREE.BoxGeometry(1,1,1);
  this.materials=[0xc75847,0xe6b64e,0x408776,0x728ec0,0xf2d3ae,0x414d49].map(color=>new THREE.MeshLambertMaterial({color}));
  const part=(parent,material,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(this.geometry,this.materials[material]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
  this.sites.forEach((site,j)=>{
   for(let side=-1;side<=1;side+=2)for(let i=0;i<4;i++){
    const person=new THREE.Group(),along=(i-1.5)*.21;
    person.position.set(site.x-31.5+(site.horizontal?along:side*.43),.045,site.y-31.5+(site.horizontal?side*.43:along));
    person.rotation.y=site.horizontal?(side>0?Math.PI:0):(side>0?-Math.PI/2:Math.PI/2);
    part(person,(i+j)%4,0,.19,0,.10,.14,.065);part(person,4,0,.305,0,.085,.085,.08);part(person,5,0,.355,0,.09,.025,.085);
    for(const x of [-.028,.028])part(person,5,x,.07,0,.035,.14,.045);
    const arms=[-1,1].map(sign=>{const pivot=new THREE.Group();pivot.position.set(sign*.065,.25,0);person.add(pivot);part(pivot,(i+j)%4,0,-.065,0,.035,.13,.04);return pivot;});
    this.group.add(person);this.people.push({person,arms,phase:i+j*2+side});
   }
  });
  this.sparkMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:.95,depthWrite:false});
  this.particles=grand?88:64;this.volleys=grand?3:1;
  this.sparks=new THREE.InstancedMesh(this.geometry,this.sparkMaterial,this.sites.length*this.particles*this.volleys);this.sparks.frustumCulled=false;
  const colors=grand?[0xffcf5c,0xff6f61,0x68d9d0,0xfff1b0,0x9ea7ff,0xf39bd7]:[0xffca55,0xef8168,0x72d8d2,0xfff1b0];
  for(let i=0;i<this.sparks.count;i++)this.sparks.setColorAt(i,new THREE.Color(colors[Math.floor(i/this.particles)%colors.length]));
  this.group.add(this.sparks);this.transform=new THREE.Object3D();this.update(0,state);
 }
 update(delta,state){
  this.elapsed+=delta;
  if(this.elapsed>=this.duration)return false;
  const valid=site=>{const t=state.tiles[gridIndex(state,site.x,site.y)];return t?.road&&t.connected&&!t.bridge;};
  this.people.forEach(({person,arms,phase},i)=>{
   person.visible=valid(this.sites[Math.floor(i/8)]);
   person.position.y=.045+(this.reducedMotion?0:Math.max(0,Math.sin(this.elapsed*5+phase))*.065);
   arms[0].rotation.z=-2.35+(this.reducedMotion?0:Math.sin(this.elapsed*6+phase)*.35);
   arms[1].rotation.z=2.35+(this.reducedMotion?0:Math.sin(this.elapsed*6+phase+1)*.35);
  });
  this.sites.forEach((site,j)=>{
   for(let volley=0;volley<this.volleys;volley++){
    const cycle=this.grand?4.4:3.6,time=(this.elapsed+j*.7+volley*1.15)%cycle,launch=.65,burst=Math.max(0,time-launch),radius=burst*(this.grand?1.65:1.25);
    const ox=this.grand?(volley-1)*.75:0,oz=this.grand?Math.sin((j+1)*(volley+2))*1.05:0,burstHeight=this.grand?3.9+volley*.58:2.7;
    for(let i=0;i<this.particles;i++){
     const angle=i*2.399963,vertical=1-2*(i+.5)/this.particles,r=Math.sqrt(1-vertical*vertical);
     const height=time<launch?.1+time*(this.grand?5.7:4):burstHeight+vertical*radius-(this.grand?.48:.65)*burst*burst;
     this.transform.position.set(site.x-31.5+ox+(time<launch?0:Math.cos(angle)*r*radius),height,site.y-31.5+oz+(time<launch?0:Math.sin(angle)*r*radius));
     const visible=valid(site)&&height>.1&&time<(this.grand?3.8:3)&&!this.reducedMotion;
     this.transform.scale.setScalar(visible?(time<launch?(this.grand?.075:.06):(this.grand?.07:.055)*Math.max(.1,1-burst/3.4)):0);
     this.transform.updateMatrix();this.sparks.setMatrixAt((j*this.volleys+volley)*this.particles+i,this.transform.matrix);
    }
   }
  });this.sparks.instanceMatrix.needsUpdate=true;
  return true;
 }
 dispose(){this.group.removeFromParent();this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.sparkMaterial.dispose();this.sparks.dispose();}
}
