const colours=['#d45435','#27614f','#ba9138','#515f86','#a77083'];
function path(ctx, points, ox=0, oy=0) {
  ctx.beginPath(); points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x-ox,p.y-oy)); ctx.closePath();
}
export function coverImage(ctx, image, x, y, w, h) {
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
  const iw=image.naturalWidth*scale, ih=image.naturalHeight*scale;
  ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function targetContext(canvas,w,h,scale=1) {
  canvas.width=Math.round(w*scale); canvas.height=Math.round(h*scale);
  const ctx=canvas.getContext('2d'); ctx.scale(scale,scale); return ctx;
}
function paintPaper(ctx,w,h,colour) {ctx.fillStyle=colour;ctx.fillRect(0,0,w,h);}

export function fragmentCanvas(piece,cuts,image) {
  const {bounds,points}=piece.mask;
  const canvas=document.createElement('canvas'); canvas.width=Math.ceil(bounds.w);canvas.height=Math.ceil(bounds.h);
  const ctx=canvas.getContext('2d');ctx.translate(-bounds.x,-bounds.y);path(ctx,points);ctx.clip();
  coverImage(ctx,image.element,0,0,cuts.width,cuts.height);
  return canvas;
}
export function renderCollage(canvas,scene,images,{scale=1,cache=new Map()}={}) {
  const {layout,cuts,settings,pieces}=scene;
  const ctx=targetContext(canvas,layout.width,layout.height,scale);
  paintPaper(ctx,layout.width,layout.height,settings.paper);
  const lookup=new Map(images.map(i=>[i.id,i]));
  for (const piece of pieces) {
    const image=lookup.get(piece.imageId); if (!image?.element) continue;
    const {bounds,points}=piece.mask, p=piece.slot;
    let factor=p.w ? Math.min(p.w/bounds.w,p.h/bounds.h)*0.92*(settings.scale/165) : p.size/bounds.w*(settings.scale/100);
    factor=Math.min(factor,layout.width*0.8/bounds.w,layout.height*0.65/bounds.h);
    let fragment=cache.get(piece.fragmentId);
    if (!fragment) {fragment=fragmentCanvas(piece,cuts,image);cache.set(piece.fragmentId,fragment);}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    if (settings.monochrome) ctx.filter='grayscale(1)';
    if (settings.shadow) {ctx.shadowColor='rgba(30,23,16,.25)';ctx.shadowBlur=11;ctx.shadowOffsetX=4;ctx.shadowOffsetY=6;}
    ctx.drawImage(fragment,-bounds.w*factor/2,-bounds.h*factor/2,bounds.w*factor,bounds.h*factor);
    ctx.shadowColor='transparent';ctx.filter='none';ctx.scale(factor,factor);ctx.translate(-bounds.w/2,-bounds.h/2);
    path(ctx,points,bounds.x,bounds.y);ctx.strokeStyle='rgba(255,252,243,.78)';ctx.lineWidth=1.5/Math.max(factor,0.2);ctx.stroke();
    ctx.restore();
  }
  return canvas;
}

export function renderCutMap(canvas,scene,images,{scale=0.5}={}) {
  const cuts=scene.cuts, ctx=targetContext(canvas,cuts.width,cuts.height,scale);
  paintPaper(ctx,cuts.width,cuts.height,scene.settings.paper);
  const first=images.find(i=>i.enabled!==false && i.element);
  if (first) {ctx.globalAlpha=0.45;coverImage(ctx,first.element,0,0,cuts.width,cuts.height);ctx.globalAlpha=1;}
  cuts.masks.forEach((mask,i)=>{
    path(ctx,mask.points);ctx.globalAlpha=0.2;ctx.fillStyle=colours[i%colours.length];ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle=colours[i%colours.length];ctx.lineWidth=3;ctx.stroke();
    const {x,y,w,h}=mask.bounds;
    ctx.fillStyle='#1b231d';ctx.fillRect(x+w/2-16,y+h/2-14,32,28);ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x+w/2,y+h/2);
  });
}

export function renderLayoutMap(canvas,scene,{scale=0.5}={}) {
  const {layout,settings}=scene,ctx=targetContext(canvas,layout.width,layout.height,scale);
  paintPaper(ctx,layout.width,layout.height,settings.paper);
  for (const v of layout.voids) {ctx.fillStyle='rgba(39,97,79,.06)';ctx.fillRect(v.x,v.y,v.w,v.h);ctx.strokeStyle='rgba(39,97,79,.3)';ctx.setLineDash([8,8]);ctx.strokeRect(v.x,v.y,v.w,v.h);ctx.setLineDash([]);}
  layout.slots.forEach((p,i)=>{
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);const w=p.w ? p.w*0.9 : p.size*settings.scale/100;const h=p.h ? p.h*0.9 : w/1.618;
    ctx.fillStyle=colours[p.tier==='hero'?0:p.tier==='medium'?1:i%colours.length];ctx.globalAlpha=p.tier==='small'?0.3:0.55;
    ctx.fillRect(-w/2,-h/2,w,h);ctx.globalAlpha=1;ctx.strokeStyle=colours[i%colours.length];ctx.lineWidth=2;ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.fillStyle='#1b231d';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),0,0);ctx.restore();
  });
}
