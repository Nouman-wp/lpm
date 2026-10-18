import AppIntents
import SwiftUI
import WidgetKit

/// Tokens and estimated cost over the last 7, 14 or 30 days, Claude and Codex
/// stacked per day, with pills that switch the range in place.
struct TokenActivityWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TokenActivityStore.kind, provider: TokenActivityProvider()) {
            TokenActivityView(entry: $0)
        }
        .configurationDisplayName("Token activity")
        .description("Tokens and estimated cost over the last 7, 14 or 30 days.")
        .supportedFamilies([.systemMedium])
    }
}

struct TokenActivityEntry: TimelineEntry {
    let date: Date
    let range: Int
    /// Nil until the app has read the Mac for the widget.
    let window: TokenActivityWindow?
}

struct TokenActivityProvider: TimelineProvider {
    func placeholder(in context: Context) -> TokenActivityEntry {
        entry(Self.sample(), now: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (TokenActivityEntry) -> Void) {
        let saved = TokenActivityStore.load()
        completion(entry(saved ?? (context.isPreview ? Self.sample() : nil), now: Date()))
    }

    /// Redrawn when the app writes new numbers or a pill is tapped, and at
    /// midnight, when the last bar stops being today.
    func getTimeline(in context: Context, completion: @escaping (Timeline<TokenActivityEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0),
                                                 matchingPolicy: .nextTime) ?? now.addingTimeInterval(86_400)
        completion(Timeline(entries: [entry(TokenActivityStore.load(), now: now)], policy: .after(midnight)))
    }

    private func entry(_ snapshot: TokenActivitySnapshot?, now: Date) -> TokenActivityEntry {
        let range = TokenActivityStore.range
        return TokenActivityEntry(date: now, range: range, window: snapshot?.window(range, now: now))
    }

    /// The gallery's preview: a month of a busy week-day rhythm, ending today.
    private static func sample() -> TokenActivitySnapshot {
        let claude = [14.1, 8.2, 21.7, 26.3, 19.8, 30.2, 24.9, 7.1, 4.8, 22.6, 28.4, 25.1, 33.6, 20.3, 8.9,
                      5.5, 18.2, 24.6, 31.4, 22.8, 38.1, 9.6, 6.2, 27.3, 35.9, 41.2, 29.7, 44.8, 12.4, 15.1]
        let codex = [2.2, 0.6, 3.9, 5.1, 3.3, 6.4, 4.7, 0.4, 0, 4.8, 6.1, 5.6, 7.9, 3.8, 1.1,
                     0.3, 4.1, 6.8, 9.2, 5.4, 11.6, 1.2, 0, 7.9, 10.4, 12.8, 8.3, 14.6, 2.9, 3.7]
        let cost = [13.86, 8.37, 20.95, 27.19, 20.56, 29.04, 25.36, 7.76, 4.75, 22.88, 29.80, 26.01, 33.88, 21.82,
                    9.89, 5.52, 18.19, 27.15, 33.70, 27.26, 39.08, 11.52, 5.89, 29.67, 40.05, 44.93, 49.69, 49.52,
                    17.23, 17.31]
        let now = Date()
        let today = Calendar.current.startOfDay(for: now)
        let days = claude.indices.map { i in
            let day = Calendar.current.date(byAdding: .day, value: i - (claude.count - 1), to: today) ?? today
            return TokenActivityDay(date: usageDateKey(day), claudeTokens: Int(claude[i] * 1_000_000),
                                    codexTokens: Int(codex[i] * 1_000_000), cost: cost[i])
        }
        return TokenActivitySnapshot(generatedAt: Int(now.timeIntervalSince1970 * 1000), days: days)
    }
}

/// A range pill: the widget shows that many days. Runs in the widget, so the app
/// stays closed.
struct SelectTokenRangeIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Token Activity Range"
    static let isDiscoverable = false

    @Parameter(title: "Days") var days: Int

    init() {}

    init(days: Int) {
        self.days = days
    }

    func perform() async throws -> some IntentResult {
        TokenActivityStore.range = days
        return .result()
    }
}
