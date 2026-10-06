'use strict';
// Working state is separate from saved compositions; audio remains in IndexedDB.
const workingSessionKey='continuum-working-session-v1';
let sessionRestored=false,sessionStorageWarned=false;
function saveWorkingSession(){
 if(!sessionRestored)return;
 try{localStorage.setItem(workingSessionKey,JSON.stringify({version:1,seed,...(typeof performanceData==='function'?performanceData():{}),nodes:nodes.map(n=>({...n})),path:path.length>1?path.map(p=>({...p})):[],point:{...point},progress,journeyBeats,duration:+$('duration').value,scene:{...transitionSettings},audioMode,volume:+$('volume').value,muted}));}
 catch{if(!sessionStorageWarned){sessionStorageWarned=true;message('Working session could not be saved in this browser. Export saved journeys to keep a copy.')}}
}
function restoreWorkingSession(){
 let restored=false;
 try{
 const s=JSON.parse(localStorage.getItem(workingSessionKey)||'null');
 const coords=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
 // Reuse the composition validator for nodes, settings and bounded route data.
 if(s&&Array.isArray(s.path)&&validSnapshot({...s,id:'working',created:'working',audio:undefined,path:s.path.length?s.path:[{x:0,y:0},{x:1,y:1}]})&&coords(s.point)&&Number.isFinite(s.progress)&&s.progress>=0&&s.progress<=1&&Number.isFinite(s.journeyBeats)&&s.journeyBeats>=0&&s.journeyBeats<=1500){
 playing=false;drawing=false;seed=s.seed;nodes=s.nodes.map(n=>({...n}));path=s.path.map(p=>({...p}));point={...s.point};progress=path.length>1?s.progress:0;journeyBeats=s.journeyBeats;$('duration').value=s.duration;restoreSceneSettings(s);if(typeof restorePerformance==='function')restorePerformance(s);audioMode=s.audioMode||'match';$('audioMode').value=audioMode;
 if(Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=100)$('volume').value=s.volume;muted=s.muted===true;
 indexPath();weights=musicalMix(point);renderNodes();controls();restored=true;
 }
 }catch{}
 sessionRestored=true;
 if(restored)message('Working session restored. Initialize audio, then Play journey to continue from your saved position.');
}
// Initialize immediately: neither storage reads nor restoration need audio playback.
restoreWorkingSession();
try{if(localStorage.getItem('continuum-audio-activated-v1')==='true'){$('gate').hidden=true;$('mute').disabled=false;$('mute').textContent='Resume sound';message('Session restored. Tap Resume sound to continue.')}}catch{}
setInterval(saveWorkingSession,1500);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveWorkingSession()});
window.addEventListener('pagehide',saveWorkingSession);
document.addEventListener('change',saveWorkingSession);
document.addEventListener('pointerup',saveWorkingSession);
document.addEventListener('click',()=>queueMicrotask(saveWorkingSession));
