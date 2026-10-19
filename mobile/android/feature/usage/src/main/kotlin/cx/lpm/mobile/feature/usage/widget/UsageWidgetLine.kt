package cx.lpm.mobile.feature.usage.widget

import cx.lpm.mobile.feature.usage.rows.UsageAccountMark
import cx.lpm.mobile.feature.usage.stats.formatTokenCount

/** One usage row as of a moment — the projects list's `UsageRow` (iOS `UsageWidgetLine`). */
data class UsageWidgetLine(
    val id: String,
    val label: String,
    val mark: UsageAccountMark?,
    val provider: String,
    /** The bar is a window's, in the limit tint; otherwise the day's spend, in the tool's color. */
    val windowed: Boolean,
    val fraction: Double,
    val pace: Double?,
    /** When the window resets, today's spend without a window, or a dash. */
    val detail: String,
    val percentText: String,
    val windowLabel: String,
    /** "5h" beside the reset for the 5-hour window; empty for the weekly one. */
    val windowShort: String,
    val stale: Boolean
)

/**
 * The rows the widget has room for: the account in use, then the fullest, in the order
 * the app lists them so a row keeps its place.
 */
fun usageWidgetLines(rows: List<UsageWidgetRow>, now: Double, shown: Int): List<UsageWidgetLine> {
    val readings = rows.map { it.reading(now) }
    // Rows without a window are measured against each other, as on the projects list.
    val peak =
        rows.zip(readings).filter { !it.second.hasWindow }.maxOfOrNull { it.first.tokens } ?: 0
    val lines = rows.zip(readings).map { (row, reading) ->
        val windowed = reading.hasWindow
        UsageWidgetLine(
            id = row.id,
            label = row.label,
            mark = row.mark,
            provider = row.provider,
            windowed = windowed,
            fraction = reading.fraction ?: if (peak > 0) row.tokens.toDouble() / peak else 0.0,
            pace = reading.pace,
            detail = when {
                windowed -> reading.reset
                row.tokens > 0 -> "${formatTokenCount(row.tokens)} today"
                else -> "—"
            },
            percentText = reading.percentText,
            windowLabel = if (windowed) reading.main.label else "",
            windowShort = if (windowed) reading.main.short else "",
            stale = row.stale(now)
        )
    }
    if (lines.size <= shown) return lines
    val kept = lines
        .sortedWith(
            compareByDescending<UsageWidgetLine> { it.mark == UsageAccountMark.Current }
                .thenByDescending { it.fraction }
        )
        .take(shown)
        .map { it.id }
        .toSet()
    return lines.filter { it.id in kept }
}
