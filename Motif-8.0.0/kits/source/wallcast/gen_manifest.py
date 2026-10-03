#!/usr/bin/env python3
"""Generates wallcast/manifest.json. Shared params are stamped on every style so common.glsl compiles everywhere."""
import json, sys, os
OUT = sys.argv[1] if len(sys.argv) > 1 else "manifest.json"

def R(label, mn, mx, d, step=0.01, unit=None, mutate=None, group=None, hint=None, log=False, show=None):
    o = {"type": "range", "label": label, "min": mn, "max": mx, "def": d, "step": step}
    if unit: o["unit"] = unit
    if mutate is not None: o["mutate"] = mutate
    if group: o["group"] = group
    if hint: o["hint"] = hint
    if log: o["log"] = True
    if show: o["show"] = show
    return o
def I(label, mn, mx, d, mutate=None, group=None, hint=None):
    o = {"type": "int", "label": label, "min": mn, "max": mx, "def": d}
    if mutate is not None: o["mutate"] = mutate
    if group: o["group"] = group
    if hint: o["hint"] = hint
    return o
def T(label, d, group=None, hint=None, mutate=None):
    o = {"type": "toggle", "label": label, "def": d}
    if group: o["group"] = group
    if hint: o["hint"] = hint
    if mutate is not None: o["mutate"] = mutate
    return o
def S(label, opts, d, group=None, hint=None, mutate=None):
    o = {"type": "select", "label": label, "options": opts, "def": d}
    if group: o["group"] = group
    if hint: o["hint"] = hint
    if mutate is not None: o["mutate"] = mutate
    return o
def P(label, d, mn=-0.9, mx=0.9, group=None, hint=None):
    o = {"type": "point", "label": label, "min": mn, "max": mx, "def": d}
    if group: o["group"] = group
    if hint: o["hint"] = hint
    return o

def shared(hud_default):
    return {
        "beats": I("Beats / loop", 1, 16, 4, 0.3, "Beat", "Kick pulses per loop. The limiter caps this at 3 per second."),
        "hitAmt": R("Beat drive", 0, 1.5, 1.0, 0.01, "×", 0.5, "Beat", "How hard the internal beat drives the effect."),
        "hit": R("Hit", 0, 1, 0.0, 0.01, None, 0, "Beat", "Map a live kick band here to drive the effect from audio."),
        "exposure": R("Exposure", 0.4, 1.6, 1.0, 0.01, "×", 0.2, "Finish"),
        "vignette": R("Vignette", 0, 1, 0.4, 0.01, None, 0.3, "Finish"),
        "hud": T("HUD frame", hud_default, "HUD", "Corner brackets, numeric readout and a beat trace.", 0),
        "readout": R("Readout", 0, 9999, 128, 1, None, 0, "HUD", "Shown as four digits. Key it or map a data channel to it.",
                     show={"param": "hud", "is": True}),
    }

STYLES = [
 dict(id="prism-split", name="Prism Split", group="Optics", palette="amber", flash=True, hud=False,
  tags=["chromatic","streak","lens","on-air"],
  blurb="Radial colour split and anamorphic light streaks that flare on every kick.",
  params={
   "split": R("Split", 0, 0.08, 0.022, 0.001, None, 0.7),
   "spectral": T("Spectral fringe", True, None, "Adds a seven-tap rainbow fringe on top of the RGB split.", 0.2),
   "streak": R("Streak gain", 0, 2, 0.9, 0.01, "×", 0.6, "Streaks"),
   "streakLen": R("Streak length", 0.05, 0.5, 0.22, 0.01, None, 0.5, "Streaks"),
   "streakCool": R("Cool streak", 0, 1, 0.4, 0.01, None, 0.4, "Streaks", "Cyan streak mixed in opposite the amber one."),
   "sweeps": I("Light sweeps / loop", 0, 4, 1, 0.3, "Streaks"),
  }),
 dict(id="halftone-pulse", name="Halftone Pulse", group="Print and pixel", palette="amber", flash=False, hud=False,
  tags=["halftone","print","dots","on-air"],
  blurb="Three halftone screens at three angles. Dots breathe with the kick.",
  params={
   "cells": I("Screen cells", 30, 200, 96, 0.4, None, "Cells across the short side of the frame."),
   "inkMode": S("Ink mode", [{"v":"light","l":"Light on dark"},{"v":"print","l":"Ink on paper"}], "light", None, "Light adds RGB dots to the ground. Ink subtracts CMY from paper.", 0.3),
   "gain": R("Dot gain", 0.4, 1.0, 0.72, 0.01, None, 0.5),
   "drift": R("Angle drift", 0, 0.15, 0.03, 0.005, None, 0.4),
   "registration": R("Registration", 0, 1, 0.25, 0.01, None, 0.4, None, "Offsets the red and blue screens like a loose print run."),
   "under": R("Source under-print", 0, 1, 0.05, 0.01, None, 0.3, None, "Light mode only. Lets the original image show under the dots."),
  }),
 dict(id="slice-shift", name="Slice Shift", group="Glitch and light", palette="magenta", flash=True, hud=False,
  tags=["glitch","tear","scanline","edm"],
  blurb="Row and column tears with an RGB split. Cuts on the beat, snaps back between.",
  params={
   "bands": I("Bands", 6, 64, 24, 0.5),
   "rate": I("Changes / loop", 1, 12, 6, 0.5, None, "Tear pattern changes per loop. The limiter caps it at 3 per second."),
   "tear": R("Tear", 0, 1, 0.55, 0.01, None, 0.7),
   "blocks": R("Column blocks", 0, 1, 0.4, 0.01, None, 0.5),
   "rgb": R("RGB split", 0, 1, 0.5, 0.01, None, 0.5),
   "scan": R("Scanlines", 0, 1, 0.5, 0.01, None, 0.3),
  }),
 dict(id="depth-stack", name="Depth Stack", group="Depth and data", palette="amber", flash=False, hud=False,
  tags=["parallax","layers","depth","on-air"],
  blurb="Background, mid and foreground at three depths. The foreground keeps its alpha and casts a shadow.",
  inputs=[{"id":"source","type":"media","label":"Background","fit":"fill","hint":"Backdrop photo or clip. It also feeds the mid layer."},
          {"id":"fore","type":"media","label":"Foreground","fit":"fit","hint":"Cut-out or product shot. Transparent PNGs keep their alpha."}],
  params={
   "camera": P("Camera", [0, 0], -0.5, 0.5, "Camera", "Parallax offset. Key or map it for a camera move."),
   "orbit": R("Orbit", 0, 1, 0.5, 0.01, None, 0.5, "Camera", "Loops one slow circle per loop."),
   "depthBg": R("Background depth", 0, 1, 0.35, 0.01, None, 0.5, "Depth"),
   "depthMid": R("Mid depth", 0, 1, 0.6, 0.01, None, 0.5, "Depth"),
   "depthFore": R("Foreground depth", 0, 1, 1.0, 0.01, None, 0.5, "Depth"),
   "midBlend": R("Mid layer", 0, 1, 0.7, 0.01, None, 0.5, "Depth", "Screen-blends a deeper copy of the background."),
   "shadow": R("Shadow", 0, 1, 0.55, 0.01, None, 0.4, "Foreground"),
   "lumaKey": T("Key out dark", True, "Foreground", "Drops near-black pixels of an opaque foreground photo.", 0),
   "keyLevel": R("Key level", 0.005, 0.2, 0.03, 0.005, None, 0, "Foreground", None, True, {"param":"lumaKey","is":True}),
   "sweeps": I("Light sweeps / loop", 0, 3, 1, 0.3),
  }),
 dict(id="contour-radar", name="Contour Radar", group="Depth and data", palette="amber", flash=False, hud=True,
  tags=["contour","radar","hud","data","cyber-city"],
  blurb="Iso-luminance contours with a radar sweep, range rings and a reticle that reads out the local level.",
  params={
   "levels": I("Contour levels", 4, 40, 18, 0.5),
   "major": I("Major interval", 2, 8, 4, 0.3),
   "drift": I("Contour drift", -3, 3, 1, 0.3, None, "Whole major intervals per loop, so the loop closes."),
   "sweeps": I("Radar sweeps / loop", 1, 3, 1, 0.3, "Radar"),
   "trail": R("Sweep trail", 1, 12, 5, 0.1, None, 0.5, "Radar"),
   "rings": T("Range rings", True, "Radar", None, 0),
   "showReticle": T("Reticle", True, "Reticle", None, 0),
   "reticle": P("Reticle position", [0.15, 0.1], -0.9, 0.9, "Reticle", "Key or map it to follow a subject.")
  }),
 dict(id="led-wall", name="LED Wall", group="Print and pixel", palette="amber", flash=True, hud=True,
  tags=["led","pixel","wall","edm","cyber-city"],
  blurb="A pixel-mapped LED panel with sub-pixels, cell gaps, bloom, a scan wipe and sparkle.",
  params={
   "cells": I("Cells high", 24, 160, 72, 0.4, None, "Panel pitch. Set it to match the real wall."),
   "shape": S("Cell shape", [{"v":"square","l":"Square"},{"v":"round","l":"Round"}], "square", None, None, 0.2),
   "gap": R("Cell gap", 0, 1, 0.4, 0.01, None, 0.4),
   "subpixel": R("Sub-pixels", 0, 1, 0.5, 0.01, None, 0.4),
   "bloom": R("Bloom", 0, 1.5, 0.5, 0.01, None, 0.5),
   "sparkle": R("Sparkle", 0, 1, 0.3, 0.01, None, 0.5, None, "Time-slotted, so the limiter caps its rate."),
   "wipes": I("Scan wipes / loop", 0, 3, 1, 0.3),
  }),
 dict(id="neon-trace", name="Neon Trace", group="Glitch and light", palette="ice", flash=True, hud=False,
  tags=["edge","neon","glow","cyber-city"],
  blurb="Three edge-detection scales drawn as light, with a cycling palette and a travelling gate.",
  params={
   "width": R("Line width", 0.5, 4, 1.5, 0.1, "px", 0.5),
   "glow": R("Glow", 0, 2, 0.9, 0.01, None, 0.6),
   "spread": R("Glow spread", 0.5, 2, 1.0, 0.01, None, 0.4),
   "gate": I("Gate sweeps / loop", 0, 3, 1, 0.3),
   "colorMode": S("Colour", [{"v":"spectrum","l":"Spectrum"},{"v":"accents","l":"Palette accents"},{"v":"mono","l":"Mono ink"}], "spectrum", "Colour", None, 0.2),
   "hueCycles": I("Hue cycles / loop", 0, 3, 1, 0.3, "Colour"),
   "hueSpan": R("Hue span", 0, 1, 0.35, 0.01, None, 0.4, "Colour"),
   "base": R("Source under-glow", 0, 0.5, 0.12, 0.01, None, 0.4, "Colour"),
  }),
 dict(id="glyph-mosaic", name="Glyph Mosaic", group="Print and pixel", palette="amber", flash=False, hud=True,
  tags=["glyph","ascii","data","typography","on-air"],
  blurb="The image rebuilt from numerals and marks by brightness, with falling data trails.",
  params={
   "cols": I("Columns", 40, 160, 96, 0.4),
   "rain": I("Rain speed", 0, 4, 1, 0.3, None, "Whole cycles per loop. 0 stops the rain."),
   "flicker": R("Flicker", 0, 1, 0.35, 0.01, None, 0.5, None, "Live cells swap glyphs. Rate is capped by the limiter."),
   "feed": R("Data feed", 0, 1, 0.5, 0.01, None, 0, "Data", "Map a data channel here. Density fills as it rises."),
   "contrast": R("Contrast", 0.5, 2, 1.1, 0.01, None, 0.4, "Data"),
   "tone": S("Tone", [{"v":"source","l":"Source colour"},{"v":"amber","l":"Palette amber"},{"v":"ink","l":"Mono ink"}], "source", "Data", None, 0.2),
  }),
 dict(id="shockwave", name="Shockwave", group="Optics", palette="magenta", flash=True, hud=False,
  tags=["ripple","refraction","kick","edm"],
  blurb="Each kick launches a refractive ring with a colour split. Earlier rings trail and fade.",
  params={
   "origin": P("Origin", [0, 0], -0.9, 0.9, None, "Where the rings start. Key or map it."),
   "speed": R("Ring speed", 0.1, 1.2, 0.42, 0.01, None, 0.5),
   "refract": R("Refraction", 0, 1.5, 0.8, 0.01, None, 0.6),
   "sharp": R("Ring sharpness", 4, 24, 11, 0.5, None, 0.4),
   "rings": I("Rings", 1, 3, 3, 0.3),
   "chroma": R("Colour split", 0, 1, 0.5, 0.01, None, 0.5),
   "glow": R("Ring glow", 0, 1, 0.25, 0.01, None, 0.4),
  }),
 dict(id="kaleido-wall", name="Kaleido Wall", group="Optics", palette="magenta", flash=True, hud=False,
  tags=["kaleidoscope","mirror","pattern","edm"],
  blurb="A mirror-fold kaleidoscope that turns one still into a festival pattern field.",
  params={
   "segments": I("Segments", 3, 12, 6, 0.4),
   "spin": I("Spin / loop", -2, 2, 1, 0.3),
   "scale": R("Pattern scale", 0.3, 1.5, 0.9, 0.01, None, 0.5),
   "breathe": R("Breathe", 0, 0.3, 0.08, 0.01, None, 0.4),
   "drift": I("Drift / loop", 0, 2, 0, 0.2, None, "Whole mirror periods per loop."),
   "chroma": R("Colour split", 0, 1, 0.5, 0.01, None, 0.5),
   "center": P("Centre", [0, 0], -0.5, 0.5, None, "Moves the point the pattern folds around."),
   "seams": R("Seams", 0, 1, 0.35, 0.01, None, 0.4),
  }),
]

styles = []
for s in STYLES:
    params = dict(s["params"]); params.update(shared(s["hud"]))
    st = {"id": s["id"], "name": s["name"], "group": s["group"], "palette": s["palette"], "tags": s["tags"],
          "blurb": s["blurb"], "flash": s["flash"],
          "passes": [{"src": "styles/source.glsl", "scale": 0.5}, {"src": f"styles/{s['id']}.glsl"}],
          "params": params}
    if "inputs" in s: st["inputs"] = s["inputs"]
    styles.append(st)

manifest = {
 "format": "motif-kit@1", "id": "wallcast", "name": "Wallcast", "version": "1.0.0",
 "author": "Echo Opera",
 "description": "Ten image shaders for on-air graphics, cyber-city screens and EDM video walls. Attach a still or clip to a layer and treat it; a night-skyline test image plays when nothing is attached.",
 "license": "All rights reserved", "accent": "#FF9A2E", "common": "common.glsl",
 "inputs": [{"id": "source", "type": "media", "label": "Source", "fit": "fill", "hint": "Still or clip to treat. Without one, the kit's test image plays."}],
 "palettes": [
  {"id":"amber","name":"Amber Signal","bg":"#0A0B0D","ink":"#EBE8E1","a":["#FF9A2E","#5FE3D0","#FF4133"]},
  {"id":"ice","name":"Ice Broadcast","bg":"#060A12","ink":"#EAF4FF","a":["#4CC9F0","#F72585","#FFD166"]},
  {"id":"magenta","name":"Festival Magenta","bg":"#0B0710","ink":"#F6ECFF","a":["#FF2E93","#39F0C8","#FFB800"]},
  {"id":"steel","name":"Steel Mono","bg":"#08090A","ink":"#F2F2EE","a":["#C9CCCF","#7C8790","#E8E4D8"]}],
 "styles": styles}
json.dump(manifest, open(OUT, "w"), indent=2); open(OUT, "a").write("\n")
print("wrote", OUT, len(styles), "styles")
