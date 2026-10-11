import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {freehandOutline,validateHandCuts,handMasksForImage,MAX_HAND_CUTS,MAX_HAND_POINTS} from '../js/hand-cuts.js';
import {DEFAULTS,ENGINE_COMMIT,makeCuts,makeScene} from '../js/composition.js';
import {makeImageCuts} from '../js/image-cuts.js';
import {cutoutFromMask,placeCutouts} from '../js/layer-workflow.js';
import {validateProject} from '../js/storage.js';

const samples=[
  {x:.15,y:.22},{x:.55,y:.22},{x:.67,y:.28},{x:.67,y:.76},
  {x:.55,y:.81},{x:.15,y:.81},{x:.12,y:.50},{x:.15,y:.22}
];
const guide={width:1000,height:1400,masks:[{index:0,points:[],bounds:{x:20,y:20,w:300,h:400}}]};
test('mouse and touch freehand outlines are simplified, closed, bounded and nontrivial',()=>{
  const outline=freehandOutline(samples);
  assert.ok(outline.length>=3&&outline.length<=MAX_HAND_POINTS);
  assert.ok(outline.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
  assert.deepEqual(outline[0],{x:.15,y:.22});
  assert.equal(freehandOutline([{x:.5,y:.5},{x:.51,y:.51},{x:.52,y:.52}]),null,'A click or line cannot become a cut');
  const dense=Array.from({length:1500},(_,i)=>({x:.5+.27*Math.cos(2*Math.PI*i/1499),y:.5+.24*Math.sin(2*Math.PI*i/1499)}));
  assert.ok(freehandOutline(dense).length<=MAX_HAND_POINTS,'High-frequency pointer sampling stays portable');
});
test('manual scraps map to the full original photo without image stretching',()=>{
  const handCuts=[{id:'scissor-01',points:freehandOutline(samples)}];
  const image={id:'photo',width:1800,height:900,handCuts};
  const cuts=makeImageCuts(guide,{...DEFAULTS,cutStyle:'manual'},image);
  assert.equal(cuts.kind,'manual');assert.equal(cuts.masks.length,1);
  assert.equal(cuts.width,1800);assert.equal(cuts.height,900);
  assert.equal(cuts.masks[0].kind,'manual');
  assert.equal(cuts.masks[0].id,'hand:scissor-01');
  assert.equal(cuts.masks[0].sourceWidth,1800);
  assert.deepEqual(cuts.masks[0].points[0],{x:270,y:198});
  const picked=cutoutFromMask(image,cuts.masks[0],guide);
  assert.equal(picked.mask.points.length,cuts.masks[0].points.length);
  assert.equal(picked.mask.sourceWidth,1800);
  assert.equal(makeImageCuts(guide,{...DEFAULTS,cutStyle:'manual'},{...image,handCuts:[]}).masks.length,0);
});
test('freehand remains separate from the assembly guide and survives transfer and saved projects',()=>{
  const sandbox={window:{AlgoArt:{}}};
  for(const file of ['random.js','phi.js','palettes.js','marker.js','generator.js'])
    runInNewContext(readFileSync(new URL('../vendor/algoart/'+file,import.meta.url),'utf8'),sandbox,{filename:file});
  const A=sandbox.window.AlgoArt;
  const image={id:'photo',width:800,height:600,handCuts:[{id:'made-by-hand',points:freehandOutline(samples)}],
    license:'User supplied',data:'data:image/png;base64,aGVsbG8='};
  const settings={...DEFAULTS,cutStyle:'manual'};
  const scene=makeScene(A,settings,[image]);
  assert.equal(scene.pieces.length,0,'Manual mode must not auto-fill a board or fail on an image without cuts');
  const cutout=cutoutFromMask(image,scene.imageCuts.photo.masks[0],scene.cuts);
  const arranged=placeCutouts(scene,[cutout]);
  assert.equal(arranged.pieces.length,1);
  assert.deepEqual(arranged.pieces[0].mask.points,cutout.mask.points);
  const document={app:'ALGO/COLLAGE',version:4,engineCommit:ENGINE_COMMIT,settings,images:[image],layers:[],cutouts:[cutout]};
  const reopened=validateProject(document);
  assert.deepEqual(reopened.images[0].handCuts,image.handCuts);
  assert.equal(reopened.cutouts[0].mask.kind,'manual');
  assert.equal(makeImageCuts(scene.cuts,reopened.settings,reopened.images[0]).masks[0].id,cutout.mask.id);
});
test('import validation rejects malicious or excessive manual cut paths and duplicate IDs',()=>{
  const correct={id:'a',points:freehandOutline(samples)};
  assert.deepEqual(validateHandCuts([correct]),[correct]);
  assert.throws(()=>validateHandCuts([correct,correct]),/repeated/);
  assert.throws(()=>validateHandCuts(Array(MAX_HAND_CUTS+1).fill(correct)),/Invalid freehand/);
  assert.throws(()=>validateHandCuts([{...correct,points:Array(MAX_HAND_POINTS+1).fill({x:.4,y:.4})}]),/coordinates/);
  assert.throws(()=>validateHandCuts([{...correct,points:[{x:-10,y:.1},...correct.points]}]),/coordinates/);
});
test('freehand controls stay within Cutting Room, separate from assembly',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const board=html.slice(0,html.indexOf('<dialog id="cut-room"'));
  const room=html.slice(html.indexOf('<dialog id="cut-room"'));
  for(const id of ['freehand-overlay','freehand-controls','undo-hand-cut','clear-hand-cuts']){
    assert.ok(room.includes('id="'+id+'"'),id+' should be inside the Cutting Room');
    assert.ok(!board.includes('id="'+id+'"'),id+' must not leak onto the board');
  }
  assert.ok(room.includes('<option value="manual">'));
});
