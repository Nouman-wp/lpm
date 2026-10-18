import SwiftUI

/// A project screen's title, read the way its terminals' are: the project's state
/// above its name, and its uncommitted changes below. The connection's status takes
/// the top line whenever the Mac isn't connected.
struct ProjectTitle: View {
    @Environment(AppModel.self) private var model
    let project: String
    let title: String
    let status: String
    /// The bar's middle, in global coordinates.
    let axis: CGFloat?

    private var offline: Bool { !model.demoMode && !model.link.isReady }

    var body: some View {
        BarTitle(name: title, project: project, stale: offline, axis: axis) {
            if offline {
                BarConnectionLine(line: model.link.statusLine)
            } else {
                Text(status)
                    .font(BarTitleLine.font)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}
