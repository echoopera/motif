// Accessibility + keyboard checks for the Motif 5 shell, run in real Chromium with real key events.
//   SOFTWARE_GL=1 node tests/browser/a11y.mjs [--focus-shots]   (--focus-shots: pixel-compare every tab stop focused vs blurred; slow on software GL)
// What this is: automated keyboard traversal, ARIA/roving-tabindex checks, computed contrast, reduced motion, reflow and target-size
// measurements. What it is NOT: a screen-reader run, a WCAG conformance claim, or a substitute for assistive-technology testing.
// Known open defects live in KNOWN below and in docs/a11y-findings.md; they print KNOWN and do not fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { root, flag, launch, openApp, suite } from './lib.mjs';
import { checkTokens } from '../../tools/contrast.mjs';

// Deliberately open (documented in docs/a11y-findings.md with severity, owner decision needed):
const KNOWN = [
  'aria:no-interactive-inside-option',        // layer rows are role=option containing the eye button; needs a row restructure
  'targets:desktop>=24px',                    // edge-of-track keyframe diamonds whose padded hit area is clipped by the track
  'targets:touch>=44px (studio standard)',    // coarse-pointer tokens are 40/32 px; raising them reflows the dense editor
];
const s = suite('a11y', KNOWN), shots = flag('focus-shots');
const outDir = path.join(root, 'tests/a11y-out'); fs.mkdirSync(outDir, { recursive: true });

// ---- page-side helpers (installed once per page) ----
const HELPERS = `(() => {
  const vis = e => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (e.closest('.file')) return false; for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || n.hidden || n.getAttribute('aria-hidden') === 'true') return false; } return true; };
  // Focus indicator: any change in outline/box-shadow/border/background/colour (also on ::before/::after) between focused and blurred state.
  const FOCUS_PROPS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'borderTopColor', 'borderTopWidth', 'backgroundColor', 'color', 'textDecorationLine', 'filter', 'opacity'];
  const snap = e => { const o = {}; for (const pe of [null, '::before', '::after']) { const cs = getComputedStyle(e, pe); for (const p of FOCUS_PROPS) o[(pe || '') + p] = cs[p]; if (pe) o[pe + 'content'] = cs.content; } return o; };
  const focusDiff = e => { const a = snap(e); e.blur(); const b = snap(e); e.focus(); return Object.keys(a).filter(k => a[k] !== b[k]); };
  // Hit area: does a 24x24 CSS px square centred on the control still hit it (counts ::before/::after padding)?
  const hit24 = e => { const r = e.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2; return [[-11, -11], [11, -11], [-11, 11], [11, 11], [0, -11], [0, 11], [-11, 0], [11, 0]].every(([dx, dy]) => { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true; const h = document.elementFromPoint(x, y); return h && (e === h || e.contains(h) || h.contains(e) && h !== document.documentElement && !h.matches('body,.app')); }); };
  const name = el => {
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    if (el.labels && el.labels.length) { const t = [...el.labels].map(l => l.textContent.trim()).join(' ').trim(); if (t) return t; }
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '';
    const tag = el.tagName; if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) { const own = el.textContent.replace(/\\s+/g, ' ').trim(); if (own) return own; }
    return el.getAttribute('title') || '';
  };
  const REGIONS = [['header.bar', 'header'], ['#panel-library', 'library'], ['#stageCol', 'stage'], ['#lane', 'timeline'], ['#tabs', 'tablist'], ['#insp', 'inspector'], ['footer.pagebar', 'footer'], ['.split', 'splitter'], ['dialog[open]', 'dialog'], ['#pal', 'palette'], ['.evolve', 'evolve']];
  const region = el => { for (const [sel, n] of REGIONS) if (el.closest(sel)) return n; return 'other'; };
  const sel = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const describe = el => { const r = el.getBoundingClientRect(); return { sel: sel(el), name: name(el).slice(0, 60), region: region(el), role: el.getAttribute('role') || '', tabindex: el.getAttribute('tabindex'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), outline: getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth }; };
  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=radio],[role=option],[role=switch],[role=slider],[role=separator][tabindex],[tabindex]:not([tabindex="-1"])';
  window.__a = { vis, name, region, sel, describe, INTERACTIVE, focusDiff, hit24 };
})()`;

async function prep(page) { await page.addScriptTag({ content: HELPERS }); await page.addStyleTag({ content: '*{caret-color:transparent!important}' }); }

async function tabStops(page, { max = 400, shotsOn = false, label = '' } = {}) {
  const stops = []; let first = null;
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; window.__t = e; return window.__a.describe(e); });
    if (!d) { stops.push(null); if (stops.filter(x => !x).length >= 2) break; continue; }
    const key = d.sel + '|' + d.x + ',' + d.y; if (first == null) first = key; else if (key === first) break;
    d.focusChanged = await page.evaluate(() => window.__a.focusDiff(window.__t));
    if ((shotsOn || d.focusChanged.length === 0) && d.w > 0) {
      const pad = 6, clip = { x: Math.max(0, d.x - pad), y: Math.max(0, d.y - pad), width: Math.min(d.w + pad * 2, 1440), height: Math.min(d.h + pad * 2, 900) };
      try {
        if (clip.x + clip.width > 1440) clip.width = 1440 - clip.x; if (clip.y + clip.height > 900) clip.height = 900 - clip.y;
        const a = await page.screenshot({ clip }); await page.evaluate(() => window.__t.blur()); const b = await page.screenshot({ clip }); await page.evaluate(() => window.__t.focus());
        d.focusVisible = !a.equals(b);
      } catch { d.focusVisible = null; }
    }
    stops.push(d);
  }
  return stops;
}

const browser = await launch();
try {
  // =============================== 1. keyboard traversal (desktop) ===============================
  {
    const app = await openApp(browser, { pauseStage: true }); const { page } = app; await prep(page);
    const stops = (await tabStops(page, { shotsOn: shots })).filter(Boolean);
    fs.writeFileSync(path.join(outDir, 'tab-order.json'), JSON.stringify(stops, null, 1));
    s.info('kbd:stops', `${stops.length} tab stops in the default (Build) layout`);
    const regions = [...new Set(stops.map(x => x.region))];
    for (const r of ['header', 'library', 'stage', 'timeline', 'tablist', 'inspector', 'footer']) s.check(`kbd:region-reachable:${r}`, regions.includes(r), regions.includes(r) ? '' : 'no tab stop inside the region', 'blocker');
    const trapped = stops.length >= 399; s.check('kbd:no-trap', !trapped && stops.length > 20, `traversal returned to the start after ${stops.length} stops`, 'blocker');
    const unnamed = stops.filter(x => !x.name); s.check('kbd:stops-have-names', unnamed.length === 0, unnamed.slice(0, 6).map(x => x.sel).join(', '));
    const posTab = await page.evaluate(() => [...document.querySelectorAll('[tabindex]')].filter(e => +e.getAttribute('tabindex') > 0).length); s.check('kbd:no-positive-tabindex', posTab === 0, `${posTab} elements`);
    {
      // Indicator present = computed style differs when focused (outline/shadow/border/colour, incl. pseudo-elements); controls with no style change are
      // verified by comparing screenshots with and without focus (all stops with --focus-shots).
      const noVis = stops.filter(x => (x.focusChanged.length === 0 && x.focusVisible !== true) || x.focusVisible === false);
      s.check('kbd:focus-visible-indicator', noVis.length === 0, `${stops.length - noVis.length}/${stops.length} stops show a focus indicator; missing: ${noVis.slice(0, 8).map(x => x.sel + ' "' + x.name + '"').join(' | ')}`);
      const thin = stops.filter(x => x.focusChanged.length && !x.focusChanged.some(k => /^outline|boxShadow|border|::/.test(k)) && x.focusVisible !== true);
      s.info('kbd:focus-indicator-kind', `${stops.filter(x => /outline/.test(x.focusChanged.join())).length} outline, ${stops.filter(x => /boxShadow/.test(x.focusChanged.join())).length} shadow, ${thin.length} colour-only`);
    }
    // focus order: the inspector tab list must lead into its own panel, not through the footer
    const iTab = stops.findIndex(x => x.region === 'tablist'), lastTab = stops.map(x => x.region).lastIndexOf('tablist');
    const afterTabs = stops[lastTab + 1]; s.check('kbd:tablist-leads-to-panel', afterTabs && afterTabs.region === 'inspector', `after the last tab Tab lands in: ${afterTabs ? afterTabs.region + ' ' + afterTabs.sel : 'nothing'}`);
    // reverse traversal reaches the last stop from the first (cycle, no trap)
    await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    const back = await page.evaluate(() => (document.activeElement === document.body ? 'body' : window.__a.sel(document.activeElement))); s.check('kbd:shift-tab-leaves-start', back !== 'html', `Shift+Tab from first stop -> ${back}`);
    // ---- every inspector tab: traverse its panel ----
    const tabIds = await page.$$eval('#tabs [role=tab]', bs => bs.filter(b => b.offsetParent).map(b => b.dataset.tab));
    for (const t of tabIds) {
      await page.evaluate(t => window.__lab.setTab(t), t); await page.waitForTimeout(150);
      const n = await page.evaluate(() => { const p = document.querySelector('#insp [role=tabpanel]:not([hidden])'); return p ? [...p.querySelectorAll(window.__a.INTERACTIVE)].filter(window.__a.vis).length : -1; });
      const bad = await page.evaluate(() => { const p = document.querySelector('#insp [role=tabpanel]:not([hidden])'); if (!p) return ['no visible tabpanel']; return [...p.querySelectorAll(window.__a.INTERACTIVE)].filter(window.__a.vis).filter(e => !window.__a.name(e)).map(e => window.__a.sel(e)); });
      s.check(`tab:${t}:panel-shows`, n >= 0, `${n} interactive controls`); s.check(`tab:${t}:controls-named`, bad.length === 0, bad.slice(0, 5).join(', '));
      const ptab = await page.evaluate(t => { const b = document.querySelector(`#tabs [data-tab=${t}]`), p = document.querySelector('#insp [role=tabpanel]:not([hidden])'); return { sel: b.getAttribute('aria-selected'), ctl: b.getAttribute('aria-controls'), exists: !!document.getElementById(b.getAttribute('aria-controls')), panelLabel: p && (p.getAttribute('aria-labelledby') || p.getAttribute('aria-label')) }; }, t);
      s.check(`tab:${t}:aria`, ptab.sel === 'true' && ptab.exists, JSON.stringify(ptab));
    }
    s.check('page:no-errors-kbd', app.errors.length + app.consoleErrors.length === 0, app.errors.concat(app.consoleErrors).join(' | '));
    await app.ctx.close();
  }

  // =============================== 2. tablist + radiogroup semantics (APG) ===============================
  {
    const app = await openApp(browser); const { page } = app; await prep(page);
    await page.evaluate(() => window.__lab.setTab('layer'));
    const tl = await page.evaluate(() => { const bs = [...document.querySelectorAll('#tabs [role=tab]')].filter(window.__a.vis); return { n: bs.length, stops: bs.filter(b => b.tabIndex >= 0).length }; });
    s.check('tablist:roving-tabindex', tl.stops === 1, `${tl.stops} of ${tl.n} tabs are tab stops (APG: exactly 1)`);
    await page.focus('#tabs [aria-selected=true]'); const seq = [];
    for (const k of ['ArrowRight', 'ArrowRight', 'End', 'Home', 'ArrowLeft']) { await page.keyboard.press(k); seq.push(await page.evaluate(() => `${document.activeElement.dataset.tab}:${document.activeElement.getAttribute('aria-selected')}`)); }
    const order = await page.$$eval('#tabs [role=tab]', bs => bs.filter(b => b.offsetParent).map(b => b.dataset.tab));
    const want = [order[1], order[2], order[order.length - 1], order[0], order[order.length - 1]].map(t => t + ':true');
    s.check('tablist:arrow-home-end', JSON.stringify(seq) === JSON.stringify(want), `got ${seq.join(' ')} want ${want.join(' ')}`);
    await page.evaluate(() => window.__lab.setTab('layer'));
    // radiogroups: all visible, across tabs
    const groups = [];
    for (const t of ['layer', 'colour', 'finish', 'audio', 'looks', 'kits']) {
      await page.evaluate(t => window.__lab.setTab(t), t); await page.waitForTimeout(120);
      const gs = await page.evaluate(() => [...document.querySelectorAll('[role=radiogroup]')].filter(window.__a.vis).map((g, i) => { g.dataset.rg = 'rg' + i; const rs = [...g.querySelectorAll('[role=radio]')].filter(window.__a.vis); return { id: 'rg' + i, label: g.getAttribute('aria-label') || '', n: rs.length, stops: rs.filter(r => r.tabIndex >= 0 && !r.disabled).length, checked: rs.filter(r => r.getAttribute('aria-checked') === 'true').length, missingChecked: rs.filter(r => !r.hasAttribute('aria-checked')).length }; }));
      for (const g of gs) groups.push({ tab: t, ...g });
    }
    const dedup = new Map(groups.map(g => [g.label + '|' + g.n, g]));
    for (const g of dedup.values()) {
      s.check(`radiogroup:${g.tab}:${g.label || '(unnamed)'}:named`, !!g.label, g.label ? '' : 'radiogroup has no aria-label', 'minor');
      s.check(`radiogroup:${g.tab}:${g.label || '?'}:aria-checked`, g.missingChecked === 0 && g.checked === 1, `${g.checked} checked, ${g.missingChecked} radios lacking aria-checked`);
      if (g.n > 1) s.check(`radiogroup:${g.tab}:${g.label || '?'}:roving-tabindex`, g.stops === 1, `${g.stops} of ${g.n} radios are tab stops (APG: exactly 1)`);
    }
    // arrow-key behaviour on the three always-visible groups
    for (const [sel, nm] of [['#libView', 'Library view'], ['#aspects', 'Aspect ratio'], ['#layouts', 'Workspace layout']]) {
      const before = await page.$eval(sel + ' [aria-checked=true]', e => e.textContent + e.getAttribute('aria-label'));
      await page.focus(sel + ' [aria-checked=true]'); await page.keyboard.press('ArrowRight');
      const after = await page.evaluate(sel => ({ checked: document.querySelector(sel + ' [aria-checked=true]'), focus: document.activeElement.closest(sel) ? document.activeElement : null }), sel).catch(() => null);
      const res = await page.evaluate(sel => { const c = document.querySelector(sel + ' [aria-checked=true]'); return { text: c.textContent + c.getAttribute('aria-label'), focusInside: !!document.activeElement.closest(sel), focusIsChecked: document.activeElement === c }; }, sel);
      s.check(`radiogroup:arrow:${nm}`, res.text !== before && res.focusIsChecked, `ArrowRight: selection ${before} -> ${res.text}; focus follows: ${res.focusIsChecked}`);
    }
    await app.ctx.close();
  }

  // =============================== 3. dialogs, palette, evolve ===============================
  {
    const app = await openApp(browser); const { page } = app; await prep(page);
    const focusInside = sel => page.evaluate(sel => !!document.activeElement.closest(sel), sel);
    const dialogs = [
      { id: 'export', open: async () => { await page.focus('#exportBtn'); await page.keyboard.press('Enter'); }, inside: '#exportDlg', opener: '#exportBtn', modal: true },
      { id: 'shortcuts', open: async () => { await page.focus('#keysBtn'); await page.keyboard.press('Enter'); }, inside: '#keysDlg', opener: '#keysBtn', modal: true },
      { id: 'palette', open: async () => { await page.focus('#cmdBtn'); await page.keyboard.press('Control+k'); }, inside: '#pal', opener: '#cmdBtn', modal: true },
      { id: 'evolve', open: async () => { await page.focus('#evolveBtn'); await page.keyboard.press('Enter'); }, inside: '#evolve', opener: '#evolveBtn', modal: false },
    ];
    for (const d of dialogs) {
      await d.open(); await page.waitForTimeout(400);
      s.check(`dialog:${d.id}:focus-moves-in`, await focusInside(d.inside), 'focus after opening');
      const meta = await page.evaluate(sel => { const e = document.querySelector(sel); const dlg = e.matches('dialog,[role=dialog]') ? e : e.querySelector('[role=dialog]'); return { role: dlg.getAttribute('role') || dlg.tagName.toLowerCase(), name: dlg.getAttribute('aria-label') || (dlg.getAttribute('aria-labelledby') && document.getElementById(dlg.getAttribute('aria-labelledby')).textContent) || '', modal: dlg.tagName === 'DIALOG' || dlg.getAttribute('aria-modal') === 'true' }; }, d.inside);
      s.check(`dialog:${d.id}:role-and-name`, !!meta.name && /dialog/i.test(meta.role), JSON.stringify(meta));
      if (d.modal) { let escaped = false; for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (!(await focusInside(d.inside)) && !(await page.evaluate(() => document.activeElement === document.body))) { escaped = true; break; } } s.check(`dialog:${d.id}:focus-contained`, !escaped, '25 Tab presses never land on the page behind the modal (focus may move to browser UI / body)'); }
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const closed = await page.evaluate(sel => { const e = document.querySelector(sel); return e.matches('dialog') ? !e.open : e.hidden || !window.__a.vis(e); }, d.inside);
      s.check(`dialog:${d.id}:esc-closes`, closed, '');
      s.check(`dialog:${d.id}:focus-returns`, await page.evaluate(sel => document.activeElement === document.querySelector(sel), d.opener), `active: ${await page.evaluate(() => window.__a.sel(document.activeElement))}`);
    }
    // shortcut-key openers
    await page.focus('#stageCol'); await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('?'); await page.waitForTimeout(200);
    s.check('dialog:shortcuts:opens-with-?', await page.evaluate(() => document.getElementById('keysDlg').open), ''); await page.keyboard.press('Escape');
    // export dialog: every control reachable + named; formats radiogroup
    await page.focus('#exportBtn'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('#exportDlg ' + window.__a.INTERACTIVE)].filter(window.__a.vis).filter(e => !window.__a.name(e)).map(e => window.__a.sel(e)));
    s.check('dialog:export:controls-named', unnamed.length === 0, unnamed.join(', '));
    await page.keyboard.press('Escape');
    // command palette: combobox pattern
    await page.keyboard.press('Control+k'); await page.waitForTimeout(250); await page.keyboard.type('neuro'); await page.waitForTimeout(250);
    const pal = await page.evaluate(() => { const i = document.getElementById('palIn'), l = document.getElementById('palList'); return { role: i.getAttribute('role'), expanded: i.getAttribute('aria-expanded'), controls: i.getAttribute('aria-controls'), active: i.getAttribute('aria-activedescendant'), options: l.querySelectorAll('[role=option]').length, selected: l.querySelectorAll('[aria-selected=true]').length }; });
    s.check('palette:combobox-aria', pal.role === 'combobox' && pal.controls === 'palList' && pal.options > 0, JSON.stringify(pal));
    s.check('palette:activedescendant', !!pal.active, `aria-activedescendant=${pal.active} (selected option is only conveyed via aria-selected)`, 'minor');
    const before = await page.evaluate(() => window.__lab.project.layers[0].styleId); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__lab.project.layers.map(l => l.styleId).join(',')); s.check('palette:keyboard-applies', after.includes('/') || after !== before, `styles ${before} -> ${after}`);
    s.check('palette:closed-after-run', await page.evaluate(() => document.getElementById('pal').hidden), '');
    s.check('page:no-errors-dialogs', app.errors.length + app.consoleErrors.length === 0, app.errors.concat(app.consoleErrors).join(' | '));
    await app.ctx.close();
  }

  // =============================== 4. library / stage / timeline ===============================
  {
    const app = await openApp(browser); const { page } = app; await prep(page);
    const lib = await page.evaluate(() => { const l = document.getElementById('libList'), o = [...l.querySelectorAll('[role=option]')]; return { role: l.getAttribute('role'), n: o.length, selected: o.filter(x => x.getAttribute('aria-selected') === 'true').length, named: o.filter(x => window.__a.name(x)).length, activedesc: l.getAttribute('aria-activedescendant'), tabbable: o.filter(x => x.tabIndex >= 0).length }; });
    s.check('library:listbox-options', lib.role === 'listbox' && lib.n > 20 && lib.named === lib.n, JSON.stringify(lib));
    s.check('library:single-tab-stop', lib.tabbable <= 1 || !!lib.activedesc, `${lib.tabbable} options are tab stops, aria-activedescendant=${lib.activedesc}`, 'minor');
    const st0 = await page.evaluate(() => window.__lab.project.layers.find(l => l.id === window.__lab.project.active).styleId);
    await page.focus('#libList'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
    const st1 = await page.evaluate(() => window.__lab.project.layers.find(l => l.id === window.__lab.project.active).styleId); s.check('library:arrow-selects-style', st0 !== st1, `${st0} -> ${st1}`);
    await page.keyboard.press('Enter');
    // stage: named + not a pointer-only target
    const stage = await page.evaluate(() => { const c = document.querySelector('#stageBox canvas'); return c ? { label: c.getAttribute('aria-label') || '', role: c.getAttribute('role') } : null; });
    s.check('stage:canvas-has-text-alternative', !!(stage && stage.label), JSON.stringify(stage));
    // scrubber is keyboard operable
    await page.focus('#scrub'); const v0 = await page.$eval('#scrub', e => +e.value); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); const v1 = await page.$eval('#scrub', e => +e.value);
    s.check('stage:scrub-slider-keyboard', v1 !== v0, `${v0} -> ${v1}`);
    // transport shortcuts
    await page.evaluate(() => document.activeElement.blur()); const playing0 = await page.evaluate(() => window.__lab.stage.playing); await page.keyboard.press('Space'); const playing1 = await page.evaluate(() => window.__lab.stage.playing);
    s.check('stage:space-toggles-play', playing0 !== playing1, `${playing0} -> ${playing1}`);
    await page.keyboard.press('Space');
    // timeline: keys reachable, named, moveable
    const keys = await page.evaluate(() => { const bs = [...document.querySelectorAll('#lane button')].filter(window.__a.vis); return { n: bs.length, unnamed: bs.filter(b => !window.__a.name(b)).length, small: bs.filter(b => b.getBoundingClientRect().width < 24 || b.getBoundingClientRect().height < 24).length, label: document.getElementById('lane').getAttribute('aria-label') }; });
    s.check('timeline:landmark-and-names', keys.label && keys.unnamed === 0, JSON.stringify(keys));
    const moved = await page.evaluate(async () => { const b = [...document.querySelectorAll('#lane button')].find(x => /key 1 at/.test(x.getAttribute('aria-label') || '')); if (!b) return null; b.focus(); const p0 = JSON.stringify(window.__lab.project.keys); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })); await new Promise(r => setTimeout(r, 100)); return p0 !== JSON.stringify(window.__lab.project.keys); });
    s.check('timeline:alt-arrow-nudges-key', moved === true, `moved=${moved}`, 'minor');
    // 4.1 splitters: focusable separators need value semantics
    const spl = await page.evaluate(() => [...document.querySelectorAll('[role=separator][tabindex]')].map(e => ({ id: e.id, name: e.getAttribute('aria-label'), now: e.getAttribute('aria-valuenow'), min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax') })));
    const noVal = spl.filter(x => x.now == null || x.min == null || x.max == null); s.check('splitters:aria-values', spl.length > 0 && noVal.length === 0, `${noVal.length}/${spl.length} focusable separators lack aria-valuenow/min/max: ${noVal.map(x => x.id).join(', ')}`, 'minor');
    // 4.2 generic ARIA hygiene
    const hyg = await page.evaluate(() => {
      const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); const dup = Object.keys(ids).filter(k => ids[k] > 1);
      const need = { radio: ['aria-checked'], tab: ['aria-selected'], option: [], switch: [], slider: ['aria-valuenow'], combobox: ['aria-expanded'] };
      const missing = []; for (const [role, attrs] of Object.entries(need)) document.querySelectorAll(`[role=${role}]`).forEach(e => { if (!window.__a.vis(e)) return; for (const a of attrs) if (!e.hasAttribute(a)) missing.push(`${window.__a.sel(e)} lacks ${a}`); if (!window.__a.name(e)) missing.push(`${window.__a.sel(e)} has no name`); });
      const badRef = []; document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]').forEach(e => { for (const a of ['aria-controls', 'aria-labelledby', 'aria-describedby']) (e.getAttribute(a) || '').split(/\s+/).filter(Boolean).forEach(id => { if (!document.getElementById(id)) badRef.push(`${window.__a.sel(e)} ${a}=${id}`); }); });
      const nested = [...document.querySelectorAll('[role=option]')].filter(o => o.querySelector('button,a[href],input,select')).map(o => window.__a.sel(o));
      const unnamedAll = [...document.querySelectorAll('button,input:not([type=hidden]):not(.file),select,textarea,[role=button]')].filter(window.__a.vis).filter(e => !window.__a.name(e)).map(e => window.__a.sel(e));
      const imgs = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
      return { dup, missing, badRef: badRef.slice(0, 8), nested: [...new Set(nested)], unnamedAll, imgsNoAlt: imgs, lang: document.documentElement.lang, title: document.title, landmarks: [...document.querySelectorAll('header,main,nav,aside,footer,[role=main],[role=navigation]')].length };
    });
    s.check('aria:no-duplicate-ids', hyg.dup.length === 0, hyg.dup.join(', ')); s.check('aria:required-attrs-and-names', hyg.missing.length === 0, hyg.missing.slice(0, 6).join(' | '));
    s.check('aria:references-resolve', hyg.badRef.length === 0, hyg.badRef.join(' | ')); s.check('aria:interactive-named', hyg.unnamedAll.length === 0, hyg.unnamedAll.slice(0, 6).join(', '));
    s.check('aria:no-interactive-inside-option', hyg.nested.length === 0, `role=option containing buttons/inputs: ${hyg.nested.join(', ')}`, 'minor');
    s.check('aria:img-alt', hyg.imgsNoAlt === 0, `${hyg.imgsNoAlt} <img> without alt`); s.check('doc:lang-title-landmarks', !!hyg.lang && !!hyg.title && hyg.landmarks >= 4, JSON.stringify({ lang: hyg.lang, title: hyg.title, landmarks: hyg.landmarks }));
    s.check('live:toast-status-region', await page.evaluate(() => { const t = document.getElementById('toast'); return t.getAttribute('role') === 'status' || t.getAttribute('aria-live') === 'polite'; }), '');
    // 4.3 colour not the only carrier: state toggles expose aria-pressed/checked/selected
    const toggles = await page.evaluate(() => [...document.querySelectorAll('.tog,#audBtn,#guidesBtn')].filter(window.__a.vis).filter(b => !b.hasAttribute('aria-pressed')).map(b => b.id)); s.check('state:toggle-buttons-expose-pressed', toggles.length === 0, toggles.join(', '));
    s.check('page:no-errors-main', app.errors.length + app.consoleErrors.length === 0, app.errors.concat(app.consoleErrors).join(' | '));
    await app.ctx.close();
  }

  // =============================== 5. contrast ===============================
  {
    const bad = checkTokens('live').filter(r => !r.ok);
    s.check('contrast:tokens-live', bad.length === 0, bad.length ? bad.map(r => `${r.fg} on ${r.bg} ${r.ratio} (<${r.need}, ${r.kind})`).join('; ') : `${checkTokens('live').length} token pairs (text >= 4.5, UI/focus >= 3)`);
    const app = await openApp(browser); const { page } = app; await prep(page);
    const all = [];
    for (const t of ['layer', 'colour', 'finish', 'audio', 'looks', 'kits']) {
      await page.evaluate(t => window.__lab.setTab(t), t); await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
        const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const bgOf = el => { let acc = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { acc.push(c); if (c.a >= 1) break; } } let base = { r: 6, g: 6, b: 8 }; for (let i = acc.length - 1; i >= 0; i--) { const c = acc[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; } return base; };
        const out = [], seen = new Set();
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const txt = n.textContent.trim(); if (!txt) continue; const el = n.parentElement; if (!el || !window.__a.vis(el) || el.closest('canvas,svg,script,style,[disabled],[aria-disabled=true],.hud-tag')) continue;
          const cs = getComputedStyle(el); if (cs.opacity === '0') continue; const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
          let opacity = 1; for (let p = el; p; p = p.parentElement) opacity *= +getComputedStyle(p).opacity; const a = fg.a * opacity; const eff = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
          const l1 = lum(eff), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
          const key = window.__a.sel(el) + cs.color + ratio.toFixed(1); if (seen.has(key)) continue; seen.add(key);
          out.push({ sel: window.__a.sel(el), text: txt.slice(0, 28), ratio: +ratio.toFixed(2), need: large ? 3 : 4.5, size });
        }
        return out;
      });
      all.push(...r.map(x => ({ tab: t, ...x })));
    }
    const fails = all.filter(x => x.ratio < x.need).sort((a, b) => a.ratio - b.ratio);
    fs.writeFileSync(path.join(outDir, 'contrast-rendered.json'), JSON.stringify({ measured: all.length, fails }, null, 1));
    s.check('contrast:rendered-text', fails.length === 0, `${all.length} distinct text styles measured across 6 inspector tabs + shell; ${fails.length} below threshold${fails.length ? ': ' + fails.slice(0, 5).map(f => `${f.sel} "${f.text}" ${f.ratio}<${f.need}`).join(' | ') : ''} (text over images/gradients not measurable here)`);
    // UI boundary contrast for form controls: border colour vs the surface behind the control
    const edge = await page.evaluate(() => {
      const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
      const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const surfaceBehind = el => { for (let n = el.parentElement; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a >= 1) return c; } return { r: 6, g: 6, b: 8 }; };
      const out = []; document.querySelectorAll('input[type=text],input[type=search],input[type=number],select,.switch').forEach(e => { if (!window.__a.vis(e) || e.disabled) return; const cs = getComputedStyle(e), bc = parse(cs.borderTopColor), bw = parseFloat(cs.borderTopWidth); if (!bw) return; const bg = surfaceBehind(e), l1 = lum(bc), l2 = lum(bg); out.push({ sel: window.__a.sel(e), ratio: +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2) }); });
      return out;
    });
    const weak = edge.filter(x => x.ratio < 3); s.check('contrast:form-control-boundaries', weak.length === 0, `${weak.length}/${edge.length} text fields/selects/switches have a border below 3:1 against the surface behind them (worst ${weak.length ? Math.min(...weak.map(x => x.ratio)) : '-'})`);
    await app.ctx.close();
  }

  // =============================== 6. reduced motion ===============================
  {
    const rm = await openApp(browser, { context: { reducedMotion: 'reduce' }, pauseStage: false, settle: 1500 }); const { page } = rm;
    const a = await page.evaluate(() => ({ playing: window.__lab.stage.playing, t: window.__lab.stage.time })); await page.waitForTimeout(1200);
    const b = await page.evaluate(() => ({ playing: window.__lab.stage.playing, t: window.__lab.stage.time, anims: document.getAnimations().filter(x => x.playState === 'running').map(x => (x.effect && x.effect.target ? x.effect.target.tagName + '.' + (x.effect.target.className || '') : '?') + ':' + (x.animationName || x.transitionProperty || '')).slice(0, 6), hint: !document.getElementById('rmHint').hidden, mq: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    s.check('reduced-motion:no-autoplay', b.mq && !b.playing && a.t === b.t, `emulation active=${b.mq}; playing=${b.playing}; stage time ${a.t} -> ${b.t}`);
    s.check('reduced-motion:hint-visible', b.hint, 'explains that Space plays');
    s.check('reduced-motion:no-css-animation', b.anims.length === 0, `${b.anims.length} running animations ${b.anims.join(', ')}`);
    const dur = await page.evaluate(() => { const bad = []; document.querySelectorAll('button,.btn,.tog,.chipbtn,[role=tab],dialog,.toast,.coach').forEach(e => { const cs = getComputedStyle(e); const td = cs.transitionDuration.split(',').map(parseFloat), ad = cs.animationDuration.split(',').map(parseFloat); if (td.some(x => x > 0.001) || (cs.animationName !== 'none' && ad.some(x => x > 0.001))) bad.push(e.tagName + '.' + e.className); }); return [...new Set(bad)].slice(0, 6); });
    s.check('reduced-motion:no-transitions', dur.length === 0, dur.join(', '));
    await page.keyboard.press('Space'); await page.waitForTimeout(300); s.check('reduced-motion:space-still-plays', await page.evaluate(() => window.__lab.stage.playing), 'user can opt in to playback'); await rm.ctx.close();
    const ctl = await openApp(browser, { pauseStage: false, settle: 1500 }); const c = await ctl.page.evaluate(() => window.__lab.stage.playing); s.info('reduced-motion:control', `without the preference the stage autoplays: playing=${c}`); await ctl.ctx.close();
  }

  // =============================== 7. reflow / zoom / touch targets ===============================
  const reflow = async (label, viewport, context) => {
    const app = await openApp(browser, { viewport, context, settle: 1500 }); const { page } = app; await prep(page);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, out = { vw, vh, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, offscreen: [], clipped: [], tiny: [], n: 0 };
      const els = [...document.querySelectorAll(window.__a.INTERACTIVE)].filter(window.__a.vis); out.n = els.length;
      for (const e of els) {
        const r = e.getBoundingClientRect(); if (e.closest('.file')) continue;
        // clipped by an ancestor with overflow != visible that is not user-scrollable
        let visible = r.width * r.height, clipRect = { l: 0, t: 0, r: vw, b: vh }, scrollable = false;
        for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const pr = p.getBoundingClientRect(); clipRect = { l: Math.max(clipRect.l, pr.left), t: Math.max(clipRect.t, pr.top), r: Math.min(clipRect.r, pr.right), b: Math.min(clipRect.b, pr.bottom) }; if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) scrollable = true; } }
        const iw = Math.max(0, Math.min(r.right, clipRect.r) - Math.max(r.left, clipRect.l)), ih = Math.max(0, Math.min(r.bottom, clipRect.b) - Math.max(r.top, clipRect.t)), frac = iw * ih / (r.width * r.height);
        if (frac < 0.99 && !scrollable) out.clipped.push(`${window.__a.sel(e)} "${window.__a.name(e).slice(0, 20)}" ${(frac * 100).toFixed(0)}% visible`);
        if (r.right > vw + 1 && !scrollable) out.offscreen.push(window.__a.sel(e));
      }
      return out;
    });
    await app.ctx.close(); return { label, ...r, errors: app.errors };
  };
  for (const [label, vp, ctx] of [['200% zoom (720x450 CSS px @2x)', { width: 720, height: 450 }, { deviceScaleFactor: 2 }], ['360px width (phone portrait)', { width: 360, height: 740 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['320px width (WCAG reflow reference)', { width: 320, height: 640 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const r = await reflow(label, vp, ctx); const id = label.split(' ')[0].replace('%', 'pct');
    s.check(`reflow:${id}:no-horizontal-scroll`, r.scrollW <= r.vw + 1 && r.bodyScrollW <= r.vw + 1, `${label}: viewport ${r.vw}, document scrollWidth ${r.scrollW}`);
    s.check(`reflow:${id}:no-offscreen-controls`, r.offscreen.length === 0, `${r.offscreen.length} of ${r.n} controls extend past the right edge: ${r.offscreen.slice(0, 5).join(', ')}`);
    s.check(`reflow:${id}:no-clipped-controls`, r.clipped.length === 0, `${r.clipped.length} clipped: ${r.clipped.slice(0, 5).join(' | ')}`);
    s.check(`reflow:${id}:no-errors`, r.errors.length === 0, r.errors.join(' | '));
  }
  const targets = async (label, viewport, context) => {
    const app = await openApp(browser, { viewport, context, settle: 1500 }); const { page } = app; await prep(page);
    const res = [];
    for (const t of ['layer', 'finish', 'colour']) { await page.evaluate(t => window.__lab.setTab(t), t).catch(() => {}); await page.waitForTimeout(150);
      res.push(...await page.evaluate(() => [...document.querySelectorAll(window.__a.INTERACTIVE)].filter(window.__a.vis).filter(e => !e.closest('.file') && !e.matches('input[type=range]')).map(e => { const r = e.getBoundingClientRect(); return { sel: window.__a.sel(e), name: window.__a.name(e).slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), hit: Math.min(r.width, r.height) >= 24 || window.__a.hit24(e) }; }))); }
    await app.ctx.close(); const uniq = new Map(res.map(x => [x.sel + x.name, x])); return [...uniq.values()];
  };
  const fine = await targets('desktop', { width: 1440, height: 900 }, {}), coarse = await targets('touch', { width: 390, height: 844 }, { deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const under = (list, min) => list.filter(x => Math.min(x.w, x.h) < min && (min > 24 || !x.hit)); // a 24 px hit area made with ::before padding counts for the 24 px minimum
  const sum = (l) => l.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 6).map(x => `${x.sel} "${x.name}" ${x.w}x${x.h}`).join(' | ');
  s.check('targets:desktop>=24px', under(fine, 24).length === 0, `${under(fine, 24).length}/${fine.length} controls under 24x24 CSS px (WCAG 2.2 SC 2.5.8 minimum, spacing exception not evaluated): ${sum(under(fine, 24))}`);
  s.check('targets:touch>=24px', under(coarse, 24).length === 0, `${under(coarse, 24).length}/${coarse.length}: ${sum(under(coarse, 24))}`);
  s.check('targets:touch>=44px (studio standard)', under(coarse, 44).length === 0, `${under(coarse, 44).length}/${coarse.length} under 44 px with a coarse pointer: ${sum(under(coarse, 44))}`, 'minor');
} finally { await browser.close(); }

const sum = s.summary(); fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(sum, null, 1));
console.log(`\na11y: ${sum.passed} passed, ${sum.known} known-open, ${sum.failed} failed (${(sum.ms / 1000).toFixed(1)} s). Automated keyboard/ARIA/contrast/reflow evidence only: no screen reader was run and no WCAG conformance is claimed.`);
process.exit(sum.failed ? 1 : 0);
