// Plugin API browser test (motif-kit@2 + sandbox) in real Chromium.
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tests/browser/kits.browser.mjs [motif7.html]
// Optional MOTIF_BASELINE=<old motif7.html> for the v1 render-identity check (default: git show motif-5.1-performance).
// Covers: v1 kits render pixel-identically to the baseline build; v2 graph style, effect and transition render;
// hostile kits are rejected (line-numbered diagnostics in the Kits panel) or quarantined by the canary without
// freezing the page; capability approval (keyboard); XSS-safe kit text; rollback/uninstall; context-loss quarantine
// and recovery; no network requests from any kit operation.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url'; import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { rawFromDir } from '../lib/kits.mjs';
import { HOSTILE, SLOW_KIT, NICE_KIT } from '../lib/hostile.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '../..');
const appFile = path.resolve(root, process.argv[2] || 'motif7.html');
const SW = !!process.env.SOFTWARE_GL;
// Longest main-thread stall allowed while a hostile kit is validated / checked. Software GL compiles on the CPU.
const STALL_MS = SW ? 1500 : 500;
const browser = await chromium.launch({ headless: true, args: SW ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const results = []; let failed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try { const note = await fn(); results.push(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${note ? ' · ' + note : ''}`); }
  catch (e) { failed++; results.push(`FAIL ${name}: ${e && e.message ? e.message.split('\n').slice(0, 6).join('\n     ') : e}`); }
  console.log(results[results.length - 1]);
}
async function openApp(file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:\/\//, r => { requests.push(r.request().url()); return r.abort(); });
  await page.goto(pathToFileURL(file).href); await page.waitForFunction(() => window.__lab, null, { timeout: 60000 }); await page.waitForTimeout(800);
  // Main-thread responsiveness monitor: the longest gap between 10 ms timer ticks.
  await page.evaluate(() => { const m = window.__mon = { max: 0, last: performance.now(), gaps: [], reset() { m.max = 0; m.gaps = []; m.last = performance.now(); } }; setInterval(() => { const t = performance.now(), g = t - m.last; if (g > 200) m.gaps.push(Math.round(g)); m.max = Math.max(m.max, g); m.last = t; }, 10); });
  return { page, errors, requests };
}
// Wait until the app is idle (catalog thumbnails compiled, no long tasks for 1.5 s) so a stall is attributable to the
// kit operation under test, not to start-up work.
const settle = p => p.evaluate(async () => { const t0 = performance.now(); while (performance.now() - t0 < 120000) { __mon.reset(); await new Promise(r => setTimeout(r, 1500)); if (!__lab.kits.runtime.pendingCompiles && __mon.max < 150) return true; } return false; });
const bytesOf = raw => Array.from(Buffer.from(JSON.stringify(raw)));
const bundleText = h => h.text || JSON.stringify(h.raw);

const app = await openApp(appFile);
const { page } = app;
const netAtStart = app.requests.length;
const LUMEN = rawFromDir(path.join(root, 'sdk/motif-kit-sdk/examples/lumen-fx'));

try {
  await step('boot: catalog kits load as motif-kit@2 (migrated from @1), no page errors', async () => {
    const r = await page.evaluate(() => __lab.kits.list().map(k => ({ id: k.id, f: k.format, s: k.sourceFormat, m: !!k.migration })));
    assert.ok(r.length >= 4); for (const k of r) { assert.equal(k.f, 'motif-kit@2'); assert.equal(k.s, 'motif-kit@1'); assert.ok(k.m); }
    assert.deepEqual(app.errors, []);
    return r.map(k => k.id).join(', ');
  });

  await step('v1 kits render pixel-identically to the baseline build', async () => {
    let base = process.env.MOTIF_BASELINE;
    if (process.env.MOTIF_SKIP_BASELINE) return 'SKIPPED (MOTIF_SKIP_BASELINE)';
    if (!base) { try { base = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'motif-base-')), 'motif7.html'); fs.writeFileSync(base, execFileSync('git', ['show', 'motif-5.1-performance:Motif3/motif7.html'], { cwd: root, maxBuffer: 64 << 20 })); } catch (e) { return 'SKIPPED: no baseline build (set MOTIF_BASELINE)'; } }
    const old = await openApp(base);
    const ids = await page.evaluate(() => __lab.kits.list().flatMap(k => k.styles.map(s => s.id)));
    const render = (p, id) => p.evaluate(async id => {
      const pr = __lab.project; const l = __lab.api.timeline.newLayer(id); pr.layers = [{ ...l, id: pr.layers[0].id }]; pr.finish = { ...pr.finish, shutter: 0 };
      let out = null;
      for (let i = 0; i < 400; i++) { out = __lab.renderAt(pr, 0.37 * pr.finish.loop, 96, 54); if (__lab.kits.runtime.programs.has(id) && !__lab.kits.runtime.pendingCompiles) break; await new Promise(r => setTimeout(r, 25)); }
      out = __lab.renderAt(pr, 0.37 * pr.finish.loop, 96, 54);
      let h = 2166136261; for (let i = 0; i < out.data.length; i++) { h ^= out.data[i]; h = Math.imul(h, 16777619) >>> 0; } return h;
    }, id);
    const diff = [];
    for (const id of ids) { const [a, b] = await Promise.all([render(page, id), render(old.page, id)]); if (a !== b) diff.push(id); }
    await old.page.close();
    assert.deepEqual(diff, [], `differs from the baseline: ${diff.join(', ')}`);
    return `${ids.length} styles identical`;
  });

  await step('v2 reference kit installs after capability approval; graph style, effect and transition render', async () => {
    const r = await page.evaluate(async raw => {
      const H = __lab.kitHost, K = __lab.kits, sleep = ms => new Promise(r => setTimeout(r, ms));
      const pre = await H.install(raw, { source: 'file' });
      const inst = await H.install(raw, { source: 'file', approved: ['feedback'] });
      const w = 160, h = 90, mk = () => Object.assign(document.createElement('canvas'), { width: w, height: h });
      const src = mk(), x = src.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(60, 30, 40, 30);
      const blue = mk(), bx = blue.getContext('2d'); bx.fillStyle = '#00f'; bx.fillRect(0, 0, w, h);
      const red = mk(), rx = red.getContext('2d'); rx.fillStyle = '#f00'; rx.fillRect(0, 0, w, h);
      const dst = mk(), dx = dst.getContext('2d', { willReadFrequently: true });
      const S = { w, h, p: 0.2, L: 6, seed: 3, pal: { bg: '#04080C', ink: '#EFFFF8', a: ['#7CF9C0', '#3D8BFF', '#FF5FA2'] } };
      const until = async f => { let v = f(); for (let i = 0; i < 400 && v === 'pending'; i++) { await sleep(25); v = f(); } return v; };
      const fx = await until(() => H.applyEffect('lumen-fx/bloom', dx, src, S));
      const px = (X, Y) => Array.from(dx.getImageData(X, Y, 1, 1).data);
      const halo = px(56, 45), inside = px(80, 45), far = px(5, 5);
      const tr = []; for (const q of [0, 0.5, 1]) { await until(() => H.renderTransition('lumen-fx/iris', dx, red, blue, q, S)); tr.push({ q, center: px(80, 45), corner: px(2, 2) }); }
      const pr = __lab.project; pr.layers = [{ ...__lab.api.timeline.newLayer('lumen-fx/ink-diffusion'), id: pr.layers[0].id }]; pr.finish = { ...pr.finish, shutter: 0, grain: 0 }; // grain is reseeded per frame index
      for (let i = 0; i < 400 && !K.runtime.programs.has('lumen-fx/ink-diffusion'); i++) { __lab.renderAt(pr, 0, 64, 36); await sleep(25); }
      // Loop closure is a runtime property: draw at phase 0 and just before 1 directly (the pipeline adds per-frame finish).
      const rt = K.runtime, hit = K.entry('lumen-fx/ink-diffusion'), spec = K.paramsOf(hit.entry), params = {}; for (const [k2, s2] of Object.entries(spec)) params[k2] = s2.def;
      const grab = p => { rt.draw('lumen-fx/ink-diffusion', 64, 36, { p, L: 6, seed: 417, safe: true, pal: S.pal, params, spec }, {}); const g = rt.canvas.getContext('webgl2'), b = new Uint8Array(64 * 36 * 4); g.readPixels(0, 0, 64, 36, g.RGBA, g.UNSIGNED_BYTE, b); return b; };
      const f0 = grab(0), fL = grab(0.999999), fM = grab(0.5);
      const shown = __lab.renderAt(pr, 1, 64, 36).data; let lit = 0; for (let i = 0; i < shown.length; i += 4) if (shown[i] + shown[i + 1] + shown[i + 2] > 60) lit++;
      let seam = 0, motion = 0; for (let i = 0; i < f0.length; i += 4) { seam += Math.abs(f0[i] - fL[i]); motion += Math.abs(f0[i] - fM[i]); }
      return { needs: pre.needsApproval, caps: (pre.capabilities || []).map(c => c.id), ok: inst.ok, errors: inst.errors, q: inst.quarantined, fx, halo, inside, far, tr, seam: seam / (f0.length / 4), motion: motion / (f0.length / 4), lit, effects: H.effects().map(e => e.id), transitions: H.transitions().map(e => e.id), exporters: H.exporters().map(e => e.id) };
    }, LUMEN);
    assert.equal(r.needs, true); assert.deepEqual(r.caps, ['feedback']); assert.ok(r.ok, (r.errors || []).join('\n')); assert.deepEqual(r.q, []);
    assert.equal(r.fx, 'ok'); assert.ok(r.inside[0] > 200, 'bright input survives'); assert.ok(r.halo[0] > 8, `bloom spreads light outside the rect (${r.halo})`); assert.ok(r.far[0] < r.halo[0], 'glow falls off');
    const [t0, t5, t1] = r.tr;
    assert.ok(t0.center[0] > 200 && t0.center[2] < 60, `progress 0 shows "from" (${t0.center})`);
    assert.ok(t1.center[2] > 200 && t1.corner[2] > 200, `progress 1 shows "to" (${t1.center} ${t1.corner})`);
    assert.ok(t5.center[2] > 200 && t5.corner[2] < 60, `progress 0.5: iris open in the centre only (${t5.center} ${t5.corner})`);
    assert.ok(r.lit > 100, `graph style draws through the pipeline (${r.lit} lit px)`); assert.ok(r.seam < 2, `graph style loops seamlessly (${r.seam.toFixed(2)})`); assert.ok(r.motion > 1, 'graph style animates');
    assert.deepEqual([r.effects, r.transitions, r.exporters], [['lumen-fx/bloom'], ['lumen-fx/iris'], ['lumen-fx/social-loop']]);
    return `seam ${r.seam.toFixed(2)}, motion ${r.motion.toFixed(1)}`;
  });

  await step('hostile kits are rejected with line-numbered diagnostics, without stalling the page', async () => {
    await page.evaluate(() => { __lab.stage.pause(); __lab.setTab('kits'); });
    await settle(page);
    const out = [];
    for (const h of HOSTILE) {
      const r = await page.evaluate(async ({ text, name }) => {
        __mon.reset();
        let ok, threw = null;
        try { ok = await __lab.importKitBytes(new TextEncoder().encode(text), name + '.json'); } catch (e) { threw = String(e.message || e); }
        await new Promise(r => setTimeout(r, 30));
        const panel = document.getElementById('panel-kits');
        return { ok, threw, msg: __lab.kitMsg, diags: __lab.kitDiags, stall: __mon.max, panelText: panel.textContent, polluted: ({}).polluted, installed: __lab.kits.list().map(k => k.id) };
      }, { text: bundleText(h), name: h.name });
      assert.notEqual(r.ok, true, `${h.name} installed`);
      assert.ok(r.threw || (r.msg && r.msg.kind === 'error'), `${h.name}: designed error state`);
      assert.equal(r.polluted, undefined, `${h.name}: prototype pollution`);
      if (h.line) {
        const d = r.diags.find(x => x.code === h.code && x.line === h.line);
        assert.ok(d, `${h.name}: diagnostic ${h.code} at line ${h.line} (got ${JSON.stringify(r.diags.slice(0, 2))})`);
        assert.ok(r.panelText.includes(`styles/main.glsl:${h.line}`), `${h.name}: panel shows file:line`);
      }
      assert.ok(r.stall < STALL_MS, `${h.name}: main thread stalled ${Math.round(r.stall)} ms`);
      out.push(Math.round(r.stall));
    }
    return `${HOSTILE.length} rejected; worst stall ${Math.max(...out)} ms`;
  });

  await step('a statically valid but pathologically slow kit is quarantined by the canary; the stage keeps running', async () => {
    await settle(page);
    const r = await page.evaluate(async raw => {
      __mon.reset(); const t0 = performance.now();
      const ok = await __lab.importKitBytes(new TextEncoder().encode(JSON.stringify(raw)), 'slow.json');
      const ms = performance.now() - t0, stall = __mon.max, gaps = __mon.gaps.slice();
      const k = __lab.kits.list().find(x => x.id === 'h-slow-canary');
      const pr = __lab.project; pr.layers = [{ ...__lab.api.timeline.newLayer('h-slow-canary/main'), id: pr.layers[0].id }]; __lab.setProject(pr);
      const draw = __lab.renderAt(__lab.project, 0.5, 640, 360);
      __lab.stage.play(); __mon.reset();
      let frames = 0; const tEnd = performance.now() + 1500; await new Promise(res => { const f = () => { frames++; if (performance.now() < tEnd) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      __lab.stage.pause();
      return { ok, ms, stall, gaps, q: k && k.styles[0].quarantine, msg: __lab.kitMsg, drawMs: draw.ms, frames, playStall: __mon.max };
    }, SLOW_KIT);
    assert.equal(r.ok, true, 'installs (quarantined) rather than failing');
    assert.ok(r.q && r.q.code === 'canary-slow', `quarantined: ${JSON.stringify(r.q)}`);
    assert.match(r.msg.text, /Quarantined 1: main/);
    assert.ok(r.stall < STALL_MS, `install stalled the main thread ${Math.round(r.stall)} ms (gaps > 200 ms: ${r.gaps.join(', ')})`);
    assert.ok(r.drawMs < (SW ? 2000 : 200), `a quarantined layer draws its placeholder, not its shader (${Math.round(r.drawMs)} ms for a 640×360 frame)`);
    assert.ok(r.frames >= (SW ? 8 : 60), `stage kept producing frames (${r.frames} in 1.5 s)`);
    return `${r.q.reason}; check ${Math.round(r.ms)} ms, worst stall ${Math.round(r.stall)} ms, ${r.frames} frames/1.5 s while showing it`;
  });

  await step('quarantine is visible in the Kits panel and Retry is keyboard-reachable (still quarantined)', async () => {
    await page.evaluate(() => { __lab.setTab('kits'); __lab.renderKitsPanel(); });
    const btn = page.locator('#panel-kits button[data-retry="h-slow-canary/main"]');
    assert.equal(await btn.count(), 1);
    assert.match(await page.locator('#panel-kits .kit-q[role="alert"]').first().textContent(), /quarantined/);
    await btn.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => __lab.kitMsg && /still quarantined|back/.test(__lab.kitMsg.text), null, { timeout: 120000 });
    const q = await page.evaluate(() => __lab.kits.list().find(x => x.id === 'h-slow-canary').styles[0].quarantine);
    assert.ok(q && q.code === 'canary-slow');
  });

  await step('capability approval: review card, keyboard approve (Tab, Enter) and Escape to cancel', async () => {
    const kit = NICE_KIT('media-kit', { extra: { capabilities: ['media'] }, style: { inputs: [{ id: 'src', type: 'image' }] } });
    kit.files['styles/main.glsl'] = 'vec4 motif(vec2 uv, vec2 fc) { vec4 m = m_src(fc / u_res); return vec4(mix(u_bg, m.rgb, u_srcOn), 1.0); }';
    const text = JSON.stringify(kit);
    // Escape cancels.
    await page.evaluate(t => { __lab.importKitBytes(new TextEncoder().encode(t), 'media-kit.json'); }, text);
    await page.waitForFunction(() => __lab.kitReview && document.activeElement && document.activeElement.id === 'kitReview', null, { timeout: 20000 });
    assert.match(await page.locator('#kitReview').textContent(), /media: Reads images or video/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !__lab.kitReview);
    assert.equal(await page.evaluate(() => __lab.kits.list().some(k => k.id === 'media-kit')), false);
    // Tab to "Install and allow", Enter installs.
    await page.evaluate(t => { __lab.importKitBytes(new TextEncoder().encode(t), 'media-kit.json'); }, text);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'kitReview', null, { timeout: 20000 });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Install and allow');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => __lab.kits.list().some(k => k.id === 'media-kit'), null, { timeout: 120000 });
    assert.deepEqual(await page.evaluate(() => __lab.kits.list().find(k => k.id === 'media-kit').approved), ['media']);
  });

  await step('kit text cannot inject markup or script into the app', async () => {
    const kit = NICE_KIT('xss-kit', { name: '<img src=x onerror=__pwned=1>' });
    kit.manifest.description = '<script>window.__pwned=2</script><b onmouseover=__pwned=3>x</b>';
    kit.manifest.styles[0].name = '<svg onload=__pwned=4>';
    const ok = await page.evaluate(async t => __lab.importKitBytes(new TextEncoder().encode(t), 'xss.json'), JSON.stringify(kit));
    assert.equal(ok, true);
    await page.evaluate(() => { __lab.setTab('kits'); __lab.renderKitsPanel(); __lab.setTab('layer'); __lab.setTab('kits'); });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ pwned: window.__pwned, text: document.getElementById('panel-kits').textContent, imgs: document.querySelectorAll('#panel-kits img, #panel-kits script, #panel-kits svg[onload]').length }));
    assert.equal(r.pwned, undefined); assert.equal(r.imgs, 0); assert.ok(r.text.includes('<img src=x onerror=__pwned=1>'), 'shown as text');
  });

  await step('rollback to the previous version and uninstall, from the Kits panel', async () => {
    for (const v of ['1.0.0', '1.1.0']) assert.equal(await page.evaluate(async t => __lab.importKitBytes(new TextEncoder().encode(t), 'roll.json'), JSON.stringify(NICE_KIT('roll-kit', { version: v }))), true);
    let k = await page.evaluate(() => __lab.kits.list().find(x => x.id === 'roll-kit'));
    assert.equal(k.version, '1.1.0'); assert.equal(k.canRollback, true); assert.equal(k.previousVersion, '1.0.0');
    await page.evaluate(() => { __lab.setTab('kits'); __lab.renderKitsPanel(); });
    await page.locator('#panel-kits button[data-rollback="roll-kit"]').click();
    await page.waitForFunction(() => __lab.kits.list().find(x => x.id === 'roll-kit').version === '1.0.0', null, { timeout: 60000 });
    k = await page.evaluate(() => __lab.kits.list().find(x => x.id === 'roll-kit'));
    assert.equal(k.previousVersion, '1.1.0', 'roll forward is offered');
    await page.locator('#panel-kits button[data-remove="roll-kit"]').click();
    assert.equal(await page.evaluate(() => __lab.kits.list().some(x => x.id === 'roll-kit')), false);
  });

  await step('GPU context loss: repeat offender is quarantined; other kit styles recover', async () => {
    assert.equal(await page.evaluate(async t => __lab.importKitBytes(new TextEncoder().encode(t), 'ctx.json'), JSON.stringify(NICE_KIT('ctx-kit'))), true);
    const r = await page.evaluate(async () => {
      const K = __lab.kits, sleep = ms => new Promise(r => setTimeout(r, ms));
      const pr = __lab.project; pr.layers = [{ ...__lab.api.timeline.newLayer('ctx-kit/main'), id: pr.layers[0].id }]; pr.finish = { ...pr.finish, shutter: 0 };
      const ready = async id => { for (let i = 0; i < 400 && !(K.runtime.programs.has(id) && !K.runtime.lost); i++) { __lab.renderAt(pr, 0.2, 64, 36); await sleep(25); } };
      const ext = K.runtime.canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      for (let n = 0; n < 2; n++) {
        await ready('ctx-kit/main'); __lab.renderAt(pr, 0.2, 64, 36);
        ext.loseContext(); await sleep(50);
        for (let i = 0; i < 200 && K.runtime.lost; i++) await sleep(25); // kit-gl asks the browser to restore after 1.5 s
      }
      const q = K.list().find(k => k.id === 'ctx-kit').styles[0].quarantine;
      // A different kit style compiles and draws again after the resets.
      const other = K.list().find(k => k.id === 'cyberpunk').styles[0].id;
      pr.layers = [{ ...__lab.api.timeline.newLayer(other), id: pr.layers[0].id }];
      await ready(other); const d = __lab.renderAt(pr, 0.2, 64, 36).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return { q, lost: K.runtime.lost, resets: K.gpuStatus().resets, sum, other };
    });
    assert.ok(r.q && r.q.code === 'gpu-reset', `quarantined after two resets: ${JSON.stringify(r.q)}`);
    assert.equal(r.lost, false, 'context restored'); assert.ok(r.resets >= 2);
    assert.ok(r.sum > 0, `${r.other} draws after recovery`);
    return `${r.resets} resets`;
  });

  await step('Kits panel: format, kinds, capabilities, report; designed empty state', async () => {
    await page.evaluate(() => { __lab.setTab('kits'); __lab.renderKitsPanel(); });
    const lumen = await page.locator('#panel-kits .kit-card[data-kit="lumen-fx"]').textContent();
    for (const s of ['motif-kit@2', '1 style', '1 effect', '1 transition', '1 export preset', 'feedback', 'Validation report']) assert.ok(lumen.includes(s), `lumen card shows "${s}"`);
    const cyber = await page.locator('#panel-kits .kit-card[data-kit="cyberpunk"]').textContent();
    assert.ok(cyber.includes('motif-kit@1 → motif-kit@2'), 'migration badge');
    await page.locator('#panel-kits .kit-card[data-kit="lumen-fx"] details.kit-report summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#panel-kits .kit-card[data-kit="lumen-fx"] details.kit-report').getAttribute('open'), '');
    assert.match(await page.locator('#panel-kits .kit-card[data-kit="lumen-fx"] details.kit-report table').textContent(), /bloom.*effect/);
    // Empty state: remove every kit (layers first move to a built-in style).
    await page.evaluate(() => { const pr = __lab.project; pr.layers = [{ ...__lab.api.timeline.newLayer('particle-form'), id: pr.layers[0].id }]; __lab.setProject(pr); for (const k of __lab.kits.list()) __lab.kits.remove(k.id); __lab.renderKitsPanel(); });
    assert.match(await page.locator('#panel-kits .kit-empty').textContent(), /No kits installed yet/);
  });

  await step('no network request was made by any kit operation; no page errors', async () => {
    assert.deepEqual(app.requests.slice(netAtStart), []);
    assert.deepEqual(app.errors, []);
  });
} finally { await browser.close(); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
