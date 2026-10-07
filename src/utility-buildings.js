// Larger facilities retain the utility type so networks and city stages agree.
export const LARGE_UTILITIES = {
  largePower: {type:'power',name:'大型供电站',footprint:2,cost:10000,capacity:3000,maintenance:600,description:'2×2 整体建设，一级供电容量 3,000；月维护 600；可随城市阶段升至六级。'},
  largeWater: {type:'water',name:'大型供水站',footprint:2,cost:6000,capacity:3600,maintenance:320,description:'2×2 整体建设，一级供水容量 3,600；月维护 320；需要供电，可随城市阶段升至六级。'},
};
export const utilityScale = b => ['power','water'].includes(b.type) ? (b.footprint||1)**2 : 1;
