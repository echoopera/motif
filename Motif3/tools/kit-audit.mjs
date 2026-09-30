// Deep kit audit: compile, NaN/Inf scan, coverage at defaults + random params across palettes, and GPU cost.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, catFile, appFile, outFile, only] = process.argv;
const CAT = JSON.parse(fs.readFileSync(catFile, 'utf8')).filter(k => !only || only.split(',').includes(k.manifest.id));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.route(/^https?:\/\//, r => r.abort());
await page.goto('file://' + appFile);
await page.waitForTimeout(1200);
await page.evaluate(() => { document.body.innerHTML = ''; });
const res = await page.evaluate(async (CAT) => {
  const KG = __m_kit_gl, E = __m_engine_core, SL = __m_style_library;
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
  function run(progs, spec, vals, pal, p, w, h, read) {
    const L=[pal.bg,pal.ink,...pal.a].map(KG.hexToLin); const texs=[];
    progs.forEach((ps,i)=>{ const last=i===progs.length-1; const pw=last?w:Math.max(1,Math.round(w*ps.scale)), ph=last?h:Math.max(1,Math.round(h*ps.scale));
      if(last){ gl.bindFramebuffer(gl.FRAMEBUFFER,null); } else texs.push(tgt(i,pw,ph));
      if(!last) gl.bindFramebuffer(gl.FRAMEBUFFER,texPool[i].fbo);
      gl.viewport(0,0,pw,ph); gl.useProgram(ps.p); const U=n=>gl.getUniformLocation(ps.p,n);
      gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      gl.uniform2f(U('u_res'),pw,ph); gl.uniform1f(U('u_p'),p); gl.uniform1f(U('u_L'),6); gl.uniform1f(U('u_seed'),7); gl.uniform1f(U('u_safe'),1);
      ['u_bg','u_ink','u_a0','u_a1','u_a2'].forEach((n,j)=>gl.uniform3fv(U(n),L[j]));
      for(let b=0;b<4;b++){ const loc=U('u_buf'+b); if(loc){ gl.activeTexture(gl.TEXTURE0+b); gl.bindTexture(gl.TEXTURE_2D, b<texs.length && b<i ? texs[b] : null); gl.uniform1i(loc,b);} }
      for(const [k,sp] of Object.entries(spec)){ const loc=U('p_'+k); if(!loc) continue; const v=vals[k];
        if(sp.type==='range') gl.uniform1f(loc,+v); else if(sp.type==='int') gl.uniform1i(loc,Math.round(v)); else if(sp.type==='toggle') gl.uniform1i(loc,v?1:0); else gl.uniform1i(loc,Math.max(0,sp.options.findIndex(o=>o.v===v))); }
      if(last){ gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawArrays(gl.TRIANGLES,0,3); });
    const px=new Uint8Array(read?w*h*4:4); gl.readPixels(0,0,read?w:1,read?h:1,gl.RGBA,gl.UNSIGNED_BYTE,px); return px;
  }
  const out = [];
  for (const raw of CAT) { const m = raw.manifest; const common = raw.files[m.common] || '';
    for (const sm of m.styles) {
      const st = SL.STYLES.find(s => s.id === m.id + '/' + sm.id); const spec = st.params;
      const passes = sm.passes || [{ src: `styles/${sm.id}.glsl` }];
      const rec = { id: st.id, group: sm.group, passes: passes.length };
      const progs = []; let err = null;
      for (let i=0;i<passes.length;i++){ const last=i===passes.length-1; let { src } = KG.buildSource(raw.files[passes[i].src], common, spec, last);
        if (last) src = src.replace(/if \(any\(isnan\(c\)\)\) c = vec4\(0\.0\);/, 'if (any(isnan(c))||any(isinf(c))) { M_out = vec4(1.0,0.0,1.0,1.0); return; }');
        const r = prog(src); if (r.err) { err = r.err.slice(0,400); break; } progs.push({ p: r.p, scale: Math.min(1, Math.max(0.125, passes[i].scale || 1)) }); }
      if (err) { rec.err = err; out.push(rec); continue; }
      const def = E.defaults(spec); const rng = E.mulberry32(1234);
      const sets = [def]; for (let k=0;k<10;k++) sets.push(E.randomize(def, spec, new Set(), rng).values);
      const worst = { nan: 0, lowCover: [], meanCover: 0 }; let nCov = 0;
      sets.forEach((vals, si) => m.palettes.forEach((pal, pi) => { for (const p of [0.07, 0.41, 0.83]) {
        if (si > 0 && pi > 0 && p !== 0.41) continue;
        const px = run(progs, spec, vals, pal, p, W, H, true); let nan=0, cov=0;
        for (let q=0;q<px.length;q+=4){ if(px[q]===255&&px[q+1]===0&&px[q+2]===255&&px[q+3]===255) nan++; else if (px[q+3] > 10) cov++; }
        const n=W*H; nan/=n; cov/=n; worst.nan=Math.max(worst.nan,nan); worst.meanCover+=cov; nCov++;
        if (cov < 0.03 || nan > 0.002) worst.lowCover.push({ set: si, pal: pal.id, p, cov: +cov.toFixed(3), nan: +nan.toFixed(3), vals: si ? vals : 'default' });
      } }));
      worst.meanCover = +(worst.meanCover / nCov).toFixed(3); worst.nan = +worst.nan.toFixed(4);
      Object.assign(rec, worst);
      // cost at 480x270 (3 frames), with a readback to force completion
      run(progs, spec, def, m.palettes[0], 0.2, 480, 270, false);
      const t0 = performance.now(); for (let i=0;i<3;i++) run(progs, spec, def, m.palettes[0], 0.2 + i*0.3, 480, 270, false);
      rec.ms = +((performance.now()-t0)/3).toFixed(0);
      out.push(rec); await new Promise(r=>setTimeout(r,0));
    } }
  return out;
}, CAT);
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
for (const r of res) console.log(((r.err||r.nan>0.002||r.lowCover&&r.lowCover.length)?'!!':'  ')+' '+r.id.padEnd(32)+' ms '+String(r.ms).padStart(5)+'  cov '+r.meanCover+'  nan '+r.nan+'  lows '+(r.lowCover?r.lowCover.length:'')+' '+(r.err||''));
await browser.close();
