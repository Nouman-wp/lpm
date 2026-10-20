package cx.lpm.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AgentEmojiTest {
    @Test
    fun `the four agent glyphs name their agents`() {
        assertEquals("claude", agentForEmoji("✻"))
        assertEquals("codex", agentForEmoji("◆"))
        assertEquals("gemini", agentForEmoji("✦"))
        assertEquals("opencode", agentForEmoji("▣"))
    }

    @Test
    fun `surrounding whitespace is trimmed`() {
        assertEquals("claude", agentForEmoji(" ✻ "))
        assertEquals("codex", agentForEmoji("\t◆\n"))
    }

    @Test
    fun `any other emoji names no agent`() {
        assertNull(agentForEmoji(""))
        assertNull(agentForEmoji("🚀"))
        assertNull(agentForEmoji("✻✻"))
        assertNull(agentForEmoji("✻ claude"))
        assertNull(agentForEmoji("◆️"))
    }

    @Test
    fun `each glyph draws its agent's mark`() {
        assertEquals(AgentMark.Claude, AgentMark.ofEmoji("✻"))
        assertEquals(AgentMark.Codex, AgentMark.ofEmoji("◆"))
        assertEquals(AgentMark.Gemini, AgentMark.ofEmoji("✦"))
        assertEquals(AgentMark.OpenCode, AgentMark.ofEmoji("▣"))
        assertNull(AgentMark.ofEmoji("🤖"))
    }
}
