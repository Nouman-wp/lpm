package cx.lpm.mobile.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class AgentLaunchTest {
    private val efforts = listOf(
        AgentEffortOption("", "Default"),
        AgentEffortOption("low", "Low"),
        AgentEffortOption("high", "High")
    )
    private val claude = AgentOption(
        id = "claude",
        label = "Claude Code",
        models = listOf(
            AgentModelOption("", "Default", efforts),
            AgentModelOption("opus", "Opus", efforts),
            AgentModelOption("haiku", "Haiku", listOf(AgentEffortOption("", "Default")))
        )
    )
    private val gemini = AgentOption("gemini", "Gemini", emptyList())
    private val agents = listOf(claude, gemini)

    @Test
    fun `a pick the Mac still offers stays as it was`() {
        val pick = NewTabPick("claude", "opus", "high")
        assertEquals(pick, pick.resolved(agents))
        assertEquals(NewTabPick("gemini"), NewTabPick("gemini").resolved(agents))
    }

    @Test
    fun `what the Mac no longer offers falls back to a shell or the defaults`() {
        assertEquals(NewTabPick(), NewTabPick("codex", "gpt", "high").resolved(agents))
        assertEquals(
            NewTabPick("claude", "", "high"),
            NewTabPick("claude", "sonnet", "high").resolved(agents)
        )
        assertEquals(
            NewTabPick("claude", "opus", ""),
            NewTabPick("claude", "opus", "max").resolved(agents)
        )
        assertEquals(NewTabPick("gemini"), NewTabPick("gemini", "pro", "high").resolved(agents))
    }

    @Test
    fun `choosing a model keeps the effort only when it offers it`() {
        val pick = NewTabPick("claude", "opus", "high")
        assertEquals(NewTabPick("claude", "", "high"), pick.choosing("", "high", claude))
        assertEquals(NewTabPick("claude", "haiku", ""), pick.choosing("haiku", "high", claude))
    }

    @Test
    fun `project paths join with a slash below the root`() {
        assertEquals("README.md", projectPath("", "README.md"))
        assertEquals("src/app/page.tsx", projectPath("src/app", "page.tsx"))
    }
}
