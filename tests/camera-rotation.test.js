import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {Vector3} from 'three';

test('upgrade drags pan from empty land even across buildings, while roads and buildings retain their actions',()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}};
 try{
  for(const initial of [{road:0,buildingId:null},{road:1,buildingId:null},{road:0,buildingId:7}]){
   const handlers={},calls=[];const r=Object.create(CityRenderer.prototype);
   Object.assign(r,{tool:'upgrade',target:new Vector3(),canvas:{style:{},
    addEventListener(k,f){handlers[k]=f;},focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}
   },_cellAt(x){return {x:x<120?1:2,y:1};},_tile(x){return x===1?initial:{buildingId:8};},
   _pointOnGround(x,y){return new Vector3(x,0,y);},_hover(){},_limitCamera(){},_updateCamera(){},
   callbacks:{onDragStart(){calls.push('start');},onDragMove(){calls.push('move');},onDragEnd(){calls.push('end');}}});
   r._bindEvents();const e={button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){}};
   handlers.pointerdown(e);handlers.pointermove({...e,clientX:140});handlers.pointerup({...e,clientX:140});
   const empty=!initial.road&&initial.buildingId==null;
   assert.equal(r.target.x,empty?-40:0);
   assert.deepEqual(calls,empty?[]:['start','move','end']);
   assert.equal(r.tool,'upgrade');assert.equal(r.pointerState,null);
  }
 }finally{globalThis.window=oldWindow;}
});

test('move mode pans from empty land until a building or road has been selected for placement',()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}};
 try{
  for(const selected of [false,true]){
   const handlers={},calls=[];const r=Object.create(CityRenderer.prototype);
   Object.assign(r,{tool:'move',target:new Vector3(),canvas:{style:{},
    addEventListener(k,f){handlers[k]=f;},focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}
   },_cellAt(x){return {x:x<120?1:2,y:1};},_tile(){return {road:0,buildingId:null};},
   _pointOnGround(x,y){return new Vector3(x,0,y);},_hover(){},_limitCamera(){},_updateCamera(){},
   callbacks:{shouldPanEmptyMove(){return !selected;},onDragStart(){calls.push('start');},onDragMove(){calls.push('move');},onDragEnd(){calls.push('end');}}});
   r._bindEvents();const e={button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){}};
   handlers.pointerdown(e);handlers.pointermove({...e,clientX:140});handlers.pointerup({...e,clientX:140});
   assert.equal(r.target.x,selected?0:-40);
   assert.deepEqual(calls,selected?['start','move','end']:[]);
   assert.equal(r.pointerState,null);
  }
 }finally{globalThis.window=oldWindow;}
});

test('rotation gestures work during construction without placing buildings',()=>{
  const oldWindow=globalThis.window;
  globalThis.window={addEventListener(){}};
  try {
    for(const gesture of [{button:2},{button:0,altKey:true}]) {
      for(const ending of ['pointerup','pointercancel','blur']) {
        const handlers={},windowHandlers={};
        globalThis.window.addEventListener=(name,handler)=>windowHandlers[name]=handler;
        const r=Object.create(CityRenderer.prototype);
        let edits=0;
        Object.assign(r,{azimuth:0,tool:'road',civicFollow:{},canvas:{
          style:{},addEventListener(name,handler){handlers[name]=handler;},
          focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}
        },_cellAt(){return {x:1,y:1};},_hover(){},_updateCamera(){},setPreview(){},
        callbacks:{onDragStart(){edits++;},onDragMove(){edits++;},onDragEnd(){edits++;}}});
        r._bindEvents();
        const e={pointerId:1,clientX:100,clientY:100,preventDefault(){},...gesture};
        handlers.pointerdown(e);
        handlers.pointermove({...e,clientX:137});
        assert.ok(Math.abs(r.azimuth-.222)<1e-10);
        assert.equal(r.civicFollow,null);
        (ending==='blur'?windowHandlers:handlers)[ending](e);
        assert.equal(edits,0);
        assert.equal(r.pointerState,null);
      }
    }
  } finally {globalThis.window=oldWindow;}
});

test('rotation buttons adjust by 15 degrees and reverse precisely',()=>{
  const r=Object.create(CityRenderer.prototype);
  Object.assign(r,{azimuth:0,_updateCamera(){}});
  r.rotate(1);
  assert.equal(r.azimuth,Math.PI/12);
  r.rotate(-1);
  assert.equal(r.azimuth,0);
});

test('two touch pointers pinch to zoom around their midpoint and cancel construction',()=>{
  const oldWindow=globalThis.window;
  globalThis.window={addEventListener(){}};
  try {
    const handlers={},captured=new Set(),calls=[];
    const r=Object.create(CityRenderer.prototype);
    Object.assign(r,{
      tool:'road',catalogMode:false,viewSize:30,civicFollow:{},target:new Vector3(),
      canvas:{style:{},addEventListener(name,handler){handlers[name]=handler;},focus(){},
        setPointerCapture(id){captured.add(id);},hasPointerCapture(id){return captured.has(id);},releasePointerCapture(id){captured.delete(id);}},
      _cellAt(){return {x:1,y:1};},_tile(){return {road:0,buildingId:null};},
      _pointOnGround(x,y){return new Vector3(x,0,y);},_hover(){},_limitCamera(){},_updateCamera(){},setPreview(){calls.push('clear');},
      callbacks:{onDragStart(){calls.push('start');},onDragMove(){calls.push('move');},onDragEnd(cell){calls.push(cell===null?'cancel':'end');}}
    });
    r._bindEvents();
    const touch=(pointerId,clientX,clientY)=>({pointerType:'touch',pointerId,button:0,clientX,clientY,preventDefault(){}});
    handlers.pointerdown(touch(1,100,100));
    handlers.pointerdown(touch(2,200,100));
    assert.deepEqual(calls,['start','clear','cancel']);
    assert.equal(r.pointerState,null);
    assert.deepEqual(r.pinchState.ids,[1,2]);

    handlers.pointermove(touch(2,250,100));
    assert.equal(r.viewSize,20);
    assert.equal(r.target.x,-25);
    assert.equal(r.civicFollow,null);

    handlers.pointerup(touch(2,250,100));
    handlers.pointerup(touch(1,100,100));
    assert.equal(r.pinchState,null);
    assert.equal(r.pointerState,null);
    assert.equal(captured.size,0);
    assert.deepEqual(calls,['start','clear','cancel']);
  } finally {globalThis.window=oldWindow;}
});
