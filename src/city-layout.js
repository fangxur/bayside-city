// Derived geometry only: roads and facilities keep their individual save IDs.
import {businessKind} from './business-kinds.js';
const key = (x, y) => `${x},${y}`;

export function wideRoadLayout(tiles) {
  const roads = new Map(tiles.filter(t => t.road && (t.terrain === 'land' || t.bridge)).map(t => [key(t.x, t.y), t]));
  const layout = new Map();
  for (const axis of ['ew', 'ns']) {
    const dx = axis === 'ew' ? 1 : 0, dy = 1 - dx;
    const hasPair = (x, y) => roads.has(key(x, y)) && roads.has(key(x + dy, y + dx));
    for (const t of roads.values()) {
      if (!hasPair(t.x, t.y) || hasPair(t.x - dx, t.y - dy)) continue;
      let length = 0;
      while (hasPair(t.x + dx * length, t.y + dy * length)) length++;
      // A lone 2x2 turn is not enough to establish a boulevard's direction.
      if (length < 3) continue;
      for (let i = 0; i < length; i++) for (let lane = 0; lane < 2; lane++) {
        const id = key(t.x + dx * i + dy * lane, t.y + dy * i + dx * lane);
        if ((layout.get(id)?.length || 0) < length) layout.set(id, { axis, length });
      }
    }
  }
  for (const [id, info] of layout) {
    const t = roads.get(id), cross = info.axis === 'ew' ? t.y : t.x;
    const at = n => info.axis === 'ew' ? key(t.x, n) : key(n, t.y);
    let min = cross, max = cross;
    while (layout.get(at(min - 1))?.axis === info.axis) min--;
    while (layout.get(at(max + 1))?.axis === info.axis) max++;
    info.min = min; info.max = max;
    info.level = Math.min(...Array.from({ length: max - min + 1 }, (_, i) => roads.get(at(min + i)).road));
    const span = Array.from({ length: max - min + 1 }, (_, i) => roads.get(at(min + i)));
    info.bridge = span.some(t => t.bridge);
    info.overWater = span.some(t => t.terrain === 'water');
    info.fourLane = max - min === 1 && info.level >= 2;
    info.junction = roads.has(at(min - 1)) || roads.has(at(max + 1));
  }
  return layout;
}

export function boulevardLanes(tile, layout) {
  if (!layout?.fourLane) return null;
  const cross = layout.axis === 'ew' ? tile.y : tile.x;
  const middle = (layout.min + layout.max) / 2;
  const side = cross < middle ? -1 : 1;
  const median = layout.level >= 4 ? .14 : layout.level >= 3 ? .10 : 0;
  const lanesPerDirection = layout.level >= 5 ? 3 : 2;
  const laneWidth = (1.72 - median) / (lanesPerDirection * 2);
  return {
    divider: middle - cross + side * (median / 2 + laneWidth),
    dividers: Array.from({length:lanesPerDirection-1},(_,i)=>middle-cross+side*(median/2+laneWidth*(i+1))),
    lanesPerDirection,
    centers: Array.from({length:lanesPerDirection},(_,i)=>i+.5).map(n => middle - cross + side * (median / 2 + laneWidth * n)),
    median,
    direction: layout.axis === 'ew' ? -side : side,
  };
}

export function civicGardenGroups(buildings) {
  const gardens = buildings.filter(b => ['park', 'plaza'].includes(b.type) && (b.footprint||1)===1 && (b.progress ?? 1) >= 1);
  const byPosition = new Map(gardens.map(b => [key(b.x, b.y), b]));
  const groups = new Map();
  for (const b of [...gardens].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const members = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => byPosition.get(key(b.x + dx, b.y + dy)));
    if (members.some(m => !m || m.type !== b.type || groups.has(m.id))) continue;
    const group = { x: b.x, y: b.y, type: b.type, rotation:b.rotation||0, anchorId: b.id, level: Math.min(...members.map(m => m.level || 1)), members: members.map(m => m.id) };
    for (const member of members) groups.set(member.id, group);
  }
  return groups;
}

// Only factories join along their street frontage. Homes and shops keep separate models at their own plot sizes.
// Groups are derived so individual occupancy, saves and services remain intact.
export function privateBuildingGroups(buildings, tiles = []) {
  const roads = new Set(tiles.filter(t=>t.road).map(t=>key(t.x,t.y)));
  const frontage = b => [[0,1],[1,0],[0,-1],[-1,0]].findIndex(([dx,dy])=>roads.has(key(b.x+dx,b.y+dy)));
  const eligible = buildings.filter(b=>b.type==='industrial' && !businessKind(b.businessKind)?.architecture && b.level>=2 && (b.progress??1)>=1 && (b.footprint??1)===1 && b.rotation===undefined);
  const byPosition = new Map(eligible.map(b=>[key(b.x,b.y),b]));
  const groups=new Map(),visited=new Set();
  for(const b of [...eligible].sort((a,b)=>a.y-b.y||a.x-b.x)){
    if(visited.has(b.id))continue;
    const face=Math.max(0,frontage(b)),dx=face%2===0?1:0,dy=1-dx;
    const matches=m=>m && !visited.has(m.id) && m.type===b.type && m.level===b.level && (m.businessKind||null)===(b.businessKind||null) && Math.max(0,frontage(m))===face;
    let start=b;
    while(matches(byPosition.get(key(start.x-dx,start.y-dy))))start=byPosition.get(key(start.x-dx,start.y-dy));
    const run=[];
    for(let m=start;matches(m);m=byPosition.get(key(m.x+dx,m.y+dy))){run.push(m);visited.add(m.id);}
    for(let i=0;i<run.length;){
      const remaining=run.length-i;
      if(remaining===1)break;
      const count=remaining===4?2:Math.min(3,remaining),members=run.slice(i,i+count);
      const group={anchorId:members[0].id,x:members[0].x,y:members[0].y,face,dx,dy,type:b.type,level:b.level,businessKind:b.businessKind,members:members.map(m=>m.id),styleBuilding:members[0]};
      for(const m of members)groups.set(m.id,group);
      i+=count;
    }
  }
  return groups;
}

export const rowBuildingHeight = group => group.type==='industrial' ? .48+group.level*.16 : .36+group.level*.40;
