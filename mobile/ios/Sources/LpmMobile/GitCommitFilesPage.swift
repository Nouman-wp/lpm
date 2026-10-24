import SwiftUI

/// Every changed file, to include in the commit or leave out, pushed from the
/// commit sheet's Files row.
struct GitCommitFilesPage: View {
    @Environment(AppModel.self) private var model
    let project: String
    @Binding var deselected: Set<String>

    private var files: [GitFile] { model.git.snapshots[project]?.files ?? [] }
    private var allSelected: Bool { files.allSatisfy { !deselected.contains($0.path) } }

    var body: some View {
        Form {
            Section {
                ForEach(files) { file in
                    CommitFileRow(project: project, file: file, selected: !deselected.contains(file.path)) {
                        toggle(file.path)
                    }
                }
            } footer: {
                Text("Only the selected files are committed.")
            }
        }
        .navigationTitle("Files")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(allSelected ? "Deselect All" : "Select All") {
                    deselected = allSelected ? Set(files.map(\.path)) : []
                }
                .disabled(files.isEmpty)
            }
        }
    }

    private func toggle(_ path: String) {
        if deselected.contains(path) { deselected.remove(path) } else { deselected.insert(path) }
    }
}

/// A file in the commit list: its checkmark, status letter, name over folder, and
/// +N −M. The whole row includes or leaves it out.
private struct CommitFileRow: View {
    @Environment(AppModel.self) private var model
    let project: String
    let file: GitFile
    let selected: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(selected ? Color.accentColor : Color.secondary)
                GitStatusBadge(status: file.status)
                GitFileName(file: file)
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                if let parsed = model.git.parsedDiff(project, path: file.path) {
                    DiffStat(added: parsed.addedCount, removed: parsed.removedCount)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(file.path)
        .accessibilityValue(selected ? "Included" : "Excluded")
        .accessibilityAddTraits(.isButton)
    }
}
