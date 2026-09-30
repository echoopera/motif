// Local hardware/browser check. Usage: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/performance-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'performance-review');
const artifactHash = () => createHash('sha256').update(fs.readFileSync(path.join(root,'Motif3.html'))).digest('hex');
const artifactRevision = artifactHash();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { artifactRevision, browser: browser.version(), date: new Date().toISOString(), fixture: '1920x1080 synthetic VP8 video, ~24 fps; 960x540 shader output; local headless hardware Chrome', runs: {} };
try {
  const fixturePage = await browser.newPage();
  await fixturePage.goto('about:blank');
  const bytes = await fixturePage.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
    const paint = i => { x.fillStyle = '#163855'; x.fillRect(0,0,c.width,c.height); for(let j=0;j<16;j++){x.fillStyle=j%2?'#fa925b':'#e0eeee';x.fillRect((j*140+i*13)%1920,60+j*20,70,780-j*20);} };
    paint(0); const stream = c.captureStream(24), rec = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:8000000}); const chunks=[];
    rec.ondataavailable=e=>chunks.push(e.data); const done=new Promise(r=>rec.onstop=r);rec.start();
    for(let i=0;i<36;i++){paint(i);await new Promise(r=>setTimeout(r,1000/24));}rec.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await fixturePage.close(); fs.writeFileSync(path.join(out,'fixture.webm'),Buffer.from(bytes));
  for (const [label, file] of [['before','performance-review/baseline/Motif3.html'],['control','performance-review/baseline/Motif3.html'],['after','Motif3.html']]) {
    const page = await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root,file)).href);await page.waitForFunction(()=>window.__lab);await page.waitForTimeout(1500);
    await page.evaluate(()=>{__lab.stage.pause();const p=__lab.project;p.layers=[p.layers[0]];p.active=p.layers[0].id;p.keys={};__lab.setProject(p);__lab.selectStyle('kinetic-subdivision/kinetic-treemap');});
    await page.waitForTimeout(600);
    await page.evaluate(async bytes=>{window.fixtureMedia=await __lab.media.add(new File([new Uint8Array(bytes)],'performance.webm',{type:'video/webm'}));const p=__lab.project;p.layers[0].media={source:{...fixtureMedia,fit:'fill',timing:'free'}};p.layers[0].shared.seed=123;p.finish.shutter=0;__lab.setProject(p);},bytes);
    await page.waitForTimeout(400);
    const result = await page.evaluate(async()=>{
      const lab=__lab, p=lab.project;
      lab.stage.play();await new Promise(r=>setTimeout(r,750));
      const intervals=[];let prior=await new Promise(requestAnimationFrame);
      for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);intervals.push(now-prior);prior=now;}
      intervals.sort((a,b)=>a-b);const stageCadence={meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95Ms:intervals[Math.ceil(intervals.length*.95)-1],scale:lab.kits.gpuStatus().scale};stageCadence.fps=1000/stageCadence.meanMs;
      lab.stage.pause();lab.stage.destroy();
      const video=lab.media.info(fixtureMedia.asset).el;
      // MediaRecorder WebM can initially report Infinity; seek to discover its duration before the fixture.
      if(!Number.isFinite(video.duration)){video.currentTime=1e10;await new Promise(r=>video.addEventListener('seeked',r,{once:true}));}
      const counts={bakes:0,texImage:0,texStorage:0,texSubImage:0,mipmaps:0};
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...a){if(a[0]===video)counts.bakes++;return draw.apply(this,a);};
      for(const [method,key] of [['texImage2D','texImage'],['texStorage2D','texStorage'],['texSubImage2D','texSubImage'],['generateMipmap','mipmaps']]){const fn=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...a){counts[key]++;return fn.apply(this,a);};}
      const state={media:p.layers[0].media,w:960,h:540,L:6,t:0};const inputs=[{id:'source'}];
      await lab.media.prepare(p,0);lab.media.resolve(inputs,state);lab.media.release();
      await video.play();Object.keys(counts).forEach(k=>counts[k]=0);
      const revs=new Set(), times=new Set(), start=performance.now();let resolves=0;
      while(performance.now()-start<1800){const m=lab.media.resolve(inputs,state).source;revs.add(m.rev);times.add(video.currentTime);resolves++;await new Promise(requestAnimationFrame);}
      video.pause();const frameReuse={...counts,resolves,distinctTimes:times.size,distinctBakes:revs.size};
      let inactiveVideoStopped=null;
      if(lab.media.syncPlayback){await video.play();lab.media.syncPlayback({...p,layers:[]});inactiveVideoStopped=video.paused;}
      // Exact seek fixture. Pause the stage's RAF so it cannot interfere with batch measurements.
      lab.stage.destroy();await lab.media.prepare(p,0.5);
      const pix=lab.renderAt(p,0.5,960,540);window.parityPixels=Array.from(pix.data);
      // Full-quality motion blur path.
      const blur=structuredClone(p);blur.finish.shutter=180;blur.finish.samples=4;
      window.blurPixels=Array.from(lab.renderAt(blur,0.5,320,180).data);
      const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=960;ctx.canvas.height=540;
      // Force a source change per iteration to isolate upload and mip generation (same pixels, no decode noise).
      const m=lab.media.resolve(inputs,state).source;
      lab.kits.setMediaResolver(()=>({source:m}));
      const samples=[];for(let i=0;i<30;i++){m.rev++;const t=performance.now();lab.pipeline.renderFrame(ctx,960,540,p,0.5);ctx.getImageData(0,0,1,1);if(i>=5)samples.push(performance.now()-t);}
      Object.keys(counts).forEach(k=>counts[k]=0);
      for(let i=0;i<10;i++){m.rev++;lab.pipeline.renderFrame(ctx,960,540,p,0.5);ctx.getImageData(0,0,1,1);}
      const uploadCounts={...counts};lab.kits.setMediaResolver(lab.media.resolve);lab.media.release();
      samples.sort((a,b)=>a-b);const timings={meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p50Ms:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.ceil(samples.length*.95)-1]};
      for(let i=0;i<240;i++)lab.kits.reportFrame(16.667);const budgetBefore=lab.kits.gpuStatus().budget;for(let i=0;i<60;i++)lab.kits.reportFrame(33.333);const budgetAfter=lab.kits.gpuStatus().budget;
      lab.kits.setPreview(true,false);lab.pipeline.renderFrame(ctx,960,540,p,0.5);lab.kits.setPreview(false);const pausedScale=lab.kits.gpuStatus().scale;
      return {inactiveVideoStopped,stageCadence,gpu:lab.kits.gpuStatus(),webgpu:lab.gpu.ready,frameReuse,uploadCounts,timings,governor:{budgetBefore,budgetAfter,pausedScale},renderInfo:pix.info,kitErrors:[...lab.kits.errors]};
    });
    for(const [name,variable] of [['frame','parityPixels'],['blur','blurPixels']]){const data=await page.evaluate(v=>window[v],variable);fs.writeFileSync(path.join(out,`${label}-${name}.rgba`),Buffer.from(data));}
    if(label==='after'){
      result.fullHd = await page.evaluate(async()=>{
        const lab=__lab, video=lab.media.info(fixtureMedia.asset).el, rows=[];
        const c=document.createElement('canvas');c.width=1920;c.height=1080;const ctx=c.getContext('2d');
        lab.kits.setMediaResolver((inputs,S)=>lab.media.resolve(inputs,S,{preview:false}));await video.play();
        for(const layers of [1,2]){
          const p=lab.project;p.layers=p.layers.slice(0,1);if(layers===2){const copy=structuredClone(p.layers[0]);copy.id='stress-copy';copy.comp.opacity=.5;p.layers.push(copy);}p.finish.shutter=layers===2?180:0;p.finish.samples=4;
          const samples=[];let last=await new Promise(requestAnimationFrame);
          for(let i=0;i<90;i++){const now=await new Promise(requestAnimationFrame);if(i>=15)samples.push(now-last);last=now;lab.pipeline.renderFrame(ctx,1920,1080,p,i/60,{preview:true,previewSamples:4});}
          samples.sort((a,b)=>a-b);const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
          rows.push({layers,shutter:p.finish.shutter,samples:p.finish.shutter?4:1,fullResolution:true,meanMs:mean,p95Ms:samples[Math.ceil(samples.length*.95)-1],fps:1000/mean});
        }
        video.pause();lab.kits.setMediaResolver(lab.media.resolve);return rows;
      });
      result.export=await page.evaluate(async()=>{const p=__lab.project;p.finish.loop=0.5;__lab.setProject(p);const r=await __lab.exportNow({format:'mp4',tier:180,fps:24,quality:'high',withAudio:false});delete r.head;return r;});
      await page.screenshot({path:path.join(out,'verified-app.png')});
    }
    result.pageErrors=errors;report.runs[label]=result;await page.close();
  }
  report.controlParity={};for(const name of ['frame','blur']){const a=fs.readFileSync(path.join(out,`before-${name}.rgba`)),b=fs.readFileSync(path.join(out,`control-${name}.rgba`));let different=0,maxDelta=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)different++;maxDelta=Math.max(maxDelta,d);}report.controlParity[name]={different,maxDelta};}
  report.controlMatchesAfter={};for(const name of ['frame','blur'])report.controlMatchesAfter[name]=fs.readFileSync(path.join(out,`control-${name}.rgba`)).equals(fs.readFileSync(path.join(out,`after-${name}.rgba`)));
  report.parity={};for(const name of ['frame','blur']){const a=fs.readFileSync(path.join(out,`before-${name}.rgba`)),b=fs.readFileSync(path.join(out,`after-${name}.rgba`));let different=0,maxDelta=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)different++;maxDelta=Math.max(maxDelta,d);}report.parity[name]={bytes:a.length,different,maxDelta};}
  assert.equal(artifactHash(),artifactRevision,'App changed while measurement was running; rerun on stable build');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.equal(report.runs.after.gpu.software,false,'Hardware GPU required for hardware performance claims');
  assert.deepEqual(report.runs.after.pageErrors,[]);assert.deepEqual(report.runs.after.kitErrors,[]);
  // A repeated original-build control detects browser upload/readback rounding independently of our changes.
  assert.equal(report.controlMatchesAfter.frame,true);assert.equal(report.controlMatchesAfter.blur,true);
  assert.ok(report.runs.after.frameReuse.distinctBakes<report.runs.after.frameReuse.distinctTimes,'Decode frames reused between display refreshes');
  assert.equal(report.runs.after.uploadCounts.texStorage,0,'Texture storage is reused');
  assert.ok(report.runs.after.governor.budgetAfter<report.runs.after.governor.budgetBefore);
  assert.equal(report.runs.after.inactiveVideoStopped,true);
  assert.equal(report.runs.after.governor.pausedScale,1);assert.ok(report.runs.after.export.size>1000);
} finally { await browser.close(); }
