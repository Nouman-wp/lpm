import SwiftUI

extension AppModel {
    /// The live Mac's usage rows as the Usage widget draws them: the projects
    /// list's, tagged for the main accounts. Nil until the Mac has sent its meters,
    /// and for the demo and a visit, which aren't the person's own.
    var usageWidgetMac: UsageWidgetMac? {
        guard case .ready = connection, !demoMode, !isVisit, usage.snapshot != nil,
              let record = activeRecord else { return nil }
        let rows = currentUsageRows(at: Date())
        let inUse = claudeAccounts?.inUse(nil, parent: nil)
        // As on the projects list, a lone account needs no tag to tell it apart.
        let tagged = rows.filter { $0.account != nil }.count >= 2
        let offset = usage.clockOffsetMs
        return UsageWidgetMac(id: agentWidgetId(record), rows: rows.map { row in
            UsageWidgetRow(
                id: row.id,
                provider: row.provider,
                label: row.label,
                mark: tagged ? usageWidgetMark(row.account, inUse) : nil,
                weekly: row.data?.weekly.map(UsageWidgetWindow.init),
                fiveHour: row.data?.fiveHour.map(UsageWidgetWindow.init),
                tokens: row.tokens,
                // The Mac stamped it; the widget only has the phone's clock.
                updatedAt: row.data.map { Int(Double($0.updatedAt) - offset) }
            )
        })
    }

    private func usageWidgetMark(_ account: String?, _ inUse: ClaudeInUse?) -> UsageWidgetMark? {
        guard let account, let inUse else { return nil }
        if account == inUse.current { return .current }
        if inUse.standby.contains(account) { return .standby }
        return nil
    }
}

/// Keeps the Usage widget in step with the live Mac, writing its rows once they
/// have settled for a second. Leaving the app stamps them as seen then, the last
/// the phone hears of the Mac until it's back.
struct UsageWidgetPublisher: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        let mac = model.usageWidgetMac
        Color.clear
            .task(id: mac) {
                guard let mac else { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                await Task.detached(priority: .utility) { UsageWidgetStore.publish(mac) }.value
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .inactive, let mac else { return }
                Task.detached(priority: .utility) { UsageWidgetStore.confirm(mac) }
            }
    }
}
