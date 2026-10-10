window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.PHI=(1+Math.sqrt(5))/2;
A.INV=1/A.PHI;
A.GOLD=Math.PI*(3-Math.sqrt(5));
A.TAU=Math.PI*2;
A.W=1400;
A.H=1000;

// Artist-calibrated spatial parameters, NOT golden-ratio identities.
// Keep A.PHI, A.INV and A.GOLD above as the exact mathematical definitions.
// These are the original V1–V7 literal values: naming them must not
// change an RNG call, arithmetic grouping, or legacy artwork output.
var PHI_PLACEMENT_TUNING=Object.freeze({
  radialIndexOffset:.65,           // Avoid putting the first radial sample at the exact centre.
  minimumGoldenAngleFraction:.74,  // Lowest fraction of the golden angle before slider pull.
  radialWidthFraction:.465,        // Golden-angle radius reaches 46.5% of canvas width.
  radialHeightFraction:.455,       // Independently calibrated vertical radial reach.
  pointBoundaryInsetPx:60,        // Keep the non-φ candidate point inside the canvas.
  pointMaximumJitterPx:150,       // Positional freedom around a φ candidate at low pull.
  cellsDefaultMarginPx:42,        // Golden cell layout default for external callers.
  cellsDepthTieBreakWeight:.002,  // Slight preference for deeper cells of similar area.
  distributedCellsMarginPx:42,    // Explicit margin for distributed candidate positions.
  distributedRandomLow:.22,       // Lower fraction for an unsnapped point inside its cell.
  distributedRandomHigh:.78       // Upper fraction for an unsnapped point inside its cell.
});

A.qphi=function(v,base,strength){
  var best=v,d=1e9;
  for(var k=-7;k<=7;k++){
    var q=base*Math.pow(A.PHI,k),nd=Math.abs(q-v);
    if(nd<d){d=nd;best=q}
  }
  return A.lerp(v,best,strength);
};

A.goldenPoint=function(i,count,s,r){
  return A.goldenCanvasPoint(i,count,s,0);
};

A.goldenCanvasPoint=function(i,count,s,phase){
  count=Math.max(1,count);
  phase=phase||0;
  var t=(i+PHI_PLACEMENT_TUNING.radialIndexOffset)/count;
  var step=A.lerp(A.GOLD*PHI_PLACEMENT_TUNING.minimumGoldenAngleFraction,A.GOLD,s.goldenAngle/100);
  var a=phase+i*step;
  var radial=Math.pow(t,A.INV);
  var rx=A.W*PHI_PLACEMENT_TUNING.radialWidthFraction*radial;
  var ry=A.H*PHI_PLACEMENT_TUNING.radialHeightFraction*radial;
  return{
    x:A.W*.5+Math.cos(a)*rx,
    y:A.H*.5+Math.sin(a)*ry,
    a:a,
    rad:radial
  };
};

A.phiPoint=function(s,r){
  var ax=[A.INV*A.W,(1-A.INV)*A.W,A.W/2,A.W/(A.PHI*A.PHI),A.W-A.W/(A.PHI*A.PHI)];
  var ay=[A.INV*A.H,(1-A.INV)*A.H,A.H/2,A.H/(A.PHI*A.PHI),A.H-A.H/(A.PHI*A.PHI)];
  var p={x:r.pick(ax),y:r.pick(ay)};
  var rand={x:r.range(PHI_PLACEMENT_TUNING.pointBoundaryInsetPx,A.W-PHI_PLACEMENT_TUNING.pointBoundaryInsetPx),y:r.range(PHI_PLACEMENT_TUNING.pointBoundaryInsetPx,A.H-PHI_PLACEMENT_TUNING.pointBoundaryInsetPx)};
  var t=s.phiStrength/100,j=(1-t)*PHI_PLACEMENT_TUNING.pointMaximumJitterPx;
  p.x+=r.range(-j,j);
  p.y+=r.range(-j,j);
  return{x:A.lerp(rand.x,p.x,t),y:A.lerp(rand.y,p.y,t)};
};

A.goldenCells=function(count,margin){
  count=Math.max(1,Math.floor(count));
  margin=margin==null?PHI_PLACEMENT_TUNING.cellsDefaultMarginPx:margin;
  var cells=[{x:margin,y:margin,w:A.W-margin*2,h:A.H-margin*2,depth:0}];
  var flip=0;

  while(cells.length<count){
    var best=0,bestScore=-1;
    for(var i=0;i<cells.length;i++){
      var c=cells[i];
      var score=c.w*c.h*(1+c.depth*PHI_PLACEMENT_TUNING.cellsDepthTieBreakWeight);
      if(score>bestScore){bestScore=score;best=i}
    }

    var cell=cells.splice(best,1)[0];
    var firstLarge=(flip++%2===0);
    var ratio=firstLarge?A.INV:(1-A.INV);
    var a,b;

    if(cell.w>=cell.h){
      var cut=cell.w*ratio;
      a={x:cell.x,y:cell.y,w:cut,h:cell.h,depth:cell.depth+1};
      b={x:cell.x+cut,y:cell.y,w:cell.w-cut,h:cell.h,depth:cell.depth+1};
    }else{
      var cutY=cell.h*ratio;
      a={x:cell.x,y:cell.y,w:cell.w,h:cutY,depth:cell.depth+1};
      b={x:cell.x,y:cell.y+cutY,w:cell.w,h:cell.h-cutY,depth:cell.depth+1};
    }

    cells.push(a,b);
  }

  return cells;
};

A.distributedPhiPoints=function(count,s,r){
  var cells=A.goldenCells(count,PHI_PLACEMENT_TUNING.distributedCellsMarginPx);

  for(var i=cells.length-1;i>0;i--){
    var j=r.int(0,i),tmp=cells[i];
    cells[i]=cells[j];
    cells[j]=tmp;
  }

  var strength=s.phiStrength/100;
  return cells.map(function(cell,i){
    var xf=(i%2===0)?A.INV:(1-A.INV);
    var yf=(i%3===0)?(1-A.INV):A.INV;
    var phiX=cell.x+cell.w*xf;
    var phiY=cell.y+cell.h*yf;
    var randomX=cell.x+cell.w*r.range(PHI_PLACEMENT_TUNING.distributedRandomLow,PHI_PLACEMENT_TUNING.distributedRandomHigh);
    var randomY=cell.y+cell.h*r.range(PHI_PLACEMENT_TUNING.distributedRandomLow,PHI_PLACEMENT_TUNING.distributedRandomHigh);

    return{
      x:A.lerp(randomX,phiX,strength),
      y:A.lerp(randomY,phiY,strength),
      territory:Math.sqrt(cell.w*cell.h),
      cell:cell
    };
  });
};

})(window.AlgoArt);