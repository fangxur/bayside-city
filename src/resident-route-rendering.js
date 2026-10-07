import * as THREE from 'three';
import {gridIndex} from './grid.js';

const world=p=>new THREE.Vector3(p.x-31.5,0,p.y-31.5);
const center=p=>world({x:p.x+((p.size||1)-1)/2,y:p.y+((p.size||1)-1)/2});
const routeHeight=(state,p)=>state.tiles[gridIndex(state,p.x,p.y)]?.bridge ? .25 : .13;

export class ResidentRouteOverlay {
  constructor(scene,container=null){
    this.group=new THREE.Group();this.group.name='resident-journey';scene.add(this.group);
    this.labels=container?['出发','到达'].map(text=>{const element=document.createElement('span');element.className='resident-route-label';element.textContent=text;element.hidden=true;container.appendChild(element);return element;}):[];
  }
  clear(){
    for(const mesh of [...this.group.children]){this.group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
    this.labels.forEach(e=>e.hidden=true);this.journey=null;this.key=null;
  }
  setJourney(journey,state){
    const key=journey&&JSON.stringify([journey.from,journey.to,journey.points.map(p=>[p.x,p.y,state.tiles[gridIndex(state,p.x,p.y)]?.bridge,(state.tiles[gridIndex(state,p.x,p.y)]?.traffic||0)>=75])]);
    if(key===this.key)return;
    this.clear();if(!journey)return;this.key=key;this.journey=journey;
    const positions=[],colors=[],white=new THREE.Color(0xfff9e7),green=new THREE.Color(0x319f89),orange=new THREE.Color(0xe28e45);
    const triangle=(a,b,c,color)=>{for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}};
    const strip=(a,b,width,color)=>{
      const direction=b.clone().sub(a);direction.y=0;if(direction.length()<.001)return;
      const side=new THREE.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(width/2);
      triangle(a.clone().add(side),a.clone().sub(side),b.clone().add(side),color);
      triangle(b.clone().add(side),a.clone().sub(side),b.clone().sub(side),color);
    };
    const points=journey.points.map(p=>world(p).setY(routeHeight(state,p)));
    // Short dotted connectors join the real roadside entrances to their buildings.
    this.endpoints=[center(journey.from).setY(points[0].y),center(journey.to).setY(points.at(-1).y)];
    for(const [a,b] of [[this.endpoints[0],points[0]],[points.at(-1),this.endpoints[1]]]){
      const steps=Math.max(1,Math.ceil(a.distanceTo(b)/.24));
      for(let i=0;i<steps;i+=2)strip(a.clone().lerp(b,i/steps),a.clone().lerp(b,Math.min(1,(i+1)/steps)),.1,green);
    }
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],p=journey.points[i];
      const color=(state.tiles[gridIndex(state,p.x,p.y)]?.traffic||0)>=75?orange:green;
      strip(a,b,.25,white);strip(a.clone().add(new THREE.Vector3(0,.003,0)),b.clone().add(new THREE.Vector3(0,.003,0)),.15,color);
      if(i%3===1){
        const direction=b.clone().sub(a).setY(0).normalize(),side=new THREE.Vector3(-direction.z,0,direction.x);
        const mid=a.clone().lerp(b,.6).add(new THREE.Vector3(0,.008,0));
        triangle(mid.clone().addScaledVector(direction,.24),mid.clone().addScaledVector(direction,-.13).addScaledVector(side,.18),mid.clone().addScaledVector(direction,-.13).addScaledVector(side,-.18),white);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
    const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
    const ribbon=new THREE.Mesh(geometry,material);ribbon.renderOrder=20;this.group.add(ribbon);
    this.endpoints.forEach((point,i)=>{
      const marker=new THREE.Mesh(new THREE.RingGeometry(.28,.38,32),new THREE.MeshBasicMaterial({color:i?0xe1a253:0x319f89,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
      marker.rotation.x=-Math.PI/2;marker.position.copy(point);marker.renderOrder=21;this.group.add(marker);
      if(this.labels[i]){this.labels[i].textContent=(i?'到达 · ':'出发 · ')+(i?journey.to.name:journey.from.name);this.labels[i].hidden=false;}
    });
  }
  update(camera,rect,parent,visible=true){
    if(!this.journey)return;
    this.labels.forEach((label,i)=>{const p=this.endpoints[i].clone().project(camera);label.hidden=!visible||Math.abs(p.x)>.98||Math.abs(p.y)>.95||Math.abs(p.z)>1;
      label.style.left=`${rect.left-parent.left+(p.x+1)*rect.width/2}px`;label.style.top=`${rect.top-parent.top+(1-p.y)*rect.height/2}px`;});
  }
  dispose(){this.clear();this.labels.forEach(e=>e.remove());this.group.removeFromParent();}
}
