package cx.lpm.mobile.feature.usage.stats

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.data.usage.ALL_MACHINES
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.ContextMenu
import cx.lpm.mobile.core.designsystem.component.ContextMenuDivider
import cx.lpm.mobile.core.designsystem.component.ContextMenuItem
import cx.lpm.mobile.core.designsystem.component.clickableNoIndication
import cx.lpm.mobile.core.designsystem.component.glass
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.UsageMachine
import cx.lpm.mobile.feature.usage.R

/**
 * The Stats screen's pick of whose usage to show: one computer, or all of them added
 * together (iOS `StatsMachineMenu`, the desktop Stats page's computer menu). Shown
 * only when the Mac pairs with another computer.
 */
@Composable
internal fun StatsMachineMenu(
    machines: List<UsageMachine>,
    selected: String,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var open by remember { mutableStateOf(false) }
    val current = machines.firstOrNull { it.id == selected }
    val allLabel = allMachinesLabel(machines)
    Box(modifier) {
        Row(
            modifier = Modifier
                .clickableNoIndication({ open = true })
                .height(44.dp)
                .glass(CircleShape, LpmTheme.colors)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                painter = painterResource(
                    current?.let(::machineIcon) ?: DesignR.drawable.ic_stacks
                ),
                contentDescription = null,
                tint = LpmTheme.colors.label,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = current?.name ?: allLabel,
                style = LpmTheme.typography.subheadline,
                color = LpmTheme.colors.label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 150.dp)
            )
            Spacer(Modifier.width(4.dp))
            Icon(
                painter = painterResource(DesignR.drawable.ic_keyboard_arrow_down),
                contentDescription = null,
                tint = LpmTheme.colors.secondaryLabel,
                modifier = Modifier.size(16.dp)
            )
        }
        ContextMenu(expanded = open, onDismissRequest = { open = false }) {
            ContextMenuItem(
                title = allLabel,
                subtitle = allMachinesDetail(machines),
                onClick = { onPick(ALL_MACHINES) },
                icon = painterResource(
                    if (current ==
                        null
                    ) {
                        DesignR.drawable.ic_check
                    } else {
                        DesignR.drawable.ic_stacks
                    }
                )
            )
            ContextMenuDivider()
            machines.forEach { machine ->
                ContextMenuItem(
                    title = machine.name,
                    subtitle = machineDetail(machine),
                    onClick = { onPick(machine.id) },
                    icon = painterResource(
                        if (machine.id ==
                            selected
                        ) {
                            DesignR.drawable.ic_check
                        } else {
                            machineIcon(machine)
                        }
                    ),
                    enabled = machine.connected
                )
            }
        }
    }
}

private fun machineIcon(machine: UsageMachine): Int =
    if (machine.isLinuxHost) DesignR.drawable.ic_dns else DesignR.drawable.ic_desktop_mac

/** Whether every computer listed is a Mac, so the copy can call them Macs. */
internal fun allMacs(machines: List<UsageMachine>): Boolean =
    machines.all { !it.isLinuxHost && (it.platform.isEmpty() || it.platform == "macos") }

@Composable
internal fun allMachinesLabel(machines: List<UsageMachine>): String = stringResource(
    if (allMacs(
            machines
        )
    ) {
        R.string.stats_machines_all_macs
    } else {
        R.string.stats_machines_all_computers
    }
)

/** "Macs"/"computers" with a count, for "history files scanned on 3 Macs". */
@Composable
internal fun machinesCount(machines: List<UsageMachine>, count: Int): String = pluralStringResource(
    if (allMacs(machines)) R.plurals.stats_macs else R.plurals.stats_computers,
    count,
    count
)

@Composable
private fun allMachinesDetail(machines: List<UsageMachine>): String {
    val counted = machines.filter { it.isCounted }
    val what = if (counted.size == machines.size) {
        stringResource(R.string.stats_machines_added)
    } else {
        pluralStringResource(
            R.plurals.stats_machines_some_added,
            counted.size,
            counted.size,
            machines.size
        )
    }
    val totals = counted.mapNotNull { it.totalTokens }
    if (totals.size != counted.size) return what
    return stringResource(R.string.stats_machine_with_total, what, formatTokenCount(totals.sum()))
}

@Composable
private fun machineDetail(machine: UsageMachine): String {
    if (!machine.connected) return stringResource(R.string.stats_machine_offline)
    if (machine.error != null) return stringResource(R.string.stats_machine_failed)
    val online = stringResource(R.string.stats_machine_online)
    val total = machine.totalTokens ?: return online
    return stringResource(R.string.stats_machine_with_total, online, formatTokenCount(total))
}
