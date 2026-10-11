import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const site=process.env.ALGO_COLLAGE_URL||'https://southernadd-cmyk.github.io/algoCollage/';
const output=process.env.SMOKE_ARTIFACT_DIR||'smoke-artifacts';
await mkdir(output,{recursive:true});
const notes=[];
const record=(line)=>{const entry=new Date().toISOString()+' '+line;notes.push(entry);console.log(entry);};
let browser,page;
async function photo(url,filename) {
  const response=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'AlgoCollage-CI-Smoke/1.0'}});
  if(!response.ok)throw new Error('Could not download '+filename+': HTTP '+response.status);
  const buffer=Buffer.from(await response.arrayBuffer());
  assert.ok(buffer.length>10000,'Photographic test asset is unexpectedly small: '+filename);
  record('Downloaded real photograph '+filename+' ('+buffer.length+' bytes)');
  return {name:filename,mimeType:'image/jpeg',buffer};
}
async function saveScreenshot(name) {
  if(page&&!page.isClosed())await page.screenshot({path:output+'/'+name+'.png',fullPage:true,timeout:20000}).catch(error=>record('Screenshot failed: '+error.message));
}
async function stage(name,callback) {
  record('BEGIN '+name);
  try{const value=await callback();record('PASS '+name);return value;}
  catch(error){record('FAIL '+name+': '+error.stack);throw error;}
}
try {
  // A real animal photograph and a portrait-style photograph exercise the
  // recognition pipeline through file uploads without relying on CORS.
  const dog=await photo('https://picsum.photos/id/1025/650/500','dog.jpg');
  const person=await photo('https://picsum.photos/id/1005/650/500','person.jpg');
  // Public-domain Mona Lisa thumbnail. Log the external-source failure, but do
  // not mistake a Wikimedia CDN outage for a cutter regression.
  const painting=await photo('https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/500px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg','mona-lisa.jpg').catch(error=>{
    record('PAINTING ASSET UNAVAILABLE: '+error.message);return null;
  });
  const fixtures=[dog,person,...(painting?[painting]:[])];
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:950},deviceScaleFactor:1});
  page=await context.newPage();
  page.on('console',msg=>{if(msg.type()==='error')record('BROWSER console error: '+msg.text());});
  page.on('pageerror',error=>record('BROWSER uncaught exception: '+error.stack));
  page.on('requestfailed',request=>record('BROWSER request failed '+request.url()+' '+request.failure()?.errorText));

  await stage('Published application loads',async()=>{
    const response=await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000});
    assert.ok(response?.ok(),'Site responded with HTTP '+response?.status());
    await page.locator('#upload-input').waitFor({state:'attached',timeout:20000});
    await page.waitForFunction(()=>document.querySelector('#cut-style')?.value==='subjects',null,{timeout:15000});
    assert.match(await page.title(),/ALGO\/COLLAGE/);
  });
  await stage('Photographs upload and trigger subject analysis',async()=>{
    await page.locator('#upload-input').setInputFiles(fixtures);
    await page.waitForFunction(count=>document.querySelectorAll('#pool .analysis-badge').length===count,fixtures.length,{timeout:30000});
    await page.waitForFunction(()=>{
      const badges=[...document.querySelectorAll('#pool .analysis-badge')].map(n=>n.textContent||'');
      return badges.length>=2 && badges.every(t=>/^\d+ subjects?$/.test(t)||/^(Large fragments|Bounded detail)/.test(t));
    },null,{timeout:300000});
    const badgeDetails=await page.locator('#pool .analysis-badge').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,title:node.title})));
    const badgeText=badgeDetails.map(item=>item.text);
    record('Per-photo analysis results: '+JSON.stringify(badgeDetails));
    const status=await page.locator('#cutting-status').innerText();
    record('Cutting status: '+status);
    assert.ok(badgeText.some(x=>/\d+ subjects?/i.test(x)),'No subject mask was extracted from real photographs: '+JSON.stringify(badgeDetails));
    assert.doesNotMatch(status,/unavailable for [1-9]/i,'One or more recognition workers failed');
  });
  await stage('Original subject cuts and Cut map render',async()=>{
    await page.locator('#view-cuts').click();
    await page.locator('#canvas-info').waitFor();
    const text=await page.locator('#canvas-info').innerText();
    record('Cut map: '+text);
    assert.match(text,/subject outlines|large fragments|bounded source details/i);
    await saveScreenshot('cut-map');
    await page.locator('#view-collage').click();
    const info=await page.locator('#canvas-info').innerText();
    record('Collage: '+info);
    assert.match(info,/pieces/);
    await saveScreenshot('whole-subjects');
  });
  await stage('Partial subjects, re-cut and recompose',async()=>{
    await page.locator('#whole-subjects').uncheck();
    await page.locator('#cut-size').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const oldCut=await page.locator('#cut-seed').inputValue();
    const oldLayout=await page.locator('#layout-seed').inputValue();
    await page.locator('#recut').click();
    assert.notEqual(await page.locator('#cut-seed').inputValue(),oldCut);
    await page.locator('#recompose').click();
    assert.notEqual(await page.locator('#layout-seed').inputValue(),oldLayout);
    await saveScreenshot('partial-subjects');
  });
  await stage('PNG export and portable project round trip',async()=>{
    const exportEvent=page.waitForEvent('download',{timeout:45000});
    await page.locator('#export').click();
    const pngDownload=await exportEvent;
    const pngPath=output+'/collage.png';
    await pngDownload.saveAs(pngPath);
    const bytes=await readFile(pngPath);
    assert.equal(bytes.subarray(1,4).toString(),'PNG','Export must be PNG');
    assert.equal(bytes.readUInt32BE(16),2000,'Expected 2x portrait width');
    assert.equal(bytes.readUInt32BE(20),2800,'Expected 2x portrait height');
    assert.ok(bytes.includes(Buffer.from('iTXt')),'Expected credited UTF-8 PNG metadata chunk');
    record('Exported '+bytes.length+' byte credited PNG, 2000 × 2800');
    const saveEvent=page.waitForEvent('download',{timeout:45000});
    await page.locator('#save-project').click();
    const projectDownload=await saveEvent,projectPath=output+'/project.json';
    await projectDownload.saveAs(projectPath);
    const project=JSON.parse(await readFile(projectPath,'utf8'));
    assert.equal(project.version,2);
    assert.equal(project.images.length,fixtures.length);
    assert.ok(project.images.some(img=>img.analysis?.subjects?.length),'Portable project lost extracted subjects');
    record('Saved project with '+project.images.map(i=>i.analysis?.subjects?.length||0).join(', ')+' subject masks');
    if(painting){
      const painted=project.images.find(i=>i.title.toLowerCase().includes('mona-lisa'));
      assert.ok(painted,'Uploaded Mona Lisa was not saved');
      const subjects=painted.analysis?.subjects||[];
      record('Mona Lisa extraction: '+JSON.stringify(subjects.map(s=>({label:s.label,bounds:s.bounds,manual:s.manual}))));
      assert.ok(subjects.length>0,'Mona Lisa has no edge-selected detail or detected face');
      assert.ok(subjects.every(s=>s.bounds.w*s.bounds.h<.4),'Mona Lisa still contains a near-full-frame silhouette');
    }
    await page.locator('#project-input').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    await page.waitForFunction(count=>document.querySelectorAll('#pool .analysis-badge').length===count,fixtures.length,{timeout:30000});
  });
  record('PASS all live Chrome photo/recognition/cut/export smoke checks');
  await saveScreenshot('final');
} catch(error) {
  process.exitCode=1;
  record('OVERALL FAILURE: '+error.stack);
  await saveScreenshot('failure');
} finally {
  await writeFile(output+'/smoke-log.txt',notes.join('\n')+'\n');
  await browser?.close().catch(()=>{});
}
