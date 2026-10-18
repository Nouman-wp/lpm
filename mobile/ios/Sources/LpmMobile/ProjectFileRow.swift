import SwiftUI

/// A file or folder in Files: its icon and name, dimmed when git ignores it,
/// with a changed file's status letter or how many changed files a folder holds.
struct ProjectFileRow: View {
    let entry: ProjectFileEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.dir ? "folder.fill" : "doc")
                .font(.system(size: 17))
                .foregroundStyle(entry.dir ? Color.blue : Color.secondary)
                .opacity(entry.ignored ? 0.5 : 1)
                .frame(width: 24)
                .accessibilityHidden(true)
            Text(entry.name)
                .foregroundStyle(entry.ignored ? Color.secondary : Color.primary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            if let status = entry.status {
                GitStatusBadge(status: status)
            }
            if entry.dir && entry.changed > 0 {
                Text("\(entry.changed) changed")
                    .font(.subheadline)
                    .foregroundStyle(Color.secondary)
            }
        }
        .frame(minHeight: 36)
    }
}
