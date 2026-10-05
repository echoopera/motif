# Prototype: audition

The riskiest behavior (preview without committing) was built directly in the app, not as a separate prototype, because it reuses the shell's overlay: `src-v9/modules/shell-graph.js` (`auditionItem`, `previewOf`, `auditionOff`) and one added shell hook (`extApi.audition`). Run: open Graph, open Presets, hover or arrow.
Simulations: none; the preview renders the real graph through the real pipeline. Reset: Escape.
