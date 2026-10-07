'use strict';
// CONTINUUM app shell: tab navigation, deep links, PWA registration.
(()=>{
const VIEWS=['nav','mix','fx','src','log'];
const wide=matchMedia('(min-width:1024px)');
const tabs=[...document.querySelectorAll('#tabbar [role=tab]')];
const views=[...document.querySelectorAll('.view')];
let current='nav';

function apply(v,{push=true}={}){
  if(!VIEWS.includes(v))v='nav';
  current=v;
  views.forEach(s=>{
    const on=s.dataset.view===v;
    s.classList.toggle('active',on);
    // Off-screen tabs must not be focusable or announced on phones; everything is live on wide screens.
    s.toggleAttribute('inert',!wide.matches&&!on);
  });
  tabs.forEach(t=>{const on=t.dataset.view===v;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1});
  document.body.dataset.view=v;
  window.dispatchEvent(new CustomEvent('continuum:view',{detail:v}));
  if(push){try{history.replaceState(null,'','#'+v)}catch{}try{localStorage.setItem('continuum-view-v1',v)}catch{}}
}

tabs.forEach(t=>{
  t.addEventListener('click',()=>{
    const v=t.dataset.view;
    if(v===current){const sc=document.querySelector('.view.active .scroll');if(sc)sc.scrollTo({top:0,behavior:'smooth'})}
    else{try{navigator.vibrate&&navigator.vibrate(6)}catch{}apply(v)}
  });
  t.addEventListener('keydown',e=>{
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
    const i=VIEWS.indexOf(current),n=VIEWS[(i+(e.key==='ArrowRight'?1:VIEWS.length-1))%VIEWS.length];
    apply(n);tabs.find(x=>x.dataset.view===n)?.focus();e.preventDefault();
  });
});
wide.addEventListener?.('change',()=>apply(current,{push:false}));
addEventListener('hashchange',()=>apply(location.hash.slice(1),{push:false}));

let start=location.hash.slice(1);
if(!VIEWS.includes(start)){try{start=localStorage.getItem('continuum-view-v1')||'nav'}catch{start='nav'}}
apply(start,{push:false});

// Collapsible modules (desktop / iPad layout only). Each column holds a pair; collapsing one hands its space to the other,
// expanding a collapsed one collapses its partner, and both can be collapsed.
const PAIR={mix:'src',src:'mix',fx:'log',log:'fx'},NAME={mix:'Mix',src:'Sources',fx:'Effects',log:'Journeys'};
let folded={};try{folded=JSON.parse(localStorage.getItem('continuum-folded-v1')||'{}')}catch{}
const paint=()=>{
  for(const k of Object.keys(PAIR)){
    const v=document.querySelector('.view[data-view='+k+']'),btn=v?.querySelector('.vh-toggle');if(!v)continue;
    v.classList.toggle('collapsed',!!folded[k]);
    if(btn){btn.setAttribute('aria-expanded',String(!folded[k]));btn.setAttribute('aria-label',(folded[k]?'Expand ':'Collapse ')+NAME[k])}
  }
};
const fold=k=>{
  if(folded[k]){folded[k]=false;folded[PAIR[k]]=true}else folded[k]=true;
  try{localStorage.setItem('continuum-folded-v1',JSON.stringify(folded))}catch{}
  paint();
};
for(const k of Object.keys(PAIR)){
  const head=document.querySelector('.view[data-view='+k+'] .vh');if(!head)continue;
  const b=document.createElement('button');b.type='button';b.className='vh-toggle';
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  b.onclick=()=>fold(k);head.append(b);
}
paint();

// Self-fitting nav: if the stage + controls don't fit the visible height (Safari bars, small phones, big text),
// collapse decoration in steps (t1 spectrum, t2 compact HUD/tiles, t3 captions and tiles) until the transport is on screen.
const nav=document.querySelector('.view.nav');
const dockEl=document.querySelector('.dock'),tabEl=document.getElementById('tabbar');
// Short on room if the content overflows its box OR the transport actually sits under the tab bar.
const cramped=()=>nav.scrollHeight>nav.clientHeight+1||dockEl.getBoundingClientRect().bottom>tabEl.getBoundingClientRect().top+1;
function fit(){
  const b=document.body;b.classList.remove('t1','t2','t3','t4');
  if(wide.matches||matchMedia('(orientation:landscape)').matches)return;
  for(const t of ['t1','t2','t3','t4']){
    if(!cramped())break;
    b.classList.add(t);
  }
}
if(window.ResizeObserver)new ResizeObserver(()=>fit()).observe(document.querySelector('.views'));
addEventListener('resize',fit);addEventListener('orientationchange',fit);
document.fonts&&document.fonts.ready.then(fit);
fit();

// Keep the layout glued to the visual viewport (iOS toolbars collapse and expand).
const setVH=()=>document.documentElement.style.setProperty('--vh',(window.visualViewport?.height||innerHeight)+'px');
setVH();addEventListener('resize',setVH);window.visualViewport?.addEventListener('resize',setVH);

// Block the iOS pinch-zoom gesture on the instrument only; the rest of the page keeps system zoom.
document.getElementById('stage').addEventListener('gesturestart',e=>e.preventDefault());

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
})();
