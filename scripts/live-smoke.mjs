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
  await stage('Collage desk visual structure and accessible controls',async()=>{
    const structure=await page.evaluate(()=>{
      const $=id=>document.getElementById(id);
      const style=id=>getComputedStyle($(id));
      const stage=$('canvas-panel').getBoundingClientRect(),rail=$('layer-list').getBoundingClientRect();
      return {title:document.title,stylesheets:[...document.querySelectorAll('link[rel="stylesheet"]')].map(n=>n.getAttribute('href')),
        actions:['new-baseline','lock-layer','shuffle-images','export'].every(id=>!!$(id)),
        inkDesk:style('workbench').backgroundColor,stageX:stage.x,stageWidth:stage.width,
        railX:rail.x,railWidth:rail.width,skipHref:document.querySelector('.jump-to-desk')?.getAttribute('href'),
        layers:Array.from(document.querySelectorAll('#layer-list .layer-item')).length};
    });
    record('Collage desk structure: '+JSON.stringify(structure));
    assert.ok(structure.stylesheets.includes('css/cut-paste.css'),'The cut-paper design is missing');
    assert.ok(structure.actions,'A critical workbench action has disappeared');
    assert.equal(structure.skipHref,'#workbench');
    assert.ok(structure.railX>=structure.stageX+structure.stageWidth-5,'Layer rail is not adjacent to the stage on desktop');
    await saveScreenshot('collage-desk-desktop');
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
  await stage('Cutting Room previews, selects and transfers individual fragments',async()=>{
    assert.ok(await page.locator('#cut-room').count(),'The Cutting Room is missing');
    await page.locator('#open-cut-room').click();
    await page.locator('#cut-room').waitFor({state:'visible'});
    const sources=page.locator('#cut-source-list .cut-source');
    assert.equal(await sources.count(),fixtures.length);
    await page.locator('#cutout-candidates .cutout-card').first().waitFor();
    assert.ok(await page.locator('#cut-mode').isVisible(),'Cut geometry controls must live inside the cutting modal');
    assert.ok(await page.locator('#cut-mode').evaluate(el=>el.closest('#cut-room')!==null),
      'All scissor tools belong inside the Cutting Room, not the board');
    if(painting){
      const monaIndex=fixtures.findIndex(f=>f.name==='mona-lisa.jpg');
      await sources.nth(monaIndex).click();
      await page.locator('#cut-style').selectOption('subjects');
      await page.locator('#whole-subjects').check();
      await page.waitForFunction(()=>document.querySelector('#cutout-candidates')?.children.length===1);
      const faceFingerprint=await page.locator('#cut-workspace-canvas').evaluate(c=>c.toDataURL());
      assert.ok(await page.locator('#cut-mode').isDisabled(),
        'Region settings cannot pretend to modify a full recognised face');
      await saveScreenshot('mona-face-whole');
      await page.locator('#cut-style').selectOption('regions');
      await page.waitForFunction(()=>document.querySelector('#candidate-count')?.textContent?.includes('photographic'));
      await page.waitForFunction(()=>document.querySelector('#cutout-candidates')?.children.length>=2);
      const fragmentFingerprint=await page.locator('#cut-workspace-canvas').evaluate(c=>c.toDataURL());
      assert.notEqual(fragmentFingerprint,faceFingerprint,'Photographic fragments must change the visible Mona Lisa cuts');
      assert.ok(await page.locator('#cut-mode').isEnabled());
      await saveScreenshot('mona-photo-fragments');
      await page.locator('#cut-style').selectOption('geometric');
      await page.waitForFunction(()=>document.querySelector('#candidate-count')?.textContent?.includes('geometric'));
      await page.waitForFunction(()=>document.querySelector('#cutout-candidates')?.children.length>=2);
      const geometricFingerprint=await page.locator('#cut-workspace-canvas').evaluate(c=>c.toDataURL());
      assert.notEqual(geometricFingerprint,fragmentFingerprint,'Geometric mode must show genuinely different masks');
      await saveScreenshot('mona-geometric-shapes');
      await page.locator('#cut-style').selectOption('subjects');
      await page.locator('#whole-subjects').uncheck();
      await page.waitForFunction(()=>document.querySelector('#candidate-count')?.textContent?.includes('recognised/detail')&&
        document.querySelector('#cutout-candidates')?.children.length>=3);
      assert.ok(await page.locator('#cut-mode').isEnabled(),'ALGO/ART region controls must affect partial face cuts');
      await saveScreenshot('mona-partial-details');
      await page.locator('#whole-subjects').check();
      await page.waitForFunction(()=>document.querySelector('#cutout-candidates')?.children.length===1);
    }
    await saveScreenshot('cutting-room-source');
    for(let i=0;i<fixtures.length;i++){
      await sources.nth(i).click();
      await page.locator('#cutout-candidates .cutout-card').first().click();
    }
    assert.equal(await page.locator('#cutout-selection .cutout-tray-item').count(),fixtures.length);
    assert.match(await page.locator('#transfer-summary').innerText(),new RegExp(fixtures.length+' scraps'));
    await saveScreenshot('cutting-room-selected');
    await page.locator('#transfer-cutouts').click();
    await page.locator('#cut-room').waitFor({state:'hidden'});
    await page.waitForFunction(count=>document.querySelector('#canvas-info')?.textContent?.startsWith(count+' pieces'),fixtures.length);
    record('Transferred selection: '+await page.locator('#canvas-info').innerText());
    await saveScreenshot('transferred-board');
  });
  await stage('Cutting and placing are independent until an explicit transfer',async()=>{
    const previousInfo=await page.locator('#canvas-info').innerText();
    const previousPixels=await page.locator('#artwork').evaluate(canvas=>canvas.toDataURL('image/png'));
    await page.locator('#go-to-cutting').click();
    await page.locator('#whole-subjects').uncheck();
    await page.locator('#cut-size').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const oldCut=await page.locator('#cut-seed').inputValue();
    await page.locator('#recut').click();
    assert.notEqual(await page.locator('#cut-seed').inputValue(),oldCut);
    await page.waitForTimeout(350);
    const unchanged=await page.locator('#artwork').evaluate(canvas=>canvas.toDataURL('image/png'));
    assert.equal(unchanged,previousPixels,'Cut settings must not silently change previously transferred board pieces');
    assert.equal(await page.locator('#cutout-selection .cutout-tray-item').count(),0,
      'Changing cutting modes must clear stale old-method scraps from the pending transfer tray');
    await page.locator('#cutout-candidates .cutout-card').first().click();
    assert.equal(await page.locator('#cutout-selection .cutout-tray-item').count(),1);
    await page.locator('#transfer-cutouts').click();
    await page.waitForFunction(()=>document.querySelector('#canvas-info')?.textContent?.startsWith('1 pieces'));
    const oldLayout=await page.locator('#layout-seed').inputValue();
    await page.locator('#new-baseline').click();
    assert.notEqual(await page.locator('#layout-seed').inputValue(),oldLayout);
    record('Board before editing cuts: '+previousInfo+'; now '+await page.locator('#canvas-info').innerText());
    await saveScreenshot('new-assembly-layout');
  });
  await stage('Lock starts a fresh cutting room for each successive layer',async()=>{
    for(let n=1;n<=2;n++){
      await page.locator('#lock-layer').click();
      await page.locator('#cut-room').waitFor({state:'visible'});
      assert.match(await page.locator('#cut-room-subtitle').innerText(),new RegExp('Layer '+(n+1)));
      assert.equal(await page.locator('#cutout-selection .cutout-tray-item').count(),0,'Next layer must not inherit cutouts');
      await page.locator('#cutout-candidates .cutout-card').first().click();
      await page.locator('#transfer-cutouts').click();
      await page.locator('#cut-room').waitFor({state:'hidden'});
      await page.waitForFunction(count=>document.querySelectorAll('#layer-list .layer-item').length===count,n+1);
    }
    assert.ok(await page.locator('#orientation').isDisabled(),'Canvas orientation must remain fixed after locking');
    await page.locator('#layer-list .layer-item').first().getByRole('button',{name:/View layout map/}).click();
    assert.match(await page.locator('#layout-guide-name').innerText(),/Layer 1 · locked/);
    await page.locator('#layer-list .layer-item').last().getByRole('button',{name:/View layout map/}).click();
    assert.match(await page.locator('#layout-guide-name').innerText(),/Active layer · editable/);
    await page.locator('#view-collage').click();
    assert.match(await page.locator('#canvas-info').innerText(),/3 layers/);
    record('Layered workbench: '+await page.locator('#canvas-info').innerText());
    await page.locator('#layer-list .layer-item').first().getByRole('button',{name:/View archived cutting room/}).click();
    await page.locator('#cut-room').waitFor({state:'visible'});
    assert.match(await page.locator('#cut-room-title').innerText(),/Archived cuts/);
    await page.locator('#close-cut-room').click();
    await saveScreenshot('layered-collage');
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
    assert.equal(project.version,4);
    assert.equal(project.cutouts.length,1,'The active layer transfer tray must survive portable projects');
    assert.equal(project.layers.length,2,'Both frozen layers must be included in the project');
    assert.ok(project.layers.every(layer=>layer.layout?.slots?.length&&layer.pieces?.length),'Each locked layer must retain its layout map and cut geometry');
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
    await page.waitForFunction(()=>document.querySelectorAll('#layer-list .layer-item').length===3);
    record('Round trip retained '+(await page.locator('#layer-list .layer-item').count())+' layer rows');
    assert.match(await page.locator('#canvas-info').innerText(),/3 pieces across 3 layers/,
      'Restored project must include all three independently placed pieces');
    await page.locator('#go-to-cutting').click();
    await page.locator('#cut-room').waitFor({state:'visible'});
    assert.equal(await page.locator('#cutout-selection .cutout-tray-item').count(),1,
      'Restored active layer must retain its exact one-cutout selection tray');
    await page.locator('#close-cut-room').click();
  });
  await stage('Responsive mobile collage desk remains usable',async()=>{
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.fonts.ready);
    const dimensions=await page.evaluate(()=>{
      const ids=['new-baseline','lock-layer','view-collage','view-layout','export','layer-list'];
      return {clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        controls:ids.map(id=>({id,exists:!!document.getElementById(id),width:document.getElementById(id)?.getBoundingClientRect().width||0}))};
    });
    record('Mobile width check: '+JSON.stringify(dimensions));
    assert.ok(dimensions.scrollWidth<=dimensions.clientWidth+3,'Mobile layout overflows horizontally');
    assert.ok(dimensions.controls.every(c=>c.exists&&c.width>0),'A key control is hidden or collapsed on mobile');
    await page.locator('#new-baseline').click();
    await page.locator('#view-layout').click();
    assert.match(await page.locator('#layout-guide-name').innerText(),/Active layer/);
    await saveScreenshot('collage-desk-mobile');
    await page.locator('#go-to-cutting').click();
    await page.locator('#cut-room').waitFor({state:'visible'});
    const roomWidth=await page.locator('#cut-room').evaluate(room=>({client:room.clientWidth,scroll:room.scrollWidth}));
    assert.ok(roomWidth.scroll<=roomWidth.client+4,'The mobile cutting room has horizontal overflow: '+JSON.stringify(roomWidth));
    await saveScreenshot('cutting-room-mobile');
    await page.locator('#close-cut-room').click();
    await page.setViewportSize({width:1440,height:950});
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
