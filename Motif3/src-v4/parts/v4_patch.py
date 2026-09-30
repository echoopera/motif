# Motif 4 patches: workstation breakpoints, leaner copy, library tiles, first-run coach.
# Runs last inside build.py with `src` and `rep` in scope.

# ---- workstation layout from 1024 px (iPad landscape gets the full three-column shell) ----
src = rep(src, "matchMedia('(min-width: 68.8125em)')", "matchMedia('(min-width: 64em)')")

# ---- inspector head: name, one line of context, engine tag. The description moves to a tooltip. ----
src = rep(src, "Layer ${idx + 1} of ${n} · ${String(STYLES.indexOf(st) + 1).padStart(2, '0')} · ${esc(cat)}${st.kit ? ` kit · ${esc(st.group || '')}` : ''}${st.gpu ? ` · ${gpu.ready ? 'WebGPU' : 'Canvas 2D'}` : ''}${st.engine === 'glsl' ? ` · WebGL2 · ${st.passes} pass${st.passes > 1 ? 'es' : ''}` : ''}</div><h1>${esc(st.name)}</h1><p>${esc(st.blurb)}</p>",
    "Layer ${idx + 1} of ${n} · ${esc(cat)}${st.kit ? ` kit · ${esc(st.group || '')}` : ''}</div><div class=\"ph-row\"><h1 title=\"${esc(st.blurb)}\">${esc(st.name)}</h1><span class=\"tags\">${st.engine === 'glsl' ? `<span class=\"tag\">GLSL${st.passes > 1 ? ' ×' + st.passes : ''}</span>` : st.gpu ? `<span class=\"tag\">${gpu.ready ? 'WebGPU' : 'Canvas 2D'}</span>` : ''}</span></div>")
src = rep(src, "'<p class=\"info\">⚡ Flashing content, and the photosensitive limiter is off (Kits tab).</p>'", "'<p class=\"info\">⚡ Flashing content · limiter is off (Kits)</p>'") if "⚡ Flashing content, and the photosensitive limiter is off (Kits tab)." in src and "'<p class=\"info\">⚡ Flashing content, and the photosensitive limiter is off (Kits tab).</p>'" in src else src
src = src.replace("⚡ Flashing content, and the photosensitive limiter is off (Kits tab).", "⚡ Flashing content · limiter is off (Kits)")
src = rep(src, "'<p class=\"info\">The base layer fills its palette background. Upper layers are transparent unless “Fill background” is on.</p>'", "'<p class=\"info\">The base layer always fills its background.</p>'")
src = rep(src, "'A track matte needs a layer below this one.'", "'A matte needs a layer below.'")
src = rep(src, "`Uses layer ${idx} as the matte. Hide layer ${idx} to see only the matted result.`", "`Matte: layer ${idx}. Hide it to see only the result.`")
src = rep(src, "<button class=\"btn sm\" id=\"resetStyle\">Reset style parameters</button>", "<button class=\"btn sm\" id=\"resetStyle\">Reset style</button>")

# ---- library tiles: name + capability badges only; description on hover ----
i = src.index("li.innerHTML = `<canvas width=\"128\" height=\"80\" aria-hidden=\"true\"></canvas><div><b>"); j = src.index("`;", i) + 2
src = src[:i] + ("li.title = st.blurb; li.innerHTML = `<canvas width=\"128\" height=\"80\" aria-hidden=\"true\"></canvas><div><b>${esc(st.name)}</b>"
    "<span class=\"n\"><span class=\"cat\">${st.kit ? esc(st.group || cat.name) : cat.name}</span>"
    "${st.gpu ? '<span class=\"gpu\">GPU</span>' : ''}"
    "${st.inputs && st.inputs.length ? '<span class=\"medtag\" title=\"Takes an image or video\">MEDIA</span>' : ''}"
    "${st.engine === 'glsl' && !(st.inputs && st.inputs.length) ? '<span class=\"glsl\">GLSL</span>' : ''}"
    "${st.flash ? '<span title=\"Contains flashing; the photosensitive limiter is ' + (K.safe ? 'on' : 'off') + '\">⚡</span>' : ''}</span></div>`;") + src[j:]

# ---- timeline ----
src = rep(src, "${n ? `${n} key${n > 1 ? 's' : ''} · ${keyed.length} param${keyed.length > 1 ? 's' : ''}` : 'none yet'}", "${n ? `${n} key${n > 1 ? 's' : ''}` : 'No keys'}")
src = rep(src, "<span class=\"readout lane-extra\">◇ on any row keys it · drag keys · click the track to seek</span>", "<span class=\"readout lane-extra\">Key any value with ◇</span>")
src = rep(src, "Press ◇ beside any parameter to key it. Keys loop seamlessly: the last key eases back to the first.", "Key a value with ◇ to animate it. The last key eases back to the first.")

# ---- colour ----
src = rep(src, "<h1>Colour</h1><p>Palettes are per layer. Brand palettes travel with the project and your swatch library.</p>", "<h1>Colour</h1>")
src = rep(src, "' · editing a built-in palette makes a brand copy'", "' · edits make a brand copy'")
src = rep(src, "<p class=\"info\">Saved in this browser. Click to add one to this project.</p>", "<p class=\"info\">Click to use in this project.</p>")
src = rep(src, "'<p class=\"info\">Save brand palettes here to reuse them across projects.</p>'", "'<p class=\"info\">Saved palettes appear here.</p>'")
i = src.index("<p class=\"info\">${C.spaceById(project.output.space).note}. ${project.output.space === 'p3'"); j = src.index("</p>", i) + 4
src = src[:i] + "<p class=\"info\">${C.spaceById(project.output.space).note}</p>" + src[j:]
src = rep(src, "Show illegal colours (zebra, preview only)", "Zebra: flag illegal colours")

# ---- finish ----
i = src.index("<p>Applied after the layers, in this order:"); j = src.index("</p></div>", i) + len("</p></div>")
src = src[:i] + "${pipeline.finisher.ok ? '' : '<p>WebGL2 is unavailable: only grain and vignette apply.</p>'}</div>" + src[j:]
src = rep(src, "Snapped to ${project.audio.bars} bar${project.audio.bars > 1 ? 's' : ''} at ${project.audio.bpm} BPM. Change it in Audio.", "Follows Audio: ${project.audio.bars} bar${project.audio.bars > 1 ? 's' : ''} at ${project.audio.bpm} BPM")
i = src.index("<p class=\"info\">Preview uses up to ${$('quality')"); j = src.index("</p>", i) + 4
src = src[:i] + "<p class=\"info\">Preview: up to ${$('quality').value === 'high' ? 8 : 4} samples playing, all ${fin.samples} paused. Export uses ${fin.samples}.</p>" + src[j:]
src = rep(src, "Depth is estimated from screen position or brightness until styles output real depth.", "Depth is estimated from position or brightness.")

# ---- audio ----
src = rep(src, "<p>Load a track to lock the loop to bars and drive any parameter from its bands. Everything renders deterministically, so exports match the preview.</p>", "<p>Load a track to sync the loop and drive values.</p>")
src = rep(src, "'MP3, WAV, AAC, OGG or FLAC. The file stays in your browser.'", "'MP3, WAV, AAC, OGG or FLAC · stays in your browser'")
src = rep(src, "This project was built with <b>${esc(au.name)}</b>. Load it again to hear and drive it.", "Built with <b>${esc(au.name)}</b>. Load it again to hear it.")
src = rep(src, "'<p class=\"info\">No mappings yet. Map bass to a burst or size, highs to glow.</p>'", "'<p class=\"info\">Map a band to any value, e.g. bass → Burst.</p>'")
src = rep(src, "Drive from microphone or line in", "Microphone or line in")
src = rep(src, "<p class=\"info\">Live input drives the preview only. Exports use the loaded track.</p>", "<p class=\"info\">Preview only. Exports use the loaded track.</p>")

# ---- kits ----
src = rep(src, "<p>Kits add shader styles and palettes to the library. They live in this browser; export one to share it or keep a copy.</p>", "<p>Add shader styles and palettes to the library.</p>")
src = rep(src, "Drop a <b>.motifkit</b> file anywhere on the page, or choose one. Each kit is checked and its shaders test-compiled before it installs.", "Drop a <b>.motifkit</b> anywhere, or choose a file.")
src = rep(src, "Caps flashes at three per second and softens full-frame strobes (WCAG 2.3.1). Styles marked ⚡ use it.", "Caps flashes at 3 per second (WCAG 2.3.1)")
i = src.index("<p class=\"info\">Format <b>${K.KIT_FORMAT}</b>: a zip"); j = src.index("</p>", i) + 4
src = src[:i] + "<p class=\"info\">Format <b>${K.KIT_FORMAT}</b> · see the SDK for the spec</p>" + src[j:]

# ---- toasts ----
src = rep(src, "`Added layer ${next.layers.length}: ${getStyle(pick).name}. Pick a style in the library to change it.`", "`Layer ${next.layers.length} added · ${getStyle(pick).name}`")
src = rep(src, "`Keyed ${s.label} at ${stage.time.toFixed(2)} s. Move the playhead and change it to animate.`", "`Keyed ${s.label} · move the playhead, change the value`")

# ---- first-run coach: three keycaps, gone after the first real action ----
src = rep(src, "  function stepFrames(n) {", """  (() => {
    const coach = $('coach'); if (!coach) return;
    let seen = false; try { seen = localStorage.getItem('motif4-coach') === '1'; } catch (e) { /* storage unavailable */ }
    if (seen) return;
    coach.hidden = false;
    const done = () => { if (coach.hidden) return; coach.hidden = true; try { localStorage.setItem('motif4-coach', '1'); } catch (e) { /* per-viewer convenience only */ } };
    $('coachClose').addEventListener('click', done);
    ['mutateBtn', 'evolveBtn', 'randomBtn', 'play'].forEach(id => $(id).addEventListener('click', done));
    $('libList').addEventListener('click', done);
    addEventListener('keydown', e => { if (!e.metaKey && !e.ctrlKey && /^(m|e|r| )$/i.test(e.key)) done(); });
  })();
  function stepFrames(n) {""")

# ---- evolve: short status line ----
i = src.index("$('evoHint').textContent = `Variations of layer"); j = src.index("`;", i) + 2
src = src[:i] + "$('evoHint').textContent = `Layer ${project.layers.findIndex(l => l.id === project.active) + 1}${colour && isCustom(active().shared.palette) ? ` · varying ${pl.name}${pl.locks.length ? ', locked colours kept' : ''}` : ''} · pick one · 1–6 · Esc`;" + src[j:]
src = rep(src, "`Evolve — round ${round}`", "`Evolve · round ${round}`")

# ---- audio: BPM input sits under its label ----
src = rep(src, 'style="grid-column:1/-1;background:var(--surface-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:var(--space-2);font-family:var(--font-mono)"',
               'style="grid-column:1/-1;grid-row:2;min-height:var(--target);background:var(--surface-0);padding:0 var(--space-2);font-family:var(--font-mono)"')

# ---- library categories: the mouse wheel scrolls the chip row sideways ----
src = rep(src, "  catsEl.addEventListener('click', e => {", """  catsEl.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && catsEl.scrollWidth > catsEl.clientWidth) { catsEl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  catsEl.addEventListener('click', e => {""")

# ---- media slot: the kit's hint becomes a tooltip instead of a paragraph ----
src = rep(src, '<button class="mdrop" data-mload="${q.id}">', '<button class="mdrop" data-mload="${q.id}"${q.hint ? ` title="${esc(q.hint)}"` : \'\'}>')
src = rep(src, "${q.hint ? `<p class=\"info\">${esc(q.hint)}</p>` : ''}</div>`;", "</div>`;")

# ---- truncated inspector labels reveal their full text on hover ----
src = rep(src, "  ['layer', 'colour', 'finish', 'audio'].forEach(p => bindRows($('panel-' + p)));", """  ['layer', 'colour', 'finish', 'audio'].forEach(p => bindRows($('panel-' + p)));
  $('insp').addEventListener('pointerover', e => { const l = e.target.closest && e.target.closest('.row label, .row .rl'); if (l && !l.title && l.scrollWidth > l.clientWidth) l.title = l.textContent; });""")
