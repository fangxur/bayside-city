import {BUSINESS_KINDS} from './business-kinds.js';
import {LANDMARKS} from './landmarks.js';
import { COMMUNITY_BUILDINGS } from './community-buildings.js';
import { LARGE_UTILITIES } from './utility-buildings.js';
export const newBuildingFootprint = type => ['cityHall','plaza'].includes(type)?2:LARGE_UTILITIES[type]?.footprint||COMMUNITY_BUILDINGS[type]?.footprint||LANDMARKS[type]?.footprint||BUSINESS_KINDS[type]?.footprint||1;
export const footprintSize = b => b.footprint || 1;
export const buildingCells = b => Array.from({length: footprintSize(b) ** 2}, (_, i) => ({x:b.x+i%footprintSize(b),y:b.y+Math.floor(i/footprintSize(b))}));
