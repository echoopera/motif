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
- **Untouched**: `audio-*.js`, `effects-rack.js`, `transition-scene.js`, `granular-fx.js`, `working-session.js` (saved sessions and journeys carry over).
- `prd.html` restyled to match; content unchanged.

Files: `index.html` · `hud.css` · `app.js` (adapted from the original inline script) · `shell.js` (tabs/PWA).
