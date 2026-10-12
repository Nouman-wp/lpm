import SwiftUI

/// Runs a project action through the host screen's run flow (inputs → confirm →
/// dispatch). Set by `projectMenuToolbar`, so any view under it can start one.
struct RunProjectAction {
    let run: (Action) -> Void
    func callAsFunction(_ action: Action) { run(action) }
}

extension EnvironmentValues {
    @Entry var runProjectAction = RunProjectAction { _ in }
}

/// The project's action buttons, as on the desktop, in a horizontally scrolling
/// row under the nav bar. The trailing grid button opens every action —
/// including the menu-only ones the row leaves out — in a sheet.
struct ProjectActionRail: View {
    let project: Project
    @Environment(AppModel.self) private var model
    @Environment(\.runProjectAction) private var runAction
    @State private var showingAll = false
    // Run after the sheet closes: the run flow may present a sheet of its own.
    @State private var picked: Action?
    @State private var editing: ActionEditorContext?

    private var buttons: [Action] { project.actions.filter { $0.display != "menu" } }

    var body: some View {
        if !project.actions.isEmpty {
            HStack(spacing: 10) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(buttons) { action in
                            DesktopActionButton(action: action, project: project.name,
                                                onEdit: { editing = .edit(key: $0.name) }) { run($0) }
                        }
                    }
                    .glassGroup()
                    .padding(.leading, 16)
                    // Room for the glass edge and shadow inside the scroll clip.
                    .padding(.vertical, 4)
                }
                Rectangle()
                    .fill(Color(.separator))
                    .frame(width: 1, height: 28)
                Button {
                    showingAll = true
                } label: {
                    Image(systemName: "square.grid.2x2")
                        .frame(width: 44)
                        .desktopActionFace(nil)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("All Actions")
                .padding(.trailing, 16)
            }
            .padding(.top, 6)
            .padding(.bottom, 10)
            .railChrome()
            .sheet(isPresented: $showingAll, onDismiss: runPicked) {
                ProjectActionsSheet(project: project) { action in
                    picked = action
                    showingAll = false
                }
                .environment(model)
            }
            .sheet(item: $editing) { context in
                ActionEditorSheet(project: project, context: context).environment(model)
            }
        }
    }

    private func run(_ action: Action) {
        Haptics.tap()
        runAction(action)
    }

    private func runPicked() {
        guard let action = picked else { return }
        picked = nil
        runAction(action)
    }
}

private extension View {
    /// On iOS 26 the glass buttons float over the list as a bar; before that the
    /// row sits on the screen's ground with a hairline under it.
    @ViewBuilder
    func railChrome() -> some View {
        if #available(iOS 26.0, *) {
            self
        } else {
            background(Color(.systemGroupedBackground))
                .overlay(alignment: .bottom) { Divider() }
        }
    }
}
