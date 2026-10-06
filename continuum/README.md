# CONTINUUM

A spatial composition instrument for iPhone (and iPad / desktop), rebuilt as a sci-fi HUD.
Four living soundscapes sit on one map. Draw a route and the music follows it, handing off in time and in key.

**Run it:** serve this folder over HTTPS (or `http://localhost`) and open `index.html`. See **DEPLOY.md** for hosting.

    python3 -m http.server 8000      # quick local test

## Playing it
- **INIT** wakes the audio engine (browsers need one tap).
- **Draw:** drag from any source. The route always loops, with the end flowing back to the start.
- **Edit while it plays:** drag a point to bend the route · press the route's end and keep drawing to extend it ·
  press-and-hold on the route to loop that section (tap the pulsing dot to release).
- **Spheres:** tap = play/stop that source · hold and drag = move it (overlapping spheres merge into one sound).
- **Transport:** Play/Pause · Stop (rewind) · Save · Clear · New layout. Pause and Stop fade the sources, let reverb/echo/tape tails ring out,
  then fade the output to silence before the audio engine sleeps (no clicks). Touch a sphere or press Play to wake it.
- **Mix:** per-source levels, master volume, influence radii, focused blend, harmony guard, spatial depth.
- **Processing (8 inserts, 40 presets):** Granular → Delay → Reverb → Cutoff+LFO → Lo-Fi Media → Slow Machine → 3-Band EQ → Soft Clipper.
- **Sources:** import your own tracks, recolour the spheres, and keep a queue of tracks to swap in mid-journey.
  Live **memory** and **cache** meters keep large libraries from affecting playback.

## Project layout
| Path | Purpose |
| --- | --- |
| `index.html` `hud.css` `app.js` `shell.js` | App shell, stage rendering, gestures, transport, tabs |
| `transition-scene.js` `effects-rack.js` | Per-source routing, spatial field, master effects rack |
| `audio-import.js` `queue.js` `working-session.js` | Imports, import queue, session restore |
| `audio-player.js` `granular-fx.js` `lofi-fx.js` `slow-fx.js` `audio-analysis.js` | Worklets and the analysis worker |
| `product.html` `prd.html` | Product page and requirements |
| `sw.js` `manifest.webmanifest` `icon*` | Installable app + offline shell |
| `fonts.css` `fonts/` | Self-hosted type (OFL) |
| `deploy/` `tools/` | Server configs, optional smoke test |

## Engineering notes
- No dependencies, no build step. Plain scripts share one global scope, so load order in `index.html` matters.
- Audio graph: sources → per-source route (level, FX slots, pan, distance) → master → rack → compressor → output.
  Worklets are loaded lazily; if one fails, the rest of the rack keeps working.
- The 60 fps loop never forces layout (stage size is observed), redraws at ~14 fps while silent, and persistence is debounced
  and skips identical writes.
- Stored data (all local): `localStorage` — working session, saved journeys, colours, source on/off, last tab;
  `IndexedDB` — imported audio and the import queue.
