import {BUSINESS_KINDS} from '../src/business-kinds.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {privateBuildingGroups} from '../src/city-layout.js';
import {drawSpecialtyHome,specialtyHeight} from '../src/residential-architecture.js';

test('street-view residential types keep distinct roof silhouettes',()=>{
  const kinds=['japanese','nordic','british','spanish','italian','french'],signatures=[];
  for(const businessKind of kinds){
    const parts=[],add=(...args)=>parts.push(args);
    drawSpecialtyHome({id:1,type:'residential',businessKind,level:1,active:true},add,(...args)=>add('box',...args));
    const roofs=parts.filter(([kind])=>kind==='roof').map(([,color,x,y,z,sx,sy,sz,rotation=0])=>[color,x,y,z,sx,sy,sz,rotation]);
    assert(roofs.length>=2,`${businessKind} needs more than one roof mass`);
    signatures.push(JSON.stringify(roofs));
  }
  assert.equal(new Set(signatures).size,kinds.length);
});

test('specialty homes retain distinct geometry at all six levels and street orientations',()=>{
  const r=Object.create(CityRenderer.prototype);
  for(let level=1;level<=6;level++){
    const designs=[];
    for(const businessKind of Object.keys(BUSINESS_KINDS).filter(k=>BUSINESS_KINDS[k].zone==='residential'&&BUSINESS_KINDS[k].architecture)){
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
        r._tile=(x,y)=>({road:x===10+dx&&y===10+dy});
        const b={id:1,type:'residential',businessKind,level,x:10,y:10,progress:1};
        const parts=[],batch={add(...args){parts.push(args);},box(...args){parts.push(['box',...args]);}};
        r._building(batch,b);
        assert.ok(parts.length>25);
        for(const [kind,color,x,y,z,sx,sy,sz] of parts){
          assert.ok([color,x,y,z,sx,sy,sz].every(Number.isFinite));
          assert.ok(sx>0&&sy>0&&sz>0);
          assert.ok(y+(kind==='roof'?sy:sy/2)<=specialtyHeight(b)+.04,`${businessKind} level ${level} exceeds pick height`);
        }
        if(dx===0&&dy===1)designs.push(JSON.stringify(parts));
      }
    }
    assert.equal(new Set(designs).size,designs.length);
  }
});

test('adjacent specialty homes preserve individual architecture after upgrades',()=>{
  for(const businessKind of Object.keys(BUSINESS_KINDS).filter(k=>BUSINESS_KINDS[k].zone==='residential'&&BUSINESS_KINDS[k].architecture)){
    const homes=[0,1,2].map(i=>({id:i+1,x:10+i,y:10,type:'residential',businessKind,level:6,progress:1}));
    assert.equal(privateBuildingGroups(homes,homes.map(b=>({x:b.x,y:11,road:1}))).size,0);
  }
});

test('Miao village and Zhangzhou tulou keep recognizable clustered and enclosed silhouettes',()=>{
  const partsFor=businessKind=>{const parts=[],add=(...args)=>parts.push(args);drawSpecialtyHome({businessKind,level:4,active:true},add,(...args)=>add('box',...args));return parts;};
  const miao=partsFor('miaoVillage'),tulou=partsFor('tulou');
  assert(miao.filter(([kind])=>kind==='roof').length>=6,'Miao village should contain several staggered roofs');
  assert(miao.filter(([kind,color])=>kind==='box'&&color===0x4c382d).length>=16,'Miao village should retain visible timber stilts and galleries');
  const earthSegments=tulou.filter(([kind,color])=>kind==='box'&&color===0xb48760);
  assert(earthSegments.length>=13,'tulou should form an earth-wall ring and gatehouse');
  assert(tulou.some(([kind,color,x,,z])=>kind==='cylinder'&&color===0x719092&&x===0&&z===0),'tulou should retain an open courtyard well');
  assert.notDeepEqual(miao,tulou);
});

test('new ancient Chinese homes keep waterside, fortress, merchant courtyard and semicircular clan-house silhouettes',()=>{
  const partsFor=businessKind=>{const parts=[],add=(...args)=>parts.push(args);drawSpecialtyHome({businessKind,level:4,active:true},add,(...args)=>add('box',...args));return parts;};
  const jiangnan=partsFor('jiangnan'),tibetan=partsFor('tibetan'),shanxi=partsFor('shanxiCourtyard'),hakka=partsFor('hakkaWeilong');
  assert(jiangnan.some(([shape,color])=>shape==='box'&&color===0x6f9fa3),'Jiangnan home needs a visible canal');
  assert(jiangnan.filter(([shape])=>shape==='roof').length>=4,'Jiangnan home needs staggered tiled wings and a waterside gallery');
  assert(tibetan.filter(([shape,color])=>shape==='box'&&color===0x8d4d3f).length>=2,'Tibetan house needs its red eave bands');
  assert(tibetan.some(([shape,color])=>shape==='cone'&&color===0xd6b76f),'Tibetan house needs a rooftop incense tower');
  assert(shanxi.filter(([shape])=>shape==='roof').length>=7,'Shanxi compound needs several axial halls and a double-roof gatehouse');
  assert(shanxi.filter(([shape,color])=>shape==='box'&&color===0x756d62).length>=5,'Shanxi compound needs tall enclosing brick walls');
  assert(hakka.filter(([shape,color])=>shape==='box'&&color===0xa78968).length>=13,'Hakka weilong house needs a semicircular rear ring and side wings');
  assert(hakka.filter(([shape])=>shape==='roof').length>=16,'Hakka weilong house needs a continuous curved roof rhythm');
  assert.equal(new Set([jiangnan,tibetan,shanxi,hakka].map(parts=>JSON.stringify(parts))).size,4);
});

test('every regional home has a strong type-specific massing signature',()=>{
  const partsFor=businessKind=>{const parts=[],add=(...args)=>parts.push(args);drawSpecialtyHome({businessKind,level:4,active:true},add,(...args)=>add('box',...args));return parts;};
  const expected={
    japanese:{roofs:3,color:0x485451},nordic:{roofs:2,color:0xa34f48},british:{roofs:3,color:0xa46e57},
    dutch:{roofs:3,color:0xa5513d},chalet:{roofs:2,color:0x936940},spanish:{roofs:4,color:0xf2e2c9},
    french:{roofs:4,color:0xe7dcc7},italian:{roofs:4,color:0xe1b676},huizhou:{roofs:4,color:0xf1efe2},bai:{roofs:4,color:0x4f7e99},
  };
  const signatures=[];
  for(const [kind,{roofs,color}] of Object.entries(expected)){
    const parts=partsFor(kind),roofParts=parts.filter(([shape])=>shape==='roof'||shape==='cone');
    assert(roofParts.length>=roofs,`${kind} needs several recognizable roof masses`);
    assert(parts.some(([,partColor])=>partColor===color),`${kind} needs its signature material`);
    signatures.push(JSON.stringify(parts));
  }
  assert.equal(new Set(signatures).size,Object.keys(expected).length);
});

test('Chinese courtyard and Lingnan homes keep their own street silhouettes',()=>{
  const partsFor=(businessKind,footprint)=>{
    const r=Object.create(CityRenderer.prototype);r._tile=(x,y)=>({road:x===10&&y===10+footprint});
    const parts=[],batch={add(...args){parts.push(args);},box(...args){parts.push(['box',...args]);}};
    r._building(batch,{id:1,x:10,y:10,type:'residential',businessKind,footprint,level:4,progress:1});
    return parts;
  };
  const courtyard=partsFor('courtyard',2),lingnan=partsFor('lingnan',1);
  assert(courtyard.filter(([shape])=>shape==='roof').length>=6,'courtyard needs several enclosing tiled halls and a gatehouse');
  assert(courtyard.some(([shape,color])=>shape==='cylinder'&&color===0xba7252),'courtyard needs red gate lanterns');
  assert(lingnan.filter(([shape,color])=>shape==='box'&&color===0xe5dfc9).length>=8,'Lingnan home needs stepped wok-ear gables and arcade piers');
  assert(lingnan.some(([shape,color])=>shape==='box'&&color===0xb78a5b),'Lingnan home needs a coloured glass vent');
  assert(lingnan.some(([shape,color])=>shape==='crown'&&color===0x6f8b68),'Lingnan home needs planted arcade edges');
  assert.notDeepEqual(courtyard,lingnan);
});
