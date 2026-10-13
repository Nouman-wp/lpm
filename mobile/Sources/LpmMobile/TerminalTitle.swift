import SwiftUI

/// A terminal screen's title: the tab's name over what its agent is doing and for
/// how long — "Working 3m 5s", "Done took 4m 12s" — as the desktop's agent chip
/// reads it. The connection's status takes that line whenever the Mac isn't
/// connected; a plain shell has no line at all.
struct TerminalTitle: View {
    @Environment(AppModel.self) private var model
    let term: TerminalInfo

    private var agent: ProjectAgentRow? {
        guard let project = model.projects.first(where: { $0.name == term.project }) else { return nil }
        let rows = projectAgentRows(project, now: Int(Date().timeIntervalSince1970 * 1000), tabTitles: [:])
        guard let agent = agentRowsByTerminal(rows)[term.id], agent.state != .idle else { return nil }
        return agent
    }

    var body: some View {
        VStack(spacing: 1) {
            Text(term.label)
                .font(.headline)
                .lineLimit(1)
            if !model.demoMode && !model.link.isReady {
                LinkStatusLabel(line: model.link.statusLine)
            } else if let agent {
                HStack(spacing: 4) {
                    Text(agent.state.label)
                        .agentTone(agent.state)
                    if let since = agent.since {
                        Group {
                            if agent.until != nil { Text("took") }
                            ElapsedText(since: since, until: agent.until, precise: true)
                        }
                        .foregroundStyle(.secondary)
                    }
                }
                .font(.caption2.weight(.medium))
                .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
