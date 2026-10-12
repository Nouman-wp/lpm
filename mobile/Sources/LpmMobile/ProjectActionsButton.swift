import SwiftUI

/// Opens every project action in a sheet. The picked one runs after the sheet
/// closes, because the run flow may present a sheet of its own.
struct ProjectActionsButton<Face: View>: View {
    let project: Project
    let onRun: (Action) -> Void
    @ViewBuilder let face: () -> Face
    @Environment(AppModel.self) private var model
    @State private var showing = false
    @State private var picked: Action?

    var body: some View {
        Button(action: { showing = true }, label: face)
            .sheet(isPresented: $showing, onDismiss: runPicked) {
                ProjectActionsSheet(project: project) { action in
                    picked = action
                    showing = false
                }
                .environment(model)
            }
    }

    private func runPicked() {
        guard let action = picked else { return }
        picked = nil
        onRun(action)
    }
}
