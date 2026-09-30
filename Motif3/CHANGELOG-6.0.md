# Motif 6.0

`motifv6.html` is `motif5.html` plus the changes below. One self-contained file, same as before.

## 6.1 — header, Arrange and project clean-up
Same file (`motifv6.html`).

**Header**
- One centred cluster: transport, LCD, Mutate / Evolve / Random and Strength sit on the window's midline. Identity and project on the left, Search / Shortcuts / Render on the right.
- New (`+`), Save, Open, Undo and Redo are square 32 px glyphs beside the project name. Search is a glyph that opens the search panel (`⌘K`). The layer-count / loop metadata is gone.
- Tempo, bars and loop length moved from the header to the top of the **Audio** tab.
- Every header glyph is a 32 × 32 square (40 on touch).

**Timeline | Arrange**
- A segmented control, centred in the strip above whichever surface is showing. The Arrange tool row sits under that strip, so the switch stays in the same place. The status-bar Arrange toggle is removed; `Alt A` still works.

**Arrange**
- Clips are flat colour blocks with their names on them (no stretched artwork). Transitions are a flat light purple with no gradient.
- Pinch to zoom the sequence: trackpad pinch, Safari gestures and two-finger touch. It works only over Arrange; the page itself stays locked.

**Projects**
- **New** starts a blank project: one default layer, no keys, no audio, no clips. If the current project has unsaved changes you are asked first.
- **Clips belong to their project.** Open and New swap the clip library with the project. The project file carries its own clips and groups.
- **Import** (Clips tab) copies clips from another Motif project saved in this browser, from a project folder, or from a file on your computer (Finder / Files). Pick which clips to bring in.

**Kits**
- Imported kits are also written to IndexedDB, so a kit too large for localStorage is still there after a reload. A saved session that uses an imported kit reopens once the kit is back.
- Version and details show on hover of the kit name; the card is quieter and spaced on the 8 px grid.

**Layout**
- Explore / Build / Time / Focus switch faster: the viewer canvas is scaled during the change and re-rendered once when it settles, panels are paint-contained, and the timeline rows are no longer rebuilt.
- Resize handles are wider (12 px hit area), update once per frame, measure from the press point (no drift), keep a sensible minimum in Arrange, and only collapse a panel when dragged well past its minimum.

## Viewer
- **Move tool** (`V`): click a layer in the viewer to make it the active layer, drag to move it on X and Y. New **Position X / Y** sliders sit under *Motion and transform*, so moves can be keyed like any other value. Shift locks an axis, double-click recentres.
- **Grid lines** (`Shift G`): overlay with 4–24 columns. Dragging with the Move tool snaps the layer centre to grid intersections; Alt turns snapping off. With the grid off, layers still snap to the frame centre.

## Timeline
- The playhead flag and the whole ruler can be grabbed and scrubbed; dragging on any track scrubs too.
- Layers can be selected from the timeline: click the `V1` / `V2` / `V3` label or a keyframe row label.
- `<` `>` in the transport now jump to the **previous / next keyframe** (`,` and `.`). In Arrange they jump between cuts.

## Clips (was Looks)
- Looks are now **Clips**. Existing looks are carried over.
- **Clip groups**: *New group*, drag a clip onto a group, or use the `⋯` menu (Rename, Duplicate, Move to, Delete). Groups collapse, rename with a double-click, and can be sent to Arrange in one go.

## Arrange (next to Timeline in the page bar, `Alt A`)
- Three tracks (V1 base, V2, V3 top) for laying clips end to end or layering them. Drag clips in from the Clips tab, or press `+` on a clip.
- **Crop** by dragging a clip's left or right edge. **Loop** by dragging the right edge past the clip's length (seams show as `↻`).
- **Opacity** per clip. **Split** at the playhead (`B`), duplicate (`D`), remove (`Delete`). Snapping to edges and the playhead can be turned off.
- **Transitions**: choose a region with the Region tool (or Shift-drag) across a clip edge, a cut between two clips, or layered clips, then pick a style: Dissolve, Wipe, Push, Zoom, Iris, Clock wipe, Blur dissolve, Pixelate, Glitch, Noise dissolve, Whip pan. Head / Tail / Cut buttons make the region for you. Transitions are WebGL2 shaders with a cross-fade fallback.
- The viewer plays the sequence while Arrange is open, and **Render** renders the sequence (MP4, WebM, PNG sequence, PNG frame).
- Double-click a clip on a track to open it in the Timeline.

## Saving
- **Save / Open** icons in the header (`⌘S`, `⇧⌘S`, `⌘O`).
- **Chrome and Edge**: real files on disk (`.motif`), written through the File System Access API. Pick a project folder once and Save writes there; Open lists it.
- **Safari and Firefox** can't write to folders, so Save keeps the project in this site's browser storage. *Import file* / *Export file* move a project between browsers.
- A project file carries the project, the arrangement, the clip library and its groups. The project name is editable (click it); an amber dot shows unsaved changes.

## Panels and controls
- Blend modes open a menu; **hovering a mode previews it on the viewer**, clicking applies it.
- The inspector keeps its scroll position and keyboard focus when a value changes.
- Pinch-zoom, trackpad pinch and double-tap zoom no longer resize the page.
- Mutate, Evolve and Random are icon-only; name and shortcut appear in a tooltip. Strength moved to the right, next to Save and Open.
- *Deliver* is now **Render**.
