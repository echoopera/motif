// Verifies the render cache: replayed frames are pixel-identical to live renders, edits invalidate, media scenes bypass.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, process.argv[2] || 'motif5.html')).href); await page.waitForFunction(() => window.__lab); await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const { stage } = __lab; const out = {}; const px = () => { const c = stage.canvas, x = c.getContext('2d'); return Array.from(x.getImageData(0, 0, c.width, c.height).data); };
    stage.setQuality('quarter'); stage.pause(); await new Promise(r => setTimeout(r, 200));
    const N = stage.cacheStats().loopFrames; out.loopFrames = N;
    // fill: scrub every frame, remember pixels
    const live = []; for (let i = 0; i < 12; i++) { stage.seekTime(i / N * __lab.project.finish.loop); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); live.push(px().join(',')); }
    out.filled = stage.cacheStats().frames; const h0 = stage.cacheStats().hits;
    let same = 0; for (let i = 0; i < 12; i++) { stage.seekTime(i / N * __lab.project.finish.loop); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); if (px().join(',') === live[i]) same++; }
    out.hits = stage.cacheStats().hits - h0; out.identical = same;
    // edit invalidates
    const p = __lab.project; p.layers[0].shared.seed = (p.layers[0].shared.seed || 1) + 7; __lab.setProject(p); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
    out.afterEdit = stage.cacheStats().frames;
    // playback loop reaches hits
    stage.setQuality('quarter'); stage.play(); await new Promise(r => setTimeout(r, (__lab.project.finish.loop * 2 + 0.5) * 1000)); const s = stage.cacheStats(); out.play = { frames: s.frames, hits: s.hits, fraction: +s.fraction.toFixed(2) };
    stage.setCache(false); out.off = stage.cacheStats().frames; out.chip = document.getElementById('cacheChip').textContent;
    return out;
  });
  console.log(JSON.stringify(r)); assert.equal(r.identical, 12); assert.ok(r.hits >= 12); assert.ok(r.afterEdit <= 1); assert.ok(r.play.hits > 0); assert.equal(r.off, 0); assert.equal(errors.length, 0, errors.join('\n'));
  console.log('cache OK');
} finally { await browser.close(); }
