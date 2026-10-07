import {COMMUNITY_BUILDINGS} from './community-buildings.js';
import {DECORATIONS} from './decorations.js';
import {LANDMARKS} from './landmarks.js';
import {businessKind} from './business-kinds.js';
import {RELIGIOUS_BUILDINGS} from './religious-buildings.js';

// Service aliases are populated by calculateServiceCoverage, including large facilities.
export const SERVICE_LAYERS = {
 medical:{label:'医疗',service:'clinic',color:0x549eb5},
 education:{label:'教育',service:'school',color:0x648bc4},
 culture:{label:'文化',service:'library',color:0x9476b8},
 sports:{label:'体育',service:'sportsHall',color:0x549b70},
 civic:{label:'市政',service:'cityHall',color:0x4b9c93},
 religion:{label:'宗教信仰',services:Object.keys(RELIGIOUS_BUILDINGS),color:0xad82b8},
 landscape:{label:'休闲景观',color:0x40996b},
};
export const MAP_LAYER_BUILDING_COLORS={power:0xe2bf4d,water:0x45a8c7,pollution:0xd98354,fire:0x68baa1,...Object.fromEntries(Object.entries(SERVICE_LAYERS).map(([mode,layer])=>[mode,layer.color]))};

export function buildingMatchesMapLayer(mode,building){
 if(!building)return false;
 if(mode==='power'||mode==='water')return building.type===mode;
 if(mode==='pollution')return building.type==='industrial'||building.type==='power';
 if(mode==='fire')return building.type==='fireStation';
 const definition=SERVICE_LAYERS[mode];if(!definition)return false;
 if(definition.services)return definition.services.includes(building.type);
 const community=COMMUNITY_BUILDINGS[building.type];
 if(mode==='landscape')return ['park','plaza'].includes(building.type)||!!DECORATIONS[building.type]||!!LANDMARKS[building.type]||!!community?.beauty||community?.service==='entertainment';
 return building.type===definition.service||community?.service===definition.service||(community?.serviceAliases||[]).includes(definition.service)||businessKind(building.businessKind)?.service===definition.service;
}

export const mapLayerBuildings=(state,mode)=>(state?.buildings||[]).filter(building=>buildingMatchesMapLayer(mode,building));

export function serviceLayerCell(mode,tile,building){
 const definition=SERVICE_LAYERS[mode];
 if(!definition)return null;
 const landscape=mode==='landscape';
 const covered=landscape?!!(tile.amenity>0||tile.services?.entertainment||tile.services?.park||tile.services?.plaza):(definition.services||[definition.service]).some(service=>!!tile.services?.[service]);
 const developed=!!tile.zone||!!building||tile.buildingId!=null;
 const result={color:covered?definition.color:0xd98354,visible:covered||developed};
 if(landscape&&covered)result.amount=Math.min(1,Math.max(0,tile.amenity||0)/28+Math.max(0,tile.communityServices?.entertainment||0)/10);
 return result;
}
