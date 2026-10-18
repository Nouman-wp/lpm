package cx.lpm.mobile.core.model

import kotlinx.serialization.json.JsonObject

/**
 * One entry of a project folder (the `listDir` reply). `status` is the file's git
 * status word, null when unchanged; `changed` counts the changed files anywhere below
 * a folder.
 */
data class ProjectFileEntry(
    val name: String,
    val dir: Boolean,
    val ignored: Boolean,
    val status: String?,
    val changed: Int
) {
    val id: String get() = name

    companion object {
        fun parse(o: JsonObject): ProjectFileEntry = ProjectFileEntry(
            name = o.string("name").orEmpty(),
            dir = o.bool("dir") ?: false,
            ignored = o.bool("ignored") ?: false,
            status = o.string("status")?.ifEmpty { null },
            changed = o.int("changed") ?: 0
        )
    }
}

/**
 * One `listDir` reply: a folder of a project, `entries` null on a failure. `root` is
 * the project's absolute folder, when the Mac says.
 */
data class ProjectDirContents(
    val project: String,
    val dir: String,
    val entries: List<ProjectFileEntry>?,
    val error: String?,
    val root: String?
) {
    companion object {
        fun parse(o: JsonObject): ProjectDirContents {
            val ok = o.bool("ok") ?: false
            return ProjectDirContents(
                project = o.string("project").orEmpty(),
                dir = o.string("dir").orEmpty(),
                entries = if (ok) o.list("entries", ProjectFileEntry::parse) else null,
                error = if (ok) null else o.string("error") ?: "Couldn't open this folder.",
                root = o.string("root")?.ifEmpty { null }
            )
        }
    }
}

/** A project-relative path: `dir` joined with `name`, `/`-separated. */
fun projectPath(dir: String, name: String): String = if (dir.isEmpty()) name else "$dir/$name"
