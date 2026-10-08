import {pedestrianCrossings} from './pedestrian-routing.js';
import {planPedestrians,PEDESTRIAN_CAPACITY} from './pedestrian-plans.js';
import {vehicleLanePose} from './vehicle-routing.js';
import {onboardingMapRegion} from './onboarding-layout.js';
import {NightLighting,nightAmount,isLuminousPart,isFountainPart,isLandmarkLight,isLandmarkWash,LANDMARK_LIGHT_COLORS,LIGHTING_MODES} from './night-lighting.js';
import {matchesBuildingFilter,BUILDING_FILTERS} from './building-filter.js';
import {drawReligiousBuilding} from './religious-architecture.js';
import {buddhistTempleHeight} from './chinese-courtyard-architecture.js';
import {drawEiffelTower} from './eiffel-architecture.js';
import {StreetCelebration} from './street-celebration.js';
import {drawOffice,officeHeight} from './office-architecture.js';
import {rotatedBuildingBatch} from './building-rotation.js';
import {marinaBerths,yachtRoutes} from './marina.js';
import {createYachtModel,updateYachtActor} from './yacht-rendering.js';
import {RoadVehicleLighting} from './vehicle-lighting.js';
import {SERVICE_LAYERS,MAP_LAYER_BUILDING_COLORS,serviceLayerCell,mapLayerBuildings} from './map-layers.js';
import { DECORATIONS } from './decorations.js';
import {drawEuropeanSculpture,isSculptureWash,sculptureWashColor} from './european-sculptures.js';
import { businessKind } from './business-kinds.js';
import {drawSpecialtyHome, specialtyHeight} from './residential-architecture.js';
import {drawSpecialtyShop, specialtyShopHeight} from './commercial-architecture.js';
import {drawSpecialtyFactory, specialtyFactoryHeight} from './industrial-architecture.js';
import { buildingStyle, residentialRoof } from './building-styles.js';
import { footprintSize, buildingCells } from './building-footprint.js';
import {ResidentRouteOverlay} from './resident-route-rendering.js';
import {OnboardingOverlay} from './onboarding-rendering.js';
import { COMMUNITY_BUILDINGS } from './community-buildings.js';
import { LANDMARKS,landmarkHeight,landmarkScale,completedLandmarkLevel } from './landmarks.js';
import * as THREE from 'three';
import { TrafficController, detectIntersections } from './traffic-signals.js';
import { wideRoadLayout, civicGardenGroups, boulevardLanes, privateBuildingGroups, rowBuildingHeight } from './city-layout.js';
import { ROAD_TIERS, upgradeOffer } from './progression.js';
import {fireEffectLayout} from './fire-rendering.js';
import {roadElevation,interchangeBounds,interchangeAt,INTERCHANGE_HEIGHT,validRoadPath,groundRoadAccess} from './interchanges.js';
import {InterchangeDirectionGuide} from './interchange-direction-guide.js';
import {CIVILIAN_VEHICLE_KINDS,FREIGHT_VEHICLE_KINDS,ROAD_VEHICLE_STYLES,isPublicVehicleKind,publicVehicleRoutes} from './public-vehicles.js';
import {MAX_MAP_SIZE,gridIndex,gridPoint,inGrid,mapSize} from './grid.js';

// The view is deliberately independent of simulation time. Buildings, services,
// road heatmaps and representative traffic all come from the simulation state.
const SIZE = 64;
const HALF = SIZE / 2;
const TAU = Math.PI * 2;
const COLORS = {
  grass: 0x8caa68, roof: 0xbb6950, cream: 0xeee0bd, asphalt: 0x626a6a,
  sidewalk: 0xd9d6bc, glass: 0x627f82, teal: 0x438d87, trunk: 0x76604c,
  residential: 0x68b88a, commercial: 0x669fc9, industrial: 0xd8af65, medical:0xc9433d,
};
const rnd = (x, y = 0, k = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453123;
  return n - Math.floor(n);
};
const wx = n => n - HALF + 0.5;
const clamp = THREE.MathUtils.clamp;
const noOp = () => {};
const stableHash = text => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
};

function roofGeometry() {
  const positions = [
    -.5, 0, -.5, .5, 0, -.5, 0, 1, -.5,
    .5, 0, .5, -.5, 0, .5, 0, 1, .5,
    -.5, 0, .5, -.5, 0, -.5, 0, 1, -.5,
    -.5, 0, .5, 0, 1, -.5, 0, 1, .5,
    .5, 0, -.5, .5, 0, .5, 0, 1, .5,
    .5, 0, -.5, 0, 1, .5, 0, 1, -.5,
    -.5, 0, .5, .5, 0, .5, .5, 0, -.5,
    -.5, 0, .5, .5, 0, -.5, -.5, 0, -.5,
  ];
  // The primitive's roof slopes and gables must face outwards.
  for (let i = 0; i < positions.length; i += 9) {
    for (let j = 0; j < 3; j++) [positions[i + 3 + j], positions[i + 6 + j]] = [positions[i + 6 + j], positions[i + 3 + j]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function flameGeometry(){
  const segments=7,positions=[];
  const rings=[
    {y:0,r:[.48,.41,.53,.44,.50,.39,.46],x:0,z:0},
    {y:.38,r:[.32,.29,.36,.27,.34,.28,.31],x:-.035,z:.025},
    {y:.70,r:[.16,.13,.19,.14,.17,.12,.15],x:.055,z:-.025},
  ];
  const point=(ring,i)=>{const a=i*TAU/segments,r=ring.r[i];return [ring.x+Math.cos(a)*r,ring.y,ring.z+Math.sin(a)*r];};
  const triangle=(a,b,c)=>positions.push(...a,...b,...c);
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<segments;i++){
    const next=(i+1)%segments,a=point(rings[ring],i),b=point(rings[ring],next),c=point(rings[ring+1],i),d=point(rings[ring+1],next);
    triangle(a,b,d);triangle(a,d,c);
  }
  const tip=[.14,1,-.07],top=rings.at(-1);
  for(let i=0;i<segments;i++)triangle(point(top,i),point(top,(i+1)%segments),tip);
  const center=[0,0,0];for(let i=0;i<segments;i++)triangle(point(rings[0],(i+1)%segments),point(rings[0],i),center);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.translate(0,-.5,0);return geometry;
}

class InstanceBuilder {
  constructor(view) { this.view = view; this.parts = new Map(); }
  add(kind, color, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    if (!this.parts.has(kind)) this.parts.set(kind, []);
    this.parts.get(kind).push([color, x, y, z, sx, sy, sz, rx, ry, rz]);
  }
  box(c, x, y, z, sx, sy, sz, ry = 0) { this.add('box', c, x, y, z, sx, sy, sz, ry); }
  finish(group) {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (const [kind, parts] of this.parts) {
      const mesh = new THREE.InstancedMesh(this.view.geometries[kind], this.view.material, parts.length);
      parts.forEach((p, i) => {
        dummy.position.set(p[1], p[2], p[3]);
        dummy.scale.set(p[4], p[5], p[6]);
        dummy.rotation.set(p[7], p[8], p[9]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.set(p[0]));
      });
      mesh.castShadow = kind !== 'flat';
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.nightParts=parts.filter(p=>isLuminousPart(kind,p)&&!isLandmarkLight(kind,p));
      mesh.userData.nightLandmarkParts=parts.filter(p=>isLandmarkLight(kind,p));
      mesh.userData.nightLandmarkWashParts=parts.filter(p=>isLandmarkWash(kind,p)||isSculptureWash(kind,p)).map(p=>isSculptureWash(kind,p)?[sculptureWashColor(p[0]),...p.slice(1)]:p);
      mesh.userData.partKind=kind;
      mesh.userData.nightLanternParts=kind==='cylinder'?parts.filter(p=>p[0]===0xba7252):[];
      mesh.userData.nightFountainParts=parts.filter(p=>isFountainPart(kind,p));
      group.add(mesh);
    }
  }
}

export class CityRenderer {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = { onHover: noOp, onSelect: noOp, onActorSelect: noOp, onDragStart: noOp, onDragMove: noOp, onDragEnd: noOp, shouldPanEmptyMove: noOp, ...callbacks };
    this.state = null;
    this.tool = 'inspect';
    this.overlay = 'none';
    this.paused = false;
    this.speed = 1;
    this.disposed = false;
    this.selected = null;
    this.hovered = null;
    this.viewSize = 27;
    this.azimuth = Math.PI / 4;
    this.target = new THREE.Vector3(wx(22), 0, wx(31));
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.045);
    this.pointer = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe8d7);
    this.scene.fog = new THREE.Fog(0xdfe8d7, 85, 155);
    this.camera = new THREE.OrthographicCamera(-20, 20, 13, -13, .1, 180);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-label', '湾畔市地图，单指拖动平移，双指捏合缩放；鼠标左键建设，滚轮缩放，右键拖动旋转，空格或中键拖动平移；升级模式和未选目标的移动模式可拖动空地平移');
    this.canvas.setAttribute('role', 'application');
    this.canvas.tabIndex = 0;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:none;';
    container.appendChild(this.canvas);
    this.directionGuide=new InterchangeDirectionGuide(container);

    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88, metalness: 0, flatShading: true });
    this.geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      flat: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(.5, .5, 1, 10),
      cone: new THREE.ConeGeometry(.5, 1, 8),
      mansard: new THREE.CylinderGeometry(.33,.5,1,4).rotateY(Math.PI/4).scale(Math.SQRT2,1,Math.SQRT2),
      flame: flameGeometry(),
      crown: new THREE.IcosahedronGeometry(.5, 1),
      rock: new THREE.DodecahedronGeometry(.5, 0),
      roof: roofGeometry(),
      dome: new THREE.SphereGeometry(.5, 12, 6, 0, TAU, 0, Math.PI / 2),
      ring: new THREE.TorusGeometry(.5, .075, 5, 16),
    };
    this.terrainGroup = new THREE.Group();
    this.cityGroup = new THREE.Group();
    this.fireIncidentGroup = new THREE.Group();
    this.coverageGroup = new THREE.Group();this.scene.add(this.coverageGroup);
    this.layerBuildingHighlightGroup = new THREE.Group();
    this.overlayGroup = new THREE.Group();
    this.bridgeHintGroup = new THREE.Group();
    this.bridgeHintGroup.visible = false;
    this.scene.add(this.terrainGroup, this.cityGroup, this.fireIncidentGroup, this.overlayGroup, this.layerBuildingHighlightGroup, this.bridgeHintGroup);
    this.residentRoute=new ResidentRouteOverlay(this.scene,container);
    this.onboardingOverlay=new OnboardingOverlay(this.scene,container);
    this.ambient=new THREE.HemisphereLight(0xe6f1ec,0xaba985,2.15);this.scene.add(this.ambient);
    this.lightingMode='day';this.lightingClock=0;this.nightBlend=0;
    this.nightLighting=new NightLighting(this.scene,this.geometries,this.material);
    this.sun = new THREE.DirectionalLight(0xffedd0, 3.05);
    this.sun.position.set(-25, 47, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -47, right: 47, top: 47, bottom: -47, near: 1, far: 120 });
    this.sun.shadow.bias = -.0001;
    this.sun.shadow.normalBias = .035;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this._createMarkers();
    this._createTraffic();
    this._createCivicEffects();
    this._bindEvents();
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(container);
    this._resize();
    this.lastFrame = performance.now();
    this.elapsed = 0;
    this._frame = this._frame.bind(this);
    this.animation = requestAnimationFrame(this._frame);
  }

  _clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isInstancedMesh) child.dispose();
      if (child.userData.ownGeometry) child.geometry.dispose();
      if (child.userData.ownMaterial) child.material.dispose();
    }
  }

  _resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.aspect = width / height;
    if(this.interchangeFrame)this.frameInterchange(this.interchangeFrame);
    else this._updateCamera();
  }

  _updateCamera() {
    const v = this.viewSize;
    this.camera.left = -v * this.aspect / 2;
    this.camera.right = v * this.aspect / 2;
    this.camera.top = v / 2;
    this.camera.bottom = -v / 2;
    this.camera.position.set(this.target.x + Math.sin(this.azimuth) * 48, 48, this.target.z + Math.cos(this.azimuth) * 48);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  _tile(x, y) {
    if (!inGrid(this.state,x,y)) return null;
    return this.state?.tiles[gridIndex(this.state,x,y)] || null;
  }

  setState(state, {sameWorld=false,pedestrianPlans,publicRoutes} = {}) {
    // Shared-city snapshots replace the state object without changing cities.
    // Keep pointer capture and the active stroke across those normal updates.
    const changedWorld = this.state && this.state !== state && !sameWorld;
    this.state = state;
    if (changedWorld) {
      this.onboardingOverlay?.clear();
      this.residentRoute?.clear();
      this.buildingFilter=null;
      this.clearStreetCelebration();
      this.clearMoveGhost();
      // Reloading or starting a city reuses this renderer and can share exactly
      // the same terrain. Geometry caches remain valid, transient UI does not.
      this._releasePointer();
      this.selectCell(null);
      this.setPreview([]);
      this._hover(null);
      this._resetActors();
    }
    if (!state?.tiles?.length) return;
    this._syncYachts(changedWorld);
    const terrainKey = state.tiles.map(t => t.terrain === 'water' ? 'w' : '.').join('');
    if (terrainKey !== this.terrainKey) {
      this.terrainKey = terrainKey;
      this._buildTerrain();
    }
    const buildingKey = (state.buildings || []).map(b => `${b.id}:${b.rotation??'auto'}:${b.type}:${footprintSize(b)}:${b.businessKind||''}:${b.variant}:${b.x}:${b.y}:${b.level}:${Math.min(4, Math.floor((b.progress ?? 1) * 4))}:${b.active !== false ? 1 : 0}`).join('|');
    const tileKey = state.tiles.map(t => `${t.road || 0}${t.zone ? t.zone[0] : '.'}${t.buildingId ?? ''}:${t.vegetation??''}`).join(',');
    const interchangeKey=(state.interchanges||[]).map(i=>`${i.x},${i.y}:${i.axis}:${i.width??3},${i.height??3}`).join('|');
    const incidentKey=(state.cityIncidents?.active||[]).map(event=>`${event.id}:${event.kind}:${event.targetId}`).join('|');
    const cityKey = `${terrainKey}|${tileKey}|${buildingKey}|${interchangeKey}|${state.festivalGames?.decoration||''}|${incidentKey}`;
    if (cityKey !== this.cityKey) {
      this.cityKey = cityKey;
      this._buildCity();
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.overlay !== 'none') this._buildOverlay();
    this._buildLayerBuildingHighlights();
    this._buildSelectedCoverage();
    this._syncUpgradeMarkers();
    const vehicleRoutes=[...(publicRoutes??publicVehicleRoutes(state)),...(state.routes||[])];
    const routeKey = vehicleRoutes.map(r => `${r.kind}:${r.vehicleKind||''}:${r.homeId||''}:${r.workplaceId||''}:${r.facilityId||''}:${r.targetId||''}:${r.incidentId||''}:${r.walking||false}:${r.load}:${r.points?.map(p => `${p.x},${p.y}`).join(';')}:${r.returnPoints?.map(p=>`${p.x},${p.y}`).join(';')}`).join('|');
    const routesChanged = routeKey !== this.routeKey;
    if (routesChanged) { this.routeKey = routeKey; this._setRoutes(vehicleRoutes); }
    const signalRoadKey = interchangeKey+'|'+state.tiles.map(t => `${t.road || 0}${t.terrain === 'water' ? 'w' : ''}`).join(',');
    if (signalRoadKey !== this.signalRoadKey) {
      this.signalRoadKey = signalRoadKey;
      if (!routesChanged) this._syncTrafficController();
    }
    const pedestrianKey = `${tileKey}|${buildingKey}|${interchangeKey}|${state.month}|${(state.buildings || []).filter(b => b.type === 'residential' && b.population > 0).map(b => `${b.id}:${b.population >= 16 ? 2 : 1}:${b.powered}:${b.watered}`).join('|')}|${routeKey}`;
    if (pedestrianKey !== this.pedestrianKey) { this.pedestrianKey = pedestrianKey; this._setPedestrians(pedestrianPlans); }
    this._syncCivicIncident();
  }

  _buildTerrain() {
    this._clear(this.terrainGroup);
    const landPositions = [], landColors = [], waterPositions = [];
    const color = new THREE.Color();
    const landColor = (x, z) => {
      const variation = Math.sin(x * .16 + z * .1) * .018 + Math.cos(z * .23 - x * .14) * .016;
      return color.setHSL(.235 + variation * .28, .245 + variation, .49 + variation);
    };
    const quad = (arr, points, colors = null) => {
      const indices = [0, 2, 1, 0, 3, 2];
      for (const i of indices) {
        const p = points[i]; arr.push(...p);
        if (colors) { const c = landColor(p[0], p[2]); colors.push(c.r, c.g, c.b); }
      }
    };
    const edgeParts = new InstanceBuilder(this);
    for (const t of this.state.tiles) {
      const x = wx(t.x), z = wx(t.y);
      if (t.terrain === 'water') {
        quad(waterPositions, [[x - .5, -.055, z - .5], [x + .5, -.055, z - .5], [x + .5, -.055, z + .5], [x - .5, -.055, z + .5]]);
        continue;
      }
      quad(landPositions, [[x - .5, .005, z - .5], [x + .5, .005, z - .5], [x + .5, .005, z + .5], [x - .5, .005, z + .5]], landColors);
      const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dz] of sides) {
        if (this._tile(t.x + dx, t.y + dz)?.terrain !== 'water') continue;
        edgeParts.box(0xc4bea0, x + dx * .47, -.06, z + dz * .47, dx ? .10 : 1, .13, dz ? .10 : 1);
        for (let i = 0; i < 3; i++) {
          const r = rnd(t.x, t.y, i);
          edgeParts.add('rock', r > .45 ? 0xbbba9f : 0xa8ac92, x + dx * .45 + (dz ? (i - 1) * .31 : 0), -.035 + r * .045, z + dz * .45 + (dx ? (i - 1) * .31 : 0), .18 + r * .15, .13 + r * .1, .22 + r * .15, r * TAU);
        }
      }
    }
    const landGeometry = new THREE.BufferGeometry();
    landGeometry.setAttribute('position', new THREE.Float32BufferAttribute(landPositions, 3));
    landGeometry.setAttribute('color', new THREE.Float32BufferAttribute(landColors, 3));
    landGeometry.computeVertexNormals();
    const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const land = new THREE.Mesh(landGeometry, landMaterial);
    land.receiveShadow = true;
    land.userData = { ownGeometry: true, ownMaterial: true };
    this.terrainGroup.add(land);

    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
    waterGeometry.computeVertexNormals();
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, night: { value: this.nightBlend||0 } },
      vertexShader: `varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform float time; uniform float night; varying vec3 vWorld; void main(){
        vec2 p=vWorld.xz; float a=sin(p.x*5.4+p.y*2.2+time*.45); float b=sin(p.y*12.0-p.x*4.0-time*.7);
        float waves=pow(max(0.0,a*b),16.0); float wash=.5+.5*sin(p.x*.8+p.y*.42);
        vec3 col=mix(vec3(.18,.49,.50),vec3(.28,.64,.62),wash*.60);
        col+=vec3(.19,.25,.22)*waves*.65;
        col=mix(col,vec3(.025,.07,.13)+vec3(.10,.17,.25)*waves,night);
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    const water = new THREE.Mesh(waterGeometry, this.waterMaterial);
    water.userData = { ownGeometry: true, ownMaterial: true };
    this.terrainGroup.add(water);
    edgeParts.finish(this.terrainGroup);
    this.renderer.shadowMap.needsUpdate = true;
  }

  _buildingVisualHeight(b){
    let height=b.type==='water' ? 1.4 : b.type==='power' ? .65 : b.type==='fireStation' ? 1.16 : b.type==='cityHall' ? 1.65 : COMMUNITY_BUILDINGS[b.type] ? COMMUNITY_BUILDINGS[b.type].height : LANDMARKS[b.type] ? LANDMARKS[b.type].height : b.type==='park'||b.type==='plaza' ? .09 : b.level>=2 ? 1.42 : b.type==='residential' ? .7 : .6;
    if(b.level>=3&&['residential','commercial'].includes(b.type))height=b.level===4?3.9:2.5;
    if(b.level>=2&&['power','water','fireStation','cityHall'].includes(b.type))height=.8+b.level*.4;
    if(b.level>=3&&b.type==='industrial')height=1.55;
    if(['residential','commercial','industrial'].includes(b.type)&&buildingStyle(b).index)height=buildingStyle(b).height;
    if(b.businessKind)height=['office','hotel'].includes(b.businessKind) ? .82+b.level*.34 : ['market','cafe'].includes(b.businessKind) ? .43+b.level*.16 : .98+b.level*.13;
    if(businessKind(b.businessKind)?.chinese)height=.80+b.level*.24;
    if(['power','water'].includes(b.type)&&footprintSize(b)===2)height=1.40+((b.level||1)-1)*.15;
    if(b.type==='cityHall'&&footprintSize(b)===2)height=1.20+b.level*.22;
    if(COMMUNITY_BUILDINGS[b.type]&&b.level>1)height=COMMUNITY_BUILDINGS[b.type].height*(1+(b.level-1)*.18)+.5;
    if(COMMUNITY_BUILDINGS[b.type]?.architecture==='cathedral')height=COMMUNITY_BUILDINGS[b.type].height;
    if(b.type==='buddhistTemple')height=buddhistTempleHeight(b);
    if(DECORATIONS[b.type])height=DECORATIONS[b.type].height;
    if(this.privateGroups?.has(b.id))height=rowBuildingHeight(this.privateGroups.get(b.id))+.30;
    if(b.businessKind==='office')height=officeHeight(b)+.5;
    if(b.businessKind==='courtyard')height=.60+b.level*.10+(b.level>=4?.24:0);
    if(businessKind(b.businessKind)?.architecture)height=b.type==='industrial'?specialtyFactoryHeight(b):b.type==='commercial'?specialtyShopHeight(b):specialtyHeight(b);
    if(LANDMARKS[b.type])height=landmarkHeight({...b,level:completedLandmarkLevel(b)||1});
    if((b.progress??1)<1&&!(LANDMARKS[b.type]&&b.level>1))height=.72;
    return height;
  }

  _clearFireIncidentEffects(){
    if(!this.fireIncidentGroup)return;
    for(const root of [...this.fireIncidentGroup.children]){
      root.traverse(object=>{if(object.userData.ownsFireMaterial)object.material.dispose();});
      this.fireIncidentGroup.remove(root);
    }
  }

  _fireMesh(kind,color,part,role){
    const smoke=role==='smoke',ember=role==='ember';
    const material=new THREE.MeshStandardMaterial({color,roughness:smoke?1:.58,metalness:0,transparent:smoke||ember,opacity:smoke?part.opacity:1,depthWrite:!smoke});
    if(!smoke){material.emissive.set(color);material.emissiveIntensity=ember?1.7:role==='core'?1.45:.85;material.toneMapped=false;}
    const mesh=new THREE.Mesh(this.geometries[kind],material);
    mesh.position.set(part.x,part.y,part.z);
    if(role==='ember')mesh.scale.setScalar(part.scale);else mesh.scale.set(part.sx,part.sy,part.sz);
    mesh.rotation.x=part.tiltX||0;mesh.rotation.z=part.tiltZ||0;
    mesh.castShadow=false;mesh.receiveShadow=false;
    mesh.userData={ownsFireMaterial:true,fireRole:role,baseX:part.x,baseY:part.y,baseZ:part.z,baseScaleX:mesh.scale.x,baseScaleY:mesh.scale.y,baseScaleZ:mesh.scale.z,baseRotationX:mesh.rotation.x,baseRotationZ:mesh.rotation.z,phase:part.phase||0,driftX:part.driftX||0,driftZ:part.driftZ||0,baseOpacity:part.opacity??1,layer:part.layer};
    return mesh;
  }

  _buildFireIncidentEffects(visibleBuildings){
    if(this.roadFocus)return;
    const visible=new Set(visibleBuildings.map(b=>b.id));
    for(const event of this.state.cityIncidents?.active||[]){
      if(event.kind!=='fire'||!visible.has(event.targetId))continue;
      const target=this.state.buildings.find(b=>b.id===event.targetId);if(!target)continue;
      const size=footprintSize(target),root=new THREE.Group(),layout=fireEffectLayout(event,target);
      root.position.set(wx(target.x)+(size-1)/2,Math.max(.42,this._buildingVisualHeight(target)-.13),wx(target.y)+(size-1)/2);
      root.userData={fireIncident:true,eventId:event.id};
      for(const part of layout.flames)root.add(this._fireMesh(part.kind,part.color,part,part.layer==='core'?'core':'flame'));
      for(const part of layout.smoke)root.add(this._fireMesh(part.kind,part.color,part,'smoke'));
      for(const part of layout.embers)root.add(this._fireMesh(part.kind,part.color,part,'ember'));
      const light=new THREE.PointLight(0xff6b27,1.25,4.2,2);light.position.set(0,.28,0);light.userData.fireLight=true;root.add(light);
      this.fireIncidentGroup.add(root);
    }
  }

  _animateFireIncidents(){
    const time=this.elapsed;
    for(const root of this.fireIncidentGroup?.children||[])for(const object of root.children){
      const data=object.userData;
      if(data.fireLight){object.intensity=1.15+Math.sin(time*8.1)*.20+Math.sin(time*13.7)*.10;continue;}
      if(data.fireRole==='flame'||data.fireRole==='core'){
        const pulse=Math.sin(time*(data.fireRole==='core'?9.2:7.1)+data.phase),sway=Math.sin(time*4.7+data.phase);
        object.scale.set(data.baseScaleX*(1-pulse*.05),data.baseScaleY*(1+pulse*.14),data.baseScaleZ*(1+pulse*.04));
        object.position.y=data.baseY+pulse*.018;object.rotation.x=data.baseRotationX+sway*.055;object.rotation.z=data.baseRotationZ+Math.cos(time*5.3+data.phase)*.055;
      }else if(data.fireRole==='smoke'){
        const cycle=(time*.11+data.phase)%1,grow=.88+cycle*.38;
        object.position.set(data.baseX+data.driftX*cycle+Math.sin(time*.9+data.phase*7)*.025,data.baseY+cycle*.32,data.baseZ+data.driftZ*cycle+Math.cos(time*.8+data.phase*7)*.025);
        object.scale.set(data.baseScaleX*grow,data.baseScaleY*(.92+cycle*.28),data.baseScaleZ*grow);
        object.material.opacity=data.baseOpacity*(1-cycle*.70);
        object.rotation.y=time*.10+data.phase*TAU;
      }else if(data.fireRole==='ember'){
        const cycle=(time*.32+data.phase)%1,wave=Math.sin(time*5+data.phase*TAU);
        object.position.set(data.baseX+wave*.025,data.baseY+cycle*.52,data.baseZ+Math.cos(time*4.3+data.phase*TAU)*.025);
        const scale=(1-cycle*.55)*(1+wave*.15);object.scale.setScalar(data.baseScaleX*scale);object.material.opacity=1-cycle*.82;
      }
    }
  }

  _buildCity() {
    this._clear(this.cityGroup);
    this._clearFireIncidentEffects();
    this.wideRoads = wideRoadLayout(this.state.tiles);
    this.junctionCells = new Set(detectIntersections(this.state.tiles).map(t => `${t.x},${t.y}`));
    const visibleBuildings=(this.state.buildings||[]).filter(b=>matchesBuildingFilter(b,this.buildingFilter));
    const gardens = civicGardenGroups(this.state.buildings || []);
    this.privateGroups = privateBuildingGroups(this.state.buildings || [],this.state.tiles);
    const batch = new InstanceBuilder(this);
    for (const tile of this.state.tiles) {
      const x = wx(tile.x), z = wx(tile.y);
      if (tile.road) { if(!this.state.catalogRoadsHidden)this._road(batch, tile, x, z); continue; }
      if (tile.terrain === 'water') continue;
      if(this.roadFocus){if(tile.buildingId!=null||tile.zone)batch.box(0xc2c6b7,x,.017,z,.92,.017,.92);continue;}
      if (tile.zone && tile.buildingId == null) {
        batch.box(COLORS[tile.zone], x, .017, z, .92, .017, .92);
        // Four quiet corner stakes make unbuilt planning distinct from houses.
        const edgeColor = tile.zone === 'residential' ? 0xc2e5c2 : tile.zone === 'commercial' ? 0xc8e1ec : 0xf0e0b3;
        for (const s of [-1, 1]) {
          batch.box(edgeColor, x + s * .43, .03, z, .014, .012, .87);
          batch.box(edgeColor, x, .03, z + s * .43, .87, .012, .014);
        }
      }
      if (tile.buildingId != null || tile.zone) continue;
      if(this.state.catalogPreview)continue;
      if(tile.vegetation===0)continue;
      const r = rnd(tile.x, tile.y, 0);
      const roadNearby = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => this._tile(tile.x + dx, tile.y + dy)?.road);
      const cluster = .40 + .23 * Math.sin(tile.x * .25) * Math.cos(tile.y * .19);
      if (tile.vegetation===1||r < (roadNearby ? .10 : cluster)) {
        this._tree(batch, x + (rnd(tile.x, tile.y, 1) - .5) * .5, z + (rnd(tile.x, tile.y, 2) - .5) * .5, .67 + rnd(tile.x, tile.y, 3) * .66, r < .18 ? 'pine' : 'round', Math.floor(rnd(tile.x, tile.y, 4) * 4));
      } else if (r > .91 && !roadNearby) {
        batch.add('rock', 0xb7b9a1, x + .2, .07, z - .1, .18, .14, .26, r * TAU);
      } else if (r > .72 && r < .81) {
        batch.add('crown', 0x6f8e53, x, .08, z, .3, .17, .24);
      }
    }
    for (const building of this.roadFocus?[]:visibleBuildings) {
      if (!inGrid(this.state,building.x,building.y)) continue;
      if(['park','plaza'].includes(building.type)&&building.active&&building.progress>=1)this._festivalDecoration(batch,building);
      const garden = gardens.get(building.id);
      if (garden) {
        if (garden.anchorId === building.id) this._largeGarden(rotatedBuildingBatch(batch,wx(garden.x)+.5,wx(garden.y)+.5,garden.rotation), garden);
        continue;
      }
      const row=this.privateGroups.get(building.id);
      if(row){if(row.anchorId===building.id)this._rowBuilding(batch,row);continue;}
      this._building(batch, building);
    }
    if(this.buildingFilter&&!this.roadFocus)for(const b of visibleBuildings){
      const n=footprintSize(b),x=wx(b.x)+(n-1)/2,z=wx(b.y)+(n-1)/2;
      const color={residential:0x76ed9e,commercial:0x5ddcff,industrial:0xffcf57}[this.buildingFilter];
      for(const side of [-1,1]){batch.box(color,x+side*(n/2-.03),.10,z,.06,.07,n);batch.box(color,x,.10,z+side*(n/2-.03),n,.07,.06);}
    }
    if(!this.state.catalogRoadsHidden)for(const crossing of pedestrianCrossings(this.state)){
      const vertical=crossing.direction%2===1,extent=vertical?crossing.end.y-crossing.start.y:crossing.end.x-crossing.start.x;
      const count=Math.max(3,Math.round((extent-.18)/.11)),length=extent-.18;
      for(let i=0;i<count;i++){
        const step=.09+length*(i+.5)/count;
        batch.box(0xece7d2,wx(crossing.start.x+(vertical?0:step)),.082,wx(crossing.start.y+(vertical?step:0)),vertical?.11:.06,.009,vertical?.06:.11);
      }
    }
    batch.finish(this.cityGroup);
    this._buildFireIncidentEffects(visibleBuildings);
    this.nightLighting?.rebuild(this.cityGroup,this.state,this.buildingFilter,this.roadFocus);
    this.nightLighting?.setAmount(this.nightBlend||0);
    // A separate, inexpensive pick mesh makes clicking a roof select that
    // building, rather than the ground tile projected behind its upper floor.
    if (this.buildingPickMesh) this.buildingPickMesh.dispose();
    const buildings = visibleBuildings;
    this.buildingPickMesh = new THREE.InstancedMesh(this.geometries.box, this.material, buildings.length);
    this.buildingPickCells = buildings.map(b => ({ x: b.x, y: b.y }));
    const pickDummy = new THREE.Object3D();
    buildings.forEach((b, i) => {
      const height=this._buildingVisualHeight(b);
      const size=footprintSize(b);
      pickDummy.position.set(wx(b.x)+(size-1)/2, height / 2 + .04, wx(b.y)+(size-1)/2);
      pickDummy.scale.set(size-.12, height, size-.12);
      pickDummy.updateMatrix(); this.buildingPickMesh.setMatrixAt(i, pickDummy.matrix);
    });
    this.buildingPickMesh.instanceMatrix.needsUpdate = true;
    this.buildingPickMesh.computeBoundingSphere();
    this._updateBridgeHints();
  }

  _updateBridgeHints() {
    this._clear(this.bridgeHintGroup);
    // The hover preview now highlights the complete crossing at any valid river row.
    this.bridgeHintGroup.visible = this.tool === 'bridge';
    if (this.tool !== 'inspect') this.actorMarkers?.forEach(marker => { marker.button.hidden = true; });
    else this.nextMarkerSelection = 0;
  }

  _tree(batch, x, z, scale = 1, kind = 'round', variation = 0, base = .02) {
    if(this.roadFocus)return;
    const greens = [0x55784c, 0x65864b, 0x829851, 0x6a8b59];
    batch.add('cylinder', COLORS.trunk, x, base + scale * .28, z, scale * .055, scale * .56, scale * .055);
    if (kind === 'pine') {
      batch.add('cone', greens[variation % 4], x, base + scale * .61, z, scale * .56, scale * .81, scale * .56);
      batch.add('cone', greens[(variation + 1) % 4], x, base + scale * .91, z, scale * .38, scale * .58, scale * .38);
    } else {
      batch.add('crown', greens[variation % 4], x, base + scale * .74, z, scale * .70, scale * .81, scale * .67, variation);
      batch.add('crown', greens[(variation + 1) % 4], x - scale * .16, base + scale * .62, z + scale * .1, scale * .47, scale * .55, scale * .5, variation * .7);
    }
  }

  _road(batch, tile, x, z) {
    if(tile.interchange){this._interchangeRoad(batch,tile,x,z);return;}
    const neighbor = (dx, dy) => !!this._tile(tile.x + dx, tile.y + dy)?.road;
    const n = neighbor(0, -1), s = neighbor(0, 1), e = neighbor(1, 0), w = neighbor(-1, 0);
    const y = tile.terrain === 'water' ? .15 : .036;
    const upgraded = tile.road >= 2;
    const style = ROAD_TIERS[tile.road];
    const wide = this.wideRoads?.get(`${tile.x},${tile.y}`);
    if (wide) {
      this._wideRoad(batch, tile, x, z, wide);
      return;
    }
    batch.box(style.sidewalk, x, y, z, 1.001, .058, 1.001);
    batch.box(style.asphalt, x, y + .033, z, .72, .014, .72);
    if(n||s){const top=n?.501:.36,bottom=s?.501:.36;batch.box(style.asphalt,x,y+.033,z+(bottom-top)/2,.72,.014,top+bottom);}
    if(e||w){const left=w?.501:.36,right=e?.501:.36;batch.box(style.asphalt,x+(right-left)/2,y+.033,z,left+right,.014,.72);}
    const degree = +n + +s + +e + +w;
    const mark = upgraded ? 0xeadfa9 : 0xdedcc7;
    if (degree <= 2) {
      if ((n || s) && !(e || w)) {
        batch.box(mark, x, y + .043, z, .023, .008, .27);
        if (upgraded) batch.box(mark, x + .047, y + .043, z, .015, .008, .27);
      } else if ((e || w) && !(n || s)) {
        batch.box(mark, x, y + .043, z, .27, .008, .023);
        if (upgraded) batch.box(mark, x, y + .043, z + .047, .27, .008, .015);
      }
    }
    if (tile.terrain === 'water') {
      const vertical = (n || s) && !(e || w);
      for (const side of [-1, 1]) {
        batch.box(0xc2c2b0, x + (vertical ? side * .45 : 0), y + .13, z + (vertical ? 0 : side * .45), vertical ? .026 : 1, .025, vertical ? 1 : .026);
        batch.box(0xaaa999, x + (vertical ? side * .45 : 0), y + .06, z + (vertical ? 0 : side * .45), .035, .14, .035);
      }
      if ((tile.x + tile.y) % 2 === 0) batch.box(0xc6c1a9, x, -.10, z, .22, .50, .54);
    } else if (tile.road >= 3 && degree <= 2 && ((n && s) || (e && w))) {
      const ew = e && w;
      for (const side of [-1, 1]) this._avenueEdge(batch, x, z, ew, side, tile.road, ew ? tile.x : tile.y);
    } else if (tile.road < 3 && (tile.x + tile.y * 3) % 6 === 0 && degree <= 2) {
      const side = (n || s) && !(e || w);
      this._lamp(batch, x + (side ? .43 : .08), z + (side ? .08 : .43), y);
    }
  }

  _interchangeRoad(batch,tile,x,z){
    const item=tile.interchange,ew=item.axis==='ew',style=ROAD_TIERS[tile.road],b=interchangeBounds(item);
    const cross=ew?tile.y-b.cy:tile.x-b.cx,along=ew?tile.x-b.cx:tile.y-b.cy;
    const crossCount=ew?b.height:b.width,alongCount=ew?b.width:b.height;
    const edge=Math.abs(cross)===(crossCount-1)/2,side=Math.sign(cross);
    const elevation=offset=>roadElevation(this.state,tile.x+(ew?offset:0),tile.y+(ew?0:offset),item.axis);
    const fixed=(color,offset,lateral,h,width,thickness,span,kind='box')=>batch.add(kind,color,x+(ew?offset:lateral),h,z+(ew?lateral:offset),ew?span:width,thickness,ew?width:span);
    const markings=(position,count,draw)=>{
      for(const line of [-.034,.034])if(line>=position-.5&&line<position+.5)draw(line-position,false);
      for(let n=1;n<count;n++){const line=-count/2+n;if(Math.abs(line)>.05&&line>=position-.5&&line<position+.5)draw(line-position,true);}
    };
    if(item.core){
      batch.add('flat',style.asphalt,x,.069,z,1.001,.014,1.001);
      markings(along,alongCount,(offset,dashed)=>fixed(dashed?0xf1eee0:0xedce77,offset,0,.080,dashed?.34:1.001,.006,.019,'flat'));
    }
    const slices=item.core?1:12;
    for(let i=0;i<slices;i++){
      const from=-.5+i/slices,to=from+1/slices,offset=(from+to)/2;
      const h0=elevation(from),h1=elevation(to),slope=Math.atan2(h1-h0,to-from),height=(h0+h1)/2;
      const length=Math.hypot(to-from,h1-h0)+.002;
      const part=(color,lateral,h,width,thickness,kind='box')=>batch.add(kind,color,x+(ew?offset:lateral),height+h,z+(ew?lateral:offset),ew?length:width,thickness,ew?width:length,0,ew?0:-slope,ew?slope:0);
      part(0xc6cdc4,0,.023,1.002,.075);
      part(style.asphalt,0,.069,1.002,.014,'flat');
      markings(cross,crossCount,(lateral,dashed)=>{if(!dashed||!item.core&&Math.abs(offset)<.17)part(dashed?0xf1eee0:0xedce77,lateral,.080,.020,.006,'flat');});
      if(edge){
        part(0xe0e3d8,side*.405,.083,.18,.021);
        part(0xf1eee0,side*.297,.081,.022,.006,'flat');
        part(0xd8ded3,side*.488,.048,.052,.135);
        part(0x507a78,side*.518,.062,.012,.034);
        part(0xb5c7bf,side*.459,.136,.046,.094);
        part(0x5d7d79,side*.459,.246,.024,.022);
        part(0x829b94,side*.459,.197,.018,.014);
      }
    }
    if(item.core)markings(cross,crossCount,(offset,dashed)=>{if(dashed)fixed(0xf1eee0,0,offset,elevation(0)+.081,.022,.006,.34,'flat');});
    if(edge){
      for(const offset of [-.375,0,.375])fixed(0x77928c,offset,side*.459,elevation(offset)+.20,.019,.11,.019);
      fixed(0xe8c987,0,side*.439,elevation(0)+.177,.024,.035,.048);
      if(item.core&&Math.abs(along)===(alongCount-1)/2){
        const h=elevation(0),pole=side*.451;
        fixed(0x52716e,0,pole,h+.48,.027,.66,.027);
        fixed(0x52716e,0,pole-side*.10,h+.81,.22,.025,.031);
        fixed(0xffefba,0,pole-side*.18,h+.795,.10,.018,.058);
      }
    }
    if(tile.x===item.x&&tile.y===item.y){
      const originAlong=ew?b.cx-tile.x:b.cy-tile.y,originCross=ew?b.cy-tile.y:b.cx-tile.x;
      for(const a of [-1,1]){
        const offset=originAlong+a*(alongCount/2+.33),h=elevation(offset),top=h-.047;
        for(const c of [-1,1]){
          const lateral=originCross+c*(crossCount/2-.56);
          fixed(0xb5beb3,offset,lateral,.070,.38,.09,.34);
          fixed(0xa7b6af,offset,lateral,(top+.095)/2,.23,top-.095,.23,'cylinder');
          fixed(0xd5dcd1,offset,lateral,top-.017,.34,.12,.28);
        }
        fixed(0xbac6ba,offset,originCross,top+.012,crossCount-.32,.10,.23);
      }
      for(const c of [-1,1])fixed(0xa8b9b1,originAlong,originCross+c*(crossCount/2-.54),INTERCHANGE_HEIGHT-.043,.095,.075,alongCount+.15);
    }
  }

  _wideRoad(batch, tile, x, z, wide) {
    // Raise each full cross-section together even where the two banks differ.
    if (wide.overWater) {
      const source = batch;
      batch = {
        add: (kind, color, a, h, b, ...rest) => source.add(kind, color, a, h + .114, b, ...rest),
        box: (color, a, h, b, ...rest) => source.box(color, a, h + .114, b, ...rest),
      };
    }
    const ew = wide.axis === 'ew';
    const style = ROAD_TIERS[wide.level];
    const cross = ew ? tile.y : tile.x;
    const junction = !wide.bridge && this.junctionCells.has(`${tile.x},${tile.y}`);
    const neighbor = (dx, dy) => !!this._tile(tile.x + dx, tile.y + dy)?.road;
    const edges = junction
      ? [neighbor(-1, 0), neighbor(1, 0), neighbor(0, -1), neighbor(0, 1)]
      : ew ? [neighbor(-1, 0), neighbor(1, 0), cross > wide.min, cross < wide.max]
        : [cross > wide.min, cross < wide.max, neighbor(0, -1), neighbor(0, 1)];
    const [left, right, top, bottom] = edges.map(on => on ? .501 : .36);
    // Flat road pieces receive shadows without casting tile-edge seams.
    batch.add('flat', style.sidewalk, x, .036, z, 1.001, .058, 1.001);
    batch.add('flat', style.asphalt, x + (right - left) / 2, .069, z + (bottom - top) / 2, left + right, .014, top + bottom);
    if (junction) return;
    // Paired roads share a carriageway: four lanes, or six from level five.
    const lanes = boulevardLanes(tile, wide);
    for(const divider of lanes?.dividers || [0]) batch.add('flat', wide.level>=6?0xffffff:0xf1eee0, x + (ew ? 0 : divider), .080, z + (ew ? divider : 0), ew ? .34 : .022, .008, ew ? .022 : .34);
    const middle = (wide.min + wide.max) / 2;
    if (cross === Math.floor(middle)) {
      const offset = middle - cross;
      if (lanes?.median) {
        batch.add('flat', 0xd2cdb8, x + (ew ? 0 : offset), .084, z + (ew ? offset : 0), ew ? 1.001 : lanes.median + .018, .024, ew ? lanes.median + .018 : 1.001);
        batch.add('flat', wide.bridge ? 0xaab8b7 : wide.level >= 4 ? 0x5a8261 : 0x7d9c62, x + (ew ? 0 : offset), .103, z + (ew ? offset : 0), ew ? 1.001 : lanes.median - .024, .02, ew ? lanes.median - .024 : 1.001);
        if (!wide.bridge && wide.level >= 4 && (ew ? tile.x : tile.y) % 2 === 0) batch.add('crown', 0xbdbd7c, x + (ew ? 0 : offset), .14, z + (ew ? offset : 0), .085, .085, .085);
      } else {
        const lineWidth = lanes ? .025 : .016;
        for (const side of [-1, 1]) batch.add('flat', lanes ? 0xedce77 : 0xeadfa9, x + (ew ? 0 : offset + side * .034), .080, z + (ew ? offset + side * .034 : 0), ew ? 1.001 : lineWidth, .008, ew ? lineWidth : 1.001);
      }
    }
    if (lanes) {
      const side = cross === wide.min ? -1 : 1;
      // Outer solid white edges make the full-width carriageway legible.
      batch.add('flat', 0xf1eee0, x + (ew ? 0 : side * .327), .080, z + (ew ? side * .327 : 0), ew ? 1.001 : .018, .008, ew ? .018 : 1.001);
      if ((ew ? tile.x : tile.y) % 4 === 0) {
        for (const center of lanes.centers) this._laneArrow(batch, x, z, ew, center, lanes.direction);
      }
    }
    if (wide.bridge) {
      const along = ew ? tile.x : tile.y;
      for (const side of [-1, 1]) {
        if (cross !== (side < 0 ? wide.min : wide.max)) continue;
        const px = x + (ew ? 0 : side * .46), pz = z + (ew ? side * .46 : 0);
        // Only the outside of the shared deck has parapets and railing posts.
        batch.box(0xc4c9bd, px, .105, pz, ew ? 1.001 : .055, .09, ew ? .055 : 1.001);
        batch.box(0x778e8c, px, .255, pz, ew ? 1.001 : .025, .025, ew ? .025 : 1.001);
        for (const step of [-.32, .32]) batch.box(0x91a5a0, px + (ew ? step : 0), .18, pz + (ew ? 0 : step), .025, .16, .025);
        if (along % 4 === 0) this._lamp(batch, px, pz, .07);
      }
      if (wide.overWater && cross === wide.min && along % 3 === 0) {
        const offset = (wide.max - wide.min) / 2;
        batch.box(0xaeb9b1, x + (ew ? 0 : offset), -.24, z + (ew ? offset : 0), ew ? .27 : 1.60, .40, ew ? 1.60 : .27);
      }
      return;
    }
    if (wide.level >= 3) {
      for (const side of [-1, 1]) if (cross === (side < 0 ? wide.min : wide.max)) this._avenueEdge(batch, x, z, ew, side, wide.level, ew ? tile.x : tile.y);
    } else if ((ew ? tile.x : tile.y) % 5 === 0) {
      for (const side of [-1, 1]) {
        if (cross !== (side < 0 ? wide.min : wide.max)) continue;
        this._lamp(batch, x + (ew ? 0 : side * .43), z + (ew ? side * .43 : 0), .036);
      }
    }
  }

  _avenueEdge(batch, x, z, ew, side, level, along) {
    const px = x + (ew ? 0 : side * .435), pz = z + (ew ? side * .435 : 0);
    if (along % 4 === 1) {
      batch.box(level === 4 ? 0xb7c1b7 : 0xbebda3, px, .09, pz, ew ? .44 : .105, .07, ew ? .105 : .44);
      this._tree(batch, px, pz, level === 4 ? .74 : .56, 'round', level === 4 ? 1 : 2);
    }
    if (along % 4 === 3) {
      if (level === 3) this._lamp(batch, px, pz, .036);
      else {
        batch.add('cylinder', 0x536d68, px, .41, pz, .024, .75, .024);
        batch.box(0x5c7870, px, .79, pz, ew ? .32 : .035, .025, ew ? .035 : .32);
        for (const end of [-1, 1]) batch.box(0xf8edbb, px + (ew ? end * .13 : 0), .775, pz + (ew ? 0 : end * .13), .075, .027, .065);
      }
    }
    if (level === 4) batch.add('flat', 0xbcc7be, px, .071, pz, ew ? 1.001 : .021, .008, ew ? .021 : 1.001);
  }

  _laneArrow(batch, x, z, ew, cross, direction) {
    const point = (along, across) => ew ? [x + along * direction, z + cross + across] : [x + cross + across, z + along * direction];
    const stroke = (a, b) => {
      const p = point(...a), q = point(...b);
      batch.add('flat', 0xf3f0df, (p[0] + q[0]) / 2, .083, (p[1] + q[1]) / 2, .024, .008, Math.hypot(q[0] - p[0], q[1] - p[1]), Math.atan2(q[0] - p[0], q[1] - p[1]));
    };
    stroke([-.16, 0], [.16, 0]);
    stroke([.16, 0], [.04, -.08]);
    stroke([.16, 0], [.04, .08]);
  }

  _largeGarden(batch, group) {
    const x = wx(group.x) + .5, z = wx(group.y) + .5;
    const plaza = group.type === 'plaza';
    const box = (c, a, h, d, sx, sy, sz) => batch.box(c, x + a, h, z + d, sx, sy, sz);
    const add = (kind, c, a, h, d, sx, sy, sz) => batch.add(kind, c, x + a, h, z + d, sx, sy, sz);
    box(plaza ? 0xd8cfb4 : 0x86a96b, 0, .026, 0, 1.98, .042, 1.98);
    // One perimeter promenade and entrances across the original tile seams.
    for (const side of [-1, 1]) {
      box(0xe2d5b7, side * .83, .056, 0, .16, .018, 1.82);
      box(0xe2d5b7, 0, .056, side * .83, 1.82, .018, .16);
    }
    box(0xe2d5b7, 0, .057, 0, 1.98, .02, .19);
    box(0xe2d5b7, 0, .057, 0, .19, .02, 1.98);
    if (plaza) {
      add('cylinder', 0xb9b298, 0, .08, 0, 1.16, .07, 1.16);
      add('cylinder', 0xece2c7, 0, .15, 0, .94, .14, .94);
      add('cylinder', 0x68a8b1, 0, .226, 0, .78, .022, .78);
      add('cylinder', 0xd8cfb3, 0, .30, 0, .13, .24, .13);
      add('cylinder', 0xeee5cf, 0, .42, 0, .40, .06, .40);
      add('dome', 0x8cc5c7, 0, .46, 0, .32, .08, .32);
      add('cylinder', 0xbde2dd, 0, .56, 0, .035, .23, .035);
      for (const a of [-.64, .64]) for (const d of [-.64, .64]) {
        box(0xbeb79f, a, .10, d, .34, .12, .34);
        this._tree(batch, x + a, z + d, .60, 'round', a === d ? 1 : 2);
      }
    } else {
      // An offset pond and open lawn give the park an asymmetric landscape.
      add('cylinder', 0xc8c4a9, -.39, .065, -.36, .78, .045, .57);
      add('cylinder', 0x73a9ac, -.39, .092, -.36, .66, .018, .45);
      add('crown', 0x88a65c, -.53, .11, -.31, .12, .022, .10);
      box(0x99b97b, .40, .052, .40, .60, .016, .58);
      for (const [a, d, h, v] of [[-.65, .36, .83, 0], [-.39, .62, .65, 2], [.35, -.63, .72, 1], [.65, -.47, .90, 3]]) this._tree(batch, x + a, z + d, h, 'round', v);
      // Small timber pergola facing the lawn.
      for (const a of [.24, .65]) for (const d of [.23, .61]) box(0x9b8054, a, .25, d, .032, .40, .032);
      for (let i = 0; i < 6; i++) box(0xb99d6b, .20 + i * .098, .46, .42, .046, .042, .54);
    }
    this._gardenUpgrades(batch,x,z,group.type,group.level,2);
    for (const side of [-1, 1]) {
      box(0x956d48, side * .47, .13, .77, .35, .04, .10);
      box(0xa58056, side * .47, .20, .82, .35, .12, .026);
      box(0x956d48, side * .47, .13, -.77, .35, .04, .10);
      box(0xa58056, side * .47, .20, -.82, .35, .12, .026);
      this._lamp(batch, x + side * .89, z - side * .89);
    }
  }

  _gardenUpgrades(batch,x,z,type,level=1,size=1){
    if(level<2)return;
    const box=(color,a,h,d,w,t,l)=>batch.box(color,x+a*size,h,z+d*size,w*size,t,l*size);
    // Flower borders expand with a combined garden instead of repeating four plots.
    for(const side of [-1,1]){
      box(0xc9bea1,side*.41,.08,0,.10,.07,.60);
      for(let i=-2;i<=2;i++)batch.add('crown',i%2?0xd2ac7c:0xc78e9c,x+side*.41*size,.15,z+i*.10*size,.08*size,.09,.08*size);
    }
    if(type==='plaza'){
      for(let tier=1;tier<level;tier++){
        const h=.30+tier*.17,w=(.32-tier*.055)*size;
        batch.add('cylinder',0xe7ddc2,x,h,z,w,.06,w);
        batch.add('dome',0x8fc7c7,x,h+.035,z,w*.82,.055,w*.82);
      }
      const top=.30+(level-1)*.17;
      batch.add('cylinder',0xb4dcda,x,top+.15,z,.024,.25,.024);
      if(level>=3)for(const a of [-1,1])for(const d of [-1,1]){
        batch.add('cylinder',0xa9d7d4,x+a*.18*size,.27,z+d*.18*size,.018,.30,.018);
        batch.add('dome',0xc8e6df,x+a*.18*size,.43,z+d*.18*size,.075,.055,.075);
      }
    }else{
      if(level>=3){
        batch.add('cylinder',0xc5c3a5,x,.075,z,.47*size,.06,.38*size);
        batch.add('cylinder',0x76b0b0,x,.11,z,.39*size,.025,.30*size);
      }
      if(level>=4){
        for(const a of [-.16,.16])for(const d of [-.35,-.12])box(0xcbb892,a,.30,d,.025,.48,.025);
        batch.add('cone',0x668975,x,.64,z-.235*size,.56*size,.22,.46*size,Math.PI/4);
      }
    }
    if(level>=4)for(const side of [-1,1]){
      box(0x6e955f,0,.16,side*.43,.65,.18,.07);
      for(const a of [-.31,.31])this._lamp(batch,x+a*size,z+side*.38*size,.06);
    }
  }

  _festivalDecoration(batch,b){
    const style=this.state.festivalGames?.decoration;
    if(!style)return;
    const x=wx(b.x),z=wx(b.y),width=footprintSize(b);
    for(const side of [0,width-1+.7]){
      const px=x-.35+side;
      batch.box(0x876f51,px,.6,z-.34,.045,1.2,.045);
      if(style==='lanterns'){
        batch.add('crown',0xc95642,px,1.04,z-.23,.24,.28,.22);
        batch.box(0xe7bb63,px,.83,z-.23,.025,.17,.025);
      }
    }
    if(style==='bunting'){
      batch.box(0xd3c498,x+(width-1)/2,1.15,z-.34,width-.25,.022,.022);
      for(let i=0;i<4;i++)batch.box([0xcf765b,0xe2bd69,0x689f97,0xb08aad][i],x-.25+i*(width-.5)/3,1.06,z-.34,.12,.16,.02);
    }
  }

  _decoration(batch,b){
    const x=wx(b.x),z=wx(b.y),type=b.type;
    const box=(c,a,y,d,w,h,l)=>batch.box(c,x+a,y,z+d,w,h,l);
    const shape=(k,c,a,y,d,w,h,l,ry=0,rx=0,rz=0)=>batch.add(k,c,x+a,y,z+d,w,h,l,ry,rx,rz);
    if(DECORATIONS[type]?.style==='europeanClassical'){drawEuropeanSculpture(b,shape);return;}
    box(0xd5ceb6,0,.035,0,.86,.055,.86);
    if(type==='citySculpture'){
      box(0xb8b7a4,0,.13,0,.47,.19,.47);
      box(0xe5dfc9,0,.25,0,.40,.06,.40);
      for(let i=0;i<5;i++)batch.add('box',i%2?0xa27e54:0x638b80,x+Math.sin(i*.95)*.14,.36+i*.15,z+Math.cos(i*.95)*.07,.15,.26,.17,i*.55);
      shape('crown',0xb39962,.02,1.13,-.08,.21,.22,.21);
      box(0x817651,0,.17,.247,.17,.075,.012);
    }else if(type==='stoneLions'){
      for(const a of [-.23,.23]){
        box(0xb8b8a8,a,.13,0,.30,.19,.43);
        shape('crown',0xbfc0ae,a,.37,-.035,.23,.34,.30);
        box(0xcccbb8,a,.29,.15,.23,.10,.18);
        shape('crown',0x9dA591,a,.60,.08,.29,.29,.27);
        shape('crown',0xcdcbb6,a,.60,.20,.18,.15,.15);
        for(const d of [-.07,.07])shape('crown',0xb4b6a0,a+d,.73,.08,.07,.09,.08);
        for(const d of [-.05,.05])box(0x667368,a+d,.63,.277,.023,.028,.013);
      }
    }else if(type==='flowerBed'){
      shape('cylinder',0xbcb59a,0,.10,0,.79,.12,.79);
      shape('cylinder',0x77915b,0,.17,0,.70,.07,.70);
      for(let i=0;i<12;i++){
        const a=Math.cos(i*Math.PI/6)*.25,d=Math.sin(i*Math.PI/6)*.25;
        shape('crown',[0xcd8f84,0xe5c16f,0xb99ac4][i%3],a,.25,d,.13,.11,.13);
      }
      shape('crown',0x6f9155,0,.24,0,.28,.19,.28);
    }else{
      box(0xbabca8,0,.10,0,.35,.13,.35);
      box(0xc9c8b3,0,.34,0,.13,.40,.13);
      box(0xddd5bc,0,.57,0,.36,.09,.36);
      box(0xdec581,0,.73,0,.20,.23,.20);
      for(const a of [-.13,.13])for(const d of [-.13,.13])box(0x9da792,a,.73,d,.045,.27,.045);
      shape('roof',0x8e9d88,0,.94,0,.46,.19,.46);
      shape('crown',0x789358,.28,.17,-.25,.23,.27,.23);
    }
  }

  _courtyardEstate(batch,g){
    const n=g.members?.length||1,l=g.level||1,b=g.styleBuilding||g;
    const face=g.face??(this._tile(b.x,b.y+1)?.road?0:this._tile(b.x+1,b.y)?.road?1:this._tile(b.x,b.y-1)?.road?2:this._tile(b.x-1,b.y)?.road?3:0);
    const angle=face*Math.PI/2,x=wx(g.x)+(g.dx||0)*(n-1)/2,z=wx(g.y)+(g.dy||0)*(n-1)/2;
    const shape=(k,c,a,y,d,w,h,depth)=>batch.add(k,c,x+a*Math.cos(angle)+d*Math.sin(angle),y,z-a*Math.sin(angle)+d*Math.cos(angle),w,h,depth,angle);
    const box=(c,a,y,d,w,h,depth)=>shape('box',c,a,y,d,w,h,depth);
    const roof=0x4d5b58,wall=0xe8e0ca,wood=0x89634d,h=.29+l*.10,width=n-.12;
    const hall=(a,d,w,depth,top)=>{
      box(wall,a,top/2+.07,d,w,top,depth);
      shape('roof',roof,a,top+.15,d,w+.07,.20,depth+.09);
      box(0xcbbb98,a,top+.065,d+depth/2+.025,w+.07,.025,.04);
      box(0xffdfaa,a,top+.045,d+depth/2+.048,w,.012,.008);
      for(let i=0;i<Math.max(1,Math.floor(w/.23));i++){
        const offset=(i-(Math.max(1,Math.floor(w/.23))-1)/2)*.23;
        box(wood,a+offset,.24,d+depth/2+.015,.11,.16,.018);
        box(0x8ba096,a+offset,.25,d+depth/2+.027,.07,.10,.012);
      }
    };
    box(0xcfc8af,0,.04,0,n-.025,.06,.95);
    hall(0,-.28,width-.08,.29,h);
    for(const side of [-1,1]){
      hall(side*(width/2-.09),.07,.17,.43,h*.68);
      box(wall,side*(width/4+.10),.17,.39,width/2-.23,.23,.07);
    }
    // Each joined unit keeps an open courtyard, linked by low walls and corridors.
    for(let i=0;i<n;i++){
      const a=i-(n-1)/2;
      box(0xb9b396,a,.08,.07,.57,.025,.40);
      if(l>=2){
        box(0x849570,a-.15,.12,.09,.20,.07,.22);
        shape('crown',0x6f925d,a-.15,.25,.09,.19,.27,.20);
        for(const d of [-.02,.15])box(0xded5bc,a+.16,.105,d,.17,.03,.12);
      }
      if(l>=3){
        shape('cylinder',0xb6b59c,a+.12,.13,.07,.23,.07,.23);
        shape('cylinder',0x81a7a8,a+.12,.175,.07,.18,.014,.18);
        box(wood,a,.36,-.075,.52,.045,.14);
        for(const off of [-.22,.22])box(wood,a+off,.22,-.03,.025,.30,.025);
      }
      if(i<n-1){box(wall,a+.5,.19,.08,.045,.25,.46);box(wood,a+.5,.30,.08,.09,.04,.15);}
    }
    const gateHeight=.32+l*.055;
    for(const a of [-.13,.13])box(wall,a,gateHeight/2,.40,.075,gateHeight,.13);
    box(0x9a6350,0,.20,.40,.18,.30,.04);
    shape('roof',roof,0,gateHeight+.10,.40,l>=3?.49:.40,.15,.25);
    for(const a of [-.17,.17]){shape('cylinder',0xba7252,a,gateHeight-.04,.46,.07,.10,.07);box(0xd0ae62,a,gateHeight-.11,.46,.01,.05,.01);}
    if(l>=3)box(wood,0,gateHeight+.015,.53,.15,.055,.012);
    if(l>=4){
      // A modest upper study and double eaves instead of a high-rise slab.
      hall(0,-.28,Math.min(width-.10,.57),.28,h+.24);
      if(l>=5)for(const side of [-1,1]){box(wood,side*(width/2-.12),.33,.18,.045,.49,.045);shape('roof',roof,side*(width/2-.12),.63,.18,.27,.13,.36);}
      if(l>=6){box(0xc8b789,0,.085,.16,Math.min(.46,width-.2),.035,.16);shape('crown',0x789861,0,.17,.16,.14,.16,.14);}
      shape('roof',roof,0,h+.22,-.28,Math.min(width,.70),.13,.43);
      for(const a of [-width/2+.08,width/2-.08])box(wall,a,h+.13,-.28,.065,.24,.40);
    }
  }

  _chinesePrivate(b,local,box){
    const k=b.businessKind,l=b.level,h=.28+l*.24,roof=b.type==='residential'?(k==='courtyard'?0x4d5b58:k==='lingnan'?0x60746e:residentialRoof(b).color):0x506865,wall=0xe5dfc9,wood=0x82604a;
    const wing=(a,d,w,depth,height)=>{
      box(wall,a,height/2+.07,d,w,height,depth);
      local('roof',roof,a,height+.16,d,w+.09,.23,depth+.12);
      box(0xc6b692,a,height+.06,d+depth/2+.03,w+.10,.04,.045);
      for(let f=0;f<l;f++)for(const off of [-.22,0,.22])if(Math.abs(off)<w/2){
        box(wood,a+off,.24+f*.21,d+depth/2+.015,.13,.14,.02);
        box(0x8daca3,a+off,.24+f*.21,d+depth/2+.030,.085,.10,.012);
      }
    };
    const lantern=(a,y,d)=>{local('cylinder',0xb7694e,a,y,d,.10,.12,.10);box(0xd5b66b,a,y-.085,d,.012,.065,.012);};
    box(0xcfcab4,0,.045,0,.94,.07,.94);
    if(k==='courtyard'){
      wing(0,-.24,.77,.31,h);
      wing(-.32,.10,.18,.39,h*.70);wing(.32,.10,.18,.39,h*.70);
      box(0xa3b28a,0,.09,.04,.30,.06,.23);
      box(wall,-.27,.20,.36,.22,.29,.09);box(wall,.27,.20,.36,.22,.29,.09);
      box(0x976352,0,.23,.36,.22,.35,.055);
      local('roof',roof,0,.46,.36,.38,.13,.22);lantern(-.14,.32,.41);lantern(.14,.32,.41);
      if(l>=3)local('crown',0x6a905c,.13,.26,.04,.20,.31,.20);
    }else if(k==='lingnan'){
      wing(0,-.07,.72,.64,h+.15);
      // Lingnan homes are defined by wok-ear gables, a shaded arcade and
      // coloured glass vents rather than the rectangular shell shared by
      // ordinary private buildings.
      box(0x475954,0,h+.34,-.07,.035,.035,.73);
      for(const side of [-1,1]){
        const a=side*.37;
        box(wall,a,h+.18,-.07,.075,.34,.66);
        box(wall,a-side*.035,h+.36,-.07,.14,.10,.57);
        box(wall,a-side*.075,h+.44,-.07,.20,.08,.45);
        box(0x60746e,a-side*.075,h+.49,-.07,.23,.035,.47);
        box(0x60746e,a,h+.20,-.375,.095,.035,.08);
        local('crown',0x6f8b68,a,.18,.30,.15,.23,.13);
      }
      for(const a of [-.25,0,.25])box(0x81938a,a,h+.21,-.07,.022,.025,.60);
      for(const a of [-.30,0,.30])box(wall,a,.23,.34,.065,.38,.07);
      for(const a of [-.15,.15]){
        box(wall,a,.38,.34,.21,.055,.07);
        box(0x789b91,a,.28,.382,.115,.15,.016);
        box(a<0?0xb78a5b:0x6e91a0,a,.28,.394,.075,.09,.012);
      }
      for(let f=1;f<=l;f++){
        const y=.19+f*.22;box(0xece2c8,0,y,.34,.79,.05,.17);
        box(0x809a8a,0,y+.08,.425,.77,.11,.025);
      }
      box(wood,0,.20,.405,.15,.29,.035);
      for(const a of [-.27,-.09,.09,.27]){
        box(wood,a,.105,.40,.13,.07,.13);
        box(0xb9a17e,a,.075,.40,.07,.08,.07);
      }
      box(0x8fa680,0,.11,.28,.19,.08,.10);
    }else{
      wing(0,-.06,.77,.63,h+(k==='teaHouse'?.18:0));
      const eave=k==='teaHouse'?.49:.39;
      local('roof',roof,0,eave,.24,.89,.16,.38);
      for(const a of [-.34,.34]){box(wood,a,.24,.38,.04,.41,.04);lantern(a,.36,.39);}
      box(wood,0,eave+.015,.445,.35,.13,.025);
      for(const a of [-.10,0,.10])box(0xd9c293,a,eave+.015,.462,.045,.065,.01);
      if(k==='teaHouse')for(const a of [-.20,.20]){
        local('cylinder',0xb9a179,a,.16,.38,.14,.035,.14);box(wood,a,.09,.38,.025,.13,.025);
      }else for(const a of [-.23,.23])box(0xba9772,a,.17,.39,.19,.16,.12);
    }
  }

  _chineseLeisure(batch,b){
    const base=b.type==='operaStage'?2:1,scale=footprintSize(b)/base;
    if(scale>1){
      const x=wx(b.x),z=wx(b.y),offset=(scale-1)/2;
      const proxy={
        box:(c,a,y,d,w,h,l,ry=0)=>batch.box(c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,ry),
        add:(k,c,a,y,d,w,h,l,ry=0,rx=0,rz=0)=>batch.add(k,c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,ry,rx,rz),
      };
      this._chineseLeisure(proxy,{...b,footprint:base});return;
    }
    const size=footprintSize(b),x=wx(b.x)+(size-1)/2,z=wx(b.y)+(size-1)/2;
    const box=(c,a,y,d,w,h,l)=>batch.box(c,x+a,y,z+d,w,h,l);
    const shape=(kind,c,a,y,d,w,h,l)=>batch.add(kind,c,x+a,y,z+d,w,h,l);
    box(0xd5cfb8,0,.04,0,size-.04,.07,size-.04);
    if(b.type==='operaStage'){
      box(0xe7dec4,0,.17,-.33,1.56,.25,.91);
      box(0x93594c,0,.61,-.66,1.30,.76,.10);
      box(0x594f49,0,.59,-.595,.85,.53,.025);
      for(const a of [-.65,-.40,.40,.65])box(0xa5674f,a,.62,-.10,.075,.79,.075);
      shape('roof',0x526c63,0,1.08,-.35,1.78,.29,1.11);
      shape('roof',0x5f7b6b,0,1.31,-.35,1.16,.20,.66);
      box(0x886346,0,1.04,.20,.48,.14,.035);
      for(const a of [-.58,.58])shape('cylinder',0xbc7754,a,.92,.15,.14,.18,.14);
      for(let row=0;row<3;row++)for(const a of [-.45,.45]){
        box(0x9b805e,a,.16,.29+row*.23,.52,.06,.13);
        for(const off of [-.18,.18])box(0x806f56,a+off,.09,.29+row*.23,.04,.14,.06);
      }
      for(const a of [-.85,.85]){box(0xadb28c,a,.10,.46,.16,.12,.74);this._tree(batch,x+a,z+.66,.42,'round',1);}
    }else{
      box(0xe4dcc4,0,.09,0,.71,.10,.71);
      for(const a of [-.28,.28])for(const d of [-.28,.28])box(0x8b6750,a,.40,d,.05,.60,.05);
      shape('roof',0x516f65,0,.77,0,.87,.23,.87);
      shape('roof',0x698276,0,.93,0,.49,.15,.49);
      box(0xc7b588,0,.29,0,.31,.055,.31);box(0xa99c7e,0,.18,0,.10,.23,.10);
      for(let i=-2;i<=2;i++){box(0x726c50,i*.05,.322,0,.006,.003,.27);box(0x726c50,0,.322,i*.05,.27,.003,.006);}
      for(const a of [-.19,.19])shape('cylinder',0x958873,a,.17,0,.12,.18,.12);
      shape('crown',0x759260,.35,.17,-.34,.21,.25,.21);
    }
  }

  _cityHallCampus(batch,b){
    const x=wx(b.x)+.5,z=wx(b.y)+.5,level=b.level||1,h=.64+level*.22;
    const box=(c,a,y,d,w,t,l)=>batch.box(c,x+a,y,z+d,w,t,l);
    box(0xd8d3bd,0,.04,0,1.97,.075,1.97);
    box(0xe9e2cb,0,h/2+.12,-.26,1.36,h,.82);
    for(const a of [-.62,.62]){box(0xd6d5be,a,h*.40+.10,-.05,.34,h*.80,.84);box(0x69877f,a,h*.80+.14,-.05,.40,.07,.90);}
    box(0x59786f,0,h+.16,-.26,1.43,.08,.91);
    for(let f=0;f<level+1;f++)for(const a of [-.44,-.22,0,.22,.44])box(0x6f9797,a,.31+f*.19,.163,.12,.12,.025);
    for(const a of [-.42,-.14,.14,.42]){box(0xf3edd8,a,.36,.35,.08,.48,.09);box(0xe6dfc5,a,.13,.35,.13,.055,.15);}
    box(0xede5cf,0,.64,.34,1.06,.09,.35);
    box(0x527975,0,.30,.18,.30,.32,.025);
    for(let i=0;i<3;i++)box(0xeee8d2,0,.06+(3-i)*.025,.50+i*.10,.92+i*.10,.045,.20);
    box(0xe6dfc5,0,h+.32,-.26,.38,.30,.37);
    box(0x5e7b72,0,h+.49,-.26,.46,.065,.44);
    box(0xf3ebd0,0,h+.33,-.068,.20,.19,.014);
    box(0x55736b,0,h+.35,-.054,.015,.075,.008);box(0x55736b,.03,h+.32,-.054,.07,.014,.008);
    for(const a of [-.74,.74]){box(0xa9b08a,a,.10,.60,.30,.10,.45);this._tree(batch,x+a,z+.62,.46+level*.025,'round',1);}
    batch.add('cylinder',0x6d7970,x-.48,.54,z+.66,.022,.94,.022);
    box(0xb97961,-.38,.87,.66,.20,.12,.02);
    if(level>=3){box(0x859e74,0,h+.22,-.48,.93,.08,.24);for(const a of [-.35,.35])batch.add('crown',0x688958,x+a,h+.35,z-.48,.20,.21,.20);}
  }

  _worldLandmark(batch,b){
    const size=footprintSize(b),x=wx(b.x)+(size-1)/2,z=wx(b.y)+(size-1)/2,scale=landmarkScale(b);
    const glow=c=>b.active===false?0x778789:c;
    const {gold,cyan,pink,white}=LANDMARK_LIGHT_COLORS;
    const box=(c,a,h,d,w,t,l)=>batch.box(c,x+a,h*scale,z+d,w,t*scale,l);
    const shape=(k,c,a,h,d,w,t,l)=>{
      // Raise the Pearl's viewing spheres without stretching them into ellipsoids.
      const orb=b.type==='orientalPearl'&&(k==='crown'||k==='cylinder'&&w>.25),width=orb?1.18:1;
      batch.add(k,c,x+a,h*scale,z+d,w*width,t*(orb?width:scale),l*width);
    };
    const beam=(a,d,c=0x947655,w=.055)=>{
      const from=new THREE.Vector3(a[0],a[1]*scale,a[2]),to=new THREE.Vector3(d[0],d[1]*scale,d[2]),direction=to.clone().sub(from),mid=from.clone().add(to).multiplyScalar(.5);
      const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));
      batch.add('cylinder',c,x+mid.x,mid.y,z+mid.z,w,direction.length(),w,e.y,e.x,e.z);
    };
    box(0xd8d1bd,0,.05,0,size-.02,.08,size-.02);
    for(const a of [-1,1])for(const d of [-1,1]){const corner=(size-1)*.55;box(0x8da778,a*corner,.11,d*corner,.3,.06,.3);}
    if(b.type==='orientalPearl'){
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam([Math.cos(a)*.82,.14,Math.sin(a)*.82],[Math.cos(a)*.2,1.65,Math.sin(a)*.2],0xd6c5bb,.14);}
      shape('cylinder',0xc9c7be,0,2.02,0,.22,2.9,.22);
      for(const [i,[h,r]]of [[1.4,.98],[3.12,.7],[3.89,.28]].entries()){shape('crown',b.active===false?0xae8f96:0xcb8f9d,0,h,0,r,r,r);shape('cylinder',glow(i%2?cyan:pink),0,h,0,r*1.02,.09,r*1.02);}
      for(const a of [-.15,.15])shape('cylinder',0xdbd4c8,a,2.15,0,.07,1.55,.07);
      for(const a of [-.195,.195])shape('cylinder',glow(cyan),a,2.15,0,.024,1.65,.024);
      shape('cylinder',0xd5c7af,0,4.14,0,.055,.78,.055);
      shape('cylinder',glow(white),0,4.49,0,.06,.08,.06);
      box(0xa9babc,0,.24,.84,1.02,.26,.48);
    }else if(b.type==='cantonTower'){
      const rings=18,levels=12,points=[];
      for(let j=0;j<=levels;j++){
        const h=.15+j*.33,r=.24+.35*Math.pow((j-5)/7,2),turn=j*.055;
        points[j]=Array.from({length:rings},(_,i)=>[Math.cos(i*2*Math.PI/rings+turn)*r,h,Math.sin(i*2*Math.PI/rings+turn)*r]);
        for(let i=0;i<rings;i++)beam(points[j][i],points[j][(i+1)%rings],0xb2c9c6,.024);
        if(j)for(let i=0;i<rings;i++)beam(points[j-1][i],points[j][(i+1)%rings],glow(i%3?cyan:pink),.028);
      }
      shape('cylinder',glow(pink),0,3.83,0,.7,.10,.7);shape('cylinder',0xd9d4be,0,4.43,0,.055,1.02,.055);
      shape('cylinder',glow(white),0,4.92,0,.06,.08,.06);
    }else if(b.type==='empireState'){
      for(const [h,w,l,t]of [[.36,1.9,1.65,.54],[.89,1.3,1.15,.52],[1.91,.88,.83,1.52],[2.99,.61,.62,.64],[3.52,.37,.4,.4]]){
        box(0xc9bca2,0,h,0,w,t,l);box(0xe4d8bd,0,h+t/2+.035,0,w+.045,.055,l+.045);
        for(const side of [-1,1]){
          box(glow(gold),0,h+t/2+.045,side*(l/2+.028),w+.045,.025,.025);
          box(glow(gold),side*(w/2+.028),h+t/2+.045,0,.025,.025,l+.045);
        }
        for(let a=-w/2+.12;a<w/2;a+=.15)for(let y=h-t/2+.12;y<h+t/2-.04;y+=.2)box(0x657f86,a,y,l/2+.012,.065,.12,.018);
        for(let d=-l/2+.12;d<l/2;d+=.15)for(let y=h-t/2+.12;y<h+t/2-.04;y+=.2)box(0x657f86,w/2+.012,y,d,.018,.12,.065);
      }
      shape('cylinder',0xb6c7c4,0,4.06,0,.13,.7,.13);shape('cylinder',0xe8dbc1,0,4.53,0,.032,.38,.032);
      shape('cylinder',glow(cyan),0,4.06,0,.14,.7,.14);
    }else if(b.type==='eiffelTower'){
      drawEiffelTower({box,beam,shape,light:glow(gold),lit:b.active!==false});
    }else{
      box(0xccb587,0,1.23,0,.65,2.23,.65);
      for(const a of [-.25,0,.25]){box(glow(gold),a,1.22,.335,.032,2.13,.025);box(glow(gold),.335,1.22,a,.025,2.13,.032);}
      box(0xd9c194,0,2.55,0,.82,.59,.82);
      const clock=(c,a,h,d,w,t,l)=>batch.box(c,x+a,2.55*scale+h-2.55,z+d,w,t,l);
      for(const side of [-1,1]){
        clock(0x526b69,0,2.55,side*.421,.5,.5,.024);clock(glow(gold),0,2.55,side*.438,.4,.4,.016);
        clock(0x455a58,0,2.6,side*.451,.025,.17,.015);clock(0x455a58,.07,2.55,side*.452,.14,.025,.016);
        clock(glow(gold),side*.438,2.55,0,.016,.4,.4);clock(0x455a58,side*.451,2.6,0,.015,.17,.025);clock(0x455a58,side*.452,2.55,.07,.016,.025,.14);
      }
      box(0xd3b774,0,2.91,0,.88,.1,.88);shape('cone',0x637d76,0,3.2,0,.78,.53,.78);
      for(const a of [-.35,.35])for(const d of [-.35,.35])shape('cone',0xc3a566,a,3.02,d,.13,.43,.13);
      shape('cylinder',0xc3a566,0,3.58,0,.035,.28,.035);
      box(0xc6b492,-.59,.34,-.18,.49,.53,.96);
    }
  }

  _metropolitanFacility(batch,b){
    if(b.type==='shoppingComplex'&&footprintSize(b)!==3){
      const x=wx(b.x),z=wx(b.y),size=footprintSize(b),scale=size/3,offset=(size-1)/2-scale;
      const proxy={box:(c,a,y,d,w,h,l,ry=0)=>batch.box(c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,ry),add:(k,c,a,y,d,w,h,l,...rot)=>batch.add(k,c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,...rot)};
      this._metropolitanFacility(proxy,{...b,footprint:3});return;
    }
    const x=wx(b.x)+1,z=wx(b.y)+1,tier=b.level-1;
    const box=(c,a,h,d,w,t,l)=>batch.box(c,x+a,h,z+d,w,t,l);
    if(b.type==='grandStadium'){
      const cx=wx(b.x)+.5,cz=wx(b.y)+.5;
      const proxy={box:(c,a,h,d,w,t,l)=>batch.box(c,x+(a-cx)*1.5,h*(1+tier*.12),z+(d-cz)*1.5,w*1.5,t*(1+tier*.12),l*1.5),add:(k,c,a,h,d,w,t,l,...r)=>batch.add(k,c,x+(a-cx)*1.5,h*(1+tier*.12),z+(d-cz)*1.5,w*1.5,t*(1+tier*.12),l*1.5,...r)};
      this._largeCommunity(proxy,{...b,type:'stadium'});
      for(const side of [-1,1]){box(0xede8d9,side*1.20,.92+tier*.1,0,.35,.08,2.1);for(const d of [-.85,0,.85])box(0x76958f,side*1.20,.48+tier*.05,d,.035,.87+tier*.1,.035);}
      return;
    }
    box(0xdad5c4,0,.05,0,2.98,.08,2.98);
    if(b.type==='grandGallery'){
      for(const [a,d,w,l,h] of [[-.65,-.52,1.05,1.4,1.05],[.55,-.7,1.2,.8,.75],[.65,.37,.9,1.25,1.35]]){
        const top=h+tier*.13;box(0xece5d4,a,top/2+.08,d,w,top,l);box(0xb29376,a,top+.1,d,w+.08,.09,l+.08);
        box(0x7babad,a,top+.16,d,w*.65,.04,l*.68);
        box(0x678f99,a,top*.48,d+l/2+.01,w*.72,top*.58,.022);
      }
      box(0x86afb0,0,.38,-.1,.35,.6,1.5);
      box(0xb8ad93,-.55,.17,.92,.52,.25,.52);
      batch.add('cone',0xae8353,x-.55,.62,z+.92,.4,.7,.4,Math.PI/4);
      for(const a of [-1.2,1.22])this._tree(batch,x+a,z+1.15,.6,'round',1);
    }else{
      box(0xd7c3a3,0,.32,0,2.65,.54,2.45);
      box(0x6b999d,0,.30,1.24,2.2,.34,.025);
      box(0x88a783,0,.62,0,2.58,.05,2.38);
      for(const a of [-.73,.73]){
        const top=1.75+(a>0?.38:0)+tier*.18;
        box(0xcddbd6,a,(top+.64)/2,-.35,.78,top-.64,1.14);
        for(let h=.8;h<top;h+=.21){box(0x638f9e,a,h,.23,.68,.13,.025);box(0x638f9e,a+.398,h,-.35,.025,.13,1.03);}
        box(0xb89b77,a,top+.04,-.35,.87,.08,1.22);
      }
      box(0x9fc3c0,0,.87,.35,.5,.45,1.12);
      for(const a of [-1,-.5,.5,1])this._tree(batch,x+a,z+.91,.38,'round',1);
      box(0xe9dcb7,0,.23,1.38,.8,.04,.20);
    }
  }

  _largeCommunity(batch,b){
    const x=wx(b.x)+.5,z=wx(b.y)+.5;
    const box=(c,a,h,d,w,t,l)=>batch.box(c,x+a,h,z+d,w,t,l);
    const shape=(kind,c,a,h,d,w,t,l)=>batch.add(kind,c,x+a,h,z+d,w,t,l);
    box(0xd8d4be,0,.04,0,1.98,.07,1.98);
    if(b.type==='hospital'){
      box(0xe8e8d7,0,.27,-.05,1.65,.43,1.12);
      for(const a of [-.43,.43]){
        const top=a<0?1.16:1.57;
        box(0xf0ecdb,a,(top+.38)/2,-.21,.61,top-.38,.83);
        box(0x87aaa5,a,top+.04,-.21,.68,.07,.91);
        for(let h=.64;h<top;h+=.24)for(const v of [-.17,0,.17]){
          box(0x658e97,a+v,h,.213,.10,.14,.016);
          box(0x658e97,a+.314,h,-.21+v,.016,.14,.10);
        }
      }
      box(0x699797,0,.24,.524,.62,.29,.022);
      box(0xa5c4b6,0,.44,.65,.87,.055,.31);
      box(0x568878,-.43,1.22,-.21,.33,.025,.33);
      for(const a of [-.50,-.36])box(0xeee9d4,a,1.242,-.21,.026,.012,.22);
      box(0xeee9d4,-.43,1.242,-.21,.16,.012,.026);
      box(0xf5efdd,.43,1.59,.28,.27,.27,.05);
      box(COLORS.medical,.43,1.60,.31,.17,.044,.016);box(COLORS.medical,.43,1.60,.31,.044,.17,.016);
      box(0xeae6d5,.67,.14,.70,.29,.16,.15);box(0x6b999e,.62,.24,.70,.13,.075,.15);
      for(const a of [-.76,.76]){box(0xbdbca0,a,.12,.82,.23,.12,.22);this._tree(batch,x+a,z+.82,.48,'round',1);}
    }else{
      shape('cylinder',0xc1c2ab,0,.15,0,1.89,.22,1.70);
      for(let tier=0;tier<3;tier++)shape('cylinder',tier%2?0x96b2a3:0xe1d9c1,0,.28+tier*.07,0,1.82-tier*.13,.065,1.63-tier*.13);
      shape('cylinder',0xb9856d,0,.46,0,1.45,.035,1.23);
      shape('cylinder',0xe2c8a6,0,.483,0,1.29,.012,1.07);
      shape('cylinder',0xb9856d,0,.493,0,1.25,.01,1.03);
      box(0x7fa878,0,.51,0,1.08,.025,.69);
      for(const a of [-.51,0,.51])box(0xe8eed5,a,.529,0,.013,.008,.65);
      for(const d of [-.32,.32])box(0xe8eed5,0,.529,d,1.03,.008,.013);
      for(const a of [-.54,.54]){box(0xeee9d6,a,.61,0,.018,.16,.26);box(0xeee9d6,a,.70,0,.085,.018,.28);}
      for(const a of [-.82,.82])for(const d of [-.70,.70]){box(0x788e84,a,.47,d,.024,.80,.024);box(0xf5e8bc,a,.89,d,.22,.07,.07);}
      box(0x5d817a,0,.47,-.78,.46,.20,.045);box(0xdedcba,0,.47,-.806,.30,.06,.012);
    }
  }

  _districtOffice(batch,b){
    if(footprintSize(b)===1){
      const x=wx(b.x),z=wx(b.y),level=b.level||1,height=.54+Math.min(level,4)*.13;
      const box=(c,a,h,d,w,t,l)=>batch.box(c,x+a,h,z+d,w,t,l);
      box(0xd9d3c1,0,.04,0,.94,.07,.94);
      box(0xe8dfce,0,height/2+.06,-.08,.70,height,.58);
      box(0x556a78,0,height+.10,-.08,.77,.07,.65);
      // Glazed walk-in service hall and a small civic canopy.
      for(const a of [-.22,0,.22])box(0x71989b,a,.28,.216,.16,.30,.022);
      box(0xf2e9d7,0,.48,.32,.72,.065,.25);
      for(const a of [-.29,.29])box(0xece4d4,a,.27,.33,.045,.42,.045);
      box(0xb78656,0,.53,.452,.33,.045,.018);
      box(0xd0c3a7,0,.095,.59,.54,.025,.20);
      box(0x698c8c,.34,.30,.58,.08,.43,.07);
      batch.add('crown',0x668653,x-.35,.20,z+.56,.18,.24,.18);
      this._lamp(batch,x+.38,z+.58,.04);
      if(level>=2){box(0x6d989a,0,height+.20,-.08,.55,.16,.43);box(0x4f7376,0,height+.30,-.08,.61,.045,.49);}
      if(level>=4){box(0xd6c08d,-.25,height+.48,-.16,.04,.38,.04);box(0xc86e56,-.15,height+.59,-.16,.20,.12,.018);}
      if(level>=6)batch.add('crown',0x6f956e,x+.24,height+.48,z-.12,.20,.30,.20);
      return;
    }
    const x=wx(b.x)+.5,z=wx(b.y)+.5;
    const box=(c,a,h,d,w,t,l)=>batch.box(c,x+a,h,z+d,w,t,l);
    box(0xd9d3c1,0,.045,0,1.96,.08,1.96);
    // Two office wings frame a glazed public hall and an open entrance square.
    box(0xe8dfce,-.46,.55,-.22,.62,1,1.12);
    box(0xd9c7ad,.48,.42,-.28,.53,.74,1);
    box(0x71989b,.02,.33,-.18,.40,.56,.83);
    box(0x556a78,-.46,1.08,-.22,.70,.07,1.20);
    box(0x556a78,.48,.83,-.28,.61,.07,1.08);
    for(const a of [-.62,-.34,.34,.58])for(const h of [.35,.62])box(0x71989b,a,h,.348,.12,.15,.024);
    box(0xf2e9d7,0,.64,.37,1.42,.09,.26);
    for(const a of [-.62,.62])box(0xece4d4,a,.34,.44,.055,.54,.055);
    box(0xb78656,0,.69,.512,.38,.045,.015);
    box(0xebe2cf,0,.10,.68,1.20,.035,.37);
    box(0x698c8c,.78,.31,.68,.12,.48,.08);
    for(const a of [-.80,.80]){box(0xb1af92,a,.12,.22,.24,.12,.25);this._tree(batch,x+a,z+.22,.42,'round',1);}
    this._lamp(batch,x-.82,z+.78,.04);
  }

  _sportsCampus(batch,b){
    const x=wx(b.x)+.5,z=wx(b.y)+.5;
    const box=(color,a,h,d,w,t,l)=>batch.box(color,x+a,h,z+d,w,t,l);
    box(0xdad4be,0,.045,0,1.98,.08,1.98);
    // Main hall, outdoor court and shared entrance plaza fill one 2x2 site.
    box(0xe5dcc5,-.39,.35,-.25,.95,.60,1.12);
    batch.add('dome',0x70998e,x-.39,.64,z-.25,1.04,.48,1.19);
    box(0x678f8b,-.39,.28,.322,.50,.36,.02);
    for(const d of [-.60,-.28,.04])box(0x86aaa5,.095,.38,d,.018,.18,.16);
    box(0x89a885,.49,.10,-.12,.67,.035,1.22);
    for(const a of [.20,.78])box(0xf1eddb,a,.124,-.12,.014,.008,1.10);
    for(const d of [-.67,-.12,.43])box(0xf1eddb,.49,.124,d,.58,.008,.014);
    for(const d of [-.70,.46]){
      box(0x788b7f,.49,.35,d,.025,.46,.025);
      box(0xe9e4ce,.49,.58,d,.27,.16,.025);
      box(0xbd8b57,.49,.50,d+(d<0?.08:-.08),.11,.018,.12);
    }
    box(0xe9ddc3,0,.11,.69,1.70,.025,.32);
    for(const a of [-.68,.66]){
      box(0xb7b498,a,.14,.78,.26,.12,.22);
      this._tree(batch,x+a,z+.78,.48,'round',1);
    }
    this._lamp(batch,x-.85,z+.44,.06);this._lamp(batch,x+.86,z+.44,.06);
  }

  _lamp(batch, x, z, y = .02) {
    batch.add('cylinder', 0x606c66, x, y + .29, z, .017, .58, .017);
    batch.box(0x64726d, x + .048, y + .585, z, .12, .018, .018);
    batch.box(0xffefba, x + .097, y + .57, z, .064, .025, .036);
  }

  _upgradedCommunity(batch,b){
    const level=b.level,factor=1+(level-1)*.18,size=footprintSize(b);
    const proxy={
      add:(kind,c,x,y,z,w,h,d,ry=0,rx=0,rz=0)=>batch.add(kind,c,x,y*factor,z,w,h*factor,d,ry,rx,rz),
      box:(c,x,y,z,w,h,d,ry=0)=>batch.box(c,x,y*factor,z,w,h*factor,d,ry),
    };
    this._building(proxy,{...b,level:1});
    const x=wx(b.x)+(size-1)/2,z=wx(b.y)+(size-1)/2;
    const box=(c,a,y,d,w,h,l)=>batch.box(c,x+a,y,z+d,w,h,l);
    const outdoor=['stadium','sportsHall'].includes(b.type);
    if(outdoor){
      // Larger lighting rigs and side canopies follow the original sports campus.
      for(const side of [-1,1]){
        box(0x5c847e,side*(size*.40),.84*factor,-.05,.18,.065,size*.65);
        for(const d of [-.50,.50]){
          box(0x7f9089,side*(size*.42),.53*factor,d,.025,1.02*factor,.025);
          box(0xe7ddbc,side*(size*.42),1.05*factor,d,.16,.07,.06);
        }
      }
      if(level>=3)box(0x426b6b,0,.79*factor,-size*.38,.48,.24,.055);
      if(level>=4)box(0xdfc690,0,1.00*factor,-size*.38,.64,.05,.08);
    }else if(['operaStage','chessPavilion'].includes(b.type)){
      for(const a of [-size*.40,size*.40]){
        box(0x8e6952,a,.30,0,.035,.55,.035);
        batch.add('cylinder',0xc38754,x+a,.57,z,.10,.15,.10);
      }
      if(level>=3)for(const a of [-size*.35,size*.35]){box(0xc4b58d,a,.12,size*.35,.23,.12,.18);this._tree(batch,x+a,z+size*.35,.38,'round',1);}
      if(level>=4)box(0xbda673,0,.11,size*.42,size*.65,.09,.12);
    }else{
      // Distinct rooftop equipment, an upper service floor, then landscaped terrace.
      const top=(b.type==='policeStation'?.75:b.type==='hospital'?1.63:b.type==='clinic'?.69:b.type==='school'?.72:.81)*factor;
      const a=b.type==='hospital'?.43:0,d=b.type==='hospital'?-.21:-.08;
      box(0xb6c9bd,a,top+.10,d,.31,.17,.24);
      box(0x577e87,a,top+.20,d,.35,.035,.29);
      if(level>=3){
        box(0xe8e0ca,a,top+.22,d,.45,.32,.34);
        for(const off of [-.14,0,.14])box(0x6a959c,a+off,top+.24,d+.177,.085,.13,.015);
        box(0x71948d,a,top+.40,d,.50,.055,.39);
      }
      if(level>=4){
        for(const off of [-.18,.18])batch.add('crown',0x74915e,x+a+off,top+.53,z+d,.15,.18,.18);
        box(0xdec898,a,top+.45,d+.20,.46,.04,.035);
      }
    }
  }

  _lateBuilding(batch,b){
    const factor=b.level===5?1.28:1.60;
    const proxy={add:(k,c,x,y,z,w,h,d,ry=0,rx=0,rz=0)=>batch.add(k,c,x,y*factor,z,w,h*factor,d,ry,rx,rz),box:(c,x,y,z,w,h,d,ry=0)=>batch.box(c,x,y*factor,z,w,h*factor,d,ry)};
    this._building(proxy,{...b,level:4});
    const x=wx(b.x)+(footprintSize(b)-1)/2,z=wx(b.y)+(footprintSize(b)-1)/2;
    const accent=b.level===5?0x96b8ae:0xd7bd82;
    for(const side of [-1,1])batch.box(accent,x+side*.38,.18,z+.38,.055,.22,.055);
    if(b.level===6)for(const side of [-1,1])batch.add('crown',0x73966a,x+side*.34,.25,z+.30,.12,.20,.12);
  }

  _marina(batch,b){
    const x=wx(b.x)+.5,z=wx(b.y)+.5,level=b.level||1,tier=level-1,shoreBatch=batch;batch=rotatedBuildingBatch(batch,x,z,b.rotation||0);
    batch.box(0xc6b893,x,.08,z,1.94,.15,1.94);
    const houseHeight=.52+Math.min(tier,3)*.12;
    batch.box(0xe9e4ce,x,houseHeight/2+.10,z-.05,.94,houseHeight,.72);
    batch.box(0x477f85,x,houseHeight+.14,z-.05,1.10,.12,.87);
    // A glass harbour-facing lobby, projecting arrival canopy and planted
    // forecourt make the clubhouse legible at the game's normal camera angle.
    for(const side of [-.30,0,.30])batch.box(0x70a4aa,x+side,.36,z+.319,.20,.31,.022);
    batch.box(0xf0e4c7,x,.25,z+.39,.34,.24,.10);
    batch.box(0x527b7d,x,.48,z+.48,.72,.08,.38);
    for(const side of [-.31,.31])batch.box(0xd4c6aa,x+side,.27,z+.48,.055,.43,.055);
    batch.box(0x8aa073,x,.12,z+.67,1.28,.10,.36);
    for(const side of [-.50,.50])batch.add('crown',0x668552,x+side,.30,z+.67,.26,.26,.26);
    for(const side of [-1,1]){batch.box(0x7b9877,x+side*.73,.18,z-.65,.24,.24,.26);batch.add('crown',0x728766,x+side*.73,.43,z-.65,.32,.38,.32);}
    if(level>=2){
      batch.box(0x6f999a,x,houseHeight+.27,z+.09,.75,.035,.36);
      for(const side of [-.31,.31])batch.box(0xe3d8bc,x+side,houseHeight+.37,z+.09,.035,.22,.32);
    }
    if(level>=3){
      batch.box(0xe7dfc8,x,houseHeight+.34,z-.12,.56,.22,.38);
      for(const side of [-.18,.18])batch.box(0x78a8a9,x+side,houseHeight+.36,z+.08,.15,.13,.018);
      batch.box(0x557a76,x,houseHeight+.49,z-.12,.68,.055,.48);
    }
    if(level>=4){
      batch.box(0xd7c7a8,x-.34,houseHeight+.62,z-.25,.15,.62,.15);
      batch.add('cylinder',0xe7c46b,x-.34,houseHeight+.97,z-.25,.20,.10,.20);
      batch.add('cone',0xc96d50,x-.34,houseHeight+1.09,z-.25,.18,.20,.18);
    }
    if(level>=5)for(const side of [-.42,.42]){
      batch.box(0xd9cfb5,x+side,houseHeight+.58,z+.14,.035,.34,.42);
      batch.box(0x769b8c,x+side,houseHeight+.77,z+.14,.16,.045,.50);
    }
    if(level>=6){batch.box(0xecdca9,x+.35,houseHeight+.98,z-.24,.035,.55,.035);batch.box(0xc86e56,x+.47,houseHeight+1.12,z-.24,.22,.13,.025);}
    batch=shoreBatch;
    for(const i of marinaBerths(this.state,b)){
      const {x:a,y:d}=gridPoint(this.state,i),edgeX=Math.max(b.x,Math.min(b.x+1,a)),edgeY=Math.max(b.y,Math.min(b.y+1,d));
      const px=(wx(a)+wx(edgeX))/2,pz=(wx(d)+wx(edgeY))/2,horizontal=a!==edgeX,distance=Math.max(Math.abs(a-edgeX),Math.abs(d-edgeY)),length=Math.max(.72,distance-.28);
      batch.box(0xb19872,px,.24,pz,horizontal?length:.16,.07,horizontal?.16:length);
      batch.box(0x6b7f72,wx(a),.29,wx(d),.06,.13,.06);
      if(level>=3)batch.box(0xe4d9b7,wx(a),.34,wx(d),horizontal?.24:.08,.025,horizontal?.08:.24);
    }
  }

  _syncYachts(reset=false){
    this.yachtEntries=yachtRoutes(this.state);
    if(reset)this.yachtClock=this.state.tick*3;
    this.yachtClock=Math.max(this.yachtClock||0,this.state.tick*3);
    const key=this.yachtEntries.map(e=>e.boat.id+':'+e.boat.kind).join('|');
    if(key!==this.yachtKey){
      for(const a of this.yachts||[]){this.scene.remove(a.model);a.model.userData.dispose();}
      this.yachts=this.yachtEntries.map(entry=>{const model=createYachtModel(entry.boat.kind);this.scene.add(model);return {id:'yacht-'+entry.boat.id,yachtId:entry.boat.id,kind:'yacht',position:new THREE.Vector3(),model};});this.yachtKey=key;
    }
    this._animateYachts(0);
  }
  _animateYachts(delta){
    this.yachtClock=(this.yachtClock||0)+delta;
    for(let i=0;i<(this.yachts||[]).length;i++)updateYachtActor(this.yachts[i],this.yachtEntries[i],this.yachtClock,!!this.roadFocus,this.nightBlend);
  }

  _largeUtility(batch,b){
    const x=wx(b.x)+.5,z=wx(b.y)+.5,level=b.level||1;
    const edge=(dx,dy)=>[0,1].some(i=>this._tile(b.x+dx(i),b.y+dy(i))?.road);
    const front=edge(i=>i,()=>2)?0:edge(()=>2,i=>i)?1:edge(i=>i,()=>-1)?2:edge(()=>-1,i=>i)?3:0;
    if(front)batch=rotatedBuildingBatch(batch,x,z,front);
    const box=(c,a,h,d,w,height,depth)=>batch.box(c,x+a,h,z+d,w,height,depth);
    const shape=(kind,c,a,h,d,w,height,depth)=>batch.add(kind,c,x+a,h,z+d,w,height,depth);
    const teal=b.active===false?0x89918b:0x568c91,height=.56+(level-1)*.15;
    box(0xc9c8b3,0,.04,0,1.94,.07,1.94);
    box(0xe2dcc6,-.43,.09+height/2,-.33,.75,height,.93);
    box(teal,-.43,height+.12,-.33,.83,.07,1.01);
    for(let i=0;i<3;i++)box(0x527b81,-.67+i*.23,.36,.145,.14,.20,.025);
    box(0xe5decb,-.43,.15,.44,.62,.18,.30);
    box(teal,-.43,.26,.44,.68,.045,.36);
    if(b.type==='power'){
      // A turbine hall, paired transformer banks and a solar roof share one yard.
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(0x4d7987,-.67+col*.24,height+.17,-.65+row*.30,.20,.035,.24);
      for(const d of [-.54,.10]){
        box(0x93a699,.44,.29,d,.60,.42,.44);
        for(const a of [.26,.60])shape('cylinder',0x49696a,a,.63,d,.07,.30,.07);
        for(let i=0;i<5;i++)box(0x647d74,.44,.27,d-.19+i*.09,.65,.25,.025);
      }
      box(0xbac4b4,-.64,height+.42,-.59,.16,.58,.16);
      box(teal,-.64,height+.73,-.59,.23,.055,.23);
      for(const a of [.22,.44,.66])box(0xd8bb7c,a,.21,.64,.13,.26,.20);
    }else{
      // Open settling basins and a storage tank distinguish the larger waterworks.
      for(const d of [-.52,.22]){
        shape('cylinder',0xaebfb5,.44,.25,d,.72,.34,.72);
        shape('cylinder',b.active===false?0x90a4a3:0x68b0bd,.44,.425,d,.60,.025,.60);
        box(0xe3e0cb,.44,.46,d,.67,.035,.055);
        shape('cylinder',teal,.44,.50,d,.10,.10,.10);
      }
      shape('cylinder',0xe2e4d0,-.43,height+.40,-.39,.49,.51,.49);
      shape('cylinder',teal,-.43,height+.48,-.39,.505,.08,.505);
      shape('dome',0xece9d7,-.43,height+.66,-.39,.51,.18,.51);
      box(teal,.04,.18,.65,1.26,.10,.09);
    }
    for(const a of [-.92,.92])box(0x9eaf9d,a,.20,0,.025,.30,1.84);
    box(0x9eaf9d,0,.20,-.92,1.84,.30,.025);
    for(const a of [-.67,.67])box(0x9eaf9d,a,.20,.92,.48,.30,.025);
    box(0xe6d39b,0,.09,.84,.46,.035,.19);
    if((b.progress??1)<1)for(const a of [-.84,.84]){
      box(0xc8a46b,a,.58,-.78,.035,1.08,.035);
      box(0xc8a46b,a,.58,.70,.035,1.08,.035);
      box(0xc8a46b,a,1.10,-.04,.035,.035,1.52);
    }
  }

  _landmark(batch,b){
    const size=footprintSize(b),x=wx(b.x)+(size-1)/2,z=wx(b.y)+(size-1)/2;
    if((b.progress??1)<1&&(b.level||1)===1){this._construction(batch,b,x,z,b.progress);return;}
    const visual={...b,level:completedLandmarkLevel(b)||1,progress:1};
    if(LANDMARKS[b.type].footprint)this._worldLandmark(batch,visual);
    else{
      const scale=landmarkScale(visual),proxy={
        box:(c,a,y,d,w,h,l,ry=0)=>batch.box(c,a,y*scale,d,w,h*scale,l,ry),
        add:(k,c,a,y,d,w,h,l,...rotation)=>batch.add(k,c,a,y*scale,d,w,h*scale,l,...rotation),
      };
      this._building(proxy,visual,size,true);
    }
    if(b.active!==false&&!LANDMARKS[b.type].footprint){
      const scale=landmarkScale(visual),{gold,cyan}=LANDMARK_LIGHT_COLORS;
      if(b.type==='lighthouse')batch.add('cylinder',gold,x,1.52*scale,z,.31,.28*scale,.31);
      else if(b.type==='observatory')batch.add('cylinder',cyan,x,.77*scale,z,.80,.025,.80);
      else if(b.type==='pagoda')for(let i=0;i<3;i++)for(const side of [-1,1]){
        const width=.68-i*.12,h=(.48+i*.54)*scale;
        batch.box(gold,x,h,z+side*width*.53,width*1.08,.025,.025);
        batch.box(gold,x+side*width*.53,h,z,.025,.025,width*1.08);
      }
      else if(b.type==='museum')for(const side of [-1,1])batch.box(cyan,x+side*.23,(side<0?.57:.83)*scale,z+.42,.43,.035,.025);
      else if(b.type==='landmark')batch.box(gold,x,1.45*scale,z+.216,.22,.22*scale,.018);
    }
    if(visual.level>=2)for(const a of [-1,1])for(const d of [-1,1]){
      const corner=size*.40;
      batch.box(0xd7bd82,x+a*corner,.16,z+d*corner,.09,.25,.09);
      batch.box(b.active===false?0x778789:LANDMARK_LIGHT_COLORS.gold,x+a*corner,.31,z+d*corner,.12,.08,.12);
      if(visual.level>=3)batch.box(b.active===false?0x778789:LANDMARK_LIGHT_COLORS.gold,x+a*corner,.09,z,.025,.04,size*.78);
    }
    if((b.progress??1)<1){
      for(const side of [-1,1])batch.box(0xc8a46b,x+side*size*.43,.62,z-size*.4,.04,1.16,.04);
      batch.box(0xc8a46b,x,1.18,z-size*.4,size*.9,.04,.04);
    }
  }

  _building(batch, b, frontageSize=footprintSize(b),landmarkModel=false) {
    if(b.type==='marina'){
      if((b.progress??1)<1)this._construction(batch,b,wx(b.x)+.5,wx(b.y)+.5,b.progress);
      else this._marina(batch,b);
      return;
    }
    if(b.rotation){const size=footprintSize(b);this._building(rotatedBuildingBatch(batch,wx(b.x)+(size-1)/2,wx(b.y)+(size-1)/2,b.rotation),{...b,rotation:0});return;}
    if(LANDMARKS[b.type]&&!landmarkModel){this._landmark(batch,b);return;}
    if(['power','water'].includes(b.type)&&footprintSize(b)===2){this._largeUtility(batch,b);return;}
    if(['residential','commercial','industrial'].includes(b.type)&&footprintSize(b)>1){
      const scale=footprintSize(b),x=wx(b.x),z=wx(b.y),offset=(scale-1)/2;
      const proxy={
        box:(c,a,y,d,w,h,l,ry=0)=>batch.box(c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,ry),
        add:(k,c,a,y,d,w,h,l,ry=0,rx=0,rz=0)=>batch.add(k,c,x+(a-x)*scale+offset,y,z+(d-z)*scale+offset,w*scale,h,l*scale,ry,rx,rz),
      };
      this._building(proxy,{...b,footprint:1},scale);return;
    }
    if(b.type==='plaza'&&footprintSize(b)===2){this._largeGarden(batch,b);return;}
    if(b.level>4&&!COMMUNITY_BUILDINGS[b.type]&&b.businessKind!=='courtyard'&&b.businessKind!=='office'&&!businessKind(b.businessKind)?.architecture&&(b.progress??1)>=1){this._lateBuilding(batch,b);return;}
    if(COMMUNITY_BUILDINGS[b.type]&&(b.progress??1)<1){this._construction(batch,b,wx(b.x)+(footprintSize(b)-1)/2,wx(b.y)+(footprintSize(b)-1)/2,b.progress);return;}
    if(['grandStadium','grandGallery','shoppingComplex'].includes(b.type)){this._metropolitanFacility(batch,b);return;}
    if(COMMUNITY_BUILDINGS[b.type]?.category==='religion'){drawReligiousBuilding(batch,b);return;}
    if(b.type==='districtOffice'){this._districtOffice(batch,b);return;}
    if(COMMUNITY_BUILDINGS[b.type]&&b.level>1){this._upgradedCommunity(batch,b);return;}
    if(DECORATIONS[b.type]){this._decoration(batch,b);return;}
    if(['operaStage','chessPavilion'].includes(b.type)){this._chineseLeisure(batch,b);return;}
    if(b.type==='cityHall' && footprintSize(b)===2){this._cityHallCampus(batch,b);return;}
    if(['hospital','stadium'].includes(b.type)){this._largeCommunity(batch,b);return;}
    if(b.type==='sportsHall' && footprintSize(b)===2){this._sportsCampus(batch,b);return;}
    const x = wx(b.x), z = wx(b.y);
    const seed = rnd(b.id, b.variant || 0, 8);
    const progress = b.progress ?? 1;
    const level = b.level || 1;
    if (progress < 1) { this._construction(batch, b, x, z, progress); return; }
    if(b.businessKind==='courtyard'){this._courtyardEstate(batch,b);return;}
    // Local coordinates turn the frontage towards its actual adjoining street.
    const roadOnEdge=cell=>Array.from({length:frontageSize},(_,i)=>cell(i)).some(([x,y])=>this._tile(x,y)?.road);
    const front = roadOnEdge(i=>[b.x+i,b.y+frontageSize]) ? 0 : roadOnEdge(i=>[b.x+frontageSize,b.y+i]) ? Math.PI / 2 : roadOnEdge(i=>[b.x+i,b.y-1]) ? Math.PI : roadOnEdge(i=>[b.x-1,b.y+i]) ? -Math.PI / 2 : 0;
    const local = (kind, c, a, h, d, sx, sy, sz, rotation = 0, rx = 0, rz = 0) => {
      const px = x + a * Math.cos(front) + d * Math.sin(front);
      const pz = z - a * Math.sin(front) + d * Math.cos(front);
      batch.add(kind, c, px, h, pz, sx, sy, sz, front + rotation, rx, rz);
    };
    const box = (c, a, h, d, sx, sy, sz, rotation = 0) => local('box', c, a, h, d, sx, sy, sz, rotation);
    const windows = (width, height, depth, floors, count, centerX = 0, centerZ = 0) => {
      const win = b.active === false ? 0x8b928a : COLORS.glass;
      for (let floor = 0; floor < floors; floor++) {
        for (let i = 0; i < count; i++) {
          const a = centerX + (i - (count - 1) / 2) * (width / (count + .4));
          const h = .16 + floor * (height / floors) + height / floors * .22;
          box(win, a, h, centerZ + depth / 2 + .005, .10, .14, .013);
          box(0xf3e9ce, a, h - .083, centerZ + depth / 2 + .012, .125, .026, .039);
          box(win, centerX + width / 2 + .006, h, centerZ + (i - (count - 1) / 2) * (depth / (count + .3)), .014, .14, .10);
          if (level >= 2) box(win, centerX - width / 2 - .006, h, centerZ + (i - (count - 1) / 2) * (depth / (count + .3)), .014, .14, .10);
        }
      }
    };
    const bushes = () => {
      for (const s of [-1, 1]) local('crown', 0x5b8050, s * .33, .12, .34, .18, .19, .17);
    };

    if(businessKind(b.businessKind)?.architecture){
      if(b.type==='industrial')drawSpecialtyFactory(b,local,box);
      else if(b.type==='commercial')drawSpecialtyShop(b,local,box);
      else drawSpecialtyHome(b,local,box);
      return;
    }
    if(businessKind(b.businessKind)?.chinese){this._chinesePrivate(b,local,box);return;}
    if(b.businessKind){this._businessBuilding(b,local,box);return;}
    if(['residential','commercial','industrial'].includes(b.type)&&buildingStyle(b).index){this._styledPrivate(b,local,box);return;}
    if ((level >= 3 && ['residential', 'commercial', 'industrial'].includes(b.type)) || (level >= 2 && ['power', 'water', 'fireStation', 'cityHall'].includes(b.type))) {
      this._advancedBuilding(b, local, box);
      return;
    }

    if (b.type === 'residential') {
      batch.box(0x98ad74, x, .019, z, .96, .022, .96);
      const wallColors = [0xf1dfb9, 0xe6d8bd, 0xd8cab0, 0xe9d5bb, 0xcbd3c4];
      const wall = wallColors[Math.floor(seed * wallColors.length)];
      const roof = residentialRoof(b).color;
      if (level >= 2) {
        const height = 1.1 + Math.floor(seed * 3) * .25;
        box(COLORS.sidewalk, 0, .05, 0, .89, .075, .86);
        box(wall, -.045, height / 2 + .09, -.04, .64, height, .63);
        box(0xf4e8cc, -.045, height + .1, -.04, .72, .06, .71);
        box(roof, -.045, height + .135, -.04, .59, .015, .59);
        box(0xbac0af, .11, height + .22, -.16, .20, .15, .23);
        windows(.64, height, .63, Math.floor(height / .30), 3, -.045, -.04);
        for (let j = 1; j < height / .3; j++) box(0xeaddc2, -.045, .10 + j * .30, .304, .70, .035, .10);
        box(0x5a706c, -.02, .19, .283, .16, .25, .02);
        bushes();
      } else {
        const height = seed > .48 ? .55 : .38;
        const width = seed > .77 ? .51 : .62;
        box(wall, -.03, .05 + height / 2, -.055, width, height, .53);
        box(0xf7e7c6, -.03, height + .064, -.055, width + .09, .045, .60);
        local('roof', roof, -.03, height + .082, -.055, width + .14, .25, .64);
        windows(width, height, .53, height > .5 ? 2 : 1, 2, -.03, -.055);
        box(0x735d49, -.03, .154, .218, .10, .20, .021);
        box(0xd2c3a5, -.03, .049, .32, .14, .035, .24);
        box(0xdfcfad, -.03, .21, .30, .21, .025, .17);
        local('cylinder', 0xe7d9ba, -.11, .12, .34, .022, .19, .022);
        local('cylinder', 0xe7d9ba, .05, .12, .34, .022, .19, .022);
        box(0x9d826c, -.15, height + .23, -.16, .07, .22, .07);
        if (seed > .67) {
          box(wall, .30, .175, -.11, .23, .29, .39);
          local('roof', roof, .30, .325, -.11, .26, .13, .43);
        }
        bushes();
        if (seed < .34) this._tree(batch, x + .34, z - .32, .41, 'round', Math.floor(seed * 8));
        // A short white garden fence, with an opening at the front door.
        for (const a of [-.43, .43]) box(0xe9e2c8, a, .105, -.015, .023, .15, .86);
        box(0xe9e2c8, 0, .105, -.43, .86, .15, .023);
      }
    } else if (b.type === 'commercial') {
      box(0xd8d2bc, 0, .04, 0, .98, .05, .98);
      const height = level >= 2 ? 1.0 + seed * .24 : .39 + (seed > .65 ? .28 : 0);
      box(seed > .5 ? 0xdccbad : 0xe5d5bc, 0, height / 2 + .05, -.03, .73, height, .68);
      box(0x526f76, 0, .21, .317, .61, .24, .018);
      for (const a of [-.30, -.10, .10, .30]) box(0xe5d7ba, a, .21, .331, .025, .25, .026);
      box(0xf4dfac, 0, .39, .331, .68, .09, .035);
      box(seed > .5 ? 0x4e8c8b : 0x567f8a, 0, .345, .41, .77, .055, .19);
      for (let i = 0; i < 5; i++) box(0xdfddd0, -.32 + i * .16, .376, .412, .08, .008, .19);
      box(0xece3cb, 0, height + .08, -.03, .80, .07, .75);
      box(0x9caa9f, 0, height + .12, -.03, .68, .012, .62);
      box(0xb6b7a3, -.17, height + .17, -.11, .19, .11, .17);
      if (height > .6) windows(.73, height - .35, .68, level >= 2 ? 3 : 1, 3, 0, -.03);
      for (const a of [-.4, .4]) { local('cylinder', 0x785f44, a, .06, .37, .08, .1, .08); local('crown', 0x608856, a, .18, .37, .18, .22, .17); }
    } else if (b.type === 'industrial') {
      box(0xbcbaa0, 0, .029, 0, .96, .04, .96);
      const height = level >= 2 ? .62 : .37;
      box(0xc8c7b3, -.05, height / 2 + .055, -.05, .73, height, .66);
      for (let i = 0; i < 3; i++) {
        local('roof', 0x9ea89f, -.29 + i * .235, height + .055, -.05, .25, .13, .72);
        box(0x7e9692, -.24 + i * .235, height + .10, .314, .13, .035, .012);
      }
      for (let i = 0; i < 3; i++) box(0x728282, -.27 + i * .23, .18, .285, .14, .19, .02);
      local('cylinder', 0xa38972, .30, .43, -.27, .10, .78, .10);
      local('cylinder', 0xe0d3b6, .30, .65, -.27, .106, .06, .106);
      local('cylinder', 0x5f6861, .30, .825, -.27, .12, .06, .12);
      box(0xbd8b57, -.24, .10, .38, .23, .11, .13);
      box(0x547b7d, .13, .12, .36, .27, .14, .13);
      if (level >= 2) { local('cylinder', 0xc1c8b8, -.32, .45, -.30, .16, .80, .16); local('dome', 0xd2d5c3, -.32, .85, -.30, .17, .17, .17); }
    } else if (b.type === 'water') {
      box(0xbbbca5, 0, .035, 0, .93, .05, .93);
      for (const [a, d] of [[-.20, -.20], [.20, -.20], [-.20, .20], [.20, .20]]) box(0xa0aaa3, a, .51, d, .047, .99, .047);
      box(0xa3aaa1, 0, .35, 0, .46, .045, .46);
      local('cylinder', 0xe9e5d0, 0, 1.03, 0, .66, .44, .66);
      local('dome', 0xece9d7, 0, 1.25, 0, .67, .27, .67);
      local('cylinder', 0x599a9c, 0, 1.09, 0, .673, .08, .673);
      box(0x7ba0a2, -.30, .5, .20, .037, .87, .037);
      for (let h = .17; h < .99; h += .10) box(0x748a85, -.28, h, .20, .10, .017, .024);
      box(0xe0d6b9, .29, .19, .26, .23, .29, .24);
      box(0x668788, .29, .347, .26, .27, .027, .28);
    } else if (b.type === 'power') {
      box(0xc6c6ad, 0, .028, 0, .96, .035, .96);
      box(0xdad6bb, -.20, .23, -.10, .39, .40, .52);
      box(0x798a81, -.20, .448, -.10, .44, .035, .57);
      box(0x567c7d, -.20, .24, .166, .21, .16, .018);
      for (let i = 0; i < 2; i++) {
        box(0x8c9b93, .20, .15, -.24 + i * .43, .28, .23, .26);
        for (const a of [.12, .28]) local('cylinder', 0x536b6b, a, .34, -.24 + i * .43, .054, .17, .054);
        for (let f = 0; f < 4; f++) box(0x647d74, .20, .12, -.36 + i * .43 + f * .06, .30, .13, .018);
      }
      for (const a of [-.46, .46]) box(0xa7b4a3, a, .17, 0, .018, .28, .95);
      box(0xa7b4a3, 0, .17, -.46, .93, .28, .018);
      local('cylinder', 0xc3c9b7, -.25, .75, -.25, .052, 1.32, .052);
      local('crown', 0xe8e7d5, -.25, 1.39, -.25, .11, .11, .11);
      for (let i = 0; i < 3; i++) {
        const angle = i * TAU / 3 + .4;
        // Small stationary wind generator gives this utility an unmistakable silhouette.
        const dx = Math.sin(angle) * .22, dy = Math.cos(angle) * .22;
        const xx = x + (-.25 + dx) * Math.cos(front) + (-.25) * Math.sin(front);
        const zz = z - (-.25 + dx) * Math.sin(front) + (-.25) * Math.cos(front);
        batch.add('box', 0xf0ebd3, xx, 1.39 + dy, zz, .046, .44, .023, front, 0, -angle);
      }
    } else if (b.type === 'fireStation') {
      const red = b.active === false ? 0x906e61 : 0xb8503f;
      const glass = b.active === false ? 0x89918b : 0x486f76;
      box(0xd0cbb4, 0, .043, 0, .97, .064, .97);
      box(0xe4d8bd, .015, .282, -.075, .76, .44, .59);
      box(red, .015, .445, .225, .78, .105, .035);
      box(0x9f9680, .015, .515, -.075, .81, .055, .65);
      box(0xbebcaa, .015, .55, -.075, .73, .025, .56);
      // Two fire-appliance bays: a shuttered garage and an open garage with a
      // reserve appliance. The travelling drill appliance is a separate mesh.
      for (const a of [-.175, .185]) {
        box(0xddd1b6, a, .214, .237, .30, .31, .029);
        box(a < 0 ? red : 0x344741, a, .207, .258, .262, .270, .018);
        if (a < 0) for (let j = 0; j < 5; j++) box(0xd2997f, a, .111 + j * .042, .269, .245, .008, .007);
      }
      box(0xf6ead1, .015, .445, .248, .125, .026, .017);
      box(0xf6ead1, .015, .445, .249, .027, .073, .018);
      // Hose-drying tower, observation windows and a compact aerial mast.
      box(0xc3aa8d, -.265, .582, -.245, .25, 1.04, .27);
      box(red, -.265, 1.098, -.245, .29, .047, .31);
      for (let h = .58; h < 1.01; h += .145) {
        box(glass, -.265, h, -.102, .10, .080, .013);
        box(glass, -.132, h, -.245, .013, .080, .13);
      }
      local('cylinder', 0x8a9085, -.265, 1.195, -.245, .016, .17, .016);
      box(0xe2d5b7, .303, .235, .224, .115, .26, .029);
      box(glass, .303, .265, .247, .073, .116, .015);
      // Small red truck parked in the open bay, ladder and blue beacon visible.
      box(red, .185, .143, .355, .19, .13, .30);
      box(red, .185, .175, .446, .19, .15, .12);
      box(glass, .185, .198, .509, .146, .063, .011);
      box(0xf0ddbb, .185, .134, .514, .196, .033, .018);
      for (const side of [-1, 1]) {
        box(0x39443e, .185 + side * .103, .094, .258, .033, .061, .045);
        box(0x39443e, .185 + side * .103, .094, .445, .033, .061, .045);
        box(0xc2c5b4, .185 + side * .055, .222, .321, .014, .016, .235);
      }
      for (let rung = 0; rung < 4; rung++) box(0xcbd0be, .185, .222, .23 + rung * .060, .12, .016, .014);
      box(b.active === false ? 0x839294 : 0x59a6ba, .185, .264, .447, .12, .027, .033);
      local('cylinder', red, -.385, .12, .385, .064, .14, .064);
    } else if (b.type === 'cityHall') {
      const flag = b.active === false ? 0x8c9989 : 0x3d9381;
      const glass = b.active === false ? 0x969d8e : 0x496d75;
      box(0xc9c4aa, 0, .043, 0, .98, .062, .97);
      box(0xe9dcc1, 0, .37, -.07, .73, .59, .55);
      box(0xd3c3a1, 0, .10, .295, .84, .058, .28);
      box(0xe5d8bb, 0, .072, .402, .91, .045, .125);
      box(0x839488, 0, .697, -.07, .80, .063, .62);
      local('roof', 0x6c877d, 0, .728, -.07, .84, .22, .66);
      box(glass, 0, .274, .216, .155, .31, .019);
      for (const a of [-.264, -.088, .088, .264]) {
        local('cylinder', 0xf1e6ca, a, .358, .330, .048, .425, .048);
        box(0xeee2c6, a, .144, .330, .071, .036, .069);
        box(0xeee2c6, a, .575, .330, .075, .040, .074);
      }
      box(0xf0e4c6, 0, .613, .327, .83, .077, .238);
      local('roof', 0xe0cdae, 0, .653, .327, .84, .18, .246);
      for (const a of [-.243, .243]) {
        box(glass, a, .341, .219, .096, .19, .014);
        box(0xf1e5c6, a, .233, .225, .125, .032, .038);
      }
      for (const d of [-.235, -.055, .12]) box(glass, .372, .35, d, .014, .21, .10);
      // Square clock tower above the portico, with a hipped copper roof.
      box(0xece0c2, 0, 1.03, -.08, .25, .40, .27);
      box(0xd3bf94, 0, 1.242, -.08, .32, .057, .33);
      box(0x48665f, 0, 1.094, .060, .164, .166, .014);
      box(0xf5ecd2, 0, 1.092, .070, .020, .118, .014);
      box(0xf5ecd2, .027, 1.092, .071, .070, .020, .014);
      box(0x48665f, .131, 1.094, -.08, .014, .166, .164);
      box(0xf5ecd2, .141, 1.092, -.08, .014, .118, .020);
      box(0xf5ecd2, .142, 1.092, -.053, .014, .020, .070);
      local('cone', 0x617f70, 0, 1.393, -.08, .44, .264, .44, Math.PI / 4);
      local('cylinder', 0xb29963, .317, 1.122, -.257, .015, .72, .015);
      box(flag, .413, 1.411, -.257, .194, .115, .018);
      box(0xf4e6be, .380, 1.411, -.244, .025, .076, .008);
      for (const side of [-1, 1]) local('crown', 0x718e58, side * .401, .153, .251, .12, .18, .12);
    } else if (b.type === 'park' || b.type === 'plaza') {
      const plaza = b.type === 'plaza';
      box(plaza ? 0xd4ccb0 : 0x83a063, 0, .025, 0, .98, .034, .98);
      box(0xd5c7a5, 0, .047, 0, .17, .019, .98);
      box(0xd5c7a5, 0, .047, 0, .98, .019, .17);
      if (plaza) {
        local('cylinder', 0xc8c5af, 0, .08, 0, .48, .10, .48);
        local('cylinder', 0x70adb0, 0, .14, 0, .38, .025, .38);
        local('cylinder', 0xded7be, 0, .23, 0, .068, .22, .068);
        local('dome', 0xbcd0c2, 0, .34, 0, .18, .07, .18);
      }
      for (const [a, d, v] of [[-.29, -.29, 0], [.29, -.29, 1], [-.29, .29, 2], [.29, .29, 3]]) {
        if (plaza && v === 2) continue;
        const px = x + a * Math.cos(front) + d * Math.sin(front), pz = z - a * Math.sin(front) + d * Math.cos(front);
        this._tree(batch, px, pz, plaza ? .48 : .55 + v * .06, 'round', v);
      }
      for (const a of [-.30, .30]) { box(0x956d48, a, .115, .11, .23, .034, .075); box(0x9f7851, a, .17, .15, .23, .10, .026); }
      this._lamp(batch, x + .4, z + .4);
      this._gardenUpgrades(batch,x,z,b.type,b.level,1);
    } else if (b.type === 'policeStation') {
      box(0xd6dce0,0,.05,0,.94,.08,.94);
      box(0xe9eceb,0,.37,-.06,.78,.62,.64);
      box(0x315d91,0,.71,-.06,.86,.08,.72);
      for(const a of [-.25,.25])for(const h of [.25,.49])box(0x517c98,a,h,.268,.14,.14,.018);
      box(0x315d91,0,.26,.28,.16,.34,.025);
      box(0x315d91,0,.59,.28,.29,.12,.025);
      local('cylinder',0xe7ca78,0,.59,.301,.074,.025,.074,0,Math.PI/2);
      box(0x677886,.30,.86,-.23,.018,.30,.018);
      box(0x315d91,-.27,.15,.36,.22,.075,.12);
      box(0xd84c43,-.31,.205,.36,.045,.03,.06);box(0x4e94cc,-.23,.205,.36,.045,.03,.06);
    } else if (b.type === 'busStop') {
      box(0xd8d5c5,0,.05,0,.94,.08,.94);
      box(0x46a58c,0,.51,-.05,.86,.065,.47);
      for(const a of [-.36,.36])box(0x567770,a,.28,-.18,.025,.45,.025);
      box(0x99bcc0,0,.29,-.265,.72,.34,.018);
      for(const a of [-.22,0,.22])box(0x607b75,a,.29,-.25,.018,.36,.025);
      box(0x9a754e,0,.17,-.10,.60,.045,.12);box(0x9a754e,0,.23,-.16,.60,.12,.025);
      box(0x567770,.36,.27,.30,.024,.48,.024);
      box(0x46a58c,.36,.48,.30,.18,.15,.025);
      box(0xf4e5b9,.36,.48,.318,.12,.055,.010);
      box(0x315d91,-.30,.32,-.24,.12,.18,.025);
    } else if (b.type === 'school') {
      box(0xd5ccb1,0,.05,0,.95,.08,.95);
      box(0xe7d5a9,-.20,.34,-.12,.43,.56,.62);
      box(0xc28360,-.20,.65,-.12,.48,.08,.68);
      for(const h of [.23,.46])for(const d of [-.30,-.07,.16])box(0x668b8b,.022,h,d,.016,.13,.11);
      box(0x87a57a,.25,.103,.04,.34,.025,.70);
      for(const a of [.10,.40])box(0xece6cf,a,.123,.04,.013,.008,.58);
      for(const d of [-.25,.33])box(0xece6cf,.25,.123,d,.30,.008,.013);
      box(0x7a8a7e,.40,.47,-.37,.018,.76,.018);box(0xc67a5b,.31,.77,-.37,.18,.12,.016);
    } else if (b.type === 'clinic') {
      box(0xd8d4bd,0,.05,0,.94,.08,.94);box(0xf0e8d7,0,.32,0,.74,.52,.66);
      box(0x8bb6b1,0,.62,0,.83,.08,.76);
      for(const a of [-.23,.23])box(0x789e9b,a,.34,.339,.15,.19,.016);
      box(0x577d78,0,.24,.34,.14,.32,.02);
      box(0xfaf2df,0,.77,0,.29,.27,.10);
      box(COLORS.medical,0,.78,.058,.16,.045,.018);box(COLORS.medical,0,.78,.058,.045,.16,.018);
    } else if (b.type === 'library') {
      box(0xd6cdb6,0,.05,0,.94,.08,.94);box(0xdac4a2,0,.38,-.07,.80,.64,.62);
      box(0x779d9a,0,.38,.255,.69,.43,.026);
      for(const a of [-.26,0,.26])box(0xe9ddbd,a,.39,.275,.03,.49,.025);
      box(0xf0e4c8,0,.76,0,.92,.10,.84);
      for(const a of [-.34,.34])box(0xbda682,a,.33,.37,.045,.55,.045);
      for(const a of [-.16,-.08,0,.08,.16])box(0xb98e59,a,.85,-.1,.05,.12,.22);
    } else if (b.type === 'sportsHall') {
      box(0xd5cbb0,0,.05,0,.96,.08,.96);box(0xe4d9ba,0,.26,0,.82,.36,.74);
      local('dome',0x73968e,0,.41,0,.88,.44,.80);
      box(0x557f7d,0,.24,.38,.32,.27,.025);
      for(const a of [-.30,.30])box(0x8eb1ad,a,.28,.38,.12,.16,.018);
      box(0xece5cc,.33,.55,.41,.16,.12,.02);box(0xc68853,.33,.47,.45,.09,.02,.06);
    } else if (b.type === 'lighthouse') {
      local('cylinder',0xd4cab0,0,.08,0,.88,.14,.88);
      local('cylinder',0xeee6ce,0,.70,0,.40,1.20,.40);
      for(const h of [.45,.95]) local('cylinder',0xb7765b,0,h,0,.415,.14,.415);
      local('cylinder',0x677f76,0,1.34,0,.62,.09,.62);
      local('cylinder',0xffdc85,0,1.52,0,.30,.28,.30);
      for(const a of [-.18,.18])for(const d of [-.18,.18])box(0x4b6863,a,1.52,d,.035,.32,.035);
      local('cone',0x55756e,0,1.77,0,.61,.23,.61);
    } else if (b.type === 'pagoda') {
      box(0xd5c7a8,0,.08,0,.92,.14,.92);
      for(let i=0;i<3;i++){
        const width=.68-i*.12,h=.34+i*.54;
        box(0xe5d7b7,0,h,0,width*.72,.35,width*.72);
        for(const a of [-1,1])for(const d of [-1,1])box(0x9f5944,a*width*.37,h,d*width*.37,.044,.4,.044);
        local('cone',0x526f62,0,h+.29,0,width*1.36,.29,width*1.36,Math.PI/4);
      }
      local('cylinder',0xb89751,0,1.94,0,.03,.30,.03);
    } else if (b.type === 'museum') {
      box(0xd5cdb7,0,.06,0,.96,.10,.96);
      box(0xe9ddc3,-.23,.31,0,.36,.48,.77);box(0xe9ddc3,.23,.44,0,.36,.74,.77);
      box(0x749d9b,0,.32,0,.18,.50,.64);
      box(0xf4ead2,-.23,.57,0,.43,.07,.84);box(0xf4ead2,.23,.83,0,.43,.07,.84);
      for(const a of [-.30,.30])box(0x638684,a,.32,.391,.16,.23,.014);
      local('crown',0xc49c58,-.19,.79,0,.20,.35,.20);
    } else if (b.type === 'observatory') {
      local('cylinder',0xd9d2bd,0,.10,0,.93,.17,.93);
      local('cylinder',0xe7dec9,0,.46,0,.68,.58,.68);
      for(const a of [-.2,0,.2])box(0x6c9191,a,.49,.32,.09,.16,.026);
      local('dome',0x9cbbb7,0,.77,0,.79,.73,.79);
      box(0x405f61,0,1.04,.20,.10,.42,.12);
      local('cylinder',0xd8decb,0,1.27,.18,.12,.46,.12,0,.60);
      local('cylinder',0x466c71,0,1.47,.31,.15,.07,.15,0,.60);
    } else if (b.type === 'landmark') {
      box(0xd6cfb1, 0, .05, 0, .96, .08, .96);
      local('cylinder', 0xddd9c3, 0, .15, 0, .69, .19, .69);
      box(0xece1c3, 0, .68, 0, .35, 1.02, .35);
      box(0xd0b789, 0, 1.21, 0, .43, .09, .43);
      box(0xf3e6c4, 0, 1.43, 0, .39, .37, .39);
      local('cone', 0x648979, 0, 1.78, 0, .59, .45, .59, Math.PI / 4);
      local('cylinder', 0xb6944e, 0, 2.06, 0, .025, .21, .025);
      box(0x60716b, 0, 1.45, .201, .21, .21, .016);
      box(0xeee7c6, 0, 1.45, .213, .024, .14, .014);
      box(0xeee7c6, .04, 1.45, .213, .09, .024, .014);
    }
  }

  _rowBuilding(batch,g){
    if(g.businessKind==='courtyard'){this._courtyardEstate(batch,g);return;}
    const n=g.members.length,h=rowBuildingHeight(g),s=buildingStyle(g.styleBuilding);
    const x=wx(g.x)+g.dx*(n-1)/2,z=wx(g.y)+g.dy*(n-1)/2,angle=g.face*Math.PI/2;
    const local=(kind,c,a,y,d,w,t,l)=>batch.add(kind,c,x+a*Math.cos(angle)+d*Math.sin(angle),y,z-a*Math.sin(angle)+d*Math.cos(angle),w,t,l,angle);
    const box=(c,a,y,d,w,t,l)=>local('box',c,a,y,d,w,t,l);
    const width=n-.12,industrial=g.type==='industrial',commercial=g.type==='commercial';
    box(0xd6d1b9,0,.045,0,n-.025,.07,.94);
    // One continuous base, facade and roof span the complete row.
    box(s.wall,0,h/2+.07,-.04,width,h,.70);
    box(s.trim,0,.12,.34,width,.12,.10);
    box(s.roof,0,h+.10,-.04,width+.035,.07,.76);
    const floors=industrial?1:g.level+1;
    for(let floor=0;floor<floors;floor++){
      const y=industrial?.35:.25+floor*(h-.22)/floors;
      if(!industrial)box(s.trim,0,y-.10,.327,width,.035,.05);
      for(let i=0;i<n;i++)for(const off of [-.24,0,.24]){
        const a=i-(n-1)/2+off;
        box(s.glass,a,y,.317,.15,industrial?.16:.15,.018);
        box(s.glass,a,y,-.398,.15,.15,.018);
      }
    }
    for(const end of [-1,1]){
      box(s.trim,end*width/2,h/2+.07,.31,.07,h,.10);
      for(let f=0;f<floors;f++)box(s.glass,end*(width/2+.012),.25+f*(h-.22)/floors,0,.02,.15,.25);
    }
    if(industrial){
      // Shared production hall; paired loading bays or a three-bay loading court.
      for(let i=0;i<n;i++){
        const a=i-(n-1)/2;
        box(0x7b8c86,a,.25,.326,.43,.33,.035);
        box(0xc8b98d,a,.10,.40,.57,.055,.16);
        if(g.businessKind==='foodFactory'){
          local('cylinder',0xc8cec0,a,h+.26,-.10,.26,.29,.26);
          local('cone',0xaeb9ab,a,h+.45,-.10,.27,.10,.27);
        }else if(g.businessKind==='electronics'){
          for(const d of [-.22,.09])box(0x487b8b,a,h+.16,d,.70,.035,.23);
        }else if(g.businessKind==='logistics'){
          box(i%2?0xaf8266:0x719797,a,.19,.39,.29,.20,.16);
          box(0xc8d6c7,a,h+.15,-.04,.55,.03,.34);
        }else{
          box(0xa4a489,a,h+.19,-.04,.80,.12,.67);
        }
      }
      if(!['foodFactory','electronics','logistics'].includes(g.businessKind))for(const a of [-width/2+.18,width/2-.18]){
        box(0x958c79,a,h+.28,-.25,.10,.34,.10);box(0x5b6761,a,h+.46,-.25,.13,.035,.13);
      }
      box(s.trim,0,h*.7,.35,n===3?1.16:.70,.18,.045);
    }else{
      // Two-unit rows share a portico; three-unit rows gain a central pavilion.
      box(s.glass,0,.27,.342,n===3?.56:.40,.38,.05);
      box(s.trim,0,.50,.39,n===3?.94:.66,.055,.20);
      if(n===3){box(s.trim,0,h+.18,-.04,.84,.16,.75);box(s.roof,0,h+.28,-.04,.92,.05,.81);}
      if(commercial){
        for(let i=0;i<n;i++){
          const a=i-(n-1)/2;
          if(['market','cafe'].includes(g.businessKind)){
            box(g.businessKind==='market'?0x7b9a71:0xb07961,a,.43,.40,.83,.045,.22);
            box(0xc4ac7d,a,.16,.43,.47,.14,.12);
          }else box(s.glass,a,.24,.34,.66,.27,.03);
        }
        if(g.businessKind==='hotel')for(const a of [-width/2+.22,width/2-.22])local('crown',0x6e9159,a,h+.23,-.05,.29,.24,.32);
        if(g.businessKind==='office')for(const a of [-.46,.46])box(0xaebfb9,a,h+.21,-.14,.24,.16,.22);
      }else{
        for(let i=0;i<n;i++){
          const a=i-(n-1)/2;
          for(let f=1;f<floors;f++){const y=.25+f*(h-.22)/floors;box(s.trim,a,y-.07,.38,.57,.045,.17);box(s.glass,a,y+.015,.46,.55,.10,.022);}
          box(0x8a9c70,a,.13,.40,.20,.13,.13);
        }
      }
      if(s.chinese){
        if(commercial)for(let i=0;i<n;i++){const a=i-(n-1)/2;box(0x82604a,a,.49,.40,.40,.14,.025);for(const off of [-.35,.35])local('cylinder',0xb7694e,a+off,.42,.42,.10,.12,.10);}
        box(s.roof,0,h+.17,-.04,width+.06,.075,.85);
        box(s.trim,0,h+.23,-.05,width-.10,.035,.12);
      }else if(g.level>=3){
        for(const a of [-width/2+.20,width/2-.20]){box(0x799365,a,h+.15,-.04,.26,.07,.48);local('crown',0x678951,a,h+.27,-.06,.22,.24,.28);}
      }
    }
  }

  _businessBuilding(b,local,box){
    const s=buildingStyle(b), l=b.level, k=b.businessKind;
    const block=(w,d,h,a=0,z=0)=>{box(s.wall,a,h/2+.07,z,w,h,d);box(s.roof,a,h+.09,z,w+.035,.055,d+.035);};
    const glass=(w,h,d,n)=>{for(let f=0;f<n;f++)for(let i=-1;i<=1;i++){
      box(s.glass,i*w*.29,.23+f*(h-.15)/n,d/2+.012,w*.19,.12,.02);
      box(s.glass,w/2+.012,.23+f*(h-.15)/n,i*d*.29,.02,.12,d*.19);
    }};
    box(0xd4d0bb,0,.045,0,.92,.07,.92);
    if(k==='office'){drawOffice(b,local,box);return;}
    if(k==='hotel'){
      const floors=3+Math.min(6,l),floorHeight=.19,h=.31+floors*floorHeight;
      // A warm stone podium and a narrower guest-room tower give the hotel a
      // recognisable silhouette instead of another generic commercial block.
      box(0xd9c9ad,0,.18,.02,.86,.27,.76);
      box(s.trim,0,.325,.02,.91,.045,.81);
      box(s.wall,0,h/2+.31,-.08,.69,h-.31,.58);
      box(s.roof,0,h+.10,-.08,.75,.075,.64);
      for(let floor=0;floor<floors;floor++){
        const y=.43+floor*floorHeight;
        for(const a of [-.25,-.083,.083,.25])box(s.glass,a,y,.218,.115,.105,.022);
        for(const side of [-1,1])for(const d of [-.21,0,.21])box(s.glass,side*.357,y,d-.08,.022,.105,.115);
        if(floor%2===1){box(0xb98f68,-.19,y-.082,.244,.28,.025,.08);box(0xb98f68,.19,y-.082,.244,.28,.025,.08);}
      }
      // Double-height glass lobby, brass doors and a supported arrival canopy.
      box(0x6f9ea0,0,.23,.405,.42,.29,.024);
      for(const a of [-.105,.105])box(0x9b7650,a,.17,.422,.13,.21,.018);
      box(0x527b78,0,.43,.49,.68,.065,.35);
      for(const a of [-.27,.27])box(0xd9c9ad,a,.24,.49,.055,.39,.055);
      box(0xc5a674,0,.47,.333,.50,.045,.05);
      // Landscaped forecourt and a small vertical hotel sign.
      box(0xa8a58a,0,.095,.64,.62,.035,.20);
      for(const a of [-.38,.38]){box(0xb58f6c,a,.13,.60,.15,.14,.15);local('crown',0x628750,a,.27,.60,.18,.22,.18);}
      box(0xb47756,.405,Math.min(h-.02,.77),.05,.065,.48,.13);
      box(0xefdb9e,.405,Math.min(h+.12,.91),.122,.045,.22,.018);
      // Upper levels add a roof garden, lounge, pergola and finally a beacon.
      box(0x668151,0,h+.15,-.08,.58,.075,.48);
      for(const a of [-.23,.23])local('crown',0x60894e,a,h+.25,-.17,.18,.22,.18);
      if(l>=2){box(0xded6c2,0,h+.24,-.02,.33,.19,.25);box(0x709ea0,0,h+.25,.112,.29,.13,.018);}
      if(l>=3){
        for(const a of [-.24,.24])box(0x886f55,a,h+.39,-.04,.035,.31,.36);
        for(const d of [-.18,0,.18])box(0x886f55,0,h+.56,d-.04,.57,.035,.035);
      }
      if(l>=5){box(0xd6c18e,0,h+.66,-.08,.055,.26,.055);local('crown',0xe4c96f,0,h+.84,-.08,.20,.25,.20);}
      return;
    }
    if(k==='market'||k==='cafe'){
      const h=.25+l*.16;
      block(.78,.42,h,0,-.15);glass(.78,h,.12,l);
      for(let i=-1;i<=1;i++){
        const a=i*.25;
        box(k==='market'?(i===0?0xc39b60:0x718f72):0xad725c,a,.35,.19,.23,.045,.30);
        box(s.glass,a,.20,.08,.17,.20,.025);
        if(k==='market'){
          box(0xc4a777,a,.16,.29,.20,.21,.13);
          for(const d of [-.05,.04])local('crown',d<0?0xc69453:0x77a154,a+d,.29,.29,.085,.07,.08);
        }else{
          box(0xd5bf8d,a,.16,.34,.12,.035,.12);
          box(0x755f47,a,.085,.34,.025,.15,.025);
          for(const d of [-.09,.09])box(0x8c795a,a+d,.09,.34,.055,.12,.07);
        }
      }
      if(s.chinese)box(s.roof,0,h+.15,-.15,.86,.06,.53);
    }else{
      const h=.32+l*.13;
      block(.76,.61,h,0,-.06);
      for(const a of [-.24,0,.24])box(k==='electronics'?s.glass:0x7a8580,a,.21,.255,.17,.27,.022);
      if(k==='workshop'){
        for(const a of [-.23,0,.23])box(0x9a9b82,a,h+.15,-.06,.23,.10,.63,-.10);
        for(const a of [-.29,.29]){box(0x9a8c76,a,h+.30,-.26,.085,.42,.085);box(0x565e5b,a,h+.52,-.26,.10,.035,.10);}
      }else if(k==='logistics'){
        for(let i=0;i<3;i++){const a=(i-1)*.25;box([0x789c9a,0xb68262,0xb4a472][i],a,.16,.35,.21,.20,.17);for(let n=-1;n<=1;n++)box(0xd0cfb5,a+n*.055,.16,.44,.014,.17,.012);}
        for(const a of [-.22,.22])box(0xd0d6c2,a,h+.11,-.08,.17,.025,.40);
      }else if(k==='foodFactory'){
        for(const a of [-.24,0,.24]){local('cylinder',0xc4cdbd,a,h+.25,-.08,.17,.38,.17);local('cone',0xb1bbaa,a,h+.48,-.08,.18,.10,.18);}
        box(0x8b9e99,0,h+.25,.06,.64,.04,.04);
      }else{
        for(const a of [-.23,0,.23])for(const d of [-.21,0,.21])box(0x487786,a,h+.11,d-.06,.19,.035,.16);
        box(0xc4cbbd,.30,h+.20,-.27,.12,.19,.12);
      }
    }
  }

  _styledPrivate(b,local,box){
    const style=buildingStyle(b),level=b.level||1,shop=b.type==='commercial';
    const {wall,trim,roof,glass,width,depth,floors,floorHeight,chinese,index}=style;
    box(0xd3ccb7,0,.035,0,.97,.05,.97);
    if(b.type==='industrial'){
      const h=.25+level*.12;
      if(index===3){
        box(wall,0,h/2+.05,-.05,.78,h,.65);
        for(let i=0;i<3;i++){box(roof,-.25+i*.25,h+.10,-.05,.20,.05,.56);box(0x4f7889,-.25+i*.25,h+.14,-.05,.16,.02,.45);}
      }else{
        for(const a of [-.22,.22]){
          box(wall,a,h/2+.05,-.06,.37,h,.66);
          local('roof',roof,a,h+.10,-.06,.43,.18,.74);
          if(chinese)box(trim,a,h+.07,.32,.44,.035,.035);
        }
      }
      for(const a of [-.26,0,.26]){box(glass,a,.20,.282,.14,.20,.018);box(trim,a,.32,.295,.17,.024,.025);}
      local('cylinder',index===2?0x996d54:0xa4b3a6,-.33,.30+level*.13,-.33,.085,.52+level*.22,.085);
      local('cylinder',roof,-.33,.58+level*.24,-.33,.10,.04,.10);
      box(index===2?0xb99869:0x739b92,-.25,.12,.39,.26,.14,.16);
      if(level>=3){local('cylinder',trim,.32,.35,-.28,.18,.62,.18);local('dome',roof,.32,.68,-.28,.19,.14,.19);}
      return;
    }
    const base=.09,storyTop=base+floors*floorHeight;
    for(let floor=0;floor<floors;floor++){
      const inset=index===4?Math.floor(floor/2)*.026:0;
      const w=width-inset,d=depth-inset,h=base+floor*floorHeight;
      box(wall,0,h+floorHeight/2,0,w,floorHeight,d);
      for(let column=0;column<3;column++){
        const a=(column-1)*w*.27;
        box(glass,a,h+floorHeight*.56,d/2+.008,w*.17,floorHeight*.51,.016);
        box(glass,w/2+.008,h+floorHeight*.56,(column-1)*d*.27,.016,floorHeight*.51,d*.17);
      }
      if(index===3){
        for(const side of [-1,1])box(trim,side*w*.37,h+floorHeight/2,d/2+.019,.022,floorHeight,.024);
      }else{
        box(trim,0,h+.016,0,w+.05,.025,d+.05);
        if(index===4 || (!chinese&&floor%2===1)){
          box(trim,0,h+.03,d/2+.05,w+.09,.035,.16);
          box(roof,w*.30,h+.10,d/2+.055,.14,.10,.075);
        }
      }
      if(index===5&&floor>0&&floor%3===0)local('roof',roof,0,h+.01,0,w+.14,.12,d+.13);
    }
    if(chinese){
      local('roof',roof,0,storyTop+.09,0,width+.17,.23,depth+.17);
      box(roof,0,storyTop+.225,0,.035,.035,depth+.19);
      for(const side of [-1,1]){
        box(trim,side*(width/2+.035),storyTop+.02,0,.055,.07,depth+.14);
        local('roof',roof,side*(width/2+.06),storyTop+.045,0,.11,.095,depth+.20);
      }
      for(const a of [-.26,.26]){
        box(index===1?0x7b5546:trim,a,.20,depth/2+.07,.026,.29,.028);
        if(shop||level===1)local('crown',0xc57957,a,.29,depth/2+.10,.07,.09,.07);
      }
      if(level===1){
        for(const side of [-1,1])box(wall,side*.43,.13,.08,.035,.20,.69);
        for(const side of [-1,1])local('roof',roof,side*.43,.26,.08,.09,.08,.73);
      }
    }else{
      box(trim,0,storyTop+.025,0,width+.08,.06,depth+.08);
      box(roof,0,storyTop+.065,0,width-.07,.025,depth-.07);
      if(index===3){box(glass,-.12,storyTop+.15,-.09,.25,.17,.25);local('cylinder',trim,-.12,storyTop+.25,-.09,.018,.15,.018);}
      if(index===4)for(const side of [-1,1])local('crown',0x709455,side*.19,storyTop+.12,-.1,.17,.12,.15);
    }
    box(glass,0,.19,depth/2+.025,.15,.25,.025);
    if(shop){box(chinese?0x996044:index===2?0xe1b473:0x648e88,0,.31,depth/2+.085,width+.05,.065,.18);box(trim,0,.40,depth/2+.025,width*.60,.10,.022);}
    else for(const a of [-.36,.36])local('crown',0x7b995c,a,.14,.36,.13,.18,.13);
  }

  _advancedBuilding(b, local, box) {
    const level = b.level, topTier = level === 4;
    const cream = 0xe7dcc2, trim = 0xf0e6d0, teal = 0x557e7c;
    const glass = b.active === false ? 0x8c958c : 0x618d96;
    const gridWindows = (width, depth, height, floors, cx = 0, cz = 0, base = .15) => {
      for (let floor = 0; floor < floors; floor++) for (const side of [-1, 1]) for (let col = -1; col <= 1; col++) {
        const h = base + (floor + .5) * height / floors;
        box(glass, cx + col * width / 3.6, h, cz + side * (depth / 2 + .008), .09, .12, .012);
        box(glass, cx + side * (width / 2 + .008), h, cz + col * depth / 3.6, .012, .12, .09);
      }
    };
    box(0xd1ccb6, 0, .04, 0, .98, .06, .98);
    if (b.type === 'residential' || b.type === 'commercial') {
      const shop = b.type === 'commercial', height = topTier ? (shop ? 2.78 : 2.60) : (shop ? 1.65 : 2.02);
      // Broad retail podiums, residential terraces, then narrower skyline towers.
      box(cream, 0, .20, .015, .87, .33, .84);
      box(glass, 0, .21, .443, .74, .21, .018);
      box(teal, 0, .38, .015, .92, .045, .88);
      const width = topTier ? .53 : .69, depth = topTier ? .57 : .64;
      box(shop ? 0xc4d4cf : cream, -.04, .4 + height / 2, -.06, width, height, depth);
      gridWindows(width, depth, height - .07, topTier ? 10 : 7, -.04, -.06, .4);
      for (let i = 1; i < (topTier ? 10 : 7); i++) {
        const h = .4 + height * i / (topTier ? 10 : 7);
        box(shop ? teal : trim, -.04, h, -.06, width + .035, .028, depth + .035);
        if (!shop && i % 2) box(trim, -.04, h, depth / 2, width + .10, .037, .15);
      }
      box(trim, -.04, height + .42, -.06, width + .06, .05, depth + .06);
      box(shop ? (topTier ? teal : 0x87a671) : residentialRoof(b).color, -.04, height + .46, -.06, width - .09, .03, depth - .09);
      if (topTier) {
        box(teal, -.04, height + .58, -.12, .25, .22, .29);
        local('cylinder', 0xc0c5b3, -.04, height + .86, -.12, .023, .38, .023);
      } else if (shop) {
        box(0xe5c38b, .36, .50, .34, .10, .29, .13);
        box(teal, -.30, .43, .27, .22, .045, .22);
      }
      for (const a of [-.36, .36]) local('crown', 0x729257, a, .16, .39, .14, .18, .14);
    } else if (b.type === 'industrial') {
      box(0xc4cebf, -.14, .38, -.04, .53, .66, .70);
      box(teal, -.14, .73, -.04, .60, .055, .77);
      for (let i = 0; i < 4; i++) box(topTier ? 0x4e8392 : 0x96aea5, -.32 + i * .12, .77, -.06, .09, .03, .51);
      box(0xdadbc7, .27, topTier ? .65 : .48, -.24, .25, topTier ? 1.2 : .85, .28);
      gridWindows(.25, .28, topTier ? 1.1 : .75, topTier ? 5 : 3, .27, -.24);
      for (const d of [.04, .31]) {
        local('cylinder', 0xb2c5bf, .28, .35, d, .24, .56, .24);
        local('dome', 0xd8ddcd, .28, .64, d, .24, .12, .24);
      }
      for (const a of [-.29, -.07]) box(0x5b7776, a, .22, .321, .16, .29, .015);
      box(0xd7ad6f, -.19, .10, .41, .44, .11, .12);
      if (topTier) box(0xf0dec1, .27, 1.28, -.24, .33, .045, .35);
    } else if (b.type === 'power') {
      const height = .55 + (level - 2) * .23;
      box(cream, -.17, .08 + height / 2, -.07, .52, height, .65);
      box(teal, -.17, height + .11, -.07, .59, .06, .72);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box(0x4d7987, -.35 + col * .17, height + .15, -.29 + row * .21, .14, .025, .18);
      for (const d of [-.29, .08, .35]) {
        box(0x90a89b, .28, .23, d, .25, .35, .22);
        for (const a of [.21, .35]) local('cylinder', 0x4a6969, a, .49, d, .045, .20, .045);
      }
      box(glass, -.17, .29, .263, .36, .24, .018);
      if (level >= 3) {
        box(0xbdcabb, -.28, height + .36, -.21, .18, .42, .19);
        local('cylinder', 0x879e92, -.28, height + .75, -.21, .035, .36, .035);
      }
      if (topTier) for (const a of [-.40, .03]) box(0xe1c98f, a, .39, .31, .055, .55, .07);
    } else if (b.type === 'water') {
      if (level === 2) {
        for (const a of [-.23, .23]) {
          local('cylinder', 0xe2e4ce, a, .61, -.10, .37, 1.07, .37);
          local('cylinder', 0x629da5, a, .89, -.10, .382, .12, .382);
          local('dome', 0xd7dfcc, a, 1.15, -.10, .38, .18, .38);
        }
      } else {
        box(cream, -.25, topTier ? .78 : .49, -.22, .35, topTier ? 1.4 : .82, .41);
        box(teal, -.25, topTier ? 1.5 : .93, -.22, .41, .06, .47);
        gridWindows(.35, .41, topTier ? 1.25 : .7, topTier ? 5 : 3, -.25, -.22);
        for (const [a, d] of [[.22, -.24], [.22, .23], [-.23, .27]]) {
          local('cylinder', 0xc9d2c2, a, .15, d, .37, .19, .37);
          local('cylinder', 0x72b0bb, a, .255, d, .30, .022, .30);
          box(0xd9dfcf, a, .28, d, .35, .025, .035);
        }
      }
      box(0x98b1a8, 0, .12, .40, .65, .12, .10);
    } else if (b.type === 'fireStation') {
      const red = b.active === false ? 0x976e63 : 0xb95b48;
      const height = .59 + (level - 2) * .20;
      box(cream, .02, .08 + height / 2, .03, .80, height, .72);
      box(red, .02, height + .11, .03, .87, .10, .78);
      const bays = level === 2 ? 2 : 3;
      for (let i = 0; i < bays; i++) {
        const a = -.25 + i * (bays === 2 ? .47 : .25);
        box(0x4c6263, a, .23, .401, .19, .31, .024);
        box(red, a, .16, .42, .14, .13, .12);
        box(0x75b5c5, a, .25, .43, .10, .025, .03);
      }
      box(cream, -.27, .77, -.23, .22, 1.4, .25);
      for (let i = 0; i < level + 1; i++) box(glass, -.27, .47 + i * .22, -.096, .12, .12, .015);
      box(red, -.27, 1.49, -.23, .28, .065, .31);
      if (topTier) {
        local('cylinder', 0x6b8c81, .14, height + .18, .02, .42, .026, .42);
        for (const a of [.08, .20]) box(trim, a, height + .20, .02, .025, .012, .20);
        box(trim, .14, height + .20, .02, .13, .012, .025);
      }
    } else if (b.type === 'cityHall') {
      const height = .68 + (level - 2) * .39;
      for (const a of [-.28, .28]) {
        box(cream, a, .12 + height / 2, -.07, .29, height, .64);
        gridWindows(.29, .64, height - .06, level + 1, a, -.07);
        box(teal, a, height + .15, -.07, .34, .05, .69);
      }
      box(trim, 0, .25 + height / 2, -.13, .30, height + .25, .38);
      box(0xc5b590, 0, .10, .31, .86, .08, .26);
      for (const a of [-.30, -.10, .10, .30]) local('cylinder', trim, a, .37, .31, .042, .48, .042);
      box(trim, 0, .63, .30, .83, .085, .21);
      box(glass, 0, .32, .068, .17, .36, .02);
      local('dome', teal, 0, height + .40, -.13, topTier ? .48 : .40, .32, .44);
      local('cylinder', 0xb49861, 0, height + .88, -.13, .018, .45, .018);
      box(0x4c947d, .075, height + .98, -.13, .15, .10, .015);
      if (topTier) {
        box(teal, 0, height + .14, .069, .16, .16, .018);
        box(trim, 0, height + .14, .081, .014, .11, .01);
        box(trim, .025, height + .14, .083, .055, .013, .01);
      }
    }
  }

  _construction(batch, b, x, z, progress) {
    batch.box(0xccbc95, x, .035, z, .92, .06, .92);
    const height = (b.level >= 2 ? 1.2 : .55) * Math.max(.2, progress);
    batch.box(0xb1b4a1, x, height / 2 + .06, z, .60, height, .61);
    for (const a of [-.39, .39]) for (const d of [-.39, .39]) batch.box(0xac925d, x + a, .48, z + d, .024, .87, .024);
    for (let h = .2; h < .85; h += .22) {
      for (const a of [-.39, .39]) batch.box(0xc7b583, x + a, h, z, .034, .024, .83);
      for (const d of [-.39, .39]) batch.box(0xc7b583, x, h, z + d, .83, .024, .034);
    }
    batch.box(0xdfae54, x - .32, .64, z - .31, .043, 1.22, .043);
    batch.box(0xdfae54, x + .03, 1.25, z - .31, .88, .045, .043);
    batch.box(0x626b60, x + .39, 1.09, z - .31, .011, .31, .011);
    batch.box(0xeac052, x + .39, .92, z - .31, .06, .04, .06);
    batch.box(0xb27854, x + .24, .12, z + .26, .21, .13, .20);
  }

  _createMarkers() {
    this.previewMaterial = new THREE.MeshBasicMaterial({ color: 0x62bf99, transparent: true, opacity: .36, depthWrite: false });
    this.previewMesh = new THREE.InstancedMesh(this.geometries.box, this.previewMaterial, MAX_MAP_SIZE ** 2);
    this.previewMesh.count = 0;
    this.previewMesh.frustumCulled = false;
    this.previewMesh.renderOrder = 3;
    this.scene.add(this.previewMesh);
    this.previewLineMaterial = new THREE.LineBasicMaterial({ color: 0xefffe9, transparent: true, opacity: .95, depthTest: false });
    this.previewLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.previewLineMaterial);
    this.previewLines.renderOrder = 5;
    this.scene.add(this.previewLines);
    this.servicePreviewMaterial = new THREE.MeshBasicMaterial({color:0x58b9ce,transparent:true,opacity:.26,depthWrite:false,depthTest:false});
    this.servicePreviewMesh = new THREE.InstancedMesh(this.geometries.box,this.servicePreviewMaterial,MAX_MAP_SIZE**2);
    this.servicePreviewMesh.count=0;this.servicePreviewMesh.frustumCulled=false;this.servicePreviewMesh.renderOrder=2;
    this.scene.add(this.servicePreviewMesh);
    const makeRing = (color, opacity) => {
      const positions = [-.48, .105, -.48, .48, .105, -.48, .48, .105, -.48, .48, .105, .48, .48, .105, .48, -.48, .105, .48, -.48, .105, .48, -.48, .105, -.48];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
      const mesh = new THREE.LineSegments(geometry, material);
      mesh.visible = false; mesh.renderOrder = 7;
      this.scene.add(mesh);
      return mesh;
    };
    this.hoverRing = makeRing(0xffffdc, .85);
    this.selectionRing = makeRing(0xffd382, 1);
  }

  setBuildingFilter(filter){
    const next=BUILDING_FILTERS.includes(filter)?filter:null;
    if(this.buildingFilter===next)return;
    this.buildingFilter=next;
    if(this.state){this._buildCity();this.layerBuildingHighlightKey=null;this._buildLayerBuildingHighlights();this._syncUpgradeMarkers();this._updateUpgradeMarkers();this.renderer.shadowMap.needsUpdate=true;}
  }
  setRoadFocus(enabled){
    const changed=this.roadFocus!==!!enabled;
    this.roadFocus=!!enabled;
    if(changed&&this.state){this._buildCity();this.renderer.shadowMap.needsUpdate=true;}
    this.overlayGroup.visible=!this.roadFocus||this.overlay==='traffic';
    this.coverageGroup.visible=!this.roadFocus;
    if(this.layerBuildingHighlightGroup)this.layerBuildingHighlightGroup.visible=!this.roadFocus;
    if(this.signalGroup)this.signalGroup.visible=!this.roadFocus;
    for(const mesh of this.dynamicMeshes||[])mesh.visible=!this.roadFocus;
    this.vehicleLighting?.setAmount(this.nightBlend,!!this.roadFocus);
    if(this.civicEffects)this.civicEffects.visible=!this.roadFocus;
  }

  clearMoveGhost(){
    if(this.moveGhost){this._clear(this.moveGhost);this.scene.remove(this.moveGhost);this.moveGhost=null;}
    this.moveGhostId=null;
    if(this.coverageGroup)this.coverageGroup.visible=!this.roadFocus;
  }
  previewMovingBuilding(id,cell,valid){
    const b=this.state.buildings.find(b=>b.id===id);
    if(!b||!cell){this.clearMoveGhost();return;}
    if(this.moveGhostId!==id){
      this.clearMoveGhost();this.moveGhost=new THREE.Group();this.moveGhostId=id;
      const batch=new InstanceBuilder(this),garden=civicGardenGroups(this.state.buildings).get(id);
      if(garden)this._largeGarden(rotatedBuildingBatch(batch,wx(garden.x)+.5,wx(garden.y)+.5,garden.rotation),garden);
      else this._building(batch,b);
      batch.finish(this.moveGhost);
      for(const mesh of this.moveGhost.children){mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=.65;mesh.material.depthWrite=false;mesh.userData.ownMaterial=true;mesh.castShadow=false;}
      this.scene.add(this.moveGhost);
    }
    this.moveGhost.position.set(cell.x-b.x,.08,cell.y-b.y);
    for(const mesh of this.moveGhost.children)mesh.material.color.set(valid?0xc6ffe0:0xff7777);
    this.coverageGroup.visible=false;
    this.servicePreviewMaterial.color.set(valid?0x35a8c8:0xe46550);this.servicePreviewMaterial.opacity=valid ? .44 : .30;
  }
  previewMovingRoad(source,cell,valid){
    if(!source||!cell){this.clearMoveGhost();return;}
    const tile=this._tile(source.x,source.y);
    if(!tile?.road){this.clearMoveGhost();return;}
    const key=`road:${source.x},${source.y}:${tile.road}`;
    if(this.moveGhostId!==key){
      this.clearMoveGhost();this.moveGhost=new THREE.Group();this.moveGhostId=key;
      const batch=new InstanceBuilder(this),style=ROAD_TIERS[tile.road],x=wx(source.x),z=wx(source.y);
      batch.box(style.sidewalk,x,.036,z,1.001,.058,1.001);
      batch.box(style.asphalt,x,.069,z,.72,.014,1.001);
      batch.box(tile.road>=2?0xeadfa9:0xdedcc7,x,.079,z,.023,.008,.27);
      batch.finish(this.moveGhost);
      for(const mesh of this.moveGhost.children){mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=.72;mesh.material.depthWrite=false;mesh.userData.ownMaterial=true;mesh.castShadow=false;}
      this.scene.add(this.moveGhost);
    }
    this.moveGhost.position.set(cell.x-source.x,.08,cell.y-source.y);
    for(const mesh of this.moveGhost.children)mesh.material.color.set(valid?0xc6ffe0:0xff7777);
    this.coverageGroup.visible=false;
  }
  setTool(tool) {
    this.clearMoveGhost();
    this._releasePointer();
    this.tool = typeof tool === 'string' ? tool : tool?.id || 'inspect';
    if (this.tool !== 'inspect') this.civicFollow = null;
    this.canvas.style.cursor = this.tool === 'inspect' ? 'grab' : 'crosshair';
    this.hoverRing.visible = this.tool === 'inspect' && !!this.hovered;
    this.bridgeHintGroup.visible = this.tool === 'bridge';
    if (this.tool !== 'inspect') this.actorMarkers.forEach(marker => { marker.button.hidden = true; });
    else this.nextMarkerSelection = 0;
  }

  setPreview(cells, valid = true, coverage = []) {
    const list = Array.isArray(cells) ? cells : [];
    const dummy = new THREE.Object3D();
    const capacity=this.state?.tiles?.length||SIZE*SIZE;
    this.servicePreviewMesh.count=Math.min(coverage.length,capacity);
    this.servicePreviewMaterial.color.set(0x58b9ce);this.servicePreviewMaterial.opacity=.30;
    coverage.slice(0,capacity).forEach((index,i)=>{
      const tile=this.state.tiles[index];
      dummy.position.set(wx(tile.x),.09,wx(tile.y));dummy.scale.set(.90,.012,.90);dummy.updateMatrix();
      this.servicePreviewMesh.setMatrixAt(i,dummy.matrix);
    });
    this.servicePreviewMesh.instanceMatrix.needsUpdate=true;
    const positions = [];
    this.previewMesh.count = Math.min(list.length, capacity);
    const isValid = valid !== false;
    this.previewMaterial.color.set(isValid ? (this.tool === 'bulldoze' ? 0xe1b06c : 0x56be90) : 0xe46550);
    this.previewLineMaterial.color.set(isValid ? 0xf1ffdd : 0xffd0bf);
    list.slice(0, capacity).forEach((cell, i) => {
      const x = wx(cell.x), z = wx(cell.y);
      const y = this._tile(cell.x, cell.y)?.terrain === 'water' ? .215 : .115;
      dummy.position.set(x, y, z); dummy.scale.set(.98, .02, .98); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      this.previewMesh.setMatrixAt(i, dummy.matrix);
      const l = .49;
      positions.push(x - l, y + .013, z - l, x + l, y + .013, z - l, x + l, y + .013, z - l, x + l, y + .013, z + l, x + l, y + .013, z + l, x - l, y + .013, z + l, x - l, y + .013, z + l, x - l, y + .013, z - l);
    });
    this.previewMesh.instanceMatrix.needsUpdate = true;
    this.previewLines.geometry.dispose();
    this.previewLines.geometry = new THREE.BufferGeometry();
    this.previewLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.previewLines.visible = list.length > 0;
  }

  selectCell(cell) {
    this.selected = cell;
    if(!cell)this.directionGuide?.set(null,this.state);
    this._buildSelectedCoverage();
    this.selectionRing.visible = !!cell;
    if (cell) this.selectionRing.position.set(wx(cell.x), this._tile(cell.x, cell.y)?.terrain === 'water' ? .14 : 0, wx(cell.y));
  }

  setDirectionGuide(item){
    this.directionGuide?.set(item?{...item,axis:interchangeAt(this.state,item)?.axis??null}:null,this.state);
  }

  _buildSelectedCoverage(){
    this._clear(this.coverageGroup);
    if(!this.selected||!this.state)return;
    const id=this._tile(this.selected.x,this.selected.y)?.buildingId;
    const b=this.state.buildings.find(b=>b.id===id);
    if(b&&this.buildingPickMesh){
      const matrix=new THREE.Matrix4();this.buildingPickMesh.getMatrixAt(this.state.buildings.indexOf(b),matrix);
      const material=new THREE.MeshBasicMaterial({color:0x38ffd2,transparent:true,opacity:.34,depthTest:false,depthWrite:false});
      const glow=new THREE.Mesh(this.geometries.box,material);glow.matrixAutoUpdate=false;glow.matrix.copy(matrix);glow.renderOrder=8;glow.userData={ownMaterial:true,selectionHighlight:true};this.coverageGroup.add(glow);
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(this.geometries.box),new THREE.LineBasicMaterial({color:0xb4fff0,transparent:true,opacity:1,depthTest:false,depthWrite:false}));
      edges.matrixAutoUpdate=false;edges.matrix.copy(matrix);edges.renderOrder=9;edges.userData={ownGeometry:true,ownMaterial:true};this.coverageGroup.add(edges);
    }
    if(!b?.coverageCells?.length)return;
    const material=new THREE.MeshBasicMaterial({color:0x247b60,transparent:true,opacity:.48,depthWrite:false});
    const mesh=new THREE.InstancedMesh(this.geometries.box,material,b.coverageCells.length),dummy=new THREE.Object3D();
    b.coverageCells.forEach((index,i)=>{const t=this.state.tiles[index];dummy.position.set(wx(t.x),.088,wx(t.y));dummy.scale.set(.94,.018,.94);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.userData.ownMaterial=true;mesh.renderOrder=2;this.coverageGroup.add(mesh);
    const covered=new Set(b.coverageCells),edges=[];
    for(const i of covered){
      const t=this.state.tiles[i],x=wx(t.x),z=wx(t.y);
      for(const [dx,dy,ax,az,bx,bz]of [[-1,0,-.5,-.5,-.5,.5],[1,0,.5,-.5,.5,.5],[0,-1,-.5,-.5,.5,-.5],[0,1,-.5,.5,.5,.5]]){
        const nx=t.x+dx,ny=t.y+dy;
        if(inGrid(this.state,nx,ny)&&covered.has(gridIndex(this.state,nx,ny)))continue;
        edges.push(x+ax,.11,z+az,x+bx,.11,z+bz);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
    const outline=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x124d3b,transparent:true,opacity:.95}));
    outline.renderOrder=3;outline.userData={ownGeometry:true,ownMaterial:true};this.coverageGroup.add(outline);

  }

  setOverlay(mode = 'none') {
    this.overlay = mode;
    this.overlayGroup.visible=!this.roadFocus||mode==='traffic';
    this._buildOverlay();
    this.layerBuildingHighlightKey=null;
    this._buildLayerBuildingHighlights();
  }

  _buildLayerBuildingHighlights(){
    if(!this.state||!this.layerBuildingHighlightGroup)return;
    const buildings=mapLayerBuildings(this.state,this.overlay).filter(b=>matchesBuildingFilter(b,this.buildingFilter));
    const key=`${this.overlay}|${this.buildingFilter||''}|${this.roadFocus?'roads':'city'}|${buildings.map(b=>`${b.id}:${b.type}:${b.x}:${b.y}:${b.level}:${Math.floor((b.progress??1)*4)}:${footprintSize(b)}`).join('|')}`;
    if(key===this.layerBuildingHighlightKey)return;
    this.layerBuildingHighlightKey=key;this._clear(this.layerBuildingHighlightGroup);
    this.layerBuildingHighlightGroup.visible=!this.roadFocus;
    if(this.roadFocus||!buildings.length)return;
    const color=MAP_LAYER_BUILDING_COLORS[this.overlay]??0x5ed7b0,dummy=new THREE.Object3D(),edgeMatrices=[];
    const fillMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.34,depthTest:false,depthWrite:false,toneMapped:false});
    const edgeMaterial=new THREE.MeshBasicMaterial({color:0xffffe7,transparent:true,opacity:.98,depthTest:false,depthWrite:false,toneMapped:false});
    const markerMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthTest:false,depthWrite:false,toneMapped:false});
    const fill=new THREE.InstancedMesh(this.geometries.box,fillMaterial,buildings.length);
    const rings=new THREE.InstancedMesh(this.geometries.ring,markerMaterial,buildings.length),pointers=new THREE.InstancedMesh(this.geometries.cone,markerMaterial.clone(),buildings.length);
    const addEdge=(x,y,z,sx,sy,sz)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,0,0);dummy.updateMatrix();edgeMatrices.push(dummy.matrix.clone());};
    buildings.forEach((b,index)=>{
      const size=footprintSize(b),height=Math.max(.22,this._buildingVisualHeight(b)),x=wx(b.x)+(size-1)/2,z=wx(b.y)+(size-1)/2,half=size/2-.025;
      dummy.position.set(x,height/2+.04,z);dummy.scale.set(size-.05,height+.14,size-.05);dummy.rotation.set(0,0,0);dummy.updateMatrix();fill.setMatrixAt(index,dummy.matrix);
      for(const y of [.115,height+.09])for(const side of [-1,1]){addEdge(x,y,z+side*half,size+.04,.075,.085);addEdge(x+side*half,y,z,.085,.075,size+.04);}
      for(const sx of [-1,1])for(const sz of [-1,1])addEdge(x+sx*half,height/2+.08,z+sz*half,.075,height+.10,.075);
      const markerScale=.32+Math.min(3,size)*.08;
      dummy.position.set(x,height+.31,z);dummy.scale.set(markerScale,markerScale,1);dummy.rotation.set(Math.PI/2,0,0);dummy.updateMatrix();rings.setMatrixAt(index,dummy.matrix);
      dummy.position.set(x,height+.64,z);dummy.scale.set(.16,.30,.16);dummy.rotation.set(0,0,Math.PI);dummy.updateMatrix();pointers.setMatrixAt(index,dummy.matrix);
    });
    const edges=new THREE.InstancedMesh(this.geometries.box,edgeMaterial,edgeMatrices.length);edgeMatrices.forEach((matrix,index)=>edges.setMatrixAt(index,matrix));
    for(const mesh of [fill,edges,rings,pointers]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.frustumCulled=false;mesh.renderOrder=mesh===fill?6:mesh===edges?7:8;mesh.userData={ownMaterial:true,layerBuildingHighlight:true,highlightFill:mesh===fill,highlightLocator:mesh===rings||mesh===pointers};this.layerBuildingHighlightGroup.add(mesh);}
  }

  _buildOverlay() {
    this._clear(this.overlayGroup);
    if (this.overlay === 'none' || !this.state) return;
    const tiles = this.state.tiles.filter(t => t.terrain !== 'water' || t.road);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .60, depthWrite: false });
    const mesh = new THREE.InstancedMesh(this.geometries.box, material, tiles.length);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const buildingById = new Map((this.state.buildings || []).map(b => [b.id, b]));
    tiles.forEach((tile, i) => {
      const mode = this.overlay;
      let opacityScale = 1;
      if (mode === 'traffic') {
        const t = clamp((tile.traffic || 0) / 100, 0, 1);
        color.setHSL(.35 * (1 - t), .72, .47);
        if (!tile.road) { color.set(0xb7c6aa); opacityScale = .05; }
      } else if (mode === 'fire') {
        const building = tile.buildingId == null ? null : buildingById.get(tile.buildingId);
        const covered = (tile.fireCoverage || 0) > 0 || building?.fireCovered === true;
        color.set(covered ? 0x68baa1 : tile.zone || building ? 0xd98354 : 0x97a592);
        if (!covered && !tile.road && !tile.zone && !building) opacityScale = .035;
      } else if (SERVICE_LAYERS[mode]) {
        const cell=serviceLayerCell(mode,tile,buildingById.get(tile.buildingId));
        color.set(cell.color);if(cell.amount!==undefined)color.set(0x97bd87).lerp(new THREE.Color(cell.color),cell.amount);if(!cell.visible)opacityScale=.035;
      } else if (mode === 'power' || mode === 'water') {
        const served = mode === 'power' ? tile.powered : tile.watered;
        color.set(served ? (mode === 'power' ? 0xe2bf4d : 0x45a8c7) : tile.zone || tile.buildingId != null ? 0xd6775a : 0x9da995);
        if (!tile.road && !tile.zone && tile.buildingId == null) opacityScale = .035;
      } else {
        const amount = clamp((tile.pollution || 0) / 100, 0, 1);
        color.setHSL(.31 * (1 - amount), .50 + amount * .19, .53 - amount * .08);
      }
      dummy.position.set(wx(tile.x), tile.terrain === 'water' ? .213 : .092, wx(tile.y));
      dummy.scale.set(.965, .006 * opacityScale, .965);
      if (opacityScale < .1) dummy.scale.set(0, 0, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = 2;
    mesh.userData.ownMaterial = true;
    mesh.computeBoundingSphere();
    this.overlayGroup.add(mesh);
    if(this.overlay==='traffic'){
      const pieces=[];
      for(const t of tiles.filter(t=>t.interchange)){
        const ew=t.interchange.axis==='ew',slices=t.interchange.core?1:12;
        for(let i=0;i<slices;i++){
          const from=-.5+i/slices,to=from+1/slices,offset=(from+to)/2;
          const h0=roadElevation(this.state,t.x+(ew?from:0),t.y+(ew?0:from),t.interchange.axis),h1=roadElevation(this.state,t.x+(ew?to:0),t.y+(ew?0:to),t.interchange.axis);
          pieces.push({tile:t,ew,offset,height:(h0+h1)/2,slope:Math.atan2(h1-h0,to-from),length:Math.hypot(to-from,h1-h0)});
        }
      }
      if(pieces.length){
        const upper=new THREE.InstancedMesh(this.geometries.box,material.clone(),pieces.length);
        pieces.forEach((p,i)=>{
          dummy.position.set(wx(p.tile.x)+(p.ew?p.offset:0),p.height+.092,wx(p.tile.y)+(p.ew?0:p.offset));
          dummy.scale.set(p.ew?p.length:.965,.006,p.ew?.965:p.length);
          dummy.rotation.set(p.ew?0:-p.slope,0,p.ew?p.slope:0);dummy.updateMatrix();upper.setMatrixAt(i,dummy.matrix);
          color.setHSL(.35*(1-clamp((p.tile.traffic||0)/100,0,1)),.72,.47);upper.setColorAt(i,color);
        });
        upper.instanceMatrix.needsUpdate=true;upper.instanceColor.needsUpdate=true;upper.renderOrder=3;upper.userData={ownMaterial:true,elevatedTraffic:true};upper.computeBoundingSphere();this.overlayGroup.add(upper);
      }
    }
  }

  _createTraffic() {
    this.cars = [];
    this.pedestrians = [];
    this.carClock = 0;
    this.carCapacity = 140;
    this.pedestrianCapacity = PEDESTRIAN_CAPACITY;
    this.actorRaycaster = new THREE.Raycaster();
    this.actorById = new Map();
    this.trafficController = new TrafficController();
    this.signalGroup = new THREE.Group();
    this.scene.add(this.signalGroup);
    this.signalMaterials = {
      red: new THREE.MeshBasicMaterial({ color: 0xff493d, toneMapped: false }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xffd43b, toneMapped: false }),
      green: new THREE.MeshBasicMaterial({ color: 0x34f58c, toneMapped: false }),
    };
    this.signalHeads = [];
    this.signalMeshes = {};
    this.carBodies = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carCabins = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carWheels = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity * 2);
    this.carLights = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity * 2);
    this.carEmergencyRed = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carEmergencyBlue = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carServiceMarksA = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carServiceMarksB = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carDetailsA = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.carDetailsB = new THREE.InstancedMesh(this.geometries.box, this.material, this.carCapacity);
    this.walkerBodies = new THREE.InstancedMesh(this.geometries.box, this.material, this.pedestrianCapacity);
    this.walkerHeads = new THREE.InstancedMesh(this.geometries.crown, this.material, this.pedestrianCapacity);
    this.walkerHair = new THREE.InstancedMesh(this.geometries.crown, this.material, this.pedestrianCapacity);
    this.walkerArms = new THREE.InstancedMesh(this.geometries.box, this.material, this.pedestrianCapacity * 2);
    this.walkerLegs = new THREE.InstancedMesh(this.geometries.box, this.material, this.pedestrianCapacity * 2);
    this.dynamicMeshes = [this.carBodies, this.carCabins, this.carWheels, this.carLights,this.carEmergencyRed,this.carEmergencyBlue,this.carServiceMarksA,this.carServiceMarksB,this.carDetailsA,this.carDetailsB, this.walkerBodies, this.walkerHeads, this.walkerHair, this.walkerArms, this.walkerLegs];
    for (const mesh of this.dynamicMeshes) {
      mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
    }
    this.carDummy = new THREE.Object3D();
    this.vehicleLighting=new RoadVehicleLighting(this.scene,this.carCapacity);
    this.actorMarkers = Array.from({ length: 3 }, () => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'actor-marker'; button.hidden = true;
      button.style.position = 'absolute';
      button.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/></svg>';
      const marker = { button, actorId: null, unobscured: false };
      for (const event of ['pointerdown', 'pointerup', 'pointermove', 'dblclick', 'keydown', 'keyup']) button.addEventListener(event, e => e.stopPropagation());
      button.addEventListener('pointerenter', () => this._hover(null));
      button.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const actor = this.actorById.get(marker.actorId);
        if (this.tool === 'inspect' && actor && actor.visible !== false) this.callbacks.onActorSelect(this._actorDescriptor(actor));
      });
      this.container.appendChild(button);
      return marker;
    });
    this.nextMarkerSelection = 0;
    this.nextMarkerVisibility = 0;
    this.visitCount = 0;
  }

  _resetActors() {
    this.cars = []; this.pedestrians = []; this.actorById.clear();
    for (const mesh of this.dynamicMeshes) mesh.count = 0;
    this.vehicleLighting?.setCount(0);
    this.actorMarkers.forEach(marker => { marker.actorId = null; marker.button.hidden = true; });
    this.routeKey = null; this.pedestrianKey = null;
    this.nextMarkerSelection = 0; this.nextMarkerVisibility = 0;
    this.lastVisitedId = null; this.lastVisitedKind = null; this.visitCount = 0;
    this.trafficController = new TrafficController();
    this.signalRoadKey = null; this.signalGeometryKey = null; this.signalPhaseKey = null;
    this.lastVisitedSignalId = null; this.signalHeads = []; this.signalMeshes = {};
    this.lastVisitedCivicId = null;
    this._clear(this.signalGroup);
    this._clearCivicIncident();
  }

  _createCivicEffects() {
    this.civicEffects = new THREE.Group();
    this.civicEffects.visible = false;
    this.scene.add(this.civicEffects);
    this.fireTruck = new THREE.Group();
    this.civicEffects.add(this.fireTruck);
    const truck = new InstanceBuilder(this);
    truck.box(0x394540, 0, .081, 0, .225, .064, .52);
    truck.box(0xbf483a, 0, .194, -.080, .244, .174, .36);
    truck.box(0xd4523e, 0, .205, .181, .245, .206, .198);
    truck.box(0xf0ddbb, 0, .171, .025, .252, .036, .49);
    truck.box(0x456e7a, 0, .246, .283, .194, .095, .014);
    truck.box(0xe7debd, 0, .112, .292, .256, .043, .028);
    truck.box(0x8d9690, 0, .111, -.274, .251, .038, .027);
    for (const side of [-1, 1]) {
      truck.box(0x456e7a, side * .129, .248, .184, .014, .103, .118);
      truck.box(0xc9cbb6, side * .129, .215, -.116, .012, .112, .218);
      for (let stripe = 0; stripe < 4; stripe++) truck.box(0x8d958c, side * .137, .175 + stripe * .027, -.116, .009, .006, .20);
      truck.box(0xffe3a5, side * .076, .168, .295, .047, .029, .016);
      truck.box(0xc5c9b7, side * .061, .304, -.074, .017, .019, .353);
      for (const axle of [-.178, .187]) {
        truck.add('cylinder', 0x303b37, side * .142, .061, axle, .112, .044, .112, 0, 0, Math.PI / 2);
        truck.add('cylinder', 0x8d9690, side * .166, .061, axle, .060, .007, .060, 0, 0, Math.PI / 2);
      }
    }
    for (let rung = 0; rung < 6; rung++) truck.box(0xd4d6c2, 0, .306, -.233 + rung * .061, .14, .017, .016);
    truck.box(0x364a46, 0, .325, .179, .19, .026, .062);
    truck.finish(this.fireTruck);
    this.civicRoadLighting=new RoadVehicleLighting(this.fireTruck,1);
    this.civicRoadLighting.setCount(1);
    this.civicRoadLighting.update(0,{x:0,y:.16,z:0,length:.58,width:.244});this.civicRoadLighting.finish();
    this.civicBlueMaterial = new THREE.MeshBasicMaterial({ color: 0x5ad1ff, toneMapped: false });
    this.fireTruckLights = [this.signalMaterials.red, this.civicBlueMaterial].map((material, i) => {
      const mesh = new THREE.Mesh(this.geometries.box, material);
      mesh.position.set(i ? .057 : -.057, .347, .179);
      mesh.scale.set(.078, .031, .053);
      this.fireTruck.add(mesh);
      return mesh;
    });
    this.civicBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xf0a447, transparent: true, opacity: .76, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.civicBeaconGeometry = new THREE.RingGeometry(.46, .51, 40);
    this.civicBeacon = new THREE.Mesh(this.civicBeaconGeometry, this.civicBeaconMaterial);
    this.civicBeacon.rotation.x = -Math.PI / 2;
    this.civicEffects.add(this.civicBeacon);
    this.civicEcho = new THREE.Mesh(this.civicBeaconGeometry, this.civicBeaconMaterial);
    this.civicEcho.rotation.x = -Math.PI / 2;
    this.civicEffects.add(this.civicEcho);
    this.civicDrillLabel = document.createElement('span');
    this.civicDrillLabel.className = 'civic-drill-marker';
    this.civicDrillLabel.textContent = '消防演练';
    this.civicDrillLabel.setAttribute('aria-label', '消防演练目标，无真实火灾');
    this.civicDrillLabel.style.cssText = 'position:absolute;pointer-events:none;transform:translate(-50%,-100%);padding:4px 9px;border:1px solid #daa86b;border-radius:999px;background:rgba(255,248,229,.96);color:#975222;font:600 11px system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 2px 8px #78552e20;z-index:2;white-space:nowrap;';
    this.civicDrillLabel.hidden = true;
    this.container.appendChild(this.civicDrillLabel);
    this.civicVehicleLabel = document.createElement('span');
    this.civicVehicleLabel.className = 'civic-vehicle-marker';
    this.civicVehicleLabel.textContent = '消防车 · 演练出动';
    this.civicVehicleLabel.style.cssText = this.civicDrillLabel.style.cssText;
    this.civicVehicleLabel.hidden = true;
    this.container.appendChild(this.civicVehicleLabel);
    this.civicClock = 0;
    this.civicIncident = null;
    this.civicPath = [];
  }

  _clearCivicIncident() {
    this.civicIncident = null; this.civicPath = []; this.civicTarget = null;
    this.civicVehicleProgress = 0; this.civicTargetProgress = 0; this.civicClock = 0;
    this.civicCheckpointKey = null; this.civicCheckpointElapsed = 0;
    this.civicFollow = null;
    if (this.civicEffects) this.civicEffects.visible = false;
    if (this.civicDrillLabel) this.civicDrillLabel.hidden = true;
    if (this.civicVehicleLabel) this.civicVehicleLabel.hidden = true;
  }

  _syncCivicIncident() {
    const incident = this.state?.civic?.incident;
    const station = incident && this.state.buildings.find(b => b.id === incident.stationId);
    const target = incident && this.state.buildings.find(b => b.id === incident.targetId);
    const valid = incident?.kind === 'drill' && ['responding', 'controlling'].includes(incident.stage) && station?.type === 'fireStation' && station.active !== false && station.progress >= 1 && target && target.x === incident.x && target.y === incident.y && Array.isArray(incident.path) && incident.path.length > 0;
    if (!valid) { this._clearCivicIncident(); return; }
    const path = [];
    for (const index of incident.path) {
      if (!Number.isInteger(index) || index < 0 || index >= this.state.tiles.length) { this._clearCivicIncident(); return; }
      const tile = this.state.tiles[index];
      if (!tile?.road) { this._clearCivicIncident(); return; }
      const point = gridPoint(this.state,index), previous = path.at(-1);
      if (previous && Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) !== 1) { this._clearCivicIncident(); return; }
      path.push(point);
    }
    const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    if (!adjacent(path[0], station) || !adjacent(path.at(-1), target)) { this._clearCivicIncident(); return; }
    const progress = incident.stage === 'controlling' ? 1 : clamp(Number(incident.progress) || 0, 0, 1);
    const checkpointKey = `${incident.id}:${incident.stage}:${progress}:${incident.totalTicks}:${incident.remainingTicks}`;
    if (this.civicIncident?.id !== incident.id) this.civicClock = 0;
    if (checkpointKey !== this.civicCheckpointKey) {
      this.civicCheckpointKey = checkpointKey;
      this.civicCheckpointElapsed = 0;
      this.civicVehicleProgress = progress;
    }
    // Each simulation tick is three simulated seconds. The view may interpolate
    // towards one next checkpoint, but never changes the authoritative stage,
    // completion, or saved progress. A new checkpoint/load reanchors the clock.
    this.civicTargetProgress = progress;
    if (incident.stage === 'controlling') this.civicVehicleProgress = 1;
    this.civicIncident = { ...incident };
    this.civicPath = path; this.civicTarget = target;
    if (this.civicEffects) this.civicEffects.visible = true;
  }

  _animateCivic(delta) {
    if (!this.civicIncident || !this.civicEffects) return;
    if (!this.paused) {
      this.civicClock += delta;
      this.civicCheckpointElapsed = Math.min(3, (this.civicCheckpointElapsed || 0) + delta);
      if (this.civicIncident.stage === 'responding') {
        const totalTicks = Math.max(1, Number(this.civicIncident.totalTicks) || 1);
        const nextCheckpoint = Math.min(1, this.civicTargetProgress + 1 / totalTicks);
        this.civicVehicleProgress = this.civicTargetProgress + (nextCheckpoint - this.civicTargetProgress) * (this.civicCheckpointElapsed / 3);
      }
    }
    const path = this.civicPath, length = path.length - 1;
    const distance = clamp(this.civicVehicleProgress, 0, 1) * length;
    const segment = Math.min(Math.max(0, length - 1), Math.floor(distance));
    const fraction = length ? distance - segment : 0;
    const a = path[segment], b = path[Math.min(segment + 1, length)];
    const dx = b.x - a.x, dy = b.y - a.y || (dx === 0 ? 1 : 0);
    const lane=length?vehicleLanePose(path,distance,this.wideRoads):{x:a.x-dy*.16,y:a.y+dx*.16,angle:Math.atan2(dx,dy)};
    const x = wx(lane.x), z = wx(lane.y);
    const bridgeA = this._tile(a.x, a.y)?.terrain === 'water', bridgeB = this._tile(b.x, b.y)?.terrain === 'water';
    const elevation = .079 + ((bridgeA ? 1 - fraction : 0) + (bridgeB ? fraction : 0)) * .114+roadElevation(this.state,a.x+(b.x-a.x)*fraction,a.y+(b.y-a.y)*fraction,dx?'ew':'ns');
    this.fireTruck.position.set(x, elevation, z);
    const px=a.x+(b.x-a.x)*fraction,py=a.y+(b.y-a.y)*fraction;
    const rise=roadElevation(this.state,px+dx*.05,py+dy*.05,dx?'ew':'ns')-roadElevation(this.state,px-dx*.05,py-dy*.05,dx?'ew':'ns');
    this.fireTruck.rotation.set(-Math.atan2(rise,.1),lane.angle,0,'YXZ');
    if (!this.paused && this.civicFollow?.id === this.civicIncident.id) {
      // Keep the already framed screen position while following the actual
      // appliance. No independent camera clock can run ahead of the drill.
      this.target.set(x + this.civicFollow.offsetX, 0, z + this.civicFollow.offsetZ);
      this._limitCamera(); this._updateCamera();
    }
    const flash = Math.floor(this.civicClock * 6) % 2;
    this.fireTruckLights.forEach((light, index) => { light.visible = flash === index; });
    const tx = wx(this.civicTarget.x), tz = wx(this.civicTarget.y);
    const pulse = (Math.sin(this.civicClock * 3.5) + 1) / 2;
    this.civicBeacon.position.set(tx, .098, tz);
    this.civicEcho.position.set(tx, .099, tz);
    this.civicBeacon.scale.setScalar(1.03 + pulse * .13);
    this.civicEcho.scale.setScalar(1.20 + pulse * .34);
    this.civicBeaconMaterial.opacity = .46 + pulse * .35;
    if (this.civicDrillLabel) {
      const height = this.civicTarget.level >= 2 ? 1.95 : .98;
      const point = new THREE.Vector3(tx, height, tz).project(this.camera);
      const rect = this.canvas.getBoundingClientRect(), containerRect = this.container.getBoundingClientRect();
      const px = rect.left + (point.x + 1) * rect.width / 2, py = rect.top + (1 - point.y) * rect.height / 2;
      this.civicDrillLabel.hidden = Math.abs(point.x) > .97 || Math.abs(point.y) > .95 || !!document.querySelector('dialog[open]');
      this.civicDrillLabel.style.left = `${px - containerRect.left}px`;
      this.civicDrillLabel.style.top = `${py - containerRect.top}px`;
    }
    if (this.civicVehicleLabel) {
      const point = new THREE.Vector3(x, elevation + .48, z).project(this.camera);
      const rect = this.canvas.getBoundingClientRect(), containerRect = this.container.getBoundingClientRect();
      this.civicVehicleLabel.hidden = Math.abs(point.x) > .97 || Math.abs(point.y) > .95 || !!document.querySelector('dialog[open]');
      this.civicVehicleLabel.textContent = this.civicIncident.stage === 'responding' ? '消防车 · 演练出动' : '消防车 · 现场处置';
      this.civicVehicleLabel.style.left = `${rect.left + (point.x + 1) * rect.width / 2 - containerRect.left}px`;
      this.civicVehicleLabel.style.top = `${rect.top + (1 - point.y) * rect.height / 2 - containerRect.top}px`;
    }
  }

  visitCivic(type) {
    let target;
    if ((type === 'incident' || !type) && this.civicIncident) target = { x: this.civicIncident.x, y: this.civicIncident.y, type: 'incident' };
    if (!target) {
      const choices = (this.state?.buildings || []).filter(b => type ? b.type === type : ['cityHall', 'fireStation'].includes(b.type));
      const next = choices.find(b => b.id !== this.lastVisitedCivicId) || choices[0];
      if (!next) return null;
      this.lastVisitedCivicId = next.id;
      target = { x: next.x, y: next.y, type: next.type };
    }
    this.civicFollow = null;
    if (target.type === 'incident') {
      this._animateCivic(0);
      this._frameCityCell(this.fireTruck.position.x + HALF - .5, this.fireTruck.position.z + HALF - .5, 12.2);
      this.civicFollow = { id: this.civicIncident.id, offsetX: this.target.x - this.fireTruck.position.x, offsetZ: this.target.z - this.fireTruck.position.z };
    } else this._frameCityCell(target.x, target.y, 10.8);
    this.nextMarkerSelection = 0;
    return target;
  }

  _setRoutes(routes) {
    const previous = new Map(this.cars.map(car => [car.id, car]));
    for (const car of this.cars) this.actorById.delete(car.id);
    this.cars = [];
    const valid = routes.filter(route => !route.walking && route.points?.length >= 2 && (route.load ?? 1) > 0);
    const population=this.state?.stats?.population||0;
    const civilianKinds=CIVILIAN_VEHICLE_KINDS.filter(kind=>kind==='compact'||kind==='car'||population>=(kind==='hatchback'?500:kind==='suv'||kind==='taxi'?1000:2000));
    const freightKinds=FREIGHT_VEHICLE_KINDS.filter(kind=>kind==='freight'||population>=(kind==='pickup'?500:1000));
    // One drawn car represents multiple trips; routes are never fabricated.
    for (let r = 0; r < valid.length && this.cars.length < this.carCapacity; r++) {
      const route = valid[r];
      const points = route.points.filter(p => this._tile(p.x, p.y)?.road);
      if (points.length !== route.points.length || points.length < 2) continue;
      if (points.some((p, i) => i > 0 && Math.abs(p.x - points[i - 1].x) + Math.abs(p.y - points[i - 1].y) !== 1)) continue;
      const publicVehicle=isPublicVehicleKind(route.kind);
      const routeId = stableHash(`${route.kind}:${route.vehicleKind||''}:${route.homeId||''}:${route.workplaceId||''}:${route.facilityId||''}:${route.targetId||''}:${route.incidentId||''}:${points.map(p => `${p.x},${p.y}`).join(';')}`).toString(36);
      const amount = publicVehicle?1:Math.min(5, Math.max(1, Math.ceil((route.load || 1) / 12)));
      for (let j = 0; j < amount && this.cars.length < this.carCapacity; j++) {
        const id = `vehicle-${routeId}-${j}`;
        if (this.actorById.has(id)) continue;
        const nameSeed = stableHash(id), old = previous.get(id);
        const kind=publicVehicle?route.kind:route.kind==='freight'?'freight':'car';
        const variants=kind==='freight'?freightKinds:civilianKinds;
        const appearance=route.vehicleKind||(publicVehicle?route.kind:variants[nameSeed%variants.length]);
        const initialTravel=this.state?.catalogPreview?(points.length-1)/2:((nameSeed % 997) / 997) * (points.length - 1);
        const returning=j%2===1&&route.returnPoints?.length>=2;
        const tripPoints=returning?route.returnPoints:points;
        const car = { id, nameSeed, points:tripPoints, returning, homeId:route.homeId,workplaceId:route.workplaceId,facilityId:route.facilityId,targetId:route.targetId,incidentId:route.incidentId,responding:!!route.responding,kind,appearance, travel: old?.travel ?? initialTravel, reverse: !route.directed&&!route.returnPoints&&j % 2 === 1, position: old?.position || new THREE.Vector3(), x: points[0].x, y: points[0].y };
        this.cars.push(car); this.actorById.set(id, car);
      }
    }
    this.carBodies.count = this.cars.length;
    this.carCabins.count = this.cars.length;
    this.carWheels.count = this.cars.length * 2;
    this.carLights.count = this.cars.length * 2;
    this.vehicleLighting?.setCount(this.cars.length);
    this.carEmergencyRed.count=this.cars.length;
    this.carEmergencyBlue.count=this.cars.length;
    this.carServiceMarksA.count=this.cars.length;
    this.carServiceMarksB.count=this.cars.length;
    this.carDetailsA.count=this.cars.length;
    this.carDetailsB.count=this.cars.length;
    const col = new THREE.Color();
    const colorAt=(value,seed)=>Array.isArray(value)?value[seed%value.length]:value;
    this.cars.forEach((car, i) => {
      const vehicleStyle=ROAD_VEHICLE_STYLES[car.appearance]||ROAD_VEHICLE_STYLES[car.kind]||ROAD_VEHICLE_STYLES.car;
      this.carBodies.setColorAt(i, col.set(colorAt(vehicleStyle.body,car.nameSeed)));
      this.carCabins.setColorAt(i, col.set(vehicleStyle.cabin));
      this.carWheels.setColorAt(i * 2, col.set(0x343e3c));
      this.carWheels.setColorAt(i * 2 + 1, col);
      this.carLights.setColorAt(i * 2, col.set(0xffefbb));
      this.carLights.setColorAt(i * 2 + 1, col);
      this.carEmergencyRed.setColorAt(i,col.set(0xff4438));
      this.carEmergencyBlue.setColorAt(i,col.set(0x42c8ff));
      this.carServiceMarksA.setColorAt(i,col.set(vehicleStyle.mark??vehicleStyle.trim??0xffffff));
      this.carServiceMarksB.setColorAt(i,col);
      this.carDetailsA.setColorAt(i,col.set(vehicleStyle.trim??0xded7bc));
      this.carDetailsB.setColorAt(i,col.set(vehicleStyle.accent??0x4e6867));
    });
    for (const mesh of [this.carBodies, this.carCabins, this.carWheels, this.carLights,this.carEmergencyRed,this.carEmergencyBlue,this.carServiceMarksA,this.carServiceMarksB,this.carDetailsA,this.carDetailsB]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this._syncTrafficController();
    this._animateTraffic(0);
    this.nextMarkerSelection = 0;
  }

  _animateTraffic(delta) {
    if (!this.paused) this.carClock += delta;
    this.trafficController.step(this.paused ? 0 : delta);
    this._updateTrafficLights();
    const dummy = this.carDummy;
    const transform = (mesh, i, x, y, z, sx, sy, sz, angle, pitch=0) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(pitch, angle, 0, 'YXZ'); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    };
    this.cars.forEach((car, i) => {
      const len = car.points.length - 1;
      const pose = this.trafficController.getPose(car.id);
      car.visible = !!pose && pose.visible !== false;
      if (!car.visible) {
        this.vehicleLighting?.update(i,{visible:false});
        for (const mesh of [this.carBodies, this.carCabins,this.carEmergencyRed,this.carEmergencyBlue,this.carServiceMarksA,this.carServiceMarksB,this.carDetailsA,this.carDetailsB]) transform(mesh, i, 0, -10, 0, 0, 0, 0, 0);
        for (const mesh of [this.carWheels, this.carLights]) for (let j = 0; j < 2; j++) transform(mesh, i * 2 + j, 0, -10, 0, 0, 0, 0, 0);
        return;
      }
      const distance = clamp(pose.distance, 0, len);
      car.travel = car.reverse ? len - distance : distance;
      car.waiting = !!pose.waiting; car.waitReason = pose.reason || null;
      const segment = Math.min(len - 1, Math.floor(distance));
      const f = distance - segment;
      const a = car.points[segment], b = car.points[segment + 1];
      const dx = pose.dx, dz = pose.dy;
      const lane=pose.lanePose||vehicleLanePose(car.reverse?[...car.points].reverse():car.points,car.travel,this.wideRoads);
      const x = wx(lane.x), z = wx(lane.y);
      const bridgeA = this._tile(a.x, a.y)?.terrain === 'water', bridgeB = this._tile(b.x, b.y)?.terrain === 'water';
      const y = .16 + ((bridgeA ? 1 - f : 0) + (bridgeB ? f : 0)) * .114+roadElevation(this.state,pose.x,pose.y,dx?'ew':'ns');
      const angle = lane.angle;
      const rise=roadElevation(this.state,pose.x+dx*.05,pose.y+dz*.05,dx?'ew':'ns')-roadElevation(this.state,pose.x-dx*.05,pose.y-dz*.05,dx?'ew':'ns');
      const pitch=-Math.atan2(rise,.1),cosPitch=Math.cos(pitch),sinPitch=Math.sin(pitch);
      const vehicleStyle=ROAD_VEHICLE_STYLES[car.appearance]||ROAD_VEHICLE_STYLES[car.kind]||ROAD_VEHICLE_STYLES.car;
      const {length,width,bodyHeight,cabinHeight,cabinLength,shape}=vehicleStyle;
      this.vehicleLighting?.update(i,{x,y,z,angle,pitch,length,width});
      const cabinOffset=vehicleStyle.cabinOffset||0,axleOffset=vehicleStyle.axleOffset??length*.32;
      const place=(mesh,index,longitudinal,lateral,height,sx,sy,sz)=>{
        const forward=longitudinal*cosPitch+height*sinPitch,vertical=height*cosPitch-longitudinal*sinPitch;
        transform(mesh,index,x+Math.sin(angle)*forward+Math.cos(angle)*lateral,y+vertical,z+Math.cos(angle)*forward-Math.sin(angle)*lateral,sx,sy,sz,angle,pitch);
      };
      const hide=mesh=>transform(mesh,i,0,-10,0,0,0,0,0);
      transform(this.carBodies, i, x, y, z, width, bodyHeight, length, angle,pitch);
      place(this.carCabins,i,cabinOffset,0,bodyHeight*.55,width*.81,cabinHeight,cabinLength);
      for (const [offset, n] of [[-axleOffset, 0], [axleOffset, 1]]) place(this.carWheels,i*2+n,offset,0,-.037,width*1.08,.063,.05);
      for (const [side, n] of [[-width*.31, 0], [width*.31, 1]]) place(this.carLights,i*2+n,length/2+.007,side,.008,.036,.03,.018);
      for(const mesh of [this.carEmergencyRed,this.carEmergencyBlue,this.carServiceMarksA,this.carServiceMarksB,this.carDetailsA,this.carDetailsB])hide(mesh);

      const cabinY=bodyHeight*.55,roofY=cabinY+cabinHeight*.62;
      const bumper=(mesh,front,scale=.90)=>place(mesh,i,front*(length/2+.008),0,-.006,width*scale,.025,.026);
      const sideStripe=(mesh,side,start=0,size=length*.68)=>place(mesh,i,start,side*(width/2+.007),bodyHeight*.18,.012,.035,size);
      if(shape==='sedan'){
        bumper(this.carDetailsA,1);bumper(this.carDetailsB,-1,.84);
      }else if(shape==='compact'){
        bumper(this.carDetailsA,1);place(this.carDetailsB,i,-length*.30,0,roofY+.010,width*.72,.025,.045);
      }else if(shape==='hatchback'){
        place(this.carDetailsA,i,-length*.47,0,bodyHeight*.28,width*.76,.075,.025);
        place(this.carDetailsB,i,-length*.31,0,roofY+.012,width*.78,.026,.052);
      }else if(shape==='suv'){
        for(const [mesh,side] of [[this.carServiceMarksA,-1],[this.carServiceMarksB,1]])place(mesh,i,cabinOffset,side*width*.29,roofY+.018,.018,.026,cabinLength*.92);
        bumper(this.carDetailsA,1,.94);bumper(this.carDetailsB,-1,.94);
      }else if(shape==='taxi'){
        place(this.carServiceMarksA,i,cabinOffset,0,roofY+.033,width*.48,.060,.075);
        sideStripe(this.carServiceMarksB,1,0,length*.60);
        bumper(this.carDetailsA,1);bumper(this.carDetailsB,-1,.84);
      }else if(shape==='minivan'){
        sideStripe(this.carServiceMarksA,-1,0,length*.68);sideStripe(this.carServiceMarksB,1,0,length*.68);
        bumper(this.carDetailsA,1,.94);place(this.carDetailsB,i,-length*.34,0,roofY+.008,width*.78,.024,.048);
      }else if(shape==='pickup'){
        for(const [mesh,side] of [[this.carServiceMarksA,-1],[this.carServiceMarksB,1]])place(mesh,i,-length*.24,side*width*.38,bodyHeight*.70,.025,.095,length*.36);
        place(this.carDetailsA,i,-length*.47,0,bodyHeight*.40,width*.88,.10,.025);bumper(this.carDetailsB,1,.92);
      }else if(shape==='delivery-van'){
        sideStripe(this.carServiceMarksA,-1,-length*.12,length*.64);sideStripe(this.carServiceMarksB,1,-length*.12,length*.64);
        bumper(this.carDetailsA,1,.94);bumper(this.carDetailsB,-1,.90);
      }else if(shape==='freight'){
        place(this.carDetailsA,i,-length*.20,0,bodyHeight*.52,width*.92,.19,length*.52);
        place(this.carDetailsB,i,-length*.48,0,bodyHeight*.18,width*.94,.045,.030);
        sideStripe(this.carServiceMarksA,-1,-length*.20,length*.48);sideStripe(this.carServiceMarksB,1,-length*.20,length*.48);
      }else if(shape==='police'){
        sideStripe(this.carServiceMarksA,-1,0,length*.72);sideStripe(this.carServiceMarksB,1,0,length*.72);
        bumper(this.carDetailsA,1);bumper(this.carDetailsB,-1);
      }else if(shape==='bus'){
        sideStripe(this.carServiceMarksA,-1,0,length*.86);sideStripe(this.carServiceMarksB,1,0,length*.86);
        place(this.carDetailsA,i,length*.44,0,roofY,width*.7,.045,.018);
        place(this.carDetailsB,i,0,0,roofY+.03,width*.66,.035,length*.44);
      }else if(shape==='ambulance'){
        sideStripe(this.carServiceMarksA,-1,-length*.10,length*.70);sideStripe(this.carServiceMarksB,1,-length*.10,length*.70);
        place(this.carDetailsA,i,-length*.14,0,roofY+.032,.045,.022,.18);
        place(this.carDetailsB,i,-length*.14,0,roofY+.033,.16,.023,.045);
      }else if(shape==='fire-engine'){
        sideStripe(this.carServiceMarksA,-1,-length*.10,length*.70);sideStripe(this.carServiceMarksB,1,-length*.10,length*.70);
        place(this.carDetailsA,i,-length*.10,-width*.22,roofY+.035,.025,.028,length*.62);
        place(this.carDetailsB,i,-length*.10,width*.22,roofY+.035,.025,.028,length*.62);
      }
      if(shape==='ambulance'||shape==='fire-engine'||shape==='police'){
        const flash=Math.floor(this.carClock*7)%2;
        for(const [mesh,side,on] of [[this.carEmergencyRed,-.055,flash===0],[this.carEmergencyBlue,.055,flash===1]])place(mesh,i,cabinOffset,side,roofY+.050,on ? .072 : .050,on ? .036 : .023,.060);
      }
      car.position.set(x, y + .065, z);
      const cell = f < .5 ? a : b; car.x = cell.x; car.y = cell.y;
    });
    for (const mesh of [this.carBodies, this.carCabins, this.carWheels, this.carLights,this.carEmergencyRed,this.carEmergencyBlue,this.carServiceMarksA,this.carServiceMarksB,this.carDetailsA,this.carDetailsB]) mesh.instanceMatrix.needsUpdate = true;
    this.vehicleLighting?.finish();
  }

  _syncTrafficController() {
    this.trafficController.sync(this.state?.tiles || [], this.cars);
    if (this.signalGeometryKey !== this.trafficController.signalsKey) {
      this.signalGeometryKey = this.trafficController.signalsKey;
      this._buildTrafficSignals();
    }
    this._updateTrafficLights();
  }

  _buildTrafficSignals() {
    this._clear(this.signalGroup);
    this.signalHeads = [];
    this.signalMeshes = {};
    const batch = new InstanceBuilder(this);
    const signalCells = new Set(this.trafficController.signals.map(s => `${s.x},${s.y}`));
    for (const signal of this.trafficController.signals) {
      const x = wx(signal.x), z = wx(signal.y);
      const arms = signal.arms || ['N', 'S', 'E', 'W'];
      // Two modest poles, with back-to-back lamp faces for the two road axes.
      // Lamp emissive materials make them readable without adding scene lights.
      for (const axis of ['ns', 'ew']) {
        const side = axis === 'ns' ? 1 : -1;
        // Place poles on the outside corners of a shared junction footprint.
        if (signalCells.has(`${signal.x + side},${signal.y}`) || signalCells.has(`${signal.x},${signal.y + side}`)) continue;
        const px = x + (axis === 'ns' ? .415 : -.415);
        const pz = z + (axis === 'ns' ? .415 : -.415);
        batch.add('cylinder', 0x596361, px, .335, pz, .025, .59, .025);
        batch.add('cylinder', 0x73796a, px, .075, pz, .079, .080, .079);
        batch.box(0x343e3d, px, .655, pz, axis === 'ns' ? .117 : .087, .287, axis === 'ns' ? .087 : .117);
        batch.box(0x566259, px, .809, pz, axis === 'ns' ? .137 : .105, .021, axis === 'ns' ? .105 : .137);
        const directions = axis === 'ns' ? [['N', -1], ['S', 1]] : [['W', -1], ['E', 1]];
        for (const [direction, side] of directions) {
          if (!arms.includes(direction)) continue;
          const hx = px + (axis === 'ew' ? side * .052 : 0);
          const hz = pz + (axis === 'ns' ? side * .052 : 0);
          this.signalHeads.push({ signalId: signal.id, x: signal.x, y: signal.y, axis, side, px: hx, pz: hz });
          for (let lamp = 0; lamp < 3; lamp++) {
            const py = .744 - lamp * .090;
            batch.add('crown', 0x26332f, hx, py, hz, axis === 'ns' ? .062 : .026, .062, axis === 'ns' ? .026 : .062);
            batch.box(0x303a37, hx + (axis === 'ew' ? side * .009 : 0), py + .040, hz + (axis === 'ns' ? side * .009 : 0), axis === 'ns' ? .082 : .055, .010, axis === 'ns' ? .055 : .082);
          }
        }
      }
      // Lines are 0.62 grid cells out from the junction centre. The controller
      // stops a car's centre another half vehicle length behind this paint.
      for (const direction of arms) {
        const ns = direction === 'N' || direction === 'S';
        const side = direction === 'N' || direction === 'W' ? -1 : 1;
        if (signalCells.has(`${signal.x + (ns ? 0 : side)},${signal.y + (ns ? side : 0)}`)) continue;
        const lane = direction === 'N' || direction === 'E' ? .175 : -.175;
        batch.box(0xf2edd8, x + (ns ? lane : side * .62), .088, z + (ns ? side * .62 : lane), ns ? .29 : .045, .009, ns ? .045 : .29);
      }
    }
    batch.finish(this.signalGroup);
    for (const color of ['red', 'yellow', 'green']) {
      const mesh = new THREE.InstancedMesh(this.geometries.crown, this.signalMaterials[color], this.signalHeads.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.signalMeshes[color] = mesh;
      this.signalGroup.add(mesh);
    }
    this.signalPhaseKey = null;
    this.renderer.shadowMap.needsUpdate = true;
  }

  _updateTrafficLights() {
    const signals = this.trafficController.signals;
    const phaseKey = signals.map(signal => `${signal.id}:${signal.ns}:${signal.ew}`).join('|');
    if (phaseKey === this.signalPhaseKey) return;
    this.signalPhaseKey = phaseKey;
    const signalById = new Map(signals.map(signal => [signal.id, signal]));
    const dummy = this.carDummy;
    for (const [lamp, color] of ['red', 'yellow', 'green'].entries()) {
      const mesh = this.signalMeshes[color];
      if (!mesh) continue;
      this.signalHeads.forEach((head, index) => {
        const signal = signalById.get(head.signalId);
        const active = signal?.[head.axis] === color;
        dummy.position.set(head.px + (head.axis === 'ew' ? head.side * .025 : 0), .744 - lamp * .090, head.pz + (head.axis === 'ns' ? head.side * .025 : 0));
        dummy.rotation.set(0, 0, 0);
        if (active) dummy.scale.set(.089, .089, .089);
        else dummy.scale.set(0, 0, 0);
        dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  getSignalInfo(x, y) {
    const info = this.trafficController.getSignalInfo(x, y);
    return info ? { ...info } : null;
  }

  visitSignal() {
    const signals = this.trafficController.signals;
    if (!signals.length) return null;
    const options = signals.map(signal => {
      let nearby = 0, routes = 0;
      for (const car of this.cars) {
        if (car.visible !== false && Math.abs(car.x - signal.x) + Math.abs(car.y - signal.y) <= 4) nearby++;
        if (car.points.some(p => p.x === signal.x && p.y === signal.y)) routes++;
      }
      return { signal, score: nearby * 6 + routes + (signal.waiting || 0) * 8, busy: nearby > 0 || routes > 0 };
    });
    const busy = options.filter(option => option.busy);
    const pool = busy.length ? busy : options;
    const alternative = pool.filter(option => option.signal.id !== this.lastVisitedSignalId);
    const choices = alternative.length ? alternative : pool;
    choices.sort((a, b) => b.score - a.score);
    const signal = choices[0].signal;
    this.lastVisitedSignalId = signal.id;
    this._frameCityCell(signal.x, signal.y, 10.8);
    this.nextMarkerSelection = 0;
    return { x: signal.x, y: signal.y };
  }

  _frameCityCell(x, y, size = 10.8) {
    this.viewSize = size;
    this.focusCell(x, y);
    // Find a clear patch of the canvas, including a lower central location on
    // narrow displays, so opening the inspector does not cover the junction.
    const rect = this.canvas.getBoundingClientRect(), uiRects = this._markerUiRects();
    if (rect.width < 650) {
      // The compact city overview can be display:none until the caller selects
      // this junction. Reserve its forthcoming 178px inspector before framing.
      uiRects.push({ left: rect.right - 194, right: rect.right - 12, top: rect.top + 94, bottom: rect.bottom - 140 });
    }
    let best = null;
    const columns = rect.width < 650 ? [.28, .38, .50, .58, .68] : [.28, .38, .48, .58, .68];
    const rows = rect.width < 650 ? [.50, .59, .64, .68, .74] : [.40, .50, .60, .68, .74];
    for (const fx of columns) for (const fy of rows) {
      const px = rect.left + rect.width * fx, py = rect.top + rect.height * fy;
      if (uiRects.some(r => px >= r.left - 12 && px <= r.right + 12 && py >= r.top - 12 && py <= r.bottom + 12)) continue;
      let clearance = Math.min(px - rect.left, rect.right - px, py - rect.top, rect.bottom - py);
      for (const r of uiRects) clearance = Math.min(clearance, Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom)));
      const preferredY = rect.width < 650 ? .64 : .54;
      const score = clearance - Math.hypot((fx - (rect.width < 650 ? .50 : .47)) * rect.width, (fy - preferredY) * rect.height) * .2;
      if (!best || score > best.score) best = { px, py, score };
    }
    if (best) {
      const worldAtPixel = this._pointOnGround(best.px, best.py);
      if (worldAtPixel) { this.target.x += wx(x) - worldAtPixel.x; this.target.z += wx(y) - worldAtPixel.z; this._limitCamera(); this._updateCamera(); }
    }
  }

  _setPedestrians(plans=planPedestrians(this.state,this.pedestrianCapacity)) {
    const previous = new Map(this.pedestrians.map(person => [person.id, person]));
    for (const person of this.pedestrians) this.actorById.delete(person.id);
    this.pedestrians = [];
    this.hasResidents=plans.hasResidents;
    for(const plan of plans.people){
      const old=previous.get(plan.id),len=plan.lengths.at(-1);
      const person={...plan,travel:(old?.signature===plan.signature?old.travel:(plan.nameSeed%991)/991*len*2)%(len*2),
        position:old?.position||new THREE.Vector3()};
      this.pedestrians.push(person);this.actorById.set(person.id,person);
    }
    this.walkerBodies.count = this.walkerHeads.count = this.walkerHair.count = this.pedestrians.length;
    this.walkerArms.count = this.walkerLegs.count = this.pedestrians.length * 2;
    const shirts = [0xc1664b, 0x507f98, 0xe4b454, 0xf0dfbd, 0x749765, 0x8b6d94, 0x385f77];
    const skins = [0xdab08c, 0xb9805c, 0xf0cba3, 0xa76d4d];
    const hair = [0x4b453d, 0x684e37, 0xb99766, 0x655e58];
    const color = new THREE.Color();
    this.pedestrians.forEach((person, i) => {
      this.walkerBodies.setColorAt(i, color.set(shirts[person.nameSeed % shirts.length]));
      this.walkerHeads.setColorAt(i, color.set(skins[(person.nameSeed >>> 5) % skins.length]));
      this.walkerHair.setColorAt(i, color.set(hair[(person.nameSeed >>> 8) % hair.length]));
      for (let j = 0; j < 2; j++) {
        this.walkerArms.setColorAt(i * 2 + j, color.set(shirts[person.nameSeed % shirts.length]));
        this.walkerLegs.setColorAt(i * 2 + j, color.set(0x4e5960));
      }
    });
    for (const mesh of [this.walkerBodies, this.walkerHeads, this.walkerHair, this.walkerArms, this.walkerLegs]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this._animatePedestrians(0);
    this.nextMarkerSelection = 0;
  }

  _animatePedestrians(delta) {
    const dummy = this.carDummy;
    const transform = (mesh, i, x, y, z, sx, sy, sz, angle, swing = 0) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(swing, angle, 0, 'YXZ'); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    };
    this.pedestrians.forEach((person, i) => {
      const lengths=person.lengths||person.path.map((_,i)=>i),len=lengths.at(-1);
      if (!this.paused) person.travel += delta * (.22 + (person.nameSeed % 5) * .013);
      const phase = person.travel % (len * 2), reverse = phase > len;
      person.returning=reverse;
      const distance = reverse ? len * 2 - phase : phase;
      let segment=0;while(segment+1<lengths.length-1&&lengths[segment+1]<distance)segment++;
      const fraction=(distance-lengths[segment])/(lengths[segment+1]-lengths[segment]);
      const a = person.path[segment], b = person.path[segment + 1];
      const x = a.x + (b.x - a.x) * fraction, z = a.z + (b.z - a.z) * fraction;
      const pa=a.cell||person.points[Math.min(segment,person.points.length-1)],pb=b.cell||person.points[Math.min(segment+1,person.points.length-1)];
      const axis=a.axis||b.axis||(pa.x!==pb.x?'ew':'ns');
      const ax=a.x+HALF-.5,ay=a.z+HALF-.5,bx=b.x+HALF-.5,by=b.z+HALF-.5;
      const upperA=roadElevation(this.state,ax,ay,axis),upperB=roadElevation(this.state,bx,by,axis);
      const floor=a.height+(b.height-a.height)*fraction-upperA*(1-fraction)-upperB*fraction+roadElevation(this.state,ax+(bx-ax)*fraction,ay+(by-ay)*fraction,axis);
      const angle = Math.atan2((b.x - a.x) * (reverse ? -1 : 1), (b.z - a.z) * (reverse ? -1 : 1));
      const swing = Math.sin(person.travel * 20 + person.nameSeed % 5) * .33;
      const bob = Math.abs(Math.sin(person.travel * 20)) * .007;
      transform(this.walkerBodies, i, x, floor + .205 + bob, z, .105, .145, .075, angle);
      transform(this.walkerHeads, i, x, floor + .323 + bob, z, .09, .105, .09, angle);
      transform(this.walkerHair, i, x, floor + .365 + bob, z, .094, .045, .093, angle);
      for (let j = 0; j < 2; j++) {
        const side = j ? 1 : -1;
        transform(this.walkerArms, i * 2 + j, x + Math.cos(angle) * side * .067, floor + .206 + bob, z - Math.sin(angle) * side * .067, .027, .13, .029, angle, swing * side);
        transform(this.walkerLegs, i * 2 + j, x + Math.cos(angle) * side * .028, floor + .085, z - Math.sin(angle) * side * .028, .037, .135, .043, angle, -swing * side);
      }
      person.position.set(x, floor + .25, z);
      const cell=fraction<.5?pa:pb;person.x=cell.x;person.y=cell.y;
    });
    for (const mesh of [this.walkerBodies, this.walkerHeads, this.walkerHair, this.walkerArms, this.walkerLegs]) mesh.instanceMatrix.needsUpdate = true;
  }

  _actorDescriptor(actor) {
    if(actor.kind==='yacht')return {id:actor.id,kind:'yacht',yachtId:actor.yachtId,x:actor.x,y:actor.y,status:actor.status};
    return { id: actor.id, kind: actor.kind, x: actor.x, y: actor.y, homeId:actor.homeId,workplaceId:actor.workplaceId,returning:actor.kind==='pedestrian'?!!actor.returning:!!actor.returning||!!actor.reverse,origin: { ...actor.points[0] }, destination: { ...actor.points.at(-1) }, routeLength: actor.points.length - 1, nameSeed: actor.nameSeed, waiting: !!actor.waiting, waitReason: actor.waitReason || null };
  }

  getActorDescriptor(id){const actor=this.actorById.get(id);return actor?this._actorDescriptor(actor):null;}

  setOnboardingHint(hint){this.onboardingOverlay.setHint(hint);}

  focusOnboarding(target){
    if(!target)return;
    const hint=this.onboardingOverlay.hint;
    if(hint&&hint.target.x===target.x&&hint.target.y===target.y){target={x:hint.cells.reduce((n,p)=>n+p.x,0)/hint.cells.length,y:hint.cells.reduce((n,p)=>n+p.y,0)/hint.cells.length};}
    const rect=this.canvas.getBoundingClientRect(),region=onboardingMapRegion(rect,this._markerUiRects());
    const count=hint?.cells.length||1;
    this.viewSize=Math.min(24,Math.max(7,(count>1?5:2.5)*rect.height/region.height));this.focusCell(target.x,target.y);
    const at=this._pointOnGround((region.left+region.right)/2,(region.top+region.bottom)/2);
    if(at){this.target.x+=wx(target.x)-at.x;this.target.z+=wx(target.y)-at.z;this._limitCamera();this._updateCamera();}
  }

  setResidentJourney(journey){this.residentRoute.setJourney(journey,this.state);}

  focusResidentJourney(){
    const journey=this.residentRoute.journey;if(!journey)return;
    const points=[journey.from,...journey.points,journey.to];
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x+(p.size||1)-1));
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y+(p.size||1)-1));
    // Fit the isometric projection, leaving room for the route card and toolbar.
    const dx=maxX-minX+3,dy=maxY-minY+3,sin=Math.abs(Math.sin(this.azimuth)),cos=Math.abs(Math.cos(this.azimuth));
    const rect=this.canvas.getBoundingClientRect(),card=document.getElementById('resident-journey')?.getBoundingClientRect();
    const top=Math.max(rect.top+24,(card?.bottom||rect.top)+30);
    const controls=[...document.querySelectorAll('.map-controls,.overlay-controls,.build-toolbar')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.top>top);
    const bottom=Math.min(rect.bottom-24,...controls.map(r=>r.top-12));
    const usable=Math.max(rect.height*.25,bottom-top);
    this.viewSize=Math.min(90,Math.max(12,(dx*cos+dy*sin)/this.aspect*1.25,(dx*sin+dy*cos)*.707*rect.height/usable));
    this.focusCell((minX+maxX)/2,(minY+maxY)/2);
    const at=this._pointOnGround(rect.left+rect.width/2,top+usable/2);
    if(at){this.target.x+=wx((minX+maxX)/2)-at.x;this.target.z+=wx((minY+maxY)/2)-at.z;this._limitCamera();this._updateCamera();}
  }

  _actorScreen(actor) {
    const ndc = actor.position.clone().project(this.camera), rect = this.canvas.getBoundingClientRect();
    const x = rect.left + (ndc.x + 1) * rect.width / 2, y = rect.top + (1 - ndc.y) * rect.height / 2;
    return { x, y, ndc, inView: actor.visible !== false && ndc.z > -1 && ndc.z < 1 && x >= rect.left + 18 && x <= rect.right - 18 && y >= rect.top + 24 && y <= rect.bottom - 24 };
  }

  _actorUnobscured(actor, screen = this._actorScreen(actor)) {
    if (!screen.inView) return false;
    if (!this.buildingPickMesh?.count) return true;
    this.actorRaycaster.setFromCamera(new THREE.Vector2(screen.ndc.x, screen.ndc.y), this.camera);
    const actorDistance = this.actorRaycaster.ray.direction.dot(actor.position.clone().sub(this.actorRaycaster.ray.origin));
    const hit = this.actorRaycaster.intersectObject(this.buildingPickMesh, false)[0];
    return !hit || hit.distance >= actorDistance - .07;
  }

  _actorAt(clientX, clientY) {
    if (!this.hasResidents) return null;
    const candidates = [...this.pedestrians, ...this.cars.filter(actor=>!isPublicVehicleKind(actor.kind)),...(this.yachts||[])].map(actor => {
      const screen = this._actorScreen(actor);
      return { actor, screen, distance: Math.hypot(clientX - screen.x, clientY - screen.y) };
    }).filter(c => c.screen.inView && c.distance <= (c.actor.kind === 'pedestrian' ? 9 : 10)).sort((a, b) => a.distance - b.distance);
    return candidates.find(c => this._actorUnobscured(c.actor, c.screen))?.actor || null;
  }

  _markerUiRects() {
    return [...document.querySelectorAll('.topbar,.left-rail,.right-rail,.map-controls,.overlay-controls,.tool-context,.build-toolbar,.tool-submenu,.onboarding-card,.mobile-map-triggers,.panel-toggle')].filter(el => !el.hidden && el.getClientRects().length).map(el => el.getBoundingClientRect());
  }

  _markerFits(screen, uiRects) {
    const y = screen.y - 13;
    return screen.inView && !uiRects.some(r => screen.x > r.left - 18 && screen.x < r.right + 18 && y > r.top - 18 && y < r.bottom + 32);
  }

  _updateActorMarkers() {
    if (this.buildingFilter || this.tool !== 'inspect' || !this.hasResidents || document.querySelector('dialog[open]')) {
      this.actorMarkers.forEach(marker => { marker.button.hidden = true; });
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (this.elapsed >= this.nextMarkerSelection) {
      this.nextMarkerSelection = this.elapsed + 1;
      this.markerUiRects = this._markerUiRects();
      const used = new Set(), chosenScreens = [];
      for (let slot = 0; slot < this.actorMarkers.length; slot++) {
        const marker = this.actorMarkers[slot], previous = this.actorById.get(marker.actorId);
        const desiredKind = slot < 2 ? 'pedestrian' : 'car';
        const candidates = [...this.pedestrians, ...this.cars.filter(actor=>!isPublicVehicleKind(actor.kind))].map(actor => ({ actor, screen: this._actorScreen(actor) })).filter(c => !used.has(c.actor.id) && this._markerFits(c.screen, this.markerUiRects));
        candidates.sort((a, b) => {
          const score = c => (c.actor === previous ? -1000 : 0) + ((desiredKind === 'pedestrian') === (c.actor.kind === 'pedestrian') ? -300 : 0) + Math.hypot(c.screen.x - (rect.left + rect.width * (.39 + slot * .10)), c.screen.y - (rect.top + rect.height * .49));
          return score(a) - score(b);
        });
        const choice = candidates.find(c => chosenScreens.every(s => Math.hypot(s.x - c.screen.x, s.y - c.screen.y) > 62) && this._actorUnobscured(c.actor, c.screen));
        marker.actorId = choice?.actor.id || null; marker.unobscured = !!choice;
        if (choice) { used.add(choice.actor.id); chosenScreens.push(choice.screen); }
      }
      this.nextMarkerVisibility = 0;
    }
    const checkOcclusion = this.elapsed >= this.nextMarkerVisibility;
    if (checkOcclusion) { this.nextMarkerVisibility = this.elapsed + .2; this.markerUiRects = this._markerUiRects(); }
    const containerRect = this.container.getBoundingClientRect();
    for (const marker of this.actorMarkers) {
      const actor = this.actorById.get(marker.actorId);
      if (!actor) { marker.button.hidden = true; continue; }
      const screen = this._actorScreen(actor);
      if (checkOcclusion) marker.unobscured = this._actorUnobscured(actor, screen);
      marker.button.hidden = !marker.unobscured || !this._markerFits(screen, this.markerUiRects || []);
      if (!marker.button.hidden) {
        marker.button.style.left = `${screen.x - containerRect.left}px`;
        marker.button.style.top = `${screen.y - containerRect.top - 13}px`;
        marker.button.dataset.actorId = actor.id; marker.button.dataset.kind = actor.kind;
        const label = actor.kind === 'pedestrian' ? '听听行人说什么' : actor.kind === 'freight' ? '听听送货司机说什么' : '听听司机说什么';
        marker.button.setAttribute('aria-label', label); marker.button.title = label;
      }
    }
  }

  visitActor() {
    if (!this.hasResidents) return null;
    const all = [...this.pedestrians, ...this.cars.filter(actor=>!isPublicVehicleKind(actor.kind))].filter(actor => actor.visible !== false);
    if (!all.length) return null;
    const withoutLast = all.filter(actor => actor.id !== this.lastVisitedId);
    const available = withoutLast.length ? withoutLast : all;
    const uiRects = this._markerUiRects();
    const visible = available.filter(actor => { const screen = this._actorScreen(actor); return this._markerFits(screen, uiRects) && this._actorUnobscured(actor, screen); });
    const candidates = visible.length ? visible : available;
    const preferred = candidates.filter(actor => (actor.kind === 'pedestrian') !== (this.lastVisitedKind === 'pedestrian'));
    const pool = preferred.length ? preferred : candidates;
    const actor = pool[this.visitCount++ % pool.length];
    this.lastVisitedId = actor.id; this.lastVisitedKind = actor.kind;
    this.focusCell(actor.x, actor.y);
    this.nextMarkerSelection = 0;
    return this._actorDescriptor(actor);
  }

  _pointOnGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
  }

  _cellAt(clientX, clientY) {
    const point = this._pointOnGround(clientX, clientY);
    if (!point) return null;
    if(this.tool==='move'&&this.pointerState?.moveOffset){
      const x=Math.floor(point.x+HALF)-this.pointerState.moveOffset.x,y=Math.floor(point.z+HALF)-this.pointerState.moveOffset.y;
      return inGrid(this.state,x,y)?{x,y}:null;
    }
    if (!this.roadFocus && ['inspect', 'bulldoze', 'upgrade', 'move'].includes(this.tool) && this.buildingPickMesh) {
      const hit = this.raycaster.intersectObject(this.buildingPickMesh, false)[0];
      if (hit) return { ...this.buildingPickCells[hit.instanceId] };
    }
    const x = Math.floor(point.x + HALF), y = Math.floor(point.z + HALF);
    return inGrid(this.state,x,y)?{x,y}:null;
  }

  _hover(cell) {
    const same = cell?.x === this.hovered?.x && cell?.y === this.hovered?.y;
    this.hovered = cell;
    this.hoverRing.visible = !!cell && this.tool === 'inspect';
    if (cell) this.hoverRing.position.set(wx(cell.x), this._tile(cell.x, cell.y)?.terrain === 'water' ? .14 : 0, wx(cell.y));
    if (!same) this.callbacks.onHover(cell);
  }

  _syncUpgradeMarkers(){
    this.upgradeMarkers??=new Map();
    const keep=new Set();
    this.state.buildings.filter(b=>matchesBuildingFilter(b,this.buildingFilter)).forEach((b,index)=>{
      const offer=upgradeOffer(b,this.state);
      if(!offer.allowed||offer.cost>this.state.money)return;
      const preview=this.callbacks.getUpgradePreview?.(b);
      if(!preview?.valid)return;
      keep.add(b.id);
      let marker=this.upgradeMarkers.get(b.id);
      if(!marker){
        const button=document.createElement('button');button.type='button';button.className='upgrade-marker';
        for(const event of ['pointerdown','pointerup','pointermove','dblclick','keydown','keyup'])button.addEventListener(event,e=>e.stopPropagation());
        button.addEventListener('click',e=>{e.stopPropagation();this.callbacks.onUpgrade?.(marker.building);});
        this.container.appendChild(button);marker={button};this.upgradeMarkers.set(b.id,marker);
      }
      marker.building=b;
      const matrix=new THREE.Matrix4();this.buildingPickMesh.getMatrixAt(index,matrix);
      marker.position=new THREE.Vector3(matrix.elements[12],matrix.elements[13]+matrix.elements[5]/2+.18,matrix.elements[14]);
      const price=preview.cost.toLocaleString('zh-CN');
      marker.button.innerHTML=`<span aria-hidden="true">↑</span><small>¥${price}</small>`;
      marker.button.title=`升级至 ${b.level+1} 级 · ¥${price} · 点击直接升级`;
      marker.button.setAttribute('aria-label',`建筑 (${b.x}, ${b.y}) 升级至 ${b.level+1} 级需要 ${price} 元，点击直接升级`);
    });
    for(const [id,marker] of this.upgradeMarkers)if(!keep.has(id)){marker.button.remove();this.upgradeMarkers.delete(id);}
  }

  setUpgradeMarkersVisible(visible){
    this.upgradeMarkersVisible=!!visible;
    this._updateUpgradeMarkers();
  }

  _updateUpgradeMarkers(){
    if(!this.upgradeMarkers?.size)return;
    const hidden=this.upgradeMarkersVisible===false||this.roadFocus||this.tool!=='upgrade'||!!document.querySelector('dialog[open]');
    const rect=this.canvas.getBoundingClientRect(),parent=this.container.getBoundingClientRect();
    for(const marker of this.upgradeMarkers.values()){
      const p=marker.position.clone().project(this.camera);
      marker.button.hidden=hidden||Math.abs(p.x)>.96||Math.abs(p.y)>.94||Math.abs(p.z)>1;
      if(!marker.button.hidden){
        marker.button.style.left=`${rect.left-parent.left+(p.x+1)*rect.width/2}px`;
        marker.button.style.top=`${rect.top-parent.top+(1-p.y)*rect.height/2}px`;
      }
    }
  }

  _bindEvents() {
    this.listeners = [];
    this.touchPointers = new Map();
    this.pinchState = null;
    const bind = (target, name, handler, options) => { target.addEventListener(name, handler, options); this.listeners.push([target, name, handler, options]); };
    const isTouch = e => e.pointerType === 'touch';
    const releaseCapture = id => {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    };
    const setRestingCursor = () => {
      this.canvas.style.cursor = this.catalogMode ? 'ew-resize' : this.tool === 'inspect' ? 'grab' : 'crosshair';
    };
    const beginPinch = e => {
      const pair = [...this.touchPointers.entries()].slice(0, 2);
      if (pair.length < 2) return;
      if (this.pointerState) {
        const building = !this.pointerState.pan && !this.pointerState.rotating && this.tool !== 'inspect';
        this.pointerState = null;
        this.setPreview([]);
        if (building) this.callbacks.onDragEnd(null, e);
      }
      const [[firstId, first], [secondId, second]] = pair;
      this.pinchState = {
        ids: [firstId, secondId],
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      this.civicFollow = null;
      this.canvas.style.cursor = 'grabbing';
      if (!this.catalogMode) this._hover(null);
    };
    const endTouchPointer = e => {
      if (!isTouch(e) || !this.touchPointers.has(e.pointerId)) return false;
      const wasPinching = !!this.pinchState;
      const wasPinchPointer = this.pinchState?.ids.includes(e.pointerId);
      this.touchPointers.delete(e.pointerId);
      releaseCapture(e.pointerId);
      if (wasPinching && wasPinchPointer) {
        this.pinchState = null;
        if (this.touchPointers.size >= 2) beginPinch(e);
        else setRestingCursor();
      }
      return wasPinching;
    };
    bind(this.canvas, 'contextmenu', e => e.preventDefault());
    bind(this.canvas, 'wheel', e => {
      e.preventDefault();
      const before = this._pointOnGround(e.clientX, e.clientY);
      this.zoomBy(Math.exp(e.deltaY * .001));
      const after = this._pointOnGround(e.clientX, e.clientY);
      if (before && after) { this.target.add(before.sub(after)); this._limitCamera(); this._updateCamera(); }
      this._hover(this._cellAt(e.clientX, e.clientY));
    }, { passive: false });
    bind(this.canvas, 'pointerdown', e => {
      if (isTouch(e)) {
        this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.canvas.setPointerCapture(e.pointerId);
        if (this.touchPointers.size >= 2) {
          if (!this.pinchState) beginPinch(e);
          e.preventDefault();
          return;
        }
      }
      if (this.pointerState) return;
      this.canvas.focus({ preventScroll: true });
      if (!isTouch(e)) this.canvas.setPointerCapture(e.pointerId);
      const rotating = e.button === 2 || (e.button === 0 && (e.altKey || this.catalogMode));
      const cell=this._cellAt(e.clientX,e.clientY);
      const tile=cell?this._tile(cell.x,cell.y):null;
      const hiddenByFilter=this.buildingFilter&&!matchesBuildingFilter(this.state.buildings.find(b=>b.id===tile?.buildingId),this.buildingFilter);
      const emptyTile=hiddenByFilter||(!tile?.road&&tile?.buildingId==null);
      const emptyToolDrag=e.button===0&&emptyTile&&(this.tool==='upgrade'||(this.tool==='move'&&this.callbacks.shouldPanEmptyMove?.()));
      const pan = !rotating && (e.button === 1 || this.spaceDown || emptyToolDrag);
      if (pan || rotating || this.tool !== 'inspect') this.civicFollow = null;
      this.pointerState = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, pan, rotating, moved: false, cell };
      if(this.tool==='move'&&cell&&!pan&&!rotating&&tile?.buildingId!=null){const ground=this._pointOnGround(e.clientX,e.clientY);if(ground)this.pointerState.moveOffset={x:Math.floor(ground.x+HALF)-cell.x,y:Math.floor(ground.z+HALF)-cell.y};}
      if (rotating) this.canvas.style.cursor = 'ew-resize';
      else if (pan) this.canvas.style.cursor = 'grabbing';
      else if (e.button === 0 && this.pointerState.cell && this.tool !== 'inspect') this.callbacks.onDragStart(this.pointerState.cell, e);
      e.preventDefault();
    });
    bind(this.canvas, 'pointermove', e => {
      if (isTouch(e) && this.touchPointers.has(e.pointerId)) {
        this.touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pinch = this.pinchState;
        if (pinch) {
          const first = this.touchPointers.get(pinch.ids[0]);
          const second = this.touchPointers.get(pinch.ids[1]);
          if (first && second && pinch.ids.includes(e.pointerId)) {
            const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
            const x = (first.x + second.x) / 2;
            const y = (first.y + second.y) / 2;
            const before = this._pointOnGround(pinch.x, pinch.y);
            this.zoomBy(pinch.distance / distance);
            const after = this._pointOnGround(x, y);
            if (before && after) {
              this.target.add(before.sub(after));
              this._limitCamera();
              this._updateCamera();
            }
            pinch.distance = distance;
            pinch.x = x;
            pinch.y = y;
          }
          e.preventDefault();
          return;
        }
      }
      const ps = this.pointerState;
      if (ps && ps.id === e.pointerId) {
        ps.moved ||= Math.abs(e.clientX - ps.startX) + Math.abs(e.clientY - ps.startY) > 4;
        if (ps.rotating) {
          this.rotateBy((e.clientX - ps.x) * .006);
        } else if (ps.pan || (this.tool === 'inspect' && ps.moved)) {
          this.civicFollow = null;
          const a = this._pointOnGround(ps.x, ps.y), b = this._pointOnGround(e.clientX, e.clientY);
          if (a && b) { this.target.add(a.sub(b)); this._limitCamera(); this._updateCamera(); }
          this.canvas.style.cursor = 'grabbing';
        } else if (this.tool !== 'inspect') {
          const cell = this._cellAt(e.clientX, e.clientY);
          if (cell && (cell.x !== ps.cell?.x || cell.y !== ps.cell?.y)) { ps.cell = cell; this.callbacks.onDragMove(cell, e); }
        }
        ps.x = e.clientX; ps.y = e.clientY;
      }
      if(!this.catalogMode)this._hover(this._cellAt(e.clientX, e.clientY));
    });
    bind(this.canvas, 'pointerup', e => {
      if (endTouchPointer(e)) {
        this.pointerState = null;
        e.preventDefault();
        return;
      }
      const ps = this.pointerState;
      if (!ps || ps.id !== e.pointerId) return;
      const cell = this._cellAt(e.clientX, e.clientY);
      if(ps.pan&&!ps.moved&&this.tool==='upgrade'&&this.buildingFilter)this.callbacks.onBuildingFilterClear?.();
      if (!ps.pan && !ps.rotating) {
        if (this.tool === 'inspect') {
          if (!ps.moved) {
            this.civicFollow = null;
            const actor = this.buildingFilter?null:this._actorAt(e.clientX, e.clientY);
            if (actor) this.callbacks.onActorSelect(this._actorDescriptor(actor));
            else if (cell) this.callbacks.onSelect(cell, e);
          }
        }
        else this.callbacks.onDragEnd(this.tool==='move'?cell:(cell || ps.cell), e);
      }
      this.pointerState = null;
      releaseCapture(e.pointerId);
      setRestingCursor();
    });
    bind(this.canvas, 'pointercancel', e => {
      if (endTouchPointer(e)) {
        this.pointerState = null;
        e.preventDefault();
        return;
      }
      const building = this.pointerState && !this.pointerState.pan && !this.pointerState.rotating && this.tool !== 'inspect';
      this._releasePointer(); this.setPreview([]);
      if (building) this.callbacks.onDragEnd(null, e);
    });
    bind(this.canvas, 'pointerleave', () => { if (!this.pointerState) this._hover(null); });
    bind(window, 'keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
      if (e.code === 'Space') { this.spaceDown = true; if (document.activeElement === this.canvas) e.preventDefault(); }
    });
    bind(window, 'keyup', e => { if (e.code === 'Space') this.spaceDown = false; });
    bind(window, 'blur', e => {
      const building = this.pointerState && !this.pointerState.pan && !this.pointerState.rotating && this.tool !== 'inspect';
      this.spaceDown = false; this._releasePointer();
      if (building) { this.setPreview([]); this.callbacks.onDragEnd(null, e); }
    });
  }

  _releasePointer() {
    if (this.pointerState && this.canvas.hasPointerCapture(this.pointerState.id)) this.canvas.releasePointerCapture(this.pointerState.id);
    for (const id of this.touchPointers?.keys() || []) {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    }
    this.touchPointers?.clear();
    this.pinchState = null;
    this.pointerState = null;
    this.canvas.style.cursor = this.catalogMode ? 'ew-resize' : this.tool === 'inspect' ? 'grab' : 'crosshair';
  }

  _limitCamera() {
    if(this.interchangeFrame){const b=interchangeBounds(this.interchangeFrame);this.target.set(wx(b.cx),this.interchangeFrameElevation,wx(b.cy));return;}
    const edge=mapSize(this.state)-HALF+1;this.target.x = clamp(this.target.x, -33, edge); this.target.z = clamp(this.target.z, -33, edge);
  }
  focusCell(x, y) { this.civicFollow = null; this.target.set(wx(x), 0, wx(y)); this._limitCamera(); this._updateCamera(); }
  frameInterchange(item){
    this.interchangeFrame={...item};this.civicFollow=null;
    const b=interchangeBounds(item),height=interchangeAt(this.state,item)?INTERCHANGE_HEIGHT+.3:.2;
    this.interchangeFrameElevation=height/2;
    // Include approaches in all four directions, so before/after views share
    // the same footprint. Fit its actual projection on narrow and wide panels.
    const dx=b.width+6,dz=b.height+6,sin=Math.abs(Math.sin(this.azimuth)),cos=Math.abs(Math.cos(this.azimuth));
    const width=dx*cos+dz*sin,vertical=(dx*sin+dz*cos+height)/Math.SQRT2;
    this.viewSize=Math.max(8,width/Math.max(.1,this.aspect)/.84,vertical/.84);
    this._limitCamera();this._updateCamera();
  }
  zoomBy(factor) { this.civicFollow = null; this.viewSize = clamp(this.viewSize * factor, this.catalogMode?1.05:8, 65); this._updateCamera(); }
  rotateBy(angle) { this.civicFollow = null; this.azimuth = (this.azimuth + angle) % (Math.PI * 2);if(this.interchangeFrame)this.frameInterchange(this.interchangeFrame);else this._updateCamera(); }
  rotate(direction = 1) { this.rotateBy(Math.PI / 12 * direction); }
  setCatalogMode(enabled=true){
    this.catalogMode=!!enabled;
    this.canvas.style.cursor=this.catalogMode?'ew-resize':this.tool==='inspect'?'grab':'crosshair';
    this.canvas.setAttribute('aria-label',this.catalogMode?'图鉴三维模型，单指左右拖动旋转，双指捏合或滚轮缩放':'湾畔市地图，单指拖动平移，双指捏合缩放；鼠标左键建设，滚轮缩放，右键拖动旋转，空格或中键拖动平移；升级模式和未选目标的移动模式可拖动空地平移');
  }
  resetCamera() { this.viewSize = 27; this.azimuth = Math.PI / 4; this.focusCell(22, 31); }
  celebrateResidents({grand=false}={}){
    this.clearStreetCelebration();
    this.streetCelebration=new StreetCelebration(this.state,{grand,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
    this.scene.add(this.streetCelebration.group);
    const site=this.streetCelebration.sites[0];
    if(site){this.viewSize=Math.min(this.viewSize,14);this.focusCell(site.x,site.y);}
  }
  clearStreetCelebration(){this.streetCelebration?.dispose();this.streetCelebration=null;}
  setLightingMode(mode){
    this.lightingMode=LIGHTING_MODES.includes(mode)?mode:'day';
  }
  _animateLighting(delta){
    if(!this.paused)this.lightingClock+=delta*this.speed;
    const target=nightAmount(this.lightingMode,this.lightingClock);
    this.nightBlend+=(target-this.nightBlend)*Math.min(1,delta*2.5);
    const n=this.nightBlend;
    this.scene.background.set(0xdfe8d7).lerp(new THREE.Color(0x14243d),n);
    this.scene.fog.color.copy(this.scene.background);
    this.ambient.color.set(0xe6f1ec).lerp(new THREE.Color(0x93b5e2),n);
    this.ambient.groundColor.set(0xaba985).lerp(new THREE.Color(0x283652),n);
    this.ambient.intensity=2.15*(1-n)+.65*n;
    this.sun.color.set(0xffedd0).lerp(new THREE.Color(0x92b9ec),n);
    this.sun.intensity=3.05*(1-n)+.38*n;
    this.nightLighting.setAmount(n,this.lightingClock);
    this.vehicleLighting?.setAmount(n,!!this.roadFocus);
    this.civicRoadLighting?.setAmount(n);
    if(this.waterMaterial?.uniforms.night)this.waterMaterial.uniforms.night.value=n;
  }
  setPaused(value) { this.paused = !!value; }
  setSpeed(value) { this.speed = Number.isFinite(Number(value)) ? clamp(Number(value), .25, 8) : 1; }
  projectCell(x, y) {
    const point = new THREE.Vector3(wx(x), .05, wx(y)).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }

  _frame(now) {
    if (this.disposed) return;
    const delta = Math.min((now - this.lastFrame) / 1000, .06);
    this.lastFrame = now;
    this.elapsed += delta;
    this._animateLighting(delta);
    if (this.waterMaterial) this.waterMaterial.uniforms.time.value = this.elapsed;
    const simulationDelta = this.paused ? 0 : delta * this.speed;
    this._animateTraffic(simulationDelta);
    this._animatePedestrians(simulationDelta);
    this._animateCivic(simulationDelta);
    this._animateYachts(simulationDelta);
    this._animateFireIncidents();
    if(this.streetCelebration&&!this.streetCelebration.update(this.paused?0:delta,this.state))this.clearStreetCelebration();
    this._updateActorMarkers();
    this._updateUpgradeMarkers();
    this.directionGuide?.update(this.camera,this.canvas.getBoundingClientRect(),this.container.getBoundingClientRect());
    if(this.residentRoute.journey)this.residentRoute.update(this.camera,this.canvas.getBoundingClientRect(),this.container.getBoundingClientRect(),this.tool==='inspect'&&!document.querySelector('dialog[open]'));
    if(this.onboardingOverlay.hint)this.onboardingOverlay.update(this.camera,this.canvas.getBoundingClientRect(),this.container.getBoundingClientRect(),this.elapsed,!document.querySelector('dialog[open]')&&!this.residentRoute.journey);
    this.selectionRing.material.opacity = .76 + Math.sin(this.elapsed * 3) * .20;
    const layerPulse=(Math.sin(this.elapsed*3.2)+1)/2;
    for(const mesh of this.layerBuildingHighlightGroup?.children||[]){
      mesh.material.opacity=mesh.userData.highlightFill ? .28+layerPulse*.16 : .76+layerPulse*.24;
      if(mesh.userData.highlightLocator)mesh.position.y=Math.sin(this.elapsed*3.2)*.045;
    }
    for (const marker of this.coverageGroup.children) {
      if (marker.userData.selectionHighlight) marker.material.opacity = .34 + Math.sin(this.elapsed * 3) * .10;
    }
    this.renderer.render(this.scene, this.camera);
    this.animation = requestAnimationFrame(this._frame);
  }

  dispose() {
    this.disposed = true;
    this.nightLighting?.dispose();
    this.vehicleLighting?.dispose();this.civicRoadLighting?.dispose();
    this.residentRoute?.dispose();
    this.onboardingOverlay?.dispose();
    this.directionGuide?.dispose();
    this.clearMoveGhost();
    this.clearStreetCelebration();
    for(const marker of this.upgradeMarkers?.values()||[])marker.button.remove();
    cancelAnimationFrame(this.animation);
    this.resizeObserver.disconnect();
    this.listeners.forEach(([target, event, handler, options]) => target.removeEventListener(event, handler, options));
    this._clear(this.coverageGroup); this._clear(this.terrainGroup); this._clear(this.cityGroup); this._clear(this.overlayGroup); this._clear(this.layerBuildingHighlightGroup); this._clear(this.bridgeHintGroup); this._clear(this.signalGroup);
    this._clearFireIncidentEffects();
    this._clear(this.fireTruck); this._clear(this.civicEffects);
    this.civicBlueMaterial.dispose(); this.civicBeaconMaterial.dispose(); this.civicBeaconGeometry.dispose();
    this.civicDrillLabel.remove();
    this.civicVehicleLabel.remove();
    for (const g of Object.values(this.geometries)) g.dispose();
    this.material.dispose(); this.previewMaterial.dispose(); this.previewLineMaterial.dispose();
    for (const material of Object.values(this.signalMaterials)) material.dispose();
    for (const ring of [this.hoverRing, this.selectionRing]) { ring.geometry.dispose(); ring.material.dispose(); }
    this.previewLines.geometry.dispose();
    this.previewMesh.dispose();
    this.servicePreviewMesh.dispose();this.servicePreviewMaterial.dispose();
    for (const mesh of this.dynamicMeshes) mesh.dispose();
    for (const marker of this.actorMarkers) marker.button.remove();
    this.buildingPickMesh?.dispose();
    for(const a of this.yachts||[]){this.scene.remove(a.model);a.model.userData.dispose();}
    this.renderer.dispose();
    this.canvas.remove();
  }
}
