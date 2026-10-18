package cx.lpm.mobile.feature.usage.widget

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.serialization.Serializable

/** One day of agent usage as the Token activity widget draws it. */
@Serializable
data class TokenActivityDay(
    /** "YYYY-MM-DD", the Mac's calendar day. */
    val date: String,
    val claudeTokens: Long,
    val codexTokens: Long,
    /** Estimated USD, priced on the phone as the Stats screen prices it. */
    val cost: Double
) {
    val totalTokens: Long get() = claudeTokens + codexTokens
}

/**
 * What the app last read for the widget (iOS `TokenActivitySnapshot`): every
 * computer's days over the last 30, as the active Mac counted them.
 */
@Serializable
data class TokenActivitySnapshot(
    /** When the Mac read them, unix millis; the last day shown is this one's. */
    val generatedAt: Long,
    /** The days that had usage, oldest first. */
    val days: List<TokenActivityDay>
) {
    /** The [count] days ending on the read's day, empty ones filled in. */
    fun window(
        count: Int,
        today: LocalDate = LocalDate.now(),
        zone: ZoneId = ZoneId.systemDefault()
    ): TokenActivityWindow {
        val byDate = days.associateBy { it.date }
        val end = Instant.ofEpochMilli(generatedAt).atZone(zone).toLocalDate()
        val shown = (count - 1 downTo 0).map { back ->
            val key = end.minusDays(back.toLong()).toString()
            byDate[key] ?: TokenActivityDay(key, 0, 0, 0.0)
        }
        return TokenActivityWindow(shown, endsToday = end == today)
    }
}

data class TokenActivityWindow(
    val days: List<TokenActivityDay>,
    /** False once the read is a day or more old: the last bar is then dated. */
    val endsToday: Boolean
) {
    val tokens: Long get() = days.sumOf { it.totalTokens }
    val cost: Double get() = days.sumOf { it.cost }
}
