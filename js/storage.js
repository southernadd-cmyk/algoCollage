import { sanitiseSettings, COLLAGE_VERSION, ENGINE_COMMIT } from './composition.js';
import { MAX_IMAGES, MAX_PROJECT_BYTES, MAX_IMAGE_BYTES, RASTER_TYPES, safeURL, plainText } from './sources.js';
import {validateAnalysis} from './subject-data.js';
import {validateLockedLayers} from './layer-stack.js';
import {validateCutouts} from './layer-workflow.js';

function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('algo-collage-v1',2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('images'))db.createObjectStore('images',{keyPath:'id'});
      if(!db.objectStoreNames.contains('layers'))db.createObjectStore('layers',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function readWorkspace() {
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(['images','layers']),images=tx.objectStore('images').getAll(),stack=tx.objectStore('layers').get('stack');
    tx.oncomplete=()=>resolve({images:images.result.sort((a,b)=>a.order-b.order),layers:stack.result?.items||[],cutouts:stack.result&&Object.hasOwn(stack.result,'cutouts')?stack.result.cutouts:null});
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function writeWorkspace(images,layers=[],cutouts=[]) {
  const db=await database();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction(['images','layers'],'readwrite'),store=tx.objectStore('images');
    store.clear();
    images.forEach((item,order)=>{
      const {element,objectURL,...saved}=item;
      store.put({...saved,order});
    });
    tx.objectStore('layers').put({id:'stack',items:layers,cutouts});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
// Retain these small wrappers for code importing the original pool API.
export async function readPool(){return (await readWorkspace()).images;}
export async function writePool(images){const saved=await readWorkspace();return writeWorkspace(images,saved.layers,saved.cutouts||[]);}

export function readSettings() {
  try {return sanitiseSettings(JSON.parse(localStorage.getItem('algo-collage-settings')) || {});} catch {return sanitiseSettings();}
}
export function writeSettings(settings) {localStorage.setItem('algo-collage-settings',JSON.stringify(settings));}
function dataURL(blob) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}

export async function projectDocument(settings, images, layers=[], cutouts=[]) {
  return {app:'ALGO/COLLAGE', version:COLLAGE_VERSION, engineCommit:ENGINE_COMMIT, settings:sanitiseSettings(settings), layers, cutouts,
    images:await Promise.all(images.map(async image => {
      const {element,objectURL,blob,order,...metadata}=image;
      return {...metadata, data:await dataURL(blob)};
    }))};
}

export function validateProject(project) {
  if (!project || project.app !== 'ALGO/COLLAGE' || ![1,2,3,COLLAGE_VERSION].includes(project.version) || project.engineCommit !== ENGINE_COMMIT) {
    throw new Error('This project needs a different version of Algo Collage.');
  }
  if (!Array.isArray(project.images) || project.images.length > MAX_IMAGES) throw new Error('A project can contain up to 24 images.');
  const ids=new Set(); let total=0;
  const images=project.images.map(image => {
    if (typeof image.id !== 'string' || !image.id || image.id.length > 200 || ids.has(image.id)) throw new Error('The project contains invalid or duplicate image IDs.');
    ids.add(image.id);
    const match = typeof image.data==='string' && image.data.match(/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || !RASTER_TYPES.includes(match[1]) || match[2].length%4!==0 || match[2].length*3/4 > MAX_IMAGE_BYTES) throw new Error('The project contains an invalid image.');
    total+=match[2].length;
    if (total>MAX_PROJECT_BYTES) throw new Error('This project is too large.');
    return {id:image.id, title:plainText(image.title || 'Untitled image'), creator:plainText(image.creator),
      license:plainText(image.license || 'User supplied'), sourceUrl:safeURL(image.sourceUrl), licenseUrl:safeURL(image.licenseUrl),
      provider:plainText(image.provider || 'Upload'), query:plainText(image.query), enabled:image.enabled!==false, data:image.data,
      analysis:validateAnalysis(image.analysis)};
  });
  // Keep the original cutter when reopening an old project, so its pixels do not change.
  const input=project.version===1?{...project.settings,cutStyle:'geometric'}:project.settings;
  const settings=sanitiseSettings(input);
  const layers=project.version>=3?validateLockedLayers(project.layers,images.map(i=>i.id),settings.orientation):[];
  const cutouts=project.version>=4?validateCutouts(project.cutouts,images.map(i=>i.id)):null;
  return {settings, images, layers, cutouts};
}
