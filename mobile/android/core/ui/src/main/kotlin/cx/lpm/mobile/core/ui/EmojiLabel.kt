package cx.lpm.mobile.core.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

/**
 * An action's or tab's emoji before its label, as the desktop's EmojiLabel draws it (iOS
 * `EmojiLabel`): an agent's glyph becomes that agent's mark, sized like an emoji in
 * [fontSize] type, and any other emoji stays text. [title] draws the words — with the
 * emoji, as [plain], when it stays text — so a row can style them without touching the
 * mark.
 */
@Composable
fun EmojiLabel(
    emoji: String,
    label: String,
    fontSize: TextUnit,
    modifier: Modifier = Modifier,
    plain: String = if (emoji.isEmpty()) label else "$emoji $label",
    title: @Composable (String) -> Unit
) {
    val mark = AgentMark.ofEmoji(emoji)
    val side = with(LocalDensity.current) { (fontSize.value * MARK_SCALE).roundToInt().sp.toDp() }
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(side / 4),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (mark != null) AgentMarkIcon(mark, Modifier.size(side))
        title(if (mark != null) label else plain)
    }
}

// The New Tab rows' 20 pt mark beside 17 pt type.
private const val MARK_SCALE = 1.18f
