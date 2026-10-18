package cx.lpm.mobile.feature.projects.newtab

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.ListLeadingSlot
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.ui.providerMeta
import cx.lpm.mobile.core.ui.tint

/**
 * One way a new tab can start (iOS `NewTabStartRow`): a shell, or an agent ([agent] its
 * id) on a tile in the agent's color, checked when picked.
 */
@Composable
internal fun NewTabStartRow(
    label: String,
    agent: String?,
    picked: Boolean,
    onPick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LpmTheme.colors
    // The agent's colour, as the desktop tints it; a shell is plain.
    val tint = agent?.let { providerMeta(it).tint } ?: colors.secondaryLabel
    ListRow(
        modifier = modifier.semantics { selected = picked },
        onClick = onPick,
        leading = {
            Box(
                Modifier
                    .size(28.dp)
                    .background(tint.copy(alpha = TILE_WASH), RoundedCornerShape(7.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    painter = painterResource(if (agent == null) ShellIcon else AgentIcon),
                    contentDescription = null,
                    tint = tint,
                    modifier = Modifier.size(16.dp)
                )
            }
        },
        leadingSlot = TileSlot,
        trailing = {
            if (picked) {
                Icon(
                    painter = painterResource(DesignR.drawable.ic_check),
                    contentDescription = null,
                    tint = colors.tint,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    ) {
        Text(text = label, style = LpmTheme.typography.body, color = colors.label)
    }
}

private val TileSlot = ListLeadingSlot(width = 28.dp, spacing = 12.dp)
private val ShellIcon = DesignR.drawable.ic_terminal
private val AgentIcon = DesignR.drawable.ic_auto_awesome_fill
private const val TILE_WASH = 0.15f
