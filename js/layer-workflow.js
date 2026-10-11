// The cutting room prepares exactly the fragments which move to the active
// assembly board. The source mask is snapshotted at transfer time: recomposing
// cannot silently re-cut it or replace it with another object.
import {validateMask} from './subject-data.js';

export const MAX_CUTOUTS=48;
const copy=obj=>JSON.parse(JSON.stringify(obj));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function cutoutKey(imageId,maskId){return JSON.stringify([imageId,maskId]);}
export function cutoutFromMask(image,mask,cuts) {
  if(!image?.id||!mask?.bounds||!Array.isArray(mask.points))throw new Error('Missing source or cutting outline.');
  return {imageId:image.id,mask:copy(mask),cutWidth:cuts.width,cutHeight:cuts.height,
    key:cutoutKey(image.id,String(mask.id??mask.index))};
}
export function validateCutouts(value,imageIds) {
  if(!Array.isArray(value)||value.length>MAX_CUTOUTS)throw new Error('Invalid cutting-room selection.');
  const ids=new Set(imageIds),keys=new Set();
  return value.map(item=>{
    if(!item||typeof item.imageId!=='string'||!ids.has(item.imageId)||typeof item.key!=='string'||item.key.length>650||keys.has(item.key))
      throw new Error('A cutout is missing its original photograph or has a duplicate ID.');
    keys.add(item.key);
    if(![item.cutWidth,item.cutHeight].every(n=>finite(n)&&n>=10&&n<=5000))
      throw new Error('Invalid cutout source dimensions.');
    const mask=item.mask,b=mask?.bounds;
    if(!b||!['x','y','w','h'].every(k=>finite(b[k]))||b.w<=0||b.h<=0||
       b.w>10000||b.h>10000||!Array.isArray(mask.points)||mask.points.length<3||mask.points.length>500||
       mask.points.some(p=>!p||!finite(p.x)||!finite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000))
      throw new Error('Invalid cutout geometry.');
    if(mask.alpha)validateMask(mask.alpha);
    if(mask.sourceWidth!==undefined&&(!finite(mask.sourceWidth)||mask.sourceWidth<1||mask.sourceWidth>5000))throw new Error('Invalid source width.');
    if(mask.sourceHeight!==undefined&&(!finite(mask.sourceHeight)||mask.sourceHeight<1||mask.sourceHeight>5000))throw new Error('Invalid source height.');
    return {imageId:item.imageId,key:item.key,mask:copy(mask),cutWidth:item.cutWidth,cutHeight:item.cutHeight};
  });
}
export function stagePieces(staged,layout,settings) {
  // Every piece has exactly one place: never duplicate a transferred image
  // to fill unused guide slots or silently truncate the user's selection.
  if(staged.length>layout.slots.length)throw new Error('The chosen ALGO/ART layout has '+layout.slots.length+
    ' positions, but '+staged.length+' cutouts are selected. Reduce the selection or try another baseline.');
  return staged.map((cutout,i)=>({
    imageId:cutout.imageId,mask:cutout.mask,slot:layout.slots[i],fragmentId:'tray:'+cutout.key,
    layerCuts:{width:cutout.cutWidth,height:cutout.cutHeight}
  }));
}
export function placeCutouts(scene,selected=[]) {
  return {...scene,pieces:stagePieces(selected,scene.layout,scene.settings)};
}
