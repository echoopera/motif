// web-immersive-shell — the Style Lab workspace: library, stage, inspector, Evolve, export, keyboard.
import { ASPECTS, PALETTES } from '@modules/tokens';
import { STYLES, CATEGORIES, SHARED_SCHEMA, getStyle, defaultLook, sanitizeLook, mutateLook, randomizeLook, mulberry32 } from '@modules/style-library';
import { createStage, renderThumb, renderFrame, exportSize, frameCount } from '@modules/renderer';
import { runExport, probeCapabilities, parsePreset, TIERS, FPS } from '@modules/exporter';

export const shellCss = `
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{margin:0;background:var(--surface-0);color:var(--text);font:var(--text-md)/1.45 var(--font-ui);-webkit-font-smoothing:antialiased;overflow:hidden}
button,input,select{font:inherit;color:inherit}
:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:var(--focus-w)}
.app{height:100%;display:grid;grid-template-columns:var(--lib-w) minmax(0,1fr) var(--insp-w);grid-template-rows:var(--bar-h) minmax(0,1fr);grid-template-areas:"bar bar bar" "lib stage insp"}
.lbl{font:500 var(--text-xs)/1.2 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
.readout{font:400 var(--text-sm)/1 var(--font-mono);font-variant-numeric:tabular-nums;color:var(--text-muted);white-space:nowrap}
.bar{grid-area:bar;display:flex;align-items:center;gap:var(--space-4);padding-inline:var(--space-4);border-bottom:var(--hairline) solid var(--line);background:var(--surface-1);min-width:0}
.brand{display:flex;align-items:baseline;gap:var(--space-2);margin-right:auto;white-space:nowrap}
.brand .mark{font:800 var(--text-lg)/1 var(--font-display);font-variation-settings:"wdth" 130;letter-spacing:.02em}
.brand .mark i{display:inline-block;width:.45em;height:.45em;background:var(--lock);transform:rotate(45deg);margin-left:.3em;vertical-align:.1em}
.brand .sub{font:500 var(--text-xs)/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted)}
.seg{display:flex;border:var(--hairline) solid var(--line);border-radius:var(--radius-m);overflow:hidden;background:var(--surface-2)}
.seg button{border:0;background:transparent;padding:var(--space-1) var(--space-2);min-height:var(--target);font:500 var(--text-sm)/1 var(--font-mono);color:var(--text-muted);cursor:pointer}
.seg button+button{border-left:var(--hairline) solid var(--line)}
.seg button[aria-checked="true"]{background:var(--accent);color:var(--accent-ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);min-height:var(--target);padding:0 var(--space-3);border-radius:var(--radius-m);border:var(--hairline) solid var(--line);background:var(--surface-2);cursor:pointer;font-weight:600;font-size:var(--text-sm);white-space:nowrap;transition:transform var(--dur-fast) var(--ease-out),border-color var(--dur-fast)}
.btn:hover{border-color:var(--line-strong)}
.btn:active{transform:scale(.97)}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.icon{width:var(--target);padding:0;font:600 var(--text-md)/1 var(--font-mono)}
.btn kbd{font:500 var(--text-xs)/1 var(--font-mono);opacity:.6}
.mini{display:flex;align-items:center;gap:var(--space-2)}
select{background:var(--surface-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:var(--space-1) var(--space-2);min-height:calc(var(--target) - var(--space-1))}
.transport{display:flex;align-items:center;gap:var(--space-2)}
/* library */
.lib{grid-area:lib;display:flex;flex-direction:column;border-right:var(--hairline) solid var(--line);background:var(--surface-1);min-height:0}
.lib-head{padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);border-bottom:var(--hairline) solid var(--line)}
.lib-head input{width:100%;background:var(--surface-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-m);padding:var(--space-2) var(--space-3)}
.chips{display:flex;flex-wrap:wrap;gap:var(--space-1)}
.chip{border:var(--hairline) solid var(--line);background:transparent;border-radius:999em;padding:var(--space-1) var(--space-2);font:500 var(--text-xs)/1.2 var(--font-mono);color:var(--text-muted);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--text);border-color:var(--text);color:var(--surface-1)}
.lib-list{list-style:none;margin:0;padding:var(--space-2);overflow:auto;flex:1;min-height:0}
.lib-cat{font:500 var(--text-xs)/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);padding:var(--space-3) var(--space-2) var(--space-2)}
.style-row{display:grid;grid-template-columns:var(--thumb-w) 1fr auto;align-items:center;gap:var(--space-3);padding:var(--space-1) var(--space-2);border-radius:var(--radius-m);cursor:pointer;border:var(--hairline) solid transparent}
.style-row:hover{background:var(--surface-2)}
.style-row[aria-selected="true"]{background:var(--accent-soft);border-color:var(--accent)}
.style-row canvas{width:var(--thumb-w);height:var(--thumb-h);border-radius:var(--radius-s);display:block;background:var(--stage)}
.style-row b{font-weight:600;font-size:var(--text-md);display:block;line-height:1.2}
.style-row .n{font:400 var(--text-xs)/1 var(--font-mono);color:var(--text-muted)}
.lib-empty{padding:var(--space-4);color:var(--text-muted)}
/* stage */
.stage{grid-area:stage;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--stage)}
.stage-host{flex:1;min-height:0;position:relative;display:grid;place-items:center;margin:var(--space-6) var(--space-6) var(--space-3)}
.stage-box{position:relative;line-height:0;box-shadow:var(--shadow)}
.stage-box canvas{display:block}
.guides{position:absolute;inset:0;pointer-events:none}
.guides i{position:absolute;border:var(--hairline) dashed var(--accent)}
.guides .action{inset:3.5%;opacity:.55}
.guides .title{inset:5%;opacity:.9}
.guides .cross{left:50%;top:50%;width:4%;height:0;border-width:var(--hairline) 0 0;transform:translate(-50%,0)}
.scrub{display:flex;align-items:center;gap:var(--space-3);padding:0 var(--space-6) var(--space-4)}
.scrub input{flex:1}
input[type=range]{accent-color:var(--accent);min-width:0}
.rm-hint{margin:0 var(--space-6) var(--space-3);color:var(--text);font-size:var(--text-sm)}
/* evolve */
.evolve{position:absolute;inset:0;background:var(--scrim);display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-4);z-index:3;overflow:auto}
.evolve-head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3);color:var(--accent-ink)}
.evolve-head h2{margin:0 auto 0 0;font:700 var(--text-lg)/1 var(--font-display);color:var(--surface-2)}
.evolve-head .btn{color:var(--text)}
.evolve-head .hint{width:100%;font-size:var(--text-sm);color:var(--surface-2);opacity:.8}
.evolve-head label{display:flex;align-items:center;gap:var(--space-2);color:var(--surface-2);font-size:var(--text-sm)}
.evolve-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-3)}
.child{position:relative;border:0;padding:0;background:transparent;cursor:pointer;border-radius:var(--radius-m);overflow:hidden;outline-offset:var(--focus-w)}
.child canvas{width:100%;height:auto;display:block}
.child span{position:absolute;left:var(--space-2);top:var(--space-2);font:600 var(--text-xs)/1 var(--font-mono);background:var(--surface-2);color:var(--text);padding:var(--space-1) var(--space-2);border-radius:var(--radius-s)}
.child:hover,.child:focus-visible{outline:var(--focus-w) solid var(--accent)}
/* inspector */
.insp{grid-area:insp;border-left:var(--hairline) solid var(--line);background:var(--surface-1);overflow:auto;min-height:0}
.insp-head{padding:var(--space-4) var(--space-4) var(--space-3);border-bottom:var(--hairline) solid var(--line)}
.insp-head h1{margin:var(--space-1) 0;font:700 var(--text-xl)/1.05 var(--font-display);font-variation-settings:"wdth" 88}
.insp-head p{margin:0;color:var(--text-muted);font-size:var(--text-sm)}
.actions{padding:var(--space-3) var(--space-4);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);border-bottom:var(--hairline) solid var(--line)}
.actions .wide{grid-column:1/-1}
.actions .pair{display:flex;gap:var(--space-2)}
.actions .pair .btn{flex:1}
.group{border-bottom:var(--hairline) solid var(--line)}
.group summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:var(--space-3) var(--space-4)}
.group summary::-webkit-details-marker{display:none}
.group summary::after{content:"+";font:400 var(--text-md)/1 var(--font-mono);color:var(--text-muted)}
.group[open] summary::after{content:"–"}
.rows{padding:0 var(--space-4) var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)}
.row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:var(--space-1) var(--space-2);padding:var(--space-1) 0;border-radius:var(--radius-s);transition:background var(--dur-base)}
.row label{font-size:var(--text-sm);color:var(--text)}
.row .val{font:400 var(--text-sm)/1 var(--font-mono);font-variant-numeric:tabular-nums;color:var(--text-muted);min-width:4.5em;text-align:right}
.row input[type=range]{grid-column:1/-1}
.row select,.row input[type=text]{grid-column:1/-1;width:100%}
.row input[type=text]{background:var(--surface-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:var(--space-2)}
.row.toggle{grid-template-columns:1fr auto auto}
.lock{display:inline-grid;place-items:center;width:calc(var(--target) - var(--space-2));height:calc(var(--target) - var(--space-2));border:var(--hairline) solid transparent;background:transparent;border-radius:var(--radius-s);cursor:pointer;color:var(--text-muted);font:400 var(--text-sm)/1 var(--font-mono);opacity:.5}
.row:hover .lock,.lock:focus-visible{opacity:1}
.lock[aria-pressed="true"]{opacity:1;color:var(--lock);background:var(--lock-soft);border-color:var(--lock)}
.row.locked{background:var(--lock-soft)}
.row.flash{background:var(--lock-soft)}
.switch{appearance:none;width:2.4em;height:1.35em;border-radius:999em;background:var(--line-strong);position:relative;cursor:pointer;margin:0}
.switch::after{content:"";position:absolute;top:.15em;left:.15em;width:1.05em;height:1.05em;border-radius:50%;background:var(--surface-2);transition:transform var(--dur-fast) var(--ease-out)}
.switch:checked{background:var(--accent)}
.switch:checked::after{transform:translateX(1.05em)}
.swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-2)}
.sw{border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:0;height:2.2em;cursor:pointer;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;overflow:hidden}
.sw i{display:block}
.sw[aria-checked="true"]{outline:var(--focus-w) solid var(--accent);outline-offset:var(--focus-w)}
.looks{padding:0 var(--space-4) var(--space-4)}
.looks-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-2)}
.look{position:relative;border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:0;overflow:hidden;cursor:pointer;background:var(--stage)}
.look img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.look .x{position:absolute;right:0;top:0;border:0;background:var(--surface-2);color:var(--text);font:var(--text-xs)/1 var(--font-mono);padding:var(--space-1);cursor:pointer}
.empty{color:var(--text-muted);font-size:var(--text-sm);margin:var(--space-2) 0 0}
.file{position:absolute;width:var(--hairline);height:var(--hairline);opacity:0;pointer-events:none}
/* dialogs */
dialog{border:var(--hairline) solid var(--line);border-radius:var(--radius-l);background:var(--surface-1);color:var(--text);padding:0;width:min(92vw,36em);box-shadow:var(--shadow)}
dialog::backdrop{background:var(--scrim)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;padding:var(--space-4);border-bottom:var(--hairline) solid var(--line)}
.dlg-head h2{margin:0;font:700 var(--text-lg)/1 var(--font-display)}
.dlg-body{padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-4)}
.formats{display:grid;grid-template-columns:repeat(auto-fill,minmax(9em,1fr));gap:var(--space-2)}
.fmt{display:flex;flex-direction:column;gap:var(--space-1);border:var(--hairline) solid var(--line);border-radius:var(--radius-m);padding:var(--space-3);cursor:pointer;text-align:left;background:var(--surface-2)}
.fmt b{font-size:var(--text-md)}
.fmt small{font-size:var(--text-xs);color:var(--text-muted)}
.fmt[aria-checked="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 var(--hairline) var(--accent)}
.fmt[disabled]{opacity:.45;cursor:not-allowed}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)}
.field{display:flex;flex-direction:column;gap:var(--space-1)}
.summary{font:400 var(--text-sm)/1.5 var(--font-mono);color:var(--text-muted)}
progress{width:100%;accent-color:var(--accent)}
.dlg-foot{display:flex;justify-content:flex-end;gap:var(--space-2);padding:var(--space-4);border-top:var(--hairline) solid var(--line)}
.status{font-size:var(--text-sm)}
.status.err{color:var(--danger)}
.keys-list{display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4);margin:0}
.keys-list dt{font:500 var(--text-sm)/1.4 var(--font-mono)}
.keys-list dd{margin:0;color:var(--text-muted);font-size:var(--text-sm)}
.toast{position:fixed;left:50%;bottom:var(--space-6);transform:translate(-50%,var(--space-2));background:var(--text);color:var(--surface-1);padding:var(--space-2) var(--space-4);border-radius:var(--radius-m);font-size:var(--text-sm);opacity:0;pointer-events:none;transition:opacity var(--dur-base),transform var(--dur-base) var(--ease-out);z-index:10}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (max-width:68.75em){
  body{overflow:auto}
  .app{height:auto;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto auto;grid-template-areas:"bar" "stage" "insp" "lib"}
  .bar{flex-wrap:wrap;padding-block:var(--space-2)}
  .stage-host{height:62vh;margin:var(--space-4) var(--space-4) var(--space-2)}
  .scrub{padding:0 var(--space-4) var(--space-3)}
  .insp,.lib{border:0;border-top:var(--hairline) solid var(--line)}
  .lib-list{max-height:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(15em,1fr));gap:var(--space-1)}
  .lib-cat{grid-column:1/-1}
}
@media (max-width:40em){
  .brand .sub,.mini{display:none}
  .evolve-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .stage-host{height:48vh}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export const shellHtml = `
<div class="app" id="app">
  <header class="bar">
    <div class="brand"><span class="mark">MOTIF<i aria-hidden="true"></i></span><span class="sub">Style Lab</span></div>
    <div class="seg" role="radiogroup" aria-label="Aspect ratio" id="aspects"></div>
    <div class="transport">
      <button class="btn icon" id="play" aria-label="Pause" title="Play / pause (Space)">❚❚</button>
      <span class="readout" id="time">0.00 / 6.00 s</span>
    </div>
    <label class="mini"><span class="lbl">Quality</span><select id="quality" aria-label="Preview quality"><option value="auto">Auto</option><option value="high">High</option><option value="draft">Draft</option></select></label>
    <button class="btn icon" id="guidesBtn" aria-pressed="false" aria-label="Safe-area guides" title="Guides (G)">⌗</button>
    <button class="btn icon" id="keysBtn" aria-label="Keyboard shortcuts" title="Shortcuts (?)">?</button>
    <button class="btn primary" id="exportBtn" title="Export (X)">Export</button>
  </header>
  <aside class="lib" aria-label="Style library">
    <div class="lib-head">
      <input type="search" id="search" placeholder="Search styles" aria-label="Search styles" autocomplete="off">
      <div class="chips" id="cats" role="group" aria-label="Filter by category"></div>
    </div>
    <ul class="lib-list" id="libList" role="listbox" aria-label="Styles"></ul>
  </aside>
  <main class="stage">
    <div class="stage-host" id="stageHost">
      <div class="stage-box" id="stageBox">
        <canvas id="stage" role="img" aria-label="Animation preview"></canvas>
        <div class="guides" id="guides" hidden><i class="action"></i><i class="title"></i><i class="cross"></i></div>
      </div>
      <div class="evolve" id="evolve" hidden role="dialog" aria-modal="false" aria-labelledby="evolveTitle">
        <div class="evolve-head">
          <h2 id="evolveTitle">Evolve</h2>
          <label>Strength <input type="range" id="evoStrength" min="0.05" max="1" step="0.05" value="0.35" aria-label="Evolve strength"></label>
          <label><input type="checkbox" class="switch" id="evoColour" role="switch"> Include colour</label>
          <button class="btn" id="evoAgain">Breed again</button>
          <button class="btn" id="evoClose" aria-label="Close Evolve">Close</button>
          <p class="hint">Pick a variation to keep it. Press 1–6, or Esc to close.</p>
        </div>
        <div class="evolve-grid" id="evoGrid"></div>
      </div>
    </div>
    <p class="rm-hint" id="rmHint" hidden>Paused because your system prefers reduced motion. Press Space to play.</p>
    <div class="scrub">
      <input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Loop position">
      <span class="readout" id="frameRead">f 000</span>
      <span class="readout" id="perf" title="Render time per frame"></span>
    </div>
  </main>
  <aside class="insp" aria-label="Inspector">
    <div class="insp-head"><div class="lbl" id="styleCat"></div><h1 id="styleName"></h1><p id="styleBlurb"></p></div>
    <div class="actions">
      <button class="btn primary" id="mutateBtn" title="Mutate (M)">Mutate <kbd>M</kbd></button>
      <button class="btn" id="evolveBtn" title="Evolve (E)">Evolve <kbd>E</kbd></button>
      <button class="btn" id="randomBtn" title="Randomize (R)">Randomize <kbd>R</kbd></button>
      <button class="btn" id="resetBtn">Reset</button>
      <div class="wide row"><label for="strength">Mutation strength</label><span></span><output class="val" id="strengthVal">0.35</output><input type="range" id="strength" min="0.05" max="1" step="0.05" value="0.35"></div>
      <div class="wide pair"><button class="btn" id="undoBtn" title="Undo (⌘Z)">↺ Undo</button><button class="btn" id="redoBtn" title="Redo (⇧⌘Z)">↻ Redo</button></div>
    </div>
    <div id="groups"></div>
    <details class="group" open>
      <summary><span class="lbl">Saved looks</span></summary>
      <div class="looks">
        <div class="pair" style="display:flex;gap:var(--space-2)">
          <button class="btn" id="saveLook" title="Save look (S)">Save look</button>
          <button class="btn" id="importBtn">Import preset</button>
          <input type="file" id="importFile" class="file" accept="application/json,.json" tabindex="-1" aria-hidden="true">
        </div>
        <div class="looks-grid" id="looks"></div>
        <p class="empty" id="looksEmpty">Saved looks appear here. Press S to save the current look.</p>
      </div>
    </details>
  </aside>
</div>
<dialog id="exportDlg" aria-labelledby="exportTitle">
  <div class="dlg-head"><h2 id="exportTitle">Export</h2><button class="btn icon" id="exportClose" aria-label="Close">✕</button></div>
  <div class="dlg-body">
    <div class="field"><span class="lbl">Format</span><div class="formats" id="formats" role="radiogroup" aria-label="Format"></div></div>
    <div class="grid2">
      <label class="field"><span class="lbl">Aspect</span><select id="exAspect"></select></label>
      <label class="field"><span class="lbl">Size</span><select id="exTier"></select></label>
      <label class="field"><span class="lbl">Frame rate</span><select id="exFps"></select></label>
      <label class="field"><span class="lbl">Loops</span><select id="exLoops"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
    </div>
    <label class="row toggle" style="grid-template-columns:1fr auto"><span>Transparent background</span><input type="checkbox" class="switch" id="exAlpha" role="switch"></label>
    <div class="summary" id="exSummary"></div>
    <progress id="exProgress" max="1" value="0" hidden></progress>
    <div class="status" id="exStatus" role="status" aria-live="polite"></div>
  </div>
  <div class="dlg-foot"><button class="btn" id="exCancel">Cancel</button><button class="btn" id="exSave" hidden>Save file</button><button class="btn primary" id="exRender">Render</button></div>
</dialog>
<dialog id="keysDlg" aria-labelledby="keysTitle">
  <div class="dlg-head"><h2 id="keysTitle">Keyboard shortcuts</h2><button class="btn icon" id="keysClose" aria-label="Close">✕</button></div>
  <div class="dlg-body"><dl class="keys-list">
    <dt>Space</dt><dd>Play / pause</dd><dt>← →</dt><dd>Step one frame (Shift: ten)</dd><dt>[ ]</dt><dd>Previous / next style</dd>
    <dt>1–6</dt><dd>Aspect ratio (in Evolve: keep variation)</dd><dt>M</dt><dd>Mutate</dd><dt>E</dt><dd>Evolve</dd><dt>R</dt><dd>Randomize</dd>
    <dt>⌘Z / ⇧⌘Z</dt><dd>Undo / redo</dd><dt>S</dt><dd>Save look</dd><dt>G</dt><dd>Safe-area guides</dd><dt>X</dt><dd>Export</dd><dt>?</dt><dd>This list</dd>
    <dt>Double-click slider</dt><dd>Reset that value</dd>
  </dl></div>
</dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

export function boot() {
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };

  // ---------- state ----------
  let look = defaultLook('particle-form');
  let aspect = '16x9', strength = 0.35, catFilter = 'all', query = '';
  const locks = new Map(); // styleId -> Set; shared keys under '*'
  const lockSet = () => { const s = new Set(locks.get(look.styleId) || []); for (const k of locks.get('*') || []) s.add(k); return s; };
  const history = [JSON.stringify(look)]; let cursor = 0;
  const clone = o => JSON.parse(JSON.stringify(o));
  function commit(next, msg) {
    look = sanitizeLook(next);
    const snap = JSON.stringify(look);
    if (snap !== history[cursor]) { history.splice(cursor + 1); history.push(snap); if (history.length > 300) history.shift(); cursor = history.length - 1; }
    refresh(); if (msg) toast(msg);
  }
  function undo() { if (cursor > 0) { cursor--; look = JSON.parse(history[cursor]); refresh(); toast('Undo'); } }
  function redo() { if (cursor < history.length - 1) { cursor++; look = JSON.parse(history[cursor]); refresh(); toast('Redo'); } }

  // ---------- stage ----------
  const canvas = $('stage');
  const stage = createStage({ canvas, host: $('stageHost'), getLook: () => look, onTick, onError: e => console.error(e) });
  if (reduce) { stage.pause(); $('rmHint').hidden = false; }
  let lastUi = 0;
  function onTick(t) {
    const now = performance.now(); if (now - lastUi < 60 && stage.playing) return; lastUi = now;
    const L = look.shared.loop;
    $('time').textContent = `${t.toFixed(2)} / ${L.toFixed(2)} s`;
    if (document.activeElement !== $('scrub')) $('scrub').value = Math.round((t / L) * 1000);
    $('frameRead').textContent = `f ${String(Math.floor(t * 30)).padStart(3, '0')}`;
    $('perf').textContent = `${stage.frameMs().toFixed(1)} ms`;
    if (evolveOpen) drawChildren(t);
  }
  const sync = () => { const s = stage.size(); $('stageBox').style.width = s.cssW + 'px'; $('stageBox').style.height = s.cssH + 'px'; };
  new ResizeObserver(() => requestAnimationFrame(sync)).observe($('stageHost'));

  // ---------- top bar ----------
  const aspectsEl = $('aspects');
  aspectsEl.innerHTML = ASPECTS.map((a, i) => `<button role="radio" data-a="${a.id}" aria-checked="${a.id === aspect}" title="${a.label} (${i + 1})">${a.label}</button>`).join('');
  function setAspect(a) { aspect = a; stage.setAspect(a); aspectsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.a === a)); requestAnimationFrame(sync); if (evolveOpen) layoutChildren(); }
  aspectsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setAspect(b.dataset.a); });
  function togglePlay() { const on = stage.toggle(); $('play').textContent = on ? '❚❚' : '▶'; $('play').setAttribute('aria-label', on ? 'Pause' : 'Play'); if (on) $('rmHint').hidden = true; }
  $('play').addEventListener('click', togglePlay);
  if (reduce) { $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Play'); }
  $('quality').addEventListener('change', e => { stage.setQuality(e.target.value); requestAnimationFrame(sync); });
  $('guidesBtn').addEventListener('click', toggleGuides);
  function toggleGuides() { const on = $('guides').hidden; $('guides').hidden = !on; $('guidesBtn').setAttribute('aria-pressed', on); }
  $('scrub').addEventListener('input', e => stage.seek(e.target.value / 1000));

  // ---------- library ----------
  const catsEl = $('cats');
  catsEl.innerHTML = [{ id: 'all', name: 'All' }, ...CATEGORIES].map(c => `<button class="chip" data-c="${c.id}" aria-pressed="${c.id === 'all'}">${c.name}</button>`).join('');
  catsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; catFilter = b.dataset.c; catsEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderLibrary(); });
  $('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderLibrary(); });
  const thumbs = new Map();
  function thumbLook(st) { return { styleId: st.id, params: defaultLook(st.id).params, shared: { ...look.shared, zoom: 1, rotate: 0, grain: 0, vignette: 0, phase: 0, tempo: 1 } }; }
  function renderLibrary() {
    const list = $('libList'); list.innerHTML = ''; thumbs.clear(); let count = 0;
    for (const cat of CATEGORIES) {
      const items = STYLES.filter(s => s.category === cat.id && (catFilter === 'all' || catFilter === cat.id) && (!query || s.name.toLowerCase().includes(query) || s.blurb.toLowerCase().includes(query)));
      if (!items.length) continue;
      const h = document.createElement('li'); h.className = 'lib-cat'; h.setAttribute('role', 'presentation'); h.textContent = cat.name; list.appendChild(h);
      for (const st of items) {
        count++;
        const li = document.createElement('li'); li.className = 'style-row'; li.setAttribute('role', 'option'); li.id = 'opt-' + st.id; li.tabIndex = -1;
        li.setAttribute('aria-selected', st.id === look.styleId);
        const idx = STYLES.indexOf(st) + 1;
        li.innerHTML = `<canvas width="128" height="80" aria-hidden="true"></canvas><div><b>${st.name}</b><span class="n">${cat.name}</span></div><span class="n">${String(idx).padStart(2, '0')}</span>`;
        li.addEventListener('click', () => selectStyle(st.id));
        const c = li.querySelector('canvas'); thumbs.set(st.id, c);
        li.addEventListener('pointerenter', () => animateThumb(st, c, true));
        li.addEventListener('pointerleave', () => animateThumb(st, c, false));
        list.appendChild(li);
      }
    }
    if (!count) { const e = document.createElement('li'); e.className = 'lib-empty'; e.textContent = `No styles match “${query}”.`; list.appendChild(e); }
    list.setAttribute('aria-activedescendant', 'opt-' + look.styleId);
    drawThumbs();
  }
  let thumbJob = 0;
  function drawThumbs() {
    const job = ++thumbJob; const entries = [...thumbs.entries()]; let i = 0;
    const step = () => { if (job !== thumbJob) return; const t0 = performance.now(); while (i < entries.length && performance.now() - t0 < 12) { const [id, c] = entries[i++]; renderThumb(c, thumbLook(getStyle(id)), 0.3); } if (i < entries.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  let hoverRaf = 0;
  function animateThumb(st, c, on) {
    cancelAnimationFrame(hoverRaf);
    if (!on || reduce) { renderThumb(c, thumbLook(st), 0.3); return; }
    const start = performance.now(); const L = look.shared.loop;
    const loop = now => { renderThumb(c, thumbLook(st), 0.3 + ((now - start) / 1000) / L); hoverRaf = requestAnimationFrame(loop); };
    hoverRaf = requestAnimationFrame(loop);
  }
  function selectStyle(id) {
    if (id === look.styleId) return;
    commit({ styleId: id, params: defaultLook(id).params, shared: look.shared }, null);
    const el = $('opt-' + id); if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function stepStyle(d) { const i = STYLES.findIndex(s => s.id === look.styleId); selectStyle(STYLES[(i + d + STYLES.length) % STYLES.length].id); }

  // ---------- inspector ----------
  const fmt = (v, s) => { if (s.type === 'int') return `${v}${s.unit || ''}`; const dec = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2; return `${Number(v).toFixed(dec)}${s.unit || ''}`; };
  function rowHtml(scope, key, s, v) {
    const id = `p-${scope}-${key}`, locked = lockSet().has(key);
    const lock = s.type === 'text' ? '<span></span>' : `<button class="lock" data-lock="${key}" data-scope="${scope}" aria-pressed="${locked}" aria-label="Lock ${s.label}" title="Lock from Mutate, Evolve and Randomize"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>`;
    if (s.type === 'range' || s.type === 'int') return `<div class="row${locked ? ' locked' : ''}" data-key="${key}"><label for="${id}">${s.label}</label>${lock}<output class="val" id="${id}-v">${fmt(v, s)}</output><input type="range" id="${id}" data-scope="${scope}" data-key="${key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}"></div>`;
    if (s.type === 'select') return `<div class="row${locked ? ' locked' : ''}" data-key="${key}"><label for="${id}">${s.label}</label>${lock}<span></span><select id="${id}" data-scope="${scope}" data-key="${key}">${s.options.map(o => `<option value="${o.v}"${o.v === v ? ' selected' : ''}>${o.l}</option>`).join('')}</select></div>`;
    if (s.type === 'toggle') return `<div class="row toggle${locked ? ' locked' : ''}" data-key="${key}"><label for="${id}">${s.label}</label>${lock}<input type="checkbox" class="switch" role="switch" id="${id}" data-scope="${scope}" data-key="${key}"${v ? ' checked' : ''}></div>`;
    return `<div class="row" data-key="${key}"><label for="${id}">${s.label}</label><span></span><span></span><input type="text" id="${id}" data-scope="${scope}" data-key="${key}" maxlength="${s.max}" value="${String(v).replace(/"/g, '&quot;')}" spellcheck="false"></div>`;
  }
  const openGroups = { style: true, colour: true, motion: false, finish: false };
  function renderInspector() {
    const st = getStyle(look.styleId);
    $('styleCat').textContent = `${String(STYLES.indexOf(st) + 1).padStart(2, '0')} · ${CATEGORIES.find(c => c.id === st.category).name}`;
    $('styleName').textContent = st.name; $('styleBlurb').textContent = st.blurb;
    canvas.setAttribute('aria-label', `${st.name}: ${st.blurb}`);
    const sharedBy = g => Object.entries(SHARED_SCHEMA).filter(([k, s]) => s.group === g && k !== 'palette');
    const group = (id, title, body) => `<details class="group" data-g="${id}"${openGroups[id] ? ' open' : ''}><summary><span class="lbl">${title}</span></summary><div class="rows">${body}</div></details>`;
    const palSw = `<div class="swatches" role="radiogroup" aria-label="Palette">${PALETTES.map(p => `<button class="sw" role="radio" data-pal="${p.id}" aria-checked="${p.id === look.shared.palette}" aria-label="${p.name}" title="${p.name}"><i style="background:${p.bg}"></i>${p.a.map(c => `<i style="background:${c}"></i>`).join('')}</button>`).join('')}</div>`;
    $('groups').innerHTML =
      group('style', 'Style', Object.entries(st.params).map(([k, s]) => rowHtml('p', k, s, look.params[k])).join('')) +
      group('colour', 'Colour', palSw + sharedBy('colour').map(([k, s]) => rowHtml('s', k, s, look.shared[k])).join('')) +
      group('motion', 'Motion', sharedBy('motion').map(([k, s]) => rowHtml('s', k, s, look.shared[k])).join('')) +
      group('finish', 'Finish', sharedBy('finish').map(([k, s]) => rowHtml('s', k, s, look.shared[k])).join(''));
    $('undoBtn').disabled = cursor <= 0; $('redoBtn').disabled = cursor >= history.length - 1;
  }
  const schemaFor = scope => (scope === 's' ? SHARED_SCHEMA : getStyle(look.styleId).params);
  function readInput(el) {
    const s = schemaFor(el.dataset.scope)[el.dataset.key];
    if (s.type === 'toggle') return el.checked;
    if (s.type === 'range' || s.type === 'int') return Number(el.value);
    return el.value;
  }
  function setValue(scope, key, v) { const next = clone(look); (scope === 's' ? next.shared : next.params)[key] = v; return next; }
  const groupsEl = $('groups');
  groupsEl.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.key) return;
    const v = readInput(el); const s = schemaFor(el.dataset.scope)[el.dataset.key];
    look = sanitizeLook(setValue(el.dataset.scope, el.dataset.key, v)); stage.invalidate();
    const out = $(el.id + '-v'); if (out) out.textContent = fmt(v, s);
    if (el.dataset.key === 'loop') stage.invalidate();
  });
  groupsEl.addEventListener('change', e => { const el = e.target; if (!el.dataset || !el.dataset.key) return; commit(setValue(el.dataset.scope, el.dataset.key, readInput(el))); });
  groupsEl.addEventListener('dblclick', e => {
    const el = e.target; if (el.type !== 'range') return; const s = schemaFor(el.dataset.scope)[el.dataset.key];
    commit(setValue(el.dataset.scope, el.dataset.key, s.def), `${s.label} reset`);
  });
  groupsEl.addEventListener('click', e => {
    const lk = e.target.closest('.lock');
    if (lk) {
      const key = lk.dataset.lock, bucket = lk.dataset.scope === 's' ? '*' : look.styleId;
      const set = new Set(locks.get(bucket) || []); set.has(key) ? set.delete(key) : set.add(key); locks.set(bucket, set);
      lk.setAttribute('aria-pressed', set.has(key)); lk.closest('.row').classList.toggle('locked', set.has(key)); return;
    }
    const sw = e.target.closest('.sw'); if (sw) { commit(setValue('s', 'palette', sw.dataset.pal)); drawThumbs(); return; }
  });
  groupsEl.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.g) openGroups[d.dataset.g] = d.open; }, true);

  function flash(keys) {
    for (const k of keys) { const r = groupsEl.querySelector(`.row[data-key="${k}"]`); if (r) { r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 240); } }
  }
  let rngSeed = (Date.now() % 100000) + 1; const nextRng = () => mulberry32(rngSeed++ * 7919);
  function doMutate() { const r = mutateLook(look, strength, lockSet(), nextRng(), false); commit(r.look, `Mutated ${r.changed.length} parameters`); flash(r.changed); }
  function doRandom() { const r = randomizeLook(look, lockSet(), nextRng()); commit(r.look, 'Randomized'); flash(r.changed); }
  function doReset() { commit({ ...look, params: defaultLook(look.styleId).params }, 'Style parameters reset'); }
  $('mutateBtn').addEventListener('click', doMutate); $('randomBtn').addEventListener('click', doRandom); $('resetBtn').addEventListener('click', doReset);
  $('undoBtn').addEventListener('click', undo); $('redoBtn').addEventListener('click', redo);
  $('strength').addEventListener('input', e => { strength = Number(e.target.value); $('strengthVal').textContent = strength.toFixed(2); $('evoStrength').value = strength; });

  // ---------- evolve ----------
  let evolveOpen = false, children = [], round = 0, lastFocus = null;
  const evoGrid = $('evoGrid');
  function breed() {
    round++; $('evolveTitle').textContent = `Evolve — round ${round}`;
    const colour = $('evoColour').checked;
    children = Array.from({ length: 6 }, () => mutateLook(look, strength, lockSet(), nextRng(), colour).look);
    evoGrid.innerHTML = children.map((c, i) => `<button class="child" data-i="${i}" aria-label="Keep variation ${i + 1}"><canvas></canvas><span>${i + 1}</span></button>`).join('');
    layoutChildren(); drawChildren(stage.time);
  }
  function layoutChildren() {
    const ar = exportSize(aspect, 720); const cols = matchMedia('(max-width: 40em)').matches ? 2 : 3;
    const cw = Math.max(80, Math.floor($('stageHost').clientWidth / cols) - 16);
    evoGrid.querySelectorAll('canvas').forEach(c => { c.width = cw; c.height = Math.round(cw * ar.h / ar.w); });
  }
  function drawChildren(t) {
    evoGrid.querySelectorAll('canvas').forEach((c, i) => { if (children[i]) renderThumb(c, children[i], ((t / children[i].shared.loop) * children[i].shared.tempo + children[i].shared.phase)); });
  }
  function openEvolve() { if (evolveOpen) return; lastFocus = document.activeElement; evolveOpen = true; round = 0; $('evolve').hidden = false; breed(); const f = evoGrid.querySelector('.child'); if (f) f.focus(); }
  function closeEvolve() { evolveOpen = false; $('evolve').hidden = true; evoGrid.innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function keep(i) { if (!children[i]) return; const c = children[i]; closeEvolve(); commit(c, `Kept variation ${i + 1}`); }
  $('evolveBtn').addEventListener('click', openEvolve); $('evoClose').addEventListener('click', closeEvolve); $('evoAgain').addEventListener('click', breed);
  $('evoStrength').addEventListener('input', e => { strength = Number(e.target.value); $('strength').value = strength; $('strengthVal').textContent = strength.toFixed(2); });
  evoGrid.addEventListener('click', e => { const b = e.target.closest('.child'); if (b) keep(Number(b.dataset.i)); });

  // ---------- saved looks ----------
  let saved = store.get('motif-style-lab-looks') || [];
  function renderLooks() {
    $('looks').innerHTML = saved.map((s, i) => `<div class="look" role="button" tabindex="0" data-i="${i}" aria-label="Load ${s.name}" title="${s.name}"><img alt="" src="${s.thumb}"><button class="x" data-del="${i}" aria-label="Delete ${s.name}">✕</button></div>`).join('');
    $('looksEmpty').hidden = saved.length > 0;
  }
  function saveLook() {
    const c = document.createElement('canvas'); const sz = exportSize(aspect, 90); c.width = sz.w; c.height = sz.h;
    renderThumb(c, look, 0.3);
    const n = saved.filter(s => s.look.styleId === look.styleId).length + 1;
    saved.unshift({ name: `${getStyle(look.styleId).name} ${n}`, look: clone(look), aspect, thumb: c.toDataURL('image/png') });
    saved = saved.slice(0, 24); store.set('motif-style-lab-looks', saved); renderLooks(); toast('Look saved');
  }
  $('saveLook').addEventListener('click', saveLook);
  $('looks').addEventListener('click', e => {
    const del = e.target.closest('[data-del]'); if (del) { saved.splice(Number(del.dataset.del), 1); store.set('motif-style-lab-looks', saved); renderLooks(); toast('Look deleted'); return; }
    const it = e.target.closest('.look'); if (it) { const s = saved[Number(it.dataset.i)]; setAspect(s.aspect || aspect); commit(s.look, `Loaded ${s.name}`); }
  });
  $('looks').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('look')) { e.preventDefault(); e.target.click(); } });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const r = parsePreset(await f.text()); setAspect(r.aspect); commit(r.look, 'Preset loaded'); }
    catch (err) { toast(`That file isn’t a Style Lab preset: ${err.message}.`); }
    e.target.value = '';
  });

  // ---------- export ----------
  const FORMATS = [
    { id: 'mp4', name: 'MP4', note: 'H.264 · WebCodecs' }, { id: 'webm', name: 'WebM', note: 'VP9 · alpha capable' },
    { id: 'png-seq', name: 'PNG sequence', note: 'ZIP · alpha' }, { id: 'png', name: 'PNG frame', note: 'Current frame' },
    { id: 'json', name: 'Preset JSON', note: 'For Motif' },
  ];
  const ex = { format: 'mp4', tier: 1080, fps: 30, loops: 1, transparent: false };
  let caps = null, exAbort = null, lastFile = null;
  let downloadsP = null;
  const getDownloads = () => { if (!downloadsP) downloadsP = (window.claude && window.claude.use) ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null); return downloadsP; };
  getDownloads();
  function fillSelect(el, opts, val) { el.innerHTML = opts.map(o => `<option value="${o.v}"${String(o.v) === String(val) ? ' selected' : ''}>${o.l}</option>`).join(''); }
  function renderFormats() {
    $('formats').innerHTML = FORMATS.map(f => {
      let dis = '';
      if (caps) {
        if (f.id === 'mp4' && !(caps.webcodecs && caps.muxers && caps.mp4)) dis = 'No H.264 encoder in this browser';
        if (f.id === 'webm' && !((caps.webcodecs && caps.muxers && caps.webm) || caps.recorder)) dis = 'No WebM encoder in this browser';
        if (f.id === 'png-seq' && !caps.zip) dis = 'ZIP library unavailable';
      }
      return `<button class="fmt" role="radio" data-f="${f.id}" aria-checked="${f.id === ex.format}"${dis ? ` disabled title="${dis}"` : ''}><b>${f.name}</b><small>${dis || f.note}</small></button>`;
    }).join('');
  }
  function exSummary() {
    const { w, h } = exportSize(aspect, ex.tier), n = frameCount(look, ex.fps, ex.loops);
    const still = ex.format === 'png' || ex.format === 'json';
    const alphaOk = ['webm', 'png', 'png-seq'].includes(ex.format);
    $('exAlpha').disabled = !alphaOk; if (!alphaOk) $('exAlpha').checked = false;
    ['exFps', 'exLoops'].forEach(id => { $(id).disabled = still; });
    $('exTier').disabled = ex.format === 'json';
    $('exSummary').textContent = ex.format === 'json' ? `${getStyle(look.styleId).name} preset · all parameters, palette and aspect` :
      ex.format === 'png' ? `${w} × ${h} px · frame at ${stage.time.toFixed(2)} s` :
      `${w} × ${h} px · ${ex.fps} fps · ${n} frames · ${(n / ex.fps).toFixed(2)} s · seamless loop${ex.format === 'png-seq' && n > 240 ? ' · large ZIP, consider fewer frames' : ''}`;
  }
  async function openExport() {
    if (!$('exportDlg').open) $('exportDlg').showModal();
    fillSelect($('exAspect'), ASPECTS.map(a => ({ v: a.id, l: a.label })), aspect);
    fillSelect($('exTier'), TIERS.map(t => { const s = exportSize(aspect, t); return { v: t, l: `${t}p · ${s.w}×${s.h}` }; }), ex.tier);
    fillSelect($('exFps'), FPS.map(f => ({ v: f, l: `${f} fps` })), ex.fps);
    $('exLoops').value = ex.loops; $('exAlpha').checked = ex.transparent;
    $('exStatus').textContent = ''; $('exStatus').className = 'status'; $('exProgress').hidden = true; $('exSave').hidden = true; $('exRender').disabled = false;
    renderFormats(); exSummary();
    if (!caps) { caps = await probeCapabilities(); if (caps.webcodecs === false && ex.format === 'mp4') ex.format = caps.recorder ? 'webm' : 'png-seq'; renderFormats(); exSummary(); }
  }
  $('formats').addEventListener('click', e => { const b = e.target.closest('.fmt'); if (!b || b.disabled) return; ex.format = b.dataset.f; renderFormats(); exSummary(); });
  $('exAspect').addEventListener('change', e => { setAspect(e.target.value); openExport(); });
  $('exTier').addEventListener('change', e => { ex.tier = Number(e.target.value); exSummary(); });
  $('exFps').addEventListener('change', e => { ex.fps = Number(e.target.value); exSummary(); });
  $('exLoops').addEventListener('change', e => { ex.loops = Number(e.target.value); exSummary(); });
  $('exAlpha').addEventListener('change', e => { ex.transparent = e.target.checked; });
  function status(msg, err) { $('exStatus').textContent = msg; $('exStatus').className = 'status' + (err ? ' err' : ''); }
  async function offer() {
    if (!lastFile) return;
    const dl = await getDownloads();
    if (dl) {
      try { await dl.save({ filename: lastFile.filename, data: lastFile.blob }); status(`Saved ${lastFile.filename}${lastFile.note ? '. ' + lastFile.note : ''}`); $('exSave').hidden = true; }
      catch (e) {
        const code = e && e.code;
        if (code === 'declined') status('Save cancelled. The render is still here if you want to try again.');
        else if (code === 'too_large') status('That file is too large to save here. Try a smaller size or fewer loops.', true);
        else if (code === 'rate_limited') status('A save prompt is already open. Try again in a moment.');
        else status('Saving files isn’t available in this view.', true);
        $('exSave').hidden = false;
      }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(lastFile.blob); a.download = lastFile.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000); status(`Saved ${lastFile.filename}${lastFile.note ? '. ' + lastFile.note : ''}`); $('exSave').hidden = false;
    }
  }
  $('exSave').addEventListener('click', offer);
  $('exRender').addEventListener('click', async () => {
    exAbort = new AbortController(); $('exRender').disabled = true; $('exSave').hidden = true; $('exProgress').hidden = false; $('exProgress').value = 0; status('Preparing…');
    const wasPlaying = stage.playing; stage.pause();
    try {
      lastFile = await runExport(clone(look), { ...ex, aspect, time: stage.time }, { signal: exAbort.signal, onProgress: (f, msg) => { $('exProgress').value = f; status(msg); } });
      $('exProgress').value = 1; status(`Rendered ${lastFile.filename} (${(lastFile.blob.size / 1048576).toFixed(1)} MB)`);
      await offer();
    } catch (e) {
      if (e && e.name === 'AbortError') status('Export cancelled.'); else status(e && e.message ? e.message : 'Export failed.', true);
    } finally { exAbort = null; $('exRender').disabled = false; if (wasPlaying) stage.play(); }
  });
  function closeExport() { if (exAbort) { exAbort.abort(); return; } $('exportDlg').close(); }
  $('exCancel').addEventListener('click', closeExport); $('exportClose').addEventListener('click', closeExport);
  $('exportDlg').addEventListener('cancel', e => { if (exAbort) { e.preventDefault(); exAbort.abort(); } });
  $('exportBtn').addEventListener('click', openExport);
  $('keysBtn').addEventListener('click', () => $('keysDlg').showModal());
  $('keysClose').addEventListener('click', () => $('keysDlg').close());

  // ---------- toast ----------
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    const tg = e.target, tag = tg.tagName;
    const typing = tag === 'INPUT' && ['text', 'search'].includes(tg.type) || tag === 'TEXTAREA' || tag === 'SELECT';
    if ($('exportDlg').open || $('keysDlg').open) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (typing || mod || e.altKey) return;
    if (evolveOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeEvolve(); return; }
      if (/^[1-6]$/.test(e.key)) { e.preventDefault(); keep(Number(e.key) - 1); return; }
    }
    const onRange = tag === 'INPUT' && tg.type === 'range';
    switch (e.key) {
      case ' ': if (tag === 'BUTTON' || tag === 'INPUT') return; e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft': case 'ArrowRight': if (onRange) return; e.preventDefault(); stage.pause(); $('play').textContent = '▶'; stage.step((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); break;
      case '[': stepStyle(-1); break;
      case ']': stepStyle(1); break;
      case 'm': case 'M': doMutate(); break;
      case 'e': case 'E': evolveOpen ? closeEvolve() : openEvolve(); break;
      case 'r': case 'R': doRandom(); break;
      case 's': case 'S': saveLook(); break;
      case 'g': case 'G': toggleGuides(); break;
      case 'x': case 'X': openExport(); break;
      case '?': $('keysDlg').showModal(); break;
      default: if (/^[1-6]$/.test(e.key) && !evolveOpen) setAspect(ASPECTS[Number(e.key) - 1].id);
    }
  });
  $('libList').addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); stepStyle(e.key === 'ArrowDown' ? 1 : -1); } });
  $('libList').tabIndex = 0;

  // ---------- refresh ----------
  let lastStyle = null;
  function refresh() {
    renderInspector(); stage.invalidate();
    if (lastStyle !== look.styleId) { lastStyle = look.styleId; $('libList').querySelectorAll('.style-row').forEach(r => r.setAttribute('aria-selected', r.id === 'opt-' + look.styleId)); $('libList').setAttribute('aria-activedescendant', 'opt-' + look.styleId); }
  }
  renderLibrary(); refresh(); renderLooks(); requestAnimationFrame(sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stage.invalidate(); drawThumbs(); });
  // Test and automation hooks (read-only views plus the same actions the UI offers).
  window.__lab = {
    get look() { return clone(look); }, get historySize() { return history.length; }, get cursor() { return cursor; }, stage, setAspect, selectStyle: id => selectStyle(id), mutate: doMutate, randomize: doRandom, undo, redo, openEvolve, keep, openExport, get children() { return children.length; },
    styles: STYLES.map(s => ({ id: s.id, params: Object.keys(s.params).length })),
    renderAt(styleId, t, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const l = defaultLook(styleId, look.shared); const x = c.getContext('2d'); const t0 = performance.now(); renderFrame(x, w, h, l, t); const ms = performance.now() - t0; return { data: x.getImageData(0, 0, w, h).data, ms }; },
    exportNow: (s) => runExport(clone(look), { aspect, time: stage.time, tier: 720, fps: 24, loops: 1, transparent: false, ...s }).then(r => ({ size: r.blob.size, type: r.blob.type, filename: r.filename, note: r.note || '' })),
    probe: () => probeCapabilities(),
  };
}
