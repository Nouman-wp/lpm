import SwiftUI

/// Go to File: the project's files whose path holds the query, from the same
/// index the composer's @-mention list reads.
struct GoToFileResults: View {
    @Environment(AppModel.self) private var model
    let project: String
    let query: String
    let onOpen: (String) -> Void

    var body: some View {
        if let index = model.mentions[project] {
            let hits = goToFileMatches(index, query: query)
            if hits.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                List(hits) { entry in
                    Button { onOpen(entry.path) } label: { row(entry.path) }
                        .compactRow()
                }
                .listStyle(.insetGrouped)
            }
        } else {
            List {
                ForEach([150.0, 110.0, 170.0], id: \.self) { FileRowSkeleton(width: $0).compactRow() }
            }
            .listStyle(.insetGrouped)
            .scrollDisabled(true)
            .allowsHitTesting(false)
        }
    }

    private func row(_ path: String) -> some View {
        let folder = (path as NSString).deletingLastPathComponent
        return HStack(spacing: 12) {
            Image(systemName: "doc")
                .font(.system(size: 17))
                .foregroundStyle(Color.secondary)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text((path as NSString).lastPathComponent)
                    .foregroundStyle(Color.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if !folder.isEmpty {
                    Text(folder)
                        .font(.caption)
                        .foregroundStyle(Color.secondary)
                        .lineLimit(1)
                        .truncationMode(.head)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: 40)
    }
}

/// Files whose name holds `query` first, then those whose folder path does;
/// changed files lead within each.
func goToFileMatches(_ entries: [MentionEntry], query: String, limit: Int = 100) -> [MentionEntry] {
    var byName: [MentionEntry] = []
    var byPath: [MentionEntry] = []
    for entry in entries where !entry.dir {
        if (entry.path as NSString).lastPathComponent.localizedCaseInsensitiveContains(query) {
            byName.append(entry)
        } else if entry.path.localizedCaseInsensitiveContains(query) {
            byPath.append(entry)
        }
    }
    func changedFirst(_ list: [MentionEntry]) -> [MentionEntry] {
        list.filter(\.changed) + list.filter { !$0.changed }
    }
    return Array((changedFirst(byName) + changedFirst(byPath)).prefix(limit))
}
