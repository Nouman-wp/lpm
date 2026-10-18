import SwiftUI

/// A terminal screen's title: the tab's name, how long its agent has been at it
/// above, and the project's uncommitted changes below. The connection's status
/// takes the top line whenever the Mac isn't connected. A line with nothing to say
/// keeps its room, so the name stays in the middle of the bar.
struct TerminalTitle: View {
    @Environment(AppModel.self) private var model
    let term: TerminalInfo
    /// The bar's middle, in global coordinates.
    let axis: CGFloat?

    private var offline: Bool { !model.demoMode && !model.link.isReady }

    private var agent: ProjectAgentRow? {
        guard let project = model.projects.first(where: { $0.name == term.project }) else { return nil }
        let rows = projectAgentRows(project, now: Int(Date().timeIntervalSince1970 * 1000), tabTitles: [:])
        guard let agent = agentRowsByTerminal(rows)[term.id], agent.state != .idle else { return nil }
        return agent
    }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                if offline {
                    TerminalConnectionLine(line: model.link.statusLine)
                } else if let agent, let since = agent.since {
                    TerminalAgentLine(state: agent.state, since: since, until: agent.until)
                }
            }
            .frame(height: TerminalTitleLine.height)
            Text(term.label)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(1)
                .frame(height: 20)
            TerminalChangesLine(project: term.project, stale: offline)
                .frame(height: TerminalTitleLine.height)
        }
        .accessibilityElement(children: .combine)
        .centeredOnBar(axis)
    }
}

enum TerminalTitleLine {
    static let height: CGFloat = 12
    static let font = Font.system(size: 10, weight: .semibold)
}

/// How long the agent has been at it, with its state named when that isn't plain
/// work, in the state's color when it wants a look.
private struct TerminalAgentLine: View {
    let state: AgentState
    let since: Int
    let until: Int?

    private var word: String? { state == .working ? nil : state.label }
    private var iconColor: Color { state == .working ? .secondary : state.tint }
    private var textColor: Color { state == .needsYou || state == .error ? state.tint : .secondary }

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "clock")
                .foregroundStyle(iconColor)
                .accessibilityHidden(true)
            if let word { Text("\(word) ·") }
            ElapsedText(since: since, until: until, precise: true)
        }
        .font(TerminalTitleLine.font)
        .foregroundStyle(textColor)
        .lineLimit(1)
    }
}

/// Why the Mac isn't connected, in place of the agent's line.
private struct TerminalConnectionLine: View {
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
        .font(TerminalTitleLine.font)
        .foregroundStyle(line.tone == .problem ? Color.red : Color.orange)
        .lineLimit(1)
    }
}
