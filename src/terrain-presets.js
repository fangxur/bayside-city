export const TERRAIN_PRESETS = {
 bayside:{name:'经典河湾',description:'蜿蜒河流分隔两岸，保留熟悉的开局。',feature:'双岸河湾'},
 paris:{name:'巴黎',description:'弯曲河道与河心小岛，适合沿河规划紧凑街区。',feature:'曲河 · 河心岛'},
 newYork:{name:'纽约',description:'两条水道夹着狭长岛区，以桥梁连接多个街区。',feature:'长岛 · 双水道'},
 london:{name:'伦敦',description:'宽阔的 S 形河湾，沿弯道组织两岸的发展。',feature:'S 形河湾'},
 guangzhou:{name:'广州',description:'分汊河网与洲岛，在水系之间发展新城。',feature:'分汊 · 洲岛'},
 shanghai:{name:'上海',description:'大江通向东侧河口，支流穿过内陆平原。',feature:'河口 · 支流'},
 shenzhen:{name:'深圳',description:'南部开阔海湾与连续北岸，适合滨海发展。',feature:'滨海 · 海湾'},
 hongKong:{name:'香港',description:'海港隔开北部陆地与南部岛屿，跨海连接更重要。',feature:'海港 · 岛屿'},
};
export function terrainAt(preset,x,y,size=64){
 // Keep the established west-side entrance at (0, 32), while stretching the
 // familiar 64-cell terrain shapes into the additional eastern and southern
 // land available on larger maps.
 const px=size===64?x:x*63/(size-1);
 const py=size===64?y:y<=32?y:32+(y-32)*31/(size-33);
 let water=false;
 switch(preset){
 case 'paris': {const river=31+7*Math.sin((px-9)*.105);water=Math.abs(py-river)<2.7;if(((px-33)/4)**2+((py-35)/1.6)**2<1)water=false;break;}
 case 'newYork': {const shift=(py-32)*.22;water=Math.abs(px-(28+shift))<2.3||Math.abs(px-(42+shift))<3.4||py>54+(px-32)*.10;break;}
 case 'london':water=Math.abs(py-(32+10*Math.sin((px-12)*.115)))<3.6;break;
 case 'guangzhou':water=Math.abs(py-(32+6*Math.sin(px*.085)))<2.6||(px>25&&Math.abs(py-(22+.44*(px-25)))<2.1)||(px>24&&Math.abs(px-(37+4*Math.sin(py*.13)))<2.0);break;
 case 'shanghai':water=px>54+3*Math.sin(py*.09)||Math.abs(px-(38+5*Math.sin(py*.08)))<3||(px<40&&Math.abs(py-(23+3*Math.sin(px*.14)))<1.5);break;
 case 'shenzhen':water=py>43+6*Math.sin((px+4)*.083)||((px-48)/12)**2+((py-43)/8)**2<1;break;
 case 'hongKong':{const north=35+3*Math.sin(px*.12);water=py>north;const island=((px-39)/17)**2+((py-50)/7)**2<1;const small=((px-14)/7)**2+((py-53)/5)**2<1;if(island||small)water=false;break;}
 default:{const center=39+Math.sin(py*.105)*3.2+Math.sin(py*.23)*.6;water=Math.abs(px-center)<2.35;}
 }
 // Every preset shares a safe west-side arrival road and a small buildable foothold.
 if(preset!=='bayside'&&x<=10&&y>=28&&y<=36)water=false;
 return water?'water':'land';
}
export function terrainPreview(preset){
 let water='';
 for(let y=0;y<64;y++)for(let x=0;x<64;){if(terrainAt(preset,x,y)!=='water'){x++;continue;}const start=x;while(x<64&&terrainAt(preset,x,y)==='water')x++;water+=`M${start} ${y}h${x-start}v1H${start}z`;}
 return `<svg viewBox="0 0 64 64" role="img" aria-label="${TERRAIN_PRESETS[preset].name}地形预览"><rect width="64" height="64" fill="#dfe6cd"/><path d="${water}" fill="#8ebdbd"/><path d="M0 32H7" fill="none" stroke="#62736c" stroke-width="1.6"/><circle cx="7" cy="32" r="1.6" fill="#367b5e"/></svg>`;
}
