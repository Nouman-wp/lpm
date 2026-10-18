import SwiftUI

/// A title in the bar, read alike on a project's screen and its terminals': `top`
/// above the name, and the project's uncommitted changes below. A line with nothing
/// to say keeps its room, so the name stays in the middle of the bar.
struct BarTitle<Top: View>: View {
    let name: String
    let project: String
    /// The Mac is away, so the changes shown may have moved on since.
    let stale: Bool
    /// The bar's middle, in global coordinates.
    let axis: CGFloat?
    @ViewBuilder let top: Top

    var body: some View {
        VStack(spacing: 0) {
            ZStack { top }
                .frame(height: BarTitleLine.height)
            Text(name)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(1)
                .frame(height: 20)
            ChangesLine(project: project, stale: stale)
                .frame(height: BarTitleLine.height)
        }
        .accessibilityElement(children: .combine)
        .centeredOnBar(axis)
    }
}

enum BarTitleLine {
    static let height: CGFloat = 12
    static let font = Font.system(size: 10, weight: .semibold)
}

/// Why the Mac isn't connected, on a bar title's top line.
struct BarConnectionLine: View {
    let line: LinkStatusLine

    private var symbol: String {
        if line.pulse { return "arrow.triangle.2.circlepath" }
        return line.tone == .problem ? "exclamationmark.circle" : "moon"
    }

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: symbol)
                .symbolEffect(.pulse, isActive: line.pulse)
                .accessibilityHidden(true)
            Text(line.text)
        }
        .font(BarTitleLine.font)
        .foregroundStyle(line.tone == .problem ? Color.red : Color.orange)
        .lineLimit(1)
    }
}
