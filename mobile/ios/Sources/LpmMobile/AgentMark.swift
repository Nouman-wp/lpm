import SwiftUI

/// An agent's own mark, as the desktop draws it (AgentGlyph.tsx): Claude's spark,
/// Codex's >_ in a hexagon, Gemini's sparkle and OpenCode's square, with no tile.
struct AgentMark: View {
    private enum Kind { case claude, codex, gemini, opencode }

    private let kind: Kind

    /// nil for an agent without a mark of its own.
    init?(_ agent: String) {
        switch agent {
        case "claude": kind = .claude
        case "codex": kind = .codex
        case "gemini": kind = .gemini
        case "opencode": kind = .opencode
        default: return nil
        }
    }

    var body: some View {
        switch kind {
        case .claude:
            Mark24(draw: Self.claudeSpark).fill(providerMeta("claude").color)
        case .codex:
            Mark24(stroke: 2, draw: Self.codexPrompt).fill(providerMeta("codex").color)
        case .gemini:
            Mark24(draw: Self.geminiSparkle).fill(
                LinearGradient(
                    stops: [
                        .init(color: Color(hex: "#4796E3"), location: 0),
                        .init(color: Color(hex: "#9177C7"), location: 0.55),
                        .init(color: Color(hex: "#CA6673"), location: 1),
                    ],
                    startPoint: UnitPoint(x: 2 / 24, y: 22 / 24),
                    endPoint: UnitPoint(x: 22 / 24, y: 2 / 24)
                )
            )
        case .opencode:
            ZStack {
                Mark24 { p in
                    p.addRect(CGRect(x: 4, y: 3, width: 16, height: 18))
                    p.addRect(CGRect(x: 8, y: 7, width: 8, height: 10))
                }
                .fill(Color.primary, style: FillStyle(eoFill: true))
                Mark24 { p in p.addRect(CGRect(x: 8, y: 12, width: 8, height: 5)) }
                    .fill(Color.primary.opacity(0.45))
            }
        }
    }

    /// Ten tapered rays with round tips, the same numbers the desktop's path was drawn from.
    private static func claudeSpark(_ p: inout Path) {
        let rays: [(length: CGFloat, turn: Double)] = [
            (10.4, 0), (8.8, 4), (10.0, -3), (8.6, 3), (10.3, -2),
            (9.0, 2), (9.8, -4), (8.6, 1), (10.2, 3), (8.8, -2),
        ]
        for (i, ray) in rays.enumerated() {
            let angle = (-90 + Double(i) * 36 + ray.turn) * .pi / 180
            let u = CGPoint(x: cos(angle), y: sin(angle))
            let n = CGPoint(x: -u.y, y: u.x)
            let tip = CGPoint(x: 12 + u.x * ray.length, y: 12 + u.y * ray.length)
            p.move(to: CGPoint(x: 12 + n.x * 1.9, y: 12 + n.y * 1.9))
            p.addLine(to: CGPoint(x: tip.x + n.x * 1.3, y: tip.y + n.y * 1.3))
            p.addRelativeArc(center: tip, radius: 1.3, startAngle: .radians(atan2(n.y, n.x)), delta: .radians(-.pi))
            p.addLine(to: CGPoint(x: 12 - n.x * 1.9, y: 12 - n.y * 1.9))
            p.closeSubpath()
        }
    }

    private static func codexPrompt(_ p: inout Path) {
        p.addLines([
            CGPoint(x: 12, y: 1.8), CGPoint(x: 20.83, y: 6.9), CGPoint(x: 20.83, y: 17.1),
            CGPoint(x: 12, y: 22.2), CGPoint(x: 3.17, y: 17.1), CGPoint(x: 3.17, y: 6.9),
        ])
        p.closeSubpath()
        p.addLines([CGPoint(x: 8.2, y: 9.2), CGPoint(x: 11, y: 12), CGPoint(x: 8.2, y: 14.8)])
        p.addLines([CGPoint(x: 12.6, y: 14.8), CGPoint(x: 16, y: 14.8)])
    }

    private static func geminiSparkle(_ p: inout Path) {
        p.move(to: CGPoint(x: 12, y: 2))
        p.addCurve(to: CGPoint(x: 22, y: 12), control1: CGPoint(x: 12.6, y: 7.2), control2: CGPoint(x: 16.8, y: 11.4))
        p.addCurve(to: CGPoint(x: 12, y: 22), control1: CGPoint(x: 16.8, y: 12.6), control2: CGPoint(x: 12.6, y: 16.8))
        p.addCurve(to: CGPoint(x: 2, y: 12), control1: CGPoint(x: 11.4, y: 16.8), control2: CGPoint(x: 7.2, y: 12.6))
        p.addCurve(to: CGPoint(x: 12, y: 2), control1: CGPoint(x: 7.2, y: 11.4), control2: CGPoint(x: 11.4, y: 7.2))
        p.closeSubpath()
    }
}

/// A path drawn on a 24-point grid, scaled to fit; a stroked one is filled as its outline.
private struct Mark24: Shape {
    var stroke: CGFloat?
    let draw: @Sendable (inout Path) -> Void

    func path(in rect: CGRect) -> Path {
        var p = Path()
        draw(&p)
        if let stroke {
            p = p.strokedPath(StrokeStyle(lineWidth: stroke, lineCap: .round, lineJoin: .round))
        }
        let s = min(rect.width, rect.height) / 24
        return p.applying(CGAffineTransform(translationX: rect.midX - 12 * s, y: rect.midY - 12 * s).scaledBy(x: s, y: s))
    }
}
