import Foundation
import WidgetKit

/// A plan window as the Usage widget keeps it: a `LimitWindow` with a missing
/// figure left out, as JSON has no not-a-number.
struct UsageWidgetWindow: Codable, Equatable {
    var usedPercent: Double?
    /// Unix SECONDS, stamped by the tool's own servers; 0 when it didn't say.
    var resetsAt: Int

    init(_ win: LimitWindow) {
        usedPercent = win.usedPercent.isFinite ? win.usedPercent : nil
        resetsAt = win.resetsAt
    }

    var limit: LimitWindow { LimitWindow(usedPercent: usedPercent ?? .nan, resetsAt: resetsAt) }
}

/// The "in use" / "pool" tag beside a Claude account's name.
enum UsageWidgetMark: String, Codable {
    case current, standby
}

/// One usage row as the Usage widget draws it: the projects list's row, with the
/// windows it's read from, so the countdowns and pace ticks keep moving after the
/// app has gone.
struct UsageWidgetRow: Codable, Equatable {
    var id: String
    var provider: String
    var label: String
    var mark: UsageWidgetMark?
    var weekly: UsageWidgetWindow?
    var fiveHour: UsageWidgetWindow?
    /// Today's spend, which stands in for a tool with no window.
    var tokens: Int
    /// Millis on the phone's clock the tool last reported at; nil when it never has.
    var updatedAt: Int?

    func reading(now: Double) -> UsageReading {
        UsageReading(weekly: weekly?.limit, fiveHour: fiveHour?.limit, now: now)
    }

    func stale(now: Double) -> Bool {
        updatedAt.map { now - Double($0) > staleMs } ?? false
    }
}

/// The usage rows of the Mac the app last had live.
struct UsageWidgetMac: Codable, Equatable {
    /// The Mac's server id, or its local id for a Mac too old to send one.
    var id: String
    var rows: [UsageWidgetRow]
    /// Millis the phone last had these rows live.
    var seenAt: Int? = nil
}

/// The Usage widget's data: a file in the app group the app writes while a Mac is
/// live, read by the widget. Each write asks the widget to redraw.
enum UsageWidgetStore {
    static let kind = "Usage"
    private static let appGroup = "group.cx.lpm.mobile"

    private static var url: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("usage-widget.json")
    }

    static func load() -> UsageWidgetMac? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(UsageWidgetMac.self, from: data)
    }

    /// Replace the rows with what the live Mac shows.
    static func publish(_ mac: UsageWidgetMac) {
        save(mac, confirming: false)
    }

    /// Publish, stamped as seen now even when nothing changed: the app is leaving a
    /// live Mac, so the rows it last showed still read as current.
    static func confirm(_ mac: UsageWidgetMac) {
        save(mac, confirming: true)
    }

    /// Forget the rows unless they're from one of these Macs.
    static func keep(_ macIds: Set<String>) {
        guard let saved = load(), !macIds.contains(saved.id), let url else { return }
        try? FileManager.default.removeItem(at: url)
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    private static func save(_ mac: UsageWidgetMac, confirming: Bool) {
        let saved = load()
        guard confirming || saved?.id != mac.id || saved?.rows != mac.rows else { return }
        var seen = mac
        seen.seenAt = Int(Date().timeIntervalSince1970 * 1000)
        guard let url, let data = try? JSONEncoder().encode(seen),
              (try? data.write(to: url, options: .atomic)) != nil
        else { return }
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }
}
