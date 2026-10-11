// Compact, portable binary silhouettes. No browser or model dependency here.
export const ANALYSIS_VERSION=2;
export const ANALYSIS_MODEL='mediapipe-1.1.0-face-edge-v3';
const LEGACY_MODEL='mediapipe-1.1.0-magic-touch-v2';
export const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
export function encodeMask(pixels,width,height) {
  if(pixels.length!==width*height)throw new Error('Mask dimensions do not match.');
  const runs=[];let value=0,length=0;
  for(const pixel of pixels) {
    const next=pixel?1:0;
    if(next===value)length++;else {runs.push(length);length=1;value=next;}
  }
  runs.push(length);return {width,height,runs};
}
export function validateMask(mask) {
  if(!mask||!Number.isInteger(mask.width)||!Number.isInteger(mask.height)||mask.width<1||mask.height<1||Math.max(mask.width,mask.height)>384)throw new Error('Invalid subject mask dimensions.');
  const total=mask.width*mask.height;
  if(!Array.isArray(mask.runs)||mask.runs.length<1||mask.runs.length>total+1)throw new Error('Invalid subject mask.');
  let count=0;
  for(let i=0;i<mask.runs.length;i++) {
    const run=mask.runs[i];if(!Number.isInteger(run)||run<(i?1:0))throw new Error('Invalid subject mask runs.');
    count+=run;if(count>total)throw new Error('Subject mask exceeds its image.');
  }
  if(count!==total)throw new Error('Incomplete subject mask.');
  return {width:mask.width,height:mask.height,runs:mask.runs.slice()};
}
export function decodeMask(mask) {
  const valid=validateMask(mask),pixels=new Uint8Array(valid.width*valid.height);
  let offset=0;valid.runs.forEach((length,i)=>{if(i%2)pixels.fill(255,offset,offset+length);offset+=length;});return pixels;
}
export function maskBounds(pixels,width,height) {
  let x0=width,y0=height,x1=-1,y1=-1,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*width+x]) {x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;}
  return count?{x:x0/width,y:y0/height,w:(x1-x0+1)/width,h:(y1-y0+1)/height,count}:null;
}
// Keep the connected foreground nearest the selected point, discarding distant specks.
export function foregroundComponent(pixels,width,height,point) {
  const sx=Math.round(clamp(point.x)*(width-1)),sy=Math.round(clamp(point.y)*(height-1));
  let start=sy*width+sx;
  if(!pixels[start]) {
    let best=Infinity;start=-1;const radius=Math.ceil(Math.max(width,height)*0.09);
    for(let y=Math.max(0,sy-radius);y<=Math.min(height-1,sy+radius);y++)for(let x=Math.max(0,sx-radius);x<=Math.min(width-1,sx+radius);x++) {
      const distance=(x-sx)**2+(y-sy)**2;if(pixels[y*width+x]&&distance<best){best=distance;start=y*width+x;}
    }
  }
  const out=new Uint8Array(pixels.length);if(start<0)return out;
  const queue=new Int32Array(pixels.length);let head=0,tail=1;queue[0]=start;out[start]=1;
  while(head<tail) {
    const at=queue[head++],x=at%width,y=Math.floor(at/width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const nx=x+dx,ny=y+dy,n=ny*width+nx;
      if(nx>=0&&ny>=0&&nx<width&&ny<height&&pixels[n]&&!out[n]){out[n]=1;queue[tail++]=n;}
    }
  }
  return out;
}
export function subjectFromConfidence(values,width,height,point,{label='Subject',score=0,manual=false}={}) {
  const factor=Math.min(1,384/Math.max(width,height)),w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
  const binary=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)binary[y*w+x]=values[Math.min(height-1,Math.floor((y+.5)*height/h))*width+Math.min(width-1,Math.floor((x+.5)*width/w))]>=(manual?.64:.72)?1:0;
  const pixels=foregroundComponent(binary,w,h,point),bounds=maskBounds(pixels,w,h);
  if(!bounds||bounds.count/(w*h)<(manual?0.0007:0.002))return null;
  const coverage=bounds.count/(w*h);
  const edges=(bounds.x===0)+(bounds.y===0)+(bounds.x+bounds.w>.995)+(bounds.y+bounds.h>.995);
  // Never store an almost whole painting as a foreground subject.
  if(coverage>(manual?.46:.38)||(edges>=3&&coverage>.22)||
     (bounds.w>.89&&bounds.h>.89)||(Math.max(bounds.w,bounds.h)>.94&&coverage>.20))return null;
  let hash=2166136261;for(const pixel of pixels)hash=Math.imul(hash^pixel,16777619);
  const {count,...box}=bounds;
  return {id:'subject-'+(hash>>>0).toString(36),label,score,manual,bounds:box,mask:encodeMask(pixels,w,h)};
}
export function overlap(a,b) {
  return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
}
export function duplicateSubject(a,b) {
  return overlap(a.bounds,b.bounds)/Math.min(a.bounds.w*a.bounds.h,b.bounds.w*b.bounds.h)>.82;
}
function validateBounds(b) {
  if(!b||!['x','y','w','h'].every(k=>Number.isFinite(b[k]))||b.x<0||b.y<0||b.w<=0||b.h<=0||b.x+b.w>1.001||b.y+b.h>1.001)throw new Error('Invalid subject bounds.');
  return {x:b.x,y:b.y,w:b.w,h:b.h};
}
export function validateAnalysis(input) {
  if(input===undefined||input===null)return undefined;
  // Old MagicTouch results may include most of a painting. Reanalyse rather
  // than reusing those silhouettes; old version-2 project images still load.
  if(input.version===1&&input.model===LEGACY_MODEL)return undefined;
  if(input.version!==ANALYSIS_VERSION||input.model!==ANALYSIS_MODEL||!Array.isArray(input.subjects)||input.subjects.length>8||!Array.isArray(input.faces)||input.faces.length>12)throw new Error('Unsupported image analysis.');
  const ids=new Set();
  const subjects=input.subjects.map(s=>{
    if(typeof s.id!=='string'||!s.id||s.id.length>80||ids.has(s.id))throw new Error('Invalid subject ID.');ids.add(s.id);
    return {id:s.id,label:String(s.label||'Subject').replace(/<[^>]*>/g,'').slice(0,80),score:clamp(Number(s.score)||0),manual:s.manual===true,bounds:validateBounds(s.bounds),mask:validateMask(s.mask)};
  });
  return {version:ANALYSIS_VERSION,model:ANALYSIS_MODEL,subjects,faces:input.faces.map(validateBounds)};
}
