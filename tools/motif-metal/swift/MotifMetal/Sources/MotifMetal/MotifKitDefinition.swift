import Foundation

/// A parameter value as the web inspector holds it: a number, a toggle or a select option id.
public enum MotifValue: Codable, Hashable, ExpressibleByFloatLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByBooleanLiteral, ExpressibleByStringLiteral {
    case number(Double)
    case bool(Bool)
    case string(String)

    public init(floatLiteral value: Double) { self = .number(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(stringLiteral value: String) { self = .string(value) }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let d = try? c.decode(Double.self) { self = .number(d) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported parameter value") }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .number(let d): try c.encode(d)
        case .bool(let b): try c.encode(b)
        case .string(let s): try c.encode(s)
        }
    }

    public var doubleValue: Double {
        switch self {
        case .number(let d): return d
        case .bool(let b): return b ? 1 : 0
        case .string: return 0
        }
    }
}

/// Either one value or a list of values (`show.is` / `show.not` accept both).
public struct MotifValueList: Codable, Hashable {
    public var values: [MotifValue]
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let many = try? c.decode([MotifValue].self) { values = many }
        else { values = [try c.decode(MotifValue.self)] }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(values)
    }
}

/// A condition that shows a control only while another control has a given value (SDK 1.2 `show`).
public struct MotifShow: Codable, Hashable {
    public var param: String
    public var isValues: MotifValueList?
    public var notValues: MotifValueList?
    public var gt: Double?
    public var lt: Double?
    enum CodingKeys: String, CodingKey { case param, isValues = "is", notValues = "not", gt, lt }

    public func matches(_ v: MotifValue) -> Bool {
        if let list = isValues { return list.values.contains(v) }
        if let list = notValues { return !list.values.contains(v) }
        if let g = gt { return v.doubleValue > g }
        if let l = lt { return v.doubleValue < l }
        return true
    }
}

public enum MotifParamType: String, Codable { case range, int, toggle, select }

public struct MotifOption: Codable, Hashable {
    public var v: String
    public var l: String
}

/// Colour and point params are stored as scalar channels (`tintR/G/B`, `originX/Y`); `part` says which control they belong to.
public struct MotifParamPart: Codable, Hashable {
    public var of: String
    public var kind: String   // "color" | "point"
    public var i: Int
    public var label: String
}

public struct MotifParam: Codable, Hashable, Identifiable {
    public var key: String
    /// Slot in the float buffer the renderer uploads (matches the generated `P[index]`).
    public var index: Int
    public var type: MotifParamType
    public var label: String
    public var def: MotifValue
    public var min: Double?
    public var max: Double?
    public var step: Double?
    public var unit: String?
    public var group: String?
    public var hint: String?
    public var mutate: Double?
    public var log: Bool?
    public var randMax: Double?
    public var show: MotifShow?
    public var part: MotifParamPart?
    public var options: [MotifOption]?
    public var id: String { key }
}

public struct MotifPass: Codable, Hashable {
    /// Fragment function name inside the pass's Metal source.
    public var function: String
    /// Key into `MotifKitDefinition.sources`.
    public var source: String
    /// Render size of an intermediate pass relative to the frame; the last pass always renders at full size.
    public var scale: Double
}

public struct MotifInput: Codable, Hashable, Identifiable {
    public var id: String
    public var type: String   // image | video | media
    public var label: String
    public var fit: String    // fill | fit | stretch
    public var hint: String
    /// SDK 1.0 kits that declared `uniform sampler2D u_<id>` themselves: with no media attached the sampler reads pass 0's output.
    public var implicit: Bool?
}

public struct MotifStyle: Codable, Hashable, Identifiable {
    /// `kit/style`, e.g. `wallcast/prism-split`.
    public var id: String
    public var localId: String
    public var name: String
    public var blurb: String
    public var group: String
    public var tags: [String]
    public var palette: String?
    public var flash: Bool
    public var cost: Double
    public var passes: [MotifPass]
    public var inputs: [MotifInput]
    public var params: [MotifParam]

    public func param(_ key: String) -> MotifParam? { params.first { $0.key == key } }

    /// Defaults for every parameter.
    public var defaults: [String: MotifValue] { Dictionary(uniqueKeysWithValues: params.map { ($0.key, $0.def) }) }

    /// Float buffer for the fragment shader: one slot per parameter, ints and selects as indices, toggles as 0/1.
    /// Missing keys fall back to the default; select values may be option ids or indices.
    public func packParams(_ values: [String: MotifValue]) -> [Float] {
        var out = [Float](repeating: 0, count: Swift.max(1, params.count))
        for p in params {
            let v = values[p.key] ?? p.def
            switch p.type {
            case .range: out[p.index] = Float(v.doubleValue)
            case .int: out[p.index] = Float(v.doubleValue.rounded())
            case .toggle: out[p.index] = v.doubleValue != 0 ? 1 : 0
            case .select:
                if case .string(let s) = v { out[p.index] = Float(Swift.max(0, p.options?.firstIndex { $0.v == s } ?? 0)) }
                else { out[p.index] = Float(Swift.max(0, v.doubleValue.rounded())) }
            }
        }
        return out
    }

    /// Whether a control would be shown in the web inspector given the current values.
    public func isVisible(_ p: MotifParam, values: [String: MotifValue]) -> Bool {
        guard let s = p.show, let ctl = param(s.param) else { return true }
        return s.matches(values[ctl.key] ?? ctl.def)
    }
}

public struct MotifPalette: Codable, Hashable, Identifiable {
    public var id: String
    public var name: String
    public var bg: String
    public var ink: String
    public var a: [String]

    public init(id: String, name: String, bg: String, ink: String, a: [String]) {
        self.id = id; self.name = name; self.bg = bg; self.ink = ink; self.a = a
    }

    public static let fallback = MotifPalette(id: "default", name: "Night", bg: "#05060A", ink: "#F2F5FF", a: ["#35E0FF", "#FF3D9A", "#FFB547"])

    /// sRGB hex → linear RGB, exactly as the web runtime does.
    public static func linear(_ hex: String) -> SIMD3<Float> {
        let n = UInt32(hex.replacingOccurrences(of: "#", with: "").prefix(6), radix: 16) ?? 0
        func ch(_ v: UInt32) -> Float { let c = Float(v & 255) / 255; return c <= 0.04045 ? c / 12.92 : powf((c + 0.055) / 1.055, 2.4) }
        return SIMD3<Float>(ch(n >> 16), ch(n >> 8), ch(n))
    }
}

/// A converted kit: styles, parameters, palettes and the Metal source for every pass.
public struct MotifKitDefinition {
    public let id: String
    public let name: String
    public let version: String
    public let author: String
    public let summary: String
    public let accent: String?
    public let palettes: [MotifPalette]
    public let styles: [MotifStyle]
    /// Metal source per pass, keyed by `MotifPass.source`.
    public let sources: [String: String]

    private struct Payload: Decodable {
        var id: String
        var name: String
        var version: String
        var author: String?
        var description: String?
        var accent: String?
        var palettes: [MotifPalette]
        var styles: [MotifStyle]
    }

    public init(json: Data, sources: [String: String]) throws {
        let p = try JSONDecoder().decode(Payload.self, from: json)
        id = p.id; name = p.name; version = p.version
        author = p.author ?? ""; summary = p.description ?? ""; accent = p.accent
        palettes = p.palettes; styles = p.styles
        self.sources = sources
    }

    /// Loads a `.metalkit` file written by `motif-metal convert`: the kit and all its Metal source in one JSON file,
    /// so kits can be shipped or downloaded without rebuilding the app.
    public init(metalKit data: Data) throws {
        struct Wrapper: Decodable { var kit: Payload; var sources: [String: String] }
        let w = try JSONDecoder().decode(Wrapper.self, from: data)
        id = w.kit.id; name = w.kit.name; version = w.kit.version
        author = w.kit.author ?? ""; summary = w.kit.description ?? ""; accent = w.kit.accent
        palettes = w.kit.palettes; styles = w.kit.styles
        sources = w.sources
    }

    public init(contentsOf url: URL) throws { try self.init(metalKit: Data(contentsOf: url)) }

    /// Looks a style up by `kit/style` or by its local id.
    public func style(_ id: String) -> MotifStyle? {
        styles.first { $0.id == id } ?? styles.first { $0.localId == id }
    }

    /// The palette a layer switching into this style would take: an explicit id, else the style's own, else the first.
    public func palette(for style: MotifStyle, id: String? = nil) -> MotifPalette {
        if let id = id, let p = palettes.first(where: { $0.id == id }) { return p }
        if let id = style.palette, let p = palettes.first(where: { $0.id == id }) { return p }
        return palettes.first ?? .fallback
    }
}
