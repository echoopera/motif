// What the Motif shell hands to the islands (the shell's extension API plus the audio bridge added by the Motif-Shadcn build).
import { useEffect, useRef, useState } from "react";
import { createFrameEmitter } from "@/lib/audio/frame-source";
import type { FrameEmitter } from "@/lib/audio/frame-source";
import type { MeterFrame, VisualFrame } from "@/lib/audio/types";

export interface AudioMap { id: string; band: string; path: string; amount: number; smooth: number }
export interface Analysis { peaks: ArrayLike<number>; duration: number; bpm: number; beatOffset: number; confidence: number }
export interface AudioBridge {
  readonly has: boolean; readonly playing: boolean; readonly name: string; readonly duration: number; readonly analysis: Analysis | null; readonly live: boolean; readonly sync: boolean;
  env(band: string, t: number, smooth?: number): number | null;
  pick(): void; togglePlay(): void; setVolume(v: number): void; setBpm(v: number): void; setBars(b: number): void; setSnap(on: boolean): void; setSync(on: boolean): void;
  setLive(on: boolean): Promise<void>; tap(): void; half(): void; double(): void; align(): void; setOffset(sec: number, commit: boolean): void;
  addMap(band?: string): void; setMap(id: string, field: "band" | "path" | "amount" | "smooth", value: string | number, commit: boolean): void; removeMap(id: string): void;
}
export interface MotifApi {
  project: any; commit(next: any, msg?: string): void; live(next: any): void; toast(msg: string): void; clone<T>(x: T): T;
  stage: { time: number; playing: boolean; invalidate(): void };
  T: any; audio: AudioBridge; audition(pr: any | null, label?: string, hint?: string): void; auditionOn(): boolean; tab: string; setTab(t: string): void;
}
export const BAND_IDS = ["sub", "bass", "lowmid", "mid", "highmid", "high", "level", "onset"] as const;
export const BAND_LABEL: Record<string, string> = { sub: "Sub", bass: "Bass", lowmid: "Lo-mid", mid: "Mid", highmid: "Hi-mid", high: "High", level: "Level", onset: "Onset" };

const toDb = (v: number) => (v > 1e-4 ? 20 * Math.log10(Math.min(1, v)) : Number.NEGATIVE_INFINITY);

/** Live band levels from Motif's analysis (or the live input), one emitter per band plus a master meter, a spectrum and a playhead. */
export interface Feeds {
  bands: Record<string, FrameEmitter<MeterFrame>>;
  master: FrameEmitter<MeterFrame>;
  visual: FrameEmitter<VisualFrame>;
  time: FrameEmitter<number>;
}
export const useFeeds = (api: MotifApi, active: boolean): Feeds => {
  const feeds = useRef<Feeds | null>(null);
  if (!feeds.current) {
    feeds.current = {
      bands: Object.fromEntries(BAND_IDS.map((b) => [b, createFrameEmitter<MeterFrame>()])),
      master: createFrameEmitter<MeterFrame>(), visual: createFrameEmitter<VisualFrame>(), time: createFrameEmitter<number>(),
    };
  }
  useEffect(() => {
    if (!active) return;
    const f = feeds.current as Feeds, hist = new Float32Array(64), six = new Float32Array(6);
    let raf = 0, hi = 0;
    const loop = () => {
      const au = api.project.audio, t = (au ? au.offset : 0) + api.stage.time;
      const read = (b: string) => api.audio.env(b, t, 0) ?? 0;
      for (const b of BAND_IDS) { const v = read(b); f.bands[b].emit({ channels: [{ peakDb: toDb(v) }] }); if (b === "level") { f.master.emit({ channels: [{ peakDb: toDb(v), rmsDb: toDb(v * 0.7) }] }); hist[hi] = v; hi = (hi + 1) % hist.length; } }
      ["sub", "bass", "lowmid", "mid", "highmid", "high"].forEach((b, i) => { six[i] = Math.min(1, read(b)); });
      f.visual.emit({ bands: six, history: hist, historyStart: hi, historyLength: hist.length, peakDb: toDb(read("level")) });
      f.time.emit(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [api, active]);
  return feeds.current;
};

export const useRev = (rev: number) => { const [, set] = useState(0); useEffect(() => set((n) => n + 1), [rev]); };
