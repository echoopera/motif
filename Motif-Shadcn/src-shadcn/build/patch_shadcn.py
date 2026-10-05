#!/usr/bin/env python3
# Builds Motif-Shadcn from the Motif 9.0.1 single-file build:
#   python3 src-shadcn/build/patch_shadcn.py <Motif-9.0.1.html> <ui/dist/motif-shadcn.js> <Motif.html>
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'Motif9', 'src-v9', 'build'))
from patchlib import Patcher
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
page = open(os.path.join(root, 'modules', 'shell-shadcn.js'), encoding='utf-8').read().rstrip('\n') + '\n'
bundle = open(sys.argv[2], encoding='utf-8').read().replace('</script', '<\\/script')
P = Patcher(open(sys.argv[1], encoding='utf-8').read())

# --- the audio bridge: Audio operations as functions (the classic Audio page keeps its own handlers) -----------------------------------
BRIDGE = """  // Motif-Shadcn: the Audio page's operations as functions, for the Console island.
  let offsetTimer = 0;
  const audioBridge = {
    get has() { return !!player.buffer; }, get playing() { return player.playing; }, get name() { return trackName; }, get duration() { return player.buffer ? player.buffer.duration : 0; },
    get analysis() { return analysis; }, get live() { return liveOn; }, get sync() { return audioSync; },
    env: (band, t, smooth) => { const e = currentEnv(); return e ? e(band, t, smooth || 0) : null; },
    pick: () => $('audioFile').click(),
    togglePlay() { if (player.playing) { player.stop(); stage.pause(); setPlayUi(false); } else { stage.seek(0); stage.play(); setPlayUi(true); player.start(0); } },
    setVolume: v => player.setVolume(v),
    setBpm(v) { if (!(v >= 40 && v <= 240)) { toast('Tempo must be 40–240 BPM'); return; } const next = clone(project); ensureAudio(next).bpm = v; snapLoop(next); commit(next, `${v} BPM`); },
    setBars(b) { const next = clone(project); ensureAudio(next).bars = Number(b); snapLoop(next); commit(next, `${b} bar${b > 1 ? 's' : ''}`); },
    setSnap(on) { const next = clone(project); ensureAudio(next).snap = !!on; snapLoop(next); commit(next, on ? `Loop snapped to ${next.audio.bars} bars` : 'Loop length is free'); },
    setSync(on) { audioSync = !!on; if (!audioSync) player.stop(); else if (stage.playing) player.start(stage.time); },
    async setLive(on) {
      if (on) { try { await player.startLive(); liveOn = true; if (!project.audio) { const next = clone(project); ensureAudio(next); commit(next); } toast('Live input on — preview only'); } catch (err) { toast(`Live input unavailable: ${err.message || err}`); } }
      else { player.stopLive(); liveOn = false; toast('Live input off'); }
    },
    tap() { const now = performance.now(); tapTimes = tapTimes.filter(t => now - t < 3000); tapTimes.push(now); if (tapTimes.length >= 3) { const d = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1); const next = clone(project); const au = ensureAudio(next); au.bpm = clamp(Math.round(60000 / d * 10) / 10, 40, 240); snapLoop(next); commit(next, `Tapped ${au.bpm} BPM`); } else toast('Keep tapping…'); },
    half() { const next = clone(project); const au = ensureAudio(next); au.bpm = clamp(Math.round(au.bpm * 0.5 * 10) / 10, 40, 240); snapLoop(next); commit(next, `${au.bpm} BPM`); },
    double() { const next = clone(project); const au = ensureAudio(next); au.bpm = clamp(Math.round(au.bpm * 2 * 10) / 10, 40, 240); snapLoop(next); commit(next, `${au.bpm} BPM`); },
    align() { if (!analysis) return; const next = clone(project); const au = ensureAudio(next); const beat = 60 / au.bpm; au.offset = Math.max(0, analysis.beatOffset + Math.round((au.offset - analysis.beatOffset) / (beat * 4)) * beat * 4); commit(next, `Loop starts on a downbeat at ${au.offset.toFixed(2)} s`); },
    // The loop region: live while dragging, one undo step when the drag settles.
    setOffset(sec, doCommit) {
      if (!analysis) return; const next = clone(project), au = ensureAudio(next), beat = 60 / au.bpm;
      au.offset = Math.min(Math.max(0, analysis.beatOffset + Math.round((sec - analysis.beatOffset) / beat) * beat), Math.max(0, analysis.duration - next.finish.loop));
      clearTimeout(offsetTimer); if (doCommit) commit(next, `Loop starts at ${au.offset.toFixed(2)} s`); else { live(next); syncAudioRegion(); offsetTimer = setTimeout(() => { commit(project, `Loop starts at ${project.audio.offset.toFixed(2)} s`); }, 450); }
    },
    addMap(band) { const next = clone(project); const au = ensureAudio(next); const l = T.layerById(next, next.active); const k = Object.entries(getStyle(l.styleId).params).find(([, s]) => s.type === 'range' || s.type === 'int'); if (au.maps.length >= 16) return; au.maps.push({ id: 'm' + Date.now().toString(36), band: BAND_OK.includes(band) ? band : 'bass', path: k ? `L:${l.id}:p:${k[0]}` : 'F:glow', amount: 0.3, smooth: 0.25 }); commit(next, 'Mapping added'); },
    setMap(id, field, value, doCommit) { const next = clone(project); const m = next.audio && next.audio.maps.find(x => x.id === id); if (!m) return; m[field] = field === 'amount' || field === 'smooth' ? Number(value) : String(value); if (doCommit) commit(next); else live(next); },
    removeMap(id) { const next = clone(project); next.audio.maps = next.audio.maps.filter(m => m.id !== id); commit(next, 'Mapping removed'); },
  };
  const BAND_OK = ['sub', 'bass', 'lowmid', 'mid', 'highmid', 'high', 'level', 'onset'];
"""
P.rep("  // Extension pages: tabs + panels are created once; panel() re-runs on every visit and on project refresh.\n  const extApi = {", BRIDGE + "  // Extension pages: tabs + panels are created once; panel() re-runs on every visit and on project refresh.\n  const extApi = {", label='audio bridge')
P.rep("auditionOn: () => audOn,", "auditionOn: () => audOn, audio: audioBridge,", label='extApi.audio')
# --- the pages and the bundle ---------------------------------------------------------------------------------------------------------
P.before("// ---- module: media-page v1.0.0\n", page + "\n", label='insert pages')
P.before('<script>\n"use strict";\nconst __motifEngine', '<script id="motif-shadcn-bundle">/* Motif-Shadcn interface bundle: React 19, Base UI, audiocn components (MIT), Tailwind CSS v4, built from ui/ */\n' + bundle + '\n</script>\n', label='embed bundle')
# --- names ----------------------------------------------------------------------------------------------------------------------------------------
P.rep('<title>Motif 9</title>', '<title>Motif-Shadcn</title>')
P.rep('<span class="wm">MOTIF</span><b>9</b>', '<span class="wm">MOTIF</span><b>S</b>')
P.rep('<span class="ver">MOTIF 9.0</span>', '<span class="ver">MOTIF-SHADCN 1.0</span>')
P.rep("report = { app: 'Motif 9',", "report = { app: 'Motif-Shadcn',")
open(sys.argv[3], 'w', encoding='utf-8').write(P.t)
print(f'ok: {P.n} patches, bundle {len(bundle)} bytes -> {len(P.t)} bytes')
