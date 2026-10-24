package cx.lpm.mobile.core.push

import cx.lpm.mobile.core.data.prefs.NotificationPrefs
import cx.lpm.mobile.core.data.projects.ProjectsStore
import cx.lpm.mobile.core.data.terminals.TerminalsStore
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.testing.TestSession
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LivePublisherTest {
    private val projects =
        """{"t":"projects","projects":[{"name":"api","label":"API","running":true,""" +
            """"statusEntries":[{"key":"claude_code_t-1","value":"Running","paneID":"t-1",""" +
            """"timestamp":1792089000000,"turnStart":1792088990000}]}]}"""

    private fun TestSession.reading(notify: NotificationPrefs = NotificationPrefs()) = reading(
        session.state.value,
        session.link.state.value,
        store<ProjectsStore>().state.value,
        store<TerminalsStore>().state.value,
        notify,
        session.client
    )

    @Test
    fun aMacThatTakesOverShowsItsAgentsFromTheLiveLink() = runTest {
        val t = TestSession(this)
        val socket = t.connectReady(features = listOf("liveActivity"))
        assertNull(t.reading())
        socket.receive(projects)
        t.scheduler.runCurrent()

        val (macId, snapshot) = t.reading()!!
        assertEquals("srv-1", macId)
        assertEquals("srv-1", snapshot.serverId)
        assertTrue(snapshot.live)
        assertEquals(1, snapshot.working)
        assertEquals(AgentState.Working, snapshot.agents.single().state)
        assertEquals("API", snapshot.agents.single().projectLabel)

        assertNull(t.reading(NotificationPrefs(liveActivity = false)))
    }

    @Test
    fun aMacThatCantTakeOverShowsNoCard() = runTest {
        val t = TestSession(this)
        val socket = t.connectReady()
        socket.receive(projects)
        t.scheduler.runCurrent()
        assertNull(t.reading())
    }

    @Test
    fun demoModeShowsNoCard() = runTest {
        val t = TestSession(this)
        t.enterDemo()
        t.scheduler.advanceTimeBy(2_000)
        t.scheduler.runCurrent()
        assertNull(t.reading())
    }
}
