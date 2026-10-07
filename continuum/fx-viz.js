'use strict';
// Live displays for the effects chain. Each one is drawn from the preset's real parameters (and, where a node
// exposes it, the real filter or processor state) over the live master signal, so it shows what the effect is doing.
const fxVz={list:[],io:null,ro:null,an:null,td:null,fft:null,live:false,peak:0,lvl:0,t:0,lfo:0,grains:[],spikes:[],slow:[],irs:{},scan:0};
const VZ={cy:'#7fe3e6',ice:'#bff4f4',cream:'#ece3a4',warn:'#ff7a52',dim:'#2c6572',grid:'rgba(120,200,212,.11)'};
const VZ_FONT='8.5px "IBM Plex Mono",ui-monospace,monospace';

function fxVizScan(){
 fxVz.io?.disconnect();fxVz.ro?.disconnect();
 fxVz.list=[...document.querySelectorAll('canvas.fx-viz')].map(c=>({key:c.dataset.key,c,g:c.getContext('2d'),w:c.clientWidth,h:c.clientHeight,vis:true}));
 if(window.IntersectionObserver){fxVz.io=new IntersectionObserver(es=>{for(const e of es){const o=fxVz.list.find(x=>x.c===e.target);if(o)o.vis=e.isIntersecting}});fxVz.list.forEach(o=>fxVz.io.observe(o.c))}
 if(window.ResizeObserver){fxVz.ro=new ResizeObserver(es=>{for(const e of es){const o=fxVz.list.find(x=>x.c===e.target);if(o){o.w=e.contentRect.width;o.h=e.contentRect.height}}});fxVz.list.forEach(o=>fxVz.ro.observe(o.c))}
}
function fxSample(dt){
 const ok=typeof audio!=='undefined'&&audio&&audio.a.state==='running'&&!silenced;
 if(ok&&!fxVz.an){try{fxVz.an=audio.a.createAnalyser();fxVz.an.fftSize=1024;fxVz.an.smoothingTimeConstant=.8;fxVz.td=new Float32Array(1024);fxVz.fft=new Uint8Array(512);audio.out.connect(fxVz.an)}catch{fxVz.an=null}}
 fxVz.live=!!(ok&&fxVz.an);
 if(!fxVz.live){fxVz.peak*=.9;fxVz.lvl*=.9;if(fxVz.fft)for(let i=0;i<fxVz.fft.length;i++)fxVz.fft[i]*=.9;return}
 fxVz.an.getFloatTimeDomainData(fxVz.td);fxVz.an.getByteFrequencyData(fxVz.fft);
 let pk=0,sum=0;for(let i=768;i<1024;i++){const v=fxVz.td[i],a=Math.abs(v);if(a>pk)pk=a;sum+=v*v}
 fxVz.peak+=(pk-fxVz.peak)*(pk>fxVz.peak?.6:.15);fxVz.lvl+=(Math.sqrt(sum/256)-fxVz.lvl)*.3;
}
function drawFxViz(time){
 if(!fxVz.list.length)return;
 let any=false;for(const o of fxVz.list)if(o.vis&&o.w>10){any=true;break}if(!any)return;
 const dt=Math.min(.1,(time-(fxVz.t||time))/1000);fxVz.t=time;fxSample(dt);
 const d=Math.min(devicePixelRatio||1,2);
 for(const o of fxVz.list){
  if(!o.vis||o.w<10||o.h<10)continue;
  const W=Math.round(o.w*d),H=Math.round(o.h*d);if(o.c.width!==W||o.c.height!==H){o.c.width=W;o.c.height=H}
  const g=o.g;g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,o.w,o.h);
  const st=effectState[o.key],p=fxPresets[o.key][st.preset];o.p=p;o.mix=p?st.mix:0;o.st=st;
  try{vzGrid(g,o.w,o.h);(p?fxDraw[o.key]:vzIdle)(o,time/1000,dt)}catch(e){console.error(e)}
 }
}
// ── helpers ──
const vzBeat=()=>typeof audio!=='undefined'&&audio?audio.beatPosition():0;
const vzBpm=()=>(typeof audio!=='undefined'&&audio?audio.bpm:72)||72;
function vzGrid(g,w,h){g.strokeStyle=VZ.grid;g.lineWidth=1;g.beginPath();for(let i=1;i<4;i++){const y=Math.round(h*i/4)+.5;g.moveTo(0,y);g.lineTo(w,y)}g.stroke()}
function vzTag(g,txt,x,y,right,col){g.font=VZ_FONT;g.textBaseline='top';g.textAlign=right?'right':'left';g.fillStyle=col||'rgba(154,196,204,.85)';g.fillText(txt,x,y)}
function vzIdle(o){const g=o.g,w=o.w,h=o.h;g.strokeStyle='rgba(93,139,150,.55)';g.lineWidth=1;g.setLineDash([3,5]);g.beginPath();g.moveTo(8,h/2+.5);g.lineTo(w-8,h/2+.5);g.stroke();g.setLineDash([]);
 g.font=VZ_FONT;g.textAlign='center';g.textBaseline='bottom';g.fillStyle='rgba(191,244,244,.7)';g.fillText('BYPASS',w/2,h/2-7);g.textBaseline='top';g.fillStyle='rgba(93,139,150,.9)';g.fillText('SIGNAL PASSES THROUGH',w/2,h/2+8)}
const vzFreqX=(f,w)=>Math.log(f/20)/Math.log(1000)*w;
function vzSpectrum(g,w,h,alpha){if(!fxVz.fft||!fxVz.live)return;const sr=audio.a.sampleRate,n=fxVz.fft.length;g.fillStyle='rgba(127,227,230,'+alpha+')';for(let x=0;x<w;x+=3){const f=20*Math.pow(1000,x/w),b=Math.min(n-1,Math.round(f/(sr/2)*n)),v=fxVz.fft[b]/255;g.fillRect(x,h-v*h*.8,2,v*h*.8)}}
// Biquad magnitudes (RBJ forms, same as the nodes use). Q for lowpass/highpass is in dB, as in Web Audio.
const vzLP=(f,f0,qdb)=>{const x=f/f0,q=Math.pow(10,qdb/20),a=1-x*x;return 1/Math.sqrt(a*a+(x/q)*(x/q))};
const vzHP=(f,f0,qdb)=>{const x=f/f0,q=Math.pow(10,qdb/20),a=1-x*x;return x*x/Math.sqrt(a*a+(x/q)*(x/q))};
const vzBP=(f,f0,q)=>{const x=f/f0,a=1-x*x;return (x/q)/Math.sqrt(a*a+(x/q)*(x/q))};
const vzDB=v=>20*Math.log10(Math.max(v,1e-4));
function vzCurve(o,fn,lo,hi,col,fill){const g=o.g,w=o.w,h=o.h;const Y=db=>h-6-(Math.max(lo,Math.min(hi,db))-lo)/(hi-lo)*(h-12);
 if(o.mix<.97){g.beginPath();for(let x=0;x<=w;x+=3){const y=Y(vzDB(fn(20*Math.pow(1000,x/w))));x?g.lineTo(x,y):g.moveTo(x,y)}g.strokeStyle='rgba(236,227,164,.5)';g.lineWidth=1;g.setLineDash([3,3]);g.stroke();g.setLineDash([])}
 g.beginPath();for(let x=0;x<=w;x+=2){const f=20*Math.pow(1000,x/w),m=(1-o.mix)+o.mix*fn(f),y=Y(vzDB(m));x?g.lineTo(x,y):g.moveTo(x,y)}
 g.strokeStyle=col;g.lineWidth=1.6;g.stroke();if(fill){g.lineTo(w,h);g.lineTo(0,h);g.closePath();g.fillStyle=fill;g.fill()}return Y}
function vzFreqAxis(g,w,h){g.font=VZ_FONT;g.textBaseline='bottom';g.textAlign='center';g.fillStyle='rgba(93,139,150,.9)';g.strokeStyle=VZ.grid;for(const f of[100,1000,10000]){const x=vzFreqX(f,w);g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,h);g.stroke();g.fillText(f>=1000?f/1000+'k':f,x,h-1)}}

const fxDraw={
 granular(o,t,dt){
  const g=o.g,w=o.w,h=o.h,p=o.p,m=p.mode,len=[0,.11,.2,.085,.12,.045][m],rate=[0,70,46,80,90,140][m],span=1.5;
  const act=.3+.7*Math.max(o.mix,.15),live=fxVz.live?1:.5;
  // source tape across the top: live waveform
  g.strokeStyle='rgba(154,196,204,.55)';g.lineWidth=1;g.beginPath();for(let x=0;x<w;x+=2){const v=fxVz.live&&fxVz.td?fxVz.td[Math.floor(x/w*255)+768]*.9/Math.max(.04,fxVz.peak):Math.sin(x*.07+t*3)*.15;const y=14+Math.max(-1,Math.min(1,v))*10;x?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();
  const frozen=m===4;if(frozen){g.fillStyle='rgba(236,227,164,.1)';g.fillRect(w*.42,26,w*.16,h-34);g.strokeStyle='rgba(236,227,164,.6)';g.lineWidth=1;g.strokeRect(w*.42+.5,26.5,w*.16,h-34)}
  const n=rate*dt*act*live;let k=Math.floor(n)+(Math.random()<n%1?1:0);
  while(k-->0&&fxVz.grains.length<140){const lane=Math.random()*5|0;fxVz.grains.push({x:frozen?.42+Math.random()*.16:Math.random(),lane,age:0,len:len*(.8+Math.random()*.5)})}
  const lanes=[h*.36,h*.5,h*.64,h*.78,h*.9];
  fxVz.grains=fxVz.grains.filter(q=>(q.age+=dt)<q.len);
  for(const q of fxVz.grains){const e=Math.sin(Math.PI*q.age/q.len),gw=Math.max(3,q.len/span*w),x=q.x*w,y=lanes[q.lane];
   const col=m===3?[VZ.cy,VZ.ice,VZ.cream][q.lane%3]:q.lane%2?VZ.ice:VZ.cy;g.globalAlpha=e*(.35+.65*o.mix);g.fillStyle=col;g.fillRect(x-gw/2,y-4,gw,8);
   if(m===2){g.beginPath();g.moveTo(x-gw/2-4,y);g.lineTo(x-gw/2,y-4);g.lineTo(x-gw/2,y+4);g.fill()}g.globalAlpha=1}
  vzTag(g,['','110 MS · SCATTER','200 MS · REVERSE','85 MS · 5TH + OCT','FROZEN · 120 MS','45 MS · MICRO'][m],8,h-14,false)
 },
 delay(o,t){
  const g=o.g,w=o.w,h=o.h,p=o.p,span=5,dL=p.division,dR=p.division*p.spread,mid=h/2,amp=h/2-9,bp=vzBeat();
  const ev=[];for(const [start,t0] of [['L',dL],['R',dR]]){let tt=t0,ch=start,a=1,n=0;while(tt<span&&a>.04&&n<24){ev.push({t:tt,ch,a});if(ch==='L'){tt+=dR;ch='R'}else{tt+=dL;ch='L'}a*=p.feedback;n++}}
  const ph=(bp%span)/span,tone=.55+.45*Math.min(1,p.tone/6500),fm=.3+.7*o.mix;
  g.strokeStyle='rgba(120,200,212,.25)';g.beginPath();g.moveTo(0,mid+.5);g.lineTo(w,mid+.5);g.stroke();
  const bar=(x,hh,up,col,al,wd)=>{g.globalAlpha=al;g.fillStyle=col;g.fillRect(x-wd/2,up?mid-hh:mid,wd,hh);g.globalAlpha=1};
  for(let b=0;b<=span;b++){const x=b/span*w;g.fillStyle='rgba(120,200,212,.2)';g.fillRect(x,mid-3,1,6)}
  bar(2,amp,true,VZ.ice,.95,4);bar(2,amp,false,VZ.ice,.95,4);
  for(const e of ev){const x=e.t/span*w,since=((ph*span-e.t)%span+span)%span,flash=since<.35?1-since/.35:0;bar(x,Math.min(amp,e.a*amp*fm*1.4+2),e.ch==='L',flash>0?VZ.cream:VZ.cy,Math.min(1,(.3+.7*e.a)*tone+flash*.5),3)}
  const px=ph*w;g.strokeStyle='rgba(236,227,164,.8)';g.lineWidth=1;g.beginPath();g.moveTo(px+.5,0);g.lineTo(px+.5,h);g.stroke();
  vzTag(g,'L',w-8,4,true);vzTag(g,'R',w-8,h-14,true);vzTag(g,p.division+' BEAT · FB '+Math.round(p.feedback*100)+'%',8,4,false)
 },
 reverb(o,t){
  const g=o.g,w=o.w,h=o.h,p=o.p;let ir=fxVz.irs[p.name];
  if(!ir){const ctx=new OfflineAudioContext(2,1,44100),b=makeImpulse(ctx,p),A=b.getChannelData(0),B=b.getChannelData(1),cols=256,pk=new Float32Array(cols),per=Math.ceil(A.length/cols);let mx=1e-6;for(let c=0;c<cols;c++){let m=0;for(let i=c*per;i<Math.min(A.length,(c+1)*per);i++){const v=Math.max(Math.abs(A[i]),Math.abs(B[i]));if(v>m)m=v}pk[c]=m;if(m>mx)mx=m}for(let c=0;c<cols;c++)pk[c]=Math.pow(pk[c]/mx,.55);ir=fxVz.irs[p.name]=pk}
  const T=p.decay+p.pre+.15,cols=ir.length,mid=h/2,amp=h/2-8,scanX=((vzBeat()/2)%1)*w;
  const pre=p.pre/T*w,span=w-pre-4;
  g.fillStyle='rgba(236,227,164,.9)';g.fillRect(2,mid-amp,2,amp*2);
  if(pre>1){g.strokeStyle='rgba(236,227,164,.5)';g.setLineDash([2,3]);g.beginPath();g.moveTo(4,mid+.5);g.lineTo(pre+4,mid+.5);g.stroke();g.setLineDash([])}
  const a0=.3+.7*Math.max(o.mix,.12);
  for(let c=0;c<cols;c++){const x=pre+4+c/cols*span,v=ir[c]*amp,lit=x<scanX?1:.55;g.fillStyle='rgba(127,227,230,'+(a0*lit)+')';g.fillRect(x,mid-v,Math.max(1,span/cols+.5),v*2)}
  g.strokeStyle='rgba(236,227,164,.8)';g.lineWidth=1;g.beginPath();g.moveTo(scanX+.5,0);g.lineTo(scanX+.5,h);g.stroke();
  vzTag(g,'RT '+p.decay.toFixed(1)+' S · PRE '+Math.round(p.pre*1000)+' MS',8,4,false)
 },
 cutoffLfo(o,t,dt){
  const g=o.g,w=o.w,h=o.h,p=o.p,bpm=vzBpm();fxVz.lfo+=dt*bpm/60/p.beats;const ph=fxVz.lfo;
  let f;if(p.wave==='random'){const beat=Math.floor(vzBeat()/p.beats),r=rng((seed^Math.imul(beat,9871))>>>0);f=p.hz+(r()*2-1)*p.depth}
  else{const s=Math.sin(2*Math.PI*ph);const v=p.wave==='sine'?s:p.wave==='square'?(s>=0?1:-1):2/Math.PI*Math.asin(s);f=p.hz+p.depth*v}
  f=Math.max(30,Math.min(19000,f));const fl=Math.max(30,p.hz-p.depth),fh=Math.min(19000,p.hz+p.depth);
  const H=(f0)=>ff=>p.type==='bandpass'?vzBP(ff,f0,p.q):vzLP(ff,f0,p.q);
  vzSpectrum(g,w,h,.16);vzFreqAxis(g,w,h);
  g.fillStyle='rgba(236,227,164,.08)';g.fillRect(vzFreqX(fl,w),0,vzFreqX(fh,w)-vzFreqX(fl,w),h);
  vzCurve(o,H(f),-48,12,VZ.cy,'rgba(127,227,230,.13)');
  const x=vzFreqX(f,w);g.strokeStyle=VZ.cream;g.lineWidth=1.2;g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,h);g.stroke();
  vzTag(g,(p.type==='bandpass'?'BAND ':'LOW ')+(f>=1000?(f/1000).toFixed(1)+' K':Math.round(f)+' HZ'),8,4,false)
 },
 media(o,t,dt){
  const g=o.g,w=o.w,h=o.h,p=o.p,top=Math.round(h*.6);
  // response: highpass + lowpass + low shelf
  g.save();g.beginPath();g.rect(0,0,w,top);g.clip();g.save();g.scale(1,top/h);
  vzSpectrum(g,w,h,.14);vzCurve(o,f=>vzHP(f,Math.max(20,p.hp),.7)*vzLP(f,p.lp,0.5)*Math.pow(10,(p.shelf/(1+Math.pow(f/90,2)))/20),-42,6,VZ.cy,'rgba(127,227,230,.13)');g.restore();g.restore();
  g.strokeStyle='rgba(120,200,212,.3)';g.beginPath();g.moveTo(0,top+.5);g.lineTo(w,top+.5);g.stroke();
  // scope: wow/flutter wobble, hiss, crackle and bit depth
  const mid=top+(h-top)/2,A=(h-top)/2-5,time=t,wob=a=>p.wow[0]*900*Math.sin(2*Math.PI*p.wow[1]*time*3+a)+p.flut[0]*9000*Math.sin(2*Math.PI*p.flut[1]*time*.8+a*2),levels=p.bits>=16?96:8,hold=p.sr?4:1;
  g.strokeStyle=VZ.ice;g.lineWidth=1.2;g.beginPath();let held=0,first=true;
  for(let x=0;x<w;x+=1){if(x%hold===0)held=Math.sin(x/w*2*Math.PI*3.2-time*5+wob(x*.01))*.8+(Math.random()-.5)*p.hiss*8;const q=Math.round(held*levels)/levels,y=mid-q*A;first?g.moveTo(x,y):g.lineTo(x,y);first=false}g.stroke();
  fxVz.spikes=fxVz.spikes.filter(s=>(s.a-=dt*1.6)>0);if(p.crackle>0&&Math.random()<p.crackle*dt*40&&fxVz.spikes.length<30)fxVz.spikes.push({x:Math.random()*w,a:1,h:.4+Math.random()*.6});
  g.strokeStyle=VZ.cream;for(const s of fxVz.spikes){g.globalAlpha=s.a;g.beginPath();g.moveTo(s.x,mid-s.h*A);g.lineTo(s.x,mid+s.h*A);g.stroke();g.globalAlpha=1}
  vzTag(g,'HP '+p.hp+' · LP '+(p.lp>=1000?(p.lp/1000).toFixed(1)+'K':p.lp)+' · '+p.bits+' BIT'+(p.sr?' · '+Math.round(p.sr/1000)+'K':''),8,4,false)
 },
 slow(o,t,dt){
  const g=o.g,w=o.w,h=o.h,s=audio?.rack?.slots.slow,live=fxVz.live&&s&&s.sp!==undefined,sp=live?s.sp:1,drop=live?(s.drop??1):1,N=200;
  const H=fxVz.slow;H.push({sp,drop});if(H.length>N)H.shift();
  const Y=v=>Math.max(4,Math.min(h-4,h*.5-Math.log2(v)*h*.17)),y1=Y(1),X=i=>(i+(N-H.length))/(N-1)*w;
  g.strokeStyle='rgba(154,196,204,.4)';g.setLineDash([3,4]);g.beginPath();g.moveTo(0,y1+.5);g.lineTo(w,y1+.5);g.stroke();g.setLineDash([]);
  g.beginPath();H.forEach((q,i)=>{const x=X(i),y=Y(q.sp);i?g.lineTo(x,y):g.moveTo(x,y)});g.strokeStyle=VZ.ice;g.lineWidth=1.6;g.stroke();
  for(const [dir,col] of [[1,'rgba(255,122,82,.22)'],[-1,'rgba(127,227,230,.18)']]){g.beginPath();g.moveTo(X(0),y1);H.forEach((q,i)=>{const y=Y(q.sp);g.lineTo(X(i),dir>0?Math.max(y,y1):Math.min(y,y1))});g.lineTo(X(H.length-1),y1);g.closePath();g.fillStyle=col;g.fill()}
  g.fillStyle=VZ.warn;H.forEach((q,i)=>{if(q.drop<.86){g.globalAlpha=(1-q.drop);g.fillRect(X(i),0,2,7);g.globalAlpha=1}});
  const st=12*Math.log2(sp);vzTag(g,(st>=0?'+':'−')+Math.abs(st).toFixed(1)+' ST · '+(sp*100).toFixed(0)+'% SPEED',w-8,4,true,Math.abs(st)>.3?VZ.cream:null);vzTag(g,live?'TAPE TRANSPORT':'IDLE',8,4,false)
 },
 eq3(o){
  const g=o.g,w=o.w,h=o.h,p=o.p,s=audio?.rack?.slots.eq3;vzSpectrum(g,w,h,.15);vzFreqAxis(g,w,h);
  const lo=-15,hi=15,Y=db=>h-6-(Math.max(lo,Math.min(hi,db))-lo)/(hi-lo)*(h-12);
  g.strokeStyle='rgba(120,200,212,.3)';g.beginPath();g.moveTo(0,Y(0)+.5);g.lineTo(w,Y(0)+.5);g.stroke();
  const n=Math.ceil(w/2)+1;if(!o.fr||o.fr.length!==n){o.fr=new Float32Array(n);o.fa=new Float32Array(n);o.fb=new Float32Array(n);o.fc=new Float32Array(n);o.fp=new Float32Array(n);for(let i=0;i<n;i++)o.fr[i]=20*Math.pow(1000,i/(n-1))}
  let ok=!!s;if(ok){try{s.lo.getFrequencyResponse(o.fr,o.fa,o.fp);s.mid.getFrequencyResponse(o.fr,o.fb,o.fp);s.hi.getFrequencyResponse(o.fr,o.fc,o.fp)}catch{ok=false}}
  g.beginPath();for(let i=0;i<n;i++){const x=i/(n-1)*w,m=ok?o.fa[i]*o.fb[i]*o.fc[i]:1,y=Y(vzDB(m));i?g.lineTo(x,y):g.moveTo(x,y)}
  g.strokeStyle=VZ.cy;g.lineWidth=1.8;g.stroke();g.lineTo(w,Y(0));g.lineTo(0,Y(0));g.closePath();g.fillStyle='rgba(127,227,230,.14)';g.fill();
  const k=o.st.knobs;for(const [f,db] of [[p.lowF,k[0]],[p.midF,k[1]],[p.highF,k[2]]]){const x=vzFreqX(f,w),y=Y(db);g.fillStyle='#02090d';g.strokeStyle=VZ.cream;g.lineWidth=1.4;g.beginPath();g.arc(x,y,4.5,0,6.2832);g.fill();g.stroke();vzTag(g,(db>0?'+':'')+db.toFixed(1),x,Math.max(2,y-17),false,VZ.cream);}
  vzTag(g,'±15 DB',w-8,4,true)
 },
 clip(o,t,dt){
  const g=o.g,w=o.w,h=o.h,p=o.p,k=o.st.knobs,T=Math.max(.1,Math.min(1,k[0]/100)),post=Math.pow(10,k[1]/20),curve=x=>{const sd=Math.abs(x)*p.drive;return post*(sd<=T?sd:T+(1-T)*Math.tanh((sd-T)/(1-T)))*Math.sign(x)};
  const S=h-14,x0=12,y0=7,X=v=>x0+v*S,Y=v=>y0+S-Math.min(1,v/1.2)*S;
  g.strokeStyle='rgba(120,200,212,.28)';g.strokeRect(x0+.5,y0+.5,S,S);g.setLineDash([2,4]);g.beginPath();g.moveTo(X(0),Y(0));g.lineTo(X(1),Y(1));g.stroke();g.setLineDash([]);
  g.beginPath();for(let i=0;i<=60;i++){const v=i/60,y=Y(curve(v));i?g.lineTo(X(v),y):g.moveTo(X(v),y)}g.strokeStyle=VZ.cy;g.lineWidth=1.8;g.stroke();
  const pk=Math.min(1,fxVz.live?fxVz.peak:.5+.4*Math.sin(t*2));g.fillStyle=VZ.cream;g.beginPath();g.arc(X(pk),Y(curve(pk)),3.5,0,6.2832);g.fill();
  // waveform through the curve
  const wx=x0+S+18,ww=w-wx-70,mid=h/2,A=h/2-10;g.strokeStyle='rgba(154,196,204,.4)';g.lineWidth=1;g.beginPath();for(let x=0;x<=ww;x+=2){const v=Math.sin(x/ww*2*Math.PI*1.5-t*2)*(.85+.25*Math.sin(t*.7)),y=mid-v*A*.8;x?g.lineTo(wx+x,y):g.moveTo(wx+x,y)}g.stroke();
  g.strokeStyle=VZ.ice;g.lineWidth=1.6;g.beginPath();for(let x=0;x<=ww;x+=2){const v=Math.sin(x/ww*2*Math.PI*1.5-t*2)*(.85+.25*Math.sin(t*.7)),y=mid-curve(v)/1.2*A*1.6;x?g.lineTo(wx+x,y):g.moveTo(wx+x,y)}g.stroke();
  // gain-reduction meter
  const gr=Math.min(12,-(audio?.rack?.slots.clip?.comp?.reduction||0)),bx=w-34;g.strokeStyle='rgba(120,200,212,.3)';g.strokeRect(bx+.5,8.5,10,h-18);g.fillStyle=VZ.warn;g.fillRect(bx+1,9,9,(h-19)*gr/12);g.font=VZ_FONT;g.textAlign='center';g.textBaseline='bottom';g.fillStyle='rgba(154,196,204,.85)';g.fillText('GR',bx+5,h-10)
 }
};
fxVizScan();
