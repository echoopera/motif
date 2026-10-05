import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Knob, KnobDial, KnobLabel, KnobPointer, KnobRange, KnobTrack, KnobValue } from "@/components/ui/knob";
import { LevelMeter, LevelMeterBar, LevelMeterChannel, LevelMeterChannels, LevelMeterClip, LevelMeterHold, LevelMeterScale, LevelMeterTrack, LevelMeterValue } from "@/components/ui/level-meter";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spectrum } from "@/components/ui/spectrum";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Waveform, WaveformCanvas, WaveformCursor, WaveformRegion } from "@/components/ui/waveform";
import { BAND_IDS, BAND_LABEL, useFeeds } from "@/lib/motif";
import type { AudioMap, MotifApi } from "@/lib/motif";
import { formatTime } from "@/lib/audio/time";
import { cn } from "@/lib/utils";

interface Props { api: MotifApi; rev: number; active: boolean }

const Section = ({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) => (
  <section className="border-border flex flex-col gap-3 border-b px-3 py-3">
    <header className="flex items-center justify-between"><h2 className="text-muted-foreground font-mono text-xs tracking-wider uppercase">{title}</h2>{aside}</header>
    {children}
  </section>
);

const BandStrip = ({ band, selected, count, onSelect, feeds }: { band: string; selected: boolean; count: number; onSelect: () => void; feeds: ReturnType<typeof useFeeds> }) => (
  <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`${BAND_LABEL[band]} band, ${count} mapping${count === 1 ? "" : "s"}`}
    className={cn("flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg border px-1 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60")}>
    <LevelMeter aria-label={`${BAND_LABEL[band]} energy`} source={feeds.bands[band]} orientation="vertical" variant="segmented" segments={14} minDb={-48} maxDb={0} className="h-24">
      <LevelMeterChannels><LevelMeterChannel index={0}><LevelMeterTrack><LevelMeterBar /><LevelMeterHold /></LevelMeterTrack></LevelMeterChannel></LevelMeterChannels>
    </LevelMeter>
    <span className="text-foreground text-[0.6875rem] leading-none font-medium">{BAND_LABEL[band]}</span>
    <span className={cn("font-mono text-[0.625rem] leading-none", count ? "text-primary" : "text-muted-foreground")}>{count ? `${count} map${count > 1 ? "s" : ""}` : "—"}</span>
  </button>
);

const MapRow = ({ m, targets, groups, api }: { m: AudioMap; targets: { path: string; label: string; group: string }[]; groups: string[]; api: MotifApi }) => {
  const a = api.audio;
  const label = targets.find((t) => t.path === m.path)?.label ?? m.path;
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <Select value={m.path} onValueChange={(v) => a.setMap(m.id, "path", v as string, true)}>
          <SelectTrigger className="min-w-0 flex-1" aria-label="Target parameter"><SelectValue>{label}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-80">
            {groups.map((g) => (<SelectGroup key={g}><SelectLabel>{g}</SelectLabel>{targets.filter((t) => t.group === g).map((t) => (<SelectItem key={t.path} value={t.path}>{t.label}</SelectItem>))}</SelectGroup>))}
          </SelectContent>
        </Select>
        <Button size="icon-sm" variant="ghost" aria-label="Remove mapping" onClick={() => a.removeMap(m.id)}>✕</Button>
      </div>
      <div className="flex items-start justify-around gap-2">
        <Knob value={m.amount} min={-1} max={1} step={0.01} origin={0} fineStep={0.001} size="sm" format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`}
          onValueChange={(v) => a.setMap(m.id, "amount", v, false)} onValueCommitted={(v) => a.setMap(m.id, "amount", v, true)} aria-label="Amount">
          <KnobDial><KnobTrack /><KnobRange /><KnobPointer /></KnobDial><KnobValue /><KnobLabel>Amount</KnobLabel>
        </Knob>
        <Knob value={m.smooth} min={0} max={1} step={0.01} fineStep={0.001} size="sm" format={(v) => `${Math.round(v * 600)} ms`}
          onValueChange={(v) => a.setMap(m.id, "smooth", v, false)} onValueCommitted={(v) => a.setMap(m.id, "smooth", v, true)} aria-label="Smooth">
          <KnobDial><KnobTrack /><KnobRange /><KnobPointer /></KnobDial><KnobValue /><KnobLabel>Smooth</KnobLabel>
        </Knob>
        <Select value={m.band} onValueChange={(v) => a.setMap(m.id, "band", v as string, true)}>
          <SelectTrigger className="w-24" aria-label="Audio band"><SelectValue>{BAND_LABEL[m.band]}</SelectValue></SelectTrigger>
          <SelectContent>{BAND_IDS.map((b) => (<SelectItem key={b} value={b}>{BAND_LABEL[b]}</SelectItem>))}</SelectContent>
        </Select>
      </div>
    </div>
  );
};

export function Console({ api, active }: Props) {
  const a = api.audio, pr = api.project, au = pr.audio, L: number = pr.finish.loop;
  const feeds = useFeeds(api, active && (a.has || a.live));
  const [band, setBand] = useState<string>("bass");
  const maps: AudioMap[] = au ? au.maps : [];
  const targets = useMemo(() => api.T.allPaths(pr, true) as { path: string; label: string; group: string }[], [pr]);
  const groups = useMemo(() => [...new Set(targets.map((t) => t.group))], [targets]);
  const [bpm, setBpm] = useState<number>(au ? au.bpm : 120);
  useEffect(() => { if (au) setBpm(au.bpm); }, [au?.bpm]);
  const offset = au ? au.offset : 0, dur = a.duration;
  const mine = maps.filter((m) => m.band === band);
  return (
    <div className="flex flex-col">
      <Section title="Track" aside={<span className="text-muted-foreground font-mono text-xs">{a.has ? `${a.name} · ${formatTime(dur)}` : au?.name ? `Built with ${au.name}` : "No track"}</span>}>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={a.has ? "secondary" : "default"} onClick={() => a.pick()}>{a.has ? "Replace track…" : "Load track…"}</Button>
          {a.has && <Button size="sm" variant="secondary" onClick={() => a.togglePlay()}>{a.playing ? "Stop" : "Play from loop start"}</Button>}
          <label className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">Live input<Switch checked={a.live} onCheckedChange={(v) => void a.setLive(!!v)} aria-label="Microphone or line in" /></label>
        </div>
        {a.has && a.analysis ? (
          <Waveform aria-label="Waveform: drag the highlighted loop to choose where it starts" className="h-20" duration={a.analysis.duration} peaks={a.analysis.peaks} variant="mirror" time={feeds.time} interactive={false}>
            <WaveformCanvas />
            <WaveformRegion start={offset} end={Math.min(dur, offset + L)} resizable={false}
              onValueChange={(v) => a.setOffset(v.start, false)} />
            <WaveformCursor />
          </Waveform>
        ) : (<p className="text-muted-foreground text-xs">MP3, WAV, AAC, OGG or FLAC. It stays in your browser. Load a track to sync the loop and drive values.</p>)}
        {a.has && (<label className="text-muted-foreground flex items-center gap-2 text-xs"><Switch checked={a.sync} onCheckedChange={(v) => a.setSync(!!v)} aria-label="Play audio with the transport" />Play audio with the transport</label>)}
      </Section>

      <Section title="Tempo and bars">
        <div className="flex items-start gap-4">
          <Knob value={bpm} min={40} max={240} step={0.1} largeStep={5} fineStep={0.01} size="lg" format={(v) => v.toFixed(1)}
            onValueChange={setBpm} onValueCommitted={(v) => a.setBpm(Math.round(v * 10) / 10)} aria-label="Tempo in beats per minute">
            <KnobDial><KnobTrack /><KnobRange /><KnobPointer /></KnobDial><KnobValue /><KnobLabel>BPM</KnobLabel>
          </Knob>
          <div className="flex flex-1 flex-col gap-2">
            <div role="radiogroup" aria-label="Loop length in bars" className="flex gap-1">
              {[1, 2, 4, 8].map((b) => (<Toggle key={b} pressed={au?.bars === b} onPressedChange={() => a.setBars(b)} variant="outline" size="sm" className="flex-1" aria-label={`${b} bar${b > 1 ? "s" : ""}`}>{b}</Toggle>))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" variant="secondary" onClick={() => a.half()}>÷2</Button>
              <Button size="xs" variant="secondary" onClick={() => a.double()}>×2</Button>
              <Button size="xs" variant="secondary" onClick={() => a.tap()}>Tap</Button>
              {a.analysis && <Button size="xs" variant="secondary" onClick={() => a.align()}>Align to downbeat</Button>}
            </div>
            <label className="text-muted-foreground flex items-center gap-2 text-xs"><Switch checked={!!au?.snap} onCheckedChange={(v) => a.setSnap(!!v)} aria-label="Snap loop to bars" />Snap loop to bars ({L.toFixed(2)} s)</label>
          </div>
        </div>
      </Section>

      <Section title="Master">
        <div className="flex items-stretch gap-3">
          <LevelMeter aria-label="Master level" source={feeds.master} className="w-24 shrink-0" minDb={-48} maxDb={0}>
            <LevelMeterChannels><LevelMeterChannel index={0}><LevelMeterTrack><LevelMeterBar /><LevelMeterHold /></LevelMeterTrack></LevelMeterChannel><LevelMeterScale /></LevelMeterChannels>
            <LevelMeterValue /><LevelMeterClip />
          </LevelMeter>
          <Spectrum aria-label="Band spectrum" className="h-20 min-w-0 flex-1" source={feeds.visual} minDb={-48} maxDb={0} minHz={40} maxHz={16000} peakHold />
        </div>
      </Section>

      <Section title="Band console" aside={<span className="text-muted-foreground font-mono text-xs">{maps.length} mapping{maps.length === 1 ? "" : "s"}</span>}>
        <div className="flex gap-1" role="group" aria-label="Audio bands">
          {BAND_IDS.map((b) => (<BandStrip key={b} band={b} feeds={feeds} selected={b === band} count={maps.filter((m) => m.band === b).length} onSelect={() => setBand(b)} />))}
        </div>
        <div className="flex flex-col gap-2">
          {mine.length === 0 && <p className="text-muted-foreground text-xs">Nothing is mapped to {BAND_LABEL[band]} yet. Map it to any value, for example Bass → Burst.</p>}
          {mine.map((m) => (<MapRow key={m.id} m={m} api={api} targets={targets} groups={groups} />))}
          <Button size="sm" variant="secondary" disabled={maps.length >= 16} onClick={() => a.addMap(band)}>+ Map {BAND_LABEL[band]}</Button>
        </div>
      </Section>
    </div>
  );
}
