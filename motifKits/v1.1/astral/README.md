# Astral 1.1.0 — Continuous Flow

Import this kit into Motif to update the existing Astral collection (the kit and style IDs are preserved). All twelve shaders now circulate continuously through each forward loop.

The old camera depth was `z = 2*sin(2*pi*p)`: its velocity changes sign twice per cycle. The old turn angles were also sine/cosine oscillators, so the whole scene retraced its path.

The new domain angle is `theta = 2*pi*p + spatialTwist`. Its temporal angular velocity is constant. Fold layers use traveling phases `cos(f*q + n*theta)`, where n is an integer, instead of a shared wobbling offset. Veil and Aurora use traveling membrane waves; Estuary uses circulating braids; Halo, Chrysalis and Relic use complete rotations; Threshold uses a traveling rim wave. Camera depth and global breathing zoom no longer oscillate. The Traveling pulse control retains local radiance movement.

For a fixed set of controls, every temporal dependency has an integer winding. Therefore both value and velocity agree at p=0 and p=1. Fractional winding or multiplying theta by an arbitrary Twist amount would break that identity, so Twist modifies only the spatial twist. Change the host loop duration to control speed; 40–120 seconds suits ambient playback.

A seamless loop repeats a forward cycle. It cannot also produce forever-novel frames from a single repeating phase. Truly nonrepeating evolution requires a separate unwrapped host clock. If Motif itself is set to ping-pong playback, switch it to forward looping: stateless shaders cannot recover forward time from a phase that the host reverses. This kit assumes the original SDK normalized forward u_p convention.

No textures, media, feedback or new capabilities. Same bounded sample/detail budgets as 1.0.0. Controls and palettes remain compatible. GPU verification details are in VALIDATION.md.

## 1.2.0 changes

- Exposure and ray reach no longer depend on Ray samples: the step length scales with the sample budget and the contribution is weighted to match. Defaults look the same as 1.1.0.
- Photosensitivity: the loop phase and the fold windings go through the SDK limiter, so very short loops hold still when it is on. `filament` and `estuary` previously failed the flash audit.
- Output pass: soft vignette and a perceptually scaled dither to prevent banding in the dark falloff. Per-pixel start jitter hides step slicing.
- The scene renders at 0.75 scale and is upsampled by the output pass, cutting cost by roughly a third.
- Every control has a hint, and Randomize is capped on Radiance.
