import * as THREE from 'three';

export class OnboardingOverlay {
  constructor(scene,container=null){
    this.group=new THREE.Group();this.group.name='onboarding-hint';scene.add(this.group);
    if(container){this.label=document.createElement('span');this.label.className='onboarding-map-label';this.label.hidden=true;container.appendChild(this.label);}
  }
  setHint(hint){
    const key=JSON.stringify(hint);if(key===this.key)return;
    this.clear();this.key=key;if(!hint?.cells?.length)return;this.hint=hint;
    const box=new THREE.BoxGeometry(.94,.08,.94),geometry=new THREE.EdgesGeometry(box);box.dispose();
    const material=new THREE.LineBasicMaterial({color:0x338769,depthTest:false,transparent:true});
    for(const p of hint.cells){const line=new THREE.LineSegments(geometry,material);line.position.set(p.x-31.5,.2,p.y-31.5);line.renderOrder=24;this.group.add(line);}
    this.geometry=geometry;this.material=material;
    this.position=new THREE.Vector3(hint.target.x-31.5,.45,hint.target.y-31.5);
    if(this.label)this.label.textContent=hint.label;
  }
  update(camera,rect,parent,elapsed,visible){
    this.group.visible=visible;if(!this.hint)return;
    this.material.opacity=.65+Math.sin(elapsed*3)*.2;
    if(this.label){const p=this.position.clone().project(camera);this.label.hidden=!visible||Math.abs(p.x)>.95||Math.abs(p.y)>.95||Math.abs(p.z)>1;this.label.style.left=rect.left-parent.left+(p.x+1)*rect.width/2+'px';this.label.style.top=rect.top-parent.top+(1-p.y)*rect.height/2+'px';}
  }
  clear(){this.group.clear();this.geometry?.dispose();this.material?.dispose();this.geometry=null;this.material=null;this.hint=null;this.key=null;if(this.label)this.label.hidden=true;}
  dispose(){this.clear();this.label?.remove();this.group.removeFromParent();}
}
