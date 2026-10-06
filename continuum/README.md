# CONTINUUM — iPhone-first HUD rebuild

Same audio engine, same four-source spatial composition system, rebuilt as a phone-native instrument
in a cinematic sci-fi HUD language (ice-cyan wireframes, segmented rules, corner brackets, large light numerals).

## Run
    cd continuum && python3 -m http.server 8000   # http://localhost:8000
Open on an iPhone, tap **INIT** (audio needs a gesture), then Share → Add to Home Screen for full-screen.

## What changed
- **Shell**: 5-tab bottom bar (Nav · Mix · FX · Src · Log), safe-area aware, no page scroll, thumb-zone transport dock, top-banner toasts.
- **Nav**: live telemetry numerals, wireframe source globes with dial gauges, drag from any source to draw a route, tap a source or its tile to fly there, live signal-energy bars, wake-lock while a journey plays.
- **Density tiers** for Safari-with-toolbars / SE heights; landscape rail layout; ≥1024px mission-control grid.
- **PWA**: manifest, icons, network-first service worker, `#nav|#mix|#fx|#src|#log` deep links.
- **Perform**: Loop toggle (seamless, beat-locked); drag the route while it plays to reshape it; press-and-hold on the route loops that section (whole bars) until you tap the pulsing dot or pause.
- **Lo-Fi Media** (5th rack slot, 25 presets total): LoFi Tape, Vinyl, 8-Track, Reel to Reel, SP-1200. Native-node tape/vinyl chain plus a small bit-crusher worklet (`lofi-fx.js`).
- **3-Band EQ** (genre presets: Ambient, Electronic, Hip-Hop, Classical, with live LOW/MID/HIGH gain sliders) and **Soft Clipper** (FL-style threshold + post gain with a glue compressor, 5 presets) close the chain: …Lo-Fi Media → EQ → Clipper.
- **v0.7**: journeys always loop (no length/loop controls; Stop replaces Length); Mute removed; Pause fades out and suspends audio until a sphere is touched; tap a sphere (or tile) to stop/play that source; hold a sphere to move it (overlap merges sounds); FX presets fade from zero and cross-dip on change; per-source sphere colours; import queue (`queue.js`) with live cache + memory meters; quieter UI copy.
- **v0.8**: extend an unfinished route by dragging from its end; queue swaps join mid-journey on the beat (no stop); Lo-Fi Media enters at 0 and never jumps to 100%; loaded queue items are highlighted (LIVE · slot); **Slow Machine** (varispeed tape worklet `slow-fx.js`: Dying Reel, Tape Stop, Warble Garden, Octave Sink, Fifth Rise, Tape Eater; AMOUNT/AGE/TIME) sits before the EQ; readouts are centred with fixed-width digit cells.
- **Untouched**: `audio-*.js`, `effects-rack.js`, `transition-scene.js`, `granular-fx.js`, `working-session.js` (saved sessions and journeys carry over).
- `prd.html` restyled to match; content unchanged.

Files: `index.html` · `hud.css` · `app.js` (adapted from the original inline script) · `shell.js` (tabs/PWA).
