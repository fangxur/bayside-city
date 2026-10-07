import {isCommunityBusiness} from './community-buildings.js';
export const BUILDING_FILTERS=['residential','commercial','industrial'];
export function matchesBuildingFilter(building,filter){
 return !!building&&(!filter||building.type===filter||(filter==='commercial'&&isCommunityBusiness(building.type))||(filter==='industrial'&&['power','water'].includes(building.type)));
}
