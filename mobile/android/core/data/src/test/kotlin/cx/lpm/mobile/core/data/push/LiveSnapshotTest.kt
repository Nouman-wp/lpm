package cx.lpm.mobile.core.data.push

import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.Project
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveSnapshotTest {
    private fun json(text: String) = Json.parseToJsonElement(text) as JsonObject

    private val now = 1_792_089_000_000L

    private fun project(name: String, label: String, entries: String) = Project.parse(
        json("""{"name":"$name","label":"$label","statusEntries":[$entries]}""")
    )

    private fun entry(key: String, value: String, pane: String, at: Long, ended: Long = 0) =
        """{"key":"$key","value":"$value","paneID":"$pane","timestamp":$at,""" +
            """"turnStart":${at - 1_000},"endedAt":$ended}"""

    @Test
    fun opensTheMacsUpdate() {
        val snapshot = LiveSnapshot.parse(
            json(
                """{"serverId":"srv-1","ts":1,"live":true,"waiting":1,"working":5,"agents":[""" +
                    """{"project":"api","projectLabel":"API","terminal":"Claude",""" +
                    """"terminalId":"t-1","key":"claude_code_t-1","agent":"claude",""" +
                    """"state":"Waiting","since":10,""" +
                    """"turnStart":5,"endedAt":0},{"project":"web","state":"Running"}]}"""
            )
        )
        assertEquals("srv-1", snapshot.serverId)
        assertTrue(snapshot.live)
        assertEquals(1, snapshot.waiting)
        assertEquals(5, snapshot.working)
        assertEquals(
            LiveSnapshot.Agent(
                project = "api",
                projectLabel = "API",
                terminal = "Claude",
                terminalId = "t-1",
                key = "claude_code_t-1",
                state = AgentState.NeedsYou,
                since = 10,
                turnStart = 5,
                endedAt = 0
            ),
            snapshot.agents.first()
        )
        assertEquals(AgentState.Working, snapshot.agents[1].state)
        assertEquals("", snapshot.agents[1].terminal)

        val bare = LiveSnapshot.parse(json("""{}"""))
        assertFalse(bare.live)
        assertNull(bare.serverId)
        assertTrue(bare.agents.isEmpty())
    }

    @Test
    fun theLiveMacIsReadTheWayItsOwnUpdateIs() {
        val api = project(
            "api",
            "API",
            listOf(
                entry("claude_code_t-1", "Running", "t-1", now - 60_000),
                entry("codex_t-2", "Waiting", "t-2", now - 120_000),
                entry("gemini_t-3", "Done", "t-3", now - 600_000, ended = now - 300_000),
                entry("cursor_t-4", "Error", "t-4", now - 3_600_000)
            ).joinToString(",")
        )
        val web = project(
            "web-copy",
            "",
            listOf(
                entry("claude_code_w-1", "Running", "w-1", now - 10_000),
                entry("opencode_w-2", "Idle", "w-2", now)
            ).joinToString(",")
        )
        val snapshot = LiveSnapshot.of(
            "srv-1",
            listOf(api, web),
            mapOf("api" to mapOf("t-2" to "Review")),
            now
        )

        assertTrue(snapshot.live)
        assertEquals(1, snapshot.waiting)
        assertEquals(2, snapshot.working)
        // Waiting, then working newest first, then what finished lately; an error an
        // hour old and an idle tab are left out.
        assertEquals(
            listOf("codex_t-2", "claude_code_w-1", "claude_code_t-1", "gemini_t-3"),
            snapshot.agents.map { it.key }
        )
        // A wait reads from when it began; work from its turn; a finished turn holds
        // how long it took.
        val lead = snapshot.agents.first()
        assertEquals("Review", lead.terminal)
        assertEquals("API", lead.projectLabel)
        assertEquals(now - 120_000, lead.since)
        assertEquals(now - 120_000, lead.turnStart)
        assertEquals("web-copy", snapshot.agents[1].projectLabel)
        assertEquals(now - 11_000, snapshot.agents[1].turnStart)
        val done = snapshot.agents[3]
        assertEquals(now - 601_000, done.turnStart)
        assertEquals(now - 300_000, done.endedAt)
        // A tab whose name hasn't loaded reads as its agent, as the widget has it.
        assertEquals("Claude Code", snapshot.agents[1].terminal)
    }

    @Test
    fun atMostFourAreListedButAllAreCounted() {
        val busy = project(
            "api",
            "API",
            (1..6).joinToString(",") { entry("claude_code_$it", "Running", "t-$it", now - it) }
        )
        val snapshot = LiveSnapshot.of("srv-1", listOf(busy), emptyMap(), now)
        assertEquals(6, snapshot.working)
        assertEquals(LiveSnapshot.MAX_AGENTS, snapshot.agents.size)
        assertEquals("claude_code_1", snapshot.agents.first().key)
    }

    @Test
    fun aTabSpeaksOnceForEveryAgentOnIt() {
        val shared = project(
            "api",
            "API",
            listOf(
                entry("claude_code_t-1", "Running", "t-1", now - 5_000),
                entry("codex_t-1", "Waiting", "t-1", now - 2_000)
            ).joinToString(",")
        )
        val snapshot = LiveSnapshot.of("srv-1", listOf(shared), emptyMap(), now)
        assertEquals(listOf("codex_t-1"), snapshot.agents.map { it.key })
        assertEquals(1, snapshot.waiting)
        assertEquals(0, snapshot.working)
    }

    @Test
    fun nothingAtWorkIsTheFinalUpdate() {
        val done = project("api", "API", entry("claude_code_t-1", "Done", "t-1", now - 5_000, now))
        val snapshot = LiveSnapshot.of("srv-1", listOf(done), emptyMap(), now)
        assertFalse(snapshot.live)
        assertEquals(0, snapshot.waiting + snapshot.working)
        assertEquals(AgentState.Done, snapshot.agents.single().state)
    }
}
