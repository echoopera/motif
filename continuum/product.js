(function(){
  var c=document.getElementById('demo');if(!c)return;var ctx=c.getContext('2d');
  var cols=['#a2e1dd','#88c8e8','#b4bce8','#ddd4a0'],names=['VERDANT','TIDELINE','UMBRA','EMBER'];
  var N=[{x:.26,y:.28},{x:.76,y:.3},{x:.3,y:.72},{x:.72,y:.7}];
  var route=[[.26,.28],[.42,.4],[.55,.5],[.62,.62],[.72,.7]];
  function pt(f){var n=route.length-1,s=f*n,i=Math.min(n-1,Math.floor(s)),t=s-i;var a=route[i],b=route[i+1];return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t}}
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pSrc=document.getElementById('pSrc'),pName=document.getElementById('pName'),pPct=document.getElementById('pPct'),tiles=document.querySelectorAll('#pTiles div');
  function globe(x,y,R,col,rot){ctx.save();ctx.translate(x,y);ctx.rotate(-.38);ctx.strokeStyle=col;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,R,0,6.2832);ctx.stroke();ctx.beginPath();for(let k=0;k<6;k++){let rx=Math.abs(Math.sin(rot+k*Math.PI/6))*R;ctx.moveTo(rx,0);ctx.ellipse(0,0,Math.max(.6,rx),R,0,0,6.2832)}ctx.stroke();ctx.beginPath();for(let k=-2;k<=2;k++){let lat=k*Math.PI/6.4,rx=Math.cos(lat)*R,cy=Math.sin(lat)*R;ctx.moveTo(rx,cy);ctx.ellipse(0,cy,rx,Math.max(.6,rx*.27),0,0,6.2832)}ctx.stroke();ctx.restore()}
  var onScreen=true;if('IntersectionObserver' in window)new IntersectionObserver(function(e){onScreen=e[0].isIntersecting}).observe(c);
  function frame(ms){
    if(!onScreen){requestAnimationFrame(frame);return}
    var w=c.clientWidth,h=c.clientHeight;if(!w||!h){requestAnimationFrame(frame);return}
    var d=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(w*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}
    ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    var t=ms/1000,f=reduce?.55:(t%9)/9,p=pt(f),R=Math.max(14,Math.min(w,h)*.085);
    ctx.fillStyle='rgba(120,200,212,.3)';for(var x=14;x<w;x+=22)for(var y=14;y<h;y+=22)ctx.fillRect(x,y,1,1);
    var wt=N.map(function(n){var dx=(p.x-n.x)*w,dy=(p.y-n.y)*h,dist=Math.hypot(dx,dy)/Math.min(w,h);return Math.exp(-3*Math.pow(dist/.36,2))});var sum=wt.reduce(function(a,b){return a+b},0);wt=wt.map(function(v){return v/sum});
    var top=wt.indexOf(Math.max.apply(null,wt));
    ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(168,236,240,.7)';ctx.lineWidth=1;ctx.beginPath();route.forEach(function(r,i){i?ctx.lineTo(r[0]*w,r[1]*h):ctx.moveTo(r[0]*w,r[1]*h)});ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#d7fbf6';ctx.lineWidth=2;ctx.beginPath();for(var s=0;s<=f+.0001;s+=.01){var q=pt(Math.min(s,f));s?ctx.lineTo(q.x*w,q.y*h):ctx.moveTo(q.x*w,q.y*h)}ctx.stroke();
    N.forEach(function(n,i){var x=n.x*w,y=n.y*h;
      ctx.setLineDash([1.5,4]);ctx.strokeStyle=cols[i]+'60';ctx.beginPath();ctx.arc(x,y,Math.min(w,h)*.3,0,6.2832);ctx.stroke();ctx.setLineDash([]);
      globe(x,y,R,cols[i]+'b0',(reduce?0:t*.32)*(i%2?-1:1)+i);
      var dots=36,lit=Math.round(wt[i]*dots),rr=R+8;
      for(let k=0;k<dots;k++){let a=-Math.PI/2+k/dots*6.2832;ctx.fillStyle=k<lit?cols[i]:cols[i]+'40';ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,k<lit?1.2:.8,0,6.2832);ctx.fill()}
      ctx.fillStyle=cols[i];ctx.beginPath();ctx.arc(x,y,1.8,0,6.2832);ctx.fill()});
    var hx=p.x*w,hy=p.y*h,rot=reduce?0:t*1.6;ctx.strokeStyle='#ece3a4';ctx.lineWidth=1.4;for(let k=0;k<4;k++){let a=rot+k*Math.PI/2;ctx.beginPath();ctx.arc(hx,hy,7,a,a+.7);ctx.stroke()}
    ctx.fillStyle='#ece3a4';ctx.beginPath();ctx.arc(hx,hy,2.4,0,6.2832);ctx.fill();
    pSrc.textContent='0'+(top+1);pName.textContent=names[top];pPct.textContent=('0'+Math.round(f*100)).slice(-2).padStart(2,'0');
    tiles.forEach(function(el,i){el.className=i===top?'on':''});
    requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
})();
