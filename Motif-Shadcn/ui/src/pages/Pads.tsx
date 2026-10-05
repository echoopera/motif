import { useMemo, useRef, useState } from "react";
import { SoundPad, SoundPadGrid, SoundPadLabel, SoundPadShortcut } from "@/components/ui/sound-pad";
import { Switch } from "@/components/ui/switch";
import type { MotifApi } from "@/lib/motif";

interface Props { api: MotifApi; rev: number; active: boolean }
interface PadDef { id: string; label: string; hotkey?: string; accent?: string; run?: () => void }

declare const __m_graph: { PRESETS: { id: string; name: string; blurb: string }[]; applyPreset(id: string, scope: string): unknown };

/** Sixteen pads: twelve MotifGraph presets (hold to audition on the stage, or tap to apply) and four actions. */
export function Pads({ api, active }: Props) {
  const [hold, setHold] = useState(true);
  const [on, setOn] = useState<string | null>(null);
  const timer = useRef(0);
  const lab = (window as unknown as { __lab?: Record<string, () => void> }).__lab;
  const preview = (id: string) => {
    const pr = api.clone(api.project), layer = pr.layers.find((l: { id: string }) => l.id === pr.active) ?? pr.layers[0];
    layer.graph = __m_graph.applyPreset(id, "layer");
    return pr;
  };
  const pads = useMemo<PadDef[]>(() => {
    const keys = "1234567890".split("");
    const presets: PadDef[] = __m_graph.PRESETS.slice(0, 12).map((p, i) => ({ id: p.id, label: p.name, hotkey: keys[i] }));
    const acts: PadDef[] = [
      { id: "act-mutate", label: "Mutate", run: () => lab?.mutate?.() }, { id: "act-random", label: "Randomize", run: () => lab?.randomize?.() },
      { id: "act-undo", label: "Undo", run: () => lab?.undo?.() }, { id: "act-redo", label: "Redo", run: () => lab?.redo?.() },
    ];
    return [...presets, ...acts];
  }, [lab]);
  const press = (p: PadDef) => {
    if (!p.id.startsWith("act-")) {
      if (hold && api.auditionOn()) { api.audition(preview(p.id), `Pad · ${p.label}`, "Release to leave"); setOn(p.id); return; }
      const next = api.clone(api.project), layer = next.layers.find((l: { id: string }) => l.id === next.active) ?? next.layers[0];
      layer.graph = __m_graph.applyPreset(p.id, "layer"); api.commit(next, `Pad · ${p.label}`); setOn(p.id); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOn(null), 700); return;
    }
    p.run?.(); setOn(p.id); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOn(null), 400);
  };
  const release = (p: PadDef) => { if (hold && !p.id.startsWith("act-")) { api.audition(null); setOn(null); } };
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-muted-foreground font-mono text-xs tracking-wider uppercase">Pads</h2>
        <p className="text-muted-foreground text-xs">Hold a pad to audition a preset on the stage; release to leave. Switch to Tap to apply it to the active layer. Number keys fire pads 1 to 10.</p>
      </header>
      <label className="text-muted-foreground flex items-center gap-2 text-xs"><Switch checked={hold} onCheckedChange={(v) => setHold(!!v)} aria-label="Hold to audition" />{hold ? "Hold to audition" : "Tap to apply"}</label>
      <SoundPadGrid columns={4} hotkeys={active} hotkeyScope="global" className="w-full" aria-label="Preset pads">
        {pads.map((p) => (
          <SoundPad key={p.id} mode={hold && !p.id.startsWith("act-") ? "hold" : "one-shot"} hotkey={p.hotkey} playing={on === p.id} onTrigger={() => press(p)} onStop={() => release(p)} aria-label={p.label}>
            <SoundPadLabel>{p.label}</SoundPadLabel>
            <SoundPadShortcut />
          </SoundPad>
        ))}
      </SoundPadGrid>
    </div>
  );
}
