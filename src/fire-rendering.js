const fract=value=>value-Math.floor(value);
const noise=(seed,index,salt=0)=>fract(Math.sin(seed*127.1+index*311.7+salt*74.7)*43758.5453123);

// Pure layout data keeps the fire deterministic across rebuilds while the
// renderer supplies flicker, smoke drift and materials every frame.
export function fireEffectLayout(event,target){
  const seed=(event?.targetId||target?.id||1)+(event?.startedMonth||1)*17;
  const footprint=Math.max(1,Math.min(3,target?.footprint||1));
  const radius=.24+(footprint-1)*.18;
  const flames=[];
  for(let i=0;i<4;i++){
    const angle=noise(seed,i,1)*Math.PI*2,distance=radius*(.25+noise(seed,i,2)*.75);
    const x=Math.cos(angle)*distance,z=Math.sin(angle)*distance,scale=.18+noise(seed,i,3)*.10,phase=noise(seed,i,4)*Math.PI*2;
    flames.push(
      {kind:'crown',layer:'bed',color:0xef6b26,x,y:.055,z,sx:scale*1.18,sy:scale*.55,sz:scale,phase,tiltX:0,tiltZ:0},
      {kind:'flame',layer:'outer',color:i%2?0xe94b27:0xf06a24,x:x+(noise(seed,i,5)-.5)*.035,y:.14+scale*.60,z:z+(noise(seed,i,6)-.5)*.035,sx:scale*.75,sy:scale*1.72,sz:scale*.67,phase:phase+.7,tiltX:(noise(seed,i,7)-.5)*.30,tiltZ:(noise(seed,i,8)-.5)*.30},
      {kind:'flame',layer:'core',color:0xffc84d,x:x-(noise(seed,i,5)-.5)*.025,y:.11+scale*.40,z:z-(noise(seed,i,6)-.5)*.025,sx:scale*.39,sy:scale*.98,sz:scale*.35,phase:phase+1.4,tiltX:(noise(seed,i,9)-.5)*.18,tiltZ:(noise(seed,i,10)-.5)*.18},
    );
  }
  const smoke=Array.from({length:9},(_,i)=>{
    const t=i/8,angle=noise(seed,i,11)*Math.PI*2,spread=.025+t*.16;
    return {kind:'crown',color:i<3?0x343838:i<6?0x555b58:0x737873,x:Math.cos(angle)*spread,y:.42+i*.115,z:Math.sin(angle)*spread,sx:.20+t*.20,sy:.23+t*.24,sz:.19+t*.19,phase:noise(seed,i,12),driftX:(noise(seed,i,13)-.5)*.16,driftZ:(noise(seed,i,14)-.5)*.16,opacity:.58-t*.18};
  });
  const embers=Array.from({length:10},(_,i)=>{
    const angle=noise(seed,i,15)*Math.PI*2,distance=.08+noise(seed,i,16)*(radius+.10);
    return {kind:'crown',color:i%3===0?0xffd061:0xf36a2d,x:Math.cos(angle)*distance,y:.18+noise(seed,i,17)*.48,z:Math.sin(angle)*distance,scale:.018+noise(seed,i,18)*.018,phase:noise(seed,i,19)};
  });
  return {flames,smoke,embers};
}
