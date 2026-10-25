package cx.lpm.mobile.feature.usage.recap

import cx.lpm.mobile.core.model.RecapDay
import cx.lpm.mobile.core.model.RecapTime
import cx.lpm.mobile.core.model.WeeklyRecap
import java.time.LocalDate
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecapViewTest {
    private val minute = 60_000L
    private val hour = 60 * minute
    private val us = Locale.US

    // The desktop demo's sample week (desktop/frontend/src/demo/seed/sample/recap.ts).
    private val minutes = listOf(352L, 418L, 296L, 389L, 241L, 184L, 0L)
    private val prompts = listOf(38L, 41L, 33L, 36L, 29L, 37L, 0L)
    private val total = minutes.sum() * minute

    private fun sample(
        week: String = "2026-10-05",
        days: List<RecapDay> = minutes.indices.map { i ->
            RecapDay(
                LocalDate.parse(week).plusDays(i.toLong()).toString(),
                minutes[i] * minute,
                prompts[i]
            )
        }
    ) = WeeklyRecap(
        week = week,
        days = days,
        previousAgentMs = total - 7 * hour,
        sessions = 58,
        projects = listOf(0.41, 0.24, 0.16, 0.12, 0.07).zip(
            listOf("saas-app", "auth-service", "docs-site", "ml-pipeline", "mobile-app")
        ) { share, name -> RecapTime(name, Math.round(total * share)) },
        agents = listOf(
            RecapTime("claude", Math.round(total * 0.64)),
            RecapTime("codex", Math.round(total * 0.36))
        ),
        workedRepos = listOf("auth-service", "ml-pipeline", "mobile-app", "saas-app")
            .map { "github.com/acme/$it" },
        linesAdded = 6_120,
        linesRemoved = 2_407
    )

    @Test
    fun `the sample week reads like the desktop card`() {
        val view = recapView(sample(), today = LocalDate.of(2026, 10, 15), locale = us)
        assertEquals("Oct 5\u2009–\u200911", view.range)
        assertEquals("31h 20m", view.hours)
        assertEquals("↑ 7h on last week", view.gain)
        assertEquals(
            listOf(
                RecapTile("prompts", "214", "prompts"),
                RecapTile("sessions", "58", "agent sessions")
            ),
            view.tiles
        )
        assertEquals(RecapLines("+6,120", "−2,407"), view.lines)
        assertEquals("Claude 64%, Codex 36%", mixText(view.mix))
        assertFalse(view.empty)
        assertEquals(
            "My week in lpm: 31h 20m of agents working for me, 214 prompts.",
            recapCaption(view)
        )
    }

    @Test
    fun `a week still going has no gain`() {
        val view = recapView(
            sample(week = "2026-10-12"),
            today = LocalDate.of(2026, 10, 18),
            locale = us
        )
        assertNull(view.gain)
        assertEquals(listOf("prompts", "sessions"), view.tiles.map { it.id })
        assertEquals(
            "My week in lpm: 31h 20m of agents working for me, 214 prompts.",
            recapCaption(view)
        )
    }

    @Test
    fun `a week across months names both`() {
        assertEquals("Sep 28\u2009–\u2009Oct 4", weekRangeLabel(LocalDate.of(2026, 9, 28), us))
        assertEquals(
            "Dec 28, 2026\u2009–\u2009Jan 3, 2027",
            weekRangeLabel(LocalDate.of(2026, 12, 28), us)
        )
    }

    @Test
    fun `agent time reads in hours and minutes`() {
        assertEquals("0m", formatAgentTime(0))
        assertEquals("45m", formatAgentTime(45 * minute))
        assertEquals("3h", formatAgentTime(3 * hour + 20_000))
        assertEquals("54h 1m", formatAgentTime(54 * hour + minute))
        assertEquals("1h", formatAgentTime(59 * minute + 30_000))
    }

    @Test
    fun `a small gain counts in minutes and under a minute none at all`() {
        val week = sample()
        val today = LocalDate.of(2026, 10, 20)
        assertEquals(
            "↑ 25m on last week",
            recapView(week.copy(previousAgentMs = total - 25 * minute), today, us).gain
        )
        assertNull(recapView(week.copy(previousAgentMs = total - 59_000), today, us).gain)
        assertNull(recapView(week.copy(previousAgentMs = 0), today, us).gain)
    }

    @Test
    fun `missing computers are listed as English joins them`() {
        assertEquals("build-box", joinedNames(listOf("build-box")))
        assertEquals("a and b", joinedNames(listOf("a", "b")))
        assertEquals("a, b, and c", joinedNames(listOf("a", "b", "c")))
    }

    @Test
    fun `lines are exact below ten thousand, then thousands, then millions`() {
        assertEquals("9,999", compactCount(9_999, us))
        assertEquals("10k", compactCount(10_000, us))
        assertEquals("664k", compactCount(663_700, us))
        assertEquals("1M", compactCount(999_500, us))
        assertEquals("1.2M", compactCount(1_234_567, us))
        assertEquals("2M", compactCount(2_010_000, us))
    }

    @Test
    fun `agents read busiest first, slivers drop out, one alone reads as all`() {
        val mix = agentMix(
            listOf(
                RecapTime("codex", 10),
                RecapTime("gemini", 60),
                RecapTime("opencode", 30),
                RecapTime("cursor", 0)
            )
        )
        assertEquals("Gemini 60%, Opencode 30%, Codex 10%", mixText(mix))
        assertEquals("All Claude", mixText(agentMix(listOf(RecapTime("claude", 5)))))
        assertEquals(
            "All Claude",
            mixText(agentMix(listOf(RecapTime("claude", 999), RecapTime("codex", 1))))
        )
        assertTrue(agentMix(emptyList()).isEmpty())
    }

    @Test
    fun `a week without agent time is empty`() {
        val idle = sample(days = listOf(RecapDay("2026-10-05", 0, 3)))
        assertTrue(recapView(idle, LocalDate.of(2026, 10, 20), us).empty)
    }

    @Test
    fun `one of a kind reads singular`() {
        val one = sample().copy(
            sessions = 1,
            days = listOf(RecapDay("2026-10-05", hour, 1))
        )
        val view = recapView(one, LocalDate.of(2026, 10, 20), us)
        assertEquals(
            listOf("prompt", "agent session"),
            view.tiles.map { it.label }
        )
        assertEquals(
            "My week in lpm: 1h of agents working for me, 1 prompt.",
            recapCaption(view)
        )
    }
}
