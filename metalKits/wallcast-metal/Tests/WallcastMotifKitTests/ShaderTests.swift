import XCTest
import CoreGraphics
import Metal
import MotifMetal
@testable import WallcastMotifKit

/// Run on a Mac (`swift test`) or in Xcode: compiles every pass with the real Metal compiler and renders it.
final class ShaderTests: XCTestCase {
    private func bytes(_ image: CGImage) -> [UInt8] {
        guard let d = image.dataProvider?.data else { return [] }
        return [UInt8](d as Data)
    }

    func testEveryStyleCompilesAndRenders() throws {
        guard MTLCreateSystemDefaultDevice() != nil else { throw XCTSkip("No Metal device") }
        let renderer = try MotifRenderer()
        let kit = WallcastKit.definition
        XCTAssertEqual(kit.styles.count, 10)
        for style in kit.styles {
            let state = MotifRenderState(phase: 0.37, loopSeconds: 6, seed: 417)
            let image = try renderer.renderImage(kit: kit, style: style, state: state, width: 96, height: 54)
            XCTAssertEqual(image.width, 96, style.id)
            XCTAssertFalse(bytes(image).isEmpty, style.id)
        }
    }

    /// Frame 0 and the frame at the loop length must match: every loop closes exactly.
    func testLoopsClose() throws {
        guard MTLCreateSystemDefaultDevice() != nil else { throw XCTSkip("No Metal device") }
        let renderer = try MotifRenderer()
        let kit = WallcastKit.definition
        for style in kit.styles {
            var a = MotifRenderState(phase: 0, loopSeconds: 6, seed: 417)
            var b = a
            a.phase = 0; b.phase = 1
            let x = bytes(try renderer.renderImage(kit: kit, style: style, state: a, width: 64, height: 36))
            let y = bytes(try renderer.renderImage(kit: kit, style: style, state: b, width: 64, height: 36))
            XCTAssertEqual(x.count, y.count)
            var sum = 0
            for i in 0..<min(x.count, y.count) { sum += abs(Int(x[i]) - Int(y[i])) }
            let mean = Double(sum) / Double(max(1, x.count))
            XCTAssertLessThan(mean, 2.0, "\(style.id) does not close its loop (mean diff \(mean))")
        }
    }
}
