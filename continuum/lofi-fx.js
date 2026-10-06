'use strict';
// Bit-depth + sample-rate reduction for the Lo-Fi Media slot (SP-1200 crunch). Everything else in the slot is native nodes.
class ContinuumCrush extends AudioWorkletProcessor{
 static get parameterDescriptors(){return[
  {name:'bits',defaultValue:16,minValue:2,maxValue:16,automationRate:'k-rate'},
  {name:'rate',defaultValue:1,minValue:.05,maxValue:1,automationRate:'k-rate'}]}
 constructor(){super();this.hold=[0,0];this.phase=[1,1]}
 process(inputs,outputs,params){
  const inp=inputs[0],out=outputs[0];if(!out.length)return true;
  if(!inp.length){for(const o of out)o.fill(0);return true}
  const bits=params.bits[0],rate=params.rate[0],levels=Math.pow(2,bits-1),exact=bits>=16;
  for(let c=0;c<out.length;c++){
   const i=inp[c]||inp[0],o=out[c];
   for(let n=0;n<o.length;n++){
    this.phase[c]+=rate;
    if(this.phase[c]>=1){this.phase[c]-=1;const x=i[n];this.hold[c]=exact?x:Math.round(x*levels)/levels}
    if(!(this.hold[c]===this.hold[c]))this.hold[c]=0;
    o[n]=this.hold[c];
   }
  }
  return true;
 }
}
registerProcessor('continuum-crush',ContinuumCrush);
