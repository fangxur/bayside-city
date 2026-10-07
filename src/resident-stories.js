import {residentHash} from './resident-journeys.js';

const interests=[
  {tag:'口袋里总有一本书',title:'折了角的那一页',plan:'想把读到一半的小说看完',moments:['出门前读到最紧张的一页，舍不得合上书，最后拿购物小票当了书签。','午间想看两页，结果光顾着猜凶手，连饭都忘了拌。','准备回家读结局，又有点舍不得这么快跟书里的人告别。']},
  {tag:'阳台种菜新手',title:'那盆倔强的小葱',plan:'回家看看阳台上的小葱有没有长高',moments:['出门前给小葱浇了水，还转了转花盆，想让每一边都晒到太阳。','在纸上画了一个小菜园，算到第三个花盆才发现阳台已经没地方了。','准备回去量量小葱长了多少；尺子都找好了，希望它争气一点。']},
  {tag:'喜欢拍不起眼的街角',title:'一张还没拍好的照片',plan:'找个新角度拍下回家路上的街景',moments:['带着相机出门，决定今天只拍窗户，看看这座城有多少种早晨。','翻看早上拍的照片，最喜欢的那张偏偏有点糊，却舍不得删。','想着回程再拍一次那个街角；光线变了，也许会得到另一张喜欢的照片。']},
  {tag:'认真研究晚饭的人',title:'便当盒里的实验',plan:'回家试一道刚记下的家常菜',moments:['往便当里塞了新学的菜，盖子险些扣不上，只好先吃掉一口。','尝了自己做的便当，发现盐放少了。下次怎么改，已经记在手机里。','脑子里排着晚饭的做法，最难的不是下锅，是决定今天到底洗几个碗。']},
  {tag:'有一份越写越长的歌单',title:'哼到一半的旋律',plan:'把今天想到的歌加进自己的歌单',moments:['出门时脑子里响起一段老歌，词记不全，只好给它现编两句。','终于想起歌名，赶紧记下来，怕过一个路口又忘了。','打算回家完整听一遍那首歌，再翻翻以前收藏的专辑。']},
  {tag:'总带着小速写本',title:'画歪了也舍不得撕',plan:'给今天路过的街景补上最后几笔',moments:['翻到昨天画歪的屋顶，决定不撕了；换个角度看，还挺有自己的样子。','在速写本角落画了一只想象中的猫，画着画着，尾巴占了半页。','想把今天的街景补完，再在旁边写一句只有自己看得懂的备注。']},
  {tag:'修东西比买新的更开心',title:'留给周末的小工程',plan:'回家继续修那只走得有点慢的旧钟',moments:['把一颗小螺丝收进盒子，这回特地贴了标签，免得又忘记它属于哪里。','琢磨旧钟为什么总慢半拍，画了一张自己才能看懂的零件草图。','已经想好了回家先试哪一步；能不能修好另说，拆开研究就很有意思。']},
  {tag:'很会记住别人的小事',title:'顺手记下的那句话',plan:'给惦记的人留一条语音',moments:['出门前想起有人说最近有点累，准备晚点发句问候，不知道会不会打扰。','想了半天怎么开头，最后觉得一句“今天吃得好吗”也挺好。','打算回家安静地录一条语音，聊聊今天遇到的小事，不急着等回复。']},
];
const workDetails={
  bakery:['烘焙店员工','正在琢磨怎样把面包切得一样厚'],mediterranean:['咖啡馆员工','在练习把奶泡拉成一颗不歪的心'],
  teaHouse:['茶楼员工','想记住每位熟客爱喝的茶'],market:['市场员工','能把今天的菜价说得比天气还熟'],
  oldStreet:['便利店员工','记得好几位熟客常买什么'],hotel:['酒店员工','想把给客人的指路话说得更清楚'],
  office:['办公楼职员','给待办清单划掉一项，就偷偷高兴一下'],tavern:['小酒馆员工','准备把今晚的歌单换一个开头'],
  izakaya:['居酒屋员工','在练习一口气记住一桌人的点单'],diner:['餐吧员工','想给熟客推荐一道没点过的菜'],
  pharmacy:['药店员工','正把常用药品按用途重新整理'],repairGarage:['汽修店技师','想把那辆总有异响的车彻底检查明白'],
  laundry:['洗衣店员工','在研究怎样把顽固污渍处理得更干净'],hardware:['五金店员工','总能从一排零件里迅速找到合适的那颗'],
  furniture:['家具厂员工','喜欢看一块木料慢慢有了家具的样子'],textile:['纺织厂员工','最近总留意路人衣服的配色'],
  electronics:['电子厂员工','检查细小零件时比谁都耐心'],shipyard:['船厂员工','看见船体一点点成形，就觉得忙得值得'],
  carFactory:['汽车厂员工','最喜欢看完成装配的车驶出车间'],recycling:['再生材料厂员工','总觉得旧东西还能派上新用场'],
};

export function residentVignette(state,seed,journey,commute){
  const hobby=interests[seed%interests.length],phase=Math.floor((state.tick%15)/5);
  const workplace=commute&&state.buildings.find(b=>b.id===commute.to.id);
  const job=workplace&&(workDetails[workplace.businessKind]||[workplace.type==='industrial'?'工坊员工':workplace.type==='commercial'?'商店员工':'社区服务人员','想把手头的工作做得更顺一点']);
  const variant=residentHash(`${seed}:${state.month}:diary`)%3;
  let title=hobby.title,text=hobby.moments[(phase+variant)%3];
  if(journey?.purpose==='festival'){
    const christmas=journey.festivalId==='christmas';
    title=christmas?['热饮和一份小礼物','去看看圣诞灯饰','冬日里的暖聚'][variant]:`${journey.festivalName}的小安排`;
    text=`准备去${journey.to.name}参加「${journey.activity}」${journey.companion?`，和${journey.companion}碰面`:''}。`+(christmas?['想先喝杯热的，再慢慢挑一份送给街坊的小礼物。','打算沿路看看灯饰，遇到喜欢的就停下来拍张照片。','天气有点凉，不过想到能和街坊一起坐坐，脚步都轻快了一点。'][variant]:'想和街坊一起过节，也给今年留下一段温暖的记忆。');
  }else if(journey?.purpose==='date'){
    title=['比约定早到一点','准备了三个开场白','今天不聊工作'][variant];
    text=[`和${journey.companion}约在${journey.to.name}见面。出门前看了两遍时间，还特意给自己留了一点慢慢走的余地。`,`去${journey.to.name}见${journey.companion}，路上练了三个开场白。想来想去，还是先笑着说声“来了呀”最自然。`,`这次和${journey.companion}约好，见面先不聊工作。想听听对方最近有没有遇到什么好玩的小事。`][variant];
  }else if(journey?.purpose==='activity'){
    title=['活动开始前的小期待','见面要聊的那件事','熟人又多了一个'][variant];
    text=`准备去${journey.to.name}参加「${journey.activity}」，和${journey.companion}碰面。`+['已经想好回来要讲哪一段，虽然活动还没开始。','平时擦肩而过只打招呼，这次终于有时间好好聊聊。','有点期待，也有点怕记不住新朋友的名字，打算多听对方说几句。'][variant];
  }else if(journey?.purpose==='home'){
    title=['把这一天带回家','回家还有件小事','熟悉的转弯'][variant];
    text=`从${journey.from.name}往家走，${hobby.plan}。`+['路过熟悉的转角，脚步也不自觉慢下来。','今天没有什么大事，却有几件小事值得记住。','一想到可以换上拖鞋，就觉得这段路也挺可爱。'][variant];
  }else if(journey?.purpose==='work'&&job){
    title=['今天也带着自己的小计划','上班路上的五分钟','工作之外的小心思'][variant];
    text=`在${journey.to.name}工作，${job[1]}。${hobby.moments[phase]}`;
  }else if(journey?.purpose==='errand'){
    title=['购物清单之外','只买清单上的东西','顺路办件小事'][variant];
    text=`要去${journey.to.name}买点东西。`+['清单只写了两样，却给“看到喜欢的”预留了一个空格。','出门时说好不多买，经过橱窗又忍不住放慢了脚步。','怕自己忘记，把要买的东西记在了手机最显眼的位置。'][variant];
  }
  return {tag:hobby.tag,occupation:job?`${job[0]} · ${commute.to.name}`:'住在这里的街坊',title,text,wish:hobby.plan};
}
