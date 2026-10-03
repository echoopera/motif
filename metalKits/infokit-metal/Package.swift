// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "InfokitMotifKit",
    platforms: [.macOS(.v12), .iOS(.v15)],
    products: [.library(name: "InfokitMotifKit", targets: ["InfokitMotifKit"])],
    dependencies: [.package(path: "../../tools/motif-metal/swift/MotifMetal")],
    targets: [
        .target(name: "InfokitMotifKit", dependencies: [.product(name: "MotifMetal", package: "MotifMetal")]),
        .testTarget(name: "InfokitMotifKitTests", dependencies: ["InfokitMotifKit", .product(name: "MotifMetal", package: "MotifMetal")]),
    ]
)
