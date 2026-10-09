import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CoopStore} from '../server/coop-store.mjs';
import {CoopPresence} from '../server/coop-presence.mjs';
import {CoopPresenceOverlay,mayorColor} from '../src/coop-presence-rendering.js';

test('collaborator hints are authenticated, ephemeral and do not change the city or undo',t=>{
 let now=100000;const store=new CoopStore(':memory:',{now:()=>now});t.after(()=>store.close());
 const a=store.session('甲').actor,b=store.session('乙').actor,c=store.session('外人').actor,id=store.create(a,{name:'影子测试'}).cityId;
 store.join(store.invite(id,a).code,b);const presence=new CoopPresence(store),before=store.view(id,a),hint={epoch:1,cursor:{x:10,y:29},cells:[{x:10,y:29},{x:11,y:29}],tool:'road',valid:true};
 assert.throws(()=>presence.exchange(id,c,hint));assert.throws(()=>presence.exchange(id,b,{...hint,cursor:{x:-1,y:0}}));assert.throws(()=>presence.exchange(id,b,{...hint,cells:Array(257).fill(hint.cursor)}));
 assert.deepEqual(presence.exchange(id,b,hint).presence,[]);
 const remote=presence.exchange(id,a,{...hint,cursor:null,cells:[]}).presence;assert.equal(remote.length,1);assert.equal(remote[0].name,'乙');assert.deepEqual(remote[0].cells,hint.cells);
 const after=store.view(id,a);assert.equal(after.revision,before.revision);assert.equal(after.checksum,before.checksum);assert.equal(after.canUndo,before.canUndo);assert.equal(store.logs(id,a).length,1);
 presence.exchange(id,b,{...hint,cursor:null,cells:[]});assert.deepEqual(presence.exchange(id,a,{...hint,cursor:null,cells:[]}).presence,[]);
 presence.exchange(id,b,hint);now+=5001;assert.deepEqual(presence.exchange(id,a,{...hint,cursor:null,cells:[]}).presence,[]);
 presence.exchange(id,b,hint);store.remove(id,a,b.id);assert.deepEqual(presence.exchange(id,a,{...hint,cursor:null,cells:[]}).presence,[]);assert.throws(()=>presence.exchange(id,b,hint));
});

test('restoring a city invalidates collaborator positions from the previous epoch',t=>{
 const store=new CoopStore(':memory:');t.after(()=>store.close());const a=store.session('甲').actor,b=store.session('乙').actor,id=store.create(a,{name:'恢复'}).cityId;store.join(store.invite(id,a).code,b);
 const p=new CoopPresence(store),hint={epoch:1,cursor:{x:10,y:29},cells:[],tool:'inspect'};p.exchange(id,b,hint);
 const snapshot=store.snapshots(id,a)[0];assert(store.command(id,a,{commandId:'restore',epoch:1,baseRevision:0,method:'restoreSnapshot',args:[snapshot.id]}).ok);
 assert.throws(()=>p.exchange(id,b,hint));assert.deepEqual(p.exchange(id,a,{...hint,epoch:2,cursor:null}).presence,[]);
});

test('presence overlay reuses markers, draws planned cells and disposes departed mayors',()=>{
 const calls=[],context={clearRect(){},fillRect(){},measureText:text=>({width:text.length*30}),fillText(text){calls.push(text);}},canvas=()=>({getContext:()=>context});
 const scene=new THREE.Scene(),overlay=new CoopPresenceOverlay(scene,{canvas,label:()=> '道路'}),state={mapSize:64,tiles:[]},person={id:'mayor',name:'坤小妹',cursor:{x:19,y:31},cells:[{x:19,y:31},{x:20,y:31}],tool:'road',valid:true};
 overlay.set([person],state);const marker=overlay.markers.get(person.id);assert.equal(scene.children.length,1);assert.equal(marker.fill.count,2);assert.equal(marker.pointer.position.x,-12.5);assert.deepEqual(calls,['坤小妹 · 道路']);assert.equal(marker.color,mayorColor(person.id));
 overlay.set([{...person,cursor:{x:20,y:31}}],state);assert.equal(overlay.markers.get(person.id),marker);assert.equal(calls.length,1);
 overlay.set([],state);assert.equal(scene.children.length,0);assert.equal(overlay.markers.size,0);overlay.dispose();
});
