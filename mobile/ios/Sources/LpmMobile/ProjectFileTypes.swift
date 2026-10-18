import Foundation

/// One entry of a project folder (the `listDir` reply). `status` is the file's
/// git status word, nil when unchanged; `changed` counts the changed files
/// anywhere below a folder.
struct ProjectFileEntry: Identifiable, Equatable {
    let name: String
    let dir: Bool
    let ignored: Bool
    let status: String?
    let changed: Int

    var id: String { name }

    init(_ o: [String: Any]) {
        name = o["name"] as? String ?? ""
        dir = o["dir"] as? Bool ?? false
        ignored = o["ignored"] as? Bool ?? false
        status = (o["status"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        changed = o["changed"] as? Int ?? 0
    }
}

/// One `listDir` reply: a folder of a project, `entries` nil on a failure.
/// `root` is the project's absolute folder, when the Mac says.
struct ProjectDirContents {
    let project: String
    let dir: String
    let entries: [ProjectFileEntry]?
    let error: String?
    let root: String?

    init(_ o: [String: Any]) {
        let ok = o["ok"] as? Bool ?? false
        project = o["project"] as? String ?? ""
        dir = o["dir"] as? String ?? ""
        entries = ok ? (o["entries"] as? [[String: Any]] ?? []).map(ProjectFileEntry.init) : nil
        error = ok ? nil : (o["error"] as? String ?? "Couldn't open this folder.")
        root = (o["root"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    }
}

/// A project-relative path: `dir` joined with `name`, `/`-separated.
func projectPath(_ dir: String, _ name: String) -> String {
    dir.isEmpty ? name : "\(dir)/\(name)"
}
