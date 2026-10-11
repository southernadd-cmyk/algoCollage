import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeMask,decodeMask,subjectFromConfidence,validateAnalysis,ANALYSIS_VERSION,ANALYSIS_MODEL,foregroundComponent} from '../js/subject-data.js';
import {makeImageCuts,rankedSubjects,partialSubjectBounds} from '../js/image-cuts.js';
import {chooseCandidates,sobelEdges,traceEdgeMask,salientDetails} from '../js/edge-trace.js';
import {DEFAULTS,ENGINE_COMMIT} from '../js/composition.js';
import {validateProject,projectDocument} from '../js/storage.js';

const rect=(x,y,w,h,index=0)=>({index,bounds:{x,y,w,h},points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
const guide={width:1000,height:1400,masks:[rect(100,100,60,80),rect(600,800,70,100,1)]};
const mask=encodeMask(Uint8Array.from([0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0]),4,4);
const subject={id:'cat',label:'cat',score:.8,manual:false,bounds:{x:.25,y:.25,w:.5,h:.5},mask};
const analysis={version:ANALYSIS_VERSION,model:ANALYSIS_MODEL,subjects:[subject],faces:[]};

test('portable silhouettes retain their pixels and reject truncated or oversized data',()=>{
  assert.deepEqual([...decodeMask(mask)],[0,0,0,0,0,255,255,0,0,255,255,0,0,0,0,0]);
  assert.deepEqual([...decodeMask(encodeMask(new Uint8Array(6).fill(1),3,2))],new Array(6).fill(255));
  assert.throws(()=>decodeMask({...mask,runs:[100]}),/exceeds/);
  assert.throws(()=>decodeMask({...mask,runs:[2,2]}),/Incomplete/);
  assert.throws(()=>decodeMask({...mask,width:10000}),/dimensions/);
  assert.throws(()=>validateAnalysis({...analysis,subjects:[{...subject,bounds:{x:-1,y:0,w:1,h:1}}]}),/bounds/);
});

test('subject tracing keeps the foreground near the seed and rejects a full background',()=>{
  const w=20,h=20,confidence=new Float32Array(w*h);
  for(let y=5;y<15;y++)for(let x=5;x<15;x++)confidence[y*w+x]=.9;
  confidence[0]=.9;
  const result=subjectFromConfidence(confidence,w,h,{x:.5,y:.5},{label:'Object'});
  assert.deepEqual(result.bounds,{x:.25,y:.25,w:.5,h:.5});
  assert.equal(decodeMask(result.mask)[0],0);
  assert.equal([...decodeMask(result.mask)].filter(Boolean).length,100);
  assert.equal(subjectFromConfidence(new Float32Array(w*h).fill(.99),w,h,{x:.5,y:.5}),null);
  assert.equal([...foregroundComponent(new Uint8Array(9),3,3,{x:.5,y:.5})].some(Boolean),false);
});

test('fallback fragments preserve the source aspect ratio and retain substantially more image',()=>{
  for(const [width,height] of [[1600,800],[800,1600]]) {
    const cuts=makeImageCuts(guide,{...DEFAULTS,cutStyle:'regions'},{width,height});
    assert.equal(cuts.width,width);assert.equal(cuts.height,height);assert.equal(cuts.kind,'regions');
    for(const {bounds,sourceWidth,sourceHeight} of cuts.masks) {
      assert.ok(bounds.w*bounds.h/(width*height)>.65);
      assert.equal(sourceWidth,width);assert.equal(sourceHeight,height);
      assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.w<=width+1e-7&&bounds.y+bounds.h<=height+1e-7);
    }
  }
  const small=makeImageCuts(guide,{...DEFAULTS,cutStyle:'regions',cutSize:35},{width:1600,height:800});
  assert.ok(small.masks[0].bounds.w<makeImageCuts(guide,{...DEFAULTS,cutStyle:'regions'},{width:1600,height:800}).masks[0].bounds.w);
});

test('Algo Art territories rank objects while whole-subject mode retains the full silhouette',()=>{
  const other={...subject,id:'dog',bounds:{x:.75,y:.65,w:.2,h:.3}};
  const regions=[{x:.7,y:.6,w:.3,h:.4,index:3},{x:.1,y:.1,w:.5,h:.5,index:1}];
  assert.deepEqual(rankedSubjects([subject,other],regions).map(s=>s.subject.id),['dog','cat']);
  assert.deepEqual(rankedSubjects([subject,other],regions.slice().reverse()).map(s=>s.subject.id),['cat','dog']);
  const cuts=makeImageCuts(guide,DEFAULTS,{width:1600,height:800,analysis});
  assert.deepEqual(cuts.masks[0].bounds,{x:400,y:200,w:800,h:400});
  assert.equal(cuts.masks[0].alpha,mask);assert.equal(cuts.masks[0].kind,'subject');
  const recomposed=makeImageCuts(guide,{...DEFAULTS,layoutSeed:'NEW'}, {width:1600,height:800,analysis});
  assert.deepEqual(cuts,recomposed);
  const partial=makeImageCuts(guide,{...DEFAULTS,wholeSubjects:false},{width:1600,height:800,analysis});
  assert.ok(partial.masks[0].bounds.w<cuts.masks[0].bounds.w);
  assert.notEqual(partial.masks[0].id,cuts.masks[0].id);
});

test('partial object cuts expand around faces instead of bisecting them',()=>{
  const person={bounds:{x:0,y:0,w:1,h:1}},face={x:.1,y:.02,w:.2,h:.2};
  const window=partialSubjectBounds(person,{x:0,y:.15,w:.3,h:.5},35,[face]);
  assert.ok(window.x<=face.x&&window.y<=face.y);
  assert.ok(window.x+window.w>=face.x+face.w&&window.y+window.h>=face.y+face.h);
});

test('ALGO/ART regions choose visible foreground rather than misleading bounding boxes',()=>{
  const w=32,h=32,left=new Uint8Array(w*h),right=new Uint8Array(w*h);
  for(let y=8;y<24;y++)for(let x=0;x<8;x++)left[y*w+x]=1;
  for(let y=8;y<24;y++)for(let x=24;x<32;x++)right[y*w+x]=1;
  const common={label:'Shape',score:1,manual:false,bounds:{x:0,y:0,w:1,h:1}};
  const a={...common,id:'left',mask:encodeMask(left,w,h)};
  const b={...common,id:'right',mask:encodeMask(right,w,h)};
  const territory={x:.68,y:.2,w:.25,h:.6,index:7};
  assert.deepEqual(rankedSubjects([a,b],[territory]).map(entry=>entry.subject.id),['right','left']);
  assert.deepEqual(rankedSubjects([b,a],[{...territory,x:.07}]).map(entry=>entry.subject.id),['left','right']);
});

test('different ALGO/ART polygons with identical bounds select different subjects',()=>{
  const w=32,h=32,left=new Uint8Array(w*h),right=new Uint8Array(w*h);
  for(let y=8;y<24;y++)for(let x=0;x<8;x++)left[y*w+x]=1;
  for(let y=8;y<24;y++)for(let x=24;x<32;x++)right[y*w+x]=1;
  const common={label:'Subject',score:1,manual:false,bounds:{x:0,y:0,w:1,h:1}};
  const a={...common,id:'left',mask:encodeMask(left,w,h)};
  const b={...common,id:'right',mask:encodeMask(right,w,h)};
  const topLeft={index:0,x:0,y:0,w:1,h:1,points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
  const bottomRight={index:1,x:0,y:0,w:1,h:1,points:[{x:1,y:1},{x:1,y:0},{x:0,y:1}]};
  assert.equal(rankedSubjects([b,a],[topLeft])[0].subject.id,'left');
  assert.equal(rankedSubjects([a,b],[bottomRight])[0].subject.id,'right');
});

test('partial cuts follow a nearby real silhouette instead of an empty guide hole',()=>{
  const w=32,h=32,pixels=new Uint8Array(w*h);
  // An L-shaped silhouette touches the left edge and bottom. Its top-right
  // bounding-box area contains no pixels, but the guide points there.
  for(let y=1;y<32;y++)for(let x=0;x<4;x++)pixels[y*w+x]=1;
  for(let y=28;y<32;y++)for(let x=0;x<32;x++)pixels[y*w+x]=1;
  const lShape={bounds:{x:0,y:0,w:1,h:1},mask:encodeMask(pixels,w,h)};
  const guide={x:.68,y:.02,w:.24,h:.24};
  const window=partialSubjectBounds(lShape,guide,35,[]);
  assert.ok(window.x<.15,'the crop reaches the visible left-hand foreground');
  assert.ok(window.y<.2,'the crop remains close to the selected guide');
  const same=partialSubjectBounds(lShape,guide,35,[]);
  assert.deepEqual(window,same,'selection remains deterministic');
});

test('version 2 projects keep subject masks and version 1 projects keep their original cutter',async()=>{
  const image={id:'one',data:'data:image/png;base64,aGVsbG8=',analysis};
  const project={app:'ALGO/COLLAGE',version:2,engineCommit:ENGINE_COMMIT,settings:DEFAULTS,images:[image]};
  assert.deepEqual(validateProject(project).images[0].analysis,analysis);
  assert.equal(validateProject({...project,version:1}).settings.cutStyle,'geometric');
  assert.throws(()=>validateProject({...project,images:[{...image,analysis:{...analysis,subjects:[{...subject,mask:{...mask,runs:[5]}}]}}]}),/Incomplete/);
  const oldFileReader=globalThis.FileReader;
  globalThis.FileReader=class {readAsDataURL(){this.result=image.data;this.onload();}};
  try {
    const saved=await projectDocument(DEFAULTS,[{id:'one',analysis,blob:new Blob(['hello']),element:{},objectURL:'blob:local'}]);
    assert.equal(saved.version,4);assert.deepEqual(saved.images[0].analysis,analysis);
    assert.ok(!('element' in saved.images[0]));assert.ok(!('objectURL' in saved.images[0]));
  }finally {globalThis.FileReader=oldFileReader;}
});


test('a portrait face outranks a broad person box and manual face picking',()=>{
  const face={x:.38,y:.24,w:.2,h:.2};
  const wholePainting={bounds:{x:.03,y:.02,w:.94,h:.96},score:.95,label:'person'};
  const selections=chooseCandidates([wholePainting],[face]);
  assert.equal(selections.length,1);
  assert.equal(selections[0].kind,'face');
  assert.deepEqual(selections[0].bounds,face);
  assert.equal(chooseCandidates([wholePainting],[face],{x:.46,y:.33})[0].kind,'face');
  assert.equal(chooseCandidates([wholePainting],[],{x:.46,y:.33})[0].kind,'detail');
  assert.deepEqual(chooseCandidates([wholePainting],[]),[]);
});

test('edge-guided contours stay within a detected face rather than spreading into its painting',()=>{
  const w=128,h=128,data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const i=4*(y*w+x),value=x>=40&&x<88&&y>=32&&y<80?50:220;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const edges=sobelEdges(data,w,h);
  const face={x:39/w,y:31/h,w:50/w,h:50/h};
  const extracted=traceEdgeMask(edges,w,h,face);
  const subject=subjectFromConfidence(extracted,w,h,{x:.5,y:.43},{label:'Face / head'});
  assert.ok(subject,'trace produces a subject');
  assert.ok(subject.bounds.w<.52&&subject.bounds.h<.55,'only a local head region survives');
  assert.equal(decodeMask(subject.mask)[0],0,'canvas background is not selected');
  assert.ok([...extracted].reduce((n,p)=>n+p,0)/(w*h)<.19);
});

test('oversensitive painterly foreground and stale cached masks cannot survive as objects',()=>{
  const w=100,h=100,confidence=new Float32Array(w*h);
  for(let y=6;y<95;y++)for(let x=5;x<95;x++)confidence[y*w+x]=1;
  assert.equal(subjectFromConfidence(confidence,w,h,{x:.5,y:.5}),null);
  const noSubjects=makeImageCuts(guide,DEFAULTS,{width:1200,height:800});
  assert.equal(noSubjects.kind,'details');
  assert.ok(noSubjects.masks.every(m=>m.bounds.w*m.bounds.h/(1200*800)<.28));
  const oldMask={version:1,model:'mediapipe-1.1.0-magic-touch-v2',subjects:[subject],faces:[]};
  assert.equal(validateAnalysis(oldMask),undefined,'old saved segmentation is deliberately recalculated');
  const oldProject={app:'ALGO/COLLAGE',version:2,engineCommit:ENGINE_COMMIT,settings:DEFAULTS,images:[{id:'old',data:'data:image/png;base64,aGVsbG8=',analysis:oldMask}]};
  assert.equal(validateProject(oldProject).images[0].analysis,undefined,'legacy projects still open');
});

test('an undetected painterly feature yields a compact edge-selected detail',()=>{
  const w=120,h=160,rgba=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    const textured=x>=42&&x<73&&y>=34&&y<77;
    const intensity=textured?((x+y)%5<2?40:205):170;
    rgba[i]=rgba[i+1]=rgba[i+2]=intensity;rgba[i+3]=255;
  }
  const edges=sobelEdges(rgba,w,h),details=salientDetails(edges,w,h);
  assert.equal(details.length,1);
  assert.equal(details[0].kind,'detail');
  assert.ok(details[0].bounds.x>.15&&details[0].bounds.x<.75);
  assert.ok(details[0].bounds.y<.6);
  assert.ok(details[0].bounds.w*details[0].bounds.h<.08);
  assert.deepEqual(salientDetails(new Float32Array(w*h),w,h),[]);
});
