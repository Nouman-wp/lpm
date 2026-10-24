import SwiftUI

/// A slim full-bleed band marking a hunk boundary, with an optional "⇥ N" hint
/// when common indentation was trimmed from the hunk.
struct HunkSeparator: View {
    let label: String
    let context: String
    let indent: Int

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(.secondary)
            if !context.isEmpty {
                Text(context)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 8)
            if indent > 0 {
                Text("⇥ \(indent)")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
