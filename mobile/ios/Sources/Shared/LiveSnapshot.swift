import Foundation

/// The agents at work on one Mac, most urgent first, as a Live Activity shows
/// them: the plaintext the Mac seals into each update (PROTOCOL.md, Live
/// Activity), or the app's own reading of the live Mac, sealed the same way.
struct LiveSnapshot: Codable, Equatable {
    struct Agent: Codable, Equatable, Identifiable {
        var project: String
        var projectLabel: String
        var terminal: String
        var terminalId: String
        var key: String
        var agent: String
        /// The Mac's status string: Waiting, Running, Done or Error.
        var state: String
        var since: Int
        var turnStart: Int
        var endedAt: Int

        var id: String { project + "\u{0}" + key }
        var agentState: AgentState { AgentState.of(state) }
        var projectName: String { projectLabel.isEmpty ? project : projectLabel }
        var tabName: String { terminal.isEmpty ? agentProviderLabel(forStatusKey: key) : terminal }

        /// When the work it shows began: the turn, else the state; nil when
        /// neither was seen.
        var startedAt: Date? {
            let millis = turnStart > 0 ? turnStart : since
            return millis > 0 ? Date(timeIntervalSince1970: Double(millis) / 1000) : nil
        }

        var finishedAt: Date? {
            endedAt > 0 ? Date(timeIntervalSince1970: Double(endedAt) / 1000) : nil
        }

        init(project: String, projectLabel: String, terminal: String, terminalId: String, key: String,
             agent: String, state: String, since: Int, turnStart: Int, endedAt: Int) {
            self.project = project
            self.projectLabel = projectLabel
            self.terminal = terminal
            self.terminalId = terminalId
            self.key = key
            self.agent = agent
            self.state = state
            self.since = since
            self.turnStart = turnStart
            self.endedAt = endedAt
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            project = try c.decodeIfPresent(String.self, forKey: .project) ?? ""
            projectLabel = try c.decodeIfPresent(String.self, forKey: .projectLabel) ?? ""
            terminal = try c.decodeIfPresent(String.self, forKey: .terminal) ?? ""
            terminalId = try c.decodeIfPresent(String.self, forKey: .terminalId) ?? ""
            key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
            agent = try c.decodeIfPresent(String.self, forKey: .agent) ?? ""
            state = try c.decodeIfPresent(String.self, forKey: .state) ?? ""
            since = try c.decodeIfPresent(Int.self, forKey: .since) ?? 0
            turnStart = try c.decodeIfPresent(Int.self, forKey: .turnStart) ?? 0
            endedAt = try c.decodeIfPresent(Int.self, forKey: .endedAt) ?? 0
        }
    }

    /// Whether anything is still at work; false is the final update.
    var live: Bool
    var waiting: Int
    var working: Int
    var agents: [Agent]

    var lead: Agent? { agents.first }

    init(live: Bool, waiting: Int, working: Int, agents: [Agent]) {
        self.live = live
        self.waiting = waiting
        self.working = working
        self.agents = agents
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        live = try c.decodeIfPresent(Bool.self, forKey: .live) ?? false
        waiting = try c.decodeIfPresent(Int.self, forKey: .waiting) ?? 0
        working = try c.decodeIfPresent(Int.self, forKey: .working) ?? 0
        agents = try c.decodeIfPresent([Agent].self, forKey: .agents) ?? []
    }

    static func open(blob: String) -> LiveSnapshot? {
        PushPayload.plaintext(blob: blob).flatMap { try? JSONDecoder().decode(LiveSnapshot.self, from: $0) }
    }

    func sealed() -> String? {
        (try? JSONEncoder().encode(self)).flatMap(PushPayload.seal)
    }
}
