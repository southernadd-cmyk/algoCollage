import { sanitiseSettings, COLLAGE_VERSION, ENGINE_COMMIT } from './composition.js';
import { MAX_IMAGES, MAX_PROJECT_BYTES, MAX_IMAGE_BYTES, RASTER_TYPES, safeURL, plainText } from './sources.js';

function database() {
  return new Promise((resolve,reject) => {
    const request=indexedDB.open('algo-collage-v1',1);
    request.onupgradeneeded=() => request.result.createObjectStore('images',{keyPath:'id'});
    request.onsuccess=() => resolve(request.result); request.onerror=() => reject(request.error);
  });
}
export async function readPool() {
  const db=await database();
  try { return await new Promise((resolve,reject) => {
    const tx=db.transaction('images'), request=tx.objectStore('images').getAll();
    request.onsuccess=() => resolve(request.result.sort((a,b)=>a.order-b.order)); request.onerror=() => reject(request.error);
  }); } finally {db.close();}
}
export async function writePool(images) {
  const db=await database();
  try { await new Promise((resolve,reject) => {
    const tx=db.transaction('images','readwrite'), store=tx.objectStore('images');
    store.clear(); images.forEach((item,order) => {
      const { element, objectURL, ...saved } = item; store.put({...saved, order});
    });
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  }); } finally {db.close();}
}

export function readSettings() {
  try {return sanitiseSettings(JSON.parse(localStorage.getItem('algo-collage-settings')) || {});} catch {return sanitiseSettings();}
}
export function writeSettings(settings) {localStorage.setItem('algo-collage-settings',JSON.stringify(settings));}
function dataURL(blob) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}

export async function projectDocument(settings, images) {
  return {app:'ALGO/COLLAGE', version:COLLAGE_VERSION, engineCommit:ENGINE_COMMIT, settings:sanitiseSettings(settings),
    images:await Promise.all(images.map(async image => {
      const {element,objectURL,blob,order,...metadata}=image;
      return {...metadata, data:await dataURL(blob)};
    }))};
}

export function validateProject(project) {
  if (!project || project.app !== 'ALGO/COLLAGE' || project.version !== COLLAGE_VERSION || project.engineCommit !== ENGINE_COMMIT) {
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
      provider:plainText(image.provider || 'Upload'), query:plainText(image.query), enabled:image.enabled!==false, data:image.data};
  });
  return {settings:sanitiseSettings(project.settings), images};
}
