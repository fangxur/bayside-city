import {vehicleLanePose} from './vehicle-routing.js';
import {validRoadPath} from './interchanges.js';
import { wideRoadLayout } from './city-layout.js';
import {DEFAULT_MAP_SIZE,mapSize} from './grid.js';

// Visual traffic is independent from the aggregate city economy. The renderer
// owns the clock: pass zero while paused, and scale dt for simulation speed.
const EPS = 1e-7;
const STOP_LINE = 0.62;
const PHASES = [
  { phase: 'ns-green', ns: 'green', ew: 'red', duration: 6 },
  { phase: 'ns-yellow', ns: 'yellow', ew: 'red', duration: 1.25 },
  { phase: 'all-red-to-ew', ns: 'red', ew: 'red', duration: 1.5 },
  { phase: 'ew-green', ns: 'red', ew: 'green', duration: 6 },
  { phase: 'ew-yellow', ns: 'red', ew: 'yellow', duration: 1.25 },
  { phase: 'all-red-to-ns', ns: 'red', ew: 'red', duration: 1.5 },
];
const CYCLE = PHASES.reduce((sum, p) => sum + p.duration, 0);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const key = p => `${p.x},${p.y}`;
const finitePoint = (p,size=DEFAULT_MAP_SIZE) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < size && p.y >= 0 && p.y < size;
const DIRECTIONS = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
const phaseOffset = (x, y) => ((x * 11 + y * 13 + 10) % 35) / 2;
const bodyLength = car => car.kind === 'bus' ? .78 : car.kind === 'police' ? .46 : car.kind === 'fire-engine' ? 0.48 : car.kind === 'ambulance' ? 0.43 : car.kind === 'freight' ? 0.45 : 0.35;
const minimumGap = (a, b) => (bodyLength(a) + bodyLength(b)) / 2 + 0.13;

export function signalPhaseAt(time, offset = 0) {
  let clock = ((time + offset) % CYCLE + CYCLE) % CYCLE;
  for (const p of PHASES) {
    if (clock < p.duration) return { phase: p.phase, ns: p.ns, ew: p.ew, remaining: p.duration - clock };
    clock -= p.duration;
  }
  return { phase: 'ns-green', ns: 'green', ew: 'red', remaining: 6 };
}

export function detectIntersections(tiles,wide) {
  if (!Array.isArray(tiles)) return [];
  const size=mapSize({tiles});
  wide??=wideRoadLayout(tiles);
  const byPosition = new Map(tiles.filter(t => finitePoint(t,size) && t.road).map(t => [key(t), t]));
  return [...byPosition.values()].filter(t => t.terrain === 'land' && !t.bridge && !t.interchange).flatMap(t => {
    const layout = wide.get(key(t));
    if (layout && !layout.junction) return [];
    const arms = DIRECTIONS.filter(([, dx, dy]) => byPosition.has(`${t.x + dx},${t.y + dy}`)).map(([name]) => name);
    return arms.length >= 3 ? [{ id: `signal-${t.x}-${t.y}`, x: t.x, y: t.y, arms, offset: phaseOffset(t.x, t.y) }] : [];
  }).sort((a, b) => a.y - b.y || a.x - b.x);
}

export class TrafficController {
  constructor() {
    this.time = 0;
    this.signals = [];
    this.signalsKey = '';
    this._tiles = new Map();
    this._signals = new Map();
    this._cars = new Map();
  }

  sync(tiles, cars = []) {
    this.gridSize=mapSize({tiles});
    const topologyKey=this.gridSize+'|'+(Array.isArray(tiles)?tiles:[]).filter(t=>t.road).map(t=>JSON.stringify([t.x,t.y,t.road,t.terrain,!!t.bridge,t.interchange])).join('|');
    if(topologyKey!==this.topologyKey){
      this.topologyKey=topologyKey;
      this.wideRoads=wideRoadLayout(tiles);
      this.intersections=detectIntersections(tiles,this.wideRoads);
    }
    this._tiles = new Map((Array.isArray(tiles) ? tiles : []).filter(t => finitePoint(t,this.gridSize)).map(t => [key(t), t]));
    this.signals = this.intersections.map(signal => ({ ...signal, ...signalPhaseAt(this.time, signal.offset), waiting: 0 }));
    this._signals = new Map(this.signals.map(signal => [key(signal), signal]));
    // Adjacent T/cross junctions have overlapping stop/clear zones. Reserve
    // the whole connected cluster atomically instead of allowing AB/BA locks.
    const grouped = new Set();
    for (const signal of this.signals) {
      if (grouped.has(signal.id)) continue;
      const queue = [signal]; grouped.add(signal.id);
      for (let i = 0; i < queue.length; i++) {
        const member = queue[i]; member.groupId = signal.id; member.offset = signal.offset;
        for (const [, dx, dy] of DIRECTIONS) {
          const neighbor = this._signals.get(`${member.x + dx},${member.y + dy}`);
          if (neighbor && !grouped.has(neighbor.id)) { grouped.add(neighbor.id); queue.push(neighbor); }
        }
      }
    }
    for (const signal of this.signals) Object.assign(signal, signalPhaseAt(this.time, signal.offset));
    this.signalsKey = this.signals.map(s => `${s.x},${s.y}:${s.arms.join('')}`).join('|');
    const previous = this._cars;
    const next = new Map();
    const newCars = [];
    for (const input of Array.isArray(cars) ? cars : []) {
      if (!input || !['string', 'number'].includes(typeof input.id) || !Array.isArray(input.points) || input.points.length < 2 || input.points.length > this.gridSize ** 2 || next.has(input.id)) continue;
      const source = input.points;
      if (source.some((p, i) => !finitePoint(p,this.gridSize) || !this._tiles.get(key(p))?.road || (i > 0 && Math.abs(p.x - source[i - 1].x) + Math.abs(p.y - source[i - 1].y) !== 1))) continue;
      if(!validRoadPath({tiles},source))continue;
      const signature = `${input.reverse ? 'R' : 'F'}:${source.map(key).join(';')}`;
      const points = (input.reverse ? [...source].reverse() : source).map(p => ({ x: p.x, y: p.y }));
      const old = previous.get(input.id);
      const car = old?.signature === signature ? { ...old, points } : {
        id: input.id, signature, points, reverse: !!input.reverse, kind: input.kind || 'car',
        distance: 0, visible: false, waiting: false, reason: null, cooldown: 0,
      };
      car.events = [];
      points.forEach((p, i) => {
        const signal = this._signals.get(key(p));
        if (!signal) return;
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const dx = i === 0 ? after.x - p.x : p.x - before.x;
        const dy = i === 0 ? after.y - p.y : p.y - before.y;
        car.events.push({ signal, center: i, stop: i - STOP_LINE - bodyLength(car) / 2 - 0.035,
          clear: i + STOP_LINE + bodyLength(car) / 2 + 0.04, axis: dx ? 'ew' : 'ns', dx, dy });
      });
      car.zones = [];
      for (const event of car.events) {
        const last = car.zones.at(-1);
        if (last?.id === event.signal.groupId) last.clear = event.clear;
        else car.zones.push({ ...event, id: event.signal.groupId });
      }
      next.set(input.id, car);
      if (old?.signature !== signature) newCars.push({ car, preferred: Number.isFinite(input.travel) ? ((input.travel % (points.length - 1)) + points.length - 1) % (points.length - 1) : 0 });
    }
    this._cars = next;
    // Retained vehicles keep their exact positions. New representatives may be
    // seeded along an empty route; no new car is inserted into an occupied queue.
    for (const { car, preferred } of newCars) {
      let desired = preferred;
      for (const event of car.zones) {
        if (desired > event.stop && desired < event.clear && event.signal[event.axis] !== 'green') desired = Math.max(0, event.stop);
      }
      for (let attempt = desired; attempt >= -EPS; attempt -= 0.55) {
        if (this._trySpawn(car, Math.max(0, attempt))) break;
      }
    }
    this._refreshSignals();
    return this.signals;
  }

  _pose(car, distance = car.distance) {
    const length = car.points.length - 1;
    const d = clamp(distance, 0, length);
    const segment = Math.min(length - 1, Math.floor(d));
    const f = d - segment;
    const a = car.points[segment], b = car.points[segment + 1];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: b.x - a.x, dy: b.y - a.y, segment, f };
  }

  getPose(id) {
    const car = this._cars.get(id);
    if (!car) return null;
    const pose = this._pose(car);
    return { ...pose, lanePose:vehicleLanePose(car.points,car.distance,this.wideRoads), distance: car.reverse ? car.points.length - 1 - car.distance : car.distance,
      visible: car.visible, waiting: car.waiting, reason: car.reason };
  }

  _occupants() {
    const occupied = new Map();
    for (const car of this._cars.values()) {
      if (!car.visible) continue;
      for (const event of car.zones) {
        if (car.distance > event.stop + EPS && car.distance < event.clear - EPS) {
          if (!occupied.has(event.id)) occupied.set(event.id, new Set());
          occupied.get(event.id).add(car.id);
        }
      }
    }
    return occupied;
  }

  _trySpawn(car, distance = 0) {
    const pose = this._pose(car, distance);
    const owners = this._occupants();
    for (const event of car.zones) {
      if (distance <= event.stop + EPS || distance >= event.clear - EPS) continue;
      if (event.signal[event.axis] !== 'green' || owners.get(event.id)?.size) return false;
    }
    for (const other of this._cars.values()) {
      if (other === car || !other.visible) continue;
      const otherPose = this._pose(other);
      if (pose.dx !== otherPose.dx || pose.dy !== otherPose.dy) continue;
      const along = (otherPose.x - pose.x) * pose.dx + (otherPose.y - pose.y) * pose.dy;
      const across = (otherPose.x - pose.x) * pose.dy - (otherPose.y - pose.y) * pose.dx;
      if (Math.abs(across) < EPS && Math.abs(along) < minimumGap(car, other) - EPS) return false;
    }
    car.distance = distance; car.visible = true; car.waiting = false; car.reason = null; car.cooldown = 0;
    return true;
  }

  _leaderLimit(car, snapshots, lookahead = 2.2) {
    let limit = Infinity;
    const first = Math.max(0, Math.floor(car.distance));
    const last = Math.min(car.points.length - 2, Math.ceil(car.distance + lookahead));
    for (const [other, pose] of snapshots) {
      if (other === car) continue;
      for (let i = first; i <= last; i++) {
        const a = car.points[i], b = car.points[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (pose.dx !== dx || pose.dy !== dy) continue;
        const along = (pose.x - a.x) * dx + (pose.y - a.y) * dy;
        const across = (pose.x - a.x) * dy - (pose.y - a.y) * dx;
        // A queue just beyond this trip's destination still occupies its lane;
        // disappearing at the endpoint must not drive through the queue's tail.
        const endExtension = i === car.points.length - 2 ? lookahead : 0;
        if (Math.abs(across) > EPS || along < -EPS || along > 1 + endExtension + EPS) continue;
        const otherDistance = i + clamp(along, 0, 1);
        if (otherDistance <= car.distance + EPS) continue;
        limit = Math.min(limit, otherDistance - minimumGap(car, other));
      }
    }
    return limit;
  }

  _substep(dt) {
    this.time += dt;
    this._refreshSignals();
    const occupied = this._occupants();
    const snapshots = [...this._cars.values()].filter(car => car.visible).map(car => [car, this._pose(car)]);
    for (const car of this._cars.values()) {
      if (!car.visible) continue;
      const pose = this._pose(car);
      const tile = this._tiles.get(`${Math.round(pose.x)},${Math.round(pose.y)}`);
      const baseSpeed=car.kind==='bus' ? .72 : car.kind==='police' ? .96 : car.kind==='fire-engine' ? .84 : car.kind==='ambulance' ? .96 : car.kind==='freight' ? .70 : .90;
      const speed = baseSpeed / (1 + (tile?.traffic || 0) / 180);
      const requested = car.distance + speed * dt;
      let target = Math.min(requested, this._leaderLimit(car, snapshots));
      let reason = target < requested - EPS ? 'queue' : null;
      let waitingAt = null;
      for (const event of car.zones) {
        // Once a bumper has crossed its line on green, it owns clearance even
        // if the light turns yellow/red before its tail exits the intersection.
        if (car.distance > event.stop + EPS || target <= event.stop + EPS) continue;
        const owners = occupied.get(event.id);
        if (event.signal[event.axis] !== 'green' || (owners && [...owners].some(id => id !== car.id))) {
          if (target > event.stop) target = Math.max(car.distance, event.stop);
          reason = event.signal[event.axis] !== 'green' ? 'signal' : 'queue';
          waitingAt = event.signal.id;
        } else if (target > event.stop + EPS) {
          if (!owners) occupied.set(event.id, new Set([car.id]));
          else owners.add(car.id);
        }
      }
      target = Math.max(car.distance, target);
      car.waiting = target - car.distance < speed * dt * 0.25;
      car.reason = car.waiting ? reason : null;
      car.waitingAt = car.waiting ? waitingAt || car.events.find(event => event.stop >= car.distance - EPS && event.stop - car.distance <= 4)?.signal.id || null : null;
      car.distance = Math.min(car.points.length - 1, target);
      if (car.distance >= car.points.length - 1 - EPS) {
        car.visible = false; car.waiting = true; car.reason = 'queue'; car.waitingAt = null;
        car.cooldown = 0.9;
      }
    }
    // End-of-route cars wait offscreen. Respawning checks the actual shared
    // lane and junction reservation instead of wrapping into a standing queue.
    for (const car of this._cars.values()) {
      if (car.visible) continue;
      car.cooldown = Math.max(0, car.cooldown - dt);
      if (car.cooldown <= 0) this._trySpawn(car, 0);
    }
    this._refreshSignals();
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Small deterministic slices prevent vehicles tunnelling across red lines
    // or each other when the renderer runs at 3x or drops a frame.
    let remaining = Math.min(dt, 60);
    while (remaining > EPS) {
      const slice = Math.min(remaining, 1 / 30);
      this._substep(slice); remaining -= slice;
    }
  }

  _refreshSignals() {
    for (const signal of this.signals) Object.assign(signal, signalPhaseAt(this.time, signal.offset), { waiting: 0 });
    for (const car of this._cars.values()) {
      if (!car.visible || !car.waiting || !car.waitingAt) continue;
      const signal = this.signals.find(s => s.id === car.waitingAt);
      if (signal) signal.waiting++;
    }
  }

  getSignalInfo(x, y) {
    const signal = this._signals.get(`${x},${y}`);
    if (!signal) return null;
    return { ...signal, arms: [...signal.arms], title: signal.arms.length === 4 ? '十字路口信号灯' : '丁字路口信号灯' };
  }
}
