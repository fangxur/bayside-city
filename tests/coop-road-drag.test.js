import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {CoopStore} from '../server/coop-store.mjs';

function setup(t){
 let now=100000,serial=0;
 const store=new CoopStore(':memory:',{now:()=>now});t.after(()=>store.close());
 const owner=store.user(store.session('房主').token),builder=store.user(store.session('共建者').token),id=store.create(owner,{name:'拖动回归验证'}).cityId;
 store.join(store.invite(id,owner).code,builder);
 const send=(actor,method,args,base=store.view(id,actor))=>store.command(id,actor,{commandId:'drag-'+(++serial),epoch:base.epoch,baseRevision:base.revision,method,args});
 assert(send(owner,'setClock',[{paused:false,speed:1}]).ok);
 const handlers={},canvas={style:{},capture:null,addEventListener(name,fn){handlers[name]=fn;},focus(){},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;}};
 const r=Object.create(CityRenderer.prototype);Object.assign(r,{canvas,state:store.view(id,builder).state,tool:'road',overlay:'none',renderer:{shadowMap:{}},_cellAt:(x,y)=>({x,y}),_tile:(x,y)=>r.state.tiles[y*64+x],callbacks:{}});
 for(const name of ['clearStreetCelebration','clearMoveGhost','selectCell','setPreview','_hover','_resetActors','_syncYachts','_buildTerrain','_buildCity','_buildSelectedCoverage','_syncUpgradeMarkers','_setRoutes','_syncTrafficController','_setPedestrians','_syncCivicIncident'])r[name]=()=>{};
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}};try{r._bindEvents();}finally{globalThis.window=oldWindow;}
 let start,base;const submissions=[];
 r.callbacks.onDragStart=cell=>{start=cell;base=store.view(id,builder);};r.callbacks.onDragMove=()=>{};
 r.callbacks.onDragEnd=end=>{if(!end)return;const cells=Array.from({length:end.x-start.x+1},(_,i)=>({x:start.x+i,y:start.y}));submissions.push(send(builder,'build',['road',cells],base));};
 const pointer=(name,x,y=32)=>handlers[name]({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){}});
 return {store,owner,builder,id,r,canvas,send,pointer,submissions,tick(){now+=3001;store.tickDue();},refresh(){r.setState(store.view(id,builder).state,{sameWorld:true});}};
}

test('mouse release builds the entire road once after server ticks and another player construction arrive during dragging',t=>{
 const f=setup(t);f.pointer('pointerdown',8);f.pointer('pointermove',10);const gesture=f.r.pointerState;
 f.tick();f.refresh();assert.equal(f.r.pointerState,gesture);assert.equal(f.canvas.capture,1);
 assert(f.send(f.owner,'build',['park',[{x:20,y:20}]]).ok);f.refresh();assert.equal(f.r.pointerState,gesture);
 f.pointer('pointermove',12);const money=f.store.view(f.id,f.builder).state.money;
 f.pointer('pointerup',12);assert.equal(f.submissions.length,1);assert(f.submissions[0].ok);assert.equal(f.r.pointerState,null);
 const state=f.store.view(f.id,f.builder).state;for(let x=8;x<=12;x++)assert.equal(state.tiles[32*64+x].road,1);
 assert.equal(state.money,money-5*25);f.pointer('pointerup',12);assert.equal(f.submissions.length,1);
});

test('keeping a drag alive does not bypass server conflict checks or charge for rejected roads',t=>{
 const f=setup(t);f.pointer('pointerdown',8);f.pointer('pointermove',11);
 assert(f.send(f.owner,'build',['road',[{x:9,y:32}]]).ok);f.refresh();const money=f.store.view(f.id,f.builder).state.money;
 f.pointer('pointerup',11);assert.equal(f.submissions.length,1);assert.equal(f.submissions[0].code,'TARGET_CHANGED');assert.equal(f.store.view(f.id,f.builder).state.money,money);
 assert.equal(f.store.view(f.id,f.builder).state.tiles[32*64+8].road,0);
});

test('changing cities or restoring snapshots still cancels an in-progress drag',t=>{
 const f=setup(t);f.pointer('pointerdown',8);f.pointer('pointermove',11);
 f.r.setState(structuredClone(f.r.state));assert.equal(f.r.pointerState,null);assert.equal(f.canvas.capture,null);
 f.pointer('pointerup',11);assert.equal(f.submissions.length,0);
});

test('pointer cancellation does not build; a later drag can still build normally',t=>{
 const f=setup(t);f.pointer('pointerdown',8);f.refresh();f.pointer('pointercancel',11);f.pointer('pointerup',11);assert.equal(f.submissions.length,0);
 f.pointer('pointerdown',8);f.pointer('pointermove',10);f.refresh();f.pointer('pointerup',10);assert.equal(f.submissions.length,1);assert(f.submissions[0].ok);
});
