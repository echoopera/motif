// WCAG 2.x relative-luminance contrast computed from the CSS colour tokens (no browser needed).
// Shared by tests/a11y-contrast.test.mjs and tests/browser/a11y.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { load } from '../tests/load.mjs';

const root = path.resolve(import.meta.dirname, '..');

export function parseHex(h) {
  const s = h.replace('#', ''), n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  const v = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)), a = n.length >= 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1;
  return { rgb: v, a };
}
export const over = (fg, bg) => { const f = parseHex(fg), b = parseHex(bg); return f.rgb.map((c, i) => Math.round(c * f.a + b.rgb[i] * (1 - f.a))); };
export const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function ratio(fg, bg) { const b = parseHex(bg).rgb, f = over(fg, bg), l1 = lum(f), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

const grab = css => { const o = {}; for (const x of css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{3,8})\b/g)) o[x[1]] = x[2]; return o; };

// The app's effective palette is the :root blocks of src-v5/head.html (dark workspace). 01-tokens.js `uiCss` is a second,
// currently unused token set; it is exposed separately so drift is visible.
export function tokenSets() {
  const head = fs.readFileSync(path.join(root, 'src-v5/head.html'), 'utf8'), live = {};
  for (const m of head.matchAll(/:root\{([^}]*)\}/g)) Object.assign(live, grab(m[1])); // later :root blocks (e.g. --edge) extend the first
  const css = load('tokens').__m_tokens.uiCss, light = /:root\{([^}]*)\}/.exec(css)[1], dark = /:root\[data-theme="dark"\]\{([^}]*)\}/.exec(css)[1];
  return { live,'tokens.js-light(unused)': grab(light), 'tokens.js-dark(unused)': { ...grab(light), ...grab(dark) } };
}

// Pairs the UI actually uses. kind: 'text' needs 4.5, 'ui' (icons, control boundaries, focus ring, state colours) needs 3.
export const PAIRS = [
  ['text', 'surface-0', 'text'], ['text', 'surface-1', 'text'], ['text', 'surface-2', 'text'], ['text', 'surface-3', 'text'],
  ['text-strong', 'surface-1', 'text'], ['text-strong', 'surface-3', 'text'],
  ['text-muted', 'surface-0', 'text'], ['text-muted', 'surface-1', 'text'], ['text-muted', 'surface-2', 'text'], ['text-muted', 'surface-3', 'text'],
  ['text-dim', 'surface-0', 'text'], ['text-dim', 'surface-1', 'text'], ['text-dim', 'surface-2', 'text'],
  ['accent-ink', 'accent', 'text'], ['accent', 'surface-1', 'text'], ['accent', 'surface-2', 'text'], ['data', 'surface-1', 'text'], ['data-dim', 'surface-1', 'text'],
  ['danger', 'surface-1', 'text'], ['danger', 'surface-2', 'text'], ['ok', 'surface-1', 'text'], ['lock', 'surface-1', 'text'], ['lock', 'surface-2', 'text'],
  ['focus', 'surface-0', 'ui'], ['focus', 'surface-1', 'ui'], ['focus', 'surface-2', 'ui'], ['focus', 'surface-3', 'ui'], ['focus', 'stage', 'ui'],
  // --edge draws control boundaries (fields, selects, switches, slider tracks). --line / --line-strong / --line-hover are decorative dividers and hover states.
  ['edge', 'surface-0', 'ui'], ['edge', 'surface-1', 'ui'], ['edge', 'surface-2', 'ui'],
  ['accent', 'surface-1', 'ui'], ['lock', 'surface-1', 'ui'], ['danger', 'surface-1', 'ui'], ['ok', 'surface-1', 'ui'], ['playhead', 'surface-1', 'ui'],
];

export function checkTokens(only = 'live') {
  const sets = tokenSets(), out = [];
  for (const [theme, t] of Object.entries(sets)) {
    if (only && theme !== only) continue;
    for (const [fg, bg, kind] of PAIRS) {
      const need = kind === 'text' ? 4.5 : 3;
      if (!t[fg] || !t[bg]) { out.push({ theme, fg, bg, kind, ratio: NaN, need, ok: false, missing: true }); continue; }
      const r = ratio(t[fg], t[bg]); out.push({ theme, fg, bg, kind, ratio: +r.toFixed(2), need, ok: r >= need });
    }
  }
  return out;
}
