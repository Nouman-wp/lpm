import Foundation

/// New tabs that start an agent, and past conversations resumed into new tabs.
/// Either opens through the same placeholder row and spawn callback a terminal
/// action uses.
extension AppModel {
    /// The Mac starts agents in new tabs (`agentOptions`, `newTerminal` with an agent).
    var canLaunchAgents: Bool {
        client?.hostFeatures.contains(LpmClient.agentLaunchFeature) == true
    }

    /// The Mac lists past conversations to resume. An SSH project's agents ran
    /// on the other host, so it has none here.
    func canResumeSessions(_ project: Project) -> Bool {
        client?.hostFeatures.contains(LpmClient.agentSessionsFeature) == true && !project.isRemote
    }

    func newTerminal(_ project: String, launch: AgentLaunch, onSpawn: @escaping (TerminalInfo) -> Void) {
        spawnTerminal(project, verb: "New tab", onSpawn: onSpawn) { $0.newTerminal(project: project, launch: launch) }
    }

    /// The live tab already holding `session`, which opens instead of a second copy.
    func openTab(for session: AgentSession, project: String) -> TerminalInfo? {
        guard let id = session.openIn else { return nil }
        return terminals[project]?.first { $0.id == id }
    }

    /// Continue `session` in a new tab.
    func resumeSession(_ session: AgentSession, project: String, onSpawn: @escaping (TerminalInfo) -> Void) {
        spawnTerminal(project, verb: "Resume “\(session.title)”", onSpawn: onSpawn) {
            $0.resumeSession(project: project, session: session)
        }
    }

    func wireAgentLaunch(_ c: LpmClient) {
        c.onAgentOptions = { [weak self] agents in self?.agentLaunch.applyOptions(agents) }
        c.onAgentSessions = { [weak self] page in self?.agentLaunch.applySessions(page) }
    }
}
