// Invite reads deliberately omit account credentials and never use the editing client.
export async function readInvitation(code,{visit=false,since=-1,signal,fetcher=fetch}={}){
 const path='/api/invitations/'+encodeURIComponent(code)+(visit?'/visit?since='+encodeURIComponent(since):'');
 const response=await fetcher(path,{method:'GET',credentials:'omit',cache:'no-store',signal});
 const data=await response.json();
 if(!response.ok)throw Object.assign(Error(data.message||'暂时无法读取城市，请稍后重试'),{status:response.status,code:data.code});
 return data;
}

export class InvitationVisit{
 constructor(code,{onView,onError,fetcher=fetch,interval=5000}={}){
  this.code=code;this.onView=onView;this.onError=onError;this.fetcher=fetcher;this.interval=interval;this.revision=-1;this.active=false;
 }
 start(){if(this.active)return;this.active=true;this.controller=new AbortController();return this.poll();}
 stop(){this.active=false;clearTimeout(this.timer);this.controller?.abort();}
 async poll(){
  const controller=this.controller;
  try{
   const view=await readInvitation(this.code,{visit:true,since:this.revision,signal:controller.signal,fetcher:this.fetcher});
   if(!this.active||controller!==this.controller)return;
   this.onView(view);this.revision=view.revision;
  }catch(error){
   if(!this.active||controller!==this.controller)return;
   const ended=[401,403,404,409,410].includes(error.status);
   if(ended)this.stop();
   this.onError(error,ended);
  }finally{
   if(this.active&&controller===this.controller)this.timer=setTimeout(()=>this.poll(),this.interval);
  }
 }
}
