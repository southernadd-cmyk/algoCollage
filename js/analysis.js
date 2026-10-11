// One queued worker keeps CPU inference and model loading off the UI thread.
export class SubjectAnalyser {
  constructor(){this.worker=null;this.queue=[];this.current=null;this.serial=0;}
  analyse(blob,regions,{point=null,onProgress=()=>{}}={}) {
    return new Promise((resolve,reject)=>{this.queue.push({id:++this.serial,blob,regions,point,onProgress,resolve,reject});this.pump();});
  }
  pump() {
    if(this.current||!this.queue.length)return;
    const job=this.current=this.queue.shift();
    try {
      if(!this.worker) {
        if(!globalThis.Worker||!globalThis.OffscreenCanvas)throw new Error('This browser cannot run subject detection.');
        this.worker=new Worker(new URL('./subject-worker.js',import.meta.url));
        this.worker.onmessage=event=>{
          const msg=event.data,current=this.current;if(!current||msg.id!==current.id)return;
          if(msg.type==='progress'){current.onProgress(msg.message);return;}
          if(msg.type==='error')this.finish(new Error(msg.message),null,true);else this.finish(null,msg.analysis);
        };
        this.worker.onerror=()=>this.finish(new Error('The subject tools could not start.'),null,true);
      }
      job.onProgress('Finding subjects…');
      job.timer=setTimeout(()=>this.finish(new Error('Subject detection timed out.'),null,true),180000);
      this.worker.postMessage({id:job.id,blob:job.blob,regions:job.regions,point:job.point});
    }catch(error){this.finish(error,null,true);}
  }
  finish(error,analysis,reset=false) {
    const job=this.current;if(!job)return;
    clearTimeout(job.timer);this.current=null;
    if(reset){this.worker?.terminate();this.worker=null;}
    if(error)job.reject(error);else job.resolve(analysis);
    this.pump();
  }
  cancelAll() {
    this.worker?.terminate();this.worker=null;
    const jobs=[...(this.current?[this.current]:[]),...this.queue];this.current=null;this.queue=[];
    for(const job of jobs){clearTimeout(job.timer);job.reject(new Error('Cancelled'));}
  }
}
