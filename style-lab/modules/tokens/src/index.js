// tokens — foundations, semantic UI tokens, artwork palettes and colour math.
// The only module allowed to hold raw colour and length values.

export const TOKEN_VERSION = '1.0.0';

// ---------- Chrome: semantic tokens as CSS custom properties ----------
export const uiCss = `
:root{
  --surface-0:#E7E8E4; --surface-1:#F4F5F2; --surface-2:#FFFFFF; --stage:#9A9C98;
  --text:#15171A; --text-muted:#5C6168; --line:#CFD2CB; --line-strong:#AEB2AA;
  --accent:#2B44E0; --accent-ink:#FFFFFF; --accent-soft:#2B44E01F; --lock:#B97A00; --lock-soft:#E0A1001F; --danger:#C2362B;
  --focus:#2B44E0; --scrim:#15171AB3; --shadow:0 18px 40px -24px #0000004D;
  --font-ui:"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --font-display:"Anybody","Arial Narrow",system-ui,sans-serif;
  --text-xs:11px; --text-sm:12px; --text-md:14px; --text-lg:18px; --text-xl:26px;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px; --space-8:32px;
  --radius-s:4px; --radius-m:8px; --radius-l:12px; --hairline:1px; --focus-w:2px;
  --bar-h:52px; --lib-w:272px; --insp-w:328px; --thumb-w:64px; --thumb-h:40px; --target:32px;
  --dur-fast:90ms; --dur-base:150ms; --ease-out:cubic-bezier(.2,0,0,1);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --surface-0:#0E0F11; --surface-1:#16181B; --surface-2:#1E2125; --stage:#2A2D31;
    --text:#E7E9E4; --text-muted:#959BA3; --line:#2A2E33; --line-strong:#3B4046;
    --accent:#8394FF; --accent-ink:#0E0F11; --accent-soft:#8394FF26; --lock:#F0B53D; --lock-soft:#F0B53D1F; --danger:#FF7A6E;
    --focus:#8394FF; --scrim:#000000B3; --shadow:0 18px 40px -24px #000000B3;
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --surface-0:#0E0F11; --surface-1:#16181B; --surface-2:#1E2125; --stage:#2A2D31;
  --text:#E7E9E4; --text-muted:#959BA3; --line:#2A2E33; --line-strong:#3B4046;
  --accent:#8394FF; --accent-ink:#0E0F11; --accent-soft:#8394FF26; --lock:#F0B53D; --lock-soft:#F0B53D1F; --danger:#FF7A6E;
  --focus:#8394FF; --scrim:#000000B3; --shadow:0 18px 40px -24px #000000B3;
  color-scheme:dark;
}`;

// ---------- Artwork palettes (content, never chrome) ----------
export const PALETTES = [
  { id: 'signal',   name: 'Signal',   bg: '#ECEEE9', ink: '#14161A', a: ['#2B44E0', '#C98A06', '#E4572E'] },
  { id: 'graphite', name: 'Graphite', bg: '#121416', ink: '#E8EAE5', a: ['#8596FF', '#F0B53D', '#5FD0B3'] },
  { id: 'riso',     name: 'Riso',     bg: '#F3EEE3', ink: '#1D2B53', a: ['#FF48B0', '#0078BF', '#FFD400'] },
  { id: 'mono',     name: 'Mono',     bg: '#0B0B0C', ink: '#F2F2F0', a: ['#F2F2F0', '#9A9A9A', '#5A5A5A'] },
  { id: 'press',    name: 'Press',    bg: '#F7F5F0', ink: '#111111', a: ['#D33F2A', '#111111', '#8A8A8A'] },
  { id: 'ember',    name: 'Ember',    bg: '#160C0A', ink: '#FFE7D1', a: ['#FF5A1F', '#FFB000', '#B3122E'] },
  { id: 'tidal',    name: 'Tidal',    bg: '#06202B', ink: '#D9F2F2', a: ['#3FD1C6', '#F5B700', '#1F7A8C'] },
  { id: 'bloom',    name: 'Bloom',    bg: '#FBE9E7', ink: '#3A0D2E', a: ['#FF6F59', '#6A4C93', '#2EC4B6'] },
  { id: 'chroma',   name: 'Chroma',   bg: '#0E0E14', ink: '#FFFFFF', a: ['#FF3864', '#2DE2E6', '#F9C80E'] },
  { id: 'moss',     name: 'Moss',     bg: '#E6E4D8', ink: '#23291E', a: ['#4F6D3A', '#C0843D', '#8FA388'] },
];

export const FONTS = [
  { id: 'anybody', name: 'Anybody', css: '"Anybody","Arial Narrow",sans-serif', weights: [300, 500, 700, 900] },
  { id: 'fraunces', name: 'Fraunces', css: '"Fraunces",Georgia,serif', weights: [300, 500, 700, 900] },
  { id: 'mono', name: 'JetBrains Mono', css: '"JetBrains Mono",ui-monospace,monospace', weights: [300, 500, 700, 800] },
  { id: 'sans', name: 'Instrument Sans', css: '"Instrument Sans",system-ui,sans-serif', weights: [400, 500, 600, 700] },
];
export const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,100..900&family=Fraunces:opsz,wght@9..144,300..900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700;800&display=swap';

export const ASPECTS = [
  { id: '16x9', label: '16:9', w: 16, h: 9 },
  { id: '9x16', label: '9:16', w: 9, h: 16 },
  { id: '1x1', label: '1:1', w: 1, h: 1 },
  { id: '4x5', label: '4:5', w: 4, h: 5 },
  { id: '4x3', label: '4:3', w: 4, h: 3 },
  { id: '21x9', label: '21:9', w: 21, h: 9 },
];

// ---------- Colour math ----------
const cache = new Map();
export function rgbOf(hex) {
  let v = cache.get(hex);
  if (v) return v;
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  v = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  cache.set(hex, v);
  return v;
}
export function alpha(hex, a) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
export function mix(hexA, hexB, t) {
  const A = rgbOf(hexA), B = rgbOf(hexB);
  const c = i => Math.round(A[i] + (B[i] - A[i]) * t);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
export function mixRgb(hexA, hexB, t) {
  const A = rgbOf(hexA), B = rgbOf(hexB);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}
export function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Resolved palette handed to styles: bg, ink, accents, helpers.
export function resolvePalette(id, invert) {
  const p = PALETTES.find(x => x.id === id) || PALETTES[0];
  const bg = invert ? p.ink : p.bg, ink = invert ? p.bg : p.ink;
  const list = [ink, ...p.a];
  return {
    id: p.id, name: p.name, bg, ink, a: p.a.slice(),
    pick: i => list[((i % list.length) + list.length) % list.length],
    accent: i => p.a[((i % p.a.length) + p.a.length) % p.a.length],
    alpha, mix, mixRgb, rgbOf,
    dark: luminance(bg) < 0.3,
    shade: luminance(bg) < 0.3 ? '#000000' : ink,
    grainLight: '#FFFFFF', grainDark: '#000000',
  };
}
