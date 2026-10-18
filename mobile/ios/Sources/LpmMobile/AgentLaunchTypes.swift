import Foundation

/// An agent the Mac can start in a new tab (one row of the `agentOptions`
/// reply). An agent without models has no model or effort control.
struct AgentOption: Identifiable, Equatable {
    let id: String
    let label: String
    let models: [AgentModelOption]

    init(_ o: [String: Any]) {
        id = o["id"] as? String ?? ""
        label = o["label"] as? String ?? id
        models = (o["models"] as? [[String: Any]] ?? []).map(AgentModelOption.init)
    }
}

/// A model an agent offers, with the effort levels that model takes. `value` is
/// empty for the agent's own default.
struct AgentModelOption: Identifiable, Equatable {
    let value: String
    let label: String
    let efforts: [AgentEffortOption]

    var id: String { value }

    init(_ o: [String: Any]) {
        value = o["value"] as? String ?? ""
        label = o["label"] as? String ?? value
        efforts = (o["efforts"] as? [[String: Any]] ?? []).map(AgentEffortOption.init)
    }
}

struct AgentEffortOption: Identifiable, Equatable {
    let value: String
    let label: String

    var id: String { value }

    init(_ o: [String: Any]) {
        value = o["value"] as? String ?? ""
        label = o["label"] as? String ?? value
    }
}

/// What a new tab starts with. An empty `agent` is a plain shell.
struct AgentLaunch: Equatable {
    var agent = ""
    var model = ""
    var effort = ""
    var prompt = ""
}

/// The New Tab sheet's last pick, remembered app-wide. The prompt isn't kept.
struct NewTabPick: Codable, Equatable {
    var agent = ""
    var model = ""
    var effort = ""

    static let defaultsKey = "newTab.lastPick"

    static func load(_ defaults: UserDefaults = .standard) -> NewTabPick {
        guard let data = defaults.data(forKey: defaultsKey),
              let pick = try? JSONDecoder().decode(NewTabPick.self, from: data) else { return NewTabPick() }
        return pick
    }

    func save(_ defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(self) { defaults.set(data, forKey: Self.defaultsKey) }
    }

    /// This pick as the Mac offers things now: an agent it no longer offers is a
    /// shell, and a model or effort it no longer offers is that agent's default.
    func resolved(in agents: [AgentOption]) -> NewTabPick {
        guard let agent = agents.first(where: { $0.id == self.agent }) else { return NewTabPick() }
        return NewTabPick(agent: agent.id).choosing(model: model, effort: effort, in: agent)
    }

    /// The pick with `model` chosen, keeping `effort` when that model offers it.
    func choosing(model: String, effort: String, in agent: AgentOption) -> NewTabPick {
        guard let chosen = agent.models.first(where: { $0.value == model }) ?? agent.models.first else {
            return NewTabPick(agent: agent.id)
        }
        let kept = chosen.efforts.first { $0.value == effort } ?? chosen.efforts.first
        return NewTabPick(agent: agent.id, model: chosen.value, effort: kept?.value ?? "")
    }
}

/// A past Claude Code or Codex conversation this project can be resumed into
/// (one row of the `agentSessions` reply). `openIn` is the live tab already
/// holding it.
struct AgentSession: Identifiable, Equatable {
    let key: String
    let provider: String
    let sessionId: String
    let title: String
    let preview: String
    /// Epoch ms; 0 when unknown.
    let updatedAt: Int
    let gitBranch: String?
    let account: String?
    let openIn: String?

    var id: String { key }

    init(_ o: [String: Any]) {
        provider = o["provider"] as? String ?? ""
        sessionId = o["sessionId"] as? String ?? ""
        key = o["key"] as? String ?? "\(provider):\(sessionId)"
        title = o["title"] as? String ?? ""
        preview = o["preview"] as? String ?? ""
        updatedAt = (o["updatedAt"] as? NSNumber)?.intValue ?? 0
        gitBranch = Self.text(o["gitBranch"])
        account = Self.text(o["account"])
        openIn = Self.text(o["openIn"])
    }

    private static func text(_ v: Any?) -> String? {
        guard let s = v as? String, !s.isEmpty else { return nil }
        return s
    }
}

/// One `agentSessions` reply. `sessions` is nil on a failure. `search` is the
/// query the Mac answered, when it says.
struct AgentSessionsPage {
    let project: String
    let sessions: [AgentSession]?
    let hasMore: Bool
    let error: String?
    let search: String?

    init(_ o: [String: Any]) {
        let ok = o["ok"] as? Bool ?? false
        project = o["project"] as? String ?? ""
        sessions = ok ? (o["sessions"] as? [[String: Any]] ?? []).map(AgentSession.init) : nil
        hasMore = o["hasMore"] as? Bool ?? false
        error = ok ? nil : (o["error"] as? String ?? "Couldn't load past sessions.")
        search = o["search"] as? String
    }
}
