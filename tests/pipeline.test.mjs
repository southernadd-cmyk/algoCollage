import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {DEFAULTS,makeCuts,makeLayout,makeScene,sanitiseSettings} from '../js/composition.js';
import {searchURL,parseResults,recognisedLicense,safeURL,creditsText} from '../js/sources.js';
import {validateProject} from '../js/storage.js';
import {pngWithCredits} from '../js/png.js';

const sandbox={window:{AlgoArt:{}}};
const upstream=JSON.parse(readFileSync(new URL('../vendor/algoart/upstream.json',import.meta.url)));
for(const file of Object.keys(upstream.files))runInNewContext(readFileSync(new URL('../vendor/algoart/'+file,import.meta.url),'utf8'),sandbox,{filename:file});
const A=sandbox.window.AlgoArt;
const pool=[{id:'a',title:'Image A',license:'CC0'}, {id:'b',title:'Image B',license:'Public domain'}, {id:'c',enabled:false,title:'Excluded',license:'CC0'}];
const serial=value=>JSON.stringify(value);

test('vendored engine is exactly the pinned upstream revision',()=>{
  for(const [file,expected] of Object.entries(upstream.files)) {
    const data=readFileSync(new URL('../vendor/algoart/'+file,import.meta.url));
    assert.equal(createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),expected,file);
  }
});

test('all cut/layout families produce reproducible finite geometry in both orientations and square',()=>{
  for(const orientation of ['portrait','landscape','square'])for(const mode of ['field','geometric','rects']) {
    const s={...DEFAULTS,orientation,cutMode:mode,layoutMode:mode};
    const cuts=makeCuts(A,s),layout=makeLayout(A,s);
    assert.equal(serial(cuts),serial(makeCuts(A,s)));assert.equal(serial(layout),serial(makeLayout(A,s)));
    assert.ok(cuts.masks.length>0);assert.ok(layout.slots.length>0);assert.ok(layout.slots.length<=s.pieces);
    for(const mask of cuts.masks) {
      assert.ok(mask.bounds.w>0&&mask.bounds.h>0);
      for(const p of mask.points) {assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=-1e-7&&p.x<=cuts.width+1e-7);assert.ok(p.y>=-1e-7&&p.y<=cuts.height+1e-7);}
    }
    for(const p of layout.slots)assert.ok([p.x,p.y,p.size,p.rot].every(Number.isFinite));
  }
});

test('Recompose preserves fragments; Re-cut preserves layout; image shuffle preserves geometry',()=>{
  const original=makeScene(A,DEFAULTS,pool);
  const recompose=makeScene(A,{...DEFAULTS,layoutSeed:'DIFFERENT'},pool);
  assert.deepEqual(original.pieces.map(p=>p.fragmentId),recompose.pieces.map(p=>p.fragmentId));
  assert.equal(serial(original.cuts),serial(recompose.cuts));assert.notEqual(serial(original.layout),serial(recompose.layout));
  const recut=makeScene(A,{...DEFAULTS,cutSeed:'DIFFERENT'},pool);
  assert.equal(serial(original.layout),serial(recut.layout));assert.notEqual(serial(original.cuts),serial(recut.cuts));
  const shuffle=makeScene(A,{...DEFAULTS,imageSeed:'NEW-MATERIAL'},pool);
  assert.equal(serial(original.cuts),serial(shuffle.cuts));assert.equal(serial(original.layout),serial(shuffle.layout));
  assert.notDeepEqual(original.pieces.map(p=>p.fragmentId),shuffle.pieces.map(p=>p.fragmentId));
  assert.deepEqual([...new Set(original.pieces.map(p=>p.imageId))].sort(),['a','b']);
  assert.ok(!creditsText(original,pool).includes('Excluded'));assert.equal(makeScene(A,DEFAULTS,[]).pieces.length,0);
});

test('the bridge restores the upstream renderer state even after an exception',()=>{
  const stroke=A.stroke,render=A.render;A.rendererVersion=6;A.W=765;A.H=432;A.lastRenderMeta={sentinel:true};
  makeCuts(A,DEFAULTS);assert.equal(A.stroke,stroke);assert.equal(A.rendererVersion,6);assert.equal(A.W,765);assert.equal(A.H,432);
  A.render=()=>{throw new Error('fixture failure');};
  assert.throws(()=>makeCuts(A,DEFAULTS),/fixture failure/);assert.equal(A.stroke,stroke);assert.equal(A.rendererVersion,6);
  assert.equal(A.W,765);assert.equal(A.H,432);assert.deepEqual(A.lastRenderMeta,{sentinel:true});A.render=render;
});

test('providers apply licence filters and browser API parameters; unsafe links never render',()=>{
  const commons=new URL(searchURL('commons','cats'));assert.equal(commons.searchParams.get('origin'),'*');assert.equal(commons.searchParams.get('gsrnamespace'),'6');
  assert.equal(new URL(searchURL('openverse','space')).searchParams.get('license'),'cc0,pdm');
  assert.equal(recognisedLicense('CC BY-SA 4.0'),'by-sa');assert.equal(recognisedLicense('CC BY-ND 4.0'),'');assert.equal(recognisedLicense('CC BY-NC-SA 4.0'),'');
  assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('https://user:pass@example.org'),'');
  const result={id:'1',title:'<b>Cat</b>',creator:'<img src=x onerror=alert(1)>Jane',license:'cc0',url:'https://images.example.org/one.jpg',thumbnail:'https://images.example.org/one.jpg',foreign_landing_url:'https://example.org/one'};
  assert.equal(parseResults('openverse',{results:[result]},'cats')[0].creator,'Jane');
  assert.equal(parseResults('openverse',{results:[{...result,license:'by'}]},'cats').length,0);
  assert.equal(parseResults('openverse',{results:[{...result,license:'by'}]},'cats','attribution').length,1);
  const page={pageid:5,index:1,title:'File:Test.jpg',imageinfo:[{mime:'image/jpeg',url:result.url,descriptionurl:result.foreign_landing_url,extmetadata:{LicenseShortName:{value:'Public domain'},Artist:{value:'<a href="test">Jane</a>'}}}]};
  assert.equal(parseResults('commons',{query:{pages:[page]}},'cats').length,1);
  assert.equal(parseResults('commons',{query:{pages:[{...page,imageinfo:[{...page.imageinfo[0],mime:'image/svg+xml'}]}]}},'cats').length,0);
});

test('portable projects validate version, images and settings before replacing the pool',()=>{
  const project={app:'ALGO/COLLAGE',version:1,engineCommit:upstream.commit,settings:{pieces:500,cutMode:'unsupported'},images:[{id:'one',data:'data:image/png;base64,aGVsbG8=',sourceUrl:'javascript:alert(1)'}]};
  const parsed=validateProject(project);assert.equal(parsed.settings.pieces,48);assert.equal(parsed.settings.cutMode,'geometric');assert.equal(parsed.images[0].sourceUrl,'');
  assert.throws(()=>validateProject({...project,version:9}),/different version/);
  assert.throws(()=>validateProject({...project,images:[project.images[0],project.images[0]]}),/duplicate/);
  assert.throws(()=>validateProject({...project,images:[{id:'script',data:'data:image/svg+xml;base64,aGVsbG8='}]}),/invalid image/);
  assert.equal(sanitiseSettings({paper:'url(evil)'}).paper,DEFAULTS.paper);
});

test('PNG source credits are a valid UTF-8 iTXt chunk before IEND',async()=>{
  const raw=Buffer.from('89504e470d0a1a0a0000000049454e44ae426082','hex');
  const encoded=Buffer.from(await (await pngWithCredits(new Blob([raw]),'Cat — φ')).arrayBuffer());
  const length=encoded.readUInt32BE(8);assert.equal(encoded.toString('ascii',12,16),'iTXt');
  assert.equal(encoded.subarray(16,16+length).toString('utf8'),'Source credits\0\0\0\0\0Cat — φ');
  assert.equal(encoded.subarray(-12).toString('hex'),raw.subarray(-12).toString('hex'));
  let crc=0xffffffff;for(const b of encoded.subarray(12,16+length)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  assert.equal(encoded.readUInt32BE(16+length),(crc^0xffffffff)>>>0);
});
