// Contract tests for {{name}}. Every public symbol in CONTRACT.md gets a test.
import XCTest
@testable import {{name}}Module

final class {{name}}Tests: XCTestCase {
    func testName() { XCTAssertEqual({{name}}Module.name, "{{name}}") }
}
