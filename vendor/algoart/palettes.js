window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.hues=function(s,r){
  var maps={
    marker:[350,18,48,78,112,160,195,220,255,286,320],
    cmyk:[186,315,55,0],
    primary:[0,55,215],
    neon:[320,15,62,116,177,215,270],
    pastel:[350,28,55,105,165,205,255,305],
    earth:[8,24,39,58,82,112,157,193],
    warm:[350,8,20,34,48,62],
    cold:[155,178,196,214,235,258,282],
    mono:[0]
  };
  var out=[],start=r.range(0,360),arr=maps[s.palette];
  for(var i=0;i<s.colourCount;i++){
    var h;
    if(s.palette==='spectrum')h=start+i*360/s.colourCount;
    else if(s.palette==='golden')h=start+i*137.507764;
    else h=arr[i%arr.length];
    var sat=s.saturation,lig=s.brightness;
    if(s.palette==='pastel'){sat=Math.min(sat,72);lig=Math.max(lig,68)}
    if(s.palette==='neon'){sat=Math.max(sat,92);lig=A.clamp(lig,48,62)}
    if(s.palette==='earth'){sat=Math.min(sat,62);lig=A.clamp(lig,34,58)}
    if(s.palette==='mono'){sat=0;lig=18+(i/Math.max(1,s.colourCount-1))*60}
    out.push('hsl('+((h+360)%360)+' '+sat+'% '+lig+'%)');
  }
  return out;
};
})(window.AlgoArt);