// Find a clear map region from the actual panel rectangles, including small screens.
export function onboardingMapRegion(view,panels){
  const pad=12,box={left:view.left+pad,right:view.right-pad,top:view.top+pad,bottom:view.bottom-pad};
  const obstacles=panels.filter(r=>r.width>0&&r.height>0&&r.right>box.left&&r.left<box.right&&r.bottom>box.top&&r.top<box.bottom);
  const xs=[box.left,box.right,...obstacles.flatMap(r=>[Math.max(box.left,r.left-pad),Math.min(box.right,r.right+pad)])].sort((a,b)=>a-b);
  let best=null,score=-1;
  for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){
    const left=xs[i],right=xs[j];if(right-left<60)continue;
    const blocks=obstacles.filter(r=>r.left-pad<right&&r.right+pad>left).map(r=>({top:Math.max(box.top,r.top-pad),bottom:Math.min(box.bottom,r.bottom+pad)})).sort((a,b)=>a.top-b.top);
    let top=box.top;
    for(const block of [...blocks,{top:box.bottom,bottom:box.bottom}]){
      const height=block.top-top,width=right-left,value=Math.min(width,height*1.7)**2+width*height*.1;
      if(height>=40&&value>score){best={left,right,top,bottom:block.top,width,height};score=value;}
      top=Math.max(top,block.bottom);
    }
  }
  return best||{...box,width:box.right-box.left,height:box.bottom-box.top};
}
