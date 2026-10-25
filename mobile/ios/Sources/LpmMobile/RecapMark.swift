import SwiftUI

/// lpm's mark and address, the recap card's signature: the app icon's lit dot
/// and two rings in a small tile, then "lpm.cx".
struct RecapMark: View {
    private typealias S = RecapCardStyle

    // The icon's own units: a 720-wide view box starting at 180.
    private static let origin: CGFloat = 180
    private static let size: CGFloat = 720
    private static let glyph: CGFloat = 17
    private static let dot = (x: CGFloat(349), y: CGFloat(349), r: CGFloat(159))
    private static let rings = [(x: CGFloat(734), y: CGFloat(452)), (x: CGFloat(452), y: CGFloat(733))]
    private static let ringRadius: CGFloat = 140
    private static let ringStroke: CGFloat = 44

    var body: some View {
        HStack(spacing: 8) {
            glyph
                .frame(width: 29, height: 29)
                .background(S.markGround, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(S.markBorder, lineWidth: 1))
            Text("lpm.cx")
                .font(.system(size: 14))
                .foregroundStyle(S.muted)
        }
        .fixedSize()
    }

    private var glyph: some View {
        let unit = Self.glyph / Self.size
        let at = { (v: CGFloat) in (v - Self.origin) * unit }
        return ZStack(alignment: .topLeading) {
            Circle()
                .fill(S.markDot)
                .frame(width: 2 * Self.dot.r * unit, height: 2 * Self.dot.r * unit)
                .position(x: at(Self.dot.x), y: at(Self.dot.y))
            ForEach(Self.rings.indices, id: \.self) { i in
                Circle()
                    .stroke(S.markRing, lineWidth: Self.ringStroke * unit)
                    .frame(width: 2 * Self.ringRadius * unit, height: 2 * Self.ringRadius * unit)
                    .position(x: at(Self.rings[i].x), y: at(Self.rings[i].y))
            }
        }
        .frame(width: Self.glyph, height: Self.glyph)
        .accessibilityHidden(true)
    }
}
