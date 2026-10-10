window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var PEN={
  fine:[.48,1.05,.65,.65],
  felt:[1,1,1,1],
  broad:[1.9,.8,.75,1.15],
  highlighter:[2.5,.42,.5,.65],
  dry:[1.1,.76,1.28,.9],
  paint:[1.45,1.15,.48,1.3],
  scribble:[.72,.9,1.8,1.25]
};

A.paper=function(ctx,s,r){
  ctx.fillStyle=s.paper;
  ctx.fillRect(0,0,A.W,A.H);
  if(A.svgRecorder)A.svgRecorder.background=s.paper;
  ctx.save();
  ctx.globalAlpha=.035;
  for(var i=0;i<s.grain*20;i++){
    ctx.fillStyle=r.chance(.5)?'#000':'#fff';
    var gx=r.range(0,A.W),gy=r.range(0,A.H),gw=r.range(.3,1.3),gh=r.range(.3,1.3);
    ctx.fillRect(gx,gy,gw,gh);
    if(A.svgRecorder&&A.svgRecorder.paperMarks)A.svgRecorder.paperMarks.push({x:gx,y:gy,w:gw,h:gh,colour:ctx.fillStyle});
  }
  ctx.restore();
};

A.stroke=function(ctx,points,col,s,r,curve){
  var p=PEN[s.pen]||PEN.felt;
  var passes=Math.max(1,Math.round(s.overdraw*p[3]));
  var wob=(s.wobble/100)*7*p[2];
  var base=Math.max(.6,s.thickness*p[0]);

  function f(v){return A.svgRecorder&&A.svgRecorder.precise?v:Math.round(v*100)/100}
  function record(d,alpha,width,lineCap,dash,dashOffset){
    if(!A.svgRecorder)return;
    A.svgRecorder.paths.push({
      d:d,
      stroke:A.svgRecorder.precise?ctx.strokeStyle:col,
      opacity:alpha,
      width:width,
      lineCap:lineCap,
      dash:dash&&dash.length?dash.slice():null,
      dashOffset:dashOffset||0,
      blend:ctx.globalCompositeOperation
    });
  }

  ctx.save();
  var lineCap=(s.pen==='broad'||s.pen==='highlighter')?'butt':'round';
  ctx.lineCap=lineCap;
  ctx.lineJoin='round';
  if(s.pen==='highlighter')ctx.globalCompositeOperation='multiply';

  for(var pass=0;pass<passes;pass++){
    ctx.beginPath();
    var a={x:points[0].x+r.range(-wob,wob),y:points[0].y+r.range(-wob,wob)};
    ctx.moveTo(a.x,a.y);
    ctx.strokeStyle=col;

    var alpha=A.clamp((s.opacity/100)*p[1]/Math.pow(passes,.42)*r.range(.82,1.05),.02,.95);
    var width=Math.max(.4,base*(1+r.range(-1,1)*(s.pressure/100)*.28));
    ctx.globalAlpha=alpha;
    ctx.lineWidth=width;

    var dash=null,dashOffset=0;
    if((s.pen==='dry'||s.dryness>35)&&r.chance((s.dryness/100)*.75)){
      dash=[r.range(7,24),r.range(1,6),r.range(2,9),r.range(1,7)];
      dashOffset=r.range(0,30);
      ctx.setLineDash(dash);
      ctx.lineDashOffset=dashOffset;
    }else{
      ctx.setLineDash([]);
      ctx.lineDashOffset=0;
    }

    var d='M '+f(a.x)+' '+f(a.y);

    if(curve&&points.length===4){
      var p1=points[1],p2=points[2],p3=points[3];
      var c1={x:p1.x+r.range(-wob,wob),y:p1.y+r.range(-wob,wob)};
      var c2={x:p2.x+r.range(-wob,wob),y:p2.y+r.range(-wob,wob)};
      var end={x:p3.x+r.range(-wob,wob),y:p3.y+r.range(-wob,wob)};
      ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,end.x,end.y);
      d+=' C '+f(c1.x)+' '+f(c1.y)+' '+f(c2.x)+' '+f(c2.y)+' '+f(end.x)+' '+f(end.y);
    }else{
      for(var i=1;i<points.length;i++){
        var pt={x:points[i].x+r.range(-wob,wob),y:points[i].y+r.range(-wob,wob)};
        ctx.lineTo(pt.x,pt.y);
        d+=' L '+f(pt.x)+' '+f(pt.y);
      }
    }

    ctx.stroke();
    record(d,alpha,width,lineCap,dash,dashOffset);
  }
  ctx.restore();
};

A.drawLine=function(ctx,a,b,col,s,r){
  if(r.chance(s.curveBias/100)){
    var dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));
    var bend=r.range(-.34,.34)*(s.complexity/100);
    var px=-dy/len,py=dx/len;
    A.stroke(ctx,[
      a,
      {x:a.x+dx/3+px*len*bend,y:a.y+dy/3+py*len*bend},
      {x:a.x+dx*2/3-px*len*bend*.5,y:a.y+dy*2/3-py*len*bend*.5},
      b
    ],col,s,r,true);
  }else{
    A.stroke(ctx,[a,b],col,s,r,false);
  }
};

A.ellipse=function(ctx,c,rx,ry,rot,col,s,r){
  var pts=[],seg=44;
  for(var i=0;i<=seg;i++){
    var a=A.TAU*i/seg,x=Math.cos(a)*rx,y=Math.sin(a)*ry;
    pts.push({
      x:c.x+x*Math.cos(rot)-y*Math.sin(rot),
      y:c.y+x*Math.sin(rot)+y*Math.cos(rot)
    });
  }
  A.stroke(ctx,pts,col,s,r,false);
};

A.rect=function(ctx,c,w,h,rot,col,s,r){
  var pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(function(p){
    return{
      x:c.x+p[0]*Math.cos(rot)-p[1]*Math.sin(rot),
      y:c.y+p[0]*Math.sin(rot)+p[1]*Math.cos(rot)
    };
  });
  A.stroke(ctx,pts,col,s,r,false);
};

A.poly=function(ctx,c,rad,n,rot,col,s,r){
  var pts=[];
  for(var i=0;i<=n;i++){
    var a=rot+A.TAU*i/n;
    pts.push({x:c.x+Math.cos(a)*rad,y:c.y+Math.sin(a)*rad});
  }
  A.stroke(ctx,pts,col,s,r,false);
};

A.arc=function(ctx,c,rad,start,sweep,col,s,r){
  var pts=[],seg=26;
  for(var i=0;i<=seg;i++){
    var a=start+sweep*i/seg;
    pts.push({x:c.x+Math.cos(a)*rad,y:c.y+Math.sin(a)*rad});
  }
  A.stroke(ctx,pts,col,s,r,false);
};

})(window.AlgoArt);