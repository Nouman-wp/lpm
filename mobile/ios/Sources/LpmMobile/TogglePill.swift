import SwiftUI

/// A file header capsule, "Wrap" or "Viewed": tinted while on, plain while off.
struct TogglePill: View {
    let label: LocalizedStringKey
    var icon: String?
    let tint: Color
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon {
                    Image(systemName: icon)
                }
                Text(label)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(on ? tint : Color.secondary)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(on ? tint.opacity(0.15) : Color(.tertiarySystemFill), in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(label))
        .accessibilityValue(on ? "On" : "Off")
        .accessibilityAddTraits(.isButton)
    }
}
