// A complete macOS + iPadOS app in one file. In Xcode: File > New > Project > Multiplatform App, delete the template
// App/ContentView files, add this file, then File > Add Package Dependencies… and add MotifMetal plus a generated kit
// package (for example metalKits/wallcast-metal) as local packages. Needs macOS 13+ / iPadOS 16+ for NavigationSplitView;
// MotifView itself runs on macOS 12 / iPadOS 15.
import SwiftUI
import MotifMetal
import WallcastMotifKit

@main
struct PlaygroundApp: App {
    var body: some Scene { WindowGroup { Playground() } }
}

struct Playground: View {
    let kit = WallcastKit.definition
    @State private var styleID = "wallcast/prism-split"
    @State private var values: [String: MotifValue] = [:]
    @State private var loopSeconds = 8.0

    var body: some View {
        NavigationSplitView {
            List(kit.styles, selection: Binding(get: { styleID }, set: { styleID = $0 ?? styleID; values = [:] })) { s in
                VStack(alignment: .leading) {
                    Text(s.name)
                    Text(s.blurb).font(.caption).foregroundColor(.secondary).lineLimit(2)
                }
            }
            .navigationTitle(kit.name)
        } content: {
            if let style = kit.style(styleID) { MotifInspector(style: style, values: $values) }
        } detail: {
            MotifView(kit: kit, styleID: styleID, params: values, loopSeconds: loopSeconds)
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .padding()
        }
    }
}
