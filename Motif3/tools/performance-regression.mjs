// PLAYWRIGHT_MODULE may point to a local Playwright install. Uses local Chrome hardware acceleration.
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');const b=await chromium.launch({channel:'chrome',headless:true});
try{
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+root+'/Motif3.html');await p.waitForFunction(()=>window.__lab&&__lab.gpu.state!=='init');
const styles=await p.evaluate(async()=>{
__lab.stage.pause();__lab.stage.destroy();const pr=__lab.project;pr.layers=[pr.layers[0]];pr.keys={};pr.finish.shutter=0;const out=[];
for(const s of __m_style_library.STYLES.filter(s=>s.kit==='kinetic-subdivision'||s.gpu)){
 const q=structuredClone(pr);q.layers[0].styleId=s.id;q.layers[0].params=__m_engine_core.defaults(s.params);let r=__lab.renderAt(q,.6,320,180);
 while(__lab.kits.runtime.pendingCompiles){await new Promise(r=>setTimeout(r,20));__lab.kits.runtime.poll();}
 r=__lab.renderAt(q,.6,320,180);out.push({id:s.id,engines:r.info.engines,colors:new Set(r.data).size});
}return out;});
const media=await p.evaluate(async({source,bytes})=>{
const make=new Function(source+';return createMediaStore;')();const cb=HTMLVideoElement.prototype.requestVideoFrameCallback;
HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;
const store=make({onChange:()=>{},isPlaying:()=>true});const m=await store.add(new File([new Uint8Array(bytes)],'fallback.webm',{type:'video/webm'}));HTMLVideoElement.prototype.requestVideoFrameCallback=cb;
const v=store.info(m.asset).el;await v.play();const revs=new Set();for(let i=0;i<25;i++){revs.add(store.resolve([{id:'source'}],{media:{source:m},w:320,h:180}).source.rev);await new Promise(requestAnimationFrame);}
const hidden={visible:false,media:{source:m}},above={id:'above',visible:true,comp:{mask:'matte-luma'}};
store.syncPlayback({layers:[hidden,above],keys:{}});const hiddenMattePlays=!v.paused;
above.comp.mask='none';store.syncPlayback({layers:[hidden,above],keys:{'L:above:c:mask':[{v:'matte-alpha'}]}});const animatedMattePlays=!v.paused;
store.syncPlayback({layers:[hidden,above],keys:{}});const unusedHiddenStops=v.paused;
await v.play();store.syncPlayback({layers:[],keys:{}});return{fallbackRevisions:revs.size,hiddenMattePlays,animatedMattePlays,unusedHiddenStops,removedStops:v.paused};
},{source:fs.readFileSync(root+'/src/parts/media.js','utf8'),bytes:Array.from(fs.readFileSync(root+'/performance-review/fixture.webm'))});
const result={styles,media,errors};fs.writeFileSync(root+'/performance-review/regression.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(styles.length,14);assert.ok(styles.every(x=>x.colors>5));assert.ok(styles.filter(x=>x.id.includes('/')).every(x=>x.engines.includes('webgl')));assert.ok(styles.filter(x=>!x.id.includes('/')).every(x=>x.engines.includes('gpu')));assert.deepEqual(errors,[]);assert.ok(media.fallbackRevisions>1);assert.ok(media.hiddenMattePlays&&media.animatedMattePlays&&media.unusedHiddenStops&&media.removedStops);
}finally{await b.close();}
