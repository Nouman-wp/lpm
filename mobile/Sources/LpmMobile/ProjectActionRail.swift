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

/// The project's actions as a horizontally scrolling row of chips under the nav
/// bar: one tap runs an action, a group opens its children, and the trailing grid
/// button lists every action — including the menu-only ones the row leaves out,
/// as the desktop does.
struct ProjectActionRail: View {
    let project: Project
    @Environment(\.runProjectAction) private var runAction

    private var chips: [Action] { project.actions.filter { $0.display != "menu" } }

    var body: some View {
        if !project.actions.isEmpty {
            HStack(spacing: 10) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(chips) { action in
                            if action.isRunnable {
                                Button {
                                    Haptics.tap()
                                    runAction(action)
                                } label: {
                                    ActionChipLabel(action: action)
                                }
                                .buttonStyle(.plain)
                            } else {
                                Menu {
                                    leafButtons(action.runnableLeaves)
                                } label: {
                                    ActionChipLabel(action: action)
                                }
                                .menuStyle(.button)
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.leading, 16)
                }
                Rectangle()
                    .fill(Color(.separator))
                    .frame(width: 1, height: 28)
                Menu {
                    allActions
                } label: {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(.primary)
                        .frame(width: 44, height: 44)
                        .background(Color(.secondarySystemGroupedBackground), in: Circle())
                }
                .menuStyle(.button)
                .buttonStyle(.plain)
                .accessibilityLabel("All Actions")
                .padding(.trailing, 16)
            }
            .padding(.top, 10)
            .padding(.bottom, 14)
            .background(Color(.systemGroupedBackground))
            .overlay(alignment: .bottom) { Divider() }
        }
    }

    /// Every action: top-level ones first, then each group as its own section.
    @ViewBuilder
    private var allActions: some View {
        leafButtons(project.actions.filter(\.isRunnable))
        ForEach(project.actions.filter { !$0.isRunnable }) { group in
            Section(group.label) {
                leafButtons(group.runnableLeaves)
            }
        }
    }

    private func leafButtons(_ actions: [Action]) -> some View {
        ForEach(actions) { action in
            Button { runAction(action) } label: {
                Label {
                    Text(action.label)
                } icon: {
                    if action.emoji.isEmpty {
                        Image(systemName: action.symbol)
                    } else {
                        Text(action.emoji)
                    }
                }
            }
        }
    }
}

/// The symbol turns orange when the action asks to confirm before running.
private struct ActionChipLabel: View {
    let action: Action

    var body: some View {
        HStack(spacing: 8) {
            if action.emoji.isEmpty {
                Image(systemName: action.symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(action.confirm ? Color.orange : Color.accentColor)
            } else {
                Text(action.emoji)
                    .font(.system(size: 16))
            }
            Text(action.label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            if !action.isRunnable {
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, 16)
        .frame(height: 44)
        .background(Color(.secondarySystemGroupedBackground), in: Capsule())
        .contentShape(Capsule())
    }
}

private extension Action {
    var symbol: String {
        if !isRunnable { return "square.stack" }
        return runsInBackground ? "bolt.fill" : "terminal"
    }
}
