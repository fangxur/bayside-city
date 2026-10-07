import test from 'node:test';
import assert from 'node:assert/strict';
import {CitySimulation} from '../src/simulation.js';
import {newMarinaLife,settleMarinaMonth,marinaBerths,marinaCapacity,yachtRoutes,yachtPose,shipyardReady,loadMarinaLife} from '../src/marina.js';
import {upgradeOffer,maintenanceMultiplier} from '../src/progression.js';
import {communityService} from '../src/community-buildings.js';
import {getCitizenStory} from '../src/city-life.js';
import {createYachtModel,updateYachtActor} from '../src/yacht-rendering.js';
function town(){
 const s=new CitySimulation();s.state.money=100000;
 for(let x=0;x<=10;x++)s.tile(x,32).road=1;
 s._newBuilding(1,31,'power',true);s._newBuilding(2,31,'water',true);
 s.tile(3,31).businessKind='shipyard';s._newBuilding(3,31,'industrial',true);
 const home=s._newBuilding(5,31,'residential',true);home.level=3;home.population=20;
 s.recalculate();assert(s.build('marina',[{x:35,y:30}]).ok);return s;
}
function month(s,n){s.state.month=n;s.state.tick=(n-1)*15;s.recalculate();settleMarinaMonth(s.state);}
test('marinas require shoreline and navigable water without a road and charge once for the entire plot',()=>{
 const s=new CitySimulation(),before=s.serialize();assert(!s.build('marina',[{x:5,y:30}]).ok);assert.equal(s.serialize(),before);
 assert(s.preview('marina',[{x:35,y:30}]).valid);
 const money=s.state.money;assert(s.build('marina',[{x:35,y:30}]).ok);assert.equal(s.state.money,money-6500);
 const marina=s.state.buildings[0];assert.equal(marina.footprint,2);assert.equal(marinaBerths(s.state,marina).length,2);
 assert(!s.moveBuilding(marina.id,{x:4,y:30}).ok);
});
test('marinas upgrade only at population stages and expand berths, jobs and service',()=>{
 const s=town(),marina=s.state.buildings.find(b=>b.type==='marina'),gates=[1000,5000,10000,20000,50000],capacities=[2,3,4,5,6,8];
 marina.progress=1;s.recalculate();
 assert.equal(marinaBerths(s.state,marina).length,capacities[0]);
 for(let index=0;index<gates.length;index++){
  const gate=gates[index],beforeJobs=communityService(marina).jobs,beforeRadius=communityService(marina).radius,beforeMaintenance=maintenanceMultiplier(marina);
  s.state.stats.population=gate-1;
  const locked=upgradeOffer(marina,s.state);assert(!locked.allowed);assert.match(locked.reason,new RegExp(gate.toLocaleString('zh-CN')));
  s.state.stats.population=gate;
  const offer=upgradeOffer(marina,s.state),funds=s.state.money;assert(offer.allowed);assert.match(offer.reason,/泊位/);
  assert(s.build('upgrade',[{x:35,y:30}]).ok);assert.equal(s.state.money,funds-offer.cost);
  marina.progress=1;s.recalculate();
  assert.equal(marina.level,index+2);assert.equal(marinaCapacity(marina),capacities[index+1]);assert.equal(marinaBerths(s.state,marina).length,capacities[index+1]);
  assert(communityService(marina).jobs>beforeJobs);assert(communityService(marina).radius>beforeRadius);assert(maintenanceMultiplier(marina)>beforeMaintenance);
 }
 assert(!upgradeOffer(marina,s.state).allowed);assert.equal(CitySimulation.deserialize(s.serialize()).state.buildings.find(b=>b.id===marina.id).level,6);
});
test('wealthy residents buy only with personal savings, operational shipyard and available berth',()=>{
 const s=town(),money=s.state.money,home=s.state.buildings.find(b=>b.type==='residential'),factory=s.state.buildings.find(b=>b.businessKind==='shipyard');
 assert(shipyardReady(s.state));month(s,1);month(s,2);assert.equal(s.state.marinaLife.boats.length,0);
 factory.active=false;month(s,3);assert.equal(s.state.marinaLife.boats.length,0);assert.equal(s.state.marinaLife.accounts[0].balance,9000);
 factory.active=true;month(s,4);assert.equal(s.state.marinaLife.boats.length,1);assert.equal(s.state.marinaLife.accounts[0].balance,4000);assert.equal(s.state.money,money);
 settleMarinaMonth(s.state);assert.equal(s.state.marinaLife.accounts[0].balance,4000);
 const boat=s.state.marinaLife.boats[0];assert.equal(boat.homeId,home.id);
 const copy=CitySimulation.deserialize(s.serialize());assert.deepEqual(copy.state.marinaLife,s.state.marinaLife);
 const story=getCitizenStory(copy.state,{kind:'yacht',yachtId:boat.id,status:'出航中'});assert.equal(story.home.id,home.id);assert.equal(story.role,'居民船主');assert(story.suggestion);
 home.level=1;month(s,5);assert.equal(s.state.marinaLife.boats.length,1);assert.equal(s.state.marinaLife.accounts[0].balance,4000);
});
test('yachts sail only through water, dock and return; paused ports stop voyages and deleted ports retain ownership',()=>{
 const s=town();for(let n=1;n<=3;n++)month(s,n);
 let entry=yachtRoutes(s.state)[0];assert(entry.operating);const statuses=new Set();
 for(let t=0;t<160;t+=.5){const p=yachtPose(entry,t);statuses.add(p.status);const tile=s.tile(Math.round(p.x),Math.round(p.y));assert.equal(tile.terrain,'water');assert(!tile.road||tile.bridge);}
 assert(statuses.has('停泊中'));assert(statuses.has('出航中'));assert(statuses.has('返港中'));
 s.setBuildingActive(entry.marina.id,false);entry=yachtRoutes(s.state)[0];assert(!entry.operating);assert.equal(yachtPose(entry,90).status,'暂停航行');
 s.setBuildingActive(entry.marina.id,true);
 const blocked=entry.route[2];s.state.tiles[blocked].road=1;s.recalculate();assert(!yachtRoutes(s.state)[0].route.includes(blocked));
 s.state.tiles[blocked].bridge=true;s.recalculate();entry=yachtRoutes(s.state)[0];assert(entry.route.includes(blocked));assert(entry.bridgeRoutePositions.includes(entry.route.indexOf(blocked)));
 assert(s.build('bulldoze',[{x:35,y:30}]).ok);assert.equal(s.state.marinaLife.boats[0].marinaId,null);assert.equal(yachtRoutes(s.state).length,0);
 assert.equal(CitySimulation.deserialize(s.serialize()).state.marinaLife.boats.length,1);
 assert(s.undo().ok);assert.equal(yachtRoutes(s.state).length,1);
});
test('marina saves reject duplicate owners and invalid records, and legacy saves receive empty ownership',()=>{
 const s=town();for(let n=1;n<=3;n++)month(s,n);
 const raw=JSON.parse(s.serialize());raw.marinaLife.boats.push({...raw.marinaLife.boats[0]});assert.throws(()=>CitySimulation.deserialize(JSON.stringify(raw)));
 delete raw.marinaLife;assert.deepEqual(CitySimulation.deserialize(JSON.stringify(raw)).state.marinaLife,newMarinaLife());
 assert.throws(()=>loadMarinaLife({accounts:[],boats:[],nextId:1,lastMonth:NaN},[],1));
});
test('both yacht models have finite geometry and release their resources',()=>{
 for(const kind of ['motor','cruiser']){const group=createYachtModel(kind);assert(group.children.length>10);for(const mesh of group.children){assert(mesh.position.toArray().every(Number.isFinite));assert(mesh.scale.toArray().every(n=>Number.isFinite(n)&&n>0));}group.userData.dispose();}
});
test('a yacht is visually occluded only while passing beneath a bridge deck',()=>{
 const model=createYachtModel('motor'),actor={position:model.position.clone(),model},entry={boat:{id:0},berth:0,route:[0,1,2],bridgeRoutePositions:[1],gridSize:64,operating:true};
 updateYachtActor(actor,entry,26.5);assert.equal(yachtPose(entry,26.5).underBridge,true);assert.equal(actor.visible,false);assert.equal(model.visible,false);assert.equal(model.userData.wake.visible,false);
 updateYachtActor(actor,entry,29);assert.equal(yachtPose(entry,29).underBridge,false);assert.equal(actor.visible,true);assert.equal(model.visible,true);assert.equal(model.userData.wake.visible,true);model.userData.dispose();
});
test('outbound and returning yachts use opposite sides of a shared channel',()=>{
 const entry={boat:{id:0},berth:0,route:[0,1,2,3],bridgeRoutePositions:[],gridSize:64,operating:true};
 const outbound=yachtPose(entry,26.5),returning=yachtPose(entry,36.5);
 assert.equal(outbound.status,'出航中');assert.equal(returning.status,'返港中');assert.equal(outbound.x,returning.x);
 assert(outbound.y<0);assert(returning.y>0);assert(returning.y-outbound.y>=.39);
 assert.equal(yachtPose(entry,24).y,0);assert.equal(yachtPose(entry,31.5).y,0);
});
test('berth capacity prevents excess sales and occupied households keep ships through relocation',()=>{
 const s=town();for(const x of [6,7]){const b=s._newBuilding(x,31,'residential',true);b.level=3;b.population=10;}s.recalculate();
 for(let n=1;n<=4;n++)month(s,n);
 assert.equal(s.state.marinaLife.boats.length,2);assert.equal(new Set(yachtRoutes(s.state).map(e=>e.berth)).size,2);
 const owner=s.state.marinaLife.boats[0].homeId;assert(s.moveBuilding(owner,{x:10,y:31}).ok);assert.equal(s.state.marinaLife.boats[0].homeId,owner);
 const copy=CitySimulation.deserialize(s.serialize());assert.equal(copy.state.marinaLife.boats.length,2);
 assert(copy.build('bulldoze',[{x:10,y:31}]).ok);assert.equal(copy.state.marinaLife.boats.length,1);assert(!copy.state.marinaLife.accounts.some(a=>a.homeId===owner));
});
