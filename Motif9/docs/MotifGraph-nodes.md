# MotifGraph node reference

Generated from the node registry (`tests/v9/gen-docs.mjs`). Parameters are project channels addressed `M:<layerId or @>:<nodeId>:<key>`: keyframable, audio-mappable, saved with the project. "Cycles per loop" parameters are whole numbers so every loop closes exactly.

## Stage

### Stage  `stage` · id 1

Mesh detail, camera, lighting and the mix with the original

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `detail` | Mesh detail | 8 to 256 | 64 |
| `mix` | Mix with original | 0 to 1 | 1 |
| `edge` | Outside the picture | clamp · mirror · repeat · clear | clamp |
| `camera` | Camera | flat · persp | flat |
| `fov` | Perspective | 15 to 120° | 55 |
| `orbitX` | Orbit up/down | -80 to 80° | 0 |
| `orbitY` | Orbit left/right | -80 to 80° | 0 |
| `panX` | Pan x | -2 to 2 | 0 |
| `panY` | Pan y | -2 to 2 | 0 |
| `light` | Lighting | 0 to 1 | 0 |
| `lightAngle` | Light direction | 0 to 360° | 315 |
| `depth` | Sort by depth | on / off | false |

## Cloner

### Cloner  `cloner` · id 2

Copies the picture into an array: grid, honeycomb, linear, radial, spiral, sunflower, scatter

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `mode` | Layout | grid · honeycomb · linear · radial · spiral · phyllo · scatter | grid |
| `content` | Each clone shows | tiles · whole · dots | tiles |
| `count` | Count | 1 to 16384 | 48 |
| `cols` | Columns | 1 to 128 | 8 |
| `rows` | Rows | 1 to 128 | 6 |
| `size` | Clone size | 0.02 to 2 | 0.3 |
| `fill` | Tile fill | 0.1 to 1.5 | 1 |
| `posX` | Position x | -2 to 2 | 0 |
| `posY` | Position y | -2 to 2 | 0 |
| `width` | Width / radius | 0 to 3 | 1 |
| `height` | Height | 0 to 3 | 1 |
| `angle` | Angle | -360 to 360° | 0 |
| `arc` | Arc | 0 to 360° | 360 |
| `turns` | Turns | 0 to 20 | 3 |
| `rotate` | Rotate each | -360 to 360° | 0 |
| `stepRot` | Spin along array | -720 to 720° | 0 |
| `scale` | Scale | 0.01 to 4 | 1 |
| `stepScale` | Grow along array | -1 to 4 | 0 |
| `align` | Face the centre | on / off | false |
| `seed` | Seed | 0 to 9999 | 1 |
| `detail` | Clone detail | 1 to 32 | 4 |
| `reverse` | Reverse draw order | on / off | false |
| `shape` | Dot shape | circle · square · diamond · ring | circle |
| `dotMin` | Dot size, dark | 0 to 1.5 | 0.15 |
| `dotMax` | Dot size, light | 0 to 1.5 | 1 |
| `dotInvert` | Invert dot size | on / off | false |

## Fields

### Sphere field  `sphere` · id 20

A soft ellipse; weights whatever references it

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `sizeX` | Radius x | 0.01 to 4 | 0.6 |
| `sizeY` | Radius y | 0.01 to 4 | 0.6 |
| `angle` | Angle | -360 to 360° | 0 |
| `falloff` | Falloff | 0 to 1 | 0.5 |
| `motion` | Motion | none · sweep · orbit · pulse | sweep |
| `travel` | Travel | 0 to 3 | 1 |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Box field  `box` · id 21

A soft rectangle

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `sizeX` | Size x | 0.01 to 4 | 0.6 |
| `sizeY` | Size y | 0.01 to 4 | 0.6 |
| `angle` | Angle | -360 to 360° | 0 |
| `falloff` | Falloff | 0 to 1 | 0.5 |
| `motion` | Motion | none · sweep · orbit · pulse | none |
| `travel` | Travel | 0 to 3 | 1 |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Linear field  `linear` · id 22

A gradient across the picture

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `sizeX` | Length | 0.01 to 4 | 0.6 |
| `angle` | Angle | -360 to 360° | 0 |
| `motion` | Motion | none · sweep · orbit · pulse | sweep |
| `travel` | Travel | 0 to 3 | 1 |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Radial field  `radial` · id 23

A gradient that sweeps around a point

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `angle` | Angle | -360 to 360° | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Noise field  `noisef` · id 24

Smooth noise

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `scale` | Scale | 0.1 to 24 | 3 |
| `seed` | Seed | 0 to 9999 | 1 |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Random field  `randomf` · id 25

A random weight per clone

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `seed` | Seed | 0 to 9999 | 1 |
| `cycles` | Cycles per loop | 0 to 16 | 0 |
| `phase` | Phase | 0 to 1 | 0 |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Index field  `index` · id 26

A ramp across the array

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Picture field  `luma` · id 27

Brightness of the picture itself drives the weight

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `curve` | Falloff curve | linear · smooth · in · out | smooth |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

### Stripes field  `stripes` · id 28

Travelling stripes

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `x` | Centre x | -2 to 2 | 0 |
| `y` | Centre y | -2 to 2 | 0 |
| `angle` | Angle | -360 to 360° | 0 |
| `scale` | Stripes | 0.1 to 24 | 3 |
| `falloff` | Softness | 0 to 1 | 0.5 |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `invert` | Invert | on / off | false |
| `outMin` | Output at 0 | -2 to 2 | 0 |
| `outMax` | Output at 1 | -2 to 2 | 1 |
| `combine` | Combine mode | add · mul · min · max · sub · over | mul |

## Effectors

### Plain effector  `plain` · id 10

Moves, rotates, scales and tints every clone by the same amount, weighted by a field

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0 |
| `posY` | Move y | -2 to 2 | 0.3 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 0 |
| `scale` | Scale | -1 to 3 | -0.3 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |

### Random effector  `random` · id 11

A different random amount per clone; loop-exact when animated

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0.25 |
| `posY` | Move y | -2 to 2 | 0.25 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 30 |
| `scale` | Scale | -1 to 3 | 0 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |
| `cycles` | Animate (cycles per loop) | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `seed` | Seed | 0 to 9999 | 1 |

### Step effector  `step` · id 12

A ramp across the array: first clone none, last clone full

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0 |
| `posY` | Move y | -2 to 2 | 0 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 90 |
| `scale` | Scale | -1 to 3 | -0.5 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |
| `curve` | Curve | linear · smooth · in · out | linear |

### Delay effector  `delay` · id 13

A wave that travels through the array in time: stagger, pop, cascade

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0 |
| `posY` | Move y | -2 to 2 | 0 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 0 |
| `scale` | Scale | -1 to 3 | 0.8 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `spread` | Spread | 0 to 4 | 1 |
| `shape` | Wave | pulse · sine · saw · tri · spring | spring |

### Noise effector  `noise` · id 14

Smooth noise over space, animated in a perfect loop

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0.2 |
| `posY` | Move y | -2 to 2 | 0.2 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 25 |
| `scale` | Scale | -1 to 3 | 0 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `noiseScale` | Noise scale | 0.1 to 24 | 2 |
| `seed` | Seed | 0 to 9999 | 1 |

### Sound effector  `sound` · id 15

Spreads the audio spectrum across the array; needs audio loaded

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `strength` | Strength | -2 to 2 | 1 |
| `posX` | Move x | -2 to 2 | 0 |
| `posY` | Move y | -2 to 2 | 0 |
| `posZ` | Move z | -2 to 2 | 0 |
| `rotX` | Rotate x | -720 to 720° | 0 |
| `rotY` | Rotate y | -720 to 720° | 0 |
| `rotZ` | Rotate z | -720 to 720° | 0 |
| `scale` | Scale | -1 to 3 | 1.2 |
| `scaleX` | Scale x | -1 to 3 | 0 |
| `scaleY` | Scale y | -1 to 3 | 0 |
| `opacity` | Opacity | -1 to 1 | 0 |
| `tint` | Colour amount | 0 to 1 | 0 |
| `tintColor` | Colour | ink · a0 · a1 · a2 · bg · cycle · ramp | ink |
| `bands` | Bands | 1 to 8 | 8 |
| `bandStart` | First band | 0 to 7 | 0 |

## Deformers

### Bend  `bend` · id 30

Curves the picture around an axis

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Curvature | -4 to 4 | 0.9 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |

### Twist  `twist` · id 31

Twists about an axis (best with the perspective camera)

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Twist | -6 to 6 | 1.4 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |

### Swirl  `swirl` · id 32

Rotates the picture around a point, strongest in the middle

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Swirl | -6 to 6 | 2.2 |
| `size` | Radius | 0.05 to 6 | 0.8 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |

### Taper  `taper` · id 33

Narrows one end

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Taper | -2 to 2 | 0.7 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |

### Shear  `shear` · id 34

Slants the picture

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Shear | -2 to 2 | 0.4 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |

### Squash & stretch  `squash` · id 35

Stretches one way, squashes the other

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Stretch | -1.5 to 1.5 | 0.3 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |

### Wave  `wave` · id 36

A travelling wave, loop-exact

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Amplitude | -1 to 1 | 0.07 |
| `size` | Wavelength | 0.05 to 6 | 0.7 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `angle` | Direction | -360 to 360° | 0 |
| `dir` | Direction of push | plane · z · both | plane |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |

### Ripple  `ripple` · id 37

Rings expanding from a point

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Amplitude | -1 to 1 | 0.06 |
| `size` | Wavelength | 0.05 to 6 | 0.35 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |
| `dir` | Direction of push | plane · z · both | plane |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `scale` | Decay | 0 to 6 | 1 |

### Noise  `noised` · id 38

Organic displacement, animated in a perfect loop

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Amount | -1 to 1 | 0.09 |
| `size` | Feature size | 0.05 to 6 | 0.5 |
| `dir` | Direction of push | plane · z · both | plane |
| `cycles` | Cycles per loop | 0 to 16 | 1 |
| `phase` | Phase | 0 to 1 | 0 |
| `seed` | Seed | 0 to 9999 | 1 |

### Bulge  `bulge` · id 39

Magnifies (or pinches) around a point

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Bulge | -2 to 2 | 0.7 |
| `size` | Radius | 0.05 to 6 | 0.8 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |

### Spherify  `spherify` · id 40

Wraps the picture onto a dome

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Amount | 0 to 1.5 | 0.9 |
| `size` | Radius | 0.05 to 6 | 1 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |

### Lens  `lens` · id 41

Barrel or pincushion distortion

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Distortion | -2 to 2 | 0.6 |
| `size` | Radius | 0.05 to 6 | 1.2 |
| `x` | Origin x | -2 to 2 | 0 |
| `y` | Origin y | -2 to 2 | 0 |

### Displace  `displace` · id 42

The picture displaces itself by brightness

| Key | Control | Range | Default |
| --- | --- | --- | --- |
| `space` | Acts on | world · object | world |
| `strength` | Amount | -1 to 1 | 0.25 |
| `dir` | Direction of push | plane · z · both | z |
| `mid` | Midpoint | 0 to 1 | 0.5 |

## Presets

- **Radial array** (`radial-array`): The picture copied around a ring, each copy popping in turn.
- **Grid cascade** (`grid-cascade`): The picture cut into tiles that drop in as a wave.
- **Type wave** (`type-wave`): A travelling wave through the whole picture.
- **Lens ripple** (`lens-ripple`): A pond ripple with a lens that swells and settles.
- **Shatter** (`shatter-reveal`): Tiles scatter outward as a soft field sweeps across.
- **Halftone dots** (`halftone-dots`): The picture rebuilt from dots sized by brightness.
- **Honeycomb pop** (`honeycomb-pop`): A honeycomb of tiles that pop through a wave.
- **Twist and taper** (`twist-taper`): A 3D twist seen through a perspective camera.
- **Noise melt** (`noise-melt`): Organic noise warp with a slow swirl.
- **Sunflower bloom** (`sunflower-bloom`): Copies in a sunflower spiral blooming outward.
- **Kick pump** (`kick-pump`): The picture pumps on the beat and bulges a little. Load audio to see it move.
- **Perspective cards** (`perspective-cards`): Tiles flip as cards in 3D.
