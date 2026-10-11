import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..'),site=resolve(root,'_site');
const manifest=JSON.parse(await readFile(resolve(root,'models/manifest.json'),'utf8'));
await rm(site,{recursive:true,force:true});
await mkdir(site,{recursive:true});
for(const file of ['index.html','favicon.svg','.nojekyll','css','js','fonts','vendor']) {
  await cp(resolve(root,file),resolve(site,file),{recursive:true});
}
const runtime=resolve(root,'node_modules/@mediapipe/tasks-vision');
await mkdir(resolve(site,'vendor/vision/wasm'),{recursive:true});
await cp(resolve(runtime,'vision_bundle.js'),resolve(site,'vendor/vision/vision_bundle.js'));
// The classic-worker CPU runtime needs SIMD and non-SIMD variants, not the module variant.
for(const file of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm']) {
  await cp(resolve(runtime,'wasm',file),resolve(site,'vendor/vision/wasm',file));
}
await cp(resolve(root,'THIRD_PARTY.md'),resolve(site,'THIRD_PARTY.md'));
await mkdir(resolve(root,'.model-cache'),{recursive:true});
await mkdir(resolve(site,'models'),{recursive:true});
for(const model of manifest.models) {
  const cached=resolve(root,'.model-cache',model.id+'.bin');
  let bytes;
  try {bytes=await readFile(cached);}catch {}
  const hash=data=>createHash('sha256').update(data).digest('hex');
  if(!bytes||hash(bytes)!==model.sha256) {
    const response=await fetch(model.url,{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`Model download failed: ${model.id} (${response.status})`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(hash(bytes)!==model.sha256)throw new Error(`Model checksum changed: ${model.id}. Review the upstream model before updating the manifest.`);
    await writeFile(cached,bytes);
  }
  await writeFile(resolve(site,'models',model.file),bytes);
  console.log(`Verified ${model.id}: ${(bytes.length/1048576).toFixed(1)} MB`);
}
console.log('Static studio built in _site.');
