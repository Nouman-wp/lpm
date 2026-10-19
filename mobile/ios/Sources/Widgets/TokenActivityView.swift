import SwiftUI
import WidgetKit

/// The Token activity widget: the range's tokens and estimated cost, a stacked bar
/// per day, and 7D / 14D / 30D pills. Small stacks the totals and moves the pills
/// under the bars.
struct TokenActivityView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TokenActivityEntry

    private var small: Bool { family == .systemSmall }

    var body: some View {
        Group {
            if let window = entry.window {
                if small {
                    VStack(alignment: .leading, spacing: 0) {
                        title
                        VStack(alignment: .leading, spacing: 0) {
                            figure(formatTokenCount(window.tokens), "tokens", in: window, tint: .primary)
                            figure(formatUsd(window.cost), "est.", in: window, tint: .tokenCost)
                        }
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.top, 4)
                        chart(window)
                            .frame(maxHeight: .infinity)
                            .padding(.vertical, 8)
                        HStack(spacing: 4) { pills }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        totals(window)
                            .padding(.top, 4)
                        Spacer(minLength: 6)
                        chart(window)
                            .frame(height: 58)
                        axis(window)
                            .padding(.top, 4)
                    }
                }
            } else {
                WidgetEmptyState(
                    symbol: "chart.bar.xaxis", tone: .action, title: "No numbers yet",
                    message: small ? "Open lpm to load it."
                        : "Open lpm while your Mac is connected to load your token use.",
                    hint: "Open lpm", small: small
                ) {
                    title
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.background, for: .widget)
    }

    private var title: some View {
        Text("Token activity")
            .font(.system(size: 13, weight: .semibold))
    }

    private var header: some View {
        HStack(spacing: 4) {
            title
            Spacer(minLength: 8)
            pills
        }
    }

    /// The range pills; small spreads them across the widget's width.
    private var pills: some View {
        ForEach(TokenActivityStore.ranges, id: \.self) { days in
            let picked = days == entry.range
            Button(intent: SelectTokenRangeIntent(days: days)) {
                Text("\(days)D")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(picked ? Color(.systemBackground) : .secondary)
                    .padding(.horizontal, small ? 0 : 8)
                    .frame(maxWidth: small ? .infinity : nil)
                    .frame(height: 22)
                    .background(Capsule().fill(picked ? Color.primary : Color.primary.opacity(0.08)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(days) days")
            .accessibilityAddTraits(picked ? .isSelected : [])
        }
    }

    /// The range's totals, held back to grey when it has none.
    private func totals(_ window: TokenActivityWindow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            figure(formatTokenCount(window.tokens), "tokens", in: window, tint: .primary)
            figure(formatUsd(window.cost), "est.", in: window, tint: .tokenCost)
                .padding(.leading, 8)
            Spacer(minLength: 4)
            if window.tokens > 0 && window.cost > 0 {
                Text("\(formatUsd(window.cost * 1_000_000 / Double(window.tokens))) / 1M")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    private func figure(_ value: String, _ unit: String, in window: TokenActivityWindow,
                        tint: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value)
                .font(.system(size: small ? 18 : 22, weight: .bold))
                .foregroundStyle(window.tokens == 0 ? Color.secondary : tint)
            Text(unit)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func chart(_ window: TokenActivityWindow) -> some View {
        if window.tokens > 0 {
            TokenActivityBars(days: window.days, small: small)
        } else {
            TokenActivityNone(window: window, small: small)
        }
    }

    private func axis(_ window: TokenActivityWindow) -> some View {
        HStack {
            Text(window.days.first.map { shortUsageDate($0.date) } ?? "")
                .foregroundStyle(.secondary)
            Spacer(minLength: 8)
            Text(window.endsToday ? "Today" : window.days.last.map { shortUsageDate($0.date) } ?? "")
                .fontWeight(window.endsToday ? .semibold : .regular)
                .foregroundStyle(window.endsToday ? .primary : .secondary)
        }
        .font(.system(size: 10))
        .accessibilityHidden(true)
    }
}

/// One stacked bar a day, Codex over Claude, scaled to the range's busiest day.
private struct TokenActivityBars: View {
    let days: [TokenActivityDay]
    let small: Bool

    private var gap: CGFloat {
        small ? (days.count > 20 ? 1 : days.count > 10 ? 3 : 6)
            : (days.count > 20 ? 2 : days.count > 10 ? 6 : 16)
    }

    var body: some View {
        GeometryReader { geo in
            let peak = Double(max(1, days.map(\.totalTokens).max() ?? 1))
            let height = { (tokens: Int) in CGFloat(Double(tokens) / peak) * (geo.size.height - 1) }
            HStack(alignment: .bottom, spacing: gap) {
                ForEach(days, id: \.date) { day in
                    VStack(spacing: day.claudeTokens > 0 && day.codexTokens > 0 ? 1 : 0) {
                        Rectangle().fill(Color.codex).frame(height: height(day.codexTokens))
                        Rectangle().fill(Color.claude).frame(height: height(day.claudeTokens))
                    }
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 2, topTrailingRadius: 2))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(.quaternary).frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        let busiest = days.max { $0.totalTokens < $1.totalTokens }
        guard let busiest, busiest.totalTokens > 0 else { return "No tokens in these \(days.count) days" }
        return "Tokens per day over \(days.count) days; busiest \(shortUsageDate(busiest.date)), "
            + "\(formatTokenCount(busiest.totalTokens)) for \(formatUsd(busiest.cost))"
    }
}

/// A range without a token: says so where the bars would stand, over a dashed baseline.
private struct TokenActivityNone: View {
    let window: TokenActivityWindow
    let small: Bool

    var body: some View {
        Text(window.endsToday ? "No tokens in the last \(window.days.count) days"
            : "No tokens in these \(window.days.count) days")
            .font(.system(size: small ? 11 : 12))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .bottom) {
                DashedLine()
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .foregroundStyle(.tertiary)
                    .frame(height: 1)
            }
    }
}

private struct DashedLine: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
    }
}

private extension Color {
    /// The cost figure's blue, darker on a light widget so it stays readable.
    static let tokenCost = Color.widget(light: (31, 111, 209), dark: (125, 183, 255))
}
