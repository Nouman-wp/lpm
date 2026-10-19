package cx.lpm.mobile.feature.usage.widget

import cx.lpm.mobile.core.model.LimitWindow
import cx.lpm.mobile.feature.usage.rows.UsageAccountMark
import cx.lpm.mobile.feature.usage.usage.STALE_MS
import cx.lpm.mobile.feature.usage.usage.UsageReading
import kotlinx.serialization.Serializable

/**
 * A plan window as the Usage widget keeps it (iOS `UsageWidgetWindow`): a
 * [LimitWindow] with a missing figure left out, as JSON has no not-a-number.
 */
@Serializable
data class UsageWidgetWindow(
    val usedPercent: Double? = null,
    /** Unix SECONDS, stamped by the tool's own servers; 0 when it didn't say. */
    val resetsAt: Long
) {
    val limit: LimitWindow get() = LimitWindow(usedPercent ?: Double.NaN, resetsAt)

    companion object {
        fun of(win: LimitWindow): UsageWidgetWindow =
            UsageWidgetWindow(win.usedPercent.takeIf { it.isFinite() }, win.resetsAt)
    }
}

/**
 * One usage row as the Usage widget draws it (iOS `UsageWidgetRow`): the projects
 * list's row, with the windows it's read from, so the countdowns and pace ticks keep
 * moving after the app has gone.
 */
@Serializable
data class UsageWidgetRow(
    val id: String,
    val provider: String,
    val label: String,
    val mark: UsageAccountMark? = null,
    val weekly: UsageWidgetWindow? = null,
    val fiveHour: UsageWidgetWindow? = null,
    /** Today's spend, which stands in for a tool with no window. */
    val tokens: Long = 0,
    /** Millis on the phone's clock the tool last reported at; null when it never has. */
    val updatedAt: Long? = null
) {
    fun reading(now: Double): UsageReading = UsageReading(weekly?.limit, fiveHour?.limit, now)

    fun stale(now: Double): Boolean = updatedAt?.let { now - it > STALE_MS } ?: false
}

/** The usage rows of the Mac the app last had live (iOS `UsageWidgetMac`). */
@Serializable
data class UsageWidgetMac(
    /** The Mac's server id, or its local id for a Mac too old to send one. */
    val id: String,
    val rows: List<UsageWidgetRow>,
    /** Millis the phone last had these rows live. */
    val seenAt: Long? = null
)
