'use strict';
// Audio export. The journey is bounced live (what you hear is what you get):
//   SINGLE FILE  → one stereo WAV of the final output (effects, EQ, clipper, tails)
//   MULTITRACK   → ZIP with one WAV stem per source, the full mix, optional original files,
//                  journey.json (path, weights, tempo, effects over time) and a README.
// Recorders start and stop on exact audio frames, so every file lines up sample for sample.
(()=>{
const MB=1048576,MAX_STEM=4;
const $q=id=>document.getElementById(id);
const fmtT=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const fmtMB=b=>b>=1024*MB?(b/(1024*MB)).toFixed(2)+' GB':(b/MB).toFixed(b>=100*MB?0:1)+' MB';
const safe=s=>String(s||'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,40)||'track';
const budgetBytes=()=>{const dm=navigator.deviceMemory;return(dm?Math.min(640,Math.max(200,dm*70)):220)*MB};

const S={opts:{mode:'multi',cycles:1,bits:16,tails:true,sources:true},phase:'config',snapshot:null,cancel:false,result:null,rec:null};
let sheet=null,moduleReady=null,lastFocus=null;

// ─────────── WAV + ZIP (no dependencies) ───────────
function wavHeader(frames,sr,bits){
 const bytes=frames*2*(bits/8),dv=new DataView(new ArrayBuffer(44)),w=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');dv.setUint32(4,36+bytes,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,sr,true);dv.setUint32(28,sr*2*(bits/8),true);dv.setUint16(32,2*(bits/8),true);dv.setUint16(34,bits,true);w(36,'data');dv.setUint32(40,bytes,true);
 return dv.buffer;
}
function pack24(f32){
 const out=new Uint8Array(f32.length*3);
 for(let i=0,o=0;i<f32.length;i++,o+=3){let v=Math.round(Math.max(-1,Math.min(1,f32[i]))*8388607);if(v<0)v+=16777216;out[o]=v&255;out[o+1]=(v>>8)&255;out[o+2]=(v>>16)&255}
 return out;
}
function wavBlob(chunks,frames,sr,bits){
 const parts=[wavHeader(frames,sr,bits)];
 for(const c of chunks)parts.push(bits===16?c:pack24(c));
 return new Blob(parts,{type:'audio/wav'});
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
async function crc32(blob){
 let c=0xFFFFFFFF;
 for(let off=0;off<blob.size;off+=4*MB){const b=new Uint8Array(await blob.slice(off,off+4*MB).arrayBuffer());for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8)}
 return(c^0xFFFFFFFF)>>>0;
}
async function makeZip(entries){
 const enc=new TextEncoder(),parts=[],central=[],d=new Date();
 const dosTime=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dosDate=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
 let offset=0;
 for(const e of entries){
  const name=enc.encode(e.name),size=e.blob.size,crc=await crc32(e.blob);
  if(size>0xFFFFFFFF||offset>0xFFFFFFFF)throw Error('Export too large for one ZIP');
  const lh=new DataView(new ArrayBuffer(30));
  lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,dosTime,true);lh.setUint16(12,dosDate,true);lh.setUint32(14,crc,true);lh.setUint32(18,size,true);lh.setUint32(22,size,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
  parts.push(lh.buffer,name,e.blob);
  const ch=new DataView(new ArrayBuffer(46));
  ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,dosTime,true);ch.setUint16(14,dosDate,true);ch.setUint32(16,crc,true);ch.setUint32(20,size,true);ch.setUint32(24,size,true);ch.setUint16(28,name.length,true);ch.setUint32(42,offset,true);
  central.push(ch.buffer,name);
  offset+=30+name.length+size;
 }
 const cdSize=central.reduce((n,b)=>n+(b.byteLength!==undefined?b.byteLength:b.length),0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,cdSize,true);end.setUint32(16,offset,true);
 return new Blob([...parts,...central,end.buffer],{type:'application/zip'});
}

// ─────────── estimates ───────────
function estimate(){
 const o=S.opts,sr=(typeof audio!=='undefined'&&audio)?audio.a.sampleRate:48000,dur=(+$q('duration').value||60)*o.cycles;
 const tail=o.tails?(typeof uiTailSeconds==='function'&&audio?.rack?uiTailSeconds():1)+1:0,secs=dur+tail,tracks=o.mode==='multi'?1+MAX_STEM:1,bytesPer=o.bits===16?2:4;
 const ram=secs*sr*2*bytesPer*tracks,live=audioSlots.reduce((n,t)=>n+(t&&t.ready?t.seconds*24000*2*4:0),0),budget=budgetBytes();
 const fileBytes=secs*sr*2*(o.bits/8)*tracks;
 return{secs,dur,ram,fileBytes,over:ram+live>budget*1.5,files:o.mode==='multi'?(1+MAX_STEM)+' WAV + data':'1 WAV'};
}

// ─────────── sheet UI ───────────
function build(){
 sheet=document.createElement('div');sheet.id='exportSheet';sheet.className='sheet';sheet.hidden=true;
 sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','exTitle');
 sheet.innerHTML='<div class="sheet-panel panel"><div class="ph"><h3 id="exTitle">Export audio</h3><button type="button" class="x" id="exClose" aria-label="Close">×</button></div><div id="exBody"></div></div>';
 document.body.append(sheet);
 sheet.addEventListener('pointerdown',e=>{if(e.target===sheet&&S.phase!=='record')close()});
 sheet.querySelector('#exClose').onclick=()=>S.phase==='record'?cancel():close();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)(S.phase==='record'?cancel():close())});
 // A locked or backgrounded page stops the audio clock, which would ruin a live bounce.
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.phase==='record')cancel('Export cancelled · screen left')});
}
function seg(name,items,cur){
 return'<div class="seg" role="radiogroup" aria-label="'+name+'">'+items.map(([v,l])=>'<button type="button" role="radio" aria-checked="'+(String(cur)===String(v))+'" data-k="'+name+'" data-v="'+v+'">'+l+'</button>').join('')+'</div>';
}
function render(){
 const b=$q('exBody'),o=S.opts;
 if(S.phase==='config'){
  const e=estimate();
  b.innerHTML=
   '<div class="ex-row"><span class="micro">FORMAT</span>'+seg('mode',[['single','Single file'],['multi','Multitrack']],o.mode)+'</div>'+
   '<div class="ex-row"><span class="micro">LENGTH</span>'+seg('cycles',[[1,'1 cycle'],[2,'2'],[4,'4']],o.cycles)+'</div>'+
   '<div class="ex-row"><span class="micro">DEPTH</span>'+seg('bits',[[16,'16-bit'],[24,'24-bit']],o.bits)+'</div>'+
   '<label class="ex-check"><input type="checkbox" id="exTails"'+(o.tails?' checked':'')+'><span>Let tails ring out</span></label>'+
   '<label class="ex-check'+(o.mode==='multi'?'':' dim')+'"><input type="checkbox" id="exSrc"'+(o.sources?' checked':'')+(o.mode==='multi'?'':' disabled')+'><span>Include original source files</span></label>'+
   '<div class="ex-est'+(e.over?' warn':'')+'"><div><span class="micro">DURATION</span><b>≈ '+fmtT(e.secs)+'</b></div><div><span class="micro">FILES</span><b>'+e.files+'</b></div><div><span class="micro">SIZE</span><b>'+fmtMB(e.fileBytes)+'</b></div></div>'+
   (e.over?'<p class="ex-warn">Too large for this device. Use fewer cycles or 16-bit.</p>':'')+
   '<div class="ex-actions"><button type="button" class="btn primary" id="exGo"'+(e.over?' disabled':'')+'>Start export</button><button type="button" class="btn" id="exCancel">Cancel</button></div>';
  b.querySelectorAll('[data-k]').forEach(btn=>btn.onclick=()=>{const k=btn.dataset.k,v=btn.dataset.v;o[k]=k==='mode'?v:+v;render()});
  $q('exTails').onchange=e=>{o.tails=e.target.checked;render()};
  const sc=$q('exSrc');if(sc)sc.onchange=e=>{o.sources=e.target.checked};
  $q('exGo').onclick=()=>run();$q('exCancel').onclick=close;
 }else if(S.phase==='record'){
  b.innerHTML='<div class="ex-rec"><div class="rec-dot" aria-hidden="true"></div><div><b id="exTime">0:00</b><span class="micro" id="exStatus">ARMING</span></div></div><div class="ex-bar"><u id="exBar"></u></div><p class="ex-note">Recording live. Keep this screen on.</p><div class="ex-actions"><button type="button" class="btn" id="exAbort">Cancel</button></div>';
  $q('exAbort').onclick=()=>cancel();
 }else if(S.phase==='done'&&S.result){
  const r=S.result;
  b.innerHTML='<div class="ex-done"><span class="micro">READY</span><b>'+r.name+'</b><span class="micro">'+fmtMB(r.blob.size)+(r.note?' · '+r.note:'')+'</span></div><div class="ex-actions"><button type="button" class="btn primary" id="exSave">'+(canShare(r)?'Save / share':'Download')+'</button>'+(canShare(r)?'<button type="button" class="btn" id="exDl">Download</button>':'')+'<button type="button" class="btn" id="exDone">Done</button></div>';
  $q('exSave').onclick=()=>canShare(r)?share(r):download(r);
  const dl=$q('exDl');if(dl)dl.onclick=()=>download(r);
  $q('exDone').onclick=close;
 }
}
function canShare(r){try{return!!(navigator.canShare&&navigator.share&&navigator.canShare({files:[new File([r.blob],r.name,{type:r.blob.type})]}))}catch{return false}}
async function share(r){try{await navigator.share({files:[new File([r.blob],r.name,{type:r.blob.type})],title:r.name})}catch(e){if(e&&e.name!=='AbortError')download(r)}}
function download(r){const u=URL.createObjectURL(r.blob),a=document.createElement('a');a.href=u;a.download=r.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}

function open(snap){
 if(!sheet)build();
 if(S.phase==='record')return;
 if(!snap&&path.length<2){message('Draw a route first');return}
 S.snapshot=snap||null;S.phase='config';S.result=null;S.cancel=false;
 lastFocus=document.activeElement;sheet.hidden=false;render();
 requestAnimationFrame(()=>sheet.querySelector('#exGo,#exSave')?.focus());
}
function close(){if(S.phase==='record')return;sheet.hidden=true;S.result=null;S.phase='config';if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch{}}

// ─────────── capture ───────────
function ensureModule(){
 if(!moduleReady)moduleReady=audio.a.audioWorklet.addModule('./rec-worklet.js').catch(e=>{moduleReady=null;throw e});
 return moduleReady;
}
function makeRecorder(bits){
 const node=new AudioWorkletNode(audio.a,'continuum-rec',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{bits}});
 const r={node,chunks:[],frames:0,done:null,resolve:null};
 r.done=new Promise(res=>{r.resolve=res});
 node.port.onmessage=e=>{const d=e.data;if(d.type==='data')r.chunks.push(d.buf);else if(d.type==='done'){r.frames=d.frames;r.resolve()}};
 return r;
}
// Beat → audio time, using the engine's scheduled beat markers (they run ~150 ms ahead of the clock).
function timeOfBeat(B){
 const m=audio.beatMarkers;
 for(let i=m.length-2;i>=0;i--){const a=m[i],b=m[i+1];if(a.beat<=B&&B<=b.beat)return a.time+(B-a.beat)/(b.beat-a.beat||1)*(b.time-a.time)}
 return null;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function run(){
 const o={...S.opts};
 try{
  S.phase='record';S.cancel=false;render();
  if(!enabled)await enter();
  if(!enabled)throw Error('Audio not started');
  await wake();
  if(S.snapshot&&typeof loadSnapshot==='function'){if(!(await loadSnapshot(S.snapshot)))throw Error('Journey unavailable')}
  await ensureModule();
  const multi=o.mode==='multi',a=audio.a,sr=a.sampleRate;
  // Recorders: stems tap each source after its level, FX slots, distance and pan (before the master chain);
  // the mix taps the final output.
  const sink=a.createGain();sink.gain.value=0;sink.connect(a.destination);
  const taps=[],rec={mix:makeRecorder(o.bits),stems:[]};
  audio.out.connect(rec.mix.node);rec.mix.node.connect(sink);taps.push(()=>{try{audio.out.disconnect(rec.mix.node)}catch{}});
  if(multi)for(let i=0;i<MAX_STEM;i++){
   const r=makeRecorder(o.bits),route=audio.routes[i];rec.stems.push(r);
   route.dry.connect(r.node);route.space.connect(r.node);r.node.connect(sink);
   taps.push(()=>{try{route.dry.disconnect(r.node);route.space.disconnect(r.node)}catch{}});
  }
  S.rec=rec;
  // Restart the journey from the top so the bounce is a clean loop.
  uiFadeSources=false;stopJourney();holdRegion=null;progress=0;if(path.length>1)point={...path[0]};playJourney(true);
  // The engine's first scheduled beat is the true start; arm every recorder on that exact moment.
  for(let k=0;k<200&&!audio.beatMarkers.length;k++)await sleep(5);
  const at=audio.beatMarkers.length?Math.max(audio.beatMarkers[0].time,a.currentTime+.04):a.currentTime+.12,cycleBeats=journeyBeats*o.cycles;
  const latency=multi?.006+(fxPresets.slow[effectState.slow.preset]&&effectState.slow.mix>.02?.04:0):0; // compressor look-ahead + Slow Machine delay
  const all=[rec.mix,...rec.stems];
  rec.mix.node.port.postMessage({type:'arm',at:at+latency});
  for(const r of rec.stems)r.node.port.postMessage({type:'arm',at});
  const tailSec=o.tails?Math.min(7,uiTailSeconds())+.8:0,fadeSec=o.tails?.7:0;
  const timeline=[];let stopT=null,fading=false,lastLog=0;
  const t0=performance.now();
  // wait for the cycle end, then schedule exact stops
  while(true){
   if(S.cancel)throw Error('cancelled');
   if(a.state!=='running'){try{await a.resume()}catch{}}
   const now=a.currentTime,beat=audio.beatPosition();
   if(now-lastLog>=.1&&now>=at){lastLog=now;timeline.push({t:+(now-at).toFixed(3),progress:+progress.toFixed(4),x:+point.x.toFixed(4),y:+point.y.toFixed(4),weights:weights.map(w=>+w.toFixed(3)),bpm:+audio.bpm.toFixed(2),key:audio.field.key,mode:audio.field.mode,hold:!!holdRegion})}
   if(stopT===null&&cycleBeats-beat<1.5){const tt=timeOfBeat(cycleBeats);if(tt!==null){stopT=tt;
     rec.mix.node.port.postMessage({type:'stop',at:tt+latency+tailSec});
     for(const r of rec.stems)r.node.port.postMessage({type:'stop',at:tt+fadeSec})}}
   if(stopT!==null&&!fading&&now>=stopT&&o.tails){fading=true;uiFadeSources=true}
   const total=Math.max(1,(stopT?stopT-at:cycleBeats*60/(audio.bpm||72))+tailSec);
   const el=Math.max(0,now-at);
   if($q('exTime')){$q('exTime').textContent=fmtT(el)+' / '+fmtT(total);$q('exBar').style.width=Math.min(100,el/total*100)+'%';$q('exStatus').textContent=stopT===null?'RECORDING':fading?'TAIL':'FINISHING'}
   if(stopT!==null&&now>stopT+tailSec+fadeSec+3)break;               // safety
   if(stopT!==null&&all.every(r=>r.frames>0))break;
   if(performance.now()-t0>1000*(cycleBeats*60/50+40))throw Error('Export timed out');
   await sleep(25);
  }
  await Promise.all(all.map(r=>Promise.race([r.done,sleep(4000)])));
  taps.forEach(f=>f());for(const r of all){try{r.node.disconnect()}catch{}}try{sink.disconnect()}catch{}
  uiFadeSources=false;
  if(S.cancel)throw Error('cancelled');
  $q('exStatus').textContent='BUILDING';
  // Settle the engine the same way Stop does.
  stopJourney();progress=0;if(path.length>1)point={...path[0]};silence();
  S.result=await assemble(o,rec,timeline,sr,at,latency);
  S.phase='done';render();
 }catch(err){
  uiFadeSources=false;
  if(S.rec){for(const r of[S.rec.mix,...S.rec.stems]){try{r.node.port.postMessage({type:'abort'});r.node.disconnect()}catch{}}}
  if(err&&err.message==='cancelled'){/* cancel() already closed the sheet */}
  else{S.phase='config';message(err&&err.message||'Export failed');if(sheet){sheet.hidden=false;render()}}
 }
 S.rec=null;
}
function cancel(msg){
 S.cancel=true;S.phase='config';
 if(msg)message(msg);else message('Export cancelled');
 if(sheet)sheet.hidden=true;
 try{stopJourney()}catch{}
}

// ─────────── assemble files ───────────
async function assemble(o,rec,timeline,sr,at,latency){
 const stamp=new Date().toISOString().slice(0,16).replace(/[-:T]/g,''),base='CONTINUUM-'+stamp;
 const mixFrames=rec.mix.frames,mix=wavBlob(rec.mix.chunks,mixFrames,sr,o.bits);rec.mix.chunks=[];
 if(o.mode==='single')return{name:base+'-mix.wav',blob:mix,note:fmtT(mixFrames/sr)};
 const entries=[],root=base+'/';
 for(let i=0;i<rec.stems.length;i++){const r=rec.stems[i],nm=worlds[i].name;entries.push({name:root+'stems/0'+(i+1)+'-'+safe(nm)+'.wav',blob:wavBlob(r.chunks,r.frames,sr,o.bits)});r.chunks=[]}
 entries.push({name:root+'mix/MIX-with-effects.wav',blob:mix});
 if(o.sources)for(let i=0;i<4;i++){const f=audioSlots[i]&&audioSlots[i].file;if(f)entries.push({name:root+'sources/0'+(i+1)+'-'+(f.name||'source').replace(/[\\/:*?"<>|]/g,'_'),blob:f})}
 const eff=typeof performanceData==='function'?performanceData():{};
 const json={
  app:'CONTINUUM',exported:new Date().toISOString(),sampleRate:sr,bitDepth:o.bits,cycles:o.cycles,tailsIncluded:o.tails,
  frames:{stems:rec.stems.map(r=>r.frames),mix:mixFrames},mixLatencyCompensationSeconds:+latency.toFixed(4),
  sources:worlds.map((w,i)=>({index:i+1,name:w.name,color:palettes[i],on:srcOn[i],bpm:+w.bpm,key:w.key,mode:w.mode,position:{x:+nodes[i].x.toFixed(4),y:+nodes[i].y.toFixed(4)},file:audioSlots[i]&&audioSlots[i].name||null})),
  route:path.map(p=>[+p.x.toFixed(4),+p.y.toFixed(4)]),levels:eff.levels,effects:eff.effects,
  automation:timeline
 };
 entries.push({name:root+'journey.json',blob:new Blob([JSON.stringify(json)],{type:'application/json'})});
 const readme=[
  'CONTINUUM multitrack export',
  '',
  'stems/01-04  One stereo WAV per source: after its level, spatial position and distance filter.',
  '             They do NOT include the master effects chain, so effects can be rebuilt in your DAW.',
  'mix/         The full output as heard: master effects, EQ and soft clipper'+(o.tails?', with tails.':'.'),
  'sources/     The original audio files that were loaded (if included).',
  'journey.json Route, source positions, levels, effect settings and a 10 Hz automation log',
  '             (listener position, per-source weights, tempo, key).',
  '',
  'Stems are recorded at engine level (not normalized), so raise their gain in your DAW if needed.',
  'Import: drop every WAV in the same project at bar 1 (time 0). All files start on the same sample.',
  'Sample rate '+sr+' Hz, '+o.bits+'-bit stereo. Length: '+o.cycles+' cycle'+(o.cycles>1?'s':'')+(o.tails?' plus an ending tail.':' (loop-ready).'),
  'The mix file is aligned to the stems (master-chain delay of '+(latency*1000).toFixed(0)+' ms removed).',
  ''
 ].join('\n');
 entries.push({name:root+'README.txt',blob:new Blob([readme],{type:'text/plain'})});
 const zip=await makeZip(entries);
 return{name:base+'-multitrack.zip',blob:zip,note:entries.length+' files'};
}

window.openExportSheet=open;
const btn=$q('exportAudio');if(btn)btn.onclick=()=>open(null);
})();
