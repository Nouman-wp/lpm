import SwiftUI
import WidgetKit

/// The Live Activity on the Lock Screen: the Mac's name, then its agents as the
/// Agents widget draws them. No counts — the rows say it.
struct AgentLiveLockScreen: View {
    let macName: String
    let snapshot: LiveSnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(macName)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(1)
            if let agents = snapshot?.agents, !agents.isEmpty {
                AgentLiveList(agents: agents)
            } else {
                Text("Agents at work")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .environment(\.colorScheme, .dark)
    }
}
