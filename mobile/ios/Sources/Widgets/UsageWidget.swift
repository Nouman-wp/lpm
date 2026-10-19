import SwiftUI
import WidgetKit

/// How much of each agent's plan window is gone and when it comes back, as the
/// projects list's usage rows show it.
struct UsageWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: UsageWidgetStore.kind, provider: UsageProvider()) {
            UsageWidgetView(entry: $0)
        }
        .configurationDisplayName("Usage")
        .description("How much of each agent's plan is used, and when it resets.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct UsageEntry: TimelineEntry {
    let date: Date
    /// Nil until the app has had a Mac's meters live.
    let mac: UsageWidgetMac?
}

struct UsageProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsageEntry {
        UsageEntry(date: Date(), mac: Self.sample())
    }

    func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
        let saved = UsageWidgetStore.load()
        completion(UsageEntry(date: Date(), mac: saved ?? (context.isPreview ? Self.sample() : nil)))
    }

    /// A reading a minute for the next hour, so the countdowns, the pace ticks and
    /// a reading going stale keep moving, then a fresh read; with nothing to show,
    /// it waits for the app's next write.
    func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
        let mac = UsageWidgetStore.load()
        let start = Date()
        guard let mac, !mac.rows.isEmpty else {
            completion(Timeline(entries: [UsageEntry(date: start, mac: mac)], policy: .never))
            return
        }
        let entries = (0...60).map { UsageEntry(date: start.addingTimeInterval(Double($0) * 60), mac: mac) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    /// The gallery's preview: Demo Mode's meters.
    private static func sample() -> UsageWidgetMac {
        let now = Date().timeIntervalSince1970
        let hour = 3_600.0
        let day = 86_400.0
        func window(_ used: Double, resetsIn: Double) -> UsageWidgetWindow {
            UsageWidgetWindow(LimitWindow(usedPercent: used, resetsAt: Int(now + resetsIn)))
        }
        let updated = Int(now * 1000) - 90_000
        return UsageWidgetMac(id: "", rows: [
            UsageWidgetRow(id: "claude:work", provider: "claude", label: "Work", mark: .standby,
                           weekly: window(11, resetsIn: 4 * day + 10 * hour),
                           fiveHour: window(34, resetsIn: 2 * hour + 600), tokens: 0, updatedAt: updated),
            UsageWidgetRow(id: "claude:default", provider: "claude", label: "Claude", mark: .current,
                           weekly: window(27, resetsIn: 4 * day), fiveHour: window(62, resetsIn: 3 * hour),
                           tokens: 0, updatedAt: updated),
            UsageWidgetRow(id: "codex", provider: "codex", label: "Codex",
                           weekly: window(96, resetsIn: 2 * day + 10 * hour),
                           fiveHour: window(19, resetsIn: 4 * hour), tokens: 0, updatedAt: updated),
        ], seenAt: Int(now * 1000))
    }
}
