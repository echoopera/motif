import XCTest
import Metal
@testable import MotifMetal

final class MotifMetalTests: XCTestCase {
    private let json = """
    {"id":"t","name":"T","version":"1.0.0","palettes":[{"id":"p","name":"P","bg":"#000000","ink":"#FFFFFF","a":["#FF0000","#00FF00","#0000FF"]}],
     "styles":[{"id":"t/s","localId":"s","name":"S","blurb":"","group":"","tags":[],"palette":"p","flash":false,"cost":1,
       "passes":[{"function":"f","source":"s_p0","scale":1}],"inputs":[],
       "params":[
         {"key":"gain","index":0,"type":"range","label":"Gain","def":1.5,"min":0,"max":2},
         {"key":"count","index":1,"type":"int","label":"Count","def":4,"min":1,"max":9},
         {"key":"on","index":2,"type":"toggle","label":"On","def":true},
         {"key":"mode","index":3,"type":"select","label":"Mode","def":"b","options":[{"v":"a","l":"A"},{"v":"b","l":"B"}],
          "show":{"param":"on","is":true}}]}]}
    """

    func testUniformBlockMatchesMetalLayout() {
        XCTAssertEqual(MemoryLayout<MotifUniforms>.stride, 144)
        XCTAssertEqual(MemoryLayout<MotifUniforms>.alignment, 16)
        XCTAssertEqual(MemoryLayout<MotifUniforms>.offset(of: \.bg), 32)
        XCTAssertEqual(MemoryLayout<MotifUniforms>.offset(of: \.media1), 128)
    }

    func testDecodeAndPackParams() throws {
        let kit = try MotifKitDefinition(json: Data(json.utf8), sources: [:])
        let s = try XCTUnwrap(kit.style("s"))
        XCTAssertEqual(s.packParams([:]), [1.5, 4, 1, 1])
        XCTAssertEqual(s.packParams(["gain": 0.25, "count": 6.4, "on": false, "mode": "a"]), [0.25, 6, 0, 0])
        XCTAssertTrue(s.isVisible(s.param("mode")!, values: [:]))
        XCTAssertFalse(s.isVisible(s.param("mode")!, values: ["on": false]))
        XCTAssertEqual(kit.palette(for: s).id, "p")
    }

    func testLinearPalette() {
        let c = MotifPalette.linear("#808080")
        XCTAssertEqual(c.x, 0.2158, accuracy: 0.001)
    }

    func testRuntimeShadersCompile() throws {
        guard MTLCreateSystemDefaultDevice() != nil else { throw XCTSkip("No Metal device") }
        XCTAssertNoThrow(try MotifRenderer())
    }
}
