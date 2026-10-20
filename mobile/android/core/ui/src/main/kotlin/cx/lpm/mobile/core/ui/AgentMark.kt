package cx.lpm.mobile.core.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.trimmingWhitespace

/**
 * An agent's own mark, as the desktop draws it (AgentGlyph.tsx), with no tile (iOS
 * `AgentMark`): Claude's spark, Codex's >_ in a hexagon, Gemini's sparkle and OpenCode's
 * square.
 */
enum class AgentMark(@DrawableRes internal val drawable: Int, internal val mono: Boolean) {
    Claude(R.drawable.ic_agent_claude, mono = false),
    Codex(R.drawable.ic_agent_codex, mono = false),
    Gemini(R.drawable.ic_agent_gemini, mono = false),
    OpenCode(R.drawable.ic_agent_opencode, mono = true);

    companion object {
        /** The mark for an agent id; null for an agent without one of its own. */
        fun of(agent: String): AgentMark? = when (agent) {
            "claude" -> Claude
            "codex" -> Codex
            "gemini" -> Gemini
            "opencode" -> OpenCode
            else -> null
        }

        /** The mark an action's or tab's emoji stands for; null for any other emoji. */
        fun ofEmoji(emoji: String): AgentMark? = agentForEmoji(emoji)?.let(::of)
    }
}

/**
 * The agent one of the desktop's agent glyphs stands for (agentEmoji.ts): an action's or
 * tab's emoji stays one character, so four non-emoji glyphs name the agents. Null for any
 * other emoji.
 */
fun agentForEmoji(emoji: String): String? = AgentEmoji[emoji.trimmingWhitespace()]

private val AgentEmoji =
    mapOf("✻" to "claude", "◆" to "codex", "✦" to "gemini", "▣" to "opencode")

/** Draws [mark] in its own colors; OpenCode's takes the label color. */
@Composable
fun AgentMarkIcon(mark: AgentMark, modifier: Modifier = Modifier) {
    val painter = painterResource(mark.drawable)
    if (mark.mono) {
        Icon(
            painter = painter,
            contentDescription = null,
            tint = LpmTheme.colors.label,
            modifier = modifier
        )
    } else {
        Image(painter = painter, contentDescription = null, modifier = modifier)
    }
}
