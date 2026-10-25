package cx.lpm.mobile.feature.usage.recap

import cx.lpm.mobile.core.model.RecapTime
import cx.lpm.mobile.core.model.WeeklyRecap
import cx.lpm.mobile.feature.usage.stats.parseUsageDate
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.floor

// The weekly recap card's words and numbers, ported from the desktop's
// `weeklyRecapModel.ts` (`recapView`, `recapCaption`) so both phones and the desktop
// print the same card.

data class RecapTile(val id: String, val value: String, val label: String)

data class RecapLines(val added: String, val removed: String)

/** One agent's share of the week's agent time. */
data class MixSlice(val label: String, val percent: Double)

data class RecapView(
    val range: String,
    val hours: String,
    /** "↑ 7h on last week", only once the week is over and beat the one before. */
    val gain: String?,
    val tiles: List<RecapTile>,
    val lines: RecapLines,
    val mix: List<MixSlice>,
    val empty: Boolean
)

private const val MINUTE = 60_000L
private const val HOUR = 60 * MINUTE

private val AgentLabels = mapOf("claude" to "Claude", "codex" to "Codex")

/** JavaScript's `Math.round`: halves go up. */
private fun jsRound(value: Double): Long = floor(value + 0.5).toLong()

private fun grouped(value: Long, locale: Locale): String =
    NumberFormat.getIntegerInstance(locale).format(value)

/** "54h 1m", "3h", "45m". */
fun formatAgentTime(ms: Long): String {
    val minutes = jsRound(maxOf(0L, ms).toDouble() / MINUTE)
    if (minutes < 60) return "${minutes}m"
    val hours = minutes / 60
    val rest = minutes % 60
    return if (rest > 0) "${hours}h ${rest}m" else "${hours}h"
}

private fun formatGain(ms: Long): String = if (ms >= HOUR) {
    "${jsRound(ms.toDouble() / HOUR)}h"
} else {
    "${jsRound(ms.toDouble() / MINUTE)}m"
}

// The en dash between thin spaces, as iOS's DateIntervalFormatter and the desktop's
// Intl.DateTimeFormat.formatRange write a range.
private const val RANGE_DASH = "\u2009–\u2009"

/** The week's first and last day: "Oct 12 – 18", "Sep 28 – Oct 4". */
fun weekRangeLabel(first: LocalDate, locale: Locale = Locale.getDefault()): String {
    val last = first.plusDays(6)
    val monthDay = DateTimeFormatter.ofPattern("MMM d", locale)
    return when {
        first.year != last.year -> {
            val full = DateTimeFormatter.ofPattern("MMM d, yyyy", locale)
            first.format(full) + RANGE_DASH + last.format(full)
        }

        first.month != last.month -> first.format(monthDay) + RANGE_DASH + last.format(monthDay)

        else -> first.format(monthDay) + RANGE_DASH + last.dayOfMonth
    }
}

/** Each agent's share of the agent time, Claude and Codex by name, busiest first. */
fun agentMix(agents: List<RecapTime>): List<MixSlice> {
    val total = agents.sumOf { it.agentMs }
    if (total <= 0) return emptyList()
    return agents.sortedByDescending { it.agentMs }
        .map { row ->
            MixSlice(
                label = AgentLabels[row.name] ?: row.name.replaceFirstChar { it.uppercaseChar() },
                percent = row.agentMs.toDouble() / total * 100
            )
        }
        .filter { jsRound(it.percent) > 0 }
}

/** "Claude 64%, Codex 36%", or "All Claude" when one agent did it all. */
fun mixText(mix: List<MixSlice>): String {
    if (mix.size == 1) return "All ${mix.single().label}"
    return mix.joinToString(", ") { "${it.label} ${jsRound(it.percent)}%" }
}

/** Short enough for a quarter of the card: exact below 10,000, then k, then M. */
internal fun compactCount(count: Long, locale: Locale = Locale.getDefault()): String {
    if (count < 10_000) return grouped(count, locale)
    val thousands = jsRound(count / 1000.0)
    if (thousands < 1000) return "${thousands}k"
    val millions = BigDecimal(count / 1_000_000.0).setScale(1, RoundingMode.HALF_UP).toPlainString()
    return "${millions.removeSuffix(".0")}M"
}

private fun tile(id: String, count: Long, one: String, many: String, locale: Locale) =
    RecapTile(id, grouped(count, locale), if (count == 1L) one else many)

/** What the card shows. [today] cuts a week still going short: no gain until it's over. */
fun recapView(
    recap: WeeklyRecap,
    today: LocalDate,
    locale: Locale = Locale.getDefault()
): RecapView {
    val agentMs = recap.days.sumOf { it.agentMs }
    val prompts = recap.days.sumOf { it.prompts }
    val first = parseUsageDate(recap.week)
    val over = first != null && first.plusDays(6) < today
    val gain = agentMs - recap.previousAgentMs
    return RecapView(
        range = first?.let { weekRangeLabel(it, locale) }.orEmpty(),
        hours = formatAgentTime(agentMs),
        gain = if (over && recap.previousAgentMs > 0 && gain >= MINUTE) {
            "↑ ${formatGain(gain)} on last week"
        } else {
            null
        },
        tiles = listOf(
            tile("prompts", prompts, "prompt", "prompts", locale),
            tile("sessions", recap.sessions, "agent session", "agent sessions", locale)
        ),
        lines = RecapLines(
            added = "+" + compactCount(recap.linesAdded, locale),
            removed = "−" + compactCount(recap.linesRemoved, locale)
        ),
        mix = agentMix(recap.agents),
        empty = agentMs == 0L
    )
}

/** The words that go with the card when it's shared: only what the card itself shows. */
fun recapCaption(view: RecapView): String {
    val counts = view.tiles
        .filter { it.id == "prompts" }
        .map { "${it.value} ${it.label}" }
    val parts = listOf("${view.hours} of agents working for me") + counts
    return "My week in lpm: ${parts.joinToString(", ")}."
}

/** English's list of names, as `Intl.ListFormat("en")` joins them: "A, B, and C". */
fun joinedNames(names: List<String>): String = when (names.size) {
    0, 1 -> names.joinToString("")
    2 -> "${names[0]} and ${names[1]}"
    else -> names.dropLast(1).joinToString(", ") + ", and " + names.last()
}
