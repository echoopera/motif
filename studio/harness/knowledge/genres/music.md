# Music Software — Domain Intelligence

## Users
Sketchers (capture ideas fast), producers (arrange, mix, iterate), performers (reliability under pressure, no looking), sound designers (deep parameter access), learners (guidance without condescension).

## Core objects
Transport, clip/loop, track/lane, pattern/step, note, parameter, preset, device/effect, project, mixer channel, clock/tempo.

## Instrument-grade principles
- Latency is the first feature. Visual feedback follows the audio clock; nothing visual may delay audio.
- Every control shows its value while being touched and returns to its label after.
- Large, forgiving targets in performance views (≥ 64 pt). Precision via secondary gesture (two-finger drag, hold-and-slide, modifier key).
- Modes are loud: armed = red and pulsing, recording = clear timeline growth, overdub distinct from record.
- Tempo, key, scale and quantise are ambient — always visible, one tap to change.
- Undo everything, including recorded audio.

## Patterns
| Need | Pattern |
|---|---|
| Sequencing | Step grid (rows = pitch/track, columns = time), velocity by pressure or vertical drag, per-step probability/ratchet as sub-controls |
| Arrangement | Horizontal timeline with zoom to bar and to sample, clip launch grid for non-linear |
| Mixing | Vertical faders with meters beside, sends as knobs, solo/mute with clear exclusivity |
| Parameters | Knob (continuous), fader (level), XY pad (two-parameter play), macro (many-to-one), envelope display with draggable nodes |
| Browsing sounds | Tag + search + audition on hover/touch; favourites; recently used |
| Live | Scene launch, one-shot vs loop distinction, quantised launch indicator, panic button |

## Visual language
Dark surfaces by default (stage-safe, meters readable). High-contrast meters. Waveforms as information, not decoration. Colour codes tracks; never colour-only meaning.

## Ergonomics
- Two-handed layouts on iPad: left hand transport/tools, right hand canvas. Mirrorable.
- Phone: one thumb reaches everything in the capture flow. Landscape optional for arrangement.
- Hardware mapping: every primary control MIDI-learnable; sensible defaults for common controllers.

## HALT
Audio drops from UI work · Record without visible confirmation · Undo not covering audio · Meters without numeric access · Modal dialog while transport is running.
