'use strict';
// Import queue. Encoded files wait in IndexedDB (cheap, on disk). Nothing is decoded until a track is
// loaded into one of the four sources, so queued tracks never touch playback memory or the audio thread.
(()=>{
const DB_NAME='continuum-queue-v1',STORE='items',MAX_ITEMS=24,MAX_FILE=160*1048576,MB=1048576;
const DECODED_BYTES_PER_SEC=24000*2*4;           // imports decode to 24 kHz stereo float32
const budgetMB=()=>{const dm=navigator.deviceMemory;return dm?Math.min(640,Math.max(200,dm*70)):220}; // iOS reports nothing: stay conservative
const fmtMB=b=>b>=1024*MB?(b/(1024*MB)).toFixed(1)+' GB':b>=100*MB?Math.round(b/MB)+' MB':(b/MB).toFixed(1)+' MB';
const fmtT=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
let db=null,items=[],est={quota:0,usage:0},busy=false,pending=null;
// An item counts as loaded while a source still holds that exact file.
const loadedIn=it=>[0,1,2,3].filter(i=>audioSlots[i]&&audioSlots[i].name===it.name&&audioSlots[i].file&&audioSlots[i].file.size===it.size);

const open=()=>new Promise((res,rej)=>{if(!window.indexedDB){rej(Error('no idb'));return}const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=(mode,fn)=>new Promise((res,rej)=>{const t=db.transaction(STORE,mode),st=t.objectStore(STORE),r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||Error('aborted'))});

async function refreshEstimate(){try{const e=await navigator.storage.estimate();est={quota:e.quota||0,usage:e.usage||0}}catch{}}
const liveBytes=()=>audioSlots.reduce((n,t)=>n+(t&&t.ready?t.seconds*DECODED_BYTES_PER_SEC:0),0);
const slotBytes=i=>{const t=audioSlots[i];return t&&t.ready?t.seconds*DECODED_BYTES_PER_SEC:0};

function meter(label,frac,value,warn){
  const row=document.createElement('div');row.className='q-meter'+(warn?' warn':'');
  const l=document.createElement('span');l.className='micro';l.textContent=label;
  const bar=document.createElement('span');bar.className='q-bar';const u=document.createElement('u');u.style.width=Math.max(2,Math.min(100,frac*100))+'%';bar.append(u);
  const v=document.createElement('b');v.textContent=value;
  row.append(l,bar,v);return row;
}

function render(){
  const meters=document.getElementById('qMeters'),list=document.getElementById('qList');if(!meters||!list)return;
  const budget=budgetMB()*MB,live=liveBytes(),free=Math.max(0,est.quota-est.usage),qBytes=items.reduce((n,i)=>n+i.size,0);
  meters.replaceChildren(
    meter('MEMORY',live/budget,fmtMB(live)+' / '+fmtMB(budget),live/budget>.8),
    meter('CACHE',est.quota?est.usage/est.quota:0,est.quota?fmtMB(free)+' free':'n/a',est.quota&&est.usage/est.quota>.85)
  );
  document.getElementById('qCount').textContent=items.length+' / '+MAX_ITEMS+(items.length?' · '+fmtMB(qBytes):'');
  list.replaceChildren();
  if(!items.length){const e=document.createElement('p');e.className='q-empty';e.textContent='Queue is empty';list.append(e)}
  items.forEach(it=>{
    const inSlots=loadedIn(it),isPending=pending&&pending.id===it.id,row=document.createElement('article');row.className='q-item'+(inSlots.length?' loaded':'')+(isPending?' loading':'');
    if(inSlots.length)row.style.setProperty('--lc',palettes[inSlots[0]]);
    const head=document.createElement('div');head.className='q-head';
    const name=document.createElement('b');name.textContent=it.name.replace(/\.[^.]+$/,'');name.title=it.name;
    const meta=document.createElement('span');meta.className='micro';meta.textContent=(it.seconds?fmtT(it.seconds)+' · ':'')+fmtMB(it.size);
    const del=document.createElement('button');del.type='button';del.className='q-del';del.setAttribute('aria-label','Remove '+it.name);del.textContent='×';del.onclick=()=>remove(it.id);
    let tagged=false;if(inSlots.length||isPending){const tag=document.createElement('span');tag.className='q-tag';tag.textContent=isPending?'LOADING':'LIVE · '+(inSlots.map(i=>String(i+1).padStart(2,'0')).join(' '));head.dataset.tag=tag.textContent;head.append(name,meta,del);head.insertBefore(tag,meta)}
    else head.append(name,meta,del);
    const slots=document.createElement('div');slots.className='q-slots';
    const to=document.createElement('span');to.className='micro';to.textContent='LOAD';slots.append(to);
    for(let i=0;i<4;i++){const b=document.createElement('button');b.type='button';b.className='q-slot'+(inSlots.includes(i)?' on':'');b.type='button';b.style.setProperty('--c',palettes[i]);b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label','Load into source '+(i+1));b.disabled=busy||importBusy;b.onclick=()=>load(it,i);slots.append(b)}
    row.append(head,slots);list.append(row);
  });
  document.getElementById('qAdd').disabled=busy||items.length>=MAX_ITEMS;
}

async function reload(){try{items=(await tx('readonly',s=>s.getAll())).map(({id,name,size,seconds,added})=>({id,name,size,seconds,added})).sort((a,b)=>b.added-a.added)}catch{items=[]}await refreshEstimate();render()}

function duration(file){return new Promise(res=>{const a=new Audio(),url=URL.createObjectURL(file);const done=v=>{URL.revokeObjectURL(url);res(v)};a.preload='metadata';a.onloadedmetadata=()=>done(isFinite(a.duration)?a.duration:0);a.onerror=()=>done(0);setTimeout(()=>done(0),4000);a.src=url})}

async function add(files){
  if(busy||!files.length)return;if(!db){message('Storage unavailable');return}
  busy=true;render();let ok=0,skipped=0;
  try{
    try{navigator.storage&&navigator.storage.persist&&await navigator.storage.persist()}catch{}
    for(const f of Array.from(files)){
      await refreshEstimate();
      const free=est.quota-est.usage;
      if(items.length+ok>=MAX_ITEMS||f.size>MAX_FILE||(est.quota&&f.size*1.15>free-20*MB)){skipped++;continue}
      document.getElementById('qCount').textContent='Adding '+(ok+skipped+1)+' / '+files.length;
      const seconds=await duration(f);
      if(seconds&&(seconds<2||seconds>480)){skipped++;continue}
      const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());
      await tx('readwrite',s=>s.put({id,name:f.name,size:f.size,seconds,added:Date.now()+ok,blob:f}));ok++;
    }
  }catch{skipped++}
  busy=false;document.getElementById('qFiles').value='';await reload();
  message(ok?ok+' queued'+(skipped?' · '+skipped+' skipped':''):skipped?'Skipped · size, length or cache limit':'Nothing added');
}
async function remove(id){try{await tx('readwrite',s=>s.delete(id))}catch{}await reload()}

async function load(it,i){
  if(busy||importBusy)return;
  const budget=budgetMB()*MB,next=liveBytes()-slotBytes(i)+(it.seconds||0)*DECODED_BYTES_PER_SEC;
  if(next>budget){message('Over memory · free '+Math.ceil((next-budget)/MB)+' MB first');if(navigator.vibrate)navigator.vibrate(30);return}
  let rec;try{rec=await tx('readonly',s=>s.get(it.id))}catch{}
  if(!rec){message('Not found');await reload();return}
  const file=new File([rec.blob],it.name,{type:rec.blob.type||'audio/mpeg'});
  pending={id:it.id,i};render();
  try{await importFiles([file],i)}finally{pending=null;render()}
}

// Keep the meters honest whenever sources change, and re-skin the source cards with colour swatches.
const baseRender=renderAudioSlots;
renderAudioSlots=function(){baseRender();
  document.querySelectorAll('#audioSlots .audio-slot').forEach((card,i)=>{const h=card.querySelector('h3');if(h&&typeof uiSwatches==='function')h.after(uiSwatches(i))});
  render()};

document.getElementById('qAdd').onclick=()=>document.getElementById('qFiles').click();
document.getElementById('qFiles').onchange=e=>add(e.target.files);
open().then(d=>{db=d;return reload()}).catch(()=>{render()});
setInterval(()=>{if(document.querySelector('.view[data-view=src].active')||matchMedia('(min-width:1024px)').matches)render()},4000);
renderAudioSlots();
})();
