import SwiftUI

/// The Live Activity's agents as the Agents widget lists them: each tab's title in
/// its state's tone, its mark and its time on the right. The project sits above in
/// small grey, once for consecutive tabs of the same project. Three fit the Lock
/// Screen's 160 points; the most urgent come first.
struct AgentLiveList: View {
    static let limit = 3

    let agents: [LiveSnapshot.Agent]

    var body: some View {
        let shown = Array(agents.prefix(Self.limit))
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, agent in
                let sameProject = index > 0 && shown[index - 1].project == agent.project
                if !sameProject { Divider().overlay(Color.white.opacity(0.12)) }
                AgentLiveRow(agent: agent, showsProject: !sameProject)
            }
        }
    }
}

private struct AgentLiveRow: View {
    let agent: LiveSnapshot.Agent
    let showsProject: Bool

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                if showsProject {
                    Text(agent.projectName)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text(agent.tabName)
                    .font(.system(size: 16, weight: .semibold))
                    .lineLimit(1)
                    .agentWidgetTone(agent.agentState)
            }
            Spacer(minLength: 8)
            AgentStateMark(state: agent.agentState, size: 13)
                .frame(width: 18)
            AgentLiveElapsed(agent: agent)
                .font(.system(size: 16))
                .foregroundStyle(.secondary)
                .frame(width: 66, alignment: .trailing)
        }
        .padding(.vertical, 2)
    }
}
