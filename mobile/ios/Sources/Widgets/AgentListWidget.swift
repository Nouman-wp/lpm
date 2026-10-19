import SwiftUI
import WidgetKit

@main
struct LpmWidgets: WidgetBundle {
    var body: some Widget {
        AgentListWidget()
        UsageWidget()
        TokenActivityWidget()
    }
}

/// Every agent tab on the phone's Macs — tab title, what its agent is doing and
/// for how long — in the colors the app gives them.
struct AgentListWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: AgentWidgetStore.kind, provider: AgentListProvider()) {
            AgentListView(entry: $0)
        }
        .configurationDisplayName("Agents")
        .description("Your agents' tabs: who needs you, who's working, and for how long.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct AgentListEntry: TimelineEntry {
    let date: Date
    let macs: [AgentWidgetMac]
    let items: [AgentWidgetItem]
}

struct AgentListProvider: TimelineProvider {
    func placeholder(in context: Context) -> AgentListEntry {
        AgentListEntry(date: Date(), macs: [], items: Self.sample())
    }

    func getSnapshot(in context: Context, completion: @escaping (AgentListEntry) -> Void) {
        let macs = AgentWidgetStore.load()
        let items = AgentWidgetStore.items(macs)
        completion(AgentListEntry(date: Date(), macs: macs,
                                  items: items.isEmpty && context.isPreview ? Self.sample() : items))
    }

    /// A reading a minute for the next hour while something is still counting, or
    /// while a quiet list says how long ago it was updated, then a fresh read; any
    /// other list waits for the next write.
    func getTimeline(in context: Context, completion: @escaping (Timeline<AgentListEntry>) -> Void) {
        let macs = AgentWidgetStore.load()
        let items = AgentWidgetStore.items(macs)
        let start = Date()
        let counting = items.contains { $0.row.since != nil && $0.row.until == nil }
        let aging = items.isEmpty && macs.contains { $0.seenAt != nil }
        guard counting || aging else {
            completion(Timeline(entries: [AgentListEntry(date: start, macs: macs, items: items)], policy: .never))
            return
        }
        let entries = (0...60).map {
            AgentListEntry(date: start.addingTimeInterval(Double($0) * 60), macs: macs, items: items)
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    /// The gallery's preview: Demo Mode's agents.
    private static func sample() -> [AgentWidgetItem] {
        let now = Int(Date().timeIntervalSince1970 * 1000)
        let minute = 60_000
        func item(_ title: String, _ state: AgentState, since: Int, until: Int? = nil) -> AgentWidgetItem {
            AgentWidgetItem(macId: "", row: AgentWidgetRow(project: "", key: title, title: title, state: state,
                                                           since: since, until: until))
        }
        return [
            item("Migrate cart store to Zustand", .needsYou, since: now - 26 * minute),
            item("Write e2e tests for coupons", .working, since: now - 42 * minute),
            item("Add Apple Pay to checkout", .working, since: now - 18 * minute),
            item("Cart badge not updating", .done, since: now - 30 * minute, until: now - 24 * minute),
        ]
    }
}
