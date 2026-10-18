import SwiftUI
import WidgetKit

/// The Token activity widget: the range's tokens and estimated cost, a stacked bar
/// per day, and 7D / 14D / 30D pills.
struct TokenActivityView: View {
    let entry: TokenActivityEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if let window = entry.window {
                totals(window)
                    .padding(.top, 4)
                Spacer(minLength: 6)
                TokenActivityBars(days: window.days)
                    .frame(height: 58)
                axis(window)
                    .padding(.top, 4)
            } else {
                Spacer(minLength: 0)
                Text("Open lpm to load token activity.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.background, for: .widget)
    }

    private var header: some View {
        HStack(spacing: 4) {
            Text("Token activity")
                .font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 8)
            ForEach(TokenActivityStore.ranges, id: \.self) { days in
                let picked = days == entry.range
                Button(intent: SelectTokenRangeIntent(days: days)) {
                    Text("\(days)D")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(picked ? Color(.systemBackground) : .secondary)
                        .padding(.horizontal, 8)
                        .frame(height: 22)
                        .background(Capsule().fill(picked ? Color.primary : Color.primary.opacity(0.08)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(days) days")
                .accessibilityAddTraits(picked ? .isSelected : [])
            }
        }
    }

    private func totals(_ window: TokenActivityWindow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(formatTokenCount(window.tokens))
                .font(.system(size: 22, weight: .bold))
            Text("tokens")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Text(formatUsd(window.cost))
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.tokenCost)
                .padding(.leading, 8)
            Text("est.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
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

    private var gap: CGFloat {
        days.count > 20 ? 2 : days.count > 10 ? 6 : 16
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

private extension Color {
    static let claude = Color(red: 217 / 255, green: 119 / 255, blue: 87 / 255)
    static let codex = Color(red: 16 / 255, green: 163 / 255, blue: 127 / 255)
    /// The cost figure's blue, darker on a light widget so it stays readable.
    static let tokenCost = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 125 / 255, green: 183 / 255, blue: 1, alpha: 1)
            : UIColor(red: 31 / 255, green: 111 / 255, blue: 209 / 255, alpha: 1)
    })
}
