import simd

/// Per-pass uniform block. Mirrors `struct MotifUniforms` in every generated .metal file (144 bytes).
struct MotifUniforms {
    var res = SIMD2<Float>(1, 1)   // pass resolution in pixels
    var p: Float = 0               // loop phase 0..1
    var L: Float = 6               // effective loop length in seconds
    var seed: Float = 1            // 1..9999
    var safe: Float = 1            // photosensitive-safe limiter
    var encode: Float = 1          // 0 = linear premultiplied, 1 = web-identical final (sRGB, dithered)
    var pad: Float = 0
    var bg = SIMD4<Float>(repeating: 0)     // palette, linear RGB in xyz
    var ink = SIMD4<Float>(repeating: 0)
    var a0 = SIMD4<Float>(repeating: 0)
    var a1 = SIMD4<Float>(repeating: 0)
    var a2 = SIMD4<Float>(repeating: 0)
    var media0 = SIMD4<Float>(repeating: 0) // x = attached, y = video time, zw = pixel size
    var media1 = SIMD4<Float>(repeating: 0)
}
