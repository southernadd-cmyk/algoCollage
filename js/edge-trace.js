// Edge-aware, bounded subject proposals. Pure functions so the portrait
// regression can be tested without downloading a vision model.
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const area=b=>b.w*b.h;
function expanded(b,pad=.2) {
  const x=clamp(b.x-b.w*pad),y=clamp(b.y-b.h*pad);
  const right=clamp(b.x+b.w*(1+pad)),bottom=clamp(b.y+b.h*(1+pad));
  return {x,y,w:right-x,h:bottom-y};
}
function contains(b,p) {return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
function centre(b) {return {x:b.x+b.w/2,y:b.y+b.h/2};}
function detailBox(p) {
  const w=.25,h=.29;
  return {x:clamp(p.x-w/2,0,1-w),y:clamp(p.y-h/2,0,1-h),w,h};
}
export function chooseCandidates(objects,faces,point=null) {
  const validFaces=faces.filter(b=>area(b)>.0005&&area(b)<.27&&b.w<.65&&b.h<.7);
  const validObjects=objects.filter(o=>o.bounds&&o.score>=.45&&area(o.bounds)<.43&&o.bounds.w<.84&&o.bounds.h<.84);
  if(point) {
    const face=validFaces.find(b=>contains(expanded(b,.4),point));
    if(face)return [{kind:'face',bounds:face,point:centre(face),label:'Face / head',score:1,manual:true}];
    const object=validObjects.find(o=>contains(o.bounds,point));
    if(object)return [{kind:'object',bounds:object.bounds,point,label:object.label,score:object.score,manual:true}];
    return [{kind:'detail',bounds:detailBox(point),point,label:'Selected detail',score:0,manual:true}];
  }
  // A painting may be classified as a "person" covering the full canvas.
  // Faces are independent candidates, never suppressed by that person box.
  const candidates=validFaces.map(face=>({kind:'face',bounds:face,point:centre(face),label:'Face / head',score:1}));
  for(const object of validObjects.sort((a,b)=>b.score-a.score)) {
    if(candidates.length>=8)break;
    const b=object.bounds;
    const insideFace=validFaces.some(f=>contains(b,centre(f)));
    if(insideFace&&/person|human|portrait|face/i.test(object.label))continue;
    if(candidates.some(c=>area(c.bounds)>0&&Math.max(0,Math.min(c.bounds.x+c.bounds.w,b.x+b.w)-Math.max(c.bounds.x,b.x))*
       Math.max(0,Math.min(c.bounds.y+c.bounds.h,b.y+b.h)-Math.max(c.bounds.y,b.y))/
       Math.min(area(c.bounds),area(b))>.83))continue;
    candidates.push({kind:'object',bounds:b,point:centre(b),label:object.label,score:object.score});
  }
  return candidates.slice(0,8);
}
// Grayscale Sobel magnitude, sampled from the same canvas as detection.
export function sobelEdges(rgba,width,height) {
  if(rgba.length!==width*height*4)throw new Error('Edge image dimensions do not match.');
  const gray=new Float32Array(width*height),edges=new Float32Array(width*height);
  for(let i=0;i<gray.length;i++)gray[i]=rgba[4*i]*.299+rgba[4*i+1]*.587+rgba[4*i+2]*.114;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++) {
    const p=y*width+x;
    const gx=gray[p-width+1]+2*gray[p+1]+gray[p+width+1]-gray[p-width-1]-2*gray[p-1]-gray[p+width-1];
    const gy=gray[p+width-1]+2*gray[p+width]+gray[p+width+1]-gray[p-width-1]-2*gray[p-width]-gray[p-width+1];
    edges[p]=clamp(Math.hypot(gx,gy)/1020);
  }
  return edges;
}
// Constrained polar contour: outward gradients adjust the boundary but cannot
// make a region grow into its background, torso or the rest of a painting.
export function traceEdgeMask(edges,width,height,bounds,{kind='face'}={}) {
  if(edges.length!==width*height)throw new Error('Edge map dimensions do not match.');
  const result=new Uint8Array(width*height);
  const cx=(bounds.x+bounds.w*.5)*width,cy=(bounds.y+bounds.h*(kind==='face'?.48:.5))*height;
  const rx=Math.max(2,bounds.w*width*(kind==='face'?.68:.57));
  const ry=Math.max(2,bounds.h*height*(kind==='face'?.76:.57));
  const rays=72,radial=new Float32Array(rays);
  for(let k=0;k<rays;k++) {
    const angle=k*2*Math.PI/rays,dx=Math.cos(angle),dy=Math.sin(angle);
    let best=0,chosen=.94;
    for(let r=.68;r<=1.16;r+=.035) {
      const x=Math.round(cx+rx*dx*r),y=Math.round(cy+ry*dy*r);
      if(x<1||y<1||x>=width-1||y>=height-1)continue;
      // Prefer an outer contour over eyes, nose or texture inside a face.
      const strength=edges[y*width+x]*(1-.22*Math.abs(r-.97));
      if(strength>best){best=strength;chosen=r;}
    }
    radial[k]=best>=.105?chosen:.95;
  }
  const smooth=new Float32Array(rays);
  for(let k=0;k<rays;k++)smooth[k]=(radial[(k+rays-2)%rays]+2*radial[(k+rays-1)%rays]+3*radial[k]+2*radial[(k+1)%rays]+radial[(k+2)%rays])/9;
  const x0=Math.max(0,Math.floor(cx-rx*1.2)),x1=Math.min(width,Math.ceil(cx+rx*1.2));
  const y0=Math.max(0,Math.floor(cy-ry*1.2)),y1=Math.min(height,Math.ceil(cy+ry*1.2));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
    const nx=(x+.5-cx)/rx,ny=(y+.5-cy)/ry;
    const theta=(Math.atan2(ny,nx)+2*Math.PI)%(2*Math.PI),position=theta*rays/(2*Math.PI);
    const index=Math.floor(position),t=position-index;
    const radius=smooth[index]*(1-t)+smooth[(index+1)%rays]*t;
    if(Math.hypot(nx,ny)<=radius)result[y*width+x]=1;
  }
  return result;
}

/* For paintings that neither model recognises, choose a small textured focal
 * detail from the source itself. This is NOT called an identified face/object.
 * It is deliberately bounded; ALGO/ART still chooses where it is placed. */
export function salientDetails(edges,width,height,count=1) {
  const integral=new Float64Array((width+1)*(height+1)),stride=width+1;
  for(let y=1;y<=height;y++)for(let x=1;x<=width;x++) {
    const value=edges[(y-1)*width+x-1];
    integral[y*stride+x]=value+integral[(y-1)*stride+x]+integral[y*stride+x-1]-integral[(y-1)*stride+x-1];
  }
  const boxSum=(x0,y0,x1,y1)=>integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];
  const bw=Math.max(10,Math.min(width,Math.round(width*.24))),bh=Math.max(10,Math.min(height,Math.round(height*.25)));
  const proposals=[];
  for(let y=Math.ceil(bh/2);y<=height-bh/2;y+=Math.max(5,Math.round(height*.045))) {
    for(let x=Math.ceil(bw/2);x<=width-bw/2;x+=Math.max(5,Math.round(width*.045))) {
      const x0=Math.floor(x-bw/2),y0=Math.floor(y-bh/2),x1=x0+bw,y1=y0+bh;
      const density=boxSum(x0,y0,x1,y1)/(bw*bh);
      const nx=x/width,ny=y/height;
      // A gentle upper-centre bias favours faces in classical portraits
      // without claiming that edge density is semantic face recognition.
      const prior=1-.45*Math.min(1,Math.hypot((nx-.5)*1.1,(ny-.36)*1.35));
      proposals.push({x,y,density,score:density*prior});
    }
  }
  proposals.sort((a,b)=>b.score-a.score);
  const out=[];
  for(const p of proposals) {
    if(out.length>=count)break;
    if(p.density<.018)break; // refuse a flat field
    if(out.some(o=>Math.hypot(o.point.x-p.x/width,o.point.y-p.y/height)<.25))continue;
    const b={x:clamp((p.x-bw/2)/width,0,1-bw/width),y:clamp((p.y-bh/2)/height,0,1-bh/height),w:bw/width,h:bh/height};
    out.push({kind:'detail',bounds:b,point:centre(b),label:'Edge-selected detail',score:0});
  }
  return out;
}
