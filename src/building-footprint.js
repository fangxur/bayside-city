import {BUSINESS_KINDS} from './business-kinds.js';
import {LANDMARKS} from './landmarks.js';
import { COMMUNITY_BUILDINGS } from './community-buildings.js';
import { LARGE_UTILITIES } from './utility-buildings.js';
import { DECORATIONS } from './decorations.js';
export const newBuildingFootprint = type => ['cityHall','plaza'].includes(type)?2:LARGE_UTILITIES[type]?.footprint||COMMUNITY_BUILDINGS[type]?.footprint||LANDMARKS[type]?.footprint||DECORATIONS[type]?.footprint||BUSINESS_KINDS[type]?.footprint||1;
export const footprintSize = b => b.footprint || 1;
export const buildingCells = b => Array.from({length: footprintSize(b) ** 2}, (_, i) => ({x:b.x+i%footprintSize(b),y:b.y+Math.floor(i/footprintSize(b))}));

// Old famous sculptures used four cells. Keep their anchor and identity, and
// release only cells owned by that sculpture after the save has been validated.
export function compactFamousSculpturePlots(state){
  let changed=false;
  for(const b of state.buildings){
    if(DECORATIONS[b.type]?.style!=='famousClassical'||footprintSize(b)!==2)continue;
    const cells=buildingCells(b),size=state.mapSize||64;
    if(cells.some(c=>c.x<0||c.y<0||c.x>=size||c.y>=size||state.tiles[c.y*size+c.x]?.buildingId!==b.id))throw new Error('雕像占地存档已损坏');
    for(const c of cells.slice(1))state.tiles[c.y*size+c.x].buildingId=null;
    delete b.footprint;changed=true;
  }
  return changed;
}
