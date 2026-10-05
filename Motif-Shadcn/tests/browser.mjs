// Motif-Shadcn browser tests (Playwright, software GL): node tests/browser.mjs
// The React islands (audiocn components in shadow roots): boot, isolation, theme bridge, the Console (load, tempo, bars, loop region, band
// console and mappings), the Pads (hold to audition, tap to apply, hotkeys, actions), keyboard isolation from Motif's shortcuts, resilience.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { launch, openShadcn, suite } from './lib.mjs';
import { wavBytes } from './make-wav.mjs';
const { t, done } = suite('Motif-Shadcn browser'); const browser = await launch();
const wav = path.join(os.tmpdir(), 'motif-shadcn-test.wav'); fs.writeFileSync(wav, wavBytes());
const { page, errors } = await openShadcn(browser, { viewport: { width: 1600, height: 1000 }, wait: 3000 });
const isl = (kind, js) => page.evaluate(new Function('kind', `const r = document.querySelector('[data-island=' + kind + ']').shadowRoot; ${js}`), kind);
const hist = () => page.evaluate(() => __lab.historySize);

// ---- boot, isolation, theme ----------------------------------------------------------------------------------------------------
{
  const b = await page.evaluate(() => ({ title: document.title, ver: document.querySelector('.ver').textContent, ms: typeof window.MotifShadcn, tabs: [...document.querySelectorAll('#tabs [role=tab]')].map(x => x.dataset.tab), sheets: document.styleSheets.length, bundle: document.getElementById('motif-shadcn-bundle').textContent.length, graph: typeof __m_graph }));
  t('boots without console errors', errors.length === 0, errors); t('title, version, bundle and the two new pages', b.title === 'Motif-Shadcn' && /SHADCN/.test(b.ver) && b.ms === 'object' && b.tabs.includes('console') && b.tabs.includes('pads') && b.graph === 'object', b);
  t('the interface bundle stays under 700 KB (unminified source size of the embed)', b.bundle < 700000, b.bundle);
  const before = await page.evaluate(() => { const e = document.getElementById('play'); const c = getComputedStyle(e); return [c.boxSizing, c.borderTopWidth, c.fontFamily, c.backgroundColor, document.styleSheets.length]; });
  await page.evaluate(() => __lab.setTab('console')); await page.waitForTimeout(700);
  const after = await page.evaluate(() => { const e = document.getElementById('play'); const c = getComputedStyle(e); return [c.boxSizing, c.borderTopWidth, c.fontFamily, c.backgroundColor, document.styleSheets.length]; });
  t('Tailwind and its reset stay inside the shadow root: the page around it is unchanged', JSON.stringify(before) === JSON.stringify(after), { before, after });
  const th = await isl('console', `const sw = r.querySelector('[role=switch][aria-checked=true]'); const root = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(); return { ms: getComputedStyle(r.host).getPropertyValue('--ms-accent').trim().toLowerCase(), root, bg: sw ? getComputedStyle(sw).backgroundColor : null, btn: getComputedStyle(r.querySelector('button')).fontFamily.slice(0, 30) };`);
  t('shadcn variables come from Motif tokens: the island\'s primary is Motif\'s amber', th.ms === th.root && th.root.length > 3, th);
}

// ---- Console: no audio, then a loaded track -----------------------------------------------------------------------------------
{
  const empty = await isl('console', `return { load: [...r.querySelectorAll('button')].some(b => /Load track/.test(b.textContent)), hint: /MP3, WAV/.test(r.textContent), strips: r.querySelectorAll('[aria-label$=" band, 0 mappings"], [aria-label*=" band,"]').length };`);
  t('with no track the Console offers Load, explains the formats and still shows the 8 band strips', empty.load && empty.hint && empty.strips === 8, empty);
  await page.setInputFiles('#audioFile', wav); await page.waitForTimeout(4500);
  const l = await isl('console', `const k = r.querySelector('[aria-label="Tempo in beats per minute"] [role=slider]'); return { name: r.textContent.includes('motif-shadcn-test.wav'), wave: !!r.querySelector('canvas'), bpm: k ? +k.getAttribute('aria-valuenow') : null, region: !!r.querySelector('[data-slot=waveform-region]'), master: !!r.querySelector('[aria-label="Master level"]'), spectrum: !!r.querySelector('[aria-label="Band spectrum"]') };`);
  const proj = await page.evaluate(() => ({ bpm: __lab.project.audio && __lab.project.audio.bpm, maps: __lab.project.audio ? __lab.project.audio.maps.length : 0 }));
  t('loading a file through the Console decodes and analyses it: name, waveform, loop region, master meter and spectrum', l.name && l.wave && l.region && l.master && l.spectrum, l);
  t('the detected tempo reaches the BPM knob (120 BPM test loop)', l.bpm >= 117 && l.bpm <= 123 && Math.abs(proj.bpm - l.bpm) < 0.2, { l, proj });
  // meters move
  const vals = []; for (let i = 0; i < 10; i++) { vals.push(await isl('console', `return [...r.querySelectorAll('[role=meter]')].map(m => m.getAttribute('aria-valuenow')).join(',');`)); await page.waitForTimeout(110); }
  t('band meters are live: values change as the track plays', new Set(vals).size >= 3, vals.slice(0, 4));
}

// ---- Console: tempo, bars, keyboard isolation, mappings -----------------------------------------------------------------------
{
  const h0 = await hist(), bpm0 = await page.evaluate(() => __lab.project.audio.bpm);
  const k = page.locator('[data-island=console] >> [aria-label="Tempo in beats per minute"] >> [role=slider]');
  await k.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp'); await page.waitForTimeout(400);
  const hArrows = await hist(); await page.keyboard.press('m'); await page.keyboard.press('e'); await page.waitForTimeout(500);
  const afterK = await page.evaluate(() => ({ bpm: __lab.project.audio.bpm, hist: __lab.historySize, playing: __lab.stage.playing }));
  t('the BPM knob responds to the keyboard and commits a tempo change', afterK.bpm > bpm0, { bpm0, afterK });
  t('plain keys typed in a control do not reach Motif\'s shortcuts (M would Mutate, E would Evolve)', afterK.hist === hArrows, { hArrows, afterK });
  const playing0 = await page.evaluate(() => __lab.stage.playing);
  await page.locator('[data-island=console] >> button:has-text("Tap")').first().focus(); await page.keyboard.press('Space'); await page.waitForTimeout(250);
  t('Space on a Console button does not toggle Motif\'s transport', (await page.evaluate(() => __lab.stage.playing)) === playing0);
  await page.locator('[data-island=console] >> [aria-label="4 bars"]').click(); await page.waitForTimeout(400);
  const bars = await page.evaluate(() => ({ bars: __lab.project.audio.bars, loop: __lab.project.finish.loop, bpm: __lab.project.audio.bpm }));
  t('choosing 4 bars snaps the loop to 4 bars at the current tempo', bars.bars === 4 && Math.abs(bars.loop - (4 * 4 * 60) / bars.bpm) < 0.02, bars);
  // mappings
  const m0 = await page.evaluate(() => __lab.project.audio.maps.length), h1 = await hist();
  await page.locator('[data-island=console] >> [aria-label^="Mid band"]').click(); await page.locator('[data-island=console] >> button:has-text("+ Map Mid")').click(); await page.waitForTimeout(400);
  const added = await page.evaluate(() => { const m = __lab.project.audio.maps; return { n: m.length, last: m[m.length - 1] }; });
  t('a mapping is added for the selected band, as one undo step', added.n === m0 + 1 && added.last.band === 'mid' && (await hist()) === h1 + 1, added);
  const amt = page.locator('[data-island=console] >> [aria-label="Amount"] >> [role=slider]').last(); await amt.focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500);
  const am = await page.evaluate(() => { const m = __lab.project.audio.maps; return m[m.length - 1].amount; });
  t('the Amount knob edits the mapping through the shell', Math.abs(am - 0.4) < 0.02, am);
  await page.locator('[data-island=console] >> [aria-label="Target parameter"]').last().click(); await page.waitForTimeout(300);
  const opts = await isl('console', `return r.querySelectorAll('[role=option]').length;`);
  t('the target menu (a Base UI select) opens inside the shadow root with every addressable value, MotifGraph channels included', opts > 20, opts);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.locator('[data-island=console] >> [aria-label="Remove mapping"]').last().click(); await page.waitForTimeout(300);
  t('Remove deletes the mapping; undo brings it back', (await page.evaluate(() => __lab.project.audio.maps.length)) === m0 && (await page.evaluate(async () => { __lab.undo(); await new Promise(r => setTimeout(r, 200)); return __lab.project.audio.maps.length; })) === m0 + 1);
  // loop region by pointer
  const reg = page.locator('[data-island=console] >> [data-slot=waveform-region]'); const off0 = await page.evaluate(() => __lab.project.audio.offset);
  const bb = await reg.boundingBox(); if (bb) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 + 40, bb.y + bb.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(900); }
  const off1 = await page.evaluate(() => __lab.project.audio.offset);
  t('dragging the loop region moves where the loop starts (snapped to a beat)', bb && Math.abs(off1 - off0) > 0.05, { off0, off1, bb: !!bb });
}

// ---- Pads ----------------------------------------------------------------------------------------------------------------------------------
{
  await page.evaluate(() => __lab.setTab('pads')); await page.waitForTimeout(600);
  const n = await isl('pads', `return { pads: r.querySelectorAll('[data-sound-pad]').length, hotkeys: [...r.querySelectorAll('[data-sound-pad]')].filter(p => p.getAttribute('aria-keyshortcuts')).length };`);
  t('sixteen pads: twelve presets and four actions, ten with number hotkeys', n.pads === 16 && n.hotkeys >= 10, n);
  const h0 = await hist(); const pad = page.locator('[data-island=pads] >> [data-sound-pad]').nth(1); const bb = await pad.boundingBox();
  await page.mouse.move(bb.x + 20, bb.y + 20); await page.mouse.down(); await page.waitForTimeout(500);
  const held = await page.evaluate(() => ({ aud: !document.getElementById('aud').hidden, name: document.getElementById('audName').textContent, hist: __lab.historySize, graph: !!__lab.project.layers.find(l => l.id === __lab.project.active).graph }));
  await page.mouse.up(); await page.waitForTimeout(300);
  const rel = await page.evaluate(() => !document.getElementById('aud').hidden);
  t('holding a pad auditions the preset on the stage (no undo step, project untouched); releasing leaves', held.aud && /Grid cascade/.test(held.name) && held.hist === h0 && !held.graph && !rel, { held, rel });
  await page.keyboard.down('3'); await page.waitForTimeout(500); const hk = await page.evaluate(() => ({ aud: !document.getElementById('aud').hidden, name: document.getElementById('audName').textContent })); await page.keyboard.up('3'); await page.waitForTimeout(250);
  t('number hotkeys fire pads while the page is open (hold 3 = Type wave)', hk.aud && /Type wave/.test(hk.name), hk);
  await page.locator('[data-island=pads] >> [aria-label="Hold to audition"]').click(); await page.waitForTimeout(250);
  await pad.click(); await page.waitForTimeout(600);
  const tap = await page.evaluate(() => ({ graph: !!__lab.project.layers.find(l => l.id === __lab.project.active).graph, hist: __lab.historySize }));
  t('in Tap mode a pad applies the preset to the active layer as one undo step', tap.graph && tap.hist === h0 + 1, { tap, h0 });
  const h2 = await hist(); await page.locator('[data-island=pads] >> [data-sound-pad]').nth(14).click(); await page.waitForTimeout(500);
  t('the Undo pad undoes', (await hist()) <= h2 && !(await page.evaluate(() => !!__lab.project.layers.find(l => l.id === __lab.project.active).graph)), { h2 });
  await page.evaluate(() => __lab.setTab('layer')); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.keyboard.down('3'); await page.waitForTimeout(400); const off = await page.evaluate(() => !document.getElementById('aud').hidden); await page.keyboard.up('3');
  t('pad hotkeys stop when the Pads tab is not showing', !off);
}

// ---- resilience and accessibility ---------------------------------------------------------------------------------------------------------
{
  await page.evaluate(() => __lab.setTab('console')); await page.waitForTimeout(600);
  const sw = page.locator('[data-island=console] >> [aria-label="Microphone or line in"]'); await sw.click(); await page.waitForTimeout(800);
  const live = await page.evaluate(() => ({ ok: true, errs: 0 }));
  t('Live input without a microphone fails politely (the switch stays off, the page stays alive)', live.ok && (await sw.getAttribute('aria-checked')) === 'false');
  const names = await page.evaluate(() => { const out = { n: 0, bad: [] }; for (const k of ['console', 'pads']) { __lab.setTab(k); } return out; });
  for (const k of ['console', 'pads']) { await page.evaluate(x => __lab.setTab(x), k); await page.waitForTimeout(500); const r = await isl(k, `const out = { n: 0, bad: [] }; const nm = e => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.title || '').trim(); for (const e of r.querySelectorAll('button,[role=slider],[role=switch],[role=meter],[role=radio],select,input')) { if (!e.offsetParent || e.getAttribute('aria-hidden') === 'true') continue; out.n++; if (!nm(e)) out.bad.push(e.outerHTML.slice(0, 80)); } return out;`); t(`every control in the ${k} island has an accessible name (${r.n} checked)`, r.bad.length === 0 && r.n > 8, r.bad.slice(0, 3)); }
  t('no console errors across the suite', errors.length === 0, errors);
}
await browser.close(); done();
