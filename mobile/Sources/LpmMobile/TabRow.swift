import SwiftUI

/// One terminal tab in the project's list: its name (with the tab's emoji) and,
/// when an agent reports, its state and how long it has been so on the trailing
/// edge. Tapping opens the terminal; the desktop's tab actions live on swipe
/// gestures (Pin from the leading edge; Rename / Close from the trailing edge).
struct TabRow: View {
    let term: TerminalInfo
    /// What the agent in this tab reports, nil for a plain shell.
    let agent: ProjectAgentRow?
    /// Unix millis, ticked by the list so a running reading stays live.
    let now: Int
    let onOpen: () -> Void

    private var title: String {
        term.emoji.isEmpty ? term.label : "\(term.emoji) \(term.label)"
    }

    private var elapsed: String? {
        guard let agent, let since = agent.since else { return nil }
        return shortDuration(millis: (agent.until ?? now) - since)
    }

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 8) {
                titleText
                if term.pinned {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                Spacer(minLength: 8)
                if term.remote {
                    Text("Remote")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color(.tertiarySystemFill), in: Capsule())
                }
                if let agent {
                    status(agent)
                }
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(agent.map { "\(term.label), \($0.state.label)" } ?? term.label)
    }

    /// The name sweeps while the work runs, as it does in the projects list.
    @ViewBuilder
    private var titleText: some View {
        let text = Text(title)
            .foregroundStyle(agent?.state == .working ? AnyShapeStyle(Color.blue) : AnyShapeStyle(.primary))
            .lineLimit(1)
        if agent?.state == .working {
            text.shimmer()
        } else {
            text
        }
    }

    private func status(_ agent: ProjectAgentRow) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(agent.state.tint)
                .frame(width: 7, height: 7)
            Text(agent.state.label)
                .foregroundStyle(agent.state.tint)
            if let elapsed {
                Text(elapsed)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .font(.subheadline)
        .lineLimit(1)
    }
}
