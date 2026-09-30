# Style Lab 2.1: project update (2026-09-28)

Motif Style Lab now imports **kits**. The app stays one build, and a kit is a `.motifkit` file (motif-kit@1): a zip holding a manifest and GLSL ES 3.0 passes. The Kits tab validates each kit, test-compiles every shader, and adds its styles, palettes and a library chip. Kit styles then work like built-ins: layers, blends, masks, keyframes, Mutate/Evolve, audio maps, finishing, presets and exports.

## Three new kits (54 styles, all bundled and preinstalled)

| Kit | Styles |
| --- | --- |
| **Neuro** | Neural Arbor, Action Potential, Synaptic Cleft, Connectome, Cortical Fold, Mitosis (infinite-zoom division loop), Physarum, Morphogen, Epithelium, Calcium Wave, Microtubule Transit, Protein Fold, Organoid, EEG Cascade, Grid Cells, Neural Lace, Chromatin, Confocal |
| **Quantum** | Event Horizon (ray-traced Schwarzschild lensing, Doppler-beamed disk), Quasar Jet, Supernova, Pulsar, Wormhole, Nebula Genesis, Gravitational Wave, Wavefunction (2D harmonic oscillator), Double Slit, Orbitals (hydrogen n,l,m with electron samples), Quantum Foam, Entanglement, Feynman Paths, Bubble Chamber, Cosmic Web (infinite zoom), Galaxy Collision, Solar Corona, Tokamak |
| **Cyberpunk** | Neon Rain, Datamosh, Holo Decay, Signal Loss, Megastructure, Cipher Fall, ICE Breach, CRT Burn, Pixel Sort, Circuit Growth, Drone Swarm, Thermal Scan, Chrome Liquid, Net Tunnel, Smog Sprawl, Bit Crush, EMP, AR Overlay |

Each style has 8–14 parameters and loops seamlessly. Each kit also brings 4 palettes.

## Kit Manager (new Kits tab)
- Import by file, by drag-and-drop anywhere on the page, or by URL. Update by importing a newer version.
- Enable, disable, remove and export a kit as `.motifkit`. Bundled kits can be reinstalled. A kit that a layer uses cannot be removed.
- The starter kit download is a ready-to-edit template.
- Presets and saved looks that need a kit you don't have say which kit to install.
- The **photosensitive-safe limiter** is on by default. It caps glitch, flicker and strobe rates at 3 per second. When a loop is shorter than 1 s, a temporal low-pass also kicks in.

## Kit SDK (`kits/sdk`)
- `motif-kit new | validate | preview | pack | prelude`.
- The README is the format spec: manifest, parameters to uniforms, GLSL helper reference, the loop rule, the limiter and performance notes.

## Verification
See `tests/kits-results.json`:
- All 54 styles compile and render.
- For every style, the frame at the loop length equals frame 0.
- Loop seams are no larger than an ordinary frame step.
- Validation rejects bad kits with the style, pass and line of the error.
- Kit styles pass the integration checks (Mutate, keys, preset round-trip, PNG export).
- Measured with WCAG 2.3.1 flash counts per screen tile, every style stays at 3 or fewer flashes per second with the limiter on.
- Kits persist across reloads, and the Kit Manager UI checks pass.

The Style Lab 2 regression suite passes 39/39.

Known limits: frame times were measured on SwiftShader (CPU), so real-GPU numbers are still to come. Kits are GLSL-only, with no JavaScript or WebGPU-compute renderers yet.
