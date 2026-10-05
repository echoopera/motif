# Motif-Shadcn

Motif 9.0.1 with an audio interface built from [audiocn](https://github.com/audiocn/ui), the shadcn-style audio component library (React, Base UI, Tailwind CSS v4). One self-contained file, `Motif.html`: open it in Chrome or Edge. Everything from Motif 9 (MotifGraph, the Sequencer, kits, the finishing stack, the Audio page) works as before, and the render path is untouched.

## What is new

- **Mix tab** (the Console): load a track and see it as a real waveform with a draggable loop region; a rotary **BPM knob** (keyboard, drag, type a value), bar toggles, tap, ÷2/×2, align to downbeat; a **master level meter** and **spectrum**; and a **band console**: eight band strips (sub, bass, lo-mid, mid, hi-mid, high, level, onset) with live segmented meters. Pick a strip to edit what it drives: target menu, **Amount** and **Smooth** knobs, band, remove, add. Everything edits the project's audio mappings, so undo, save and export behave as they always have.
- **Pads tab**: sixteen sound pads. Twelve are MotifGraph presets: **hold a pad to audition** the preset on the stage (nothing is committed; release to leave), or switch to **Tap** to apply it to the active layer. Number keys 1 to 0 fire pads. Four action pads: Mutate, Randomize, Undo, Redo.
- **Themed by Motif**: the shadcn CSS variables are defined from Motif's tokens (graphite surfaces, amber action, cyan data), so the components look native and follow the shell's palette.

The classic Audio tab is still there.

## How it is built

The Motif app is a vanilla single-file build; audiocn is React. So the new interface is a set of **React islands**, each mounted inside a **shadow root**: Tailwind and its reset cannot leak into Motif, and Motif's CSS cannot reach the components. Popovers and selects render inside the same shadow root. Plain keys typed into a control stay in the island (Motif's single-key shortcuts such as M and E don't fire while a knob has focus); Ctrl/Cmd/Alt combinations and Escape pass through. The shell gains a small **audio bridge** (the Audio page's operations as functions) and two extension pages. See [docs/MOTIF-SHADCN.md](docs/MOTIF-SHADCN.md).

```
Motif.html                  the app
ui/                         the React workspace: src/components/ui (audiocn, MIT), src/pages (Console, Pads), src/island.tsx, src/styles.css (theme bridge)
src-shadcn/                 Motif-9.0.1.html (the base) and the anchored patch: python3 src-shadcn/build/patch_shadcn.py <base> <ui/dist/motif-shadcn.js> Motif.html
build.sh                    typecheck, bundle, patch
tests/                      browser.mjs (28 checks), regression.mjs (9.0.1 vs Motif-Shadcn), make-wav.mjs (a 120 BPM test loop)
AUDIOCN-LICENSE.md          the audiocn licence (MIT) and provenance
```

## Run the tests

    export PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs     # if Playwright is not installed locally
    node tests/browser.mjs        # Console, Pads, isolation, theme, keyboard, resilience (software GL)
    node tests/regression.mjs     # every style renders identical pixels to Motif 9.0.1

Kits, the SDK, schemas and the other documents live in the Motif 9 folder (`../Motif9`); this folder holds only what Motif-Shadcn adds.
