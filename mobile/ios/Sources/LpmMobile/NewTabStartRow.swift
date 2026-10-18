import SwiftUI

/// One way a new tab can start, a shell or an agent, checked when picked.
struct NewTabStartRow: View {
    let label: String
    /// The agent's id; nil for the plain shell.
    let agent: String?
    let picked: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            HStack(spacing: 12) {
                Image(systemName: agent == nil ? "terminal" : "sparkle")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 28)
                    .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
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
        .accessibilityAddTraits(picked ? .isSelected : [])
    }

    /// The agent's colour, as the desktop tints it; a shell is plain.
    private var tint: Color { agent.map { providerMeta($0).color } ?? .secondary }
}
