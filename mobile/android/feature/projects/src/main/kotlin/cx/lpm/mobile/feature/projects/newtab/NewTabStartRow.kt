package cx.lpm.mobile.feature.projects.newtab

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
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
import cx.lpm.mobile.core.ui.AgentMark
import cx.lpm.mobile.core.ui.AgentMarkIcon
import cx.lpm.mobile.core.ui.providerMeta
import cx.lpm.mobile.core.ui.tint

/**
 * One way a new tab can start (iOS `NewTabStartRow`): a shell, or an agent ([agent] its
 * id) shown by its own mark as the desktop shows it, checked when picked.
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
    // A shell, or an agent without a mark of its own, gets a symbol in the agent's colour.
    val tint = agent?.let { providerMeta(it).tint } ?: colors.secondaryLabel
    ListRow(
        modifier = modifier.semantics { selected = picked },
        onClick = onPick,
        leading = {
            Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                val mark = agent?.let(AgentMark::of)
                if (mark != null) {
                    AgentMarkIcon(mark, Modifier.size(20.dp))
                } else {
                    Icon(
                        painter = painterResource(if (agent == null) ShellIcon else AgentIcon),
                        contentDescription = null,
                        tint = tint,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        },
        leadingSlot = MarkSlot,
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

private val MarkSlot = ListLeadingSlot(width = 28.dp, spacing = 12.dp)
private val ShellIcon = DesignR.drawable.ic_terminal
private val AgentIcon = DesignR.drawable.ic_auto_awesome_fill
