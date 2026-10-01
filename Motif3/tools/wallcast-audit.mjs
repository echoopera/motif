// Wallcast audit in the real Motif 3 app: installs the kit through the app's own installer, then checks compile,
// NaN/Inf, coverage over random parameter sets and palettes, WCAG-style flash counts at the worst-case loop, and cost.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, bundleFile, appFile, outFile] = process.argv;
const RAW = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.route(/^https?:\/\//, r => r.abort());
page.on('pageerror', e => console.log('pageerror', String(e).slice(0,200)));
await page.goto('file://' + appFile);
await page.waitForTimeout(1500);
await page.evaluate(() => { document.body.innerHTML = ''; });
const res = await page.evaluate(async (RAW) => {
  const K = __m_kits, KG = __m_kit_gl, E = __m_engine_core, SL = __m_style_library;
  const inst = K.install(RAW, { source: 'file', silent: true, approved: 'all' }); // audit tool: the kit's capabilities (media) are approved
  const head = { installOk: inst.ok, errors: inst.errors || [], warnings: inst.warnings || [], skipped: !!inst.skippedCompile };
  if (!inst.ok) return { head, out: [] };
  const W = 192, H = 108;
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true }); gl.getExtension('EXT_color_buffer_float');
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const VS = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(VS,'#version 300 es\nin vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}'); gl.compileShader(VS);
  function prog(src){ const fs=gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs,src); gl.compileShader(fs);
    if(!gl.getShaderParameter(fs,gl.COMPILE_STATUS)) return {err:gl.getShaderInfoLog(fs)};
    const p=gl.createProgram(); gl.attachShader(p,VS); gl.attachShader(p,fs); gl.bindAttribLocation(p,0,'a_pos'); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) return {err:gl.getProgramInfoLog(p)}; return {p}; }
  const texPool = [];
  function tgt(i,w,h){ let t=texPool[i]; if(!t){ t={tex:gl.createTexture(),fbo:gl.createFramebuffer()}; texPool[i]=t; }
    gl.bindTexture(gl.TEXTURE_2D,t.tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.tex,0); return t.tex; }
  let LOOP = 6;
  function run(progs, spec, vals, pal, p, w, h, read) {
    const L=[pal.bg,pal.ink,...pal.a].map(KG.hexToLin); const texs=[];
    progs.forEach((ps,i)=>{ const last=i===progs.length-1; const pw=last?w:Math.max(1,Math.round(w*ps.scale)), ph=last?h:Math.max(1,Math.round(h*ps.scale));
      if(last){ gl.bindFramebuffer(gl.FRAMEBUFFER,null); } else texs.push(tgt(i,pw,ph));
      if(!last) gl.bindFramebuffer(gl.FRAMEBUFFER,texPool[i].fbo);
      gl.viewport(0,0,pw,ph); gl.useProgram(ps.p); const U=n=>gl.getUniformLocation(ps.p,n);
      gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      gl.uniform2f(U('u_res'),pw,ph); gl.uniform1f(U('u_p'),p); gl.uniform1f(U('u_L'),LOOP); gl.uniform1f(U('u_seed'),7); gl.uniform1f(U('u_safe'),1);
      ['u_bg','u_ink','u_a0','u_a1','u_a2'].forEach((n,j)=>gl.uniform3fv(U(n),L[j]));
      for(let b=0;b<4;b++){ const loc=U('u_buf'+b); if(loc){ gl.activeTexture(gl.TEXTURE0+b); gl.bindTexture(gl.TEXTURE_2D, b<texs.length && b<i ? texs[b] : null); gl.uniform1i(loc,b);} }
      for(const [k,sp] of Object.entries(spec)){
        if(sp.type==='color'||sp.type==='point'){ continue; }
        const loc=U('p_'+k); if(!loc) continue; const v=vals[k];
        if(sp.type==='range') gl.uniform1f(loc,+v); else if(sp.type==='int') gl.uniform1i(loc,Math.round(v)); else if(sp.type==='toggle') gl.uniform1i(loc,v?1:0); else gl.uniform1i(loc,Math.max(0,sp.options.findIndex(o=>(o.v||o)===v))); }
      for(const [k,sp] of Object.entries(spec)){ if(sp.type==='point'){ const d=sp.def; const a=gl.getUniformLocation(ps.p,'p_'+k+'X'), b2=gl.getUniformLocation(ps.p,'p_'+k+'Y'); if(a) gl.uniform1f(a,d[0]); if(b2) gl.uniform1f(b2,d[1]); } }
      if(last){ gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawArrays(gl.TRIANGLES,0,3); });
    const px=new Uint8Array(read?w*h*4:4); gl.readPixels(0,0,read?w:1,read?h:1,gl.RGBA,gl.UNSIGNED_BYTE,px); return px;
  }
  const lin=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  function tileLum(px,w,h){ const T=Array(16).fill(0),N=Array(16).fill(0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const t=Math.floor(y*4/h)*4+Math.floor(x*4/w);T[t]+=0.2126*lin(px[i])+0.7152*lin(px[i+1])+0.0722*lin(px[i+2]);N[t]++;}
    return T.map((v,i)=>v/N[i]); }
  // flashes per second in each of 16 tiles at loop length Lsec, sampled 24 times across the loop
  function flashTest(progs,spec,vals,pal,Lsec){
    LOOP=Lsec; const F=24, seq=[];
    for(let f=0;f<F;f++) seq.push(tileLum(run(progs,spec,vals,pal,f/F,64,36,true),64,36));
    const counts=[];
    for(let t=0;t<16;t++){ let ev=[],last=0;
      for(let f=0;f<F;f++){ const a=seq[f][t],b=seq[(f+1)%F][t]; const d=b-a; if(Math.abs(d)>=0.1&&Math.min(a,b)<0.8) ev.push(Math.sign(d)); }
      let pairs=0; for(let i=1;i<ev.length;i++) if(ev[i]!==ev[i-1]) pairs++;
      counts.push(pairs/Lsec/2*1.0); }
    LOOP=6; const bad=counts.filter(c=>c>3).length; return { maxPerSec:+Math.max(...counts).toFixed(2), tilesOver3:bad };
  }
  const out = [];
  const m = RAW.manifest; const common = RAW.files[m.common] || '';
  for (const sm of m.styles) {
    const st = SL.STYLES.find(s => s.id === m.id + '/' + sm.id); const spec = st.params;
    const passes = sm.passes || [{ src: `styles/${sm.id}.glsl` }];
    const rec = { id: st.id, passes: passes.length, params: Object.keys(spec).length };
    const progs = []; let err = null;
    for (let i=0;i<passes.length;i++){ const last=i===passes.length-1; let { src } = KG.buildSource(RAW.files[passes[i].src], common, spec, last, sm.inputs || m.inputs);
      if (last) src = src.replace(/if \(any\(isnan\(c\)\)\) c = vec4\(0\.0\);/, 'if (any(isnan(c))||any(isinf(c))) { M_out = vec4(1.0,0.0,1.0,0.5); return; }');
      const r = prog(src); if (r.err) { err = r.err.slice(0,500); break; } progs.push({ p: r.p, scale: Math.min(1, Math.max(0.125, passes[i].scale || 1)) }); }
    if (err) { rec.err = err; out.push(rec); continue; }
    const def = E.defaults(spec); const rng = E.mulberry32(1234);
    const sets = [def]; for (let k=0;k<10;k++) sets.push(E.randomize(def, spec, new Set(), rng).values);
    const worst = { nan: 0, lowCover: [], meanCover: 0 }; let nCov = 0;
    sets.forEach((vals, si) => m.palettes.forEach((pal, pi) => { for (const p of [0.07, 0.41, 0.83]) {
      if (si > 0 && pi > 0 && p !== 0.41) continue;
      const px = run(progs, spec, vals, pal, p, W, H, true); let nan=0, cov=0;
      for (let q=0;q<px.length;q+=4){ if(px[q]===255&&px[q+1]===0&&px[q+2]===255&&px[q+3]===128) nan++; else if (px[q+3] > 10) cov++; }
      const n=W*H; nan/=n; cov/=n; worst.nan=Math.max(worst.nan,nan); worst.meanCover+=cov; nCov++;
      if (cov < 0.03 || nan > 0.002) worst.lowCover.push({ set: si, pal: pal.id, p, cov: +cov.toFixed(3), nan: +nan.toFixed(3) });
    } }));
    worst.meanCover = +(worst.meanCover / nCov).toFixed(3); worst.nan = +worst.nan.toFixed(4);
    Object.assign(rec, worst);
    // flash: worst case (1 s loop at 4x tempo = 0.25 s) and a 1 s loop, defaults and 4 random sets
    const fl = [];
    for (const Ls of [0.25, 1, 6]) for (const vals of [def, ...sets.slice(1,5)]) fl.push(flashTest(progs, spec, vals, m.palettes[0], Ls));
    rec.flash = { worst: Math.max(...fl.map(f=>f.maxPerSec)), tilesOver: Math.max(...fl.map(f=>f.tilesOver3)) };
    run(progs, spec, def, m.palettes[0], 0.2, 480, 270, false);
    const t0 = performance.now(); for (let i=0;i<3;i++) run(progs, spec, def, m.palettes[0], 0.2 + i*0.3, 480, 270, false);
    rec.ms = +((performance.now()-t0)/3).toFixed(0);
    out.push(rec); await new Promise(r=>setTimeout(r,0));
  }
  return { head, out };
}, RAW);
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log('install:', JSON.stringify(res.head));
for (const r of res.out) console.log(((r.err||r.nan>0.002||(r.lowCover&&r.lowCover.length)||(r.flash&&r.flash.tilesOver>=4))?'!!':'  ')+' '+r.id.padEnd(30)+' params '+String(r.params).padStart(2)+'  ms '+String(r.ms).padStart(4)+'  cov '+r.meanCover+'  nan '+r.nan+'  lows '+(r.lowCover?r.lowCover.length:'')+'  flash max/s '+(r.flash?r.flash.worst:'')+' tiles>3 '+(r.flash?r.flash.tilesOver:'')+' '+(r.err||''));
await browser.close();
