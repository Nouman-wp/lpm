package cx.lpm.mobile.core.demo

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DemoRecapTest {
    @Test
    fun lastWeekIsTheDesktopsSampleWeek() = runTest {
        val demo = DemoHarness(this)
        val reply = demo.exchange(0.6, "weeklyRecap", "week" to "last").single("weeklyRecap")
        assertEquals("last", reply.string("week"))
        assertEquals(true, reply.bool("ok"))
        val recap = reply.sub("recap")
        assertEquals("2026-10-05", recap.string("week"))
        val days = recap.dictList("days")
        assertEquals("2026-10-11", days.last().string("date"))
        assertEquals(1_880L * 60_000, days.sumOf { it.long("agentMs")!! })
        assertEquals(214L, days.sumOf { it.long("prompts")!! })
        assertEquals((1_880L - 420) * 60_000, recap.long("previousAgentMs"))
        assertEquals(46_248_000L, recap.dictList("projects").first().long("agentMs"))
        assertEquals(4, recap.strings("workedRepos")?.size)
    }

    @Test
    fun thisWeekStopsAtToday() = runTest {
        val demo = DemoHarness(this)
        val recap = demo.exchange(0.6, "weeklyRecap", "week" to "this", "fresh" to true)
            .single("weeklyRecap").sub("recap")
        assertEquals("2026-10-12", recap.string("week"))
        assertEquals(
            listOf(352L, 418L, 296L, 389L, 0L, 0L, 0L),
            recap.dictList("days").map { it.long("agentMs")!! / 60_000 }
        )
    }
}
