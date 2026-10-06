'use strict';
const $=id=>document.getElementById(id), canvas=$('map'), ctx=canvas.getContext('2d'), stage=$('stage');
const palettes=['#a2e1dd','#88c8e8','#b4bce8','#ddd4a0'];
const worlds=[{name:'VERDANT',key:0,mode:'Lydian',scale:[0,2,4,6,7,9,11],bpm:72,desc:'Glass / open air'},{name:'TIDELINE',key:9,mode:'Dorian',scale:[0,2,3,5,7,9,10],bpm:84,desc:'Tides / soft echoes'},{name:'UMBRA',key:2,mode:'Minor',scale:[0,2,3,5,7,8,10],bpm:60,desc:'Low light / deep drones'},{name:'EMBER',key:7,mode:'Mixolydian',scale:[0,2,4,5,7,9,10],bpm:96,desc:'Warm pulse / motion'}];
let seed=crypto.getRandomValues(new Uint32Array(1))[0], nodes=[], path=[], drawing=false, pointerId=null, point={x:.5,y:.5}, weights=[.25,.25,.25,.25], playing=false, progress=0, startedAt=0, duration=60, travel=0, curvature=0, activeWorld=0, enabled=false, muted=false, audio=null, snapshots=[], lastFrame=0, storageOK=true;
let audioSlots=[null,null,null,null];
const defaultProjection=.34;let projectionPreferences=[defaultProjection,defaultProjection,defaultProjection,defaultProjection];try{const saved=JSON.parse(localStorage.getItem('continuum-projection-v1')||'null');if(Array.isArray(saved)&&saved.length===4&&saved.every(v=>Number.isFinite(v)&&v>=.16&&v<=.85))projectionPreferences=saved}catch{}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── CONTINUUM shell helpers (ui*-prefixed so the audio modules never collide) ──
const uiPad=(n,l=2)=>String(n).padStart(l,'0');
const uiNotes=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const uiBuzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch{}};
const uiMono='"IBM Plex Mono",ui-monospace,Menlo,monospace';
let uiWakeLock=null,uiWakeBusy=false;
async function uiWake(on){if(uiWakeBusy)return;uiWakeBusy=true;try{if(on&&!uiWakeLock&&navigator.wakeLock){uiWakeLock=await navigator.wakeLock.request('screen');uiWakeLock.addEventListener('release',()=>{uiWakeLock=null})}else if(!on&&uiWakeLock){await uiWakeLock.release();uiWakeLock=null}}catch{uiWakeLock=null}uiWakeBusy=false}
let loopOn=false;try{loopOn=localStorage.getItem('continuum-loop-v1')==='1'}catch{}
let holdRegion=null,uiGrab=-1,uiPlayStart=0;
let uiMsgTimer=0;{const el=$('message');new MutationObserver(()=>{if(!el.textContent)return;el.classList.add('show');clearTimeout(uiMsgTimer);uiMsgTimer=setTimeout(()=>el.classList.remove('show'),4400)}).observe(el,{childList:true,characterData:true,subtree:true})}

function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function message(t){$('message').textContent=t}
function positions(s){const r=rng(s);return[{x:.24,y:.31},{x:.76,y:.32},{x:.28,y:.7},{x:.72,y:.69}].map((p,i)=>({...p,x:p.x+(r()-.5)*.1,y:p.y+(r()-.5)*.05,id:i,radius:projectionPreferences[i]}))}
function visit(i){if(!enabled||!nodes[i])return;stopJourney();point={x:nodes[i].x,y:nodes[i].y};uiBuzz(10);message(worlds[i].desc)}
function nodeSub(i){return audioSlots[i]?uiNotes[worlds[i].key]+' '+worlds[i].mode.slice(0,3).toUpperCase()+' · '+Math.round(worlds[i].bpm):['C LYD · 72','A DOR · 84','D MIN · 60','G MIX · 96'][i]}
function renderNodes(){
 $('nodeLayer').replaceChildren();$('identStrip').replaceChildren();
 nodes.forEach((n,i)=>{
  const b=document.createElement('button');b.type='button';b.className='node'+(n.y>.5?' lower':'');b.dataset.i=i;
  b.style.left=n.x*100+'%';b.style.top=n.y*100+'%';b.style.setProperty('--color',palettes[i]);
  b.setAttribute('aria-label',worlds[i].name+', '+worlds[i].desc+'. Tap to visit, drag to draw a route.');b.setAttribute('aria-pressed','false');
  const label=document.createElement('span');label.className='node-label';
    const title=document.createElement('b');title.textContent=worlds[i].name;
  const sub=document.createElement('small');sub.textContent=nodeSub(i);
  const meter=document.createElement('span');meter.id='level-'+i;meter.className='node-meter';meter.setAttribute('aria-hidden','true');
  label.append(title,sub,meter);b.append(label);
  b.onclick=e=>{if(e.detail===0)visit(i)};
  $('nodeLayer').append(b);
  const t=document.createElement('button');t.type='button';t.className='ident';t.dataset.i=i;t.style.setProperty('--color',palettes[i]);t.setAttribute('aria-pressed','false');
  t.setAttribute('aria-label','Fly to '+worlds[i].name);
  t.innerHTML='<span class="id-top"><span class="micro">SRC</span><i></i></span><b>'+uiPad(i+1)+'</b><em></em><span class="id-bar"><u></u></span>';
  t.querySelector('em').textContent=worlds[i].name;
  t.onclick=()=>{if(!enabled){message('Initialize audio to explore the field.');uiBuzz(4);return}visit(i)};
  $('identStrip').append(t);
 });
 renderProjectionControls();if(typeof renderTrackMixer==='function')renderTrackMixer();
 $('sessionLabel').textContent='FIELD / '+seed.toString(16).slice(0,6).toUpperCase();
}
function projectionRadius(n){return Number.isFinite(n.radius)?n.radius:defaultProjection}
function setProjection(i,value){if(!nodes[i])return;nodes[i].radius=Math.max(.16,Math.min(.85,Number(value)||defaultProjection));projectionPreferences=nodes.map(projectionRadius);try{localStorage.setItem('continuum-projection-v1',JSON.stringify(projectionPreferences))}catch{} }
function renderProjectionControls(){$('projectionControls').replaceChildren();nodes.forEach((n,i)=>{const row=document.createElement('div');row.className='projection-control';row.style.setProperty('--color',palettes[i]);const label=document.createElement('label');label.htmlFor='projection-'+i;const name=document.createElement('span');name.className='name';name.textContent=worlds[i].name;name.title=worlds[i].name;const value=document.createElement('output');value.textContent=Math.round(projectionRadius(n)*100)+'%';value.setAttribute('for','projection-'+i);label.append(name,value);const slider=document.createElement('input');slider.id='projection-'+i;slider.type='range';slider.min='16';slider.max='85';slider.step='1';slider.value=Math.round(projectionRadius(n)*100);slider.setAttribute('aria-label',worlds[i].name+' influence radius');slider.setAttribute('aria-valuetext',slider.value+' percent of the map’s shorter side');slider.oninput=()=>{setProjection(i,+slider.value/100);value.textContent=slider.value+'%';slider.setAttribute('aria-valuetext',slider.value+' percent of the map’s shorter side')};slider.onchange=()=>message(worlds[i].name+' influence radius set to '+slider.value+'%.');row.append(label,slider);$('projectionControls').append(row)})}
function blend(p){const rect=stage.getBoundingClientRect(),unit=Math.max(1,Math.min(rect.width,rect.height));const scores=nodes.map(n=>{const distance=Math.hypot((p.x-n.x)*rect.width,(p.y-n.y)*rect.height)/unit;return -3*Math.pow(distance/projectionRadius(n),2)});const peak=Math.max(...scores);const raw=scores.map(v=>Math.exp(v-peak));const sum=raw.reduce((a,b)=>a+b,0);return raw.map(v=>v/sum)}
function controls(){const p=$('play');p.disabled=!enabled||path.length<2;$('save').disabled=path.length<2;$('clear').disabled=path.length===0;const st=playing?'playing':progress>=1?'replay':'ready';p.dataset.state=st;$('playLabel').textContent=playing?'PAUSE':progress>=1?'REPLAY':'PLAY';p.setAttribute('aria-label',playing?'Pause journey':progress>=1?'Replay journey':'Play journey');if(path.length<2)holdRegion=null;if(playing&&!controls.was)uiPlayStart=performance.now();controls.was=playing;stage.classList.toggle('has-path',path.length>1);const lb=$('loopBtn');if(lb)lb.setAttribute('aria-pressed',loopOn);uiWake(playing)}
function finishDraw(){drawing=false;pointerId=null;controls();if(path.length>1){indexPath();}if(path.length>1)message('Path ready. Play it, or save this composition.');else path=[]}
function startDraw(p){stopJourney();drawing=true;path=[p];point=p;travel=0;curvature=0;progress=0;message('Drawing your journey…');controls()}
function addPoint(p){const last=path[path.length-1];if(!last||Math.hypot(last.x-p.x,last.y-p.y)>.002){if(path.length<4000)path.push(p);point=p}}
function pointer(e){const r=stage.getBoundingClientRect();return{x:Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width)),y:Math.max(.04,Math.min(.96,(e.clientY-r.top)/r.height))}}
function setHold(i){
 if(path.length<2||!enabled)return;
 if(!playing){playJourney()}
 if(!playing||!journeyBeats)return;
 const c=totalLength?lengths[i]/totalLength:0;
 let span=Math.max(4,Math.round(.12*journeyBeats/4)*4)/journeyBeats;if(span>=1)span=1;
 const a=Math.max(0,Math.min(1-span,c-span/2));
 holdRegion={a,b:a+span,c};
 if(progress<a||progress>=a+span){journeyStartBeat=audio.beatPosition();journeyStartProgress=a;progress=a}
 message('Looping this section · '+Math.round(span*journeyBeats)+' beats. Tap the pulsing dot to release.');
}
function releaseHold(){if(!holdRegion)return;holdRegion=null;message('Loop released. The journey plays on.')}
function uiPathHit(e){if(path.length<2)return null;const r=stage.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;let bi=-1,bd=1e9;for(let i=0;i<path.length;i++){const d=Math.hypot(path[i].x*r.width-px,path[i].y*r.height-py);if(d<bd){bd=d;bi=i}}return bd<=34?{i:bi,d:bd}:null}
function uiHoldDotHit(e){if(!holdRegion||path.length<2)return false;const r=stage.getBoundingClientRect(),c=samplePath(holdRegion.c);return Math.hypot(c.x*r.width-(e.clientX-r.left),c.y*r.height-(e.clientY-r.top))<=32}
function uiReshape(cur){const o=press.orig,L=press.lens,k=press.hit.i,dx=cur.x-press.grab.x,dy=cur.y-press.grab.y,sigma=Math.max(.06,L[L.length-1]*.14);
 for(let i=0;i<o.length;i++){const w=Math.exp(-Math.pow((L[i]-L[k])/sigma,2));path[i]={x:Math.max(.02,Math.min(.98,o[i].x+dx*w)),y:Math.max(.04,Math.min(.96,o[i].y+dy*w))}}
 indexPath();uiGrab=k}
let press=null;
stage.addEventListener('contextmenu',e=>e.preventDefault());
stage.addEventListener('pointerdown',e=>{if(!enabled||e.button!==0)return;
 const nb=e.target.closest('button.node');
 press={id:e.pointerId,x:e.clientX,y:e.clientY,node:nb?+nb.dataset.i:-1,started:false,kind:'draw'};
 try{stage.setPointerCapture(e.pointerId)}catch{}
 const hit=!drawing&&(playing||!nb)?uiPathHit(e):null;
 if(uiHoldDotHit(e)){press.kind='release'}
 else if(hit){const lens=[0];for(let i=1;i<path.length;i++)lens.push(lens[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
  Object.assign(press,{kind:'path',hit,grab:pointer(e),orig:path.map(p=>({...p})),lens,held:false});
  press.timer=setTimeout(()=>{if(press&&press.kind==='path'&&!press.started){press.held=true;setHold(hit.i);uiBuzz(24)}},430)}
 else if(nb){}
 else if(playing){press.kind='away'}
 else{press.started=true;pointerId=e.pointerId;startDraw(pointer(e));stage.focus({preventScroll:true})}
 e.preventDefault()});
stage.addEventListener('pointermove',e=>{if(!enabled)return;
 if(press&&e.pointerId===press.id){const moved=Math.hypot(e.clientX-press.x,e.clientY-press.y);
  if(press.kind==='path'){if(!press.held&&(press.started||moved>8)){clearTimeout(press.timer);if(!press.started){press.started=true;uiBuzz(6)}uiReshape(pointer(e))}}
  else if(press.kind==='away'){if(!press.started&&moved>14){press.started=true;pointerId=e.pointerId;startDraw(pointer({clientX:press.x,clientY:press.y}));addPoint(pointer(e))}else if(press.started&&drawing)addPoint(pointer(e))}
  else if(press.kind==='draw'&&press.node>=0&&!press.started){if(moved>9){press.started=true;pointerId=e.pointerId;const n=nodes[press.node];startDraw({x:n.x,y:n.y});addPoint(pointer(e));uiBuzz(6)}}
  else if(drawing&&e.pointerId===pointerId){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ce of(evs.length?evs:[e]))addPoint(pointer(ce))}}
 else if(!playing&&e.pointerType==='mouse'&&!e.target.closest('button'))point=pointer(e)});
const uiPressEnd=e=>{if(!press||e.pointerId!==press.id)return;const p=press;press=null;clearTimeout(p.timer);uiGrab=-1;
 if(p.kind==='release'){if(e.type==='pointerup'){releaseHold();uiBuzz(12)}}
 else if(p.kind==='path'){if(p.started&&!p.held){message('Route reshaped. Playback continues.');uiBuzz(8)}}
 else if(drawing){finishDraw();if(path.length>1)uiBuzz(14)}
 else if(p.node>=0&&!p.started&&e.type==='pointerup')visit(p.node)};
stage.addEventListener('pointerup',uiPressEnd);stage.addEventListener('pointercancel',uiPressEnd);
stage.addEventListener('keydown',e=>{if(e.target!==stage||!enabled)return;if(e.code==='Space'){e.preventDefault();if(drawing)finishDraw();else startDraw({...point})}if(e.key.startsWith('Arrow')){e.preventDefault();stopJourney();const d=.025;point={x:Math.max(.03,Math.min(.97,point.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0))),y:Math.max(.05,Math.min(.95,point.y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0)))};if(drawing)addPoint({...point})}if(e.key==='Escape'){finishDraw();stopJourney()}});
let lengths=[],totalLength=0, journeyBeats=0, journeyStartBeat=0, journeyStartProgress=0;
let sp=[],slens=[0];
// With Loop on, the playable route is closed: the end flows back to the start along a connector.
function indexPath(){lengths=[0];let t=0;for(let i=1;i<path.length;i++){t+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);lengths.push(t)}sp=path;slens=lengths;totalLength=t;if(loopOn&&path.length>1){const a=path[path.length-1],b=path[0];totalLength=t+Math.hypot(a.x-b.x,a.y-b.y);sp=path.concat([b]);slens=lengths.concat([totalLength])}}
function samplePath(f){const target=f*totalLength;let lo=1,hi=slens.length-1;while(lo<hi){let m=(lo+hi)>>1;if(slens[m]<target)lo=m+1;else hi=m}const i=lo,a=sp[i-1],b=sp[i],t=(target-slens[i-1])/Math.max(.000001,slens[i]-slens[i-1]);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function geometry(f){const a=samplePath(Math.max(0,f-.007)),b=samplePath(f),c=samplePath(Math.min(1,f+.007));const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y;return Math.min(1,Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy))/Math.PI)}
function stopJourney(){playing=false;holdRegion=null;controls()}
function playJourney(restart=false){if(!enabled||path.length<2)return;if(playing&&!restart){stopJourney();message('Journey paused. Play to continue.');return}indexPath();duration=+$('duration').value;if(progress>=1||restart)progress=0;if(progress===0){point={...path[0]};weights=typeof musicalMix==='function'?musicalMix(point):blend(point);audio.reset(seed^pathHash());}if(progress===0||!journeyBeats)journeyBeats=duration*audio.bpm/60;journeyStartBeat=audio.beatPosition();journeyStartProgress=progress;playing=true;controls();message('Following your path. Move freely again when the journey ends.')}
function completeJourney(){
 progress=1;point=samplePath(1);stopJourney();
 if(typeof saveWorkingSession==='function')saveWorkingSession();
 // Stop transport without disposing audio, changing the constellation or showing the gate.
 audio.a.suspend();$('mute').textContent='Resume sound';
 message('Journey complete. Playback stopped at the destination. Replay journey to travel again.');
}
function pathHash(){let h=2166136261;path.forEach(p=>{h=Math.imul(h^Math.round(p.x*10000),16777619);h=Math.imul(h^Math.round(p.y*10000),16777619)});return h>>>0}
class SoundField{
 constructor(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('This browser does not support Web Audio.');this.a=new AC();this.master=this.a.createGain();this.master.gain.value=.65;const compressor=this.a.createDynamicsCompressor();compressor.threshold.value=-20;compressor.ratio.value=5;this.rack=typeof createEffectsRack==='function'?createEffectsRack(this.a,compressor):null;this.master.connect(this.rack?.input||compressor);compressor.connect(this.a.destination);this.delay=this.a.createDelay(2);this.delay.delayTime.value=.42;this.feedback=this.a.createGain();this.feedback.gain.value=.28;const low=this.a.createBiquadFilter();low.frequency.value=2300;this.delay.connect(low);low.connect(this.feedback);this.feedback.connect(this.delay);const wet=this.a.createGain();wet.gain.value=.28;low.connect(wet);wet.connect(this.master);this.routes=[];this.buses=worlds.map((_,i)=>{const g=this.a.createGain();g.gain.value=.1;if(typeof createTrackRoute==='function'){this.routes[i]=createTrackRoute(this.a,this.master,i);g.connect(this.routes[i].input)}else g.connect(this.master);return g});this.noise=this.a.createBuffer(1,this.a.sampleRate*2,this.a.sampleRate);const data=this.noise.getChannelData(0),r=rng(seed);for(let i=0;i<data.length;i++)data[i]=r()*2-1;this.voices=new Set();this.bpm=72;this.targetBpm=72;this.frame=0;this.tick=0;this.beatMarkers=[];this.next=this.a.currentTime+.1;this.random=rng(seed);this.fieldIndex=0;this.field=worlds[0];this.timer=setInterval(()=>this.schedule(),25)}
 reset(s){if(typeof resetImportedAudio==='function')resetImportedAudio();this.random=rng(s);this.tick=0;this.beatMarkers=[];this.frame=0;this.fieldIndex=weights.indexOf(Math.max(...weights));this.field=worlds[this.fieldIndex];this.bpm=weights.reduce((v,w,i)=>v+w*worlds[i].bpm,0);this.targetBpm=worlds[this.fieldIndex].bpm;this.next=this.a.currentTime+.12;for(const o of this.voices){try{o.stop(this.a.currentTime+.03)}catch{}}this.voices.clear();this.feedback.gain.setTargetAtTime(0,this.a.currentTime,.02);this.feedback.gain.setTargetAtTime(.28,this.a.currentTime+.8,.1)}
 note(midi,t,len,bus,kind,amp,pan=0){if(audioSlots[bus]?.ready)return;const a=this.a,osc=a.createOscillator(),g=a.createGain(),filter=a.createBiquadFilter(),p=a.createStereoPanner();osc.type=kind;osc.frequency.value=440*Math.pow(2,(midi-69)/12);filter.type='lowpass';filter.frequency.value=kind==='sine'?5000:900+point.y*1700;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.06);g.gain.exponentialRampToValueAtTime(.0001,t+len);p.pan.value=pan;osc.connect(filter);filter.connect(g);g.connect(p);p.connect(this.buses[bus]);osc.start(t);osc.stop(t+len+.1);osc.voiceGain=g;this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();filter.disconnect();g.disconnect();p.disconnect()}}
 pitch(degree,oct){const s=this.field.scale;return 12*oct+this.field.key+s[((degree%7)+7)%7]}
 beatPosition(){const now=this.a.currentTime,marks=this.beatMarkers;if(!marks.length||now<marks[0].time)return 0;let i=marks.length-1;while(i>0&&marks[i].time>now)i--;const a=marks[i],b=marks[i+1];return b?a.beat+(now-a.time)/(b.time-a.time)*(b.beat-a.beat):a.beat+Math.max(0,now-a.time)*this.bpm/60}
 schedule(){if(!enabled||this.a.state!=='running')return;const now=this.a.currentTime;if(this.next<now-.1)this.next=now+.08;let safety=0;while(this.next<now+.15&&safety++<12){const t=this.next,step=this.tick%16;this.beatMarkers.push({time:t,beat:this.tick/4});if(this.beatMarkers.length>128)this.beatMarkers.shift();if(step===0){const idx=weights.indexOf(Math.max(...weights));if(idx!==this.fieldIndex&&weights[idx]>.88){this.fieldIndex=idx;this.targetBpm=worlds[idx].bpm;for(const o of this.voices){const g=o.voiceGain;if(g?.gain.cancelAndHoldAtTime)g.gain.cancelAndHoldAtTime(t);else g?.gain.cancelScheduledValues?.(t);g?.gain.setTargetAtTime(.0001,t,.04);try{o.stop(t+.18)}catch{}}}this.field=worlds[this.fieldIndex];if(typeof syncImportedBeat==='function')syncImportedBeat(this.tick/4,t);this.frame++}const chord=[0,3,5,4][Math.floor((this.frame-1)/2)%4];if(step===0){[0,1,2,3].forEach(i=>{[0,2,4].forEach((d,j)=>this.note(this.pitch(chord+d,3+(i===0?1:0)),t+j*.045,6.8,i,i===2?'sine':i===3?'triangle':'sine',.048,(j-1)*.35));this.note(this.pitch(chord,2),t,5,i,'sine',.08)})}for(let i=0;i<4;i++){const r=this.random(),density=[.28,.42,.12,.68][i]+curvature*.25;if(r<density){const degree=chord+[0,2,4,6,7,9][Math.floor(this.random()*6)];this.note(this.pitch(degree,4+(i===0?1:0)),t,1.1+this.random()*2.5,i,i===3?'triangle':'sine',.04+this.random()*.018,(this.random()-.5)*1.4)}}if(step%4===0)this.note(this.pitch(chord,2),t,.45,3,'sine',.11);this.tick++;this.next+=60/this.bpm/4}}
 update(dt){const a=this.a,t=a.currentTime;const target=typeof transitionSettings==='undefined'?weights.reduce((v,w,i)=>v+w*worlds[i].bpm,0):this.targetBpm;this.bpm+=(target-this.bpm)*(1-Math.exp(-dt/3));this.buses.forEach((g,i)=>g.gain.setTargetAtTime(Math.sqrt(weights[i])*.48*(typeof guardedGain==='function'?guardedGain(i):1),t,.35));this.delay.delayTime.setTargetAtTime(60/this.bpm*.65+curvature*.08,t,.5);if(typeof updateImportedAudio==='function')updateImportedAudio(dt);if(typeof updateSpatialScene==='function')updateSpatialScene(dt)}
 volume(){this.master.gain.setTargetAtTime(muted?0:+$('volume').value/100,this.a.currentTime,.1)}
}
let uiAnalyser=null,uiFFT=null;
function uiTap(){if(uiAnalyser||!audio)return;try{uiAnalyser=audio.a.createAnalyser();uiAnalyser.fftSize=256;uiAnalyser.smoothingTimeConstant=.78;uiFFT=new Uint8Array(uiAnalyser.frequencyBinCount);audio.master.connect(uiAnalyser)}catch{uiAnalyser=null}}
async function enter(){const gate=$('gate');try{gate.classList.add('booting');uiBuzz(18);const hold=new Promise(r=>setTimeout(r,gate.hidden?0:1050));if(!audio){audio=new SoundField();audio.a.onstatechange=()=>{if(enabled&&audio.a.state!=='running'&&progress<1){stopJourney();if(typeof saveWorkingSession==='function')saveWorkingSession();$('mute').textContent='Resume sound';message('Sound paused. Resume sound to continue your session.')}}}await audio.a.resume();if(typeof audioReady!=='undefined')await audioReady;if(typeof hydrateAudioSlots==='function')await hydrateAudioSlots();if(typeof initializeEffects==='function')await initializeEffects();enabled=true;try{localStorage.setItem('continuum-audio-activated-v1','true')}catch{}uiTap();await hold;gate.classList.add('out');setTimeout(()=>{gate.hidden=true;gate.classList.remove('out','booting')},520);$('mute').disabled=false;$('mute').textContent=muted?'Unmute':'Mute';audio.volume();controls();message('Explore the four places, then draw a path between them.')}catch(e){gate.classList.remove('booting');message(e.message);$('enterLabel').textContent='Retry'}}
$('enter').onclick=enter;$('mute').onclick=async()=>{if(!enabled){await enter();return}if(audio.a.state!=='running'){await audio.a.resume();$('mute').textContent=muted?'Unmute':'Mute';message('Sound resumed.');return}muted=!muted;audio.volume();$('mute').textContent=muted?'Unmute':'Mute'};$('volume').oninput=()=>audio?.volume();$('play').onclick=async()=>{if(audio.a.state!=='running'){await audio.a.resume();$('mute').textContent=muted?'Unmute':'Mute'}playJourney()};$('clear').onclick=()=>{stopJourney();path=[];progress=0;controls();message('Path cleared. Draw a new journey.')};$('new').onclick=()=>{stopJourney();seed=crypto.getRandomValues(new Uint32Array(1))[0];nodes=positions(seed);path=[];progress=0;renderNodes();controls();audio?.reset(seed);message('A new constellation. Saved journeys keep their original places.')};
function snapshotData(){return{version:1,seed,...(typeof performanceData==='function'?performanceData():{}),scene:typeof transitionSettings==='undefined'?undefined:{...transitionSettings},audio:audioSlots.map(t=>t?{id:t.id,name:t.name,bpm:t.bpm,key:t.key,mode:t.mode,beatOffset:t.beatOffset}:null),audioMode:typeof audioMode==='undefined'?'match':audioMode,nodes:nodes.map(n=>({...n})),path:path.map(p=>({...p})),duration:+$('duration').value,created:new Date().toISOString(),id:crypto.randomUUID()}}
function storeSnapshots(){try{localStorage.setItem('continuum-journeys-v1',JSON.stringify(snapshots));return true}catch{storageOK=false;return false}}
function renderSnapshots(){$('snapshots').replaceChildren();$('empty').hidden=snapshots.length>0;$('savedCount').textContent=snapshots.length+(snapshots.length===1?' SNAPSHOT':' SNAPSHOTS');snapshots.forEach((s,i)=>{const card=document.createElement('article');card.className='snapshot';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 80');const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',s.path.map(p=>p.x*200+','+p.y*80).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#a8ecf0');line.setAttribute('stroke-width','1');svg.append(line);s.nodes.forEach((n,j)=>{const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',n.x*200);c.setAttribute('cy',n.y*80);c.setAttribute('r','3.2');c.setAttribute('fill',palettes[j]);svg.append(c)});const h=document.createElement('h3');h.textContent='Journey '+String(snapshots.length-i).padStart(2,'0');const p=document.createElement('p');p.textContent=s.duration+' SEC / '+new Date(s.created).toLocaleDateString();p.className='micro';const actions=document.createElement('div');actions.className='actions';[['Replay',async()=>{if(!enabled)await enter();if(!enabled)return;stopJourney();try{if(typeof restoreSnapshotAudio==='function')await restoreSnapshotAudio(s);}catch(e){message(e.message);return}if(typeof restoreSceneSettings==='function')restoreSceneSettings(s);if(typeof restorePerformance==='function')restorePerformance(s);seed=s.seed;nodes=s.nodes.map(n=>({...n}));path=s.path.map(p=>({...p}));$('duration').value=s.duration;progress=0;renderNodes();playJourney(true)}],['Export',()=>{const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='continuum-journey-'+s.id.slice(0,8)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);message('Journey exported. This file contains the path, settings and audio references. Imported audio files stay in this browser and are not included in the JSON.')}],['Delete',()=>{snapshots=snapshots.filter(x=>x.id!==s.id);storeSnapshots();renderSnapshots();message('Snapshot deleted.')}]].forEach(([text,fn])=>{const b=document.createElement('button');b.type='button';b.className=text==='Replay'?'primary':text==='Delete'?'danger':'';b.textContent=text;b.onclick=fn;actions.append(b)});card.append(svg,h,p,actions);$('snapshots').append(card)})}
$('save').onclick=()=>{if(path.length<2)return;if(snapshots.length>=24){message('24 snapshots saved. Export or delete one to make room.');return}snapshots.unshift(snapshotData());const ok=storeSnapshots();renderSnapshots();message(ok?'Snapshot saved. Replay this path from your saved journeys.':'Browser storage is unavailable. Export this snapshot before leaving.');};
function validSnapshot(s){return s&&s.version===1&&(typeof validPerformance!=='function'||validPerformance(s))&&(!s.scene||(typeof s.scene.focus==='boolean'&&typeof s.scene.guard==='boolean'&&Number.isFinite(s.scene.spatial)&&s.scene.spatial>=0&&s.scene.spatial<=.7))&&(!s.audioMode||['match','tempo','original'].includes(s.audioMode))&&(!s.audio||(Array.isArray(s.audio)&&s.audio.length===4&&s.audio.every(t=>!t||(typeof t.id==='string'&&typeof t.name==='string'&&Number.isFinite(t.bpm)&&t.bpm>=40&&t.bpm<=240&&Number.isInteger(t.key)&&t.key>=0&&t.key<12&&['Major','Minor'].includes(t.mode)&&Number.isFinite(t.beatOffset)&&t.beatOffset>=0&&t.beatOffset<2))))&&Number.isInteger(s.seed)&&typeof s.id==='string'&&typeof s.created==='string'&&[30,60,120,300].includes(s.duration)&&Array.isArray(s.nodes)&&s.nodes.length===4&&s.nodes.every(n=>n.radius===undefined||(Number.isFinite(n.radius)&&n.radius>=.16&&n.radius<=.85))&&Array.isArray(s.path)&&s.path.length>=2&&s.path.length<=4000&&[...s.path,...s.nodes].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)}
try{const raw=JSON.parse(localStorage.getItem('continuum-journeys-v1')||'[]');snapshots=Array.isArray(raw)?raw.filter(validSnapshot).slice(0,24):[]}catch{storageOK=false}
$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>700000)throw Error('This journey file is too large.');const s=JSON.parse(await file.text());if(!validSnapshot(s))throw Error('Choose a valid CONTINUUM journey JSON file.');if(snapshots.some(x=>x.id===s.id)){message('This journey is already saved.');return}if(snapshots.length>=24)throw Error('Delete a snapshot to make room before importing.');snapshots.unshift(s);const ok=storeSnapshots();renderSnapshots();message(ok?'Journey imported. Select Replay to follow its path.':'Imported for this session. Browser storage is unavailable.')}catch(err){message(err.message)}finally{e.target.value=''}};
const mixSpans=worlds.map((w,i)=>{const s=document.createElement('span');s.style.setProperty('--color',palettes[i]);$('mix').append(s);return s});
const uiGrid=document.createElement('canvas');let uiGW=0,uiGH=0,uiGD=0;
function uiBuildGrid(w,h,dpr){uiGrid.width=Math.round(w*dpr);uiGrid.height=Math.round(h*dpr);const g=uiGrid.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.strokeStyle='rgba(120,200,212,.34)';g.lineWidth=.7;g.beginPath();const st=w<520?30:38;for(let x=st/2;x<w;x+=st)for(let y=st/2;y<h;y+=st){g.moveTo(x-2,y);g.lineTo(x+2,y);g.moveTo(x,y-2);g.lineTo(x,y+2)}g.stroke();
 g.strokeStyle='rgba(150,215,225,.5)';g.fillStyle='rgba(150,205,215,.55)';g.font='8px '+uiMono;g.textBaseline='middle';g.beginPath();
 for(let i=0;i<=20;i++){const maj=i%5===0,y=i/20*h;g.moveTo(w-1,y);g.lineTo(w-(maj?9:5),y);const x=i/20*w;g.moveTo(x,h-1);g.lineTo(x,h-(maj?9:5))}g.stroke();
 g.textAlign='right';for(let i=1;i<4;i++){g.fillText((i/4).toFixed(2),w-13,i/4*h)}g.textAlign='center';for(let i=1;i<4;i++){g.fillText((i/4).toFixed(2),i/4*w,h-14)}
 uiGW=w;uiGH=h;uiGD=dpr}
function uiGlobe(x,y,R,color,rot,lw){ctx.save();ctx.translate(x,y);ctx.rotate(-.38);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.arc(0,0,R,0,6.2832);ctx.stroke();ctx.beginPath();for(let k=0;k<6;k++){const rx=Math.abs(Math.sin(rot+k*Math.PI/6))*R;ctx.moveTo(rx,0);ctx.ellipse(0,0,Math.max(.6,rx),R,0,0,6.2832)}ctx.stroke();ctx.beginPath();for(let k=-2;k<=2;k++){const lat=k*Math.PI/6.4,rx=Math.cos(lat)*R,cy=Math.sin(lat)*R;ctx.moveTo(rx,cy);ctx.ellipse(0,cy,rx,Math.max(.6,rx*.27),0,0,6.2832)}ctx.stroke();ctx.restore()}
function draw(time){
 if(!stage.offsetParent)return;
 const rect=stage.getBoundingClientRect(),w=rect.width,h=rect.height;if(w<20||h<20)return;
 const dpr=Math.min(devicePixelRatio||1,2),t=time/1000;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 if(uiGW!==w||uiGH!==h||uiGD!==dpr)uiBuildGrid(w,h,dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(uiGrid,0,0,w,h);
 const U=Math.min(w,h),orb=Math.max(21,Math.min(36,U*.085)),spin=reduced?0:t*.32;if(stage._orb!==orb){stage._orb=orb;stage.style.setProperty('--orb',orb+'px')}
 const hl=drawing?'#ff7a52':'#ece3a4';
 // influence fields
 nodes.forEach((n,i)=>{const x=n.x*w,y=n.y*h,r=projectionRadius(n)*U;
  if(enabled){const g=ctx.createRadialGradient(x,y,0,x,y,r),a=Math.round(12+weights[i]*46).toString(16).padStart(2,'0');g.addColorStop(0,palettes[i]+a);g.addColorStop(1,palettes[i]+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
  ctx.lineWidth=.8;ctx.setLineDash([1.5,5]);for(let k=0;k<3;k++){ctx.strokeStyle=palettes[i]+(k===2?'90':'38');ctx.beginPath();ctx.arc(x,y,r*(.62+k*.19),0,6.2832);ctx.stroke()}ctx.setLineDash([])});
 // listener crosshair + weight tethers
 if(enabled){const head=(path.length>1&&(playing||progress>0)&&!drawing)?samplePath(progress):point,hx=head.x*w,hy=head.y*h;
  ctx.strokeStyle='rgba(190,240,240,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(w,hy);ctx.moveTo(hx,0);ctx.lineTo(hx,h);ctx.stroke();
  nodes.forEach((n,i)=>{if(weights[i]<.025)return;ctx.strokeStyle=palettes[i]+Math.round(26+weights[i]*90).toString(16).padStart(2,'0');ctx.lineWidth=.8+weights[i]*.8;ctx.setLineDash([2,6]);ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(n.x*w,n.y*h);ctx.stroke();ctx.setLineDash([])})}
 // route
 if(path.length>1){
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='rgba(143,227,234,.16)';ctx.lineWidth=7;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.stroke();
  ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(168,236,240,.78)';ctx.lineWidth=1.2;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.stroke();ctx.setLineDash([]);
  const a=path[0],z=path[path.length-1];ctx.strokeStyle=hl;ctx.fillStyle=hl;ctx.lineWidth=1.2;ctx.save();ctx.translate(a.x*w,a.y*h);ctx.rotate(Math.PI/4);ctx.strokeRect(-4,-4,8,8);ctx.restore();ctx.beginPath();ctx.arc(z.x*w,z.y*h,3,0,6.2832);ctx.fill();ctx.beginPath();ctx.arc(z.x*w,z.y*h,7,0,6.2832);ctx.stroke()}
 // sources
 nodes.forEach((n,i)=>{const x=n.x*w,y=n.y*h,c=palettes[i],wt=weights[i];
  const meter=audio?.routes?.[i],level=meter?.level||0;
  const g0=ctx.createRadialGradient(x,y,0,x,y,orb*1.4);g0.addColorStop(0,c+'26');g0.addColorStop(1,c+'00');ctx.fillStyle=g0;ctx.beginPath();ctx.arc(x,y,orb*1.4,0,6.2832);ctx.fill();
  uiGlobe(x,y,orb,c+'a8',spin*(i%2?-1:1)+i,.8);
  // dial dots
  const dots=44,lit=Math.round(wt*dots),rr=orb+14;ctx.fillStyle=c;ctx.beginPath();for(let d=0;d<lit;d++){const a=-Math.PI/2+d/dots*6.2832;ctx.moveTo(x+Math.cos(a)*rr+1.7,y+Math.sin(a)*rr);ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,1.7,0,6.2832)}ctx.fill();
  ctx.fillStyle=c+'44';ctx.beginPath();for(let d=lit;d<dots;d++){const a=-Math.PI/2+d/dots*6.2832;ctx.moveTo(x+Math.cos(a)*rr+1,y+Math.sin(a)*rr);ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,1,0,6.2832)}ctx.fill();
  // ticks + sweep arcs
  ctx.strokeStyle=c+'66';ctx.lineWidth=.8;ctx.beginPath();for(let k=0;k<24;k++){const a=k*Math.PI/12,i0=orb+23,i1=i0+(k%6===0?6:3);ctx.moveTo(x+Math.cos(a)*i0,y+Math.sin(a)*i0);ctx.lineTo(x+Math.cos(a)*i1,y+Math.sin(a)*i1)}ctx.stroke();
  const sw=reduced?0:t*(i%2?-.9:.9);ctx.strokeStyle=c+'bb';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,orb+8,sw,sw+.9);ctx.stroke();ctx.beginPath();ctx.arc(x,y,orb+8,sw+Math.PI,sw+Math.PI+.5);ctx.stroke();
  // live waveform + core
  if(meter?.meter){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();for(let k=0;k<64;k++){const px=x-orb+k*orb*2/63,py=y+(meter.meter[k*2]-128)/128*orb*.6;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}
  ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,2+level*3,0,6.2832);ctx.fill();
  // leader + coordinate callout toward map centre (roomy stages only)
  if(w>=520){const side=n.x>.5?-1:1,ay=y-orb*.5,ax=x+side*(orb+30);ctx.strokeStyle=c+'88';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(ax,y);ctx.lineTo(ax+side*14,ay);ctx.lineTo(ax+side*14+side*22,ay);ctx.stroke();
  ctx.fillStyle=c+'cc';ctx.font='8px '+uiMono;ctx.textBaseline='alphabetic';ctx.textAlign=side>0?'left':'right';ctx.fillText('X '+n.x.toFixed(3),ax+side*18,ay-3);ctx.fillStyle=c+'88';ctx.fillText('Y '+n.y.toFixed(3),ax+side*18,ay+9)}});
 // loop closure: the end flows back to the start
 if(loopOn&&path.length>1){const e=path[path.length-1],st=path[0],ex=e.x*w,ey=e.y*h,sx=st.x*w,sy=st.y*h,len=Math.hypot(sx-ex,sy-ey);
  if(len>6){ctx.lineCap='round';ctx.strokeStyle='rgba(236,227,164,.14)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(sx,sy);ctx.stroke();
   ctx.setLineDash([2,6]);ctx.lineDashOffset=reduced?0:-t*14;ctx.strokeStyle='#ece3a4';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(sx,sy);ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;
   const ang=Math.atan2(sy-ey,sx-ex),mx=(ex+sx)/2,my=(ey+sy)/2;ctx.fillStyle='#ece3a4';ctx.save();ctx.translate(mx,my);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-5);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore()}
  const rp=reduced?.5:.5+.5*Math.sin(t*3);ctx.strokeStyle='rgba(236,227,164,'+(.85-rp*.5)+')';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(sx,sy,11+rp*5,0,6.2832);ctx.stroke();ctx.fillStyle='#ece3a4';ctx.font='8px '+uiMono;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText('LOOP ↻ START',sx,sy-18)}
 // held section + pulsing release marker
 if(holdRegion&&path.length>1){const ta=holdRegion.a*totalLength,tb=holdRegion.b*totalLength,pa=samplePath(holdRegion.a),pb=samplePath(holdRegion.b),pc=samplePath(holdRegion.c);
  ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='rgba(255,106,69,.22)';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(pa.x*w,pa.y*h);for(let i=0;i<path.length;i++)if(lengths[i]>ta&&lengths[i]<tb)ctx.lineTo(path[i].x*w,path[i].y*h);ctx.lineTo(pb.x*w,pb.y*h);ctx.stroke();ctx.strokeStyle='#ff9a6b';ctx.lineWidth=2.6;ctx.stroke();
  ctx.fillStyle='#ff9a6b';for(const q of[pa,pb]){ctx.beginPath();ctx.arc(q.x*w,q.y*h,3,0,6.2832);ctx.fill()}
  const pu=reduced?.5:.5+.5*Math.sin(t*5.5);ctx.strokeStyle='rgba(255,106,69,'+(.75-pu*.55)+')';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(pc.x*w,pc.y*h,10+pu*14,0,6.2832);ctx.stroke();ctx.fillStyle='#02070a';ctx.beginPath();ctx.arc(pc.x*w,pc.y*h,8,0,6.2832);ctx.fill();ctx.fillStyle='#ff6a45';ctx.beginPath();ctx.arc(pc.x*w,pc.y*h,4.5+pu*1.5,0,6.2832);ctx.fill();
  ctx.fillStyle='#ffb394';ctx.font='8px '+uiMono;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText('LOOP · TAP TO RELEASE',pc.x*w,pc.y*h-24)}
 if(uiGrab>=0&&path[uiGrab]){const g=path[uiGrab];ctx.strokeStyle='#ece3a4';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(g.x*w,g.y*h,15,0,6.2832);ctx.stroke();ctx.fillStyle='#ece3a4';ctx.beginPath();ctx.arc(g.x*w,g.y*h,3,0,6.2832);ctx.fill()}
 // listener
 if(enabled){const onPath=path.length>1&&(playing||progress>0)&&!drawing,head=onPath?samplePath(progress):point,x=head.x*w,y=head.y*h;
  const beat=audio?audio.beatPosition():0,phase=beat-Math.floor(beat),pulse=playing&&!reduced?Math.exp(-phase*5):0;
  if(onPath){ctx.strokeStyle='#d7fbf6';ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<path.length&&lengths[i]<=progress*totalLength;i++){const p=path[i];i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h)}ctx.lineTo(x,y);ctx.stroke()}
  ctx.strokeStyle=hl+Math.round(90+pulse*150).toString(16).padStart(2,'0');ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,13+pulse*10,0,6.2832);ctx.stroke();
  const rot=reduced?0:t*1.6;ctx.strokeStyle=hl;ctx.lineWidth=1.6;for(let k=0;k<4;k++){const a=rot+k*Math.PI/2;ctx.beginPath();ctx.arc(x,y,9,a,a+.7);ctx.stroke()}
  ctx.fillStyle='#02070a';ctx.beginPath();ctx.arc(x,y,4.5,0,6.2832);ctx.fill();ctx.fillStyle=hl;ctx.beginPath();ctx.arc(x,y,2.6+pulse*1.2,0,6.2832);ctx.fill();
  ctx.strokeStyle=hl+'aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-19,y);ctx.lineTo(x-14,y);ctx.moveTo(x+14,y);ctx.lineTo(x+19,y);ctx.moveTo(x,y-19);ctx.lineTo(x,y-14);ctx.moveTo(x,y+14);ctx.lineTo(x,y+19);ctx.stroke()}
}
const uiBars=new Float32Array(96);
function drawSpectrum(time){const c=$('spectrum');if(!c||!c.offsetParent)return;const w=c.clientWidth,h=c.clientHeight;if(w<10||h<4)return;const dpr=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
 const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);const N=Math.min(uiBars.length,Math.floor(w/5)),live=uiAnalyser&&audio&&audio.a.state==='running';if(live)uiAnalyser.getByteFrequencyData(uiFFT);const t=time/1000;
 for(let i=0;i<N;i++){let v;if(live){const f=Math.pow(i/N,1.25),b=Math.min(uiFFT.length-1,1+Math.floor(f*64));v=Math.min(1,Math.pow(uiFFT[b]/255,1.15)*1.45)}else{const s=Math.sin(i*12.9898+Math.floor(t*1.6)*78.233)*43758.5453;v=.06+(s-Math.floor(s))*.16*(.6+.4*Math.sin(t*.7+i*.3))}
  uiBars[i]+=(v-uiBars[i])*(v>uiBars[i]?.55:.16);const bh=Math.max(2,uiBars[i]*h),x=Math.round(i*(w/N))+.5;g.fillStyle=uiBars[i]>.72?'#ece3a4':uiBars[i]>.4?'#8fdde0':'#2f6f7d';g.fillRect(x,h-bh,1.6,bh)}}
let uiTime=0,drawTime=0,effectUpdateTime=0;function animate(time){const dt=Math.min(.1,(time-lastFrame)/1000||.016);lastFrame=time;if(playing){let pr=journeyStartProgress+Math.max(0,audio.beatPosition()-journeyStartBeat)/journeyBeats;
 if(holdRegion&&pr>=holdRegion.b){journeyStartBeat+=(holdRegion.b-journeyStartProgress)*journeyBeats;journeyStartProgress=holdRegion.a;pr=journeyStartProgress+Math.max(0,audio.beatPosition()-journeyStartBeat)/journeyBeats}
 else if(loopOn&&!holdRegion&&pr>=1){journeyStartBeat+=(1-journeyStartProgress)*journeyBeats;journeyStartProgress=0;pr=Math.max(0,audio.beatPosition()-journeyStartBeat)/journeyBeats}
 progress=Math.min(1,pr);point=samplePath(progress);curvature=geometry(progress);travel=progress*totalLength;if(progress>=1)completeJourney();}const target=typeof musicalMix==='function'?musicalMix(point):blend(point);weights=weights.map((w,i)=>w+(target[i]-w)*(1-Math.exp(-dt*2.5)));if(audio&&enabled&&audio.a.state==='running'&&time-effectUpdateTime>=40){audio.update(Math.min(.1,(time-effectUpdateTime)/1000||.04));effectUpdateTime=time;}
if(time-uiTime>180){uiTime=time;const idx=weights.indexOf(Math.max(...weights));activeWorld=idx;
 $('nodeLayer').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',i===idx&&enabled?'true':'false'));
 $('identStrip').querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-pressed',i===idx&&enabled?'true':'false');b.style.setProperty('--w',(weights[i]*100).toFixed(1)+'%');b.querySelector('i').textContent=Math.round(weights[i]*100)+'%'});
 const field=audio?.field||worlds[0];
 $('harmony').textContent=uiNotes[field.key]+' '+field.mode;$('tempo').textContent=uiPad(Math.round(audio?.bpm||72),3);
 $('srcCode').textContent=uiPad(idx+1);$('srcName').textContent=worlds[idx].name;
 const has=path.length>1;$('progress').textContent=uiPad(playing||(has&&progress>0)?Math.round(progress*100):0);
 $('progressLabel').textContent=holdRegion?'HOLD · '+Math.round((holdRegion.b-holdRegion.a)*journeyBeats)+' BEATS':playing?(loopOn?'LOOP · ':'')+'BEAT '+(Math.floor(audio.beatPosition()-journeyStartBeat)+1):drawing?'DRAWING':progress>=1&&has?'ARRIVED':has?'ROUTE SET':'FREE';
 if(typeof updateEffectsClock==='function')updateEffectsClock();if(typeof updateSceneMeters==='function')updateSceneMeters();
 if(typeof transitionLabel==='function'){const tl=enabled?transitionLabel():'STANDBY';$('transitionState').textContent=tl;const t2=$('transitionState2');if(t2)t2.textContent=tl}
 mixSpans.forEach((s,i)=>s.style.width=weights[i]*100+'%');
 $('stageStatus').textContent=enabled?(holdRegion?'LOOPING SECTION':playing?(loopOn?'JOURNEY LOOPING':'JOURNEY IN MOTION'):drawing?'DRAWING ROUTE':worlds[idx].desc.toUpperCase()):'Waiting for sound';
 stage.dataset.mode=!enabled?'idle':holdRegion?'hold':playing?'playing':drawing?'drawing':'ready';const tipOn=playing&&!holdRegion&&time-uiPlayStart<7000;stage.classList.toggle('tip',tipOn);{const ht=stage.querySelector('.hint'),tx=tipOn?'Hold the route to loop · drag it to reshape':'Drag from a source to draw a route';if(ht.textContent!==tx)ht.textContent=tx}
 const L=$('duration').value;$('lenVal').textContent=L==='30'?'30S':L==='60'?'1M':L==='120'?'2M':'5M';
 document.querySelectorAll('input[type=range]').forEach(r=>{const f=((+r.value-+(r.min||0))/((+r.max||100)-+(r.min||0))*100).toFixed(1)+'%';if(r.style.getPropertyValue('--fill')!==f)r.style.setProperty('--fill',f)})}
if(time-drawTime>=32){drawTime=time;draw(time);drawSpectrum(time)}requestAnimationFrame(animate)}
document.addEventListener('visibilitychange',async()=>{if(!audio)return;if(document.hidden){if(playing)stopJourney();await audio.a.suspend();if(typeof saveWorkingSession==='function')saveWorkingSession();message('Sound paused while away. Tap Resume sound to continue.');$('mute').textContent='Resume sound'}});nodes=positions(seed);renderNodes();renderSnapshots();controls();requestAnimationFrame(animate);
$('loopBtn').onclick=()=>{const oldTotal=totalLength,oldProg=progress;loopOn=!loopOn;if(path.length>1&&oldTotal>0){indexPath();const r=oldTotal/totalLength;journeyBeats*=totalLength/oldTotal;progress=Math.min(1,oldProg*r);journeyStartProgress=progress;if(audio)journeyStartBeat=audio.beatPosition();if(holdRegion){holdRegion={a:holdRegion.a*r,b:holdRegion.b*r,c:holdRegion.c*r}}if(progress>=1&&!loopOn)progress=1;point=samplePath(progress)}else indexPath();try{localStorage.setItem('continuum-loop-v1',loopOn?'1':'0')}catch{}controls();uiBuzz(8);message(loopOn?'Loop on. The journey repeats until you stop it.':'Loop off. The journey plays once.')};
$('lenBtn').onclick=()=>{const o=['30','60','120','300'],d=$('duration');d.value=o[(o.indexOf(d.value)+1)%4];d.dispatchEvent(new Event('change',{bubbles:true}));uiBuzz(6);const L={30:'30 seconds',60:'1 minute',120:'2 minutes',300:'5 minutes'}[d.value];message('Journey length '+L+'.')};
['new','clear','save','play','loopBtn'].forEach(k=>$(k).addEventListener('pointerdown',()=>uiBuzz(5)));
