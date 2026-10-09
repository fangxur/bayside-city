export function setupTaxControl({input,output,status,getState,commit,onApplied,notify}){
  let city,editing=false,pending=false;
  const display=rate=>{input.value=String(rate);output.value=rate+'%';};
  function sync(){
    const state=getState();
    if(city!==state.city){city=state.city;editing=false;pending=false;}
    input.disabled=!!state.disabledReason||pending;
    status.textContent=state.disabledReason||(pending?'正在保存税率…':'拖动查看税率，松开后更新预计月收入。');
    if(state.disabledReason)editing=false;
    if(!editing&&!pending)display(state.rate);
  }
  input.addEventListener('input',()=>{
    if(input.disabled)return;
    editing=true;output.value=input.value+'%';
  });
  input.addEventListener('change',async()=>{
    if(input.disabled)return;
    const target=getState().city,rate=Number(input.value);
    editing=false;
    if(rate===getState().rate){sync();return;}
    pending=true;sync();
    try{
      const result=await commit(rate);
      if(target!==getState().city)return;
      if(result.ok)onApplied();else notify(result.message);
    }catch(error){if(target===getState().city)notify(error.message);}
    finally{if(target===getState().city){pending=false;sync();}}
  });
  input.addEventListener('blur',()=>{if(!pending){editing=false;sync();}});
  return {sync};
}
