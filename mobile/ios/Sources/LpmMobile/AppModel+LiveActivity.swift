import SwiftUI

extension AppModel {
    /// A finished agent stays on the Live Activity this long, as on the Mac's.
    private static let liveRecentMillis = 30 * 60 * 1000
    private static let liveMaxAgents = 4

    /// The live Mac's agents as its Live Activity shows them, ordered as the Mac
    /// orders its updates: who waits on you, who works, who finished lately. Nil
    /// while what's on screen isn't a Mac's live list, and when nothing would keep
    /// the activity current once the app has left the screen: Demo Mode, or a Mac
    /// that predates Live Activities.
    var liveActivityReading: LiveActivityReading? {
        guard liveActivitiesEnabled, !demoMode, !isVisit, let mac = agentWidgetMac,
              client?.hostFeatures.contains(LpmClient.liveActivityFeature) == true,
              let record = activeRecord, record.via == nil else { return nil }
        let now = Int(Date().timeIntervalSince1970 * 1000)
        let labels = Dictionary(projects.map { ($0.name, $0.label) }, uniquingKeysWith: { first, _ in first })
        let rank: (AgentState) -> Int = { $0 == .needsYou ? 0 : $0 == .working ? 1 : 2 }
        let rows = mac.rows
            .filter { row in
                switch row.state {
                case .needsYou, .working: return true
                case .done, .error: return now - (row.until ?? row.since ?? now) <= Self.liveRecentMillis
                case .idle: return false
                }
            }
            .sorted { a, b in
                rank(a.state) != rank(b.state) ? rank(a.state) < rank(b.state) : (a.since ?? 0) > (b.since ?? 0)
            }
        let agents = rows.prefix(Self.liveMaxAgents).map { row in
            LiveSnapshot.Agent(project: row.project, projectLabel: labels[row.project] ?? "",
                               terminal: row.title, terminalId: row.terminalId ?? "", key: row.key,
                               agent: "", state: row.state.macStatus, since: row.since ?? 0,
                               turnStart: row.since ?? 0, endedAt: row.until ?? 0)
        }
        let waiting = rows.filter { $0.state == .needsYou }.count
        let working = rows.filter { $0.state == .working }.count
        let snapshot = LiveSnapshot(live: waiting + working > 0, waiting: waiting, working: working,
                                    agents: Array(agents))
        return LiveActivityReading(serverId: mac.id, macName: record.displayName, snapshot: snapshot)
    }

    /// Hand the live Mac its Live Activity's token, on every new token and every
    /// reconnect; a Mac that predates Live Activities never hears of it.
    func sendLiveActivityTokenIfPossible() {
        guard case .ready = connection, let client, !demoMode, !isVisit,
              client.hostFeatures.contains(LpmClient.liveActivityFeature),
              let record = activeRecord, record.via == nil,
              let token = liveActivities.tokens[agentWidgetId(record)] else { return }
        client.sendLiveActivity(on: liveActivitiesEnabled, token: token, env: Self.apnsEnvironment)
    }

    /// The toggle went off, or the activity was swiped away: the live Mac stops
    /// sending updates, and none show until the app starts the next one.
    func stopLiveActivityUpdates() {
        guard case .ready = connection, let client,
              client.hostFeatures.contains(LpmClient.liveActivityFeature) else { return }
        client.sendLiveActivity(on: false, token: nil, env: Self.apnsEnvironment)
    }

    func wireLiveActivities() {
        liveActivities.onToken = { [weak self] serverId, _ in
            guard let self, let record = self.activeRecord, self.agentWidgetId(record) == serverId else { return }
            self.sendLiveActivityTokenIfPossible()
        }
        liveActivities.onDismissed = { [weak self] serverId in
            guard let self, let record = self.activeRecord, self.agentWidgetId(record) == serverId else { return }
            self.stopLiveActivityUpdates()
        }
    }

    static var apnsEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}

/// What the Live Activity of the Mac on screen should show.
struct LiveActivityReading: Equatable {
    let serverId: String
    let macName: String
    let snapshot: LiveSnapshot
}

private extension AgentState {
    /// The status string the Mac's updates carry for the state.
    var macStatus: String {
        switch self {
        case .needsYou: return "Waiting"
        case .working: return "Running"
        case .done: return "Done"
        case .error: return "Error"
        case .idle: return ""
        }
    }
}

/// Keeps the Live Activity in step with the live Mac, once its agents have
/// settled for a second so a burst of status changes is one update.
struct LiveActivityPublisher: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let reading = model.liveActivityReading
        Color.clear
            .task(id: reading) {
                guard let reading else { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                await model.liveActivities.show(reading.snapshot, serverId: reading.serverId,
                                                macName: reading.macName)
            }
    }
}
