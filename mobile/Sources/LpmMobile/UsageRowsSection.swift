import SwiftUI

/// The usage rows as a list section, after the projects on the projects list
/// and after a project's own sections on its screen. It scrolls with the list;
/// `topGap` pushes it down to rest at the bottom while the list above is short.
///
/// On the projects list the tags speak for the main accounts, since nothing is
/// selected; on a project's screen they speak for that project, and an expanded
/// Claude account row switches the project to it.
struct UsageRowsSection: View {
    @Environment(AppModel.self) private var model
    var project: Project?
    var topGap: CGFloat = 0
    @State private var expanded: Set<String> = []
    @State private var clock = Date()

    var body: some View {
        let now = clock.timeIntervalSince1970 * 1000
        let rows = usageRows(model.usage.snapshot, today: model.usage.today,
                             accounts: model.claudeAccounts?.accounts ?? [],
                             now: now, macNow: model.usage.macMillis(clock))
        let inUse = model.claudeAccounts?.inUse(project, parent: project.flatMap { model.parentProject(of: $0) })
        // Switching needs an account beyond the main login, as the Claude Account menu does.
        let switches = project != nil && model.claudeAccounts?.hasAdded == true
        // As on the desktop, a lone account needs no tag to tell it apart.
        let tagged = rows.filter { $0.account != nil }.count >= 2

        if !rows.isEmpty {
            Section {
                ForEach(rows) { row in
                    UsageRowView(
                        row: row,
                        mark: tagged ? mark(row, inUse) : nil,
                        inUse: inUse,
                        expanded: expanded.contains(row.id),
                        now: now,
                        macNow: model.usage.macMillis(clock),
                        toggle: { toggle(row.id) },
                        onSwitch: switches ? { switchTo($0) } : nil
                    )
                    // Rules span the row, as its bar does.
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
                }
            } header: {
                header
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: topGap)
            HStack {
                Text("Usage")
                    .font(.footnote)
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                Spacer()
                NavigationLink {
                    UsageScreen()
                } label: {
                    Text("Details")
                }
                .font(.subheadline)
                .textCase(nil)
            }
        }
        // Reset countdowns keep moving between readings.
        .task {
            while !Task.isCancelled {
                clock = Date()
                try? await Task.sleep(nanoseconds: 30_000_000_000)
            }
        }
    }

    private func mark(_ row: UsageRow, _ inUse: ClaudeInUse?) -> UsageAccountMark? {
        guard let inUse, let account = row.account else { return nil }
        if account == inUse.current { return .current }
        if inUse.standby.contains(account) { return .standby }
        return nil
    }

    private func toggle(_ id: String) {
        withAnimation(.snappy(duration: 0.25)) {
            if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) }
        }
    }

    /// The main login is pinned as "", as the Claude Account menu writes it.
    private func switchTo(_ account: String) {
        guard let project else { return }
        model.setClaudeAccount(project, .pin(account == claudeMainLogin ? "" : account))
    }
}
