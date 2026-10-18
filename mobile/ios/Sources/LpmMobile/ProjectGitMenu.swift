import SwiftUI
import UIKit

/// The desktop's project Git submenu, adapted to mobile: sync ops that fire
/// directly (disabled while in flight), then branch/PR navigation, then
/// copy-branch and the destructive discard. Review Changes sits on the main
/// menu, one level up.
struct ProjectGitMenu: View {
    @Environment(AppModel.self) private var model
    let project: Project
    let changedCount: Int?
    let onSwitchBranch: () -> Void
    let onCreatePr: () -> Void
    let onAuto: (_ kind: GitAutoKind) -> Void
    let onDiscard: () -> Void

    private var name: String { project.name }
    private var pulling: Bool { model.git.pulling.contains(name) }
    private var pushing: Bool { model.git.pushing.contains(name) }
    private var fetching: Bool { model.git.fetching.contains(name) }
    private var branch: String { model.git.snapshots[name]?.branch ?? "" }
    private var ghCli: Bool { model.git.snapshots[name]?.ghCli ?? false }
    private var autoRun: GitAutoRun? { model.gitAuto.runs[name] }

    var body: some View {
        Menu {
            Button { model.git.pull(name) } label: { Label("Pull", systemImage: "arrow.down") }
                .disabled(pulling)
            Button { model.git.push(name) } label: { Label("Push", systemImage: "arrow.up") }
                .disabled(pushing)
            Button { model.git.fetch(name) } label: { Label("Fetch", systemImage: "arrow.triangle.2.circlepath") }
                .disabled(fetching)
            AutoPullMenuItems(project: project)

            Divider()

            Button(action: onSwitchBranch) {
                Label("Switch Branch…", systemImage: "arrow.trianglehead.branch")
            }
            if ghCli {
                Button(action: onCreatePr) {
                    Label("Create Pull Request…", systemImage: "arrow.triangle.pull")
                }
            }

            Divider()

            autoButton(.commit)
            autoButton(.commitPush)
            if ghCli {
                autoButton(.pr)
            }

            Divider()

            Button { UIPasteboard.general.string = branch } label: {
                Label("Copy Branch Name", systemImage: "doc.on.doc")
            }
            .disabled(branch.isEmpty)
            Button(role: .destructive, action: onDiscard) {
                Label("Discard All Changes…", systemImage: "trash")
            }
            .disabled((changedCount ?? 0) == 0)
        } label: {
            Label("Git", systemImage: "arrow.trianglehead.branch")
        }
    }

    /// While a run is going every item reopens its progress sheet, so the one
    /// in flight reads as such; otherwise the commit items need changes to
    /// commit (Auto Create PR can still ship commits already made).
    private func autoButton(_ kind: GitAutoKind) -> some View {
        let running = autoRun?.running == true
        let inFlight = running && autoRun?.kind == kind
        return Button { onAuto(kind) } label: {
            Label(kind.title, systemImage: "sparkles")
            Text(inFlight ? "Running… tap to view" : kind.subtitle)
        }
        .disabled(!running && kind != .pr && (changedCount ?? 0) == 0)
    }
}
