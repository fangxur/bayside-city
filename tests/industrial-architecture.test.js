import {BUSINESS_KINDS} from '../src/business-kinds.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {privateBuildingGroups} from '../src/city-layout.js';
import {specialtyFactoryHeight} from '../src/industrial-architecture.js';

test('specialty factories keep distinct factory details at all six levels and fit their pick bounds',()=>{
  const r=Object.create(CityRenderer.prototype);
  for(let level=1;level<=6;level++){
    const designs=[];
    for(const businessKind of Object.keys(BUSINESS_KINDS).filter(k=>BUSINESS_KINDS[k].zone==='industrial'&&BUSINESS_KINDS[k].architecture)){
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
        r._tile=(x,y)=>({road:x===10+dx&&y===10+dy});
        const b={id:1,type:'industrial',businessKind,level,x:10,y:10,progress:1};
        const parts=[],batch={add(...args){parts.push(args);},box(...args){parts.push(['box',...args]);}};
        r._building(batch,b);
        assert.ok(parts.length>0,`${businessKind} level ${level} has no geometry`);
        for(const [kind,color,x,y,z,sx,sy,sz] of parts){
          assert.ok([color,x,y,z,sx,sy,sz].every(Number.isFinite));
          assert.ok(sx>0&&sy>0&&sz>0);
          assert.ok(y+(kind==='roof'?sy:sy/2)<=specialtyFactoryHeight(b)+.04);
        }
        if(dx===0&&dy===1)designs.push(JSON.stringify(parts));
      }
    }
    assert.equal(new Set(designs).size,designs.length);
  }
});

test('adjacent specialty factories retain factory details instead of merging into generic industrial blocks',()=>{
  for(const businessKind of Object.keys(BUSINESS_KINDS).filter(k=>BUSINESS_KINDS[k].zone==='industrial'&&BUSINESS_KINDS[k].architecture)){
    const factories=[0,1,2].map(i=>({id:i+1,x:10+i,y:10,type:'industrial',businessKind,level:6,progress:1}));
    assert.equal(privateBuildingGroups(factories,factories.map(b=>({x:b.x,y:11,road:1}))).size,0);
  }
});
