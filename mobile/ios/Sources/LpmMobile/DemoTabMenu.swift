import Foundation

/// Demo handlers for the tab menu's fork / fork into copy / conversation title /
/// close others, answered as the Mac answers them: an ack, then the tabs again.
extension DemoServer {
    func registerTabMenuHandlers() {
        register("forkTerminal") { [weak self] o in
            guard let self, let project = o["project"] as? String, let id = o["id"] as? String else { return }
            self.push(["t": "forkTerminal", "ok": true])
            guard let source = self.forkableTerminal(project, id: id) else { return }
            self.world.terminals[project, default: []].append(self.fork(of: source, in: project))
            self.push(self.world.terminalsPayload(project))
        }
        // A copy of the project, made the way Duplicate makes one, with the
        // conversation carried on in a tab there.
        register("forkTerminalCopy") { [weak self] o in
            guard let self, let project = o["project"] as? String, let id = o["id"] as? String else { return }
            self.push(["t": "forkTerminalCopy", "ok": true])
            guard let source = self.forkableTerminal(project, id: id) else { return }
            let copyName = self.uniqueProjectName(project)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
                guard let self else { return }
                self.createDuplicate(of: project, named: copyName, label: "", excludeUncommitted: false,
                                     pullLatest: false, groupName: nil, runCmd: "")
                self.world.terminals[copyName, default: []].append(self.fork(of: source, in: copyName))
                self.push(["t": "projects-changed"])
            }
        }
        register("titleTerminal") { [weak self] o in
            guard let self, let project = o["project"] as? String, let id = o["id"] as? String else { return }
            self.push(["t": "titleTerminal", "ok": true])
            guard let index = self.world.terminals[project]?.firstIndex(where: { $0.id == id && $0.cli == "claude" })
            else { return }
            self.world.terminals[project]?[index].label = DemoWorld.conversationTitle
            self.push(self.world.terminalsPayload(project))
        }
        register("closeOtherTerminals") { [weak self] o in
            guard let self, let project = o["project"] as? String, let id = o["id"] as? String else { return }
            self.push(["t": "closeOtherTerminals", "ok": true])
            guard let list = self.world.terminals[project], let kept = list.first(where: { $0.id == id }) else { return }
            let closing = list.filter { $0.id != id && !$0.pinned }
            guard !closing.isEmpty else { return }
            let closed = Set(closing.map(\.id))
            self.world.terminals[project] = list.filter { !closed.contains($0.id) }
            closed.forEach { self.world.composerDrafts[$0] = nil }
            if kept.cli != "claude" && closing.contains(where: { $0.cli == "claude" }) {
                self.demoSetAgentStatus(project: project, entries: [])
            }
            self.push(self.world.terminalsPayload(project))
        }
    }

    private func forkableTerminal(_ project: String, id: String) -> DemoWorld.Terminal? {
        world.terminals[project]?.first { $0.id == id && $0.cli == "claude" }
    }

    /// A new tab carrying on `source`'s conversation: what it has said so far, and
    /// no scripted session of its own to play again.
    private func fork(of source: DemoWorld.Terminal, in project: String) -> DemoWorld.Terminal {
        var fork = DemoWorld.Terminal(id: nextTerminalId(project).id, label: source.label, project: project,
                                      emoji: source.emoji, cli: source.cli, buffer: source.buffer)
        fork.scriptStarted = true
        fork.scriptFinished = true
        return fork
    }
}
