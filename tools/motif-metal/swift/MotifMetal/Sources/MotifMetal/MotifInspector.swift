#if canImport(SwiftUI)
import SwiftUI

/// Builds the style's controls from its parameter list, like the web inspector: sections by `group`, sliders for
/// ranges, steppers for ints, toggles, pickers for selects, and `show` conditions honoured.
///
///     @State var values: [String: MotifValue] = [:]
///     MotifInspector(style: style, values: $values)
public struct MotifInspector: View {
    public let style: MotifStyle
    @Binding public var values: [String: MotifValue]

    public init(style: MotifStyle, values: Binding<[String: MotifValue]>) {
        self.style = style
        self._values = values
    }

    private struct ParamGroup: Identifiable {
        let id: String
        let params: [MotifParam]
    }

    private var sections: [ParamGroup] {
        var order: [String] = []
        var byGroup: [String: [MotifParam]] = [:]
        for p in style.params where style.isVisible(p, values: values) {
            let g = p.group ?? ""
            if byGroup[g] == nil { order.append(g); byGroup[g] = [] }
            byGroup[g]?.append(p)
        }
        return order.map { ParamGroup(id: $0.isEmpty ? "Style" : $0, params: byGroup[$0] ?? []) }
    }

    public var body: some View {
        Form {
            ForEach(sections) { section in
                Section(header: Text(section.id)) {
                    ForEach(section.params) { p in control(p) }
                }
            }
            Section {
                Button("Reset to defaults") { values = [:] }
            }
        }
    }

    private func current(_ p: MotifParam) -> MotifValue { values[p.key] ?? p.def }

    private func number(_ p: MotifParam) -> Binding<Double> {
        Binding(get: { current(p).doubleValue }, set: { values[p.key] = .number($0) })
    }

    private func integer(_ p: MotifParam) -> Binding<Int> {
        Binding(get: { Int(current(p).doubleValue.rounded()) }, set: { values[p.key] = .number(Double($0)) })
    }

    private func flag(_ p: MotifParam) -> Binding<Bool> {
        Binding(get: { current(p).doubleValue != 0 }, set: { values[p.key] = .bool($0) })
    }

    private func choice(_ p: MotifParam) -> Binding<String> {
        Binding(
            get: {
                if case .string(let s) = current(p) { return s }
                let i = Int(current(p).doubleValue.rounded())
                return (p.options ?? []).indices.contains(i) ? (p.options ?? [])[i].v : (p.options?.first?.v ?? "")
            },
            set: { values[p.key] = .string($0) })
    }

    @ViewBuilder private func control(_ p: MotifParam) -> some View {
        switch p.type {
        case .range:
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(p.label)
                    Spacer()
                    Text(String(format: "%.2f", number(p).wrappedValue) + (p.unit ?? "")).foregroundColor(.secondary).monospacedDigit()
                }
                Slider(value: number(p), in: (p.min ?? 0)...(p.max ?? 1))
            }
        case .int:
            Stepper(value: integer(p), in: Int(p.min ?? 0)...Int(p.max ?? 10)) {
                Text("\(p.label): \(integer(p).wrappedValue)")
            }
        case .toggle:
            Toggle(p.label, isOn: flag(p))
        case .select:
            Picker(p.label, selection: choice(p)) {
                ForEach(p.options ?? [], id: \.v) { o in Text(o.l).tag(o.v) }
            }
        }
    }
}
#endif
