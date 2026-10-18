package cx.lpm.mobile.feature.projects.resume

import cx.lpm.mobile.core.model.AgentSession
import java.time.Instant
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AgentSessionGroupsTest {
    private val zone = ZoneId.of("America/Los_Angeles")

    // Saturday 17 October 2026, 18:30 in Los Angeles.
    private val now = LocalDateTime.of(2026, 10, 17, 18, 30).atZone(zone).toInstant()

    private fun at(daysAgo: Long, hour: Int = 9, minute: Int = 41): Long =
        LocalDateTime.of(2026, 10, 17, hour, minute).minusDays(daysAgo)
            .atZone(zone).toInstant().toEpochMilli()

    private fun session(title: String, updatedAt: Long) = AgentSession(
        key = "claude:$title",
        provider = "claude",
        sessionId = title,
        title = title,
        preview = "",
        updatedAt = updatedAt,
        gitBranch = null,
        account = null,
        openIn = null
    )

    @Test
    fun `sessions fall under the desktop's day headings, in the list's order`() {
        val groups = agentSessionGroups(
            listOf(
                session("a", at(0, hour = 0, minute = 0)),
                session("b", at(0, hour = 16)),
                session("c", at(1)),
                session("d", at(2)),
                session("e", at(6)),
                session("f", at(7)),
                session("g", at(29)),
                session("h", at(40)),
                session("i", 0)
            ),
            now,
            zone,
            Locale.US
        )
        assertEquals(
            listOf(
                SessionDay.Today,
                SessionDay.Yesterday,
                SessionDay.EarlierThisWeek,
                SessionDay.EarlierThisMonth,
                SessionDay.Month(YearMonth.of(2026, 9)),
                SessionDay.Older
            ),
            groups.map { it.day }
        )
        assertEquals(
            listOf(listOf("a", "b"), listOf("c"), listOf("d", "e"), listOf("f", "g"), listOf("h"), listOf("i")),
            groups.map { g -> g.rows.map { it.session.title } }
        )
        assertEquals("September 2026", SessionDay.Month(YearMonth.of(2026, 9)).label(Locale.US))
    }

    @Test
    fun `recent sessions show the time of day, older ones the date`() {
        val today = now.atZone(zone).toLocalDate()
        assertEquals("9:41 AM", agentSessionTime(at(0), today, zone, Locale.US))
        assertEquals("9:41 AM", agentSessionTime(at(1), today, zone, Locale.US))
        assertEquals("Oct 15", agentSessionTime(at(2), today, zone, Locale.US))
        assertNull(agentSessionTime(0, today, zone, Locale.US))
    }

    @Test
    fun `a session from the future still reads as today`() {
        val later = Instant.ofEpochMilli(at(0, hour = 23))
        assertEquals(
            SessionDay.Today,
            agentSessionDay(later.toEpochMilli(), now.atZone(zone).toLocalDate(), zone)
        )
    }
}
