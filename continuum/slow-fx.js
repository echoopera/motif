'use strict';
// SLOW MACHINE: a varispeed tape transport. Audio is written into a 5 s ring and read back at a moving speed
// with 4-point Hermite interpolation, so slow-downs, warbles and pitch moves glide like a real capstan.
// A "servo" gently pulls the read head back to its nominal lag after every sag, which is what gives the
// organic catch-up swoop. Shift modes re-splice with a raised-cosine crossfade, and tape-stop re-syncs to live.
// Modes: 1 Dying Reel · 2 Tape Stop · 3 Warble Garden · 4 Octave Sink · 5 Fifth Rise · 6 Tape Eater
const TWO_PI=Math.PI*2;
class ContinuumSlow extends AudioWorkletProcessor{
 static get parameterDescriptors(){return[
  {name:'mode',defaultValue:0,minValue:0,maxValue:8,automationRate:'k-rate'},
  {name:'amount',defaultValue:.6,minValue:0,maxValue:1,automationRate:'k-rate'},
  {name:'age',defaultValue:.4,minValue:0,maxValue:1,automationRate:'k-rate'},
  {name:'period',defaultValue:6,minValue:.4,maxValue:90,automationRate:'k-rate'}]}
 constructor(){
  super();
  this.L=1<<18;this.mask=this.L-1;
  this.buf=[new Float32Array(this.L),new Float32Array(this.L)];
  this.w=0;this.sr=sampleRate;this.nom=Math.floor(this.sr*.04);
  this.d=[this.nom,this.nom];this.act=0;this.next=1;this.fading=false;this.fadeN=0;this.fadeTot=1;
  this.sp=1;this.t=0;this.mode=-1;this.seed=0x2f6b1a7;
  this.wp1=0;this.wp2=0;this.fp=0;this.dv=0;this.drift=0;
  this.dropEnv=1;this.dropTarget=1;this.dropHold=0;
  this.slumpLeft=0;this.slumpDur=1;this.slumpDepth=0;this.nextSlump=this.sr*1.2;
  this.forced=false;this.latch=false;
 }
 rnd(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return(this.seed>>>0)/4294967296}
 rd(b,x){const m=this.mask,i=Math.floor(x),f=x-i,ym=b[(i-1)&m],y0=b[i&m],y1=b[(i+1)&m],y2=b[(i+2)&m];
  const c1=.5*(y1-ym),c2=ym-2.5*y0+2*y1-.5*y2,c3=.5*(y2-ym)+1.5*(y0-y1);return((c3*f+c2)*f+c1)*f+y0}
 splice(dNew,sec){const h=1-this.act;this.next=h;this.d[h]=dNew;this.fading=true;this.fadeN=0;this.fadeTot=Math.max(32,Math.floor(this.sr*sec))}
 process(inputs,outputs,params){
  const out=outputs[0];if(!out||!out.length)return true;
  const inp=inputs[0]||[],in0=inp[0]||null,in1=inp[1]||in0,o0=out[0],o1=out[1]||null;
  const mode=params.mode[0]|0,a=params.amount[0],g=params.age[0],P=Math.max(.4,params.period[0]);
  const N=o0.length,sr=this.sr,mask=this.mask,b0=this.buf[0],b1=this.buf[1];
  if(mode!==this.mode){this.mode=mode;this.t=0;this.sp=1;this.fading=false;this.act=0;this.next=1;this.d[0]=this.d[1]=this.nom;this.forced=false;this.latch=false;this.slumpLeft=0;this.nextSlump=sr*1.2;this.dropEnv=1;this.dropTarget=1}
  // ── block-rate script ──
  let base=1,wowA=0,wowF=.5,wow2A=0,wow2F=.3,fluA=0,fluF=7,driftA=0,servo=.6,shift=false,maxD=3,dropRate=0;
  const t=this.t,dt=N/sr,u=(t/P)%1;
  switch(mode){
   case 1:{ // Dying Reel: deep slow sag, skewed, with ageing wobble
    const gk=-(Math.sin(TWO_PI*u)+.4*Math.sin(2*TWO_PI*u+.9))/1.25;base=1+.38*a*gk;
    wowA=.004+.012*g;wowF=.52;fluA=.0006+.002*g;fluF=7;driftA=.004+.02*g;servo=.5;dropRate=.3+3*g;break}
   case 2:{ // Tape Stop: hold, brake, stall, spool up, jump to live
    const smin=.03+.5*(1-a);servo=0;
    if(u<.5){base=1;this.latch=false}
    else if(u<.68){const x=(u-.5)/.18;base=1-(1-smin)*x*x*(3-2*x)}
    else if(u<.8){base=smin*(1+.12*Math.sin(t*23))}
    else if(u<.9){const x=(u-.8)/.1;base=smin+(1.35-smin)*x*x*(3-2*x)}
    else{base=1+.35*Math.pow(Math.max(0,1-(u-.9)/.07),2);if(!this.latch){this.latch=true;this.forced=true}}
    wowA=.003*Math.max(0,1-base);fluA=.001;dropRate=.1+g;break}
   case 3: // Warble Garden: zero-mean seasick shimmer
    wowA=.008+.03*a;wowF=.63;wow2A=.005+.02*a;wow2F=.27;fluA=.0012+.004*a;fluF=6.1;driftA=.006+.02*a;servo=.6;dropRate=.2+2*g;break;
   case 4:{ // Octave Sink: constant downward pitch shift with a living wobble
    base=Math.pow(2,-(3+9*a)/12);shift=true;maxD=.14;servo=0;wowA=.002+.004*g;wowF=.4;fluA=.0005;driftA=.003*g;dropRate=.2+1.5*g;break}
   case 5:{ // Fifth Rise: upward shift breathing between a third and a fifth-plus
    const semis=(2+5*a)*(.75+.25*Math.sin(TWO_PI*t/P));base=Math.pow(2,semis/12);shift=true;maxD=.14;servo=0;wowA=.0015+.003*g;wowF=.55;fluA=.0004;driftA=.002*g;dropRate=.2+1.5*g;break}
   case 6:{ // Tape Eater: random slumps, chewed flutter, dropouts
    servo=.9;wowA=.003+.01*g;wowF=.8;driftA=.004+.02*g;dropRate=1.5+6*g;
    if(this.slumpLeft>0){const x=1-this.slumpLeft/this.slumpDur,env=x<.2?x/.2:Math.exp(-(x-.2)*3.5);base=1-this.slumpDepth*env;fluA=.012*env;fluF=13;this.slumpLeft-=dt}
    else{this.nextSlump-=dt;if(this.nextSlump<=0){this.slumpDur=.15+.5*this.rnd();this.slumpDepth=(.2+.55*this.rnd())*(.3+.7*a);this.slumpLeft=this.slumpDur;this.nextSlump=(.6+2.6*this.rnd())*(1.35-a)}}
    break}
   default: base=1;servo=.8;
  }
  this.t+=dt;
  this.dv=this.dv*.995+(this.rnd()-.5)*.12;
  const wI1=TWO_PI*wowF/sr,wI2=TWO_PI*wow2F/sr,fI=TWO_PI*fluF/sr,kS=1-Math.exp(-1/(sr*.015)),dropP=dropRate/sr,minShift=Math.floor(sr*.03);
  for(let n=0;n<N;n++){
   const x0=in0?in0[n]:0,x1=in1?in1[n]:x0;b0[this.w]=x0;b1[this.w]=x1;
   this.wp1+=wI1;this.wp2+=wI2;this.fp+=fI;if(this.wp1>TWO_PI)this.wp1-=TWO_PI;if(this.wp2>TWO_PI)this.wp2-=TWO_PI;if(this.fp>TWO_PI)this.fp-=TWO_PI;
   this.drift+=(this.dv-this.drift)*.0005;
   const mod=wowA*Math.sin(this.wp1)+wow2A*Math.sin(this.wp2)+fluA*Math.sin(this.fp)+driftA*2.5*this.drift;
   let tg=base;
   if(servo>0){const err=(this.d[this.act]-this.nom)/sr;tg+=Math.max(-.25,Math.min(.4,err*servo))}
   tg=Math.max(.04,Math.min(2.2,tg*(1+mod)));
   this.sp+=(tg-this.sp)*kS;const s=this.sp;
   this.d[this.act]+=1-s;if(this.fading)this.d[this.next]+=1-s;
   if(!this.fading){const da=this.d[this.act];
    if(this.forced){this.splice(this.nom,.07);this.forced=false}
    else if(shift){if(s<1&&da>maxD*sr)this.splice(minShift,.08);else if(s>1&&da<minShift)this.splice(Math.floor(maxD*sr*.92),.08)}
    else if(da>sr*3||da<sr*.006)this.splice(this.nom,.08)}
   let l,r;
   if(this.fading){const p=this.fadeN/this.fadeTot,ga=.5+.5*Math.cos(Math.PI*p),gn=1-ga,xa=this.w-this.d[this.act],xn=this.w-this.d[this.next];
    l=this.rd(b0,xa)*ga+this.rd(b0,xn)*gn;r=this.rd(b1,xa)*ga+this.rd(b1,xn)*gn;
    if(++this.fadeN>=this.fadeTot){this.act=this.next;this.fading=false}}
   else{const xa=this.w-this.d[this.act];l=this.rd(b0,xa);r=this.rd(b1,xa)}
   if(this.dropHold>0)this.dropHold--;else this.dropTarget=1;
   if(dropP>0&&this.rnd()<dropP){this.dropTarget=1-(.3+.65*this.rnd())*(.35+.65*g);this.dropHold=(sr*(.012+.07*this.rnd()))|0}
   this.dropEnv+=(this.dropTarget-this.dropEnv)*(this.dropTarget<this.dropEnv?.03:.004);
   o0[n]=l*this.dropEnv;if(o1)o1[n]=r*this.dropEnv;
   this.w=(this.w+1)&mask;
  }
  const last=o0[N-1];if(!(last===last)||last>8||last<-8){this.heal()}
  return true;
 }
 heal(){this.buf[0].fill(0);this.buf[1].fill(0);this.d[0]=this.d[1]=this.nom;this.act=0;this.next=1;this.fading=false;this.sp=1;this.dropEnv=1;this.dropTarget=1;this.slumpLeft=0}
}
registerProcessor('continuum-slow',ContinuumSlow);
