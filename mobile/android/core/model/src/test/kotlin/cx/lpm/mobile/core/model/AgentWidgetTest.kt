package cx.lpm.mobile.core.model

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class AgentWidgetTest {
    private val now = 1_000_000L

    private fun entry(
        key: String,
        value: String,
        timestamp: Long,
        pane: String = "",
        turnStart: Long = 0
    ) = StatusEntry(key, value, 0, timestamp, pane, turnStart, 0)

    private fun project(name: String, vararg entries: StatusEntry) = Project(
        name = name, label = name, running = true, isRemote = false,
        parentName = "", worktree = false, workStatus = null, autoPull = null,
        claude = ClaudeOwnChoice(), statusEntries = entries.toList(), services = emptyList(),
        allServices = emptyList(), profiles = emptyList(), activeProfile = "",
        actions = emptyList(), zones = emptyList(), configError = null
    )

    private fun row(key: String, state: AgentState, since: Long?, until: Long? = null) =
        AgentWidgetRow(
            project = "p",
            key = key,
            title = key,
            state = state,
            since = since,
            until = until
        )

    @Test
    fun `the widget lists one row per tab, named after the tab, and leaves idle out`() {
        val rows = agentWidgetRows(
            listOf(
                project(
                    "storefront",
                    entry("claude_code_a", "Running", 900_000, pane = "t1", turnStart = 800_000),
                    entry("codex_b", "Thinking", 950_000, pane = "t2")
                ),
                project("blog", entry("codex_c", "Waiting", 990_000, pane = "t3"))
            ),
            mapOf("storefront" to mapOf("t1" to "Add Apple Pay to checkout")),
            now
        )
        assertEquals(
            listOf(
                AgentWidgetRow(
                    "storefront",
                    "claude_code_a",
                    "t1",
                    "Add Apple Pay to checkout",
                    AgentState.Working,
                    800_000,
                    null
                ),
                AgentWidgetRow("blog", "codex_c", "t3", "Codex", AgentState.NeedsYou, 990_000, null)
            ),
            rows
        )
    }

    @Test
    fun `rows across Macs come most urgent first, the longest at it first`() {
        val items = agentWidgetItems(
            listOf(
                AgentWidgetMac(
                    "a",
                    listOf(row("done", AgentState.Done, 1, 5), row("work", AgentState.Working, 300))
                ),
                AgentWidgetMac(
                    "b",
                    listOf(
                        row("long", AgentState.Working, 100),
                        row("wait", AgentState.NeedsYou, 500),
                        row("untimed", AgentState.Working, null)
                    )
                )
            )
        )
        assertEquals(listOf("wait", "long", "work", "untimed", "done"), items.map { it.row.key })
        assertEquals("b", items.first().macId)
    }

    @Test
    fun `a done row holds still at how long the turn took`() {
        assertEquals("4m", row("x", AgentState.Done, 0, 240_000).elapsed(now = 9_999_999))
        assertEquals("16m", row("x", AgentState.Working, 0).elapsed(now = now))
        assertEquals(null, row("x", AgentState.Working, null).elapsed(now = now))
    }

    @Test
    fun `the saved rows read back as written`() {
        val serializer = ListSerializer(AgentWidgetMac.serializer())
        val macs = listOf(
            AgentWidgetMac(
                "a",
                listOf(row("x", AgentState.NeedsYou, 5)),
                name = "Studio",
                seenAt = 9
            )
        )
        assertEquals(macs, Json.decodeFromString(serializer, Json.encodeToString(serializer, macs)))
    }

    @Test
    fun `the widget ticks while a time counts or a quiet list ages`() {
        assertEquals(
            true,
            agentWidgetTicks(listOf(AgentWidgetMac("a", listOf(row("x", AgentState.Working, 5)))))
        )
        assertEquals(
            false,
            agentWidgetTicks(listOf(AgentWidgetMac("a", listOf(row("x", AgentState.Done, 0, 4)))))
        )
        assertEquals(true, agentWidgetTicks(listOf(AgentWidgetMac("a", emptyList(), seenAt = 5))))
        assertEquals(false, agentWidgetTicks(listOf(AgentWidgetMac("a", emptyList()))))
        assertEquals(false, agentWidgetTicks(emptyList()))
    }
}
