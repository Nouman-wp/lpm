import SwiftUI

/// Resume Session on its own, from the project's "more" menu.
struct ResumeSessionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let project: Project
    let onOpen: (TerminalInfo) -> Void

    var body: some View {
        NavigationStack {
            ResumeSessionList(project: project, onDone: { dismiss() }, onOpen: onOpen)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                }
        }
    }
}
