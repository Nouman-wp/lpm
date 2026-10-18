package cx.lpm.mobile.core.navigation

import androidx.navigation3.runtime.NavKey
import cx.lpm.mobile.core.model.SessionKey
import kotlinx.serialization.Serializable

/** One folder of a project in Files; [dir] is project-relative, `""` for the project's own. */
@Serializable
data class ProjectFilesKey(
    val project: String,
    val dir: String = "",
    val session: SessionKey = SessionKey.Live
) : NavKey
