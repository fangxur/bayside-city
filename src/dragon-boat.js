import {festivalForMonth} from './festivals.js';
export const DRAGON_TEAMS=['青龙队','赤龙队','金龙队'];
export const DRAGON_STAKES=[50,100,200];
export const newFestivalGames=()=>({points:1000,lastRace:null,claims:[],rewards:[],decoration:null});
export function dragonWinner(seed,year){
 let n=2166136261;
 for(const c of `${seed}:${year}:dragon-boat`)n=Math.imul(n^c.charCodeAt(0),16777619);
 n=Math.imul(n^(n>>>16),2246822507);return (n>>>0)%DRAGON_TEAMS.length;
}
export function enterDragonRace(state,team,stake){
 const year=Math.floor((state.month-1)/12)+1;
 if((state.month-1)%12+1!==6)return {ok:false,message:'龙舟赛在每年六月端午节开放'};
 const games=state.festivalGames;
 if(!Number.isInteger(team)||team<0||team>=DRAGON_TEAMS.length||!DRAGON_STAKES.includes(stake))return {ok:false,message:'请选择队伍和有效的竞猜积分'};
 if(games.lastRace?.year>=year)return {ok:false,message:'今年的龙舟赛已结算，明年六月再来吧'};
 if(games.points<stake)return {ok:false,message:'节庆积分不足，请选择更低的竞猜档位'};
 const winner=dragonWinner(state.seed,year),payout=winner===team?stake*3:0;
 const race={year,team,stake,winner,payout,pointsBefore:games.points,claimsBefore:games.claims.length,spentBefore:rewardSpent(games)};
 games.points+=payout-stake;games.lastRace=race;
 return {ok:true,message:`${DRAGON_TEAMS[winner]}夺冠！${payout?`竞猜成功，返还 ${payout} 积分（含本金）`:`本次未猜中，消耗 ${stake} 积分`}`};
}
export function loadFestivalGames(raw,seed,month){
 const fail=()=>{throw new Error('节庆竞猜存档无效');};
 if(raw===undefined)return newFestivalGames();
 if(!raw||!Number.isSafeInteger(raw.points)||raw.points<0||raw.points>1e9)fail();
 const claims=raw.claims??[],rewards=raw.rewards??[],decoration=raw.decoration??null;
 if(!Array.isArray(claims)||!Array.isArray(rewards)||new Set(claims).size!==claims.length||new Set(rewards).size!==rewards.length||claims.some(m=>!Number.isInteger(m)||m<1||m>month||!festivalForMonth(m))||rewards.some(id=>!FESTIVAL_REWARDS.some(r=>r.id===id))||(decoration!==null&&!rewards.includes(decoration)))fail();
 const extras={claims:[...claims],rewards:[...rewards],decoration},spent=rewardSpent(extras),earned=claims.length*100;
 const r=raw.lastRace;
 if(r===null){if(raw.points!==1000+earned-spent)fail();return {points:raw.points,lastRace:null,...extras};}
 if(!r||!Number.isInteger(r.year)||r.year<1||(r.year-1)*12+6>month||!Number.isInteger(r.team)||r.team<0||r.team>2||!DRAGON_STAKES.includes(r.stake)||r.winner!==dragonWinner(seed,r.year)||r.payout!==(r.team===r.winner?r.stake*3:0)||!Number.isSafeInteger(r.pointsBefore)||r.pointsBefore<r.stake||r.pointsBefore>1e9||raw.points!==r.pointsBefore-r.stake+r.payout+(claims.length-(r.claimsBefore??0))*100-(spent-(r.spentBefore??0)))fail();
 if(!Number.isInteger(r.claimsBefore??0)||(r.claimsBefore??0)<0||(r.claimsBefore??0)>claims.length||!Number.isInteger(r.spentBefore??0)||(r.spentBefore??0)<0||(r.spentBefore??0)>spent)fail();
 return {points:raw.points,...extras,lastRace:{claimsBefore:r.claimsBefore??0,spentBefore:r.spentBefore??0,year:r.year,team:r.team,stake:r.stake,winner:r.winner,payout:r.payout,pointsBefore:r.pointsBefore}};
}

export const FESTIVAL_REWARDS=[
 {id:'bunting',name:'缤纷庆典彩旗',cost:200,description:'为所有开放的公园与广场挂上彩旗'},
 {id:'lanterns',name:'团圆红灯笼',cost:300,description:'为所有开放的公园与广场添上灯笼'},
];
const rewardSpent=games=>games.rewards.reduce((sum,id)=>sum+FESTIVAL_REWARDS.find(r=>r.id===id).cost,0);
export function claimFestivalPoints(state){
 const f=festivalForMonth(state.month),games=state.festivalGames;
 if(!f)return {ok:false,message:'节日月份可领取节庆积分'};
 if(games.claims.includes(state.month))return {ok:false,message:'本次节日积分已领取'};
 games.claims.push(state.month);games.points+=100;
 return {ok:true,message:f.name+'快乐！获得 100 节庆积分'};
}
export function redeemFestivalReward(state,id){
 const reward=FESTIVAL_REWARDS.find(r=>r.id===id),games=state.festivalGames;
 if(!reward)return {ok:false,message:'请选择有效的节庆装饰'};
 if(!games.rewards.includes(id)){
  if(games.points<reward.cost)return {ok:false,message:'节庆积分不足，可在节日月份领取积分'};
  games.points-=reward.cost;games.rewards.push(id);
 }
 games.decoration=games.decoration===id?null:id;
 return {ok:true,message:games.decoration?'已启用'+reward.name+'，在公园和广场查看':'已收起节庆装饰'};
}
