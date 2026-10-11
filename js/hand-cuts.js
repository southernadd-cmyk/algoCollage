// Freehand scissors are stored in image-relative coordinates. This keeps a
// user's closed outline independent of canvas display size, ALGO/ART seeds,
// image orientation and future placement on the assembly board.
export const MAX_HAND_CUTS=24;
export const MAX_HAND_POINTS=240;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const bound=v=>Math.max(0,Math.min(1,v));
const area=points=>Math.abs(points.reduce((a,p,i)=>{
  const q=points[(i+1)%points.length];return a+p.x*q.y-q.x*p.y;
},0))/2;
function simplified(points,tolerance=0.0025){
  if(points.length<=3)return points;
  // Standard Ramer-Douglas-Peucker: retained corners follow the hand rather
  // than a uniformly spaced polygon, which can round off intentional turns.
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]],limit=tolerance*tolerance;
  while(stack.length){
    const [start,end]=stack.pop(),a=points[start],b=points[end];
    const vx=b.x-a.x,vy=b.y-a.y,length=vx*vx+vy*vy;
    let largest=limit,index=-1;
    for(let i=start+1;i<end;i++){
      const p=points[i],t=length?bound(((p.x-a.x)*vx+(p.y-a.y)*vy)/length):0;
      const dx=p.x-a.x-t*vx,dy=p.y-a.y-t*vy,dist=dx*dx+dy*dy;
      if(dist>largest){largest=dist;index=i;}
    }
    if(index!==-1){keep[index]=1;stack.push([start,index],[index,end]);}
  }
  return points.filter((_,i)=>keep[i]);
}
export function freehandOutline(samples){
  if(!Array.isArray(samples)||samples.length<3)return null;
  // Use an explicit cap even on pointer streams from very high-rate pens.
  const reduced=samples.length>6000?samples.filter((_,i)=>i%Math.ceil(samples.length/6000)===0||i===samples.length-1):samples;
  if(reduced.some(p=>!p||!finite(p.x)||!finite(p.y)))return null;
  const clean=[];
  for(const p of reduced){
    const point={x:Math.round(bound(p.x)*100000)/100000,y:Math.round(bound(p.y)*100000)/100000};
    if(!clean.length||Math.hypot(point.x-clean.at(-1).x,point.y-clean.at(-1).y)>.001)clean.push(point);
  }
  if(clean.length>2&&Math.hypot(clean[0].x-clean.at(-1).x,clean[0].y-clean.at(-1).y)<.007)clean.pop();
  if(clean.length<3)return null;
  let points=simplified(clean);
  if(points.length>MAX_HAND_POINTS){
    points=simplified(clean,.005);
    if(points.length>MAX_HAND_POINTS){
      const stride=Math.ceil(points.length/MAX_HAND_POINTS);
      points=points.filter((_,i)=>i%stride===0).slice(0,MAX_HAND_POINTS);
    }
  }
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  if(Math.max(...xs)-Math.min(...xs)<.022||Math.max(...ys)-Math.min(...ys)<.022||area(points)<.0006)return null;
  return points;
}
export function validateHandCuts(value){
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>MAX_HAND_CUTS)throw new Error('Invalid freehand cutting list.');
  const ids=new Set();
  return value.map(item=>{
    if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)||ids.has(item.id))
      throw new Error('Invalid or repeated freehand cut ID.');
    ids.add(item.id);
    if(!Array.isArray(item.points)||item.points.length<3||item.points.length>MAX_HAND_POINTS
      ||item.points.some(p=>!p||!finite(p.x)||!finite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))
      throw new Error('Invalid freehand path coordinates.');
    const points=item.points.map(p=>({x:p.x,y:p.y}));
    if(area(points)<.0006)throw new Error('Freehand cut area is too small.');
    return {id:item.id,points};
  });
}
export function handMasksForImage(image){
  const width=image.element?.naturalWidth||image.width||1000;
  const height=image.element?.naturalHeight||image.height||1400;
  const masks=validateHandCuts(image.handCuts).map((cut,index)=>{
    const points=cut.points.map(p=>({x:p.x*width,y:p.y*height}));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    return {index,id:'hand:'+cut.id,kind:'manual',label:'Hand cut '+(index+1),
      points,bounds:{x,y,w,h},sourceWidth:width,sourceHeight:height};
  });
  return {width,height,masks,kind:'manual'};
}
