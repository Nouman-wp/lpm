package cx.lpm.mobile.feature.projects.resume

import cx.lpm.mobile.core.model.AgentSession
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/** The day heading a past session sits under, as the desktop's Resume session list names it. */
sealed interface SessionDay {
    data object Today : SessionDay

    data object Yesterday : SessionDay

    /** Two to six days ago. */
    data object EarlierThisWeek : SessionDay

    /** Seven to 29 days ago. */
    data object EarlierThisMonth : SessionDay

    /** Further back: the month and year ("September 2026"). */
    data class Month(val month: YearMonth) : SessionDay

    /** When it last ran is unknown. */
    data object Older : SessionDay
}

/** One past session with when it last ran, as its row shows it. */
data class ResumeRow(val session: AgentSession, val time: String?)

/** A run of consecutive sessions under one day heading. */
data class AgentSessionGroup(val id: Int, val day: SessionDay, val rows: List<ResumeRow>)

/** Sessions bucketed by day, keeping the list's order (iOS `agentSessionGroups`). */
fun agentSessionGroups(
    sessions: List<AgentSession>,
    now: Instant,
    zone: ZoneId,
    locale: Locale = Locale.getDefault()
): List<AgentSessionGroup> {
    val today = now.atZone(zone).toLocalDate()
    val groups = mutableListOf<AgentSessionGroup>()
    for (session in sessions) {
        val day = agentSessionDay(session.updatedAt, today, zone)
        val row = ResumeRow(session, agentSessionTime(session.updatedAt, today, zone, locale))
        val last = groups.lastOrNull()
        if (last?.day == day) {
            groups[groups.lastIndex] = last.copy(rows = last.rows + row)
        } else {
            groups += AgentSessionGroup(groups.size, day, listOf(row))
        }
    }
    return groups
}

fun agentSessionDay(updatedAt: Long, today: LocalDate, zone: ZoneId): SessionDay {
    if (updatedAt <= 0) return SessionDay.Older
    val at = Instant.ofEpochMilli(updatedAt)
    fun since(daysBack: Long) =
        !at.isBefore(today.minusDays(daysBack).atStartOfDay(zone).toInstant())
    return when {
        since(0) -> SessionDay.Today
        since(1) -> SessionDay.Yesterday
        since(EARLIER_THIS_WEEK) -> SessionDay.EarlierThisWeek
        since(EARLIER_THIS_MONTH) -> SessionDay.EarlierThisMonth
        else -> SessionDay.Month(YearMonth.from(at.atZone(zone)))
    }
}

/**
 * When a session last ran: the time of day for today and yesterday ("9:41 AM"), the
 * date before that ("Oct 12"); null when unknown.
 */
fun agentSessionTime(updatedAt: Long, today: LocalDate, zone: ZoneId, locale: Locale): String? {
    if (updatedAt <= 0) return null
    val at = Instant.ofEpochMilli(updatedAt).atZone(zone)
    val format = if (!at.toLocalDate().isBefore(today.minusDays(1))) {
        DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale)
    } else {
        DateTimeFormatter.ofPattern("MMM d", locale)
    }
    return format.format(at)
}

/** "September 2026" for a session older than this month. */
fun SessionDay.Month.label(locale: Locale = Locale.getDefault()): String =
    DateTimeFormatter.ofPattern("MMMM yyyy", locale).format(month)

private const val EARLIER_THIS_WEEK = 6L
private const val EARLIER_THIS_MONTH = 29L
