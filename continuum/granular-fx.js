/* Stereo live-input granular texture. Fixed ring and voice pools: no allocations in process. */
class ContinuumGranular extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'mode',defaultValue:0,minValue:0,maxValue:5,automationRate:'k-rate'}]}
 constructor(){super();this.size=Math.ceil(sampleRate*2);this.l=new Float32Array(this.size);this.r=new Float32Array(this.size);this.write=0;this.filled=0;this.clock=0;this.seed=9173;this.mode=0;this.frozen=false;this.anchor=0;this.grains=Array.from({length:12},()=>({age:1,length:1,pos:0,rate:1,pan:0}));}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
 read(buffer,p){p=((p%this.size)+this.size)%this.size;const i=Math.floor(p),f=p-i;return buffer[i]*(1-f)+buffer[(i+1)%this.size]*f}
 process(inputs,outputs,params){const input=inputs[0],out=outputs[0];if(!out||!out[0])return true;const mode=Math.round(params.mode[0]);if(mode!==this.mode){this.mode=mode;this.clock=0;for(const g of this.grains)g.age=g.length;this.frozen=mode===4&&this.filled>sampleRate*.2;this.anchor=this.write;}
 const durations=[0,.11,.2,.085,.18,.045],rates=[1,1,-1,1.5,1,.72],intervals=[1,.038,.065,.025,.045,.018];
 for(let i=0;i<out[0].length;i++){
 if(!this.frozen){this.l[this.write]=input[0]?.[i]||0;this.r[this.write]=input[1]?.[i]??this.l[this.write];this.write=(this.write+1)%this.size;this.filled=Math.min(this.size,this.filled+1);if(mode===4&&this.filled>sampleRate*.3){this.frozen=true;this.anchor=this.write}}
 let left=0,right=0,norm=0;
 if(mode&&this.filled>sampleRate*.15&&this.clock--<=0){const g=this.grains.find(g=>g.age>=g.length);if(g){g.length=Math.floor(sampleRate*durations[mode]);g.age=0;g.rate=rates[mode]*(mode===3?(this.random()<.5?1:4/3):1);const history=Math.min(this.filled-4,sampleRate*(mode===4?.7:.45));const offset=sampleRate*.1+this.random()*Math.max(1,history-sampleRate*.1);g.pos=(this.frozen?this.anchor:this.write)-offset-(g.rate>0?g.length*Math.max(1,g.rate):0);g.pan=(this.random()-.5)*.75}this.clock=Math.floor(sampleRate*intervals[mode]);}
 for(const g of this.grains){if(g.age>=g.length)continue;const w=.5-.5*Math.cos(2*Math.PI*g.age/g.length);const a=this.read(this.l,g.pos),b=this.read(this.r,g.pos);left+=a*w*(1-Math.max(0,g.pan));right+=b*w*(1+Math.min(0,g.pan));norm+=w;g.pos+=g.rate;g.age++;}
 out[0][i]=norm>.01?left/Math.max(1,norm):0;if(out[1])out[1][i]=norm>.01?right/Math.max(1,norm):0;
 }
 return true;
 }
}
registerProcessor('continuum-granular',ContinuumGranular);
