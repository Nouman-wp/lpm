package cx.lpm.mobile.core.data.push

import cx.lpm.mobile.core.model.string
import kotlinx.serialization.json.JsonObject

/**
 * Monday's "Your week in lpm is ready" from one Mac: shown with the Mac's own title
 * and body, and opens that Mac's weekly recap on last week.
 */
data class PushRecap(
    val serverId: String?,
    /** The Monday the week starts, "YYYY-MM-DD". */
    val week: String,
    val title: String,
    val body: String,
    val key: String
) {
    companion object {
        const val TARGET = "recap"

        fun parse(o: JsonObject): PushRecap? {
            if (o.string("target") != TARGET) return null
            val title = o.string("title").orEmpty()
            val body = o.string("body").orEmpty()
            if (title.isEmpty() && body.isEmpty()) return null
            val week = o.string("week").orEmpty()
            return PushRecap(
                serverId = o.string("serverId")?.takeIf { it.isNotEmpty() },
                week = week,
                title = title,
                body = body,
                key = o.string("key")?.takeIf { it.isNotEmpty() } ?: "recap:$week"
            )
        }
    }
}
