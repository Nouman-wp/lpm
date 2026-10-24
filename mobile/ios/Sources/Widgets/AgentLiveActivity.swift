import ActivityKit
import SwiftUI
import WidgetKit

/// One Mac's agents at work, on the Lock Screen and in the Dynamic Island. The
/// content arrives sealed — from the Mac through the relay, or from the app — and
/// is opened here with the push key the app shares with its extensions.
struct AgentLiveActivity: Widget {
    private static let card = Color(red: 30 / 255, green: 30 / 255, blue: 32 / 255).opacity(0.94)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AgentActivityAttributes.self) { context in
            let snapshot = LiveSnapshot.open(blob: context.state.blob)
            AgentLiveLockScreen(macName: context.attributes.macName, snapshot: snapshot)
                .activityBackgroundTint(Self.card)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(link(snapshot?.lead, context.attributes))
        } dynamicIsland: { context in
            let snapshot = LiveSnapshot.open(blob: context.state.blob)
            let lead = snapshot?.lead
            return DynamicIsland {
                DynamicIslandExpandedRegion(.bottom) {
                    AgentLiveLockScreen(macName: context.attributes.macName, snapshot: snapshot)
                        .padding(.horizontal, -8)
                }
            } compactLeading: {
                if let lead {
                    HStack(spacing: 4) {
                        AgentStateMark(state: lead.agentState, size: 11)
                        Text(lead.tabName)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                            .agentWidgetTone(lead.agentState)
                    }
                    .frame(maxWidth: 110, alignment: .leading)
                }
            } compactTrailing: {
                if let lead {
                    AgentLiveElapsed(agent: lead)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .frame(width: 44, alignment: .trailing)
                }
            } minimal: {
                if let lead, lead.agentState != .working {
                    AgentStateMark(state: lead.agentState, size: 12)
                } else {
                    Circle().fill(AgentSweep.still).frame(width: 9, height: 9)
                }
            }
            .widgetURL(link(lead, context.attributes))
        }
    }

    private func link(_ lead: LiveSnapshot.Agent?, _ attributes: AgentActivityAttributes) -> URL? {
        guard let lead else { return nil }
        return AgentWidgetLink.url(macId: attributes.serverId, project: lead.project,
                                   terminalId: lead.terminalId.isEmpty ? nil : lead.terminalId)
    }
}
