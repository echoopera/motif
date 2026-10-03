import Foundation
import Metal

/// A prepared media input: premultiplied linear RGBA already fitted to the frame (see `MotifRenderer.makeMedia`).
public struct MotifMedia {
    public var texture: MTLTexture
    /// Video time in seconds (0 for stills).
    public var time: Double
    /// The source's own pixel size.
    public var size: SIMD2<Float>
    public init(texture: MTLTexture, time: Double = 0, size: SIMD2<Float>) {
        self.texture = texture; self.time = time; self.size = size
    }
}

public enum MotifMediaFit { case fill, fit, stretch }

public enum MotifOutputEncoding {
    /// sRGB targets get linear output (the hardware encodes); everything else gets the web-identical final.
    case automatic
    /// Premultiplied sRGB with dithering, byte-for-byte what the web preview draws.
    case webSRGB
    /// Linear premultiplied RGBA (for float targets or your own colour management).
    case linear
}

/// Everything that varies per frame. Every frame is a pure function of this value, so exports are deterministic
/// and loops close exactly.
public struct MotifRenderState {
    /// Overrides on top of the style's defaults, keyed by parameter key (`"glow": 1.2`, `"mode": "dots"`).
    public var params: [String: MotifValue]
    public var paletteID: String?
    /// Loop phase 0..1 with tempo and phase offset already applied.
    public var phase: Double
    /// Effective loop length in seconds.
    public var loopSeconds: Double
    public var seed: Int
    public var photosensitiveSafe: Bool
    /// Media inputs by input id (`"source"`).
    public var media: [String: MotifMedia]

    public init(params: [String: MotifValue] = [:], paletteID: String? = nil, phase: Double = 0, loopSeconds: Double = 6,
                seed: Int = 1, photosensitiveSafe: Bool = true, media: [String: MotifMedia] = [:]) {
        self.params = params; self.paletteID = paletteID; self.phase = phase; self.loopSeconds = loopSeconds
        self.seed = seed; self.photosensitiveSafe = photosensitiveSafe; self.media = media
    }
}

public enum MotifError: Error, LocalizedError {
    case noDevice, noQueue, noTexture, readback
    case unknownStyle(String)
    case missingSource(String)
    case missingFunction(String)
    case compile(String, String)
    case pipeline(String, String)

    public var errorDescription: String? {
        switch self {
        case .noDevice: return "No Metal device is available."
        case .noQueue: return "Could not create a Metal command queue."
        case .noTexture: return "Could not allocate a Metal texture."
        case .readback: return "Could not read the rendered frame back."
        case .unknownStyle(let s): return "Unknown style \"\(s)\"."
        case .missingSource(let s): return "No Metal source for pass \"\(s)\"."
        case .missingFunction(let s): return "Function \"\(s)\" was not found in its Metal library."
        case .compile(let w, let m): return "Metal compile failed (\(w)):\n\(m)"
        case .pipeline(let w, let m): return "Could not build a render pipeline for \(w): \(m)"
        }
    }
}
