import test from 'node:test';import assert from 'node:assert/strict';
import {onboardingMapRegion} from '../src/onboarding-layout.js';
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
test('map focus clears the tutorial, secondary menu and controls on narrow and landscape phones',()=>{
 for(const [w,h] of [[320,568],[390,844],[844,390],[1440,900]]){
  const landscape=w>h&&h<540;
  const panels=[rect(8,8,w-16,landscape?54:96),rect(8,landscape?70:112,landscape?260:w-16,72),rect(8,h-98,w-16,72),rect(8,h-155,w-16,38),landscape?rect(w-288,70,280,150):rect(8,h-166-120,w-16,120)];
  const region=onboardingMapRegion(rect(0,0,w,h),panels);
  assert(region.width>=60&&region.height>=40);assert(!panels.some(p=>overlap(region,p)),w+'x'+h);
  assert(region.left>=0&&region.right<=w&&region.top>=0&&region.bottom<=h);
 }
});
