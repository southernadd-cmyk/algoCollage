import { sanitiseSettings, makeCuts, makeLayout, makeScene } from './composition.js';
import { searchImages, fetchImage, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_PROJECT_BYTES, RASTER_TYPES, creditsText } from './sources.js';
import { readPool, writePool, readSettings, writeSettings, projectDocument, validateProject } from './storage.js';
import { renderCollage, renderCutMap, renderLayoutMap } from './render.js';
import { pngWithCredits } from './png.js';
import { SubjectAnalyser } from './analysis.js';
import { guideRegions } from './image-cuts.js';
import { validateAnalysis, duplicateSubject } from './subject-data.js';

if (document.readyState === 'loading') await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
const $=id=>document.getElementById(id);
const A=window.AlgoArt;
let settings=readSettings(), images=[], scene=null, view='collage';
let cuts=null, layout=null, cutKey='', layoutKey='', fragmentCache=new Map();
let searchController=null, searchSerial=0, searchState=null, searchResults=[], adding=new Set();
let persistQueue=Promise.resolve(), frame=null, noticeTimer=null, hydrating=true;
const analyser=new SubjectAnalyser(),analysisStates=new Map();
let previewImageId=null,picking=false;

function notice(text,error=false) {
  clearTimeout(noticeTimer);const node=$('notice');node.textContent=text;node.classList.toggle('error',error);node.hidden=false;
  noticeTimer=setTimeout(()=>node.hidden=true,error?10000:6500);
}
function element(tag,className,text) {
  const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
}
function link(label,url,className) {
  const node=element('a',className,label);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;
}
function newSeed(prefix) {const data=new Uint32Array(1);crypto.getRandomValues(data);return prefix+'-'+data[0].toString(36).toUpperCase();}
function filename(extension) {return 'algo-collage-'+settings.layoutSeed.replace(/[^a-z0-9_-]/gi,'-')+'.'+extension;}
function download(blob,name) {
  const url=URL.createObjectURL(blob), anchor=element('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function rememberSettings() {
  try {writeSettings(settings);}catch {$('storage-status').textContent='Settings could not be saved in this browser. Save a project file to keep them.';}
}
function persist() {
  const snapshot=images.slice();
  persistQueue=persistQueue.catch(()=>{}).then(()=>writePool(snapshot)).then(()=>{
    $('storage-status').textContent='Pool saved in this browser. Save a project for a portable copy.';
    $('storage-status').classList.remove('error');
  }).catch(()=>{
    $('storage-status').textContent='Browser storage is unavailable or full. Your pool is in this tab only; save a project to keep it.';
    $('storage-status').classList.add('error');
  });
  return persistQueue;
}

const controlMap={cutMode:'cut-mode',layoutMode:'layout-mode',cutSeed:'cut-seed',layoutSeed:'layout-seed',
  orientation:'orientation',paper:'paper',pieces:'pieces',detail:'detail',negativeSpace:'negative-space',
  scale:'scale',rotation:'rotation',shadow:'shadow',monochrome:'monochrome',cutStyle:'cut-style',cutSize:'cut-size',wholeSubjects:'whole-subjects'};
function syncControls() {
  for(const [key,id] of Object.entries(controlMap)) {
    const input=$(id);if(input.type==='checkbox')input.checked=settings[key];else input.value=settings[key];
    const output=$(key+'-value');if(output)output.value=String(settings[key]);
  }
  $('whole-subjects').disabled=settings.cutStyle!=='subjects';
  $('cut-size').disabled=settings.cutStyle==='geometric';
  updateAnalysisStatus();
}
function rebuild() {
  if(frame!==null)cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    frame=null;
    try {
      const nextCutKey=JSON.stringify([settings.cutMode,settings.cutSeed,settings.detail,settings.orientation]);
      const nextLayoutKey=JSON.stringify([settings.layoutMode,settings.layoutSeed,settings.pieces,settings.orientation,settings.negativeSpace,settings.rotation]);
      if(nextCutKey!==cutKey) {cuts=makeCuts(A,settings);cutKey=nextCutKey;fragmentCache.clear();}
      if(nextLayoutKey!==layoutKey) {layout=makeLayout(A,settings);layoutKey=nextLayoutKey;}
      scene=makeScene(A,settings,images,cuts,layout);draw();ensureAnalysis();
    } catch(error) {notice('The composition could not be created: '+error.message,true);}
  });
}
function draw() {
  if(!scene)return;
  const canvas=$('artwork'), active=images.filter(i=>i.enabled!==false);
  if(view==='cuts')renderCutMap(canvas,scene,images,{scale:0.7,imageId:previewImageId});
  else if(view==='layout')renderLayoutMap(canvas,scene,{scale:0.7});
  else renderCollage(canvas,scene,images,{scale:1,cache:fragmentCache});
  $('empty-canvas').hidden=active.length>0 || view!=='collage';
  $('export').disabled=scene.pieces.length===0;
  $('credits-button').disabled=scene.pieces.length===0;
  const inspected=images.find(i=>i.id===previewImageId)||active[0]||images[0],source=scene.imageCuts[inspected?.id];
  canvas.setAttribute('aria-label',view==='cuts' ? 'Cut map: '+(source?.masks.length||cuts.masks.length)+' '+(source?.kind||'geometric')+' cuts'+(inspected?' from '+inspected.title:'') :
    view==='layout' ? 'Layout map: '+layout.slots.length+' positions from '+layout.strategy :
    'Collage of '+scene.pieces.length+' fragments from '+active.length+' active images');
  const subjectCount=scene.pieces.filter(p=>p.mask.kind==='subject').length;
  $('canvas-info').textContent=view==='cuts' ? source ? `${source.masks.length} ${source.kind==='subjects'?'subject outlines':'large fragments'} · ${source.width} × ${source.height} source · guided by ${cuts.strategy}` : `${cuts.masks.length} geometric cut shapes · ${cuts.strategy}` :
    view==='layout' ? `${layout.slots.length} positions · ${layout.strategy} · ${layout.width} × ${layout.height}` :
    `${scene.pieces.length} pieces${subjectCount?' · '+subjectCount+' subject cuts':''} · ${new Set(scene.pieces.map(p=>p.imageId)).size} images used · ${layout.width} × ${layout.height}`;
  $('cut-inspector').hidden=view!=='cuts'||!images.length;
  $('pick-subject').disabled=settings.cutStyle!=='subjects'||!inspected||analysisStates.get(inspected)?.busy===true;
  canvas.classList.toggle('picking',picking&&view==='cuts');
}
function poolChanged() {fragmentCache.clear();renderPool();renderResults();syncInspector();updateAnalysisStatus();rebuild();void persist();}

function syncInspector() {
  const select=$('cut-preview-image');select.replaceChildren();
  if(!images.some(i=>i.id===previewImageId))previewImageId=images.find(i=>i.enabled!==false)?.id||images[0]?.id||null;
  for(const image of images){const option=element('option',null,image.title);option.value=image.id;select.append(option);}
  select.value=previewImageId||'';
}
function updateAnalysisStatus() {
  const active=images.filter(i=>i.enabled!==false),busy=active.filter(i=>analysisStates.get(i)?.busy);
  const found=active.filter(i=>i.analysis?.subjects.length),missed=active.filter(i=>i.analysis&&!i.analysis.subjects.length);
  const failed=active.filter(i=>analysisStates.get(i)?.error);
  $('find-subjects').disabled=!active.length||!!busy.length||settings.cutStyle!=='subjects';
  const status=$('cutting-status'),current=busy.find(i=>analysisStates.get(i)?.message);
  status.textContent=settings.cutStyle==='geometric'?'Original geometric masks cut each image to the canvas proportions.':
    settings.cutStyle==='regions'?'Large fragments keep more of each source image.':
    busy.length?`${busy.length} image${busy.length===1?'':'s'} waiting for subject outlines. ${current?analysisStates.get(current).message:''}`:
    !active.length?'Add images to find their subjects. Large fragments appear first.':
    `${found.length} of ${active.length} images have subject outlines.${missed.length?' '+missed.length+' use large fragments; select a subject in the Cut map.':''}${failed.length?' Subject tools unavailable for '+failed.length+'; large fragments retained.':''}`;
}
function ensureAnalysis() {
  if(hydrating||settings.cutStyle!=='subjects')return;
  for(const image of images)if(image.enabled!==false&&!image.analysis&&!analysisStates.has(image))void analyseImage(image);
}
async function analyseImage(image,point=null) {
  if(analysisStates.get(image)?.busy)return;
  const state={busy:true,message:'Queued for subject tracing…'};analysisStates.set(image,state);renderPool();updateAnalysisStatus();
  try {
    const result=validateAnalysis(await analyser.analyse(image.blob,guideRegions(cuts||makeCuts(A,settings)),{point,onProgress:message=>{
      if(!images.includes(image))return;state.message=message;renderPool();updateAnalysisStatus();
    }}));
    if(!images.includes(image))return;
    if(point) {
      if(!result.subjects.length){notice('No usable outline at that point. Try the centre of the object.',true);return;}
      const previous=image.analysis?.subjects||[];
      result.subjects=[...result.subjects,...previous.filter(s=>!result.subjects.some(next=>duplicateSubject(s,next)))].slice(0,8);
    }else {
      const manual=image.analysis?.subjects.filter(s=>s.manual)||[];
      result.subjects=[...manual,...result.subjects.filter(s=>!manual.some(previous=>duplicateSubject(previous,s)))].slice(0,8);
    }
    image.analysis=result;
    if(point)notice('Subject outline added. It will be kept with this image.');
  }catch(error) {
    if(!images.includes(image)||error.message==='Cancelled')return;
    state.error=error.message;
    if(point)notice('Subject selection is unavailable: '+error.message,true);
  }finally {
    state.busy=false;
    if(images.includes(image))poolChanged();
  }
}

function renderPool() {
  const pool=$('pool');pool.replaceChildren();$('pool-count').textContent=images.length+' / '+MAX_IMAGES;
  $('clear-pool').disabled=images.length===0 || hydrating;$('pool-select-all').disabled=images.length===0 || hydrating;
  $('pool-note').textContent=images.length ? `${images.filter(i=>i.enabled!==false).length} active. Uncheck an image to keep it for later; use × to remove it.` : 'Collect from different searches. Uncheck an image to keep it for later.';
  if(!images.length) {
    const placeholder=element('div','pool-placeholder');placeholder.append(element('span',null,'＋'),element('p',null,'Your material lives here. Search results join the pool when you choose Add.'));pool.append(placeholder);return;
  }
  for(const image of images) {
    const card=element('article','pool-card'+(image.enabled===false?' off':''));
    const img=element('img');img.src=image.objectURL;img.alt=image.title;img.title=image.title;
    const remove=element('button','remove-image','×');remove.setAttribute('aria-label','Remove '+image.title+' from pool');
    remove.addEventListener('click',()=>{
      images=images.filter(i=>i!==image);URL.revokeObjectURL(image.objectURL);poolChanged();
    });
    const title=element('p',null,image.title);title.title=image.title;
    const inspect=element('button','inspect-image','Cut map ↗');inspect.setAttribute('aria-label','Inspect cuts for '+image.title);
    inspect.addEventListener('click',()=>{previewImageId=image.id;syncInspector();chooseView($('view-cuts'));$('canvas-panel').scrollIntoView({block:'center',behavior:'smooth'});});
    const state=analysisStates.get(image),summary=state?.busy?state.message:state?.error?'Large fragments · retry available':image.analysis?.subjects.length?image.analysis.subjects.length+' subject'+(image.analysis.subjects.length===1?'':'s'):'Large fragments';
    const badge=element('span','analysis-badge',summary);badge.title=summary;
    const use=element('label');const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=image.enabled!==false;checkbox.setAttribute('aria-label','Use '+image.title+' in collage');
    checkbox.addEventListener('change',()=>{image.enabled=checkbox.checked;poolChanged();});use.append(checkbox,document.createTextNode('Use'));
    card.append(img,remove,title,badge,inspect,use);if(image.sourceUrl)card.append(link('Source ↗',image.sourceUrl,'source-link'));pool.append(card);
  }
}

function renderResults() {
  const results=$('results');results.replaceChildren();
  for(const image of searchResults) {
    const card=element('article','result-card'), img=element('img');img.src=image.thumbnail;img.alt=image.title;img.loading='lazy';img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>{img.alt='Preview unavailable';img.style.opacity='0.4';});
    const title=link(image.title,image.sourceUrl,'result-title');title.title=image.title;
    const meta=element('p',null,image.license+(image.creator?' · '+image.creator:''));meta.title=meta.textContent;
    const button=element('button');const present=images.some(i=>i.id===image.id), pending=adding.has(image.id);
    button.textContent=present?'In pool ✓':pending?'Adding…':'+ Add';button.classList.toggle('added',present);button.disabled=present||pending||hydrating;
    button.setAttribute('aria-label',present?image.title+' is in the pool':'Add '+image.title+' to pool');
    button.addEventListener('click',()=>void addRemote(image));card.append(img,title,meta,button);results.append(card);
  }
}

function imageElement(blob) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>resolve({element:img,objectURL:url});img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('The image could not be decoded. Try a different file.'));};img.src=url;
  });
}
async function normaliseImage(blob) {
  if(!RASTER_TYPES.includes(blob.type)||blob.size>MAX_IMAGE_BYTES)throw new Error('Choose JPEG, PNG, WebP, GIF or AVIF images under 16 MB.');
  const loaded=await imageElement(blob);
  try {
    const {element:img}=loaded;
    if(img.naturalWidth*img.naturalHeight>80000000)throw new Error('This image has too many pixels. Resize it before uploading.');
    const factor=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('The image could not be prepared.')),'image/webp',0.9));
  } finally {URL.revokeObjectURL(loaded.objectURL);}
}
async function addRemote(item) {
  if(hydrating||adding.has(item.id)||images.some(i=>i.id===item.id))return;
  if(images.length>=MAX_IMAGES) {notice('The pool holds 24 images. Remove one before adding another.',true);return;}
  adding.add(item.id);renderResults();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
  let loaded=null,kept=false;
  try {
    const original=await fetchImage(item,controller.signal),blob=await normaliseImage(original);loaded=await imageElement(blob);
    if(images.length>=MAX_IMAGES)throw new Error('The pool is full. Remove an image and try again.');
    if(images.some(i=>i.id===item.id))return;
    const {url,thumbnail,...metadata}=item;images.push({...metadata,blob,...loaded,enabled:true});kept=true;poolChanged();notice('Added '+item.title+' to your pool.');
  } catch(error) {notice(error.name==='AbortError'?'The image download timed out. Try another image.':
      error instanceof TypeError?'This image host does not allow browser downloads. Choose another result or upload a saved copy.':error.message,true);
  } finally {clearTimeout(timeout);if(loaded&&!kept)URL.revokeObjectURL(loaded.objectURL);adding.delete(item.id);renderResults();}
}

async function addUploads(files) {
  if(hydrating)return;
  let added=0,failed=[];
  $('upload-button').disabled=true;
  for(const file of Array.from(files)) {
    if(images.length>=MAX_IMAGES) {failed.push('The pool is full (24 images).');break;}
    try {
      const blob=await normaliseImage(file),loaded=await imageElement(blob);
      if(images.length>=MAX_IMAGES) {URL.revokeObjectURL(loaded.objectURL);throw new Error('The pool is full.');}
      images.push({id:crypto.randomUUID(),title:file.name,creator:'User supplied',license:'User supplied',sourceUrl:'',licenseUrl:'',provider:'Upload',query:'',enabled:true,blob,...loaded});added++;
      poolChanged();
    } catch(error) {failed.push(file.name+': '+error.message);}
  }
  $('upload-button').disabled=false;
  if(added)notice(`${added} image${added===1?'':'s'} added to your pool.`);
  if(failed.length)notice(failed.slice(0,2).join(' '),true);
  $('upload-input').value='';
}

async function doSearch(more=false) {
  const requested=more&&searchState ? {...searchState,page:searchState.page+1} :
    {provider:$('provider').value,policy:$('license-policy').value,query:$('query').value.trim(),page:1};
  if(!requested.query) {notice('Enter a subject to search for.',true);$('query').focus();return;}
  searchController?.abort();const serial=++searchSerial;searchController=new AbortController();
  const controller=searchController;
  const timeout=setTimeout(()=>controller.abort(),20000);
  $('search-button').disabled=true;$('more-results').disabled=true;
  $('search-status').textContent='Searching '+(requested.provider==='commons'?'Wikimedia Commons':'Openverse')+'…';$('search-status').classList.remove('error');
  try {
    const response=await searchImages(requested.provider,requested.query,requested.policy,requested.page,controller.signal);
    if(serial!==searchSerial)return;
    searchState=requested;
    searchResults=more ? [...searchResults,...response.images.filter(i=>!searchResults.some(previous=>previous.id===i.id))] : response.images;
    renderResults();$('more-results').hidden=!response.hasMore;
    $('search-status').textContent=response.images.length ? `${searchResults.length} results kept for this licence filter. Choose Add to keep an image.` :
      'No images matched this licence filter on this page. Try another subject, source, or include attribution licences.';
  } catch(error) {
    if(serial!==searchSerial)return;
    $('search-status').textContent=error.name==='AbortError'?'Search timed out. Try again or switch source.':
      error instanceof TypeError?'This source could not be reached. Switch source or upload images.':error.message;
    $('search-status').classList.add('error');$('more-results').hidden=true;
  } finally {clearTimeout(timeout);if(serial===searchSerial){$('search-button').disabled=false;$('more-results').disabled=false;}}
}
function resetSearch() {
  searchController?.abort();searchSerial++;searchState=null;searchResults=[];renderResults();$('more-results').hidden=true;$('search-button').disabled=false;
  $('search-status').textContent='Choose a topic or enter a new search.';$('search-status').classList.remove('error');
  $('license-note').hidden=$('license-policy').value!=='attribution';
}

function showCredits() {
  if(!scene)return;
  const used=new Set(scene.pieces.map(p=>p.imageId)),list=$('credits-list');list.replaceChildren();
  for(const image of images.filter(i=>used.has(i.id))) {
    const item=element('article','credit-item');item.append(element('h3',null,image.title),element('p',null,(image.creator||'Creator not supplied; see source')+' · '+image.license));
    if(image.sourceUrl)item.append(link('Original source ↗',image.sourceUrl));if(image.licenseUrl)item.append(link('Licence terms ↗',image.licenseUrl));list.append(item);
  }
  $('credits-dialog').showModal();
}
async function exportPNG() {
  if(!scene?.pieces.length)return;
  // Freeze the exact displayed composition before any asynchronous encoding.
  const exportedScene=scene,exportedImages=images.slice();const canvas=document.createElement('canvas');
  $('export').disabled=true;
  try {
    renderCollage(canvas,exportedScene,exportedImages,{scale:2,cache:fragmentCache});
    const raw=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed.')),'image/png'));
    const png=await pngWithCredits(raw,creditsText(exportedScene,exportedImages));
    download(png,'algo-collage-'+exportedScene.settings.layoutSeed.replace(/[^a-z0-9_-]/gi,'-')+'.png');
    notice('PNG exported at 2× resolution, with source credits embedded. Use Source credits for a text copy.');
  } catch(error){notice(error.message,true);}finally{$('export').disabled=!scene?.pieces.length;}
}
async function saveProject() {
  $('save-project').disabled=true;
  try {
    const project=await projectDocument(settings,images),blob=new Blob([JSON.stringify(project)],{type:'application/json'});
    if(blob.size>MAX_PROJECT_BYTES)throw new Error('This project is too large to save. Remove some images.');
    download(blob,filename('json'));notice('Project saved with its image pool, settings and seeds.');
  } catch(error){notice('Project save failed: '+error.message,true);}finally{$('save-project').disabled=false;}
}
async function openProject(file) {
  if(!file)return;
  if(adding.size) {notice('Wait for image downloads to finish before opening a project.',true);return;}
  if(file.size>MAX_PROJECT_BYTES) {notice('Choose an Algo Collage project under 64 MB.',true);return;}
  let next=[];
  try {
    const project=validateProject(JSON.parse(await file.text()));
    // Validate and decode the complete replacement before touching the old pool.
    for(const item of project.images) {
      const {data,...metadata}=item;const blob=await (await fetch(data)).blob();const loaded=await imageElement(blob);
      next.push({...metadata,blob,...loaded});
    }
    analyser.cancelAll();analysisStates.clear();images.forEach(i=>URL.revokeObjectURL(i.objectURL));images=next;next=[];settings=project.settings;
    cutKey='';layoutKey='';syncControls();rememberSettings();poolChanged();notice('Project opened.');
  } catch(error){next.forEach(i=>URL.revokeObjectURL(i.objectURL));notice('The project could not be opened: '+error.message,true);}
  finally{$('project-input').value='';}
}

for(const [key,id] of Object.entries(controlMap)) {
  const input=$(id);input.addEventListener(input.type==='range'?'input':'change',()=>{
    const value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
    settings=sanitiseSettings({...settings,[key]:value});fragmentCache.clear();syncControls();rememberSettings();rebuild();
  });
}
const regenerate=(key,prefix)=>{settings={...settings,[key]:newSeed(prefix)};syncControls();rememberSettings();rebuild();};
$('recut').addEventListener('click',()=>regenerate('cutSeed','CUT'));
$('recompose').addEventListener('click',()=>regenerate('layoutSeed','LAYOUT'));
$('shuffle-images').addEventListener('click',()=>regenerate('imageSeed','POOL'));
$('search-form').addEventListener('submit',event=>{event.preventDefault();void doSearch();});
document.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>{$('query').value=button.dataset.topic;void doSearch();}));
$('more-results').addEventListener('click',()=>void doSearch(true));
$('provider').addEventListener('change',resetSearch);$('license-policy').addEventListener('change',resetSearch);
$('upload-button').addEventListener('click',()=>$('upload-input').click());$('empty-upload').addEventListener('click',()=>$('upload-input').click());
$('upload-input').addEventListener('change',()=>void addUploads($('upload-input').files));
$('save-project').addEventListener('click',()=>void saveProject());$('open-project').addEventListener('click',()=>$('project-input').click());
$('project-input').addEventListener('change',()=>void openProject($('project-input').files[0]));
$('export').addEventListener('click',()=>void exportPNG());$('credits-button').addEventListener('click',showCredits);
$('close-credits').addEventListener('click',()=>$('credits-dialog').close());
$('download-credits').addEventListener('click',()=>download(new Blob([creditsText(scene,images)],{type:'text/plain;charset=utf-8'}),filename('credits.txt')));
$('clear-pool').addEventListener('click',()=>{analyser.cancelAll();analysisStates.clear();images.forEach(i=>URL.revokeObjectURL(i.objectURL));images=[];poolChanged();});
$('pool-select-all').addEventListener('click',()=>{images.forEach(i=>i.enabled=true);poolChanged();});
const tabs=Array.from(document.querySelectorAll('[data-view]'));
function chooseView(button) {
  picking=false;$('pick-subject').setAttribute('aria-pressed','false');$('pick-help').textContent='Dashed lines are ALGO/ART regions. Bright areas are the pieces retained.';
  view=button.dataset.view;tabs.forEach(t=>{const selected=t===button;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;});
  $('canvas-panel').setAttribute('aria-labelledby',button.id);draw();
}
tabs.forEach((button,i)=>{
  button.addEventListener('click',()=>chooseView(button));
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const target=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    chooseView(target);target.focus();
  });
});
$('cut-preview-image').addEventListener('change',()=>{previewImageId=$('cut-preview-image').value;picking=false;$('pick-subject').setAttribute('aria-pressed','false');draw();});
$('find-subjects').addEventListener('click',()=>{
  for(const image of images)if(image.enabled!==false)void analyseImage(image);
});
$('pick-subject').addEventListener('click',()=>{
  picking=!picking;$('pick-subject').setAttribute('aria-pressed',String(picking));
  $('pick-help').textContent=picking?'Click or tap inside the object you want to keep.':'Dashed lines are ALGO/ART regions. Bright areas are the pieces retained.';draw();
});
$('artwork').addEventListener('click',event=>{
  if(!picking||view!=='cuts'||settings.cutStyle!=='subjects')return;
  const image=images.find(i=>i.id===previewImageId);if(!image)return;
  const rect=$('artwork').getBoundingClientRect(),point={x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};
  picking=false;$('pick-subject').setAttribute('aria-pressed','false');$('pick-help').textContent='Tracing the selected subject…';draw();void analyseImage(image,point);
});
let dragCount=0;
document.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragenter',event=>{if(event.dataTransfer.types.includes('Files')){dragCount++;document.body.classList.add('dragging');}});
document.addEventListener('dragleave',()=>{if(--dragCount<=0){dragCount=0;document.body.classList.remove('dragging');}});
document.addEventListener('drop',event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();dragCount=0;document.body.classList.remove('dragging');void addUploads(event.dataTransfer.files);});

syncControls();
try {
  const stored=await readPool();
  for(const item of stored.slice(0,MAX_IMAGES)) {
    try {
      if(!(item.blob instanceof Blob)||!RASTER_TYPES.includes(item.blob.type))continue;
      let analysis;try{analysis=validateAnalysis(item.analysis);}catch{}
      images.push({...item,analysis,...await imageElement(item.blob)});
    }catch {notice('One saved image could not be reopened. The rest of your pool is available.',true);}
  }
  $('storage-status').textContent='Pool saved in this browser. Save a project for a portable copy.';
} catch {$('storage-status').textContent='Browser storage is unavailable. Save a project file to keep your pool.';$('storage-status').classList.add('error');}
hydrating=false;renderPool();syncInspector();updateAnalysisStatus();rebuild();
