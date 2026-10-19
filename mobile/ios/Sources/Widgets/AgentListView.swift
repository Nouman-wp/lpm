import SwiftUI
import WidgetKit

/// The Agents widget: a header, then up to four agent tabs, most urgent first.
/// Small opens the top agent's terminal; medium opens whichever row is tapped.
/// It's a dark card in light mode too, so the state colors read the same on any
/// Home Screen.
struct AgentListView: View {
    @Environment(\.widgetFamily) private var family
    let entry: AgentListEntry

    private static let card = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)

    private var small: Bool { family == .systemSmall }
    private var now: Int { Int(entry.date.timeIntervalSince1970 * 1000) }
    private var shown: [AgentWidgetItem] { Array(entry.items.prefix(4)) }

    var body: some View {
        Group {
            if entry.items.isEmpty {
                AgentListEmpty(macs: entry.macs, now: now, small: small)
            } else {
                VStack(alignment: .leading, spacing: small ? 8 : 6) {
                    header
                    VStack(spacing: 0) {
                        ForEach(Array(shown.enumerated()), id: \.offset) { index, item in
                            if !small && index > 0 { Divider() }
                            row(item)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.colorScheme, .dark)
        .widgetURL(small ? shown.first.flatMap(link) : nil)
        .containerBackground(Self.card, for: .widget)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Agents").font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 0)
            if small {
                Text("\(entry.items.count)")
                    .font(.system(size: 12))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            } else {
                summary.font(.system(size: 12, weight: .semibold)).lineLimit(1)
            }
        }
    }

    /// "3 need you · 4 running · 3 done", each count in its state's color.
    private var summary: Text {
        let count = { (state: AgentState) in entry.items.filter { $0.row.state == state }.count }
        var parts: [Text] = []
        if count(.needsYou) > 0 {
            parts.append(Text("\(count(.needsYou)) need you").foregroundStyle(AgentState.needsYou.tint))
        }
        if count(.error) > 0 {
            let words = count(.error) == 1 ? "1 problem" : "\(count(.error)) problems"
            parts.append(Text(words).foregroundStyle(AgentState.error.tint))
        }
        if count(.working) > 0 {
            parts.append(Text("\(count(.working)) running").foregroundStyle(AgentSweep.still))
        }
        if count(.done) > 0 {
            parts.append(Text("\(count(.done)) done").foregroundStyle(AgentState.done.tint))
        }
        let separator = Text(" · ").fontWeight(.regular).foregroundStyle(.secondary)
        guard var line = parts.first else { return Text("") }
        for part in parts.dropFirst() { line = line + separator + part }
        return line
    }

    @ViewBuilder
    private func row(_ item: AgentWidgetItem) -> some View {
        let line = AgentWidgetLine(row: item.row, now: now, small: small)
        if !small, let url = link(item) {
            Link(destination: url) { line }
        } else {
            line
        }
    }

    private func link(_ item: AgentWidgetItem) -> URL? {
        guard !item.macId.isEmpty else { return nil }
        return AgentWidgetLink.url(macId: item.macId, project: item.row.project, terminalId: item.row.terminalId)
    }
}

/// One agent tab, as the projects list draws it: the tab's name in its state's
/// color, then the state's mark and how long the agent has been at it.
private struct AgentWidgetLine: View {
    let row: AgentWidgetRow
    let now: Int
    let small: Bool

    var body: some View {
        HStack(spacing: small ? 6 : 10) {
            Text(row.title)
                .font(.system(size: small ? 12 : 14, weight: .semibold))
                .lineLimit(1)
                .agentWidgetTone(row.state)
            Spacer(minLength: 0)
            HStack(spacing: small ? 3 : 4) {
                mark.frame(width: small ? 13 : 18)
                if let elapsed = row.elapsed(now: now) {
                    Text(elapsed)
                        .font(.system(size: small ? 12 : 14))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            .fixedSize()
        }
        // As tall as the design where four rows fit, shorter on a smaller widget.
        .frame(maxHeight: small ? 26 : 28)
    }

    /// A bell while it waits on you, an alert for a problem, a check once done.
    /// Working says so through the name alone, and keeps the slot so times line up.
    @ViewBuilder
    private var mark: some View {
        let symbol: String? = switch row.state {
        case .needsYou: "bell.fill"
        case .error: "exclamationmark.circle.fill"
        case .done: "checkmark"
        case .working, .idle: nil
        }
        if let symbol {
            Image(systemName: symbol)
                .font(.system(size: small ? 11 : 13, weight: .semibold))
                .foregroundStyle(row.state.tint)
        }
    }
}

private extension View {
    /// The app's tones held still, as a widget can't animate: the working sweep at
    /// its start, orange for a wait, red for a problem, blue once done.
    @ViewBuilder
    func agentWidgetTone(_ state: AgentState) -> some View {
        switch state {
        case .working: foregroundStyle(AgentSweep.still)
        case .needsYou, .error, .done: foregroundStyle(state.tint)
        case .idle: self
        }
    }
}
