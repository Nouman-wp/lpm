package cx.lpm.mobile.core.push

import cx.lpm.mobile.core.data.push.LiveSnapshot
import cx.lpm.mobile.core.model.AgentState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveCardTest {
    private val now = 1_792_089_000_000L

    private fun agent(
        tab: String,
        state: AgentState,
        project: String = "api",
        label: String = "",
        key: String = "claude_code_$tab",
        since: Long = 0,
        turnStart: Long = 0,
        endedAt: Long = 0
    ) = LiveSnapshot.Agent(project, label, tab, "t-$tab", key, state, since, turnStart, endedAt)

    private fun card(vararg agents: LiveSnapshot.Agent, live: Boolean = true) = LiveCard.of(
        "srv-1",
        "MacBook Pro",
        LiveSnapshot("srv-1", live, waiting = 9, working = 9, agents = agents.toList()),
        now
    )

    private val rateLimiting = agent(
        "Rate limiting",
        AgentState.NeedsYou,
        project = "api-gateway",
        since = now - 40_000,
        turnStart = now - 40_000
    )
    private val checkout = agent(
        "Checkout flow",
        AgentState.Working,
        project = "storefront",
        turnStart = now - 45 * 60_000
    )
    private val claude2 = agent(
        "Claude 2",
        AgentState.Error,
        project = "storefront",
        since = now - 120_000
    )

    @Test
    fun theMostUrgentComeFirstAndTheProjectShowsOncePerRun() {
        val card = card(
            checkout,
            claude2,
            rateLimiting,
            agent("Docs", AgentState.Done, turnStart = now - 60_000, endedAt = now - 1_000)
        )
        assertEquals(
            listOf(
                LiveCard.Entry("api-gateway", "Rate limiting", problem = false, time = "40s"),
                LiveCard.Entry("storefront", "Checkout flow", problem = false, time = "45m"),
                LiveCard.Entry(null, "Claude 2", problem = true, time = "2m")
            ),
            card.entries
        )
        assertEquals("MacBook Pro", card.macName)
        assertEquals(LiveCard.Tone.NeedsYou, card.tone)
        assertFalse(card.ended)
        // The header counts from when the wait began.
        assertEquals(now - 40_000, card.countingFrom)
        assertEquals(LiveCard.Open("api-gateway", "t-Rate limiting"), card.open)
    }

    @Test
    fun aProjectThatComesBackIsNamedAgain() {
        val card = card(
            agent("One", AgentState.Working, project = "api", label = "API"),
            agent("Two", AgentState.Working, project = "web"),
            agent("Three", AgentState.Working, project = "api", label = "API")
        )
        assertEquals(listOf("API", "web", "API"), card.entries.map { it.project })
    }

    @Test
    fun workCountsFromItsTurnInTheWidgetsShortForm() {
        val card = card(
            agent("Build", AgentState.Working, since = now - 5_000, turnStart = now - 74 * 60_000)
        )
        assertEquals("1h 14m", card.lead?.time)
        assertEquals(LiveCard.Tone.Working, card.tone)
        assertEquals(now - 74 * 60_000, card.countingFrom)
        assertNull(card.at)

        // A turn never seen starting counts from its state; one seen neither way has no time.
        val unseen = card(
            agent("", AgentState.Working, key = "codex_1", since = now - 3_000),
            agent("Quiet", AgentState.Working)
        )
        assertEquals("3s", unseen.lead?.time)
        // An unnamed tab reads as its agent.
        assertEquals("Codex", unseen.lead?.tab)
        assertNull(unseen.entries[1].time)
    }

    @Test
    fun theFinalReadingHoldsHowLongEachTook() {
        val card = card(
            agent(
                "Docs",
                AgentState.Done,
                turnStart = now - 10 * 60_000,
                endedAt = now - 5 * 60_000
            ),
            agent("Lint", AgentState.Error, project = "web", since = now - 30_000),
            live = false
        )
        assertTrue(card.ended)
        assertEquals(LiveCard.Tone.Done, card.tone)
        assertNull(card.countingFrom)
        assertEquals(now - 5 * 60_000, card.at)
        assertEquals(
            listOf(
                LiveCard.Entry("api", "Docs", problem = false, time = "5m"),
                LiveCard.Entry("web", "Lint", problem = true, time = "30s")
            ),
            card.entries
        )
        assertEquals(LiveCard.Open("api", "t-Docs"), card.open)

        val empty = card(live = false)
        assertTrue(empty.ended)
        assertNull(empty.lead)
        assertNull(empty.open)
    }

    @Test
    fun anEndEventEndsWhateverItListed() {
        val pushed = LiveSnapshot("srv-1", true, 0, 1, listOf(checkout))
        val card = LiveCard.of("srv-1", null, pushed.ended(), now)
        assertTrue(card.ended)
        assertEquals(LiveCard.Tone.Done, card.tone)
        assertNull(card.countingFrom)
    }
}
