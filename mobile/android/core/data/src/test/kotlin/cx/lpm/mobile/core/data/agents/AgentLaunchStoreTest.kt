package cx.lpm.mobile.core.data.agents

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.testing.FakeSocket
import cx.lpm.mobile.core.data.testing.SessionHarness
import cx.lpm.mobile.core.model.AgentLaunch
import cx.lpm.mobile.core.model.TerminalInfo
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AgentLaunchStoreTest {
    private val features = listOf(
        LpmClient.AGENT_LAUNCH_FEATURE,
        LpmClient.AGENT_SESSIONS_FEATURE,
        LpmClient.LIST_DIR_FEATURE
    )

    private fun TestScope.settle(millis: Long = 0) {
        testScheduler.advanceTimeBy(millis)
        testScheduler.runCurrent()
    }

    private fun FakeSocket.terminals(vararg ids: String) {
        val list = ids.joinToString(",") { """{"id":"$it","label":"$it","project":"storefront"}""" }
        receive("""{"t":"terminals","project":"storefront","terminals":[$list]}""")
    }

    private fun FakeSocket.sessions(
        search: String,
        vararg titles: String,
        hasMore: Boolean = false
    ) {
        val rows = titles.mapIndexed { i, title ->
            """{"key":"claude:$i","provider":"claude","sessionId":"$i",""" +
                """"title":"$title","preview":"","updatedAt":0}"""
        }.joinToString(",")
        receive(
            """{"t":"agentSessions","project":"storefront","search":"$search",""" +
                """"limit":40,"ok":true,""" +
                """"hasMore":$hasMore,"sessions":[$rows]}"""
        )
    }

    @Test
    fun `the flags gate each feature`() = runTest {
        val h = SessionHarness(this)
        h.connectReady()
        val store = h.session.store<AgentLaunchStore>()
        assertFalse(store.canLaunchAgents)
    }

    @Test
    fun `options arrive in the Mac's order`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        val store = h.session.store<AgentLaunchStore>()
        assertTrue(store.canLaunchAgents)
        assertNull(store.state.value.options)

        store.loadOptions()
        assertEquals(1, socket.sentOf("agentOptions").size)
        socket.receive(
            """{"t":"agentOptions","agents":[{"id":"codex","label":"Codex","models":[]},""" +
                """{"id":"claude","label":"Claude Code","models":[]}]}"""
        )
        settle()
        assertEquals(listOf("codex", "claude"), store.state.value.options?.map { it.id })
    }

    @Test
    fun `a new tab with an agent opens once it lands`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        socket.terminals("t1")
        settle()
        val spawned = mutableListOf<TerminalInfo>()
        h.session.store<AgentLaunchStore>().newTerminal(
            "storefront",
            AgentLaunch("claude", "opus", "", "Fix the failing test")
        ) { spawned += it }

        val sent = socket.sentOf("newTerminal").single()
        assertEquals(JsonPrimitive("claude"), sent["agent"])
        assertEquals(JsonPrimitive("opus"), sent["model"])
        assertNull(sent["effort"])
        assertEquals(JsonPrimitive("Fix the failing test"), sent["prompt"])
        assertTrue("storefront" in h.terminals.state.value.creatingTerminals)

        socket.terminals("t1", "t2")
        settle()
        assertEquals(listOf("t2"), spawned.map { it.id })
    }

    @Test
    fun `sessions load, page and drop an answer for an older search`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        val store = h.session.store<AgentLaunchStore>()

        store.loadSessions("storefront", "")
        assertEquals(true, store.state.value.sessions["storefront"]?.loading)
        socket.sessions("", "Fix checkout tax rounding", "Add Apple Pay", hasMore = true)
        settle()
        val first = store.state.value.sessions.getValue("storefront")
        assertEquals(
            listOf("Fix checkout tax rounding", "Add Apple Pay"),
            first.rows.map {
                it.title
            }
        )
        assertTrue(first.loaded && first.hasMore && !first.loading)

        store.loadOlderSessions("storefront")
        assertEquals(JsonPrimitive(80), socket.sentOf("agentSessions").last()["limit"])

        store.loadSessions("storefront", "tax")
        assertEquals(JsonPrimitive(40), socket.sentOf("agentSessions").last()["limit"])
        socket.sessions("", "Stale row")
        settle()
        assertEquals(true, store.state.value.sessions["storefront"]?.loading)
        socket.sessions("tax", "Fix checkout tax rounding")
        settle()
        assertEquals(
            listOf("Fix checkout tax rounding"),
            store.state.value.sessions["storefront"]?.rows?.map { it.title }
        )
    }

    @Test
    fun `a failure keeps the rows, and silence times out`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        val store = h.session.store<AgentLaunchStore>()
        store.loadSessions("storefront", "")
        socket.sessions("", "Fix checkout tax rounding")
        settle()

        store.loadSessions("storefront", "")
        socket.receive(
            """{"t":"agentSessions","project":"storefront","ok":false,"error":"Not a project"}"""
        )
        settle()
        val failed = store.state.value.sessions.getValue("storefront")
        assertEquals("Not a project", failed.error)
        assertEquals(1, failed.rows.size)

        store.loadSessions("storefront", "")
        settle(20_000)
        assertEquals(
            "The Mac didn't answer in time.",
            store.state.value.sessions["storefront"]?.error
        )
    }

    @Test
    fun `resuming opens the new tab, and a row already in a tab finds it`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        socket.terminals("t1")
        settle()
        val store = h.session.store<AgentLaunchStore>()
        store.loadSessions("storefront", "")
        socket.receive(
            """{"t":"agentSessions","project":"storefront","search":"","ok":true,""" +
                """"hasMore":false,"sessions":[""" +
                """{"provider":"claude","sessionId":"a","title":"In a tab",""" +
                """"updatedAt":0,"openIn":"t1"},""" +
                """{"provider":"codex","sessionId":"b","title":"Migrate cart store",""" +
                """"updatedAt":0}]}"""
        )
        settle()
        val (open, closed) = store.state.value.sessions.getValue("storefront").rows
        assertEquals("t1", store.openTab(open, "storefront")?.id)
        assertNull(store.openTab(closed, "storefront"))

        val spawned = mutableListOf<TerminalInfo>()
        store.resumeSession(closed, "storefront") { spawned += it }
        val sent = socket.sentOf("resumeSession").single()
        assertEquals(JsonPrimitive("codex"), sent["provider"])
        assertEquals(JsonPrimitive("Migrate cart store"), sent["title"])
        socket.terminals("t1", "t3")
        settle()
        assertEquals(listOf("t3"), spawned.map { it.id })
    }

    @Test
    fun `a refused resume stops the placeholder and says why`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady(features)
        socket.terminals("t1")
        settle()
        val store = h.session.store<AgentLaunchStore>()
        store.loadSessions("storefront", "")
        socket.sessions("", "Fix checkout tax rounding")
        settle()
        val row = store.state.value.sessions.getValue("storefront").rows.single()
        store.resumeSession(row, "storefront") {}
        socket.receive(
            """{"t":"resumeSession","ok":false,"project":"storefront",""" +
                """"error":"Open the lpm app on your Mac to resume a session."}"""
        )
        settle()
        assertFalse("storefront" in h.terminals.state.value.creatingTerminals)
        assertEquals(
            "Open the lpm app on your Mac to resume a session.",
            h.session.alerts.alerts.value.actionError
        )
    }
}
