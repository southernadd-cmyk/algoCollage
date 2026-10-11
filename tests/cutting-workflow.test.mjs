import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DEFAULTS,ENGINE_COMMIT,makeScene,makeLayout} from '../js/composition.js';
import {cutoutFromMask,validateCutouts,placeCutouts,stagePieces,MAX_CUTOUTS} from '../js/layer-workflow.js';
import {captureLayer} from '../js/layer-stack.js';
import {validateProject,projectDocument} from '../js/storage.js';
const sandbox={window:{AlgoArt:{}}};
for(const file of ['random.js','phi.js','palettes.js','marker.js','generator.js'])
  runInNewContext(readFileSync(new URL('../vendor/algoart/'+file,import.meta.url),'utf8'),sandbox,{filename:file});
const A=sandbox.window.AlgoArt;
const pool=[{id:'first',title:'First image'},{id:'second',title:'Second image'}];
const scene=makeScene(A,DEFAULTS,pool);
function cutout(n) {
  const piece=scene.pieces[n];
  return cutoutFromMask(pool.find(p=>p.id===piece.imageId),piece.mask,scene.cuts);
}
test('cutting is independent from placement: transferring two scraps places only two, once each',()=>{
  const selected=[cutout(0),cutout(1)];
  const placed=placeCutouts(scene,selected);
  assert.equal(placed.pieces.length,2);
  assert.deepEqual(placed.pieces.map(p=>p.imageId),selected.map(c=>c.imageId));
  assert.deepEqual(placed.pieces.map(p=>p.mask),selected.map(c=>c.mask));
  assert.equal(scene.pieces.length,12,'The original auto-fill engine is still available for legacy projects');
});
test('the original cut geometry is preserved when the ALGO/ART guide changes',()=>{
  const selected=[cutout(0),cutout(1)],next=makeScene(A,{...DEFAULTS,layoutSeed:'LAYER-NEXT-002',layoutMode:'rects'},pool);
  const before=placeCutouts(scene,selected),after=placeCutouts(next,selected);
  assert.equal(after.pieces.length,2);
  assert.deepEqual(after.pieces.map(p=>p.mask),before.pieces.map(p=>p.mask));
  assert.notDeepEqual(after.pieces.map(p=>p.slot),before.pieces.map(p=>p.slot));
  const locked=captureLayer(before,'cut-layer','Layer 1');
  assert.deepEqual(locked.pieces.map(p=>p.mask),before.pieces.map(p=>p.mask));
});
test('a transfer cannot truncate selected cutouts or silently duplicate them',()=>{
  const selected=[cutout(0),cutout(1),cutout(2)];
  assert.throws(()=>stagePieces(selected,{slots:[{x:5,y:5},{x:20,y:20}]},DEFAULTS),/2 positions/);
  assert.equal(stagePieces(selected,scene.layout,DEFAULTS).length,3);
});
test('portable v4 projects save the transferred scraps while v3 opens for migration',async()=>{
  const data='data:image/png;base64,aGVsbG8=';
  const selected=[cutout(0),cutout(1)];
  const doc={app:'ALGO/COLLAGE',version:4,engineCommit:ENGINE_COMMIT,settings:DEFAULTS,images:pool.map(i=>({...i,license:'CC0',data})),layers:[],cutouts:selected};
  const opened=validateProject(doc);
  assert.deepEqual(opened.cutouts,selected);
  assert.equal(validateProject({...doc,version:3}).cutouts,null);
  assert.equal(validateProject({...doc,version:2}).cutouts,null);
  assert.throws(()=>validateProject({...doc,cutouts:[...selected,selected[0]]}),/duplicate ID/);
  assert.throws(()=>validateProject({...doc,cutouts:selected.map(c=>({...c,imageId:'deleted'}))}),/missing its original/);
  assert.throws(()=>validateProject({...doc,cutouts:Array(MAX_CUTOUTS+1).fill(selected[0])}),/selection/);
  const original=globalThis.FileReader;
  globalThis.FileReader=class{readAsDataURL(){this.result=data;this.onload();}};
  try {
    const exported=await projectDocument(DEFAULTS,pool.map(i=>({...i,blob:new Blob(['hi']),element:{},objectURL:'mock'})),[],selected);
    assert.equal(exported.version,4);
    assert.deepEqual(validateProject(exported).cutouts,selected);
  }finally{globalThis.FileReader=original;}
});
