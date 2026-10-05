# MotifGraph

Real-time procedural motion graphics inside Motif 9. A MotifGraph takes a **layer** or the **whole composite** as a live picture and turns it into a deformable mesh and a cloned array, drives it with fields and effectors, and hands it back to the compositor. It is data (a node stack saved with the project), it loops exactly, and it runs in the page and in the render Worker with the same code.

Open the **Graph** tab. Pick **Layer** (the active layer, deformed before its mask and blend) or **Composite** (every layer composited, then deformed before or after the finishing stack). Start from **Presets** or **+ Add node**.

## The stack

| Node | What it does |
| --- | --- |
| **Stage** (always there) | Mesh detail, what happens outside the picture (stretch, mirror, repeat, transparent), camera (flat or perspective with orbit and pan), lighting, depth sorting, and **Mix with original**. |
| **Cloner** (at most one) | Copies the picture into a grid, honeycomb, line, ring, spiral, sunflower or scatter. Each clone shows its **tile** of the picture (a grid reassembles it exactly), the **whole** picture, or a **dot** sampled from it (halftone). |
| **Fields** | A weight from 0 to 1 over space or over the array: sphere, box, linear, radial, noise, random, index, the picture's own brightness, stripes. Fields can sweep, orbit and pulse in whole cycles per loop, and combine (add, multiply, min, max, subtract, over). |
| **Effectors** | Move, rotate (x, y, z), scale, fade and tint every clone, each weighted by a field. Plain, random, step (ramp across the array), delay (a wave travelling through the array: stagger, pop, cascade, spring), noise and sound (the audio spectrum spread across the array). |
| **Deformers** | Bend, twist, swirl, taper, shear, squash, wave, ripple, noise, bulge, spherify, lens and displace (the picture displaces itself). Each acts on **the whole array** or on **each clone**, and can be weighted by a field. |

Order within a family is the order of the list; families always run Cloner, then effectors, then deformers. A node's **Weighted by field** (or **Fall off with field**) menu picks the field that drives it.

## Fast to drive
Open **Presets** or **+ Add node** and hover (or arrow through) the list: the stage previews each item without touching your project; Esc leaves, Enter keeps it. A chip row at the top of the stack jumps to any node; folded nodes read out what they do. On a focused node: **Delete** removes, **Alt+Up/Down** reorders, **Alt+E** switches it off and on, **Alt+D** duplicates. Everything is also in the command palette (Ctrl/Cmd K, "MotifGraph").

## Everything is a channel

Every parameter is an ordinary project channel: the same scrub label, key button, audio mapping and undo as the core panels. Keyframe a wave's amplitude, map a bulge to the kick, key a field's centre. Parameters that are "cycles per loop" are whole numbers, so frame 0 always equals frame L.

## Interactive and real time

Sliders, keys and audio all redraw live; the render cache replays finished frames. Cost is shown under the buttons (clones, vertices); a graph that would exceed the vertex budget lowers its mesh detail and keeps every clone. A lost GPU context passes the picture through unchanged and recovers by itself.

## Good to know

- **Zero cost when absent.** A project without a graph never enters the MotifGraph code; Motif 8.0.0 and 9 render identical pixels for every style (`node tests/v9/regression.mjs`).
- **One composite graph per project**, any number of layer graphs.
- **WebGL2 is required.** Without it the picture passes through.
- **Motion blur** comes free: the finishing stack's shutter samples re-render the graph at each sub-frame.
- **Exports** (video, image sequence) use the render path, so what you see is what you get; Lottie and SVG exports rasterize the graph.
- Projects with node types from a newer Motif keep them (disabled, never drawn) so nothing is lost on save.

## Automation

`__lab.graph` (what a bridge or agent drives): `add(type)`, `preset(id)`, `set(nodeId, key, value)`, `setRef(nodeId, fieldId)`, `setPlace('pre'|'post')`, `setOn(bool)`, `remove(nodeId)`, `clear()`, `setScope('layer'|'composite')`, `describe()` (nodes, values, cost as JSON). The data format is `schemas/motif-graph-1.schema.json`; every node and parameter is in [MotifGraph-nodes.md](MotifGraph-nodes.md).

## Architecture in brief

One static WebGL2 program (no per-graph code generation, no recompiles): the node table and parameters go up as uniforms, one instanced draw renders every clone. The CPU reference evaluator in the same module is the specification; `tests/v9/browser.mjs` compares the GPU vertex stage against it for 700+ configurations. Hashing and noise use integer arithmetic so the two agree bit for bit. See [MotifGraph-PRD.md](MotifGraph-PRD.md) for the roadmap.
