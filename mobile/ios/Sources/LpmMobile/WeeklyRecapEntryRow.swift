import SwiftUI

/// The Stats screen's way into the weekly recap, at the top of its scroll.
struct WeeklyRecapEntryRow: View {
    var body: some View {
        NavigationLink {
            WeeklyRecapScreen()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "calendar")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.accentColor)
                    .accessibilityHidden(true)
                Text("Weekly recap")
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(.secondarySystemGroupedBackground),
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
