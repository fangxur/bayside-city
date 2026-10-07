import {TERRAIN_PRESETS,terrainAt} from './terrain-presets.js';
import {validMapSize} from './grid.js';

export const TERRAIN_TOOLS={land:{name:'陆地',description:'填平水域，铺出平整土地',code:'g'},water:{name:'水域',description:'画出河流、湖泊与海岸',code:'w'},forest:{name:'树林',description:'在陆地上种下成片树林',code:'f'},clear:{name:'清除树林',description:'保留陆地，清除自然植被',code:'g'}};
export const protectedEntry=(x,y)=>x>=0&&x<=10&&y>=28&&y<=36;

export function newTerrainDraft(terrainPreset='bayside',mapSize=64){
 if(!validMapSize(mapSize)||!Object.hasOwn(TERRAIN_PRESETS,terrainPreset))throw Error('请选择有效的地图规模与地形');
 let cells='';
 for(let y=0;y<mapSize;y++)for(let x=0;x<mapSize;x++)cells+=protectedEntry(x,y)?'g':terrainAt(terrainPreset,x,y,mapSize)==='water'?'w':'l';
 return {format:'bayside-terrain-v1',mapSize,terrainPreset,cells};
}

export function validateTerrainDraft(draft,mapSize=draft?.mapSize){
 if(!draft||draft.format!=='bayside-terrain-v1'||!validMapSize(mapSize)||draft.mapSize!==mapSize||!Object.hasOwn(TERRAIN_PRESETS,draft.terrainPreset)||typeof draft.cells!=='string'||draft.cells.length!==mapSize**2||/[^lwfg]/.test(draft.cells))throw Error('自定义地图数据无效，或与所选规模不一致');
 for(let y=28;y<=36;y++)for(let x=0;x<=10;x++)if(draft.cells[y*mapSize+x]!=='g')throw Error('请保留城外入口与开局土地');
 return {format:draft.format,mapSize,terrainPreset:draft.terrainPreset,cells:draft.cells};
}

export function terrainDraftSummary(draft){
 let water=0,forest=0;for(const cell of draft.cells){if(cell==='w')water++;if(cell==='f')forest++;}
 const total=draft.mapSize**2;return {total,land:total-water,water,forest,landPercent:Math.round((total-water)/total*100),waterPercent:Math.round(water/total*100)};
}

export class TerrainDraftEditor{
 constructor(draft){this.draft=validateTerrainDraft(draft);this.cells=[...this.draft.cells];this.undoStack=[];this.redoStack=[];this.stroke=null;}
 snapshot(){return {...this.draft,cells:this.cells.join('')};}
 beginStroke(tool,size=3){if(!Object.hasOwn(TERRAIN_TOOLS,tool)||![1,3,5,9].includes(size))throw Error('无效的地图笔刷');this.endStroke();this.stroke={tool,size,before:this.snapshot(),last:null};}
 paint(x,y){
  if(!this.stroke||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.draft.mapSize||y>=this.draft.mapSize)return;
  const {tool,size,last}=this.stroke,steps=last?Math.max(Math.abs(x-last.x),Math.abs(y-last.y)):0;
  const stamp=(cx,cy)=>{const radius=(size-1)/2;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>(radius+.35)**2)continue;
   const a=cx+dx,b=cy+dy,n=this.draft.mapSize;if(a<0||b<0||a>=n||b>=n||protectedEntry(a,b))continue;
   const index=b*n+a;if(['forest','clear'].includes(tool)&&this.cells[index]==='w')continue;
   this.cells[index]=TERRAIN_TOOLS[tool].code;
  }};
  if(!last||!steps)stamp(x,y);else for(let i=1;i<=steps;i++)stamp(Math.round(last.x+(x-last.x)*i/steps),Math.round(last.y+(y-last.y)*i/steps));
  this.stroke.last={x,y};
 }
 remember(before){this.undoStack.push(before);if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[];}
 endStroke(){if(!this.stroke)return;const before=this.stroke.before;this.stroke=null;if(before.cells!==this.cells.join(''))this.remember(before);}
 replace(draft){this.endStroke();const next=validateTerrainDraft(draft,this.draft.mapSize),before=this.snapshot();if(before.cells===next.cells&&before.terrainPreset===next.terrainPreset)return;this.remember(before);this.draft=next;this.cells=[...next.cells];}
 undo(){this.endStroke();if(!this.undoStack.length)return;this.redoStack.push(this.snapshot());this.draft=this.undoStack.pop();this.cells=[...this.draft.cells];}
 redo(){this.endStroke();if(!this.redoStack.length)return;this.undoStack.push(this.snapshot());this.draft=this.redoStack.pop();this.cells=[...this.draft.cells];}
}
