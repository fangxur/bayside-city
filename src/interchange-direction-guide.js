import {Vector3} from 'three';
import {interchangeBounds,roadElevation} from './interchanges.js';

// Cardinal directions share the road graph's coordinates: east is +x,
// north is -y. Camera rotation changes only their screen positions.
export function interchangeDirectionMarkers(item,state){
  const b=interchangeBounds(item);
  return [
    {label:'北',axis:'ns',x:b.cx,y:b.minY-1.5},
    {label:'南',axis:'ns',x:b.cx,y:b.maxY+1.5},
    {label:'西',axis:'ew',x:b.minX-1.5,y:b.cy},
    {label:'东',axis:'ew',x:b.maxX+1.5,y:b.cy},
  ].map(p=>({...p,upper:p.axis===item.axis,text:p.label+(item.axis?(p.axis===item.axis?' · 高架':' · 地面'):''),height:roadElevation(state,p.x,p.y,p.axis)+.22}));
}

export class InterchangeDirectionGuide{
  constructor(container){
    this.container=container;this.labels=[];
  }
  set(item,state){
    const key=item&&JSON.stringify([item.x,item.y,item.width??3,item.height??3,item.axis]);
    if(key===this.key)return;
    this.key=key;this.markers=item?interchangeDirectionMarkers(item,state):[];
    if(item&&!this.labels.length)this.labels=this.markers.map(()=>{
      const label=document.createElement('span');label.className='interchange-direction-marker';this.container.appendChild(label);return label;
    });
    this.labels.forEach((label,i)=>{
      const p=this.markers[i];label.hidden=!p;
      if(p){label.textContent=p.text;label.classList.toggle('upper',p.upper);label.setAttribute('aria-label','地图'+p.text);}
    });
  }
  update(camera,rect,parent){
    for(let i=0;i<this.markers?.length;i++){
      const marker=this.markers[i],label=this.labels[i];
      const p=new Vector3(marker.x-31.5,marker.height,marker.y-31.5).project(camera);
      label.hidden=Math.abs(p.x)>.94||Math.abs(p.y)>.9||Math.abs(p.z)>1;
      label.style.left=`${rect.left-parent.left+(p.x+1)*rect.width/2}px`;
      label.style.top=`${rect.top-parent.top+(1-p.y)*rect.height/2}px`;
    }
  }
  dispose(){this.labels.forEach(label=>label.remove());this.labels=[];this.markers=[];}
}
