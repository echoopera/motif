'use strict';
// Sample-accurate recorder for audio export. Starts and stops on exact frame numbers so every stem lines up.
// Captures interleaved stereo as 16-bit (TPDF dithered) or 32-bit float and streams 4096-frame chunks to the page.
class ContinuumRec extends AudioWorkletProcessor{
 constructor(options){
  super();
  const o=(options&&options.processorOptions)||{};
  this.bits=o.bits===24?24:16;this.chunk=4096;this.active=false;this.startF=0;this.stopF=Infinity;
  this.fill=0;this.frames=0;this.buf=this.make();this.seed=0x9e3779b9;
  this.port.onmessage=e=>{
   const d=e.data;
   if(d.type==='arm'){this.startF=Math.round(d.at*sampleRate);this.stopF=d.stopAt==null?Infinity:Math.round(d.stopAt*sampleRate);this.frames=0;this.fill=0;this.buf=this.make();this.active=true}
   else if(d.type==='stop'){this.stopF=Math.round(d.at*sampleRate)}
   else if(d.type==='abort'){this.active=false;this.fill=0}
  };
 }
 make(){return this.bits===16?new Int16Array(this.chunk*2):new Float32Array(this.chunk*2)}
 rnd(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return(this.seed>>>0)/4294967296}
 q(x){const v=Math.round(Math.max(-1,Math.min(1,x))*32767+(this.rnd()-this.rnd()));return v>32767?32767:v<-32768?-32768:v}
 flush(){
  if(this.fill>0){const out=this.buf.slice(0,this.fill*2);this.port.postMessage({type:'data',buf:out},[out.buffer]);this.fill=0}
 }
 process(inputs){
  if(!this.active)return true;
  const inp=inputs[0],L=inp&&inp[0],R=(inp&&inp[1])||L,f0=currentFrame,N=128;
  for(let n=0;n<N;n++){
   const f=f0+n;
   if(f<this.startF)continue;
   if(f>=this.stopF){this.flush();this.active=false;this.port.postMessage({type:'done',frames:this.frames});return true}
   const l=L?L[n]:0,r=R?R[n]:0,i=this.fill*2;
   if(this.bits===16){this.buf[i]=this.q(l);this.buf[i+1]=this.q(r)}else{this.buf[i]=l;this.buf[i+1]=r}
   this.fill++;this.frames++;
   if(this.fill===this.chunk){this.port.postMessage({type:'data',buf:this.buf},[this.buf.buffer]);this.buf=this.make();this.fill=0}
  }
  return true;
 }
}
registerProcessor('continuum-rec',ContinuumRec);
