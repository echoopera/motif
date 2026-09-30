# Motif 6.0

`motifv6.html` is `motif5.html` plus the changes below. One self-contained file, same as before.

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
