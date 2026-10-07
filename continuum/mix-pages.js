'use strict';
// Mix view in three horizontal pages: 1 = per-source level faders, 2 and 3 = per-source effect sends as rotary dials (0-100).
const MIX_PAGES=['LEVELS','SENDS · 1 / 2','SENDS · 2 / 2'];
let mixPageNow=0;
const mixKnobs=[];
const SVG_NS='http://www.w3.org/2000/svg';
const svgEl=(n,a,p)=>{const e=document.createElementNS(SVG_NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e};
const knobPt=(r,deg)=>{const a=deg*Math.PI/180;return[50+r*Math.sin(a),50-r*Math.cos(a)]};

// Rotary dial: 28-segment bezel + pointer. Drag up/down (or scroll, or arrow keys); drag far sideways for fine control;
// double-tap resets to 0. Visual and audio only update when the whole-number value changes.
function makeSendKnob(i,j){
 const color=palettes[i],N=28,ticks=[];
 const b=document.createElement('div');b.className='knob';b.tabIndex=0;b.setAttribute('role','slider');
 b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax','100');b.style.setProperty('--c',color);
 b.setAttribute('aria-label',worlds[i].name+' send to '+fxLabels[sendKeys[j]].toLowerCase());
 const svg=svgEl('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},b);
 for(let k=0;k<N;k++){const a=-135+270*k/(N-1),p=knobPt(35,a),q=knobPt(k%9===0?48:44,a);ticks.push(svgEl('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:color,'stroke-width':k%9===0?2.4:1.8,'stroke-opacity':.2},svg))}
 svgEl('circle',{cx:50,cy:50,r:27,fill:'#031015',stroke:color,'stroke-opacity':.45,'stroke-width':1},svg);
 svgEl('circle',{cx:50,cy:50,r:20,fill:'none',stroke:color,'stroke-opacity':.18,'stroke-width':1,'stroke-dasharray':'1.5 3'},svg);
 const needle=svgEl('g',{},svg);svgEl('line',{x1:50,y1:50,x2:50,y2:30,stroke:'#d7fbf6','stroke-width':2.4,'stroke-linecap':'round'},needle);
 svgEl('circle',{cx:50,cy:50,r:2.6,fill:color},svg);
 const cap=document.createElement('div');cap.className='cap';
 let lit=-1,v=-1;
 const draw=nv=>{
  v=nv;const l=nv>0?Math.round(nv/100*(N-1)):-1;
  if(l!==lit){const lo=Math.min(l,lit),hi=Math.max(l,lit);for(let k=Math.max(0,lo);k<=hi;k++){const on=k<=l;ticks[k].setAttribute('stroke-opacity',on?1:.2);ticks[k].style.filter=on?'drop-shadow(0 0 2px '+color+')':'none'}lit=l}
  needle.setAttribute('transform','rotate('+(-135+270*nv/100)+' 50 50)');
  cap.textContent=nv;b.setAttribute('aria-valuenow',nv);b.setAttribute('aria-valuetext',nv+' percent')};
 const commit=(nv,fromUser)=>{nv=Math.max(0,Math.min(100,Math.round(nv)));if(nv===v)return;
  if(fromUser&&(nv===0||nv===100||nv===50)&&typeof uiBuzz==='function')uiBuzz(3);
  draw(nv);trackSends[i][j]=nv;if(typeof setSend==='function')setSend(i,j,nv)};
 let drag=false,sy=0,sx=0,sv=0,fine=false,lastTap=0,moved=false;
 b.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=true;moved=false;sy=e.clientY;sx=e.clientX;sv=v;fine=false;try{b.setPointerCapture(e.pointerId)}catch{}b.classList.add('drag');e.preventDefault()});
 b.addEventListener('pointermove',e=>{if(!drag)return;
  const wantFine=Math.abs(e.clientX-sx)>80||e.shiftKey;
  if(wantFine!==fine){fine=wantFine;sy=e.clientY;sv=v}
  if(Math.abs(e.clientY-sy)>2||Math.abs(e.clientX-sx)>2)moved=true;
  commit(sv+(sy-e.clientY)*(fine?.18:.72),true)});
 const end=e=>{if(!drag)return;drag=false;b.classList.remove('drag');
  if(!moved&&e.type==='pointerup'){const now=performance.now();if(now-lastTap<320){commit(0,true);lastTap=0}else lastTap=now}};
 b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);
 b.addEventListener('wheel',e=>{e.preventDefault();commit(v-Math.sign(e.deltaY)*(e.shiftKey?1:2),true)},{passive:false});
 b.addEventListener('keydown',e=>{let d=0;
  if(e.key==='ArrowUp'||e.key==='ArrowRight')d=e.shiftKey?10:1;else if(e.key==='ArrowDown'||e.key==='ArrowLeft')d=e.shiftKey?-10:-1;
  else if(e.key==='PageUp')d=10;else if(e.key==='PageDown')d=-10;
  else if(e.key==='Home'){commit(0,true);e.preventDefault();return}else if(e.key==='End'){commit(100,true);e.preventDefault();return}
  if(d){commit(v+d,true);e.preventDefault()}});
 draw(trackSends[i][j]);
 b._i=i;b._j=j;mixKnobs.push(b);
 const cell=document.createElement('div');cell.className='cell';cell.append(b,cap);return cell;
}
// Dim dials whose effect is set to Bypass: the value is kept, and it takes effect as soon as a preset is chosen.
function mixSyncSends(){for(const b of mixKnobs){const off=effectState[sendKeys[b._j]].preset<0;b.dataset.off=off?'1':'0';b.title=off?fxLabels[sendKeys[b._j]]+' is bypassed. Choose a preset in Effects to hear this send.':''}}

function mixLevelPage(){
 const page=document.createElement('section');page.className='mp-page';page.dataset.p=0;
 for(let i=0;i<4;i++){
  const card=document.createElement('article');card.className='track-strip';card.style.setProperty('--color',palettes[i]);
  const top=document.createElement('button');top.className='source-select';top.setAttribute('aria-pressed',selectedSource===i);top.innerHTML='<span class="strip-code">SOURCE / '+String(i+1).padStart(2,'0')+'</span>';
  const title=document.createElement('strong');title.textContent=worlds[i].name;top.append(title);
  top.onclick=()=>{selectedSource=i;point={x:nodes[i].x,y:nodes[i].y};stopJourney();renderTrackMixer()};
  const line=document.createElement('label');line.className='track-fader';line.textContent='LEVEL';
  const out=document.createElement('output');out.textContent=Math.round(trackLevels[i]*100)+'%';
  const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=Math.round(trackLevels[i]*100);slider.setAttribute('aria-label',worlds[i].name+' track volume');
  slider.oninput=()=>{trackLevels[i]=+slider.value/100;out.textContent=slider.value+'%';if(audio?.routes[i]?.levelGain)glide(audio.routes[i].levelGain.gain,trackLevels[i],audio.a.currentTime)};
  line.append(out,slider);
  const meter=document.createElement('div');meter.className='strip-meter';meter.id='strip-meter-'+i;meter.setAttribute('aria-hidden','true');
  card.append(top,line,meter);page.append(card)}
 return page}
function mixSendPage(n){
 const first=(n-1)*4,count=Math.min(4,sendKeys.length-first);
 const page=document.createElement('section');page.className='mp-page';page.dataset.p=n;
 const cols=document.createElement('div');cols.className='mp-cols';cols.innerHTML='<span></span>'+Array.from({length:count},(_,k)=>'<span>'+fxShort[sendKeys[first+k]]+'</span>').join('');page.append(cols);
 for(let i=0;i<4;i++){
  const row=document.createElement('div');row.className='mp-row';row.style.setProperty('--c',palettes[i]);
  row.innerHTML='<div class="who"><small>SRC '+String(i+1).padStart(2,'0')+'</small><b></b></div>';row.querySelector('b').textContent=worlds[i].name;
  for(let k=0;k<count;k++)row.append(makeSendKnob(i,first+k));
  page.append(row)}
 const note=document.createElement('p');note.className='mp-note';
 note.textContent=n===1?'Post-fader aux sends. Level sets how much of the source reaches the master; the dial sets how much of it is processed.':'EQ and Soft Clipper are master inserts, not sends. Set them in Effects.';
 page.append(note);return page}

function renderTrackMixer(){
 const root=$('trackMixer');if(!root)return;
 mixKnobs.length=0;root.replaceChildren();
 const tabs=document.createElement('div');tabs.className='mp-tabs';tabs.setAttribute('role','tablist');
 const track=document.createElement('div');track.className='mp-track';
 MIX_PAGES.forEach((name,n)=>{const t=document.createElement('button');t.type='button';t.setAttribute('role','tab');t.textContent=n===0?'LEVEL':'SENDS '+n;t.setAttribute('aria-selected',n===mixPageNow);
  t.onclick=()=>{mixPageNow=n;paintTabs();track.scrollTo({left:n*track.clientWidth,behavior:reduced?'auto':'smooth'})};tabs.append(t)});
 track.append(mixLevelPage(),mixSendPage(1),mixSendPage(2));
 const paintTabs=()=>{[...tabs.children].forEach((t,n)=>t.setAttribute('aria-selected',n===mixPageNow));const l=$('mixPageLabel');if(l)l.textContent=MIX_PAGES[mixPageNow]};
 let raf=0;track.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const w=track.clientWidth;if(!w)return;const n=Math.max(0,Math.min(2,Math.round(track.scrollLeft/w)));if(n!==mixPageNow){mixPageNow=n;paintTabs()}})},{passive:true});
 root.append(tabs,track);paintTabs();mixSyncSends();
 if(track.clientWidth)track.scrollLeft=mixPageNow*track.clientWidth;
}
// A hidden view has no width, so put the pager back on its page when the Mix tab is shown.
window.addEventListener('continuum:view',e=>{if(e.detail!=='mix')return;const t=document.querySelector('.mp-track');if(t&&t.clientWidth)t.scrollLeft=mixPageNow*t.clientWidth});
renderTrackMixer();
