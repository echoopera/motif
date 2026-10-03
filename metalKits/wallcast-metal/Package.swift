// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "WallcastMotifKit",
    platforms: [.macOS(.v12), .iOS(.v15)],
    products: [.library(name: "WallcastMotifKit", targets: ["WallcastMotifKit"])],
    dependencies: [.package(path: "../../tools/motif-metal/swift/MotifMetal")],
    targets: [
        .target(name: "WallcastMotifKit", dependencies: [.product(name: "MotifMetal", package: "MotifMetal")]),
        .testTarget(name: "WallcastMotifKitTests", dependencies: ["WallcastMotifKit", .product(name: "MotifMetal", package: "MotifMetal")]),
    ]
)
