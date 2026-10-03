import Foundation
import Metal
import CoreGraphics
import simd

/// Renders converted Motif kit styles with Metal on macOS and iPadOS.
///
/// Passes follow the web runtime exactly: pass *n* may sample the outputs of passes 0..<n as `u_buf0…3`, intermediate
/// passes render at `scale` of the frame into half-float targets, and the last pass renders at full size into the
/// target you give it. Pass sources compile lazily on first use (math mode "safe", like the web build), or come from
/// precompiled libraries you supply.
public final class MotifRenderer {
    public let device: MTLDevice
    public let queue: MTLCommandQueue
    /// Optional precompiled libraries (see `build-metallib.sh` in a generated kit). Searched before compiling source.
    public var precompiledLibraries: [MTLLibrary] = []

    private let vertexFunction: MTLFunction
    private let runtimeLibrary: MTLLibrary
    private let blank: MTLTexture
    private let lock = NSRecursiveLock()
    private var libraries: [String: MTLLibrary] = [:]
    private var pipelines: [String: MTLRenderPipelineState] = [:]
    private var targets: [String: MTLTexture] = [:]
    private var bakePipelines: [UInt: MTLRenderPipelineState] = [:]

    public init(device: MTLDevice? = MTLCreateSystemDefaultDevice(), queue: MTLCommandQueue? = nil) throws {
        guard let device = device else { throw MotifError.noDevice }
        guard let q = queue ?? device.makeCommandQueue() else { throw MotifError.noQueue }
        self.device = device
        self.queue = q
        let lib: MTLLibrary
        do { lib = try device.makeLibrary(source: MotifRenderer.runtimeSource, options: MotifRenderer.compileOptions()) }
        catch { throw MotifError.compile("runtime", "\(error)") }
        guard let vf = lib.makeFunction(name: "motif_fullscreen_vs") else { throw MotifError.missingFunction("motif_fullscreen_vs") }
        runtimeLibrary = lib
        vertexFunction = vf
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: 1, height: 1, mipmapped: false)
        d.usage = .shaderRead
        guard let t = device.makeTexture(descriptor: d) else { throw MotifError.noTexture }
        t.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, withBytes: [UInt8](repeating: 0, count: 4), bytesPerRow: 4)
        blank = t
    }

    // MARK: Compile

    static func compileOptions() -> MTLCompileOptions {
        let o = MTLCompileOptions()
        // Fast math would break isnan() and change the photosensitive limiter's rounding; the web build is IEEE.
        if #available(macOS 15.0, iOS 18.0, *) { o.mathMode = .safe } else { o.fastMathEnabled = false }
        return o
    }

    private func library(kit: MotifKitDefinition, pass: MotifPass) throws -> MTLLibrary {
        let key = "\(kit.id)@\(kit.version)/\(pass.source)"
        if let l = libraries[key] { return l }
        guard let src = kit.sources[pass.source] else { throw MotifError.missingSource(pass.source) }
        do {
            let l = try device.makeLibrary(source: src, options: MotifRenderer.compileOptions())
            libraries[key] = l
            return l
        } catch { throw MotifError.compile(pass.source, "\(error)") }
    }

    private func pipeline(kit: MotifKitDefinition, pass: MotifPass, format: MTLPixelFormat) throws -> MTLRenderPipelineState {
        let key = "\(kit.id)@\(kit.version)/\(pass.function)|\(format.rawValue)"
        if let p = pipelines[key] { return p }
        var fn: MTLFunction?
        for lib in precompiledLibraries { if let f = lib.makeFunction(name: pass.function) { fn = f; break } }
        if fn == nil { fn = try library(kit: kit, pass: pass).makeFunction(name: pass.function) }
        guard let fragment = fn else { throw MotifError.missingFunction(pass.function) }
        let d = MTLRenderPipelineDescriptor()
        d.vertexFunction = vertexFunction
        d.fragmentFunction = fragment
        d.colorAttachments[0].pixelFormat = format
        d.colorAttachments[0].isBlendingEnabled = false
        do {
            let p = try device.makeRenderPipelineState(descriptor: d)
            pipelines[key] = p
            return p
        } catch { throw MotifError.pipeline(pass.function, "\(error)") }
    }

    /// Compiles every pass of a style now so the first frame does not hitch.
    public func prepare(kit: MotifKitDefinition, style: MotifStyle, targetFormat: MTLPixelFormat) throws {
        lock.lock(); defer { lock.unlock() }
        for (i, p) in style.passes.enumerated() {
            _ = try pipeline(kit: kit, pass: p, format: i == style.passes.count - 1 ? targetFormat : .rgba16Float)
        }
    }

    // MARK: Render

    private func intermediate(_ key: String, _ w: Int, _ h: Int) throws -> MTLTexture {
        let k = "\(key)|\(w)x\(h)"
        if let t = targets[k] { return t }
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: w, height: h, mipmapped: false)
        d.usage = [.renderTarget, .shaderRead]
        d.storageMode = .private
        guard let t = device.makeTexture(descriptor: d) else { throw MotifError.noTexture }
        if targets.count > 24 { targets.removeAll() }
        targets[k] = t
        return t
    }

    private static func isSRGB(_ f: MTLPixelFormat) -> Bool {
        f == .bgra8Unorm_srgb || f == .rgba8Unorm_srgb
    }

    /// Encodes every pass of `style` into `commandBuffer`, ending with the full-size pass into `target`.
    public func encode(kit: MotifKitDefinition, style: MotifStyle, state: MotifRenderState, target: MTLTexture,
                       commandBuffer: MTLCommandBuffer, encoding: MotifOutputEncoding = .automatic) throws {
        lock.lock(); defer { lock.unlock() }
        guard !style.passes.isEmpty else { return }
        let w = target.width, h = target.height
        let pal = kit.palette(for: style, id: state.paletteID)
        let params = style.packParams(state.params)
        let useWeb: Bool
        switch encoding {
        case .webSRGB: useWeb = true
        case .linear: useWeb = false
        case .automatic: useWeb = !MotifRenderer.isSRGB(target.pixelFormat)
        }
        var produced: [MTLTexture] = []
        for (i, pass) in style.passes.enumerated() {
            let last = i == style.passes.count - 1
            let pw = last ? w : max(1, Int((Double(w) * pass.scale).rounded()))
            let ph = last ? h : max(1, Int((Double(h) * pass.scale).rounded()))
            let dest: MTLTexture
            if last { dest = target } else { dest = try intermediate("\(kit.id)/\(style.localId)/\(i)", pw, ph) }
            let pso = try pipeline(kit: kit, pass: pass, format: dest.pixelFormat)

            var u = MotifUniforms()
            u.res = SIMD2<Float>(Float(pw), Float(ph))
            u.p = Float(state.phase)
            u.L = Float(state.loopSeconds)
            u.seed = Float(min(9999, max(1, state.seed)))
            u.safe = state.photosensitiveSafe ? 1 : 0
            u.encode = (last && useWeb) ? 1 : 0
            u.bg = SIMD4<Float>(MotifPalette.linear(pal.bg), 0)
            u.ink = SIMD4<Float>(MotifPalette.linear(pal.ink), 0)
            let acc = pal.a + [String](repeating: pal.ink, count: max(0, 3 - pal.a.count))
            u.a0 = SIMD4<Float>(MotifPalette.linear(acc[0]), 0)
            u.a1 = SIMD4<Float>(MotifPalette.linear(acc[1]), 0)
            u.a2 = SIMD4<Float>(MotifPalette.linear(acc[2]), 0)
            var inputTextures: [MTLTexture] = []
            for (j, input) in style.inputs.prefix(2).enumerated() {
                let m = state.media[input.id]
                let info = SIMD4<Float>(m == nil ? 0 : 1, Float(m?.time ?? 0), m?.size.x ?? 0, m?.size.y ?? 0)
                if j == 0 { u.media0 = info } else { u.media1 = info }
                let fallback = (input.implicit ?? false) ? (produced.first ?? blank) : blank
                inputTextures.append(m?.texture ?? fallback)
            }

            let rpd = MTLRenderPassDescriptor()
            rpd.colorAttachments[0].texture = dest
            rpd.colorAttachments[0].loadAction = .dontCare
            rpd.colorAttachments[0].storeAction = .store
            guard let enc = commandBuffer.makeRenderCommandEncoder(descriptor: rpd) else { throw MotifError.noQueue }
            enc.label = "\(style.id) pass \(i + 1)"
            enc.setRenderPipelineState(pso)
            enc.setFragmentBytes(&u, length: MemoryLayout<MotifUniforms>.stride, index: 0)
            params.withUnsafeBufferPointer { enc.setFragmentBytes($0.baseAddress!, length: $0.count * MemoryLayout<Float>.stride, index: 1) }
            for b in 0..<4 { enc.setFragmentTexture(b < i ? produced[b] : blank, index: b) }
            for (j, t) in inputTextures.enumerated() { enc.setFragmentTexture(t, index: 4 + j) }
            enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
            enc.endEncoding()
            if !last { produced.append(dest) }
        }
    }

    // MARK: Offline

    /// Renders one frame to an image (premultiplied sRGB RGBA, top-left origin). Deterministic: the same state gives
    /// the same pixels, which is how exports and thumbnails should be made.
    public func renderImage(kit: MotifKitDefinition, style: MotifStyle, state: MotifRenderState,
                            width: Int, height: Int) throws -> CGImage {
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: width, height: height, mipmapped: false)
        d.usage = [.renderTarget, .shaderRead]
        #if os(macOS)
        d.storageMode = device.hasUnifiedMemory ? .shared : .managed
        #else
        d.storageMode = .shared
        #endif
        guard let tex = device.makeTexture(descriptor: d), let cb = queue.makeCommandBuffer() else { throw MotifError.noTexture }
        try encode(kit: kit, style: style, state: state, target: tex, commandBuffer: cb, encoding: .webSRGB)
        #if os(macOS)
        if tex.storageMode == .managed, let blit = cb.makeBlitCommandEncoder() { blit.synchronize(resource: tex); blit.endEncoding() }
        #endif
        cb.commit()
        cb.waitUntilCompleted()
        if let e = cb.error { throw e }
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        tex.getBytes(&bytes, bytesPerRow: width * 4, from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        guard let provider = CGDataProvider(data: Data(bytes) as CFData),
              let cs = CGColorSpace(name: CGColorSpace.sRGB),
              let img = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
                                space: cs, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        else { throw MotifError.readback }
        return img
    }

    // MARK: Media

    /// Bakes an image into the frame's aspect ratio (fit applied) as premultiplied linear RGBA with mipmaps, which is
    /// what `u_<id>` and `m_<id>(q)` expect. `frameSize` is the size of the frame you will render.
    public func makeMedia(image: CGImage, fit: MotifMediaFit = .fill, frameSize: CGSize) throws -> MotifMedia {
        let w = image.width, h = image.height
        guard let cs = CGColorSpace(name: CGColorSpace.sRGB),
              let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
              let data = ctx.data
        else { throw MotifError.readback }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))   // premultiplied, sRGB-encoded, row 0 on top
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm_srgb, width: w, height: h, mipmapped: false)
        d.usage = .shaderRead
        guard let src = device.makeTexture(descriptor: d) else { throw MotifError.noTexture }
        src.replace(region: MTLRegionMake2D(0, 0, w, h), mipmapLevel: 0, withBytes: data, bytesPerRow: w * 4)
        return try makeMedia(texture: src, fit: fit, frameSize: frameSize)
    }

    /// Same for a texture you already have (a decoded video frame, say). Alpha is taken as premultiplied.
    public func makeMedia(texture src: MTLTexture, fit: MotifMediaFit = .fill, frameSize: CGSize, time: Double = 0) throws -> MotifMedia {
        lock.lock(); defer { lock.unlock() }
        let fw = min(4096, max(1, Int(frameSize.width.rounded()))), fh = min(4096, max(1, Int(frameSize.height.rounded())))
        let sa = Float(src.width) / Float(max(1, src.height)), fa = Float(fw) / Float(fh)
        var scale = SIMD2<Float>(1, 1)
        switch fit {
        case .stretch: break
        case .fill: if sa > fa { scale = SIMD2<Float>(fa / sa, 1) } else { scale = SIMD2<Float>(1, sa / fa) }
        case .fit: if sa > fa { scale = SIMD2<Float>(1, sa / fa) } else { scale = SIMD2<Float>(fa / sa, 1) }
        }
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: fw, height: fh, mipmapped: true)
        d.usage = [.renderTarget, .shaderRead]
        d.storageMode = .private
        guard let dest = device.makeTexture(descriptor: d), let cb = queue.makeCommandBuffer() else { throw MotifError.noTexture }
        let pso = try bakePipeline(format: dest.pixelFormat)
        let rpd = MTLRenderPassDescriptor()
        rpd.colorAttachments[0].texture = dest
        rpd.colorAttachments[0].level = 0
        rpd.colorAttachments[0].loadAction = .dontCare
        rpd.colorAttachments[0].storeAction = .store
        guard let enc = cb.makeRenderCommandEncoder(descriptor: rpd) else { throw MotifError.noQueue }
        var params = SIMD4<Float>(Float(fw), Float(fh), scale.x, scale.y)
        enc.setRenderPipelineState(pso)
        enc.setFragmentBytes(&params, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
        enc.setFragmentTexture(src, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
        if let blit = cb.makeBlitCommandEncoder() { blit.generateMipmaps(for: dest); blit.endEncoding() }
        cb.commit()
        cb.waitUntilCompleted()
        if let e = cb.error { throw e }
        return MotifMedia(texture: dest, time: time, size: SIMD2<Float>(Float(src.width), Float(src.height)))
    }

    private func bakePipeline(format: MTLPixelFormat) throws -> MTLRenderPipelineState {
        if let p = bakePipelines[format.rawValue] { return p }
        guard let f = runtimeLibrary.makeFunction(name: "motif_bake_fs") else { throw MotifError.missingFunction("motif_bake_fs") }
        let d = MTLRenderPipelineDescriptor()
        d.vertexFunction = vertexFunction
        d.fragmentFunction = f
        d.colorAttachments[0].pixelFormat = format
        do { let p = try device.makeRenderPipelineState(descriptor: d); bakePipelines[format.rawValue] = p; return p }
        catch { throw MotifError.pipeline("motif_bake_fs", "\(error)") }
    }

    // MARK: Runtime shaders

    static let runtimeSource = """
    #include <metal_stdlib>
    using namespace metal;

    vertex float4 motif_fullscreen_vs(uint vid [[vertex_id]]) {
      float2 p = float2(float((vid << 1) & 2u), float(vid & 2u));   // (0,0) (2,0) (0,2): one triangle covers the frame
      return float4(p * 2.0 - 1.0, 0.0, 1.0);
    }

    // Fits a source texture to the frame: params = (frame w, frame h, source-UV scale x, y). Outside the source reads transparent.
    fragment float4 motif_bake_fs(float4 pos [[position]], constant float4& B [[buffer(0)]], texture2d<float> src [[texture(0)]]) {
      constexpr sampler s(coord::normalized, address::clamp_to_edge, filter::linear);
      float2 uv = pos.xy / B.xy;
      float2 q = (uv - 0.5) * B.zw + 0.5;
      if (any(q < float2(0.0)) || any(q > float2(1.0))) return float4(0.0);
      return src.sample(s, q);
    }
    """
}
