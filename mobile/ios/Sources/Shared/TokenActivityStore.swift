import Foundation
import WidgetKit

/// One day of agent usage as the Token activity widget draws it.
struct TokenActivityDay: Codable, Equatable {
    /// "YYYY-MM-DD", the Mac's calendar day.
    var date: String
    var claudeTokens: Int
    var codexTokens: Int
    /// Estimated USD, priced on the phone as the Stats screen prices it.
    var cost: Double

    var totalTokens: Int { claudeTokens + codexTokens }
}

/// What the app last read for the widget: every computer's days over the last 30,
/// as the active Mac counted them.
struct TokenActivitySnapshot: Codable, Equatable {
    /// When the Mac read them, unix millis; the last day shown is this one's.
    var generatedAt: Int
    /// The days that had usage, oldest first.
    var days: [TokenActivityDay]

    /// The `count` days ending on the read's day, empty ones filled in.
    func window(_ count: Int, now: Date = Date(), calendar: Calendar = .current) -> TokenActivityWindow {
        let byDate = Dictionary(days.map { ($0.date, $0) }) { _, last in last }
        let end = calendar.startOfDay(for: Date(timeIntervalSince1970: Double(generatedAt) / 1000))
        let shown = (0..<count).reversed().map { back -> TokenActivityDay in
            let key = usageDateKey(calendar.date(byAdding: .day, value: -back, to: end) ?? end, calendar: calendar)
            return byDate[key] ?? TokenActivityDay(date: key, claudeTokens: 0, codexTokens: 0, cost: 0)
        }
        return TokenActivityWindow(days: shown, endsToday: calendar.isDate(end, inSameDayAs: now))
    }
}

struct TokenActivityWindow: Equatable {
    var days: [TokenActivityDay]
    /// False once the read is a day or more old: the last bar is then dated.
    var endsToday: Bool

    var tokens: Int { days.reduce(0) { $0 + $1.totalTokens } }
    var cost: Double { days.reduce(0) { $0 + $1.cost } }
}

/// The Token activity widget's data: a file in the app group the app writes after
/// reading the Mac, and the range the widget's pills last picked.
enum TokenActivityStore {
    static let kind = "TokenActivity"
    static let ranges = [7, 14, 30]
    private static let appGroup = "group.cx.lpm.mobile"
    private static let rangeKey = "tokenActivity.range"

    private static var url: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("token-activity.json")
    }

    static func load() -> TokenActivitySnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(TokenActivitySnapshot.self, from: data)
    }

    static func save(_ snapshot: TokenActivitySnapshot) {
        guard let url, let data = try? JSONEncoder().encode(snapshot),
              (try? data.write(to: url, options: .atomic)) != nil
        else { return }
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    /// Days the widget shows: 7 until a pill picks another.
    static var range: Int {
        get {
            let saved = UserDefaults(suiteName: appGroup)?.integer(forKey: rangeKey) ?? 0
            return ranges.contains(saved) ? saved : ranges[0]
        }
        set { UserDefaults(suiteName: appGroup)?.set(newValue, forKey: rangeKey) }
    }
}
