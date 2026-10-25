import Foundation

private let commandSeparators = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ";&|"))

/// The agent `cmd` starts: the first command word naming one of `agents` by its
/// file name (`/usr/local/bin/claude`, `codex.exe`). Mirrors the desktop's detectAICLI.
func agentCLI(in cmd: String, among agents: [String]) -> String? {
    for word in cmd.components(separatedBy: commandSeparators) where !word.isEmpty {
        var name = word.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? word
        if let ext = [".exe", ".cmd", ".bat"].first(where: { name.lowercased().hasSuffix($0) }) {
            name.removeLast(ext.count)
        }
        if agents.contains(name) { return name }
    }
    return nil
}
