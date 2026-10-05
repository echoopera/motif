# Motif 8: vector graphics and type, layer stacks, speed and direction, Sequencer

A short guide for people using the app. Kit authors: see `sdk/motif-kit-sdk/docs/kit-format-4.md`.

## Sequencer: more looks than four layers
1. Pick **Sequencer** in the library (category Sequencer) for a layer. It starts with three cues over the loop.
2. In **Layers > Sequencer · cues**, each bar on the timeline is a cue: a style from your library playing for part of the loop. Drag a bar to move it (across lanes too), drag its left or right edge to resize, or focus it and use the arrow keys (Shift resizes, Up/Down change lane, Delete removes).
3. Select a cue to edit it: **Style** (any style, kit styles included), **Start**, **Length**, **Lane** (higher lanes draw on top), **Plays** (how many times the style loops during the cue, so it closes on itself), **Direction** (forward, backward, ping-pong, random), **Blend**, **Opacity**, **Fade in / out**, **Chance**, **Seed**, **Muted**, and the style's own settings.
4. **Only 4 shaders run at once**, however many cues there are. The meter under the timeline tells you the peak overlap; more than 4 at one point is flagged and the dimmest cue is skipped.
5. **Load a sequence** brings in the Starter or a sequence shipped by a kit (Sequence Demo has Showcase and Beat Reel). **Copy JSON** copies yours for a kit's `sequences/` folder.

Tips: give a cue `Chance` below 100% to make a take that differs by seed; use **Plays** 2 to 4 on a short cue to keep it lively; overlap two cues with Screen or Add for a cross-fade that adds light. A cue's style keeps its photosensitive limiter: the cue's own loop length is what it sees.

## Layer stacks (Stack Lab and any `@4` kit with a stack)
A style with a stack has **Layer 1 to 3** sections: Opacity, Blend, Offset, Scale, Rotate, Edges, **Cycles / loop**, **Direction** and **Travel**, plus slots in **Layers > Media** for the images or clips. Cycles / loop is a whole number so the loop stays seamless; with Cycles / loop above 0 a **video** plays through its clip that many times per loop in the chosen direction (random chooses a forward or backward round trip each time); at 0 it keeps its own timing. **Travel** moves the image in tiles per cycle (forward and backward snap to whole tiles and repeat the image).

## Vector graphics and type (Vector Type)
- **Shape Field** is drawn entirely from distance shapes: crisp at any size, outlines and glows are exact.
- **Logo Reveal** bakes an SVG into a distance field: edit the kit's `assets/mark.svg` to use your own mark.
- **Type Poster** uses the live text input with a distance field: type in Layers > Title, pick any font (installed or imported), and the outline, glow and echoes stay exact when you scale it.
