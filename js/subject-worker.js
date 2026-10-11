/* Classic worker: MediaPipe's CPU WASM loader uses importScripts. */
let ready=null,detector,faceDetector,segmenter,helpers;
const root=new URL('../',self.location.href);
const status=(id,message)=>self.postMessage({id,type:'progress',message});
async function initialise(id) {
  if(ready)return ready;
  ready=(async()=>{
    status(id,'Loading subject tools…');
    importScripts(new URL('vendor/vision/vision_bundle.js',root).href);
    helpers=await import('./subject-data.js');
    const files=await Vision.FilesetResolver.forVisionTasks(new URL('vendor/vision/wasm',root).href);
    const options=file=>({modelAssetPath:new URL('models/'+file,root).href,delegate:'CPU'});
    detector=await Vision.ObjectDetector.createFromOptions(files,{baseOptions:options('efficientdet-lite0.tflite'),runningMode:'IMAGE',scoreThreshold:.42,maxResults:6});
    faceDetector=await Vision.FaceDetector.createFromOptions(files,{baseOptions:options('blaze-face-short-range.tflite'),runningMode:'IMAGE',minDetectionConfidence:.5});
    segmenter=await Vision.InteractiveSegmenter.createFromOptions(files,{baseOptions:options('magic-touch-v2.task')});
  })();
  return ready;
}
function normalBounds(detection,w,h) {
  const b=detection.boundingBox;if(!b)return null;
  const {clamp}=helpers,x=clamp(b.originX/w),y=clamp(b.originY/h);
  const right=clamp((b.originX+b.width)/w),bottom=clamp((b.originY+b.height)/h);
  return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:null;
}
async function analyse(job) {
  await initialise(job.id);
  const bitmap=await createImageBitmap(job.blob);
  try {
    const ratio=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*ratio)),height=Math.max(1,Math.round(bitmap.height*ratio));
    const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,width,height);
    status(job.id,'Finding objects and faces…');
    const objects=detector.detect(canvas).detections.map(d=>({bounds:normalBounds(d,width,height),label:d.categories[0]?.categoryName||'Object',score:d.categories[0]?.score||0})).filter(d=>d.bounds);
    const faces=faceDetector.detect(canvas).detections.map(d=>normalBounds(d,width,height)).filter(Boolean).slice(0,12);
    let candidates;
    if(job.point)candidates=[{point:job.point,label:'Selected subject',score:0,manual:true}];
    else {
      candidates=objects.slice(0,4).map(o=>({point:{x:o.bounds.x+o.bounds.w/2,y:o.bounds.y+o.bounds.h*(o.label==='person'?.38:.5)},label:o.label,score:o.score}));
      for(const face of faces)if(!objects.some(o=>helpers.overlap(o.bounds,face)>face.w*face.h*.7)) {
        candidates.push({point:{x:face.x+face.w/2,y:face.y+face.h/2},label:'Face / head',score:.5});
      }
      // Guide-centred queries also retrieve subjects outside the detector's vocabulary.
      const guides=(job.regions||[]).slice().sort((a,b)=>b.w*b.h-a.w*a.h);
      for(const region of guides) {
        if(candidates.length>=6)break;
        const point={x:helpers.clamp(region.x+region.w/2,.04,.96),y:helpers.clamp(region.y+region.h/2,.04,.96)};
        if(!candidates.some(c=>Math.hypot(c.point.x-point.x,c.point.y-point.y)<.15))candidates.push({point,label:'Guide-selected subject',score:0});
      }
      if(!candidates.length)candidates.push({point:{x:.5,y:.5},label:'Guide-selected subject',score:0});
      candidates=candidates.slice(0,6);
    }
    status(job.id,'Tracing subject outlines…');
    segmenter.setImage(canvas);
    const subjects=[];
    for(const candidate of candidates) {
      const mask=segmenter.segment([{brushMode:1 /* MediaPipe BrushMode.POSITIVE: numeric wire value (not UMD-exported) */,point:[candidate.point],isCompleted:true}]);
      try {
        const subject=helpers.subjectFromConfidence(mask.getAsFloat32Array(),mask.width,mask.height,candidate.point,candidate);
        if(subject&&!subjects.some(s=>helpers.duplicateSubject(s,subject)))subjects.push(subject);
      }finally {mask.close();}
    }
    return {version:helpers.ANALYSIS_VERSION,model:helpers.ANALYSIS_MODEL,subjects,faces};
  }finally {bitmap.close();}
}
let queue=Promise.resolve();
self.onmessage=event=>{
  const job=event.data;
  queue=queue.catch(()=>{}).then(async()=>{
    try {self.postMessage({id:job.id,type:'result',analysis:await analyse(job)});}
    catch(error){self.postMessage({id:job.id,type:'error',message:error.message||'Subject analysis failed.'});}
  });
};
