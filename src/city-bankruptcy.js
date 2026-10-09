export const BANKRUPTCY_MESSAGE='城市已破产，本局游戏失败；请读取此前的存档或重新开始';

export function isBankrupt(state){
  return !!state?.bankruptcy||(state?.loan?.taken===true&&state.money<=0);
}

export function latchBankruptcy(state){
  if(!state.bankruptcy&&state.loan?.taken===true&&state.money<=0){
    state.bankruptcy={tick:state.tick,month:state.month,money:state.money};
  }
  return state.bankruptcy||null;
}
