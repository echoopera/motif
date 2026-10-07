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
  On desktop, hover a sphere's ring to light it up, then drag or scroll to change its radius (touch uses the Mix sliders).
- **Waveform + sources:** one slim row under the map: live waveform (60%) and four colour buttons (40%) that start/stop each source.
- **Transport:** Play/Pause · Stop (rewind) · Save · Clear · New layout. Pause and Stop fade the sources, let reverb/echo/tape tails ring out,
  then fade the output to silence before the audio engine sleeps (no clicks). Touch a sphere or press Play to wake it.
- **Desktop / iPad layout:** Mix, Sources, Effects and Journeys can be collapsed from their headers. Collapsing one gives its space to the module
  above/below it, expanding a collapsed one collapses its partner, and both can be collapsed. Saved per browser; phones keep the tabbed layout.
- **Mix (3 pages, swipe or use the tabs):** page 1 per-source levels · pages 2 and 3 per-source **effect sends** as rotary dials (0 to 100) into all 8 effects.
  Drag a dial up/down (drag far sideways for fine control), scroll, use arrow keys, or double-tap to reset. Each effect has one shared send bus, built the first
  time a send is raised and wired once, so with every send at 0 the sound path is unchanged. A send needs a preset on that effect (a bypassed effect dims its dials).
  Sends are saved with sessions and journeys and are included in the mix and in 'stems with effects' exports.
- **Mix (other):** per-source levels, master volume, influence radii, focused blend, harmony guard, spatial depth.
- **Effects (8 inserts, 40 presets):** Granular → Delay → Reverb → Cutoff+LFO → Lo-Fi Media → Slow Machine → 3-Band EQ → Soft Clipper.
  Each module has a preset dropdown and a live display of what it is doing (grains, echo taps, impulse response, filter sweep, tape wobble,
  tape speed, EQ curve, clip transfer). The ▲ / ▼ buttons reorder the chain; the order is saved with the session and journeys and is used by export.
- **Background play:** audio keeps running when the tab is hidden or the window loses focus (a worker clock replaces throttled timers; media keys work where the browser supports them).
- **Export (Log tab):** *Export audio* bounces the journey live as a **single stereo WAV** of the final mix, or a **multitrack ZIP**: one stem per
  source, the full mix, optional original files, `journey.json` (route, weights, tempo, effects) and a README. 1/2/4 cycles, 16/24-bit, optional ring-out tails.
  Saved journeys have an *Audio* button too. All files start on the same sample. *Stems* can be Dry, With FX (`stems-with-effects/`, each stem through its own copy of the active master effects) or Both. Time-modulated effects (Slow Machine, Lo-Fi, Cutoff LFO, Granular) move independently per stem, so those stems will not sum exactly to the mix; the master compressor is not applied.
- **Sources:** import your own tracks, recolour the spheres, and keep a queue of tracks to swap in mid-journey.
  Live **memory** and **cache** meters keep large libraries from affecting playback.

## Project layout
| Path | Purpose |
| --- | --- |
| `index.html` `hud.css` `app.js` `shell.js` | App shell, stage rendering, gestures, transport, tabs |
| `transition-scene.js` `effects-rack.js` | Per-source routing, spatial field, master effects rack |
| `audio-import.js` `queue.js` `working-session.js` | Imports, import queue, session restore |
| `fx-viz.js` `mix-pages.js` | Live effect displays · Mix pages and send dials |
| `export.js` `rec-worklet.js` | Audio export: sample-accurate recorder, WAV + ZIP writers, export sheet |
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
