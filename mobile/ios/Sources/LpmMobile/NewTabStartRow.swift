import SwiftUI

/// One way a new tab can start, a terminal or an agent, checked when picked.
struct NewTabStartRow: View {
    let label: String
    /// The agent's id; nil for the plain terminal.
    let agent: String?
    let picked: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            NewTabStartLabel(label: label, agent: agent, picked: picked)
        }
        .accessibilityAddTraits(picked ? .isSelected : [])
    }
}

/// A Start row's face: the agent's mark, its name, and a check when picked.
struct NewTabStartLabel: View {
    let label: String
    let agent: String?
    let picked: Bool

    var body: some View {
        HStack(spacing: 12) {
            icon
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
            Text(label)
                .foregroundStyle(Color.primary)
            Spacer()
            if picked {
                Image(systemName: "checkmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
    }

    /// The agent's own mark, as the desktop shows it; a terminal, or an agent without
    /// one, gets a symbol in the agent's colour.
    @ViewBuilder private var icon: some View {
        if let mark = agent.flatMap(AgentMark.init) {
            mark.frame(width: 20, height: 20)
        } else {
            Image(systemName: agent == nil ? "terminal" : "sparkle")
                .font(.system(size: 17))
                .foregroundStyle(agent.map { providerMeta($0).color } ?? .secondary)
        }
    }
}
