// Cooperative credits follow membership, not presence or the solo save's editable signature.
export function mayorIdentity(state,members=null){
 const cooperative=Array.isArray(members);
 const names=cooperative?[...members].sort((a,b)=>Number(b.role==='owner')-Number(a.role==='owner')).map(member=>member.name):[state.mayorName||'尚未署名'];
 const label=cooperative?'合作市长':'市长';
 return {cooperative,names,label,text:`${label} · ${names.join('、')||'等待同步成员'}`};
}
