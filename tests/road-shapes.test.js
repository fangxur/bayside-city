import test from 'node:test';
import assert from 'node:assert/strict';
import {roadShapeCells} from '../src/road-shapes.js';
import {CitySimulation} from '../src/simulation.js';

const key=cell=>`${cell.x},${cell.y}`;

function assertConnected(cells){
  const keys=new Set(cells.map(key));
  const visited=new Set([key(cells[0])]);
  const queue=[cells[0]];
  for(let i=0;i<queue.length;i++){
    const {x,y}=queue[i];
    for(const next of [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}]){
      const id=key(next);
      if(keys.has(id)&&!visited.has(id)){visited.add(id);queue.push(next);}
    }
  }
  assert.equal(visited.size,keys.size,'the road loop must connect through shared tile edges');
}

test('circle and block presets create unique connected outlines at every useful size',()=>{
  for(const shape of ['circle','block'])for(let radius=1;radius<=24;radius++){
    const cells=roadShapeCells(shape,{x:30,y:30},{x:30+radius,y:30});
    assert.equal(new Set(cells.map(key)).size,cells.length);
    assertConnected(cells);
    assert(cells.some(c=>c.x===30-radius&&c.y===30));
    assert(cells.some(c=>c.x===30+radius&&c.y===30));
    assert(cells.some(c=>c.x===30&&c.y===30-radius));
    assert(cells.some(c=>c.x===30&&c.y===30+radius));
    assert(!cells.some(c=>c.x===30&&c.y===30),'the center stays open');
    if(shape==='block')assert.equal(cells.length,8*radius);
    assert.deepEqual(new Set(roadShapeCells(shape,{x:30,y:30},{x:30-radius,y:30-radius}).map(key)),new Set(cells.map(key)));
  }
});

test('a preset road uses the existing atomic preview, cost, and building rules',()=>{
  const city=new CitySimulation();
  const cells=roadShapeCells('circle',{x:20,y:20},{x:24,y:20});
  for(const cell of cells)city.tile(cell.x,cell.y).terrain='land';
  city.tile(cells[0].x,cells[0].y).road=1;
  const preview=city.preview('road',cells);
  assert(preview.valid,preview.reason);
  assert.equal(preview.cost,(cells.length-1)*25);
  const before=city.state.money;
  assert(city.build('road',cells).ok);
  assert.equal(city.state.money,before-preview.cost);
  assert(cells.every(cell=>city.tile(cell.x,cell.y).road===1));
  assert.equal(city.preview('road',cells).valid,false);
  const outside=roadShapeCells('block',{x:1,y:1},{x:4,y:1});
  assert.equal(city.preview('road',outside).valid,false);
});
