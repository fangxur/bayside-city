import {TerrainDraftEditor,TERRAIN_TOOLS,newTerrainDraft,terrainDraftSummary,protectedEntry,validateTerrainDraft} from './terrain-draft.js';
import {TERRAIN_PRESETS} from './terrain-presets.js';
import {CitySimulation} from './simulation.js';
import {CityRenderer} from './renderer.js';

const paths={land:'M3 18 8 7l4 6 4-9 5 14H3Z',water:'M3 8c3-4 6 4 9 0s6 4 9 0M3 14c3-4 6 4 9 0s6 4 9 0M3 20c3-4 6 4 9 0s6 4 9 0',forest:'m7 3-5 9h3l-3 5h10l-3-5h3L7 3Zm0 14v5m11-16-4 8h3l-3 5h8l-3-5h3l-4-8Zm0 13v3',clear:'m4 15 9-11 7 6-9 11H8l-4-6Zm5 6h12M8 10l7 6'};
const icon=id=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id]}"/></svg>`;

export function setupTerrainEditor({notify=()=>{}}={}){
 const dialog=document.createElement('dialog');dialog.id='terrain-editor-dialog';dialog.className='terrain-editor-dialog';dialog.setAttribute('aria-labelledby','terrain-editor-title');document.body.append(dialog);
 let model=null,renderer=null,tool='water',brush=3,hover=null,onApply=null,pointer=null;
 const find=selector=>dialog.querySelector(selector);
 const disposePreview=()=>{renderer?.dispose();renderer=null;find('[data-terrain-preview]')?.replaceChildren();};
 const finishStroke=()=>{model?.endStroke();pointer=null;};
 dialog.addEventListener('close',()=>{if(!dialog.open){finishStroke();disposePreview();}});
 dialog.addEventListener('cancel',()=>finishStroke());
 const close=()=>{finishStroke();dialog.close();};
 const update=()=>{
  const summary=terrainDraftSummary(model.snapshot());
  find('[data-land-percent]').textContent=summary.landPercent+'%';find('[data-water-percent]').textContent=summary.waterPercent+'%';find('[data-forest-count]').textContent=summary.forest.toLocaleString('zh-CN')+' 格';
  find('[data-map-advice]').textContent=summary.landPercent<25?'陆地较少，适合岛屿城市。预留较大街区，会更方便后续发展。':'可以沿河留出步道，在桥梁两岸预留街区，让未来的城市有舒展的空间。';
  find('[data-undo]').disabled=!model.undoStack.length;find('[data-redo]').disabled=!model.redoStack.length;
  for(const button of dialog.querySelectorAll('[data-terrain-tool]'))button.setAttribute('aria-pressed',String(button.dataset.terrainTool===tool));
  for(const button of dialog.querySelectorAll('[data-brush-size]'))button.setAttribute('aria-pressed',String(Number(button.dataset.brushSize)===brush));
  find('[data-brush-hint]').textContent=TERRAIN_TOOLS[tool].description+' · '+brush+' 格笔刷';
  find('[data-base-preset]').value=model.draft.terrainPreset;
 };
 const draw=()=>{
  const canvas=find('[data-terrain-canvas]');if(!canvas)return;
  const ctx=canvas.getContext('2d'),n=model.draft.mapSize,unit=canvas.width/n;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const cell=model.cells[y*n+x];ctx.fillStyle=cell==='w'?'#91bec5':cell==='f'?'#70946d':cell==='g'?'#e2e8cb':'#d7e1c4';ctx.fillRect(x*unit,y*unit,unit,unit);
   if(cell==='f'){ctx.fillStyle='#426b51';ctx.beginPath();ctx.arc((x+.5)*unit,(y+.5)*unit,unit*.27,0,Math.PI*2);ctx.fill();}
  }
  ctx.strokeStyle='#53756616';ctx.lineWidth=.5;ctx.beginPath();for(let i=0;i<=n;i++){ctx.moveTo(i*unit,0);ctx.lineTo(i*unit,canvas.height);ctx.moveTo(0,i*unit);ctx.lineTo(canvas.width,i*unit);}ctx.stroke();
  ctx.fillStyle='#d9bb7340';ctx.fillRect(0,28*unit,11*unit,9*unit);ctx.strokeStyle='#b18c49';ctx.setLineDash([3,3]);ctx.strokeRect(.5,28*unit,11*unit-.5,9*unit);ctx.setLineDash([]);
  ctx.strokeStyle='#577569';ctx.lineWidth=unit*.55;ctx.beginPath();ctx.moveTo(0,32.5*unit);ctx.lineTo(7.5*unit,32.5*unit);ctx.stroke();
  ctx.fillStyle='#fbf8eb';ctx.font=`bold ${unit*1.4}px sans-serif`;ctx.textAlign='center';ctx.fillText('入口',5.5*unit,31*unit);
  if(hover){ctx.strokeStyle=protectedEntry(hover.x,hover.y)?'#b18c49':'#fffef5';ctx.lineWidth=2;ctx.beginPath();ctx.arc((hover.x+.5)*unit,(hover.y+.5)*unit,brush*unit/2,0,Math.PI*2);ctx.stroke();}
 };
 const showEdit=()=>{
  finishStroke();disposePreview();find('[data-terrain-board]').hidden=false;find('[data-terrain-preview]').hidden=true;find('[data-preview-controls]').hidden=true;find('[data-editor-tools]').inert=false;
  find('[data-edit-tab]').setAttribute('aria-pressed','true');find('[data-preview-tab]').setAttribute('aria-pressed','false');update();draw();
 };
 const showPreview=()=>{
  finishStroke();disposePreview();find('[data-terrain-board]').hidden=true;find('[data-terrain-preview]').hidden=false;find('[data-preview-controls]').hidden=false;find('[data-editor-tools]').inert=true;
  find('[data-edit-tab]').setAttribute('aria-pressed','false');find('[data-preview-tab]').setAttribute('aria-pressed','true');
  try{
   const city=new CitySimulation({mapSize:model.draft.mapSize,terrainDraft:model.snapshot()});
   renderer=new CityRenderer(find('[data-terrain-preview]'));renderer.setState(city.state);renderer.setPaused(true);renderer.setLightingMode('day');
   renderer.canvas.setAttribute('aria-label','自定义地形三维预览；拖动平移，滚轮缩放，右键旋转');
   renderer.viewSize=65;renderer.focusCell(model.draft.mapSize/2,model.draft.mapSize/2);
  }catch(error){showEdit();notify(error.message,true);}
 };
 function open({terrainPreset='bayside',mapSize=64,draft,apply}={}){
  disposePreview();model=new TerrainDraftEditor(draft?validateTerrainDraft(draft,mapSize):newTerrainDraft(terrainPreset,mapSize));tool='water';brush=3;hover=null;pointer=null;onApply=apply;
  dialog.innerHTML=`<header class="terrain-editor-header"><div><span class="eyebrow">LANDSCAPE STUDIO · ${mapSize} × ${mapSize}</span><h2 id="terrain-editor-title">先画出城市的底色</h2><p>弯一条河，留一片树林。未来的街区，从这里开始。</p></div><button type="button" class="secondary-button" data-editor-close aria-label="关闭地形编辑器">×</button></header><div class="terrain-editor-layout"><aside class="terrain-editor-tools" data-editor-tools><h3>地形笔刷</h3><div class="terrain-tool-list">${Object.entries(TERRAIN_TOOLS).map(([id,item])=>`<button type="button" data-terrain-tool="${id}" aria-pressed="${id===tool}">${icon(id)}<span>${item.name}</span></button>`).join('')}</div><h3>笔刷大小</h3><div class="terrain-brush-sizes" role="group" aria-label="笔刷大小">${[1,3,5,9].map(size=>`<button type="button" data-brush-size="${size}" aria-label="${size} 格笔刷">${size}</button>`).join('')}</div><div class="terrain-history"><button type="button" class="secondary-button" data-undo>撤销</button><button type="button" class="secondary-button" data-redo>重做</button></div><p class="terrain-editor-help">拖动即可绘制<br>Ctrl / ⌘ + Z 撤销<br>Ctrl / ⌘ + Shift + Z 重做</p></aside><section class="terrain-editor-center"><div class="terrain-editor-tabs" role="group" aria-label="地图编辑与预览"><button type="button" data-edit-tab aria-pressed="true">编辑地图</button><button type="button" data-preview-tab aria-pressed="false">3D 预览</button></div><div class="terrain-editor-stage"><div class="terrain-edit-board" data-terrain-board><canvas data-terrain-canvas width="${mapSize*8}" height="${mapSize*8}" aria-label="地形绘制画布：拖动画出陆地、水域或树林" role="img"></canvas></div><div class="terrain-editor-preview" data-terrain-preview hidden></div></div><div class="terrain-preview-controls" data-preview-controls hidden><button type="button" data-preview-camera="in" aria-label="放大预览">＋</button><button type="button" data-preview-camera="out" aria-label="缩小预览">−</button><button type="button" data-preview-camera="rotate">旋转</button><span>拖动平移 · 滚轮缩放</span></div><p class="terrain-brush-hint" data-brush-hint></p></section><aside class="terrain-editor-summary"><h3>这张地图</h3><dl><div><dt>可建设陆地</dt><dd data-land-percent></dd></div><div><dt>水域比例</dt><dd data-water-percent></dd></div><div><dt>手绘树林</dt><dd data-forest-count></dd></div></dl><div class="terrain-entry-note"><strong>城外入口已保留</strong><p>金色区域是开局土地，可从入口延伸道路、接通水电。</p></div><p data-map-advice></p><label class="terrain-preset-label">参考地形<select data-base-preset>${Object.entries(TERRAIN_PRESETS).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select></label><button type="button" class="secondary-button" data-apply-preset>套用参考地形</button><button type="button" class="text-button" data-flat>铺成空白平原</button><p class="muted">套用或清空后仍可撤销。</p></aside></div><footer class="terrain-editor-footer"><span>地形编辑免费 · 正式建城后开始经营</span><div><button type="button" class="text-button" data-editor-cancel>取消本次编辑</button><button type="button" class="primary-button" data-editor-apply>使用这张地图</button></div></footer>`;
  find('[data-editor-close]').onclick=close;find('[data-editor-cancel]').onclick=close;
  find('[data-editor-apply]').onclick=()=>{finishStroke();try{onApply?.(model.snapshot());dialog.close();}catch(error){notify(error.message,true);}};
  for(const button of dialog.querySelectorAll('[data-terrain-tool]'))button.onclick=()=>{finishStroke();tool=button.dataset.terrainTool;update();draw();};
  for(const button of dialog.querySelectorAll('[data-brush-size]'))button.onclick=()=>{finishStroke();brush=Number(button.dataset.brushSize);update();draw();};
  const history=redo=>{if(renderer)showEdit();redo?model.redo():model.undo();update();draw();};
  find('[data-undo]').onclick=()=>history(false);find('[data-redo]').onclick=()=>history(true);
  find('[data-edit-tab]').onclick=showEdit;find('[data-preview-tab]').onclick=showPreview;
  find('[data-apply-preset]').onclick=()=>{const preset=find('[data-base-preset]').value;if(renderer)showEdit();model.replace(newTerrainDraft(preset,mapSize));update();draw();};
  find('[data-flat]').onclick=()=>{if(renderer)showEdit();model.replace({...model.snapshot(),cells:'g'.repeat(mapSize**2)});update();draw();};
  for(const button of dialog.querySelectorAll('[data-preview-camera]'))button.onclick=()=>{if(!renderer)return;if(button.dataset.previewCamera==='rotate')renderer.rotate();else renderer.zoomBy(button.dataset.previewCamera==='in'?.8:1.25);};
  const canvas=find('[data-terrain-canvas]');
  const cell=event=>{const box=canvas.getBoundingClientRect();return {x:Math.min(mapSize-1,Math.max(0,Math.floor((event.clientX-box.left)/box.width*mapSize))),y:Math.min(mapSize-1,Math.max(0,Math.floor((event.clientY-box.top)/box.height*mapSize)))};};
  canvas.onpointerdown=event=>{if(event.button!==0||pointer!==null)return;event.preventDefault();pointer=event.pointerId;canvas.setPointerCapture(pointer);hover=cell(event);model.beginStroke(tool,brush);model.paint(hover.x,hover.y);draw();};
  canvas.onpointermove=event=>{hover=cell(event);if(pointer===event.pointerId)model.paint(hover.x,hover.y);draw();};
  canvas.onpointerup=event=>{if(pointer!==event.pointerId)return;finishStroke();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);update();draw();};
  canvas.onpointercancel=canvas.onlostpointercapture=()=>{finishStroke();update();draw();};canvas.onpointerleave=()=>{if(pointer===null){hover=null;draw();}};
  dialog.onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!['INPUT','SELECT'].includes(event.target.tagName)){event.preventDefault();history(event.shiftKey);}};
  if(!dialog.open)dialog.showModal();showEdit();
 }
 return {open};
}

export function terrainDraftThumbnail(draft){
 const canvas=document.createElement('canvas');canvas.width=draft.mapSize;canvas.height=draft.mapSize;const ctx=canvas.getContext('2d');
 for(let i=0;i<draft.cells.length;i++){ctx.fillStyle=draft.cells[i]==='w'?'#91bec5':draft.cells[i]==='f'?'#537e5c':'#dfe6cd';ctx.fillRect(i%draft.mapSize,Math.floor(i/draft.mapSize),1,1);}
 ctx.fillStyle='#577569';ctx.fillRect(0,32,8,1);return canvas.toDataURL('image/png');
}
