// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MotifMetal",
    platforms: [.macOS(.v12), .iOS(.v15)],   // iOS covers iPadOS
    products: [.library(name: "MotifMetal", targets: ["MotifMetal"])],
    targets: [
        .target(name: "MotifMetal"),
        .testTarget(name: "MotifMetalTests", dependencies: ["MotifMetal"]),
    ]
)
