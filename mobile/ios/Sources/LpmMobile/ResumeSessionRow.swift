import SwiftUI

/// One past conversation: its title (marked when a tab already holds it) over
/// the agent, account, branch, when it last ran and how it opened.
struct ResumeSessionRow: View {
    let session: AgentSession
    let onOpen: () -> Void

    private var provider: ProviderMeta { providerMeta(session.provider) }

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(session.title)
                        .lineLimit(1)
                    if session.openIn != nil {
                        Text("In a tab")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.green)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.green.opacity(0.15), in: Capsule())
                            .fixedSize()
                    }
                    Spacer(minLength: 0)
                }
                HStack(spacing: 5) {
                    Circle()
                        .fill(provider.color)
                        .frame(width: 7, height: 7)
                    details
                        .lineLimit(1)
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .padding(.vertical, 3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// One line of text, so it truncates at its end rather than piece by piece.
    private var details: Text {
        var text = Text(provider.short)
        if let account = session.account { text = Text("\(text) · \(account)") }
        if let branch = session.gitBranch {
            text = Text("\(text) · \(Image(systemName: "arrow.triangle.branch")) \(branch)")
        }
        if let time = agentSessionTime(session.updatedAt) { text = Text("\(text) · \(time)") }
        if !session.preview.isEmpty { text = Text("\(text) · \(session.preview)") }
        return text
    }
}
