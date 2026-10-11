import {clamp,overlap} from './subject-data.js';

const rectangle=b=>[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
export function guideRegions(cuts) {
  return cuts.masks.map(mask=>({index:mask.index,x:mask.bounds.x/cuts.width,y:mask.bounds.y/cuts.height,
    w:mask.bounds.w/cuts.width,h:mask.bounds.h/cuts.height}));
}
export function rankedSubjects(subjects,regions) {
  const remaining=subjects.slice(),ranked=[];
  // The engine's territories choose which subject to retrieve, rather than
  // cutting through that subject with the territory's arbitrary outline.
  for(const region of regions) {
    if(!remaining.length)break;
    const cx=region.x+region.w/2,cy=region.y+region.h/2;
    const score=subject=>{
      const b=subject.bounds,distance=Math.hypot(cx-b.x-b.w/2,cy-b.y-b.h/2);
      return overlap(region,b)/Math.max(0.001,b.w*b.h)-distance*.45+(subject.manual ? .35 : 0);
    };
    let best=0;for(let i=1;i<remaining.length;i++)if(score(remaining[i])>score(remaining[best]))best=i;
    ranked.push({subject:remaining.splice(best,1)[0],region});
  }
  for(const subject of remaining)ranked.push({subject,region:regions[0]||{x:0,y:0,w:1,h:1,index:0}});
  return ranked;
}
function windowIn(box,region,coverage) {
  const w=box.w*coverage,h=box.h*coverage;
  return {x:clamp(region.x+region.w/2-w/2,box.x,box.x+box.w-w),
    y:clamp(region.y+region.h/2-h/2,box.y,box.y+box.h-h),w,h};
}
export function partialSubjectBounds(subject,region,size,faces=[]) {
  const box=subject.bounds,window=windowIn(box,region,.45+size/200);
  // Expand any partial cut that intersects a face to include that face in full.
  for(const face of faces)if(overlap(window,face)>0&&overlap(box,face)>face.w*face.h*.65) {
    const x=Math.max(box.x,Math.min(window.x,face.x-face.w*.12));
    const y=Math.max(box.y,Math.min(window.y,face.y-face.h*.18));
    const right=Math.min(box.x+box.w,Math.max(window.x+window.w,face.x+face.w*1.12));
    const bottom=Math.min(box.y+box.h,Math.max(window.y+window.h,face.y+face.h*1.18));
    Object.assign(window,{x,y,w:right-x,h:bottom-y});
  }
  return window;
}
const toPixels=(b,w,h)=>({x:b.x*w,y:b.y*h,w:b.w*w,h:b.h*h});
function bevel(b,amount) {
  const d=Math.min(b.w,b.h)*amount;
  return [{x:b.x+d,y:b.y},{x:b.x+b.w-d,y:b.y},{x:b.x+b.w,y:b.y+d},{x:b.x+b.w,y:b.y+b.h-d},
    {x:b.x+b.w-d,y:b.y+b.h},{x:b.x+d,y:b.y+b.h},{x:b.x,y:b.y+b.h-d},{x:b.x,y:b.y+d}];
}
export function makeImageCuts(cuts,settings,image) {
  const width=image.element?.naturalWidth||image.width||cuts.width;
  const height=image.element?.naturalHeight||image.height||cuts.height;
  const regions=guideRegions(cuts);
  const subjects=settings.cutStyle==='subjects'?image.analysis?.subjects||[]:[];
  const key=[settings.cutSeed,settings.cutMode,settings.detail,settings.cutStyle,settings.cutSize,settings.wholeSubjects,width,height].join(':');
  if(subjects.length) {
    const masks=rankedSubjects(subjects,regions).map(({subject,region},index)=>{
      const normal=settings.wholeSubjects?subject.bounds:partialSubjectBounds(subject,region,settings.cutSize,image.analysis.faces);
      const bounds=toPixels(normal,width,height);
      return {index,id:key+':'+subject.id,points:rectangle(bounds),bounds,alpha:subject.mask,
        sourceWidth:width,sourceHeight:height,kind:'subject',label:subject.label,subjectId:subject.id,guideIndex:region.index};
    });
    return {width,height,masks,regions,kind:'subjects'};
  }
  // Keep most of the original photograph. The engine determines the centres
  // and ordering of these large windows; source images are never pre-cropped.
  const largest=regions.slice().sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,8);
  const masks=largest.map((region,index)=>{
    const bounds=toPixels(windowIn({x:0,y:0,w:1,h:1},region,.45+settings.cutSize/200),width,height);
    return {index,id:key+':region-'+region.index,bounds,points:settings.cutMode==='rects'?rectangle(bounds):bevel(bounds,.06),
      sourceWidth:width,sourceHeight:height,kind:'region',label:'Large image fragment',guideIndex:region.index};
  });
  return {width,height,masks,regions,kind:'regions'};
}
