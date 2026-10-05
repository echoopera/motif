# Motif-Shadcn: design and build notes

## Decision: islands, not a rewrite
Motif's shell is about 18,000 lines of vanilla JavaScript that already carries timeline, arrange, export, kits, grading and MotifGraph. audiocn is React with Tailwind v4 and Base UI. Rewriting the shell in React would risk everything that works and add nothing to the render path. So Motif-Shadcn replaces the *audio surface* (the part audiocn is made for) with React islands and leaves the rest alone. More surfaces can move over one at a time, behind the same seam.

## The seam
1. **`window.MotifShadcn`** (the `ui/` bundle, embedded as one script): `mount(kind, host, { api, rev, active })` returns `{ update, unmount }`.
2. **Extension pages** (`src-shadcn/modules/shell-shadcn.js`): two pages registered with the shell's own `__m_shell.use`, like Grade and Graph. `panel()` mounts or updates the island on every visit and project refresh; `tick()` tells it when its tab is hidden, so meters and pad hotkeys stop.
3. **Audio bridge** (`api.audio`, added to the shell by the patch): `has`, `playing`, `analysis`, `env(band, t)`, `pick`, `togglePlay`, `setBpm/Bars/Snap/Sync/Live`, `tap/half/double/align`, `setOffset`, `addMap/setMap/removeMap`. It mirrors the classic Audio page's handlers, so both pages produce the same project edits and the same undo steps.
4. The islands also use `api.audition(project|null, label, hint)`, the shell's overlay that previews a project on the stage without touching history (the same call the MotifGraph page uses).

## Shadow DOM details that matter
- **Styles:** one `CSSStyleSheet` (Tailwind v4, built from `src/styles.css`) is adopted by each shadow root. Tailwind's preflight applies inside only.
- **Theme:** `:host` defines shadcn's variables from Motif's tokens. Motif's amber `--accent` collides with shadcn's neutral `--accent`, so the island's parent element captures it as `--ms-accent` before the shadow root redefines the name.
- **Portals:** Base UI popovers, selects, tooltips and menus portal to `document.body` by default, outside the shadow root and unstyled. The four audiocn files that portal were changed to render into the island's container (`src/lib/island.tsx`).
- **Keys:** see the README. Pad hotkeys pass digits through (Motif has no plain digit shortcuts).

## Live data
`useFeeds` (`src/lib/motif.ts`) runs one animation-frame loop while the Mix tab is open and a track is loaded (or live input is on). It reads Motif's band envelopes (`env(band, offset + stage time)`) and pushes frames into audiocn frame emitters; the meters, spectrum and playhead paint themselves from those without re-rendering React. Band values are 0..1 energies (auto-gained by the analysis), shown as dBFS from -48 to 0.

## Changes to the audiocn files
Copied from audiocn (commit 9598cf2) with: portal container support in `popover`, `select`, `tooltip`, `context-menu`. Everything else is as published. audiocn is MIT (AUDIOCN-LICENSE.md). Not copied: the docs site, blocks, examples, tests, `sonner`, the electric (WebGL) visualizers.

## Not done yet
- MotifGraph node rows as audiocn knobs (a rotary view of the stack) and a status-bar master meter.
- Moving other surfaces (library, timeline, export) to React; each would be its own island.
- Real-device testing: Safari/Firefox, touch, screen readers, a real GPU. Tests use Chromium with software GL.
