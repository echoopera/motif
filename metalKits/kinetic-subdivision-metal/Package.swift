// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "KineticSubdivisionMotifKit",
    platforms: [.macOS(.v12), .iOS(.v15)],
    products: [.library(name: "KineticSubdivisionMotifKit", targets: ["KineticSubdivisionMotifKit"])],
    dependencies: [.package(path: "../../tools/motif-metal/swift/MotifMetal")],
    targets: [
        .target(name: "KineticSubdivisionMotifKit", dependencies: [.product(name: "MotifMetal", package: "MotifMetal")]),
        .testTarget(name: "KineticSubdivisionMotifKitTests", dependencies: ["KineticSubdivisionMotifKit", .product(name: "MotifMetal", package: "MotifMetal")]),
    ]
)
