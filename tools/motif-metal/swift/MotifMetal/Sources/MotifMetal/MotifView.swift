#if canImport(SwiftUI) && canImport(MetalKit)
import SwiftUI
import MetalKit

/// Drives an `MTKView`: advances the loop phase with the clock (or holds `fixedPhase`) and renders a kit style.
public final class MotifPlayer: NSObject, MTKViewDelegate {
    public var kit: MotifKitDefinition
    public var styleID: String
    public var state = MotifRenderState()
    public var loopSeconds: Double = 6
    /// Hold this phase instead of following the clock (scrubbing, thumbnails).
    public var fixedPhase: Double?
    public private(set) var renderer: MotifRenderer?
    public private(set) var lastError: Error?
    private let start = ProcessInfo.processInfo.systemUptime

    public init(kit: MotifKitDefinition, styleID: String) {
        self.kit = kit
        self.styleID = styleID
        super.init()
        do { renderer = try MotifRenderer() } catch { lastError = error }
    }

    public func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    public func draw(in view: MTKView) {
        guard let renderer = renderer, let style = kit.style(styleID),
              let drawable = view.currentDrawable, let cb = renderer.queue.makeCommandBuffer() else { return }
        var s = state
        let L = max(0.1, loopSeconds)
        let t = ProcessInfo.processInfo.systemUptime - start
        s.phase = fixedPhase ?? (t / L).truncatingRemainder(dividingBy: 1)
        s.loopSeconds = L
        do {
            try renderer.encode(kit: kit, style: style, state: s, target: drawable.texture, commandBuffer: cb)
        } catch {
            lastError = error
            return
        }
        cb.present(drawable)
        cb.commit()
    }
}

#if os(macOS)
public typealias MotifPlatformRepresentable = NSViewRepresentable
#else
public typealias MotifPlatformRepresentable = UIViewRepresentable
#endif

/// A SwiftUI view that plays a kit style, on macOS and iPadOS.
///
///     MotifView(kit: WallcastKit.definition, styleID: "prism-split", params: ["split": 0.03], loopSeconds: 8)
public struct MotifView: MotifPlatformRepresentable {
    public var kit: MotifKitDefinition
    public var styleID: String
    public var params: [String: MotifValue]
    public var paletteID: String?
    public var loopSeconds: Double
    public var seed: Int
    public var phase: Double?
    public var photosensitiveSafe: Bool
    public var media: [String: MotifMedia]
    public var paused: Bool

    public init(kit: MotifKitDefinition, styleID: String, params: [String: MotifValue] = [:], paletteID: String? = nil,
                loopSeconds: Double = 6, seed: Int = 1, phase: Double? = nil, photosensitiveSafe: Bool = true,
                media: [String: MotifMedia] = [:], paused: Bool = false) {
        self.kit = kit; self.styleID = styleID; self.params = params; self.paletteID = paletteID
        self.loopSeconds = loopSeconds; self.seed = seed; self.phase = phase
        self.photosensitiveSafe = photosensitiveSafe; self.media = media; self.paused = paused
    }

    public func makeCoordinator() -> MotifPlayer { MotifPlayer(kit: kit, styleID: styleID) }

    private func build(_ player: MotifPlayer) -> MTKView {
        let v = MTKView(frame: .zero, device: player.renderer?.device)
        v.colorPixelFormat = .bgra8Unorm
        v.framebufferOnly = true
        v.enableSetNeedsDisplay = false
        v.preferredFramesPerSecond = 60
        v.delegate = player
        apply(player, v)
        return v
    }

    private func apply(_ player: MotifPlayer, _ view: MTKView) {
        player.kit = kit
        player.styleID = styleID
        player.loopSeconds = loopSeconds
        player.fixedPhase = phase
        player.state = MotifRenderState(params: params, paletteID: paletteID, phase: 0, loopSeconds: loopSeconds, seed: seed,
                                        photosensitiveSafe: photosensitiveSafe, media: media)
        view.isPaused = paused || phase != nil
        if view.isPaused { view.draw() }
    }

    #if os(macOS)
    public func makeNSView(context: Context) -> MTKView { build(context.coordinator) }
    public func updateNSView(_ view: MTKView, context: Context) { apply(context.coordinator, view) }
    #else
    public func makeUIView(context: Context) -> MTKView { build(context.coordinator) }
    public func updateUIView(_ view: MTKView, context: Context) { apply(context.coordinator, view) }
    #endif
}
#endif
