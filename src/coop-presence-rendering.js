import * as THREE from 'three';

const colors=[0x78bfff,0xf4bd71,0xb89cff,0x6ed5bb,0xf295b9];
export function mayorColor(id){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;return colors[hash%colors.length];}

export class CoopPresenceOverlay{
 constructor(scene,{label=tool=>tool,canvas=()=>document.createElement('canvas')}={}){
  this.scene=scene;this.label=label;this.canvas=canvas;this.markers=new Map();this.box=new THREE.BoxGeometry(.96,.035,.96);this.ring=new THREE.RingGeometry(.3,.46,24);this.dummy=new THREE.Object3D();
 }
 create(person){
  const color=mayorColor(person.id),group=new THREE.Group();
  const fill=new THREE.InstancedMesh(this.box,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.25,depthWrite:false}),256);fill.frustumCulled=false;fill.renderOrder=9;fill.count=0;
  const pointer=new THREE.Mesh(this.ring,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));pointer.rotation.x=-Math.PI/2;pointer.renderOrder=10;
  const canvas=this.canvas();canvas.width=512;canvas.height=96;
  const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(5.3,1,1);sprite.renderOrder=11;
  group.add(fill,pointer,sprite);this.scene.add(group);
  const marker={group,fill,pointer,sprite,canvas,texture,color};this.markers.set(person.id,marker);return marker;
 }
 set(people,state){
  const valid=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<(state?.mapSize||64)&&p.y<(state?.mapSize||64);
  const active=new Set();
  for(const person of people){
   if(!valid(person.cursor))continue;active.add(person.id);
   const marker=this.markers.get(person.id)||this.create(person),cells=(person.cells||[]).filter(valid).slice(0,256);
   marker.updated=performance.now();marker.fill.count=cells.length;marker.fill.material.color.set(person.valid===false?0xe77c70:marker.color);
   const height=p=>state?.tiles[p.y*state.mapSize+p.x]?.terrain==='water' ? .25 : .15;
   cells.forEach((p,i)=>{this.dummy.position.set(p.x-31.5,height(p),p.y-31.5);this.dummy.updateMatrix();marker.fill.setMatrixAt(i,this.dummy.matrix);});marker.fill.instanceMatrix.needsUpdate=true;
   marker.pointer.position.set(person.cursor.x-31.5,height(person.cursor)+.04,person.cursor.y-31.5);
   marker.sprite.position.set(person.cursor.x-31.5,1.7,person.cursor.y-31.5);
   const text=person.name+' · '+this.label(person.tool);
   if(marker.text!==text){
    marker.text=text;let context=marker.canvas.getContext('2d');context.font='bold 30px sans-serif';
    const width=Math.min(512,Math.ceil(context.measureText(text).width)+40);marker.canvas.width=width;context=marker.canvas.getContext('2d');
    context.clearRect(0,0,width,96);context.fillStyle='#182e39e8';context.fillRect(0,8,width,80);context.fillStyle='#'+new THREE.Color(marker.color).getHexString();context.fillRect(0,8,8,80);context.fillStyle='#fff';context.font='bold 30px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(text,width/2,48,width-24);marker.sprite.scale.set(width/96,1,1);
    marker.texture.dispose();marker.texture=new THREE.CanvasTexture(marker.canvas);marker.sprite.material.map=marker.texture;marker.sprite.material.needsUpdate=true;
   }
  }
  for(const id of this.markers.keys())if(!active.has(id))this.remove(id);
 }
 expire(){const now=performance.now();for(const [id,marker] of this.markers)if(now-marker.updated>5000)this.remove(id);}
 remove(id){const marker=this.markers.get(id);if(!marker)return;this.scene.remove(marker.group);marker.fill.dispose();marker.fill.material.dispose();marker.pointer.material.dispose();marker.sprite.material.dispose();marker.texture.dispose();this.markers.delete(id);}
 dispose(){for(const id of this.markers.keys())this.remove(id);this.box.dispose();this.ring.dispose();}
}
