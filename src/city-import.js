import {CitySimulation} from './simulation.js';

export async function readCityImport(file){
 if(!file)throw Error('请选择城市存档');
 if(file.size>8_000_000)throw Error('存档文件过大，最多支持 8 MB。');
 const text=await file.text();
 let data;try{data=JSON.parse(text);}catch{throw Error('存档不是有效的 JSON');}
 // Accept native exports and snapshot envelopes; never inherit account IDs.
 const sim=CitySimulation.deserialize(typeof data?.city==='string'?data.city:text),state=sim.state;
 return {city:sim.serializeCompact(),name:state.districtName,mayorName:state.mayorName||'',population:state.stats.population,month:state.month,mapSize:state.mapSize,buildings:state.buildings.length,money:state.money};
}

export function setupCityImport({account,create}){
 const dialog=document.createElement('dialog');dialog.id='city-import-dialog';dialog.className='city-import-dialog';dialog.setAttribute('aria-labelledby','city-import-title');
 dialog.innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">CITY IMPORT · 让城市继续生长</span><h2 id="city-import-title">从存档创建城市</h2></div><button type="button" class="plain-icon" data-import-close aria-label="关闭城市导入">×</button></div><p class="muted">选择从湾畔市导出的 JSON 存档，保留地图、建筑、资金与城市进度，创建一座独立的城市。</p><form id="city-import-form"><div class="city-import-file"><button type="button" class="secondary-button" id="city-import-pick">选择城市存档</button><span id="city-import-filename">支持 .json 文件，最大 8 MB</span><input type="file" id="city-import-file" accept=".json,application/json" hidden></div><p id="city-import-status" role="alert" hidden></p><section id="city-import-preview" hidden><label class="new-city-name" for="city-import-name">新城市名称<input id="city-import-name" maxlength="24" required autocomplete="off" disabled></label><div id="city-import-summary" class="city-import-summary"></div></section><div class="setup-label">创建方式</div><div class="city-import-kinds" role="group" aria-label="导入城市类型"><button type="button" class="secondary-button" data-import-kind="solo" aria-pressed="true">单人城市<small id="city-import-owner"></small></button><button type="button" class="secondary-button" data-import-kind="cooperative" aria-pressed="false">合作城市<small>由你担任房主，邀请朋友共建</small></button></div><p class="muted" id="city-import-note"></p><div class="dialog-footer"><button type="button" class="text-button" data-import-close>返回</button><button type="submit" class="primary-button" id="city-import-create" disabled>导入为新城市</button></div></form>`;
 document.body.append(dialog);
 const el=id=>dialog.querySelector('#city-import-'+id),kinds=[...dialog.querySelectorAll('[data-import-kind]')];
 let pending=null,kind='solo',generation=0,busy=false,owner=null;
 const showError=message=>{el('status').textContent=message;el('status').hidden=!message;};
 const sync=()=>{
  for(const b of kinds){b.setAttribute('aria-pressed',String(b.dataset.importKind===kind));b.disabled=busy||b.dataset.importKind==='cooperative'&&!owner;}
  el('create').disabled=busy||!pending;el('create').textContent=busy?'正在创建…':kind==='cooperative'?'导入为新合作城市':'导入为新单人城市';
  el('pick').disabled=busy;el('file').disabled=busy;el('name').disabled=busy||!pending;
  dialog.querySelectorAll('[data-import-close]').forEach(b=>b.disabled=busy);
 };
 for(const b of kinds)b.onclick=()=>{kind=b.dataset.importKind;sync();};
 dialog.querySelectorAll('[data-import-close]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{generation++;pending=null;});
 el('pick').onclick=()=>el('file').click();
 el('file').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const version=++generation;pending=null;el('preview').hidden=true;el('filename').textContent=file.name;showError('正在读取存档…');sync();
  try{
   const imported=await readCityImport(file);if(version!==generation||!dialog.open)return;
   pending=imported;el('name').value=imported.name;
   el('summary').replaceChildren();
   for(const [label,value]of [['人口',imported.population.toLocaleString('zh-CN')+' 人'],['地图',imported.mapSize+' × '+imported.mapSize],['建筑',imported.buildings+' 栋'],['资金','¥'+Math.round(imported.money).toLocaleString('zh-CN')]]){
    const cell=document.createElement('div'),title=document.createElement('small'),content=document.createElement('strong');title.textContent=label;content.textContent=value;cell.append(title,content);el('summary').append(cell);
   }
   el('preview').hidden=false;showError('');sync();
  }catch(error){if(version===generation&&dialog.open){showError('无法导入：'+error.message);sync();}}
 };
 el('form').onsubmit=async event=>{
  event.preventDefault();if(busy||!pending)return;
  if((account()?.id||null)!==owner){showError('账号已切换，请关闭后重新打开导入。');return;}
  busy=true;showError('');sync();
  try{await create(pending,{kind,name:el('name').value});dialog.close();}
  catch(error){showError(error.message);}
  finally{busy=false;sync();}
 };
 return {open(target='solo'){
  if(busy)return;
  generation++;pending=null;owner=account()?.id||null;kind=target==='cooperative'&&owner?'cooperative':'solo';
  el('preview').hidden=true;el('filename').textContent='支持 .json 文件，最大 8 MB';el('name').value='';el('file').value='';showError('');
  el('owner').textContent=owner?'保存到当前账号 · '+account().name:'保存在此浏览器';
  el('note').textContent=owner?'导入会创建新存档，原有城市保留。地图规模和城市目标沿用存档。':'游客可导入单人城市；登录账号后，也可从存档创建合作城市。地图规模和城市目标沿用存档。';
  sync();if(!dialog.open)dialog.showModal();el('pick').focus();
 }};
}
