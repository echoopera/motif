// AgentMotif perceptual metrics — runs in the browser page (no deps). Exposes window.AM.
// features(imageData) -> a compact visual fingerprint; compare(fa, fb) -> scores + a written gap report.
// Everything is deterministic (seeded k-means, fixed projections) so scores are comparable across runs.
(function () {
  const AM = {};
  const srgbToLin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = srgbToLin(i / 255);
  function oklab(r, g, b) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToHex(L, a, b) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return '#' + lin.map(v => { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(v * 255).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  AM.labToHex = labToHex;
  let seed = 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // Resample ImageData to w x h with box filtering; returns { w, h, L, A, B, Y } (OKLab + linear luminance).
  function prep(img, maxW) {
    const sw = img.width, sh = img.height; const w = Math.min(maxW, sw), h = Math.max(1, Math.round(sh * w / sw));
    const L = new Float32Array(w * h), A = new Float32Array(w * h), B = new Float32Array(w * h), Y = new Float32Array(w * h);
    const fx = sw / w, fy = sh / h, d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0; const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)), y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * sw + xx) * 4; const a = d[i + 3] / 255; r += LUT[d[i]] * a; g += LUT[d[i + 1]] * a; b += LUT[d[i + 2]] * a; n++; }
      r /= n; g /= n; b /= n; const o = oklab(r, g, b); const k = y * w + x; L[k] = o[0]; A[k] = o[1]; B[k] = o[2]; Y[k] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return { w, h, L, A, B, Y };
  }
  function quant(arr, q) { const s = Array.from(arr).sort((a, b) => a - b); return q.map(p => s[Math.min(s.length - 1, Math.floor(p * s.length))]); }
  function kmeans(P, k) {
    const n = P.L.length; seed = 7; const C = [];
    let i0 = Math.floor(rnd() * n); C.push([P.L[i0], P.A[i0], P.B[i0]]);
    const dist = new Float32Array(n).fill(1e9);
    while (C.length < k) { // k-means++
      const c = C[C.length - 1]; let sum = 0;
      for (let i = 0; i < n; i++) { const dd = (P.L[i] - c[0]) ** 2 + (P.A[i] - c[1]) ** 2 + (P.B[i] - c[2]) ** 2; if (dd < dist[i]) dist[i] = dd; sum += dist[i]; }
      let t = rnd() * sum, j = 0; while (j < n - 1 && (t -= dist[j]) > 0) j++; C.push([P.L[j], P.A[j], P.B[j]]);
    }
    const as = new Int32Array(n);
    for (let it = 0; it < 14; it++) {
      const S = C.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) { let best = 0, bd = 1e9; for (let j = 0; j < k; j++) { const c = C[j]; const dd = (P.L[i] - c[0]) ** 2 + (P.A[i] - c[1]) ** 2 + (P.B[i] - c[2]) ** 2; if (dd < bd) { bd = dd; best = j; } } as[i] = best; const s = S[best]; s[0] += P.L[i]; s[1] += P.A[i]; s[2] += P.B[i]; s[3]++; }
      S.forEach((s, j) => { if (s[3]) C[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    }
    const cnt = new Array(k).fill(0); for (let i = 0; i < n; i++) cnt[as[i]]++;
    return C.map((c, j) => ({ lab: c, w: cnt[j] / n, hex: labToHex(c[0], c[1], c[2]), chroma: Math.hypot(c[1], c[2]) })).filter(c => c.w > 0).sort((a, b) => b.w - a.w);
  }
  // Suggest a Motif palette {bg, ink, a:[3]} from the clusters: bg = heaviest dark/low-chroma, ink = lightest,
  // accents = most chromatic-and-present remaining clusters.
  function suggestPalette(cl, meanL) {
    const byL = [...cl].sort((a, b) => a.lab[0] - b.lab[0]);
    const darkKey = meanL < 0.55; let bg = darkKey ? byL[0] : byL[byL.length - 1]; let ink = darkKey ? byL[byL.length - 1] : byL[0];
    const heavy = [...cl].sort((a, b) => b.w - a.w)[0]; if (heavy.chroma < 0.06 && Math.abs(heavy.lab[0] - bg.lab[0]) < 0.25) bg = heavy;
    const rest = cl.filter(c => c !== bg && c !== ink).sort((a, b) => (b.chroma + 0.02) * Math.sqrt(b.w) - (a.chroma + 0.02) * Math.sqrt(a.w));
    const a = rest.slice(0, 3).map(c => c.hex); while (a.length < 3) a.push((rest[0] || ink).hex);
    return { bg: bg.hex, ink: ink.hex, a };
  }
  // 1D DFT helpers for the radial power spectrum slope (1/f^beta): beta≈2 natural photos, <1.5 noisy/grainy, >3 smooth gradients.
  function spectrumSlope(P) {
    const N = 64; const g = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const sx = Math.floor(x * P.w / N), sy = Math.floor(y * P.h / N); const wnd = (0.5 - 0.5 * Math.cos(2 * Math.PI * x / (N - 1))) * (0.5 - 0.5 * Math.cos(2 * Math.PI * y / (N - 1))); g[y * N + x] = P.L[sy * P.w + sx] * wnd; }
    const re = new Float32Array(N * N), im = new Float32Array(N * N); const cs = new Float32Array(N), sn = new Float32Array(N);
    for (let k = 0; k < N; k++) { cs[k] = Math.cos(2 * Math.PI * k / N); sn[k] = Math.sin(2 * Math.PI * k / N); }
    const tr = new Float32Array(N * N), ti = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let u = 0; u < N; u++) { let a = 0, b = 0; for (let x = 0; x < N; x++) { const k = (u * x) % N; a += g[y * N + x] * cs[k]; b -= g[y * N + x] * sn[k]; } tr[y * N + u] = a; ti[y * N + u] = b; }
    for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) { let a = 0, b = 0; for (let y = 0; y < N; y++) { const k = (v * y) % N; const c = cs[k], s = -sn[k]; a += tr[y * N + u] * c - ti[y * N + u] * s; b += tr[y * N + u] * s + ti[y * N + u] * c; } re[v * N + u] = a; im[v * N + u] = b; }
    const bins = new Float64Array(N / 2), cnt = new Float64Array(N / 2);
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) { const fu = u <= N / 2 ? u : u - N, fv = v <= N / 2 ? v : v - N; const r = Math.round(Math.hypot(fu, fv)); if (r >= 1 && r < N / 2) { bins[r] += re[v * N + u] ** 2 + im[v * N + u] ** 2; cnt[r]++; } }
    let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (let r = 2; r < 28; r++) { if (!cnt[r] || bins[r] <= 0) continue; const x = Math.log(r), y = Math.log(bins[r] / cnt[r] + 1e-12); sx += x; sy += y; sxx += x * x; sxy += x * y; n++; }
    const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
    const prof = []; for (let r = 1; r < N / 2; r++) prof.push(cnt[r] ? Math.log10(bins[r] / cnt[r] + 1e-12) : 0);
    return { beta: -slope, profile: prof };
  }
  function features(img) {
    const P = prep(img, 192); const { w, h, L, A, B } = P; const n = w * h;
    let mL = 0, mC = 0; const C = new Float32Array(n);
    for (let i = 0; i < n; i++) { mL += L[i]; C[i] = Math.hypot(A[i], B[i]); mC += C[i]; } mL /= n; mC /= n;
    let vL = 0; for (let i = 0; i < n; i++) vL += (L[i] - mL) ** 2; const rms = Math.sqrt(vL / n);
    const [p05, p50, p95] = quant(L, [0.05, 0.5, 0.95]); const [c90] = quant(C, [0.9]);
    const lumHist = new Array(32).fill(0); for (let i = 0; i < n; i++) lumHist[Math.max(0, Math.min(31, Math.floor(L[i] * 32)))] += 1 / n;
    const hueHist = new Array(12).fill(0); let hw = 0; for (let i = 0; i < n; i++) { const hh = (Math.atan2(B[i], A[i]) / (2 * Math.PI) + 1) % 1; hueHist[Math.floor(hh * 12) % 12] += C[i]; hw += C[i]; } for (let j = 0; j < 12; j++) hueHist[j] /= Math.max(hw, 1e-9);
    // Gradients: Sobel on L; doubled-angle structure tensor for orientation and coherence.
    let gm = 0, Jxx = 0, Jyy = 0, Jxy = 0; const ori = new Array(8).fill(0); let hf = 0, radA = 0; const rcx = (w - 1) / 2, rcy = (h - 1) / 2;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const at = (dx, dy) => L[(y + dy) * w + x + dx];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const m = Math.hypot(gx, gy); gm += m; { const rx = x - rcx, ry = y - rcy, rl = Math.hypot(rx, ry) || 1; radA += Math.abs(gx * ry - gy * rx) / rl; } Jxx += gx * gx; Jyy += gy * gy; Jxy += gx * gy;
      const ang = ((Math.atan2(gy, gx) + Math.PI) % Math.PI) / Math.PI; ori[Math.floor(ang * 8) % 8] += m;
      const blur = (at(-1, -1) + at(0, -1) + at(1, -1) + at(-1, 0) + at(0, 0) + at(1, 0) + at(-1, 1) + at(0, 1) + at(1, 1)) / 9; hf += (at(0, 0) - blur) ** 2;
    }
    const inner = (w - 2) * (h - 2); gm /= inner; const os = ori.reduce((a, b) => a + b, 0) || 1; for (let j = 0; j < 8; j++) ori[j] /= os;
    const coh = Math.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy * Jxy) / Math.max(Jxx + Jyy, 1e-9);
    const domAngle = ((0.5 * Math.atan2(2 * Jxy, Jxx - Jyy)) * 180 / Math.PI + 90 + 180) % 180; // direction of strokes (perpendicular to gradient)
    const grain = Math.sqrt(hf / inner);
    // Radial streak index: +1 when edges run toward the centre (zoom blur, tunnels, light rays), -1 for rings, ~0 isotropic.
    const radial = ((radA / Math.max(gm * inner, 1e-9)) - 2 / Math.PI) / (1 - 2 / Math.PI);
    // Symmetry: mirror and n-fold rotational correlation about the centre.
    const corr = (f) => { let s = 0, sa = 0, sb = 0, saa = 0, sbb = 0, m = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = f(x, y); if (!q) continue; const a = L[y * w + x], b = q; s += a * b; sa += a; sb += b; saa += a * a; sbb += b * b; m++; } const cov = s / m - (sa / m) * (sb / m); return cov / Math.max(1e-9, Math.sqrt((saa / m - (sa / m) ** 2) * (sbb / m - (sb / m) ** 2))); };
    const symLR = corr((x, y) => L[y * w + (w - 1 - x)]), symTB = corr((x, y) => L[(h - 1 - y) * w + x]);
    const cx = (w - 1) / 2, cy = (h - 1) / 2; const rot = []; let bestN = 0, bestR = -1;
    for (const k of [2, 3, 4, 5, 6, 8, 12]) { const a = 2 * Math.PI / k, ca = Math.cos(a), sa = Math.sin(a); const r = corr((x, y) => { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > (Math.min(w, h) / 2) ** 2) return null; const X = Math.round(cx + dx * ca - dy * sa), Y = Math.round(cy + dx * sa + dy * ca); return X >= 0 && X < w && Y >= 0 && Y < h ? L[Y * w + X] + 1e-9 : null; }); rot.push([k, +r.toFixed(3)]); if (r > bestR + 0.03) { bestR = r; bestN = k; } }
    // Radial brightness profile (centre glow, vignette) and brightness centroid.
    const rad = new Array(8).fill(0), rc = new Array(8).fill(0); let mx = 0, my = 0, ms = 0; const R = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = L[y * w + x]; const r = Math.min(7, Math.floor(Math.hypot(x - cx, y - cy) / R * 8)); rad[r] += v; rc[r]++; mx += x * v; my += y * v; ms += v; }
    for (let j = 0; j < 8; j++) rad[j] = rc[j] ? rad[j] / rc[j] : 0;
    // Layout thumbnail 12 x 8 (OKLab means).
    const TW = 12, TH = 8, thumb = [];
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) { let a = 0, b = 0, c = 0, m = 0; for (let y = Math.floor(ty * h / TH); y < Math.floor((ty + 1) * h / TH); y++) for (let x = Math.floor(tx * w / TW); x < Math.floor((tx + 1) * w / TW); x++) { const i = y * w + x; a += L[i]; b += A[i]; c += B[i]; m++; } thumb.push([a / m, b / m, c / m]); }
    const clusters = kmeans(P, 6);
    const spec = spectrumSlope(P);
    let hi = 0, lo = 0; for (let i = 0; i < n; i++) { if (L[i] > 0.9) hi++; if (L[i] < 0.15) lo++; }
    return {
      size: [img.width, img.height],
      tone: { meanL: +mL.toFixed(4), p05: +p05.toFixed(4), p50: +p50.toFixed(4), p95: +p95.toFixed(4), contrast: +rms.toFixed(4), highlights: +(hi / n).toFixed(4), shadows: +(lo / n).toFixed(4), key: mL < 0.35 ? 'low-key' : mL > 0.7 ? 'high-key' : 'mid-key' },
      color: { meanChroma: +mC.toFixed(4), chromaP90: +c90.toFixed(4), hueHist: hueHist.map(v => +v.toFixed(4)), clusters: clusters.map(c => ({ hex: c.hex, w: +c.w.toFixed(3), L: +c.lab[0].toFixed(3), C: +c.chroma.toFixed(3) })), palette: suggestPalette(clusters, mL) },
      texture: { edge: +gm.toFixed(4), grain: +grain.toFixed(4), beta: +spec.beta.toFixed(3), spectrum: spec.profile.map(v => +v.toFixed(3)), orient: ori.map(v => +v.toFixed(4)), coherence: +coh.toFixed(4), strokeAngle: +domAngle.toFixed(1), radial: +radial.toFixed(3) },
      layout: { thumb: thumb.map(t => t.map(v => +v.toFixed(4))), centroid: [+(mx / ms / w).toFixed(3), +(1 - my / ms / h).toFixed(3)], radial: rad.map(v => +v.toFixed(4)), symLR: +symLR.toFixed(3), symTB: +symTB.toFixed(3), rotational: rot, nfold: bestR > 0.55 ? bestN : 0 },
      _samples: sampleLab(P, 4096),
      _gray: grayFor(P),
    };
  }
  function sampleLab(P, m) { const n = P.L.length; const out = new Float32Array(m * 3); seed = 99; for (let i = 0; i < m; i++) { const j = Math.floor(rnd() * n); out[i * 3] = P.L[j]; out[i * 3 + 1] = P.A[j]; out[i * 3 + 2] = P.B[j]; } return Array.from(out); }
  function grayFor(P) { // 96-wide luma for SSIM
    const W = 96, H = Math.max(8, Math.round(P.h * W / P.w)); const g = new Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, m = 0; for (let yy = Math.floor(y * P.h / H); yy < Math.max(Math.floor(y * P.h / H) + 1, Math.floor((y + 1) * P.h / H)); yy++) for (let xx = Math.floor(x * P.w / W); xx < Math.max(Math.floor(x * P.w / W) + 1, Math.floor((x + 1) * P.w / W)); xx++) { s += P.L[yy * P.w + xx]; m++; } g[y * W + x] = +(s / m).toFixed(4); }
    return { w: W, h: H, g };
  }
  // Sliced Wasserstein distance between two OKLab sample clouds (colour distribution distance, layout-free).
  function swd(a, b) {
    const m = Math.min(a.length, b.length) / 3; let tot = 0; const D = 24;
    for (let d = 0; d < D; d++) {
      const th = Math.PI * (d + 0.5) / D, ph = Math.acos(1 - 2 * ((d * 0.618034) % 1)); const v = [Math.cos(ph) * 1.0, Math.sin(ph) * Math.cos(th) * 1.0, Math.sin(ph) * Math.sin(th) * 1.0];
      const pa = new Float32Array(m), pb = new Float32Array(m);
      for (let i = 0; i < m; i++) { pa[i] = a[i * 3] * v[0] + a[i * 3 + 1] * v[1] + a[i * 3 + 2] * v[2]; pb[i] = b[i * 3] * v[0] + b[i * 3 + 1] * v[1] + b[i * 3 + 2] * v[2]; }
      pa.sort(); pb.sort(); let s = 0; for (let i = 0; i < m; i++) s += Math.abs(pa[i] - pb[i]); tot += s / m;
    }
    return tot / D;
  }
  function ssim(A, B) { // single-scale SSIM on 96-wide luma, 7x7 box windows, with 2 dyadic scales averaged
    let tot = 0, scales = 0; let a = A, b = B;
    for (let sc = 0; sc < 3; sc++) {
      const w = Math.min(a.w, b.w), h = Math.min(a.h, b.h); if (w < 8 || h < 8) break; const C1 = 0.0001, C2 = 0.0009; let s = 0, n = 0;
      for (let y = 0; y + 7 <= h; y += 2) for (let x = 0; x + 7 <= w; x += 2) {
        let ma = 0, mb = 0, va = 0, vb = 0, cv = 0;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const p = a.g[(y + j) * a.w + x + i], q = b.g[(y + j) * b.w + x + i]; ma += p; mb += q; }
        ma /= 49; mb /= 49;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const p = a.g[(y + j) * a.w + x + i] - ma, q = b.g[(y + j) * b.w + x + i] - mb; va += p * p; vb += q * q; cv += p * q; }
        va /= 48; vb /= 48; cv /= 48;
        s += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
      }
      tot += s / Math.max(n, 1); scales++;
      const half = g => { const W = Math.floor(g.w / 2), H = Math.floor(g.h / 2), o = new Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = (g.g[2 * y * g.w + 2 * x] + g.g[2 * y * g.w + 2 * x + 1] + g.g[(2 * y + 1) * g.w + 2 * x] + g.g[(2 * y + 1) * g.w + 2 * x + 1]) / 4; return { w: W, h: H, g: o }; };
      a = half(a); b = half(b);
    }
    return tot / Math.max(scales, 1);
  }
  const l1 = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
  const emd1 = (a, b) => { let ca = 0, cb = 0, s = 0; for (let i = 0; i < a.length; i++) { ca += a[i]; cb += b[i]; s += Math.abs(ca - cb); } return s / a.length; };
  const MODES = {
    style: { palette: 0.30, tone: 0.22, texture: 0.28, layout: 0.12, structure: 0.08 },
    layout: { palette: 0.22, tone: 0.18, texture: 0.20, layout: 0.24, structure: 0.16 },
    exact: { palette: 0.18, tone: 0.14, texture: 0.14, layout: 0.20, structure: 0.34 },
  };
  // Compare target t with render r. Returns { score 0..100, parts, gaps[] } where gaps are actionable notes.
  function compare(t, r, mode) {
    const W = MODES[mode] || MODES.style;
    const dPal = swd(t._samples, r._samples);
    const sPal = Math.exp(-dPal / 0.045);
    const sHue = 1 - 0.5 * l1(t.color.hueHist, r.color.hueHist);
    const sChroma = Math.exp(-Math.abs(t.color.meanChroma - r.color.meanChroma) / 0.03);
    const palette = 0.6 * sPal + 0.25 * sHue + 0.15 * sChroma;
    const sLum = Math.exp(-emd1(t.tone.lumHist || [], r.tone.lumHist || []) / 0.04);
    const dMean = r.tone.meanL - t.tone.meanL, dCon = r.tone.contrast - t.tone.contrast;
    const tone = 0.3 * Math.exp(-Math.abs(dMean) / 0.06) + 0.25 * Math.exp(-Math.abs(dCon) / 0.04) + 0.25 * sLum + 0.2 * Math.exp(-(Math.abs(r.tone.p95 - t.tone.p95) + Math.abs(r.tone.p05 - t.tone.p05)) / 0.12);
    const dBeta = r.texture.beta - t.texture.beta;
    const sSpec = Math.exp(-Math.abs(dBeta) / 0.5) * 0.5 + 0.5 * Math.exp(-l1(t.texture.spectrum.map((v, i) => v - t.texture.spectrum[0]), r.texture.spectrum.map((v, i) => v - r.texture.spectrum[0])) / t.texture.spectrum.length / 0.35);
    const sEdge = Math.exp(-Math.abs(Math.log((r.texture.edge + 1e-3) / (t.texture.edge + 1e-3))) / 0.45);
    const sOri = 1 - 0.5 * l1(t.texture.orient, r.texture.orient);
    const sCoh = Math.exp(-Math.abs(r.texture.coherence - t.texture.coherence) / 0.2) * 0.5 + 0.5 * Math.exp(-Math.abs(r.texture.radial - t.texture.radial) / 0.15);
    const sGrain = Math.exp(-Math.abs(Math.log((r.texture.grain + 1e-3) / (t.texture.grain + 1e-3))) / 0.6);
    const texture = 0.3 * sSpec + 0.22 * sEdge + 0.2 * sOri + 0.13 * sCoh + 0.15 * sGrain;
    let dTh = 0; for (let i = 0; i < t.layout.thumb.length; i++) { const a = t.layout.thumb[i], b = r.layout.thumb[i]; dTh += Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.5, (a[2] - b[2]) * 1.5); } dTh /= t.layout.thumb.length;
    const sRad = Math.exp(-l1(t.layout.radial, r.layout.radial) / 8 / 0.06);
    const sSym = Math.exp(-(Math.abs(t.layout.symLR - r.layout.symLR) + Math.abs(t.layout.symTB - r.layout.symTB)) / 0.5);
    const layout = 0.6 * Math.exp(-dTh / 0.09) + 0.25 * sRad + 0.15 * sSym;
    const structure = Math.max(0, ssim(t._gray, r._gray));
    const parts = { palette, tone, texture, layout, structure };
    const score = 100 * Object.entries(W).reduce((s, [k, w]) => s + w * parts[k], 0);
    // Gap report: the largest, most fixable differences, phrased as shader moves.
    const gaps = [];
    if (Math.abs(dMean) > 0.04) gaps.push(`${dMean < 0 ? 'darker' : 'brighter'} than target by ${Math.abs(dMean).toFixed(2)} OKLab L → ${dMean < 0 ? 'raise' : 'lower'} exposure / emission (≈${(dMean < 0 ? '+' : '-') + (Math.abs(dMean) * 4).toFixed(1)} stops)`);
    if (Math.abs(dCon) > 0.03) gaps.push(`contrast ${dCon < 0 ? 'too flat' : 'too hard'} (RMS ${r.tone.contrast.toFixed(2)} vs ${t.tone.contrast.toFixed(2)}) → ${dCon < 0 ? 'deepen shadows / punchier tone map / sharper falloffs' : 'lift blacks, softer shoulder, wider glows'}`);
    if (t.tone.highlights - r.tone.highlights > 0.02) gaps.push(`missing highlights (${(t.tone.highlights * 100).toFixed(1)}% near-white in target vs ${(r.tone.highlights * 100).toFixed(1)}%) → add HDR hot cores + bloom`);
    if (r.tone.highlights - t.tone.highlights > 0.03) gaps.push(`clipping: ${(r.tone.highlights * 100).toFixed(1)}% near-white vs ${(t.tone.highlights * 100).toFixed(1)}% → reduce peak radiance or use AgX`);
    const dC = r.color.meanChroma - t.color.meanChroma; if (Math.abs(dC) > 0.015) gaps.push(`${dC < 0 ? 'under' : 'over'}-saturated (chroma ${r.color.meanChroma.toFixed(3)} vs ${t.color.meanChroma.toFixed(3)})`);
    if (sHue < 0.8) { const tm = t.color.hueHist.indexOf(Math.max(...t.color.hueHist)), rm = r.color.hueHist.indexOf(Math.max(...r.color.hueHist)); gaps.push(`hue mass differs: target peaks at ${tm * 30}–${tm * 30 + 30}° OKLCh, render at ${rm * 30}–${rm * 30 + 30}° → retune palette (use the analyze palette) or hue-shift`); }
    if (Math.abs(dBeta) > 0.35) gaps.push(`spectral slope β ${r.texture.beta.toFixed(2)} vs target ${t.texture.beta.toFixed(2)} → ${dBeta < 0 ? 'too much fine detail: fewer octaves, lower frequency, more blur' : 'too smooth: add octaves, finer detail, grain or sharper edges'}`);
    if (sEdge < 0.7) gaps.push(`edge density ${r.texture.edge.toFixed(3)} vs ${t.texture.edge.toFixed(3)} → ${r.texture.edge < t.texture.edge ? 'add crisp structure (thinner lines, harder SDF edges)' : 'soften edges / fewer lines'}`);
    if (t.texture.coherence > 0.25 && Math.abs(r.texture.coherence - t.texture.coherence) > 0.12) gaps.push(`target is strongly directional (coherence ${t.texture.coherence.toFixed(2)}, strokes at ${t.texture.strokeAngle.toFixed(0)}°), render ${r.texture.coherence.toFixed(2)} at ${r.texture.strokeAngle.toFixed(0)}° → align flow / anisotropic stretch to that angle`);
    if (Math.abs(r.texture.radial - t.texture.radial) > 0.12) gaps.push(`radial streak index ${r.texture.radial.toFixed(2)} vs target ${t.texture.radial.toFixed(2)} → ${r.texture.radial < t.texture.radial ? 'more structure converging on the centre: zoom blur, polar stretch, light rays' : 'less radial streaking'}`);
    if (sGrain < 0.6) gaps.push(`grain ${r.texture.grain.toFixed(3)} vs ${t.texture.grain.toFixed(3)} → ${r.texture.grain < t.texture.grain ? 'add film grain / micro-texture' : 'reduce noise; denoise via fewer high-freq octaves'}`);
    if (layout < 0.6) { const dx = r.layout.centroid[0] - t.layout.centroid[0], dy = r.layout.centroid[1] - t.layout.centroid[1]; gaps.push(`composition: brightness centroid off by (${dx.toFixed(2)}, ${dy.toFixed(2)}) frame units; radial profile ${t.layout.radial[0] > t.layout.radial[7] + 0.1 ? 'target has a bright centre' : 'target is edge-weighted or even'} → move the focal element / reshape vignette`); }
    if (t.layout.nfold && t.layout.nfold !== r.layout.nfold) gaps.push(`target shows ${t.layout.nfold}-fold rotational symmetry → polar repeat / kaleidoscope with n=${t.layout.nfold}`);
    if (Math.abs(t.layout.symLR - r.layout.symLR) > 0.3) gaps.push(`mirror symmetry L/R ${r.layout.symLR.toFixed(2)} vs ${t.layout.symLR.toFixed(2)}`);
    return { score: +score.toFixed(2), parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +(v * 100).toFixed(1)])), detail: { swd: +dPal.toFixed(4), ssim: +structure.toFixed(3), dMeanL: +dMean.toFixed(3), dBeta: +dBeta.toFixed(2) }, gaps };
  }
  // Attach the luminance histogram lazily (kept off the printed JSON by features()).
  const _f = features; AM.features = img => { const f = _f(img); const P = prep(img, 192); const hst = new Array(32).fill(0); for (let i = 0; i < P.L.length; i++) hst[Math.max(0, Math.min(31, Math.floor(P.L[i] * 32)))] += 1 / P.L.length; f.tone.lumHist = hst.map(v => +v.toFixed(4)); return f; };
  AM.compare = compare; AM.MODES = MODES;
  // Technique hints from a fingerprint: a starting point for the agent's decomposition, not a verdict.
  AM.hints = f => {
    const h = [];
    if (f.texture.coherence > 0.35) h.push(`directional field (coherence ${f.texture.coherence}, ${f.texture.strokeAngle}°): flow-aligned streaks, curl-noise advection, anisotropic stretch, motion-blur/zoom-blur`);
    if (f.texture.radial > 0.15) h.push(`radial streaks (index ${f.texture.radial}): polar stretch / zoom blur toward a vanishing point, light-speed tunnel, god rays`);
    if (f.texture.radial < -0.15) h.push(`concentric structure (index ${f.texture.radial}): rings, ripples, polar bands`);
    if (f.layout.nfold) h.push(`${f.layout.nfold}-fold symmetry: am_kaleido / am_polarRep`);
    if (f.texture.beta > 3.0) h.push(`very smooth (β ${f.texture.beta}): gradients, large soft shapes, low-octave warp; render the field in a 0.5-scale pass`);
    else if (f.texture.beta < 1.6) h.push(`fine/noisy (β ${f.texture.beta}): high-frequency detail, grain, sparkle, dense particles`);
    else h.push(`natural detail spectrum (β ${f.texture.beta}): 4–6 octave fbm / domain warp reads right`);
    if (f.tone.highlights > 0.03 && f.tone.key !== 'high-key') h.push('hot highlights on a darker ground: HDR emission + soft-knee bloom + AgX');
    if (f.tone.key === 'low-key') h.push('low-key: keep bg near palette bg, spend contrast on focal glow; vignette');
    if (f.color.meanChroma > 0.12) h.push('highly saturated: mix in OKLab, avoid ACES desaturation (AgX punchy or Neutral)');
    if (f.color.meanChroma < 0.03) h.push('near-monochrome: drive colour with a single accent + luminance; split-tone for richness');
    if (f.texture.grain > 0.03) h.push(`visible grain/micro texture (${f.texture.grain}): am_grain or a high-frequency layer`);
    if (f.layout.radial[0] > f.layout.radial[7] + 0.15) h.push('bright centre falling off: radial glow / tunnel / vignette');
    if (f.texture.edge > 0.25) h.push('crisp, dense edges: SDF geometry with aa(), line work, cells (lvoro / hex grid)');
    return h;
  };
  window.AM = AM;
})();
