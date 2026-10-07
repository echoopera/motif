'use strict';
// One stereo master rack after the track mix: bounded CPU and predictable touch controls.
const trackLevels=[1,1,1,1];
const fxPresets={
 granular:[{name:'Soft cloud',detail:'110 ms grains · scattered stereo',mode:1,mix:.3},{name:'Reverse mist',detail:'Reverse fragments · 200 ms',mode:2,mix:.35},{name:'Prism swarm',detail:'Fifth + octave grains · 85 ms',mode:3,mix:.25},{name:'Frozen constellation',detail:'Capture a moment · hold a cloud',mode:4,mix:.4},{name:'Micro nebula',detail:'45 ms grains · slowed texture',mode:5,mix:.3}],
 delay:[{name:'Tape echo',detail:'Quarter notes · warm feedback',division:1,feedback:.32,tone:3400,spread:1,mix:.25},{name:'Dotted eighth',detail:'Dotted pulse · rhythmic repeats',division:.75,feedback:.38,tone:6500,spread:1,mix:.25},{name:'Ping-pong',detail:'Alternating stereo · half-beat',division:.5,feedback:.44,tone:5200,spread:1.5,mix:.3},{name:'Dub spiral',detail:'Three-quarter beat · dark decay',division:.75,feedback:.66,tone:1500,spread:1.33,mix:.3},{name:'Orbital echoes',detail:'Asymmetric repeats · wide orbit',division:1.25,feedback:.53,tone:4200,spread:1.6,mix:.25}],
 reverb:[{name:'Small room',detail:'0.7 s · close early reflections',decay:.7,pre:.012,style:0,mix:.2},{name:'Luminous plate',detail:'1.8 s · dense, bright tail',decay:1.8,pre:.02,style:1,mix:.28},{name:'Cathedral',detail:'3.8 s · deep, diffuse space',decay:3.8,pre:.055,style:2,mix:.35},{name:'Gated bloom',detail:'0.9 s · swelling, cut-off tail',decay:.9,pre:.025,style:3,mix:.3},{name:'Void chamber',detail:'4.0 s · sparse resonant space',decay:4,pre:.08,style:4,mix:.35}],
 cutoffLfo:[{name:'Lowpass drift',detail:'Slow triangle · gentle breathing',type:'lowpass',hz:2600,depth:1400,q:.7,beats:16,wave:'triangle',mix:1},{name:'Resonant tide',detail:'Sine sweep · resonant lowpass',type:'lowpass',hz:2000,depth:1550,q:3,beats:8,wave:'sine',mix:.8},{name:'Bandpass orbit',detail:'Moving band · focused texture',type:'bandpass',hz:2200,depth:1400,q:1.1,beats:8,wave:'sine',mix:.55},{name:'Stepped transmission',detail:'Square pulse · beat divisions',type:'lowpass',hz:2300,depth:1700,q:1.5,beats:1,wave:'square',mix:.8},{name:'Random beacon',detail:'Sample + hold · wandering cutoff',type:'lowpass',hz:2800,depth:2000,q:2,beats:2,wave:'random',mix:.8}],
 media:[
  {name:'LoFi Tape',detail:'Dusty cassette · wow, hiss, softened highs',hp:70,lp:5200,shelf:2,drive:1.6,wow:[.0022,.6],flut:[.00006,6.5],hiss:.03,crackle:0,rumble:0,bits:16,width:.12,mix:.35},
  {name:'Vinyl',detail:'33⅓ rpm warp · surface crackle and rumble',hp:55,lp:8200,shelf:1.5,drive:.7,wow:[.0016,.556],flut:[0,5],hiss:.012,crackle:.55,rumble:.1,bits:16,width:0,mix:.35},
  {name:'8-Track',detail:'Cartridge · narrow mono band, heavy drift',hp:130,lp:4200,shelf:0,drive:2.4,wow:[.003,.42],flut:[.00008,8.5],hiss:.045,crackle:0,rumble:0,bits:16,width:.5,mix:.35},
  {name:'Reel to Reel',detail:'Studio deck · head bump, tape compression',hp:30,lp:15000,shelf:4,drive:1.2,wow:[.0004,.5],flut:[.00002,5],hiss:.01,crackle:0,rumble:0,bits:16,width:0,mix:.35},
  {name:'SP-1200',detail:'12-bit · 26 kHz sampler crunch',hp:40,lp:10500,shelf:1,drive:.9,wow:[0,.5],flut:[0,5],hiss:.006,crackle:0,rumble:0,bits:12,sr:26040,width:0,mix:.35}
 ],
 slow:[
  {name:'Dying Reel',detail:'Deep sag and catch-up swoop · fading motor',mode:1,beats:8,knobs:[60,45,100],mix:.9},
  {name:'Tape Stop',detail:'Brake, stall, spool up, jump to live',mode:2,beats:8,knobs:[85,25,100],mix:1},
  {name:'Warble Garden',detail:'Seasick shimmer · slow and fast wow together',mode:3,beats:8,knobs:[55,35,100],mix:.85},
  {name:'Octave Sink',detail:'Pitch sinks toward an octave · living wobble',mode:4,beats:8,knobs:[100,30,100],mix:.6},
  {name:'Fifth Rise',detail:'Pitch breathes upward, third to fifth',mode:5,beats:8,knobs:[70,25,100],mix:.5},
  {name:'Tape Eater',detail:'Random slumps, chewed flutter, dropouts',mode:6,beats:8,knobs:[70,70,100],mix:.9}
 ],
 eq3:[
  {name:'Ambient',detail:'Warm lows, mud cleared at 350 Hz, open airy top',lowF:110,midF:350,midQ:.8,highF:9000,knobs:[1,-2.5,3],mix:1},
  {name:'Electronic',detail:'Tight sub punch, scooped mids, bright 8 kHz sheen',lowF:80,midF:600,midQ:.9,highF:8000,knobs:[3.5,-3,3],mix:1},
  {name:'Hip-Hop',detail:'Heavy 75 Hz weight, cut boxiness, forward highs',lowF:75,midF:400,midQ:.9,highF:5500,knobs:[4.5,-2.5,2],mix:1},
  {name:'Classical',detail:'Natural balance: rumble trimmed, gentle presence and air',lowF:80,midF:3000,midQ:.6,highF:12000,knobs:[-1,.8,1.5],mix:1}
 ],
 clip:[
  {name:'Transparent',detail:'Safety clip · light 2:1 control, almost invisible',comp:{thr:-18,knee:12,ratio:2,atk:.02,rel:.25},drive:1,knobs:[85,0],mix:1},
  {name:'Warm glue',detail:'Soft knee 3:1 · gentle saturation on the peaks',comp:{thr:-24,knee:20,ratio:3,atk:.03,rel:.2},drive:1.5,knobs:[70,-1],mix:1},
  {name:'Loud master',detail:'4:1 + soft clip · dense, competitive level',comp:{thr:-20,knee:6,ratio:4,atk:.01,rel:.12},drive:2.2,knobs:[55,-2.5],mix:1},
  {name:'Hard ceiling',detail:'6:1 fast limiter feel · flat-topped waves',comp:{thr:-14,knee:0,ratio:6,atk:.003,rel:.08},drive:3,knobs:[40,-3.5],mix:1},
  {name:'Crushed',detail:'8:1 · heavy clipping for drums and noise',comp:{thr:-30,knee:3,ratio:8,atk:.002,rel:.06},drive:4.5,knobs:[25,-5],mix:1}
 ]
};
const fxKnobs={
 slow:[{label:'AMOUNT',min:0,max:100,step:1,def:60,unit:'%'},{label:'AGE',min:0,max:100,step:1,def:40,unit:'%'},{label:'TIME',min:25,max:200,step:5,def:100,unit:'%'}],
 eq3:[{label:'LOW',min:-12,max:12,step:.5,def:0,unit:' dB'},{label:'MID',min:-12,max:12,step:.5,def:0,unit:' dB'},{label:'HIGH',min:-12,max:12,step:.5,def:0,unit:' dB'}],
 clip:[{label:'THRESHOLD',min:10,max:100,step:1,def:100,unit:'%'},{label:'POST GAIN',min:-12,max:6,step:.5,def:0,unit:' dB'}]
};
const effectState=Object.fromEntries(Object.keys(fxPresets).map(k=>[k,{preset:-1,mix:0}]));
for(const k of Object.keys(fxKnobs))effectState[k].knobs=fxKnobs[k].map(x=>x.def);
// Processing order (the user can reorder it). Everything that builds or wires a rack reads this list.
const fxOrder=Object.keys(fxPresets);
// Per-track sends: trackSends[track][effect] is 0..100, effects in the fixed order of fxPresets (not fxOrder).
const sendKeys=Object.keys(fxPresets);
const trackSends=Array.from({length:4},()=>Array(sendKeys.length).fill(0));
const validSends=x=>x===undefined||(Array.isArray(x)&&x.length===4&&x.every(r=>Array.isArray(r)&&r.length===sendKeys.length&&r.every(n=>Number.isFinite(n)&&n>=0&&n<=100)));
let effectsReady=null,selectedSource=0;
const validFxOrder=o=>Array.isArray(o)&&o.length===fxOrder.length&&fxOrder.every(k=>o.includes(k));
function validPerformance(s){return (s.order===undefined||validFxOrder(s.order))&&validSends(s.sends)&&(!s.levels||(Array.isArray(s.levels)&&s.levels.length===4&&s.levels.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))&&(!s.effects||(Object.keys(s.effects).every(k=>fxPresets[k]&&Number.isInteger(s.effects[k].preset)&&s.effects[k].preset>=-1&&s.effects[k].preset<fxPresets[k].length&&Number.isFinite(s.effects[k].mix)&&s.effects[k].mix>=0&&s.effects[k].mix<=1&&(s.effects[k].knobs===undefined||(fxKnobs[k]&&Array.isArray(s.effects[k].knobs)&&s.effects[k].knobs.length===fxKnobs[k].length&&s.effects[k].knobs.every((n,i)=>Number.isFinite(n)&&n>=fxKnobs[k][i].min&&n<=fxKnobs[k][i].max))))))}
function performanceData(){return {order:[...fxOrder],sends:trackSends.map(r=>[...r]),levels:[...trackLevels],effects:Object.fromEntries(Object.entries(effectState).map(([k,v])=>[k,{...v,...(v.knobs?{knobs:[...v.knobs]}:{})}]))}}
function restorePerformance(s){if(!validPerformance(s))return;if(s.order&&s.order.some((k,i)=>k!==fxOrder[i])){fxOrder.splice(0,fxOrder.length,...s.order);fxApplyOrder()}for(let i=0;i<4;i++){trackLevels[i]=s.levels?.[i]??1;for(let j=0;j<sendKeys.length;j++)trackSends[i][j]=s.sends?.[i]?.[j]??0}for(const k of Object.keys(effectState)){Object.assign(effectState[k],s.effects?.[k]||{preset:-1,mix:0});if(fxKnobs[k]){const kn=s.effects?.[k]?.knobs;effectState[k].knobs=Array.isArray(kn)?[...kn]:fxKnobs[k].map(x=>x.def)}}renderTrackMixer();renderEffects();if(audio?.rack){for(const k of Object.keys(effectState))applyEffect(k);applySends()}}
function glide(param,value,time,tau=.05){if(!param)return;if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);else param.cancelScheduledValues(time);param.setTargetAtTime(value,time,tau)}
function effectSlot(a){const input=a.createGain(),output=a.createGain(),dry=a.createGain(),wet=a.createGain();dry.gain.value=1;wet.gain.value=0;input.connect(dry);dry.connect(output);wet.connect(output);return{input,output,dry,wet,processor:null}}
// `only` limits the rack to the listed effects (used for the per-stem export racks); omit it for the full master rack.
function createEffectsRack(a,destination,only){const input=a.createGain(),slots={};let previous=input;for(const key of fxOrder.filter(k=>!only||only.includes(k))){const s=effectSlot(a);slots[key]=s;previous.connect(s.input);previous=s.output;}const out=a.createGain();previous.connect(out);out.connect(destination);
 if(slots.delay){const d=slots.delay;d.left=a.createDelay(4);d.right=a.createDelay(4);d.fl=a.createBiquadFilter();d.fr=a.createBiquadFilter();d.fl.type=d.fr.type='lowpass';d.fbL=a.createGain();d.fbR=a.createGain();d.fbL.gain.value=d.fbR.gain.value=0;d.split=a.createChannelSplitter(2);d.merge=a.createChannelMerger(2);d.input.connect(d.split);d.split.connect(d.left,0);d.split.connect(d.right,1);d.left.connect(d.fl);d.right.connect(d.fr);d.fl.connect(d.fbL);d.fr.connect(d.fbR);d.fbL.connect(d.right);d.fbR.connect(d.left);d.fl.connect(d.merge,0,0);d.fr.connect(d.merge,0,1);d.merge.connect(d.wet);}
 if(slots.reverb){const r=slots.reverb;r.pre=a.createDelay(.2);r.convolver=a.createConvolver();r.convolverB=a.createConvolver();r.convA=a.createGain();r.convB=a.createGain();r.convA.gain.value=1;r.convB.gain.value=0;r.activeBank=0;r.tone=a.createBiquadFilter();r.tone.frequency.value=7800;r.input.connect(r.pre);r.pre.connect(r.convolver);r.pre.connect(r.convolverB);r.convolver.connect(r.convA);r.convolverB.connect(r.convB);r.convA.connect(r.tone);r.convB.connect(r.tone);r.tone.connect(r.wet);}
 if(slots.cutoffLfo){const f=slots.cutoffLfo;f.filter=a.createBiquadFilter();f.filter.frequency.value=19000;f.lfo=a.createOscillator();f.depth=a.createGain();f.depth.gain.value=0;f.lfo.frequency.value=.1;f.lfo.connect(f.depth);f.depth.connect(f.filter.frequency);f.input.connect(f.filter);f.filter.connect(f.wet);f.lfo.start();}

 if(slots.media){const m=slots.media;m.hp=a.createBiquadFilter();m.hp.type='highpass';m.hp.frequency.value=20;m.shelf=a.createBiquadFilter();m.shelf.type='lowshelf';m.shelf.frequency.value=90;m.sat=a.createWaveShaper();m.sat.oversample='2x';
 m.wow=a.createDelay(.05);m.wow.delayTime.value=.02;m.wowO=a.createOscillator();m.wowD=a.createGain();m.flutO=a.createOscillator();m.flutD=a.createGain();m.wowD.gain.value=m.flutD.gain.value=0;m.wowO.frequency.value=.5;m.flutO.frequency.value=6;m.wowO.connect(m.wowD);m.wowD.connect(m.wow.delayTime);m.flutO.connect(m.flutD);m.flutD.connect(m.wow.delayTime);m.wowO.start();m.flutO.start();
 m.crushIn=a.createGain();m.crushOut=a.createGain();m.crushIn.connect(m.crushOut);m.crush=null;
 m.lp=a.createBiquadFilter();m.lp.type='lowpass';m.lp.frequency.value=20000;m.lp.Q.value=.5;
 m.split=a.createChannelSplitter(2);m.merge=a.createChannelMerger(2);m.ll=a.createGain();m.lr=a.createGain();m.rl=a.createGain();m.rr=a.createGain();m.ll.gain.value=m.rr.gain.value=1;m.lr.gain.value=m.rl.gain.value=0;
 m.input.connect(m.hp);m.hp.connect(m.shelf);m.shelf.connect(m.sat);m.sat.connect(m.wow);m.wow.connect(m.crushIn);m.crushOut.connect(m.lp);m.lp.connect(m.split);
 m.split.connect(m.ll,0);m.split.connect(m.lr,0);m.split.connect(m.rl,1);m.split.connect(m.rr,1);m.ll.connect(m.merge,0,0);m.rl.connect(m.merge,0,0);m.lr.connect(m.merge,0,1);m.rr.connect(m.merge,0,1);m.merge.connect(m.wet);
 // noise bed: tape hiss, vinyl rumble and surface crackle. Gains stay at 0 until a preset asks for them.
 const sr=a.sampleRate,wl=sr*3,wb=a.createBuffer(2,wl,sr);let ns=7919;const rnd=()=>{ns=(Math.imul(ns,1664525)+1013904223)>>>0;return ns/4294967296};for(let c=0;c<2;c++){const d=wb.getChannelData(c);for(let i=0;i<wl;i++)d[i]=rnd()*2-1}
 m.noise=a.createBufferSource();m.noise.buffer=wb;m.noise.loop=true;m.hissHP=a.createBiquadFilter();m.hissHP.type='highpass';m.hissHP.frequency.value=1800;m.hissG=a.createGain();m.rumbleLP=a.createBiquadFilter();m.rumbleLP.type='lowpass';m.rumbleLP.frequency.value=55;m.rumbleG=a.createGain();m.hissG.gain.value=m.rumbleG.gain.value=0;
 m.noise.connect(m.hissHP);m.hissHP.connect(m.hissG);m.hissG.connect(m.wet);m.noise.connect(m.rumbleLP);m.rumbleLP.connect(m.rumbleG);m.rumbleG.connect(m.wet);m.noise.start();
 const cl=sr*6,cb=a.createBuffer(2,cl,sr);for(let c=0;c<2;c++){const d=cb.getChannelData(c);for(let i=0;i<cl;i++){d[i]=(rnd()*2-1)*.006;if(rnd()<7/sr){const amp=(.25+rnd()*.75)*(rnd()<.5?-1:1),len=Math.floor(sr*(.0008+rnd()*.003));for(let j=0;j<len&&i+j<cl;j++)d[i+j]+=amp*Math.exp(-j/(len*.35))*(j%2?-.6:1)}else if(rnd()<45/sr)d[i]+=(rnd()*2-1)*.14}}
 m.crack=a.createBufferSource();m.crack.buffer=cb;m.crack.loop=true;m.crackG=a.createGain();m.crackG.gain.value=0;m.crack.connect(m.crackG);m.crackG.connect(m.wet);m.crack.start();}

 if(slots.slow){const z=slots.slow;z.proc=null;z.pre=a.createGain();z.hp=a.createBiquadFilter();z.hp.type='highpass';z.hp.frequency.value=28;z.sat=a.createWaveShaper();z.sat.oversample='2x';z.lp=a.createBiquadFilter();z.lp.type='lowpass';z.lp.frequency.value=18000;z.lp.Q.value=.6;
 z.input.connect(z.pre);z.pre.connect(z.hp);z.hp.connect(z.sat);z.sat.connect(z.lp);z.lp.connect(z.wet);
 {const sr=a.sampleRate,nb=a.createBuffer(2,sr*2,sr);let ns=104729;for(let c=0;c<2;c++){const dd=nb.getChannelData(c);for(let i=0;i<dd.length;i++){ns=(Math.imul(ns,1664525)+1013904223)>>>0;dd[i]=ns/2147483648-1}}
  z.noise=a.createBufferSource();z.noise.buffer=nb;z.noise.loop=true;z.nf=a.createBiquadFilter();z.nf.type='bandpass';z.nf.frequency.value=4200;z.nf.Q.value=.5;z.hiss=a.createGain();z.hiss.gain.value=0;z.noise.connect(z.nf);z.nf.connect(z.hiss);z.hiss.connect(z.wet);z.noise.start()}}
 if(slots.eq3){const q=slots.eq3;q.lo=a.createBiquadFilter();q.lo.type='lowshelf';q.mid=a.createBiquadFilter();q.mid.type='peaking';q.hi=a.createBiquadFilter();q.hi.type='highshelf';q.lo.frequency.value=100;q.mid.frequency.value=1000;q.hi.frequency.value=8000;q.input.connect(q.lo);q.lo.connect(q.mid);q.mid.connect(q.hi);q.hi.connect(q.wet);}
 if(slots.clip){const c=slots.clip;c.comp=a.createDynamicsCompressor();c.pre=a.createGain();c.shaper=a.createWaveShaper();c.shaper.oversample='4x';c.post=a.createGain();c.input.connect(c.comp);c.comp.connect(c.pre);c.pre.connect(c.shaper);c.shaper.connect(c.post);c.post.connect(c.wet);c.pre.gain.value=1/3;}
 return {input,out,slots,lastBpm:0,lastRandomBeat:-1};}
// Re-run the chain in the current order. Callers duck rack.out first so the swap is silent.
function rewireRack(rack){const keys=fxOrder.filter(k=>rack.slots[k]);try{rack.input.disconnect()}catch{}for(const k of keys)try{rack.slots[k].output.disconnect()}catch{}let prev=rack.input;for(const k of keys){prev.connect(rack.slots[k].input);prev=rack.slots[k].output}prev.connect(rack.out)}
let fxOrderTimer=0;
function fxApplyOrder(){const rack=audio?.rack;if(!rack)return;clearTimeout(fxOrderTimer);const o=rack.out.gain,t=audio.a.currentTime;o.cancelScheduledValues(t);o.setValueAtTime(o.value,t);o.linearRampToValueAtTime(0,t+.03);fxOrderTimer=setTimeout(()=>{rewireRack(rack);const t2=audio.a.currentTime;o.cancelScheduledValues(t2);o.setValueAtTime(0,t2);o.linearRampToValueAtTime(1,t2+.07)},45)}
async function initializeEffects(){if(!audio?.rack)return;if(!effectsReady)effectsReady=(async()=>{try{await audio.a.audioWorklet.addModule('./granular-fx.js');const slot=audio.rack.slots.granular;slot.processor=new AudioWorkletNode(audio.a,'continuum-granular',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});slot.input.connect(slot.processor);slot.processor.connect(slot.wet);slot.processor.onprocessorerror=()=>{effectState.granular.preset=-1;applyEffect('granular');renderEffects();message('Granular stopped')};}catch{effectState.granular.preset=-1;message('Granular unavailable')}try{await audio.a.audioWorklet.addModule('./lofi-fx.js');const m=audio.rack.slots.media;m.crush=new AudioWorkletNode(audio.a,'continuum-crush',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});m.crushIn.disconnect(m.crushOut);m.crushIn.connect(m.crush);m.crush.connect(m.crushOut)}catch{}try{await audio.a.audioWorklet.addModule('./slow-fx.js');const z=audio.rack.slots.slow;z.proc=new AudioWorkletNode(audio.a,'continuum-slow',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});z.proc.port.onmessage=e=>{z.sp=e.data.s;z.drop=e.data.e};z.input.disconnect(z.pre);z.input.connect(z.proc);z.proc.connect(z.pre)}catch{}for(const k of Object.keys(effectState))applyEffect(k);applySends();renderEffects()})();await effectsReady;}
// Export: worklets for a per-stem rack (modules are already loaded by initializeEffects).
function attachStemWorklets(rack){const a=audio.a,S=rack.slots;
 try{if(S.granular){const g=S.granular;g.processor=new AudioWorkletNode(a,'continuum-granular',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});g.input.connect(g.processor);g.processor.connect(g.wet)}}catch{}
 try{if(S.media){const m=S.media;m.crush=new AudioWorkletNode(a,'continuum-crush',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});m.crushIn.disconnect(m.crushOut);m.crushIn.connect(m.crush);m.crush.connect(m.crushOut)}}catch{}
 try{if(S.slow){const z=S.slow;z.proc=new AudioWorkletNode(a,'continuum-slow',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});z.input.disconnect(z.pre);z.input.connect(z.proc);z.proc.connect(z.pre)}}catch{}}
function disposeRack(rack){for(const s of Object.values(rack.slots))for(const n of Object.values(s)){if(!n||typeof n!=='object')continue;try{if(n.stop)n.stop()}catch{}try{if(n.disconnect)n.disconnect()}catch{}try{if(n.port)n.port.close()}catch{}}try{rack.input.disconnect()}catch{}try{rack.out.disconnect()}catch{}}
function makeImpulse(a,p){const sr=a.sampleRate,length=Math.ceil(sr*p.decay),b=a.createBuffer(2,length,sr);let seed=24809;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};for(let c=0;c<2;c++){const data=b.getChannelData(c);let smooth=0;for(let i=0;i<length;i++){const t=i/length,n=random()*2-1;let env=Math.pow(1-t,p.style===2?2.8:p.style===1?2:3.5);smooth=smooth*.75+n*.25;let v=p.style===1?n:smooth;if(p.style===3)env=Math.sin(Math.PI*Math.min(1,t*1.4))*(t<.82?1:Math.max(0,(1-t)/.18));if(p.style===4){v=n*(random()<.035?3:0)+Math.sin(i/sr*2*Math.PI*(c?173:137))*.06;env=Math.pow(1-t,2.5)}data[i]=v*env*.45;}if(p.style===0){for(const seconds of [.017,.029,.043,.061]){const j=Math.floor((seconds+c*.003)*sr);if(j<length)data[j]+=.55}}}return b;}
// ── Per-track sends ─────────────────────────────────────────────────────────────────────────────
// Each effect gets ONE extra shared instance (a "send bus", 100% wet) fed by four per-track send gains and summed into the
// master bus after the series chain. Everything is built lazily the first time a send is raised above 0 and wired once:
// afterwards only gain values move (smoothed), so no click is possible from graph edits. With every send at 0 nothing exists
// and the signal path is identical to a build without sends.
const sendRacks={};
const sendGainOf=v=>Math.pow(v/100,1.6);
const sendActive=k=>{const j=sendKeys.indexOf(k);return j>=0&&trackSends.some(r=>r[j]>0)};
function ensureSendBus(k){
 let o=sendRacks[k];if(o)return o;
 const a=audio.a,sum=a.createGain(),ret=a.createGain();ret.gain.value=0;
 const rack=createEffectsRack(a,ret,[k]);attachStemWorklets(rack);sum.connect(rack.input);
 o=sendRacks[k]={rack,sum,ret,on:false,timer:0,gains:[null,null,null,null]};
 applyEffect(k,rack,true);return o}
function applySends(onlyTrack,onlyFx){
 if(!audio?.rack||!audio.routes?.length)return;const a=audio.a,t=a.currentTime;
 for(let j=0;j<sendKeys.length;j++){if(onlyFx!==undefined&&j!==onlyFx)continue;
  const k=sendKeys[j],active=sendActive(k);let o=sendRacks[k];
  if(!active&&!o)continue;
  if(active)o=ensureSendBus(k);
  for(let i=0;i<4;i++){if(onlyTrack!==undefined&&i!==onlyTrack)continue;
   const v=trackSends[i][j];let g=o.gains[i];
   if(!g){if(v<=0)continue;g=o.gains[i]=a.createGain();g.gain.value=0;audio.routes[i].pan.connect(g);g.connect(o.sum)}
   glide(g.gain,sendGainOf(v),t,.035)}
  // Effects with their own noise bed (Lo-Fi hiss/crackle, tape hiss) scale that bed with the loudest send, so a quiet send is quiet.
  if(k==='media'||k==='slow'){const m=Math.max(...trackSends.map(r=>sendGainOf(r[j])));if(Math.abs(m-(o.rack.bed||0))>.002){o.rack.bed=m;applyEffect(k,o.rack,true)}}
  if(active){clearTimeout(o.timer);o.timer=0;
   if(!o.on){o.on=true;o.ret.connect(audio.bus)}glide(o.ret.gain,1,t,.03)}
  else if(o.on&&!o.timer){
   // Everything is at 0: let the effect ring out, fade it, then disconnect so an idle bus costs no CPU.
   o.timer=setTimeout(()=>{o.timer=0;if(sendActive(k)||!o.on)return;glide(o.ret.gain,0,audio.a.currentTime,.06);o.timer=setTimeout(()=>{o.timer=0;if(!sendActive(k)&&o.on){try{o.ret.disconnect()}catch{}o.on=false}},700)},8000)}
 }
}
function setSend(i,j,v){trackSends[i][j]=v;applySends(i,j)}
function applyEffect(key,rack,send){rack=rack||audio?.rack;if(!rack)return;const s=rack.slots[key];if(!s)return;const v=effectState[key],p=fxPresets[key][v.preset],t=audio.a.currentTime;const mix=p?(send?1:v.mix):0,bs=send?(rack.bed||0):1;glide(s.dry.gain,send?0:1-mix,t);glide(s.wet.gain,mix,t);if(key==='granular'){if(s.processor)glide(s.processor.parameters.get('mode'),p?.mode||0,t,.001);return}
 if(key==='delay'){glide(s.fbL.gain,p?.feedback||0,t,.1);glide(s.fbR.gain,p?.feedback||0,t,.1);if(p){glide(s.fl.frequency,p.tone,t);glide(s.fr.frequency,p.tone,t);}rack.lastBpm=0;}
 if(key==='reverb'&&p){if(s.preset!==v.preset){const next=s.activeBank===0?1:0;(next?s.convolverB:s.convolver).buffer=makeImpulse(audio.a,p);glide(s.convA.gain,next===0?1:0,t,.08);glide(s.convB.gain,next===1?1:0,t,.08);s.activeBank=next;s.preset=v.preset;}glide(s.pre.delayTime,p.pre,t);glide(s.tone.frequency,p.style===4?3600:p.style===1?9500:6400,t);}
 if(key==='cutoffLfo'){if(p){s.filter.type=p.type;glide(s.filter.frequency,p.hz,t,.12);glide(s.filter.Q,p.q,t);if(p.wave!=='random')s.lfo.type=p.wave;glide(s.depth.gain,p.wave==='random'?0:p.depth,t,.15);}else glide(s.depth.gain,0,t);rack.lastBpm=0;}
 if(key==='media'){const g=(par,val,tau)=>glide(par,val,t,tau||.1);
  if(p){g(s.hp.frequency,p.hp);g(s.lp.frequency,p.lp);g(s.shelf.gain,p.shelf);s.sat.curve=satCurve(p.drive);g(s.wowD.gain,p.wow[0],.15);g(s.wowO.frequency,p.wow[1],.2);g(s.flutD.gain,p.flut[0],.15);g(s.flutO.frequency,p.flut[1],.2);g(s.hissG.gain,p.hiss*bs);g(s.crackG.gain,p.crackle*bs);g(s.rumbleG.gain,p.rumble*bs);
   const c=p.width;g(s.ll.gain,1-c);g(s.rr.gain,1-c);g(s.lr.gain,c);g(s.rl.gain,c);
   if(s.crush){g(s.crush.parameters.get('bits'),p.bits,.01);g(s.crush.parameters.get('rate'),p.sr?Math.min(1,p.sr/audio.a.sampleRate):1,.01)}}
  else{g(s.wowD.gain,0);g(s.flutD.gain,0);g(s.hissG.gain,0);g(s.crackG.gain,0);g(s.rumbleG.gain,0)}}
 if(key==='slow'){const gg=(par,val,tau)=>glide(par,val,t,tau||.08);
  if(p){const k=v.knobs,age=k[2]===undefined?0:k[1]/100;if(s.proc){const pr=s.proc.parameters;pr.get('mode').value=p.mode;pr.get('amount').value=k[0]/100;pr.get('age').value=age;pr.get('period').value=Math.max(.4,p.beats*60/(audio.bpm||72)/(k[2]/100))}
   s.sat.curve=satCurve(.5+age*2.4);gg(s.lp.frequency,17500*Math.pow(1-age*.86,2.2)+1800,.15);gg(s.hiss.gain,age*age*.045*bs,.2)}
  else{if(s.proc)s.proc.parameters.get('mode').value=0;gg(s.hiss.gain,0)}}
 if(key==='eq3'){const gg=(par,val,tau)=>glide(par,val,t,tau||.06);
  if(p){const k=v.knobs;gg(s.lo.frequency,p.lowF);gg(s.lo.gain,k[0]);gg(s.mid.frequency,p.midF);gg(s.mid.Q,p.midQ);gg(s.mid.gain,k[1]);gg(s.hi.frequency,p.highF);gg(s.hi.gain,k[2])}
  else{gg(s.lo.gain,0);gg(s.mid.gain,0);gg(s.hi.gain,0)}}
 if(key==='clip'){const gg=(par,val,tau)=>glide(par,val,t,tau||.06);
  if(p){const k=v.knobs,T=Math.max(.1,Math.min(1,k[0]/100)),m=p.comp;s.shaper.curve=clipCurve(T);gg(s.pre.gain,p.drive/3);gg(s.post.gain,Math.pow(10,k[1]/20));gg(s.comp.threshold,m.thr,.02);gg(s.comp.knee,m.knee,.02);gg(s.comp.ratio,m.ratio,.02);gg(s.comp.attack,m.atk,.02);gg(s.comp.release,m.rel,.02)}
  else{s.shaper.curve=null;gg(s.pre.gain,1/3);gg(s.post.gain,1)}}
 if(!send&&rack===audio.rack&&sendRacks[key])applyEffect(key,sendRacks[key].rack,true);
 updateEffectsClock();}
// Soft clipper transfer curve: linear below the threshold, tanh-rounded shoulder above it, ceiling at 1.
const clipCache={};function clipCurve(T){const key=T.toFixed(2);if(clipCache[key])return clipCache[key];const n=4097,c=new Float32Array(n);for(let i=0;i<n;i++){const u=i/(n-1)*2-1,sd=Math.abs(u*3),y=sd<=T?sd:T+(1-T)*Math.tanh((sd-T)/(1-T));c[i]=Math.sign(u)*y}clipCache[key]=c;return c}
const satCache={};function satCurve(drive){if(!drive)return null;const key=drive.toFixed(2);if(satCache[key])return satCache[key];const n=2048,c=new Float32Array(n),norm=Math.tanh(drive*1.2);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(drive*1.2*x)/norm}return satCache[key]=c}
function updateEffectsClock(){if(!audio?.rack||audio.a.state!=='running')return;for(const r of[audio.rack,...(audio.stemRacks||[])])updateRackClock(r);for(const o of Object.values(sendRacks))if(o.on)updateRackClock(o.rack)}
function updateRackClock(rack){const t=audio.a.currentTime,bpm=audio.bpm,changed=Math.abs(bpm-rack.lastBpm)>.5;
 if(changed){rack.lastBpm=bpm;const d=fxPresets.delay[effectState.delay.preset];if(d&&rack.slots.delay){glide(rack.slots.delay.left.delayTime,Math.min(3.8,60/bpm*d.division),t,.2);glide(rack.slots.delay.right.delayTime,Math.min(3.8,60/bpm*d.division*d.spread),t,.2);}const sl=fxPresets.slow[effectState.slow.preset],sz=rack.slots.slow;if(sl&&sz&&sz.proc)glide(sz.proc.parameters.get('period'),Math.max(.4,sl.beats*60/bpm/(effectState.slow.knobs[2]/100)),t,.5);const f=fxPresets.cutoffLfo[effectState.cutoffLfo.preset];if(f&&f.wave!=='random'&&rack.slots.cutoffLfo)glide(rack.slots.cutoffLfo.lfo.frequency,bpm/60/f.beats,t,.1);}
 const p=fxPresets.cutoffLfo[effectState.cutoffLfo.preset];if(p?.wave==='random'&&rack.slots.cutoffLfo){const beat=Math.floor(audio.beatPosition()/p.beats);if(beat!==rack.lastRandomBeat){rack.lastRandomBeat=beat;const r=rng((seed^Math.imul(beat,9871))>>>0);glide(rack.slots.cutoffLfo.filter.frequency,p.hz+(r()*2-1)*p.depth,t,.06);}}
}
const fxToken={},fxUI={},fxMemory={};
// Wet/dry glides on a JS clock so the slider and the sound rise together.
function fxRamp(k,from,to,ms,token,done){const t0=performance.now();const step=now=>{if(fxToken[k]!==token)return;const p=Math.min(1,(now-t0)/ms),ease=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,v=from+(to-from)*ease;effectState[k].mix=v;if(k==='media'&&effectState[k].preset>=0)fxMemory.media=v;const s=audio?.rack?.slots[k];if(s){const t=audio.a.currentTime;glide(s.dry.gain,1-v,t,.025);glide(s.wet.gain,v,t,.025)}const u=fxUI[k];if(u){u.slider.value=Math.round(v*100);u.out.textContent=Math.round(v*100)+'%'}if(p<1)requestAnimationFrame(step);else if(done)done()};requestAnimationFrame(step)}
// Preset change: fade the old sound out, swap parameters while silent, then rise from zero to the new level.
async function chooseEffect(k,index){if(!enabled)await enter();if(!enabled){renderEffects();return}if(k==='granular'&&!audio.rack?.slots.granular.processor){message('Granular unavailable');renderEffects();return}
 const token=fxToken[k]=(fxToken[k]||0)+1,st=effectState[k],s=audio.rack.slots[k],prev=st.preset;
 if(index<0){const from=st.mix;st.preset=-1;renderEffects();fxRamp(k,from,0,280,token,()=>{st.mix=0;applyEffect(k)});if(typeof saveWorkingSession==='function')saveWorkingSession();return}
 const p=fxPresets[k][index],wasOn=prev>=0&&st.mix>.001;
 st.preset=index;if(fxKnobs[k])st.knobs=[...p.knobs];st.mix=0;renderEffects();
 const t=audio.a.currentTime;glide(s.wet.gain,0,t,.035);glide(s.dry.gain,1,t,.035);if(sendRacks[k])glide(sendRacks[k].rack.slots[k].wet.gain,0,t,.035);
 // Lo-Fi Media always enters at zero and carries the user's level (never above 60%) to the next preset.
 const target=k==='media'?Math.min(fxMemory.media||0,.6):p.mix;
 setTimeout(()=>{if(fxToken[k]!==token)return;applyEffect(k);fxRamp(k,0,target,wasOn?700:520,token)},wasOn?170:30);
 if(typeof saveWorkingSession==='function')saveWorkingSession();}
const fxLabels={granular:'GRANULAR',delay:'DELAY',reverb:'REVERB',cutoffLfo:'CUTOFF + LFO',media:'LO-FI MEDIA',slow:'SLOW MACHINE',eq3:'3-BAND EQ',clip:'SOFT CLIPPER'};
const fxShort={granular:'GRAIN',delay:'ECHO',reverb:'SPACE',cutoffLfo:'FILTER',media:'MEDIA',slow:'SLOW',eq3:'EQ',clip:'CLIP'};
let fxFlip=false;
function moveEffect(key,dir){const i=fxOrder.indexOf(key),j=i+dir;if(j<0||j>=fxOrder.length)return;[fxOrder[i],fxOrder[j]]=[fxOrder[j],fxOrder[i]];fxFlip=true;renderEffects();fxApplyOrder();$('effectsControls').querySelector('[data-key="'+key+'"] .fx-mv.'+(dir<0?'up':'dn')+':not(:disabled)')?.focus({preventScroll:true});if(typeof uiBuzz==='function')uiBuzz(6);if(typeof saveWorkingSession==='function')saveWorkingSession()}
function fxArrow(key,dir,disabled){const b=document.createElement('button');b.type='button';b.className='fx-mv '+(dir<0?'up':'dn');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(dir<0?'M6 15l6-6 6 6':'M6 9l6 6 6-6')+'"/></svg>';b.setAttribute('aria-label','Move '+fxLabels[key]+(dir<0?' earlier':' later')+' in the chain');b.disabled=disabled;b.onclick=()=>moveEffect(key,dir);return b}
function renderEffects(){const root=$('effectsControls');if(!root)return;
 const before=fxFlip?new Map([...root.children].map(c=>[c.dataset.key,c.getBoundingClientRect().top])):null;
 root.replaceChildren();
 const chain=$('rackChain');if(chain)chain.innerHTML='<span>FIELD</span>'+fxOrder.map(k=>'<i></i><span>'+fxShort[k]+'</span>').join('');
 fxOrder.forEach((key,n)=>{const st=effectState[key],card=document.createElement('article');card.className='fx-card';card.dataset.key=key;card.dataset.on=st.preset>=0?'1':'0';
  const head=document.createElement('div');head.className='fx-card-head';head.innerHTML='<span class="fx-number">'+String(n+1).padStart(2,'0')+'</span><h3>'+fxLabels[key]+'</h3>';
  const sel=document.createElement('select');sel.className='fx-select';sel.setAttribute('aria-label',fxLabels[key]+' preset');[{name:'Bypass'},...fxPresets[key]].forEach((p,i)=>{const o=document.createElement('option');o.value=i-1;o.textContent=p.name;sel.append(o)});sel.value=st.preset;sel.onchange=()=>chooseEffect(key,+sel.value);head.append(sel);
  const viz=document.createElement('canvas');viz.className='fx-viz';viz.dataset.key=key;viz.setAttribute('role','img');viz.setAttribute('aria-label',fxLabels[key]+' live display');
  const detail=document.createElement('p');detail.className='preset-detail';detail.textContent=fxPresets[key][st.preset]?.detail||'Original signal passes through.';
  const label=document.createElement('label');label.className='fx-mix';label.textContent='DRY / WET';const out=document.createElement('output');out.textContent=Math.round(st.mix*100)+'%';
  const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=Math.round(st.mix*100);slider.disabled=st.preset<0;slider.setAttribute('aria-label',fxLabels[key]+' effect mix');
  slider.oninput=()=>{fxToken[key]=(fxToken[key]||0)+1;effectState[key].mix=+slider.value/100;if(key==='media')fxMemory.media=effectState[key].mix;out.textContent=slider.value+'%';const s=audio?.rack?.slots[key];if(s){glide(s.dry.gain,1-effectState[key].mix,audio.a.currentTime);glide(s.wet.gain,effectState[key].mix,audio.a.currentTime)}};
  label.append(out,slider);fxUI[key]={slider,out};
  const knobEls=(fxKnobs[key]||[]).map((def,ki)=>{const kl=document.createElement('label');kl.className='fx-mix fx-knob';kl.textContent=def.label;const ko=document.createElement('output');const fmt=v=>(def.unit==='%'?Math.round(v):(v>0?'+':'')+v.toFixed(1).replace(/\.0$/,''))+def.unit;ko.textContent=fmt(st.knobs[ki]);
   const ki2=document.createElement('input');ki2.type='range';ki2.min=def.min;ki2.max=def.max;ki2.step=def.step;ki2.value=st.knobs[ki];ki2.disabled=st.preset<0;ki2.setAttribute('aria-label',fxLabels[key]+' '+def.label.toLowerCase());ki2.oninput=()=>{effectState[key].knobs[ki]=+ki2.value;ko.textContent=fmt(+ki2.value);applyEffect(key)};kl.append(ko,ki2);return kl});
  card.append(fxArrow(key,-1,n===0),head,viz,detail,...knobEls,label,fxArrow(key,1,n===fxOrder.length-1));root.append(card)});
 if(before){fxFlip=false;for(const c of root.children){const was=before.get(c.dataset.key);if(was===undefined)continue;const dy=was-c.getBoundingClientRect().top;if(Math.abs(dy)>1&&c.animate)c.animate([{transform:'translateY('+dy+'px)'},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})}}
 if(typeof fxVizScan==='function')fxVizScan();if(typeof mixSyncSends==='function')mixSyncSends()}
renderEffects();
