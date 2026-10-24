package cx.lpm.mobile.core.data.git

import cx.lpm.mobile.core.data.testing.FakeSocket
import cx.lpm.mobile.core.data.testing.SessionHarness
import cx.lpm.mobile.core.data.testing.settleAlive
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GitCommitPushTest {
    private fun FakeSocket.reply(t: String, fields: String) =
        receive("""{"t":"$t","project":"storefront",$fields}""")

    private fun TestScope.settle() = testScheduler.runCurrent()

    @Test
    fun `commit and push pushes once the commit lands, then ticks and announces both`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady()
        val git = h.session.store<GitStore>()
        git.commitAndPush("storefront", "feat: x", listOf("a.ts"))
        assertTrue("storefront" in git.state.value.commitPushing)
        assertEquals(1, socket.sentOf("gitCommit").size)
        assertTrue("nothing pushes before the commit lands", socket.sentOf("gitPush").isEmpty())

        socket.reply("gitCommit", """"ok":true""")
        settle()
        var state = git.state.value
        assertEquals(1, socket.sentOf("gitPush").size)
        assertTrue("storefront" in state.pushing)
        assertNull("the draft stays until the push finishes", state.commitTick["storefront"])
        assertNull(state.notice["storefront"])
        assertEquals("the commit refreshes the snapshot", 1, socket.sentOf("git").size)

        socket.reply("gitPush", """"ok":true""")
        settle()
        state = git.state.value
        assertTrue(state.commitPushing.isEmpty())
        assertTrue(state.pushing.isEmpty())
        assertEquals(1, state.commitTick["storefront"])
        assertEquals("Committed and pushed", state.notice["storefront"]?.text)
        assertNull(state.opError["storefront"])
    }

    @Test
    fun `a push that fails after the commit keeps the commit and says so`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady()
        val git = h.session.store<GitStore>()
        git.commitAndPush("storefront", "feat: x", listOf("a.ts"))
        socket.reply("gitCommit", """"ok":true""")
        settle()
        socket.reply("gitPush", """"ok":false,"error":"rejected: fetch first"""")
        settle()
        val state = git.state.value
        assertEquals(
            GitOpError("Committed, but not pushed", "rejected: fetch first"),
            state.opError["storefront"]
        )
        assertEquals("the commit landed, so its draft clears", 1, state.commitTick["storefront"])
        assertTrue(state.commitPushing.isEmpty())

        git.push("storefront")
        socket.reply("gitPush", """"ok":true""")
        settle()
        assertEquals(
            "a push of its own reads as before",
            "Pushed",
            git.state.value.notice["storefront"]?.text
        )
        assertEquals(1, git.state.value.commitTick["storefront"])
    }

    @Test
    fun `a failed commit never pushes`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady()
        val git = h.session.store<GitStore>()
        git.commitAndPush("storefront", "feat: x", listOf("a.ts"))
        socket.reply("gitCommit", """"ok":false,"error":"hook failed"""")
        settle()
        val state = git.state.value
        assertEquals(GitOpError("Commit failed", "hook failed"), state.opError["storefront"])
        assertTrue(socket.sentOf("gitPush").isEmpty())
        assertTrue(state.commitPushing.isEmpty())
        assertNull(state.commitTick["storefront"])
    }

    @Test
    fun `a push that times out after the commit still keeps the commit`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady()
        val git = h.session.store<GitStore>()
        git.commitAndPush("storefront", "feat: x", listOf("a.ts"))
        socket.reply("gitCommit", """"ok":true""")
        settle()
        settleAlive(socket, 120_000)
        val state = git.state.value
        assertEquals(
            GitOpError(
                "Committed, but not pushed",
                "Push timed out. Check your Mac and try again."
            ),
            state.opError["storefront"]
        )
        assertEquals(1, state.commitTick["storefront"])
        assertTrue(state.pushing.isEmpty())
    }

    @Test
    fun `nothing starts while a push is out`() = runTest {
        val h = SessionHarness(this)
        val socket = h.connectReady()
        val git = h.session.store<GitStore>()
        git.push("storefront")
        git.commitAndPush("storefront", "feat: x", listOf("a.ts"))
        assertTrue(socket.sentOf("gitCommit").isEmpty())
        assertTrue(git.state.value.commitPushing.isEmpty())
    }
}
