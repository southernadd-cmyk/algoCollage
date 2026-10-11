import {makeLayout,sanitiseSettings} from './composition.js';
import {validateMask} from './subject-data.js';

export const MAX_LOCKED_LAYERS=12;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const copy=value=>JSON.parse(JSON.stringify(value));
const requiredNumber=(n,label)=>{if(!finite(n))throw new Error('Invalid '+label+'.');return n;};
const rect=b=>{
  if(!b||!['x','y','w','h'].every(k=>finite(b[k]))||b.w<=0||b.h<=0)throw new Error('Invalid locked fragment bounds.');
  return copy(b);
};
// Score real positions, not merely whether the ALGO/ART seed is different.
// More occupied sectors and separation between neighbours beat clustering.
export function spreadScore(layout) {
  const {width,height,slots}=layout;
  if(!finite(width)||!finite(height)||width<=0||height<=0||!Array.isArray(slots)||!slots.length)return -Infinity;
  const points=slots.filter(p=>finite(p.x)&&finite(p.y)).map(p=>({x:p.x/width,y:p.y/height}));
  if(!points.length)return -Infinity;
  const sectors=new Set(),nearest=[],offscreen=points.filter(p=>p.x<0||p.x>1||p.y<0||p.y>1).length;
  for(const p of points) {
    sectors.add(Math.floor(Math.min(.999,Math.max(0,p.x))*4)+4*Math.floor(Math.min(.999,Math.max(0,p.y))*4));
    const distances=points.filter(q=>q!==p).map(q=>Math.hypot(p.x-q.x,p.y-q.y));
    if(distances.length)nearest.push(Math.min(...distances));
  }
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const xSpan=Math.min(1,Math.max(...xs)-Math.min(...xs)),ySpan=Math.min(1,Math.max(...ys)-Math.min(...ys));
  const meanNearest=nearest.length?nearest.reduce((a,b)=>a+b,0)/nearest.length:.1;
  const crowded=nearest.filter(d=>d<.075).length/Math.max(1,points.length);
  const topHalf=points.filter(p=>p.y<.5).length/points.length;
  const leftHalf=points.filter(p=>p.x<.5).length/points.length;
  const balanced=1-(Math.abs(topHalf-.5)+Math.abs(leftHalf-.5))/2;
  return 3*sectors.size/Math.min(16,points.length)+2*(xSpan+ySpan)/2+
    2*Math.min(.27,meanNearest)/.27+balanced-2*crowded-3*offscreen/points.length;
}
export function pickSpreadBaseline(A,settings,candidates) {
  if(!Array.isArray(candidates)||!candidates.length)throw new Error('No baseline candidates.');
  let best=null;
  for(const candidate of candidates) {
    if(!['field','geometric','rects'].includes(candidate.mode)||!candidate.seed)continue;
    const options=sanitiseSettings({...settings,layoutMode:candidate.mode,layoutSeed:candidate.seed});
    const layout=makeLayout(A,options);
    const score=spreadScore(layout);
    if(!best||score>best.score)best={mode:options.layoutMode,seed:options.layoutSeed,score,layout};
  }
  if(!best)throw new Error('No valid baseline was generated.');
  return best;
}
// Capture the actual geometry and masks at lock time. Re-cutting or changing
// the active pool must not change a layer whose artwork is already fixed.
export function captureLayer(scene,id,name) {
  if(!scene?.pieces?.length)throw new Error('Add some images before locking this layer.');
  if(typeof id!=='string'||!id||id.length>90)throw new Error('Invalid layer identifier.');
  const {width,height,slots,voids,strategy}=scene.layout;
  const settings=sanitiseSettings(scene.settings);
  return {id,name:String(name||'Locked layer').slice(0,80),
    settings,layout:copy({width,height,slots,voids,strategy}),cuts:{width:scene.cuts.width,height:scene.cuts.height},
    pieces:scene.pieces.map((piece,index)=>({
      imageId:piece.imageId,slot:copy(piece.slot),mask:copy(piece.mask),
      // Scope fragment caching to this immutable snapshot.
      fragmentId:'locked:'+id+':'+index,
      layerSettings:settings,
      layerCuts:{width:scene.cuts.width,height:scene.cuts.height}
    }))};
}
export function combineLayers(activeScene,layers=[]) {
  return {...activeScene,pieces:[...layers.flatMap(layer=>layer.pieces),...activeScene.pieces]};
}
export function guideForLayer(activeScene,layers,id) {
  if(id==='current')return activeScene;
  const layer=layers.find(l=>l.id===id);
  return layer?{...activeScene,layout:layer.layout,settings:{...activeScene.settings,scale:layer.settings.scale}}:activeScene;
}
export function referencedLayerImages(layers) {
  return new Set(layers.flatMap(layer=>layer.pieces.map(p=>p.imageId)));
}
// Portable projects and IndexedDB are user-controlled inputs; check the
// snapshot bounds and masked pieces before handing them to Canvas.
export function validateLockedLayers(value,imageIds,orientation) {
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>MAX_LOCKED_LAYERS)throw new Error('Invalid layer stack.');
  const ids=new Set(),allowed=new Set(imageIds);
  return value.map(layer=>{
    if(!layer||typeof layer.id!=='string'||!/^[a-z\d_-]{1,90}$/i.test(layer.id)||ids.has(layer.id))throw new Error('Invalid or duplicate layer ID.');
    ids.add(layer.id);
    const settings=sanitiseSettings(layer.settings);
    if(settings.orientation!==orientation)throw new Error('Locked layers must share one canvas orientation.');
    const source=layer.layout;
    const cutSize=layer.cuts;
    if(!cutSize||![cutSize.width,cutSize.height].every(n=>finite(n)&&n>=100&&n<=5000))throw new Error('Invalid locked cutting canvas.');
    if(!source||![source.width,source.height].every(n=>finite(n)&&n>=100&&n<=5000)||
       !Array.isArray(source.slots)||source.slots.length>48||!Array.isArray(source.voids)||source.voids.length>200)throw new Error('Invalid locked layout.');
    const validateShape=p=>{
      if(!p||!['x','y'].every(k=>finite(p[k]))||Math.abs(p.x)>source.width*3||Math.abs(p.y)>source.height*3)throw new Error('Invalid locked layout position.');
      for(const k of ['size','w','h','rot'])if(p[k]!==undefined&&!finite(p[k]))throw new Error('Invalid locked layout dimension.');
      return copy(p);
    };
    const layout={width:source.width,height:source.height,slots:source.slots.map(validateShape),
      voids:source.voids.map(v=>{rect(v);return copy(v);}),strategy:String(source.strategy||'ALGO/ART').slice(0,80)};
    if(!Array.isArray(layer.pieces)||layer.pieces.length<1||layer.pieces.length>48)throw new Error('Invalid locked layer pieces.');
    const pieces=layer.pieces.map((piece,index)=>{
      if(!piece||!allowed.has(piece.imageId))throw new Error('A locked layer references a missing image.');
      const slot=validateShape(piece.slot),mask=piece.mask;
      if(!mask||!Array.isArray(mask.points)||mask.points.length<3||mask.points.length>500||
         mask.points.some(p=>!p||!finite(p.x)||!finite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000))throw new Error('Invalid locked fragment path.');
      rect(mask.bounds);
      if(mask.alpha)validateMask(mask.alpha);
      if(mask.sourceWidth!==undefined&&(!finite(mask.sourceWidth)||mask.sourceWidth<=0||mask.sourceWidth>5000))throw new Error('Invalid locked source width.');
      if(mask.sourceHeight!==undefined&&(!finite(mask.sourceHeight)||mask.sourceHeight<=0||mask.sourceHeight>5000))throw new Error('Invalid locked source height.');
      return {imageId:piece.imageId,slot,mask:copy(mask),fragmentId:'locked:'+layer.id+':'+index,
        layerSettings:settings,layerCuts:copy(cutSize)};
    });
    return {id:layer.id,name:String(layer.name||'Locked layer').slice(0,80),settings,layout,cuts:copy(cutSize),pieces};
  });
}
