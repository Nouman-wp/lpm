package cx.lpm.mobile.core.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LaunchpadTest {
    private val agents = listOf("claude", "codex", "gemini", "opencode")
        .map { AgentOption(it, it.uppercase(), emptyList()) }

    private fun terminal(name: String, cmd: String) =
        """{"name":"$name","type":"terminal","cmd":"$cmd"}"""

    private fun actions(json: String): List<Action> =
        Json.parseToJsonElement("""{"a":$json}""").jsonObject.list("a", Action::parse)

    @Test
    fun `an agent is the first command word that names one, by its file name`() {
        val ids = agents.map { it.id }
        assertEquals("claude", agentCli("claude --model opus", ids))
        assertEquals("codex", agentCli("FOO=1 /usr/local/bin/codex \"review\"", ids))
        assertEquals("codex", agentCli("cd app && codex", ids))
        assertEquals("gemini", agentCli("C:\\tools\\gemini.EXE", ids))
        assertNull(agentCli("npm test", ids))
        assertNull(agentCli("claude-wrapper", ids))
    }

    @Test
    fun `the project's agent actions, groups kept whole with only their agent items`() {
        val tabs = launchpadTabs(
            actions(
                """[{"name":"test","type":"command","cmd":"npm test"},""" +
                    """{"name":"claude","label":"Claude","primary":"last-used","children":[""" +
                    terminal("claude:opus", "claude --model opus") + "," +
                    terminal("claude:lint", "npm run lint") + "," +
                    terminal("claude:sonnet", "claude --model sonnet") + "]}," +
                    terminal("codex", "codex") + "," +
                    """{"name":"more","label":"More","children":[""" +
                    terminal("more:gemini", "gemini") + "," + terminal("more:open", "opencode") +
                    "]}]"
            ),
            agents
        ) { group -> "sonnet".takeIf { group == "claude" } }

        assertEquals(listOf("claude", "codex", "more"), tabs.map { it.id })
        val claude = tabs[0]
        assertEquals(listOf("claude:opus", "claude:sonnet"), claude.options.map { it.id })
        assertEquals("claude:sonnet", claude.primary?.id)
        assertEquals("claude", claude.options[0].group?.name)
        assertEquals("codex", tabs[1].primary?.agent)
        assertEquals(listOf("gemini", "opencode"), tabs[2].options.map { it.agent })
        assertNull(tabs[2].primary)
    }

    @Test
    fun `a project without agent actions offers the bare agents`() {
        val tabs =
            launchpadTabs(
                actions("""[{"name":"test","type":"terminal","cmd":"npm test"}]"""),
                agents
            )
        assertEquals(listOf("claude", "codex", "gemini", "opencode"), tabs.map { it.id })
        assertNull(tabs[0].primary?.action)
        assertEquals("CLAUDE", tabs[0].label)
    }
}
