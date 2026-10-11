import {clamp,overlap,decodeMask} from './subject-data.js';

// A compact, source-space occupancy map preserves the *actual* silhouette
// when comparing ALGO/ART selection territories. Bounding boxes alone can
// select an empty hole in a subject (or the wrong object altogether).
const GRID=64;
const foregroundCache=new WeakMap();
function foregroundGrid(subject) {
  const mask=subject.mask;
  if(!mask)return null;
  if(foregroundCache.has(mask))return foregroundCache.get(mask);
  const cells=new Uint32Array(GRID*GRID),pixels=decodeMask(mask);
  let total=0;
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++) {
    if(!pixels[y*mask.width+x])continue;
    const gx=Math.min(GRID-1,Math.floor((x+.5)*GRID/mask.width));
    const gy=Math.min(GRID-1,Math.floor((y+.5)*GRID/mask.height));
    cells[gy*GRID+gx]++;total++;
  }
  const result={cells,total};
  foregroundCache.set(mask,result);
  return result;
}
// The actual ALGO/ART territory, not its rectangular envelope, decides
// which segmented pixels count towards a subject's selection score.
function insidePolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>y)!==(b.y>y)) {
      const crossing=(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x;
      if(x<crossing)inside=!inside;
    }
  }
  return inside;
}
function foregroundInside(grid,region) {
  const x0=Math.max(0,Math.floor(region.x*GRID));
  const y0=Math.max(0,Math.floor(region.y*GRID));
  const x1=Math.min(GRID,Math.ceil((region.x+region.w)*GRID));
  const y1=Math.min(GRID,Math.ceil((region.y+region.h)*GRID));
  let count=0,sumX=0,sumY=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const n=grid.cells[y*GRID+x];if(!n)continue;
    const fx=(x+.5)/GRID,fy=(y+.5)/GRID;
    if(region.points?.length>=3&&!insidePolygon(fx,fy,region.points))continue;
    count+=n;sumX+=fx*n;sumY+=fy*n;
  }
  return {count,point:count?{x:sumX/count,y:sumY/count}:null};
}
function foregroundPoint(subject,region) {
  const grid=foregroundGrid(subject);
  if(!grid?.total)return null;
  const inside=foregroundInside(grid,region);
  if(inside.count)return inside.point;
  // A guide can fall in a hole or just outside the silhouette. Seek its
  // nearest visible part instead of clipping a window around empty pixels.
  const cx=region.x+region.w/2,cy=region.y+region.h/2;
  let best=Infinity,point=null;
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++) {
    if(!grid.cells[y*GRID+x])continue;
    const fx=(x+.5)/GRID,fy=(y+.5)/GRID;
    const distance=(fx-cx)**2+(fy-cy)**2;
    if(distance<best){best=distance;point={x:fx,y:fy};}
  }
  return point;
}

const rectangle=b=>[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
export function guideRegions(cuts) {
  return cuts.masks.map(mask=>({index:mask.index,x:mask.bounds.x/cuts.width,y:mask.bounds.y/cuts.height,
    w:mask.bounds.w/cuts.width,h:mask.bounds.h/cuts.height,
    points:mask.points?.map(point=>({x:point.x/cuts.width,y:point.y/cuts.height}))}));
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
      const grid=foregroundGrid(subject);
      const coverage=grid?.total?foregroundInside(grid,region).count/grid.total:
        overlap(region,b)/Math.max(0.001,b.w*b.h);
      return coverage-distance*.45+(subject.manual ? .35 : 0);
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
  const box=subject.bounds,focus=foregroundPoint(subject,region);
  const target=focus?{x:focus.x,y:focus.y,w:0,h:0}:region;
  const window=windowIn(box,target,.45+size/200);
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
// Guide-influenced face and object *details* are consciously distinct from
// a whole recognised silhouette. Recognition locates the form; the cut
// geometry selects which portion of that form to retain.
function subjectDetails(subject,regions,settings,width,height,key) {
  const box=subject.bounds;
  const labels=['upper left','upper right','lower detail'];
  const anchors=[{x:.26,y:.29},{x:.74,y:.29},{x:.50,y:.75}];
  const coverage=.37+settings.cutSize/850; // .41-.49 of detected object at usual values
  return anchors.map((anchor,index)=>{
    const guide=regions[(index*3)%Math.max(1,regions.length)]||{x:.5,y:.5,w:0,h:0};
    // A small, deterministic ALGO/ART positional influence makes recutting
    // meaningful without accidentally escaping a tightly detected face.
    const gx=guide.x+guide.w/2,gy=guide.y+guide.h/2;
    const px=clamp(anchor.x+(gx-.5)*.12,.16,.84);
    const py=clamp(anchor.y+(gy-.5)*.12,.16,.84);
    const w=box.w*coverage,h=box.h*coverage;
    const normal={x:clamp(box.x+box.w*(px-coverage/2),box.x,box.x+box.w-w),
      y:clamp(box.y+box.h*(py-coverage/2),box.y,box.y+box.h-h),w,h};
    const bounds=toPixels(normal,width,height);
    return {index,id:key+':'+subject.id+':detail-'+index,
      points:rectangle(bounds),bounds,alpha:subject.mask,
      sourceWidth:width,sourceHeight:height,kind:'subject',
      label:subject.label+' · '+labels[index],subjectId:subject.id,guideIndex:guide.index};
  });
}

export function makeImageCuts(cuts,settings,image) {
  const width=image.element?.naturalWidth||image.width||cuts.width;
  const height=image.element?.naturalHeight||image.height||cuts.height;
  const regions=guideRegions(cuts);
  const subjects=settings.cutStyle==='subjects'?image.analysis?.subjects||[]:[];
  const key=[settings.cutSeed,settings.cutMode,settings.detail,settings.cutStyle,settings.cutSize,settings.wholeSubjects,width,height].join(':');
  if(subjects.length) {
    const ranked=rankedSubjects(subjects,regions);
    if(!settings.wholeSubjects){
      return {width,height,
        masks:ranked.flatMap(({subject})=>subjectDetails(subject,regions,settings,width,height,key))
          .map((mask,index)=>({...mask,index})),
        regions,kind:'subjects'};
    }
    const masks=ranked.map(({subject,region},index)=>{
      const bounds=toPixels(subject.bounds,width,height);
      return {index,id:key+':'+subject.id,points:rectangle(bounds),bounds,alpha:subject.mask,
        sourceWidth:width,sourceHeight:height,kind:'subject',label:subject.label,
        subjectId:subject.id,guideIndex:region.index};
    });
    return {width,height,masks,regions,kind:'subjects'};
  }
  // A missed subject gets compact, explicitly labelled details. Large
  // fragments are a distinct method: bigger *photographic regions*, not
  // the same recognised face displayed under another dropdown option.
  const bounded=settings.cutStyle==='subjects';
  const coverage=bounded?.26+settings.cutSize/400:.31+settings.cutSize/290;
  const ranked=regions.slice().sort((a,b)=>b.w*b.h-a.w*a.h);
  const chosen=[];
  for(const region of ranked){
    const cx=region.x+region.w/2,cy=region.y+region.h/2;
    if(chosen.every(previous=>Math.hypot(cx-(previous.x+previous.w/2),cy-(previous.y+previous.h/2))>.075))
      chosen.push(region);
    if(chosen.length===8)break;
  }
  if(!chosen.length&&ranked.length)chosen.push(ranked[0]);
  const masks=chosen.map((region,index)=>{
    const bounds=toPixels(windowIn({x:0,y:0,w:1,h:1},region,coverage),width,height);
    return {index,id:key+':region-'+region.index,bounds,
      points:settings.cutMode==='rects'?rectangle(bounds):bevel(bounds,.06),
      sourceWidth:width,sourceHeight:height,kind:'region',
      label:bounded?'Unrecognised image detail':'Photo fragment '+(index+1),guideIndex:region.index};
  });
  return {width,height,masks,regions,kind:bounded?'details':'regions'};
}
