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

// Keep the layout glued to the visual viewport (iOS toolbars collapse and expand).
const setVH=()=>document.documentElement.style.setProperty('--vh',(window.visualViewport?.height||innerHeight)+'px');
setVH();addEventListener('resize',setVH);window.visualViewport?.addEventListener('resize',setVH);

// Block the iOS pinch-zoom gesture on the instrument only; the rest of the page keeps system zoom.
document.getElementById('stage').addEventListener('gesturestart',e=>e.preventDefault());

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
})();
