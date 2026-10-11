/* Classic worker: MediaPipe's CPU WASM loader uses importScripts. */
let ready=null,detector,faceDetector,segmenter,helpers,edgesTool,visionFiles;
const root=new URL('../',self.location.href);
const status=(id,message)=>self.postMessage({id,type:'progress',message});
async function initialise(id) {
  if(ready)return ready;
  ready=(async()=>{
    status(id,'Loading face and object tools…');
    importScripts(new URL('vendor/vision/vision_bundle.js',root).href);
    [helpers,edgesTool]=await Promise.all([import('./subject-data.js'),import('./edge-trace.js')]);
    visionFiles=await Vision.FilesetResolver.forVisionTasks(new URL('vendor/vision/wasm',root).href);
    const options=file=>({modelAssetPath:new URL('models/'+file,root).href,delegate:'CPU'});
    detector=await Vision.ObjectDetector.createFromOptions(visionFiles,{baseOptions:options('efficientdet-lite0.tflite'),runningMode:'IMAGE',scoreThreshold:.47,maxResults:8});
    // A lower *face detection* threshold allows drawn/painted portraits. The
    // much stricter extraction bounds below prevent background over-selection.
    faceDetector=await Vision.FaceDetector.createFromOptions(visionFiles,{baseOptions:options('blaze-face-short-range.tflite'),runningMode:'IMAGE',minDetectionConfidence:.4});
  })();
  return ready;
}
async function getSegmenter() {
  if(!segmenter)segmenter=await Vision.InteractiveSegmenter.createFromOptions(visionFiles,{
    baseOptions:{modelAssetPath:new URL('models/magic-touch-v2.task',root).href,delegate:'CPU'}
  });
  return segmenter;
}
function normalBounds(detection,w,h) {
  const b=detection.boundingBox;if(!b)return null;
  const {clamp}=helpers,x=clamp(b.originX/w),y=clamp(b.originY/h);
  const right=clamp((b.originX+b.width)/w),bottom=clamp((b.originY+b.height)/h);
  return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:null;
}
function boundedConfidence(raw,width,height,b) {
  const result=new Float32Array(raw.length);
  const px=Math.min(.035,b.w*.12),py=Math.min(.035,b.h*.12);
  const x0=Math.max(0,Math.floor((b.x-px)*width)),x1=Math.min(width,Math.ceil((b.x+b.w+px)*width));
  const y0=Math.max(0,Math.floor((b.y-py)*height)),y1=Math.min(height,Math.ceil((b.y+b.h+py)*height));
  let selected=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
    const i=y*width+x,value=raw[i];
    if(value>=.72){result[i]=value;selected++;}
  }
  // When MagicTouch simply fills a detector box, it has not found an outline.
  if(selected/Math.max(1,(x1-x0)*(y1-y0))>.88)return null;
  return result;
}
async function analyse(job) {
  await initialise(job.id);
  const bitmap=await createImageBitmap(job.blob);
  try {
    const ratio=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*ratio)),height=Math.max(1,Math.round(bitmap.height*ratio));
    const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,width,height);
    status(job.id,'Locating faces and individual objects…');
    const objects=detector.detect(canvas).detections.map(d=>({
      bounds:normalBounds(d,width,height),label:d.categories[0]?.categoryName||'Object',score:d.categories[0]?.score||0
    })).filter(d=>d.bounds);
    const faces=faceDetector.detect(canvas).detections.map(d=>normalBounds(d,width,height)).filter(Boolean).slice(0,12);
    const candidates=edgesTool.chooseCandidates(objects,faces,job.point);
    const subjects=[];
    if(!candidates.length)return {version:helpers.ANALYSIS_VERSION,model:helpers.ANALYSIS_MODEL,subjects,faces};

    status(job.id,'Following local contours and edges…');
    const edges=edgesTool.sobelEdges(ctx.getImageData(0,0,width,height).data,width,height);
    for(const candidate of candidates) {
      // A detected face is always a compact, edge-guided head detail, never
      // the full "person" mask or the painted background.
      let confidence=null,cw=width,ch=height;
      if(candidate.kind==='object') {
        const tool=await getSegmenter();
        tool.setImage(canvas);
        const mask=tool.segment([{brushMode:Vision.BrushMode.POSITIVE,point:[candidate.point],isCompleted:true}]);
        try {
          cw=mask.width;ch=mask.height;
          confidence=boundedConfidence(mask.getAsFloat32Array(),cw,ch,candidate.bounds);
        }finally {mask.close();}
      }
      if(!confidence) {
        confidence=edgesTool.traceEdgeMask(edges,width,height,candidate.bounds,{kind:candidate.kind});
        cw=width;ch=height;
      }
      const subject=helpers.subjectFromConfidence(confidence,cw,ch,candidate.point,candidate);
      if(subject&&!subjects.some(s=>helpers.duplicateSubject(s,subject)))subjects.push(subject);
    }
    return {version:helpers.ANALYSIS_VERSION,model:helpers.ANALYSIS_MODEL,subjects:subjects.slice(0,8),faces};
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
