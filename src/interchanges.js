import {gridIndex,gridPoint,gridNeighbors,inGrid} from './grid.js';

export const INTERCHANGE_COST=6000;
export const INTERCHANGE_ROTATE_COST=1000;
export const INTERCHANGE_MAINTENANCE=90;
export const INTERCHANGE_HEIGHT=1.1;
const axes=['ns','ew'];
const tile=(state,x,y)=>inGrid(state,x,y)?state.tiles[gridIndex(state,x,y)]:null;
const road=(state,x,y)=>{const t=tile(state,x,y);return !!t?.road&&t.terrain==='land'&&!t.bridge&&t.buildingId==null&&!t.zone;};
export function interchangeBounds(item){
  const width=item.width??3,height=item.height??3,minX=item.x-Math.floor((width-1)/2),minY=item.y-Math.floor((height-1)/2);
  return {width,height,minX,minY,maxX:minX+width-1,maxY:minY+height-1,cx:minX+(width-1)/2,cy:minY+(height-1)/2};
}
export function interchangeCore(item){
  const b=interchangeBounds(item),cells=[];
  for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)cells.push({x,y});
  return cells;
}
export function interchangeCells(item){
  const b=interchangeBounds(item),result=interchangeCore(item);
  for(let step=1;step<=3;step++)for(const side of [-1,1]){
    if(item.axis==='ns')for(let x=b.minX;x<=b.maxX;x++)result.push({x,y:side<0?b.minY-step:b.maxY+step});
    else for(let y=b.minY;y<=b.maxY;y++)result.push({x:side<0?b.minX-step:b.maxX+step,y});
  }
  return result;
}
export function interchangeAt(state,point){
  return (state.interchanges||[]).find(item=>interchangeCells(item).some(p=>p.x===point.x&&p.y===point.y))||null;
}
const shape=b=>({x:b.minX+Math.floor((b.width-1)/2),y:b.minY+Math.floor((b.height-1)/2),...(b.width===3&&b.height===3?{}:{width:b.width,height:b.height})});
function crossShape(state,point){
  if(!point||!road(state,point.x,point.y))return null;
  const run=y=>{
    if(!road(state,point.x,y))return null;
    let minX=point.x,maxX=point.x;
    while(road(state,minX-1,y))minX--;while(road(state,maxX+1,y))maxX++;
    return {minX,maxX};
  };
  const base=run(point.y);
  const edge=side=>{
    for(let y=point.y+side;road(state,point.x,y);y+=side){
      const row=run(y);
      if(row.minX>base.minX||row.maxX<base.maxX)return {...row,y};
    }
    return null;
  };
  const north=edge(-1),south=edge(1);
  if(!north||!south||north.minX!==south.minX||north.maxX!==south.maxX||north.minX<=base.minX||north.maxX>=base.maxX)return null;
  const b={minX:north.minX,maxX:north.maxX,minY:north.y+1,maxY:south.y-1,width:north.maxX-north.minX+1,height:south.y-north.y-1};
  if(b.width<3||b.height<3)return null;
  const item=shape(b);
  if(!interchangeCore(item).every(p=>road(state,p.x,p.y)))return null;
  for(let y=b.minY;y<=b.maxY;y++)if(!road(state,b.minX-1,y)||!road(state,b.maxX+1,y))return null;
  for(const x of [b.minX-1,b.maxX+1])for(const y of [b.minY-1,b.maxY+1])if(tile(state,x,y)?.road)return null;
  return item;
}
export function findInterchangeCenter(state,point){
  if(!point)return null;
  const existing=interchangeAt(state,point);if(existing){const {x,y,width,height}=existing;return {x,y,...(width!==undefined?{width,height}:{})};}
  return crossShape(state,point);
}
export function interchangeGeometryReason(state,item,others=state.interchanges||[]){
  const b=interchangeBounds(item);
  if(!axes.includes(item.axis)||!Number.isInteger(item.x)||!Number.isInteger(item.y)||![b.width,b.height].every(n=>Number.isInteger(n)&&n>=3&&n<=Math.sqrt(state.tiles.length)))return '立交方向、中心坐标或宽度无效';
  const found=crossShape(state,item);
  if(!found||found.x!==item.x||found.y!==item.y||(found.width??3)!==b.width||(found.height??3)!==b.height)return '需要完整的十字路口，两个方向的道路宽度均不少于三格';
  if(!interchangeCells(item).every(p=>road(state,p.x,p.y)))return '高架两端各需两格坡道及一格平路接头，宽度须与道路一致';
  const cells=new Set(interchangeCells(item).map(p=>gridIndex(state,p.x,p.y)));
  if(others.some(other=>(other.x!==item.x||other.y!==item.y)&&interchangeCells(other).some(p=>cells.has(gridIndex(state,p.x,p.y)))))return '坡道与其他立交桥重叠，请先调整路网';
  return '';
}
export function interchangeOffer(state,point,axis){
  const center=findInterchangeCenter(state,point),existing=center&&(state.interchanges||[]).find(i=>i.x===center.x&&i.y===center.y);
  if(!center)return {valid:false,cost:0,cells:[],reason:'请选择两个方向都不少于三格宽的十字路口'};
  if(axis!==null&&!axes.includes(axis))return {valid:false,cost:0,cells:[],reason:'请选择南北或东西高架'};
  const item={...center,axis},cells=[...new Map([...(existing?interchangeCells(existing):[]),...(axis?interchangeCells(item):[])].map(p=>[gridIndex(state,p.x,p.y),p])).values()];
  const cost=axis===null?0:existing?INTERCHANGE_ROTATE_COST:INTERCHANGE_COST;
  const reason=axis===null?(!existing?'这里尚未建成立交桥':''):existing?.axis===axis?'已采用这个高架方向':interchangeGeometryReason(state,item);
  return {valid:!reason&&state.money>=cost,cost,cells,center,axis,affected:0,reason:reason||(state.money<cost?'城市资金不足':axis===null?'保留道路，恢复平面路口':`${axis==='ns'?'南北':'东西'}高架直行，另一方向地面直行；转弯需经外围道路`)};
}
export function refreshInterchanges(state){
  for(const t of state.tiles)delete t.interchange;
  for(const item of state.interchanges||[]){
    const b=interchangeBounds(item);
    for(const p of interchangeCells(item)){
      const step=item.axis==='ns'?Math.max(b.minY-p.y,p.y-b.maxY,0):Math.max(b.minX-p.x,p.x-b.maxX,0);if(step===3)continue;
      const t=tile(state,p.x,p.y);if(t)t.interchange={...item,core:p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY};
    }
  }
}
export const groundRoadAccess=tile=>!tile?.interchange||tile.interchange.core;

// A central grid cell has two separate nodes. Entering a layer fixes the axis
// until the vehicle exits; adjacent ramps have only the upper-layer node.
export const roadIndex=node=>Math.floor(node/3);
export function roadNodes(state,index){
  const t=state.tiles[index],item=t?.interchange;
  return !item?[index*3]:item.core?[index*3+1,index*3+2]:[index*3+(item.axis==='ew'?1:2)];
}
export function roadSteps(state,node,{connected=false,removed=null}={}){
  const index=roadIndex(node),mode=node%3,{x,y}=gridPoint(state,index),result=[];
  for(const [nx,ny] of gridNeighbors(state,x,y)){
    const axis=nx!==x?1:2;if(mode&&mode!==axis)continue;
    const next=gridIndex(state,nx,ny),t=state.tiles[next];
    if(!t?.road||removed?.has(next)||(connected&&!t.connected))continue;
    const candidate=t.interchange?next*3+axis:next*3;
    if(roadNodes(state,next).includes(candidate))result.push(candidate);
  }
  return result;
}
export function roadElevation(state,x,y,axis){
  for(const item of state.interchanges||[]){
    if(item.axis!==axis)continue;
    const b=interchangeBounds(item),along=Math.abs(axis==='ew'?x-b.cx:y-b.cy),cross=Math.abs(axis==='ew'?y-b.cy:x-b.cx);
    const halfAlong=(axis==='ew'?b.width:b.height)/2,halfCross=(axis==='ew'?b.height:b.width)/2;
    if(cross<=halfCross&&along<=halfAlong+2){
      // Ease into both the flat approach and the deck; renderers sample this
      // same profile so wheels and sidewalks follow the curve exactly.
      const t=Math.min(1,Math.max(0,(halfAlong+2-along)/2));
      return INTERCHANGE_HEIGHT*t*t*(3-2*t);
    }
  }
  return 0;
}

export function validRoadPath(state,points){
  if(!points.length)return false;
  if(!points.some(p=>state.tiles[gridIndex(state,p.x,p.y)]?.interchange))return true;
  let nodes=roadNodes(state,gridIndex(state,points[0].x,points[0].y));
  for(const p of points.slice(1)){
    const index=gridIndex(state,p.x,p.y);
    nodes=[...new Set(nodes.flatMap(node=>roadSteps(state,node)).filter(node=>roadIndex(node)===index))];
    if(!nodes.length)return false;
  }
  return true;
}
