// ---- module: shadcn-pages v1.0.0 (Motif-Shadcn: the Console and Pads pages, React islands built from audiocn components)
(() => {
// shadcn-pages — two extension pages like the Grade and Graph pages. Each hosts one React island (window.MotifShadcn, the embedded
// motif-shadcn bundle) inside a shadow root; the island gets the shell's extension API (project, commit, live, audition, audio bridge).
// If the bundle is missing the pages say so and the classic Audio page keeps working.
const SVG = d => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
const ICON_CONSOLE = SVG('<path d="M5 20V10M10 20V4M15 20v-8M20 20V7"/>'), ICON_PADS = SVG('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>');
function page(id, name, kind, icon) {
  let handle = null, apiRef = null, rev = 0, was = false;
  const props = () => ({ api: apiRef, rev, active: apiRef.tab === id });
  __m_shell.use({
    id, name, icon,
    init(sec, a) { apiRef = a; },
    panel(sec, a) {
      apiRef = a; rev++;
      if (!window.MotifShadcn) { sec.innerHTML = '<p class="info" role="alert">The Motif-Shadcn interface bundle is missing from this file. The classic Audio page still works.</p>'; return; }
      if (!handle) { sec.innerHTML = ''; const h = document.createElement('div'); h.dataset.island = kind; sec.appendChild(h); handle = window.MotifShadcn.mount(kind, h, props()); } else handle.update(props());
      was = true;
    },
    // Tell the island when its tab is hidden so meters and pad hotkeys stop.
    tick(t, a) { apiRef = a; const now = a.tab === id; if (handle && now !== was) { was = now; handle.update(props()); } },
    commands() { return [{ id: 'open-' + id, label: `Open ${name}`, run: () => apiRef && apiRef.setTab(id), kw: 'audio mixer meters pads shadcn' }]; },
  });
}
page('console', 'Mix', 'console', ICON_CONSOLE);
page('pads', 'Pads', 'pads', ICON_PADS);
})();
