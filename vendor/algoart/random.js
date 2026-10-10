window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.hash=function(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
A.makeR=function(seed){var a=A.hash(String(seed));function n(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}return{n:n,range:function(x,y){return x+(y-x)*n()},int:function(x,y){return Math.floor(x+(y-x+1)*n())},pick:function(arr){return arr[Math.floor(n()*arr.length)]},chance:function(p){return n()<p},sign:function(){return n()<.5?-1:1}}};
A.clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
A.lerp=function(a,b,t){return a+(b-a)*t};
})(window.AlgoArt);