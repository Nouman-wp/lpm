import Foundation
import WidgetKit

/// Keeps the Token activity widget's numbers fresh. The widget can't reach the Mac,
/// so while a list with usage rows is on screen the app asks for every computer's
/// last 30 days — only with the widget on the Home Screen, and at most every 15
/// minutes per Mac — and writes any such answer, the Stats screen's included.
@MainActor
final class TokenActivityFeed {
    weak var model: AppModel?
    private var askedAt: Date?
    private var askedMac: String?
    private let interval: TimeInterval = 15 * 60

    private var liveMac: String? {
        guard let model, !model.demoMode, !model.isVisit, case .ready = model.connection else { return nil }
        return model.activeMacId?.uuidString
    }

    func refreshIfDue() {
        guard let mac = liveMac else { return }
        if mac == askedMac, let askedAt, Date().timeIntervalSince(askedAt) < interval { return }
        WidgetCenter.shared.getCurrentConfigurations { [weak self] result in
            guard case .success(let widgets) = result,
                  widgets.contains(where: { $0.kind == TokenActivityStore.kind })
            else { return }
            Task { @MainActor in self?.request(mac) }
        }
    }

    private func request(_ mac: String) {
        guard liveMac == mac else { return }
        askedAt = Date()
        askedMac = mac
        model?.client?.requestStats(days: 30, machine: "all")
    }

    /// A Mac that predates picking a computer answers for itself alone.
    func apply(_ stats: AgentStats) {
        guard liveMac != nil, stats.days == 30, stats.machine == nil || stats.machine == "all" else { return }
        let days = stats.daily.map {
            TokenActivityDay(date: $0.date, claudeTokens: $0.claudeTokens, codexTokens: $0.codexTokens,
                             cost: estimateDailyCost($0.models))
        }
        let generatedAt = stats.generatedAt > 0 ? stats.generatedAt : Int(Date().timeIntervalSince1970 * 1000)
        let snapshot = TokenActivitySnapshot(generatedAt: generatedAt, days: days)
        Task.detached(priority: .utility) { TokenActivityStore.save(snapshot) }
    }
}
