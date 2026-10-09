// Shape presets return four-way-connected road outlines around the drag start.
export function roadShapeCells(shape, start, end) {
  if (!start || !end) return [];
  const radius = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  if (!radius) return [{x:start.x,y:start.y}];
  if(shape==='circle'&&radius===1)return roadShapeCells('block',start,end);
  const cells = new Map();
  const add = (x,y) => cells.set(`${x},${y}`,{x,y});
  const horizontal = (from,to,y) => {
    for(let x=Math.min(from,to);x<=Math.max(from,to);x++)add(x,y);
  };
  if(shape==='block'){
    for(let offset=-radius;offset<=radius;offset++){
      add(start.x+offset,start.y-radius);
      add(start.x+offset,start.y+radius);
      add(start.x-radius,start.y+offset);
      add(start.x+radius,start.y+offset);
    }
  }else if(shape==='circle'){
    let previousLeft=start.x,previousRight=start.x;
    for(let offset=-radius;offset<=radius;offset++){
      const extent=Math.round(Math.sqrt(radius*radius-offset*offset));
      const left=start.x-extent,right=start.x+extent,y=start.y+offset;
      horizontal(previousLeft,left,y);
      horizontal(previousRight,right,y);
      previousLeft=left;previousRight=right;
    }
  }
  return [...cells.values()];
}
