import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DEFAULTS,makeScene,makeLayout,sanitiseSettings,ENGINE_COMMIT} from '../js/composition.js';
import {spreadScore,pickSpreadBaseline,captureLayer,combineLayers,guideForLayer,referencedLayerImages,validateLockedLayers,MAX_LOCKED_LAYERS} from '../js/layer-stack.js';
import {validateProject,projectDocument} from '../js/storage.js';
const sandbox={window:{AlgoArt:{}}};
for(const file of ['random.js','phi.js','palettes.js','marker.js','generator.js'])
  runInNewContext(readFileSync(new URL('../vendor/algoart/'+file,import.meta.url),'utf8'),sandbox,{filename:file});
const A=sandbox.window.AlgoArt;
const pool=[{id:'a',title:'A'},{id:'b',title:'B'}];
const seeds=[{mode:'field',seed:'SCATTER-1'},{mode:'geometric',seed:'SCATTER-2'},{mode:'rects',seed:'SCATTER-3'}];

test('spread metric distinguishes a distributed guide from a clustered guide',()=>{
  const positions=values=>({width:100,height:100,slots:values.map(([x,y])=>({x,y}))});
  const wellSpread=positions([[10,12],[85,10],[10,85],[88,85],[48,46],[50,12]]);
  const clumped=positions([[47,49],[48,48],[49,50],[50,48],[51,50],[52,49]]);
  assert.ok(spreadScore(wellSpread)>spreadScore(clumped));
  assert.equal(spreadScore({width:100,height:100,slots:[]}),-Infinity);
});

test('random baseline selection is reproducible for a given list of seeds, and uses actual layouts',()=>{
  const one=pickSpreadBaseline(A,DEFAULTS,seeds),two=pickSpreadBaseline(A,DEFAULTS,seeds);
  assert.deepEqual(one,two);
  assert.deepEqual(one.layout,makeLayout(A,sanitiseSettings({...DEFAULTS,layoutMode:one.mode,layoutSeed:one.seed})));
  assert.ok(seeds.some(item=>item.seed===one.seed&&item.mode===one.mode));
});

test('locking freezes source images, cut shapes and guide independently of the active layer',()=>{
  const start=makeScene(A,DEFAULTS,pool),locked=captureLayer(start,'first','Layer 1');
  const saved=JSON.stringify(locked);
  const later=makeScene(A,{...DEFAULTS,layoutMode:'rects',layoutSeed:'NEXT-BASE',cutSeed:'NEW-CUT',scale:120},pool);
  const combined=combineLayers(later,[locked]);
  assert.equal(combined.pieces.length,start.pieces.length+later.pieces.length);
  assert.equal(JSON.stringify(combined.pieces.slice(0,locked.pieces.length)),JSON.stringify(locked.pieces));
  assert.equal(JSON.stringify(locked),saved);
  assert.deepEqual(guideForLayer(later,[locked],'first').layout,locked.layout);
  assert.deepEqual(guideForLayer(later,[locked],'current').layout,later.layout);
  assert.equal(locked.pieces[0].layerSettings.scale,DEFAULTS.scale);
  assert.ok(referencedLayerImages([locked]).has('a'));
  assert.ok(locked.pieces[0].fragmentId.startsWith('locked:first:'));
});

test('layers retain independently selected guides across multiple locks and layer removal',()=>{
  const a=makeScene(A,DEFAULTS,pool);
  const b=makeScene(A,{...DEFAULTS,layoutSeed:'SECOND',layoutMode:'geometric'},pool);
  const c=makeScene(A,{...DEFAULTS,layoutSeed:'THIRD',layoutMode:'rects'},pool);
  const layer1=captureLayer(a,'one','Layer 1'),layer2=captureLayer(b,'two','Layer 2');
  const all=combineLayers(c,[layer1,layer2]);
  assert.equal(JSON.stringify(all.pieces.slice(0,layer1.pieces.length)),JSON.stringify(layer1.pieces));
  assert.equal(JSON.stringify(all.pieces.slice(layer1.pieces.length,layer1.pieces.length+layer2.pieces.length)),JSON.stringify(layer2.pieces));
  assert.equal(combineLayers(c,[layer2]).pieces.length,layer2.pieces.length+c.pieces.length);
  assert.deepEqual(guideForLayer(c,[layer1,layer2],'two').layout,layer2.layout);
});

test('v3 projects restore exact locked snapshots; older projects remain compatible',async()=>{
  const scene=makeScene(A,DEFAULTS,pool),locked=captureLayer(scene,'base','Layer 1');
  const data='data:image/png;base64,aGVsbG8=';
  const doc={app:'ALGO/COLLAGE',version:4,engineCommit:ENGINE_COMMIT,settings:DEFAULTS,
    images:pool.map(p=>({...p,data,license:'Public domain'})),layers:[locked],cutouts:[]};
  const loaded=validateProject(doc);
  assert.deepEqual(loaded.layers[0].layout,locked.layout);
  assert.deepEqual(loaded.layers[0].pieces.map(p=>p.mask),locked.pieces.map(p=>p.mask));
  assert.equal(validateProject({...doc,version:3}).layers.length,1);
  assert.equal(validateProject({...doc,version:2}).layers.length,0);
  assert.equal(validateProject({...doc,version:1}).settings.cutStyle,'geometric');
  assert.throws(()=>validateProject({...doc,layers:[{...locked,pieces:[{...locked.pieces[0],imageId:'deleted'}]}]}),/missing image/);
  assert.throws(()=>validateProject({...doc,layers:[locked,locked]}),/duplicate layer/);
  assert.throws(()=>validateProject({...doc,settings:{...DEFAULTS,orientation:'landscape'}}),/orientation/);
  assert.throws(()=>validateProject({...doc,layers:Array(MAX_LOCKED_LAYERS+1).fill(locked)}),/layer stack/);
  const original=globalThis.FileReader;
  globalThis.FileReader=class{readAsDataURL(){this.result=data;this.onload();}};
  try{
    const exported=await projectDocument(DEFAULTS,pool.map(p=>({...p,blob:new Blob(['hello']),element:{},objectURL:'blob:mock'})),[locked]);
    assert.equal(exported.version,4);
    assert.equal(validateProject(exported).layers.length,1);
  }finally{globalThis.FileReader=original;}
});
