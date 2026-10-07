import { DECORATIONS } from './decorations.js';
import { COMMUNITY_BUILDINGS } from './community-buildings.js';

// Keep road access consistent with every building in the leisure landscape menu.
export const requiresRoad = type => !(['park', 'plaza'].includes(type) || DECORATIONS[type] || COMMUNITY_BUILDINGS[type]?.category === 'entertainment');
