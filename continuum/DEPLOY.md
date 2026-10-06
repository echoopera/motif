# Hosting CONTINUUM on your own server

CONTINUUM is a **static site**: no build step, no server code, no database. Copy the folder to any web root.

## Requirements
| Need | Why |
| --- | --- |
| **HTTPS** (or `http://localhost` while testing) | `AudioWorklet`, the service worker, `crypto.subtle` and persistent storage only exist in secure contexts. Over plain `http://` on a real domain the audio engine will not start. |
| Correct MIME types | `.js` → `text/javascript`, `.css` → `text/css`, `.woff2` → `font/woff2`, `.webmanifest` → `application/manifest+json`. Worklets are refused if a script is served as `text/plain`. |
| Same-origin files | Everything uses relative paths, so it works at the domain root **or** in a sub-folder (`https://example.com/continuum/`). |

No third-party requests are made. Fonts are self-hosted (`fonts/`, SIL OFL 1.1).

## Quick test
    cd continuum && python3 -m http.server 8000     # then open http://localhost:8000

## Server examples
Ready-to-use snippets are in `deploy/`: `nginx.conf.example`, `Caddyfile.example`, `.htaccess.example` (Apache).
They set the MIME types, `no-cache` revalidation for code (so updates arrive immediately), long caching for fonts and icons,
gzip/brotli, and a strict Content-Security-Policy.

## Updating
1. Replace the files on the server.
2. Bump `VERSION` at the top of `sw.js` (this retires the old offline cache on every visitor).
3. Visitors get the new version on their next load. The service worker is network-first, so a stale cache cannot pin an old build.

## Files
| File | Role |
| --- | --- |
| `index.html`, `app.js`, `shell.js`, `hud.css` | The instrument: shell, tabs, stage, transport |
| `transition-scene.js`, `effects-rack.js`, `audio-import.js`, `queue.js`, `working-session.js` | Audio routing, effects, imports, queue, session restore |
| `export.js`, `rec-worklet.js` | Audio export (single WAV or multitrack ZIP of stems), built in the browser, nothing uploaded |
| `audio-player.js`, `granular-fx.js`, `lofi-fx.js`, `slow-fx.js`, `audio-analysis.js` | Audio worklets / analysis worker (loaded with `addModule` / `new Worker`) |
| `product.html` (+ `.css/.js`) | One-page product site |
| `prd.html` (+ `.css`) | Product requirements |
| `sw.js`, `manifest.webmanifest`, `icon*.png/.svg` | Installable app (Add to Home Screen) and offline shell |
| `fonts.css`, `fonts/` | Self-hosted type |

## Data and privacy
Everything stays in the visitor's browser: `localStorage` (session, saved journeys, colours) and `IndexedDB`
(imported audio, the import queue). Nothing is uploaded. Audio uses a conservative live-memory budget (shown in
Sources → Queue) so large libraries do not crash mobile browsers.

## Browser support
Current Safari 16.4+ (iOS and macOS), Chrome/Edge 110+, Firefox 115+. iPhone is the primary target.
For the best experience: Safari → Share → **Add to Home Screen**.

## Health check (optional)
`tools/smoke-test.mjs` opens the site in headless Chromium, starts audio, draws and plays a route and fails on any console error:

    npm i playwright-core
    CHROME=/path/to/chrome node tools/smoke-test.mjs https://your-domain/continuum/
