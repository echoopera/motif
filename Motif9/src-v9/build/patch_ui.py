# MotifGraph shell integration: parameter rows for graph channels, duplicate layer, and the MotifGraph page.
def apply(P, mods):
    P.rep("function valueFromEval(ev, path) { const p = T.parsePath(path); if (!p) return undefined; if (p.kind === 'F') return ev.finish[p.key];",
          "function valueFromEval(ev, path) { const p = T.parsePath(path); if (!p) return undefined; if (p.kind === 'F') return ev.finish[p.key]; if (p.kind === 'M') { const g = p.scope === '@' ? ev.graph : (ev.layers.find(x => x.id === p.scope) || {}).graph, n = g && g.nodes.find(x => x.id === p.node); return n ? n.params[p.key] : undefined; }", label='valueFromEval M')
    P.rep("if (src.media) copy.media = clone(src.media); if (src.text) copy.text = clone(src.text); if (src.seq) copy.seq = clone(src.seq);",
          "if (src.media) copy.media = clone(src.media); if (src.text) copy.text = clone(src.text); if (src.seq) copy.seq = clone(src.seq); if (src.graph) copy.graph = clone(src.graph);", label='dupLayer graph')
    # The page itself: an extension module like the Grade page, inserted after the shell and before media-page.
    P.before("// ---- module: media-page v1.0.0\n", mods['shell-graph'] + "\n", label='insert graph page')
    # Audition: the Graph page previews presets and nodes on the stage through the shell's own non-history overlay (hover or arrow key).
    P.rep("    keyState: p => keyState(p), shownValue: p => shownValue(p),", "    audition: (pr, label, hint) => setAudition(pr, label, hint), auditionOn: () => audOn,\n    keyState: p => keyState(p), shownValue: p => shownValue(p),", label='extApi audition')
