import Foundation

/// The agents a new tab can start and the past conversations a project can be
/// resumed into, reached as `model.agentLaunch`. The client transport lives on
/// `AppModel`; this store reaches it through `model`.
@Observable @MainActor
final class AgentLaunchStore {
    @ObservationIgnored weak var model: AppModel?
    private var client: LpmClient? { model?.client }

    /// What the Mac can start, in its order; nil until it first answers.
    var options: [AgentOption]?
    /// The Resume Session list per project.
    var sessions: [String: AgentSessionList] = [:]

    @ObservationIgnored private let timeout = GenerationTimeout<String>()
    private static let pageSize = 40

    func loadOptions() { client?.requestAgentOptions() }

    func applyOptions(_ agents: [AgentOption]) { options = agents }

    /// Ask for the newest sessions matching `search`, keeping the rows on screen
    /// until the answer replaces them.
    func loadSessions(_ project: String, search: String) {
        var list = sessions[project] ?? AgentSessionList()
        if list.search != search { list.limit = Self.pageSize }
        list.search = search
        request(project, list)
    }

    func loadOlderSessions(_ project: String) {
        guard var list = sessions[project], list.hasMore, !list.loading else { return }
        list.limit += Self.pageSize
        request(project, list)
    }

    func applySessions(_ page: AgentSessionsPage) {
        guard var list = sessions[page.project], list.loading else { return }
        if let search = page.search, search != list.search { return }
        timeout.cancel(page.project)
        list.loading = false
        list.loaded = true
        if let rows = page.sessions {
            list.rows = rows
            list.hasMore = page.hasMore
            list.error = nil
        } else {
            list.error = page.error
        }
        sessions[page.project] = list
    }

    /// A list waiting on a reply the dropped link took with it asks again.
    func handleConnectionReset() {
        for (project, list) in sessions where list.loading { request(project, list) }
    }

    private func request(_ project: String, _ list: AgentSessionList) {
        var list = list
        list.loading = true
        list.error = nil
        sessions[project] = list
        client?.requestAgentSessions(project: project, search: list.search, limit: list.limit)
        timeout.arm(project, seconds: 20) { [weak self] in
            guard let self, var list = self.sessions[project], list.loading else { return }
            list.loading = false
            list.error = "The Mac didn't answer in time."
            self.sessions[project] = list
        }
    }
}

/// One project's Resume Session list: the rows the Mac last sent for `search`,
/// and how many were asked for.
struct AgentSessionList {
    var search = ""
    var limit = 40
    var rows: [AgentSession] = []
    var hasMore = false
    /// An answer has arrived, so an empty `rows` means none.
    var loaded = false
    var loading = false
    var error: String?
}
