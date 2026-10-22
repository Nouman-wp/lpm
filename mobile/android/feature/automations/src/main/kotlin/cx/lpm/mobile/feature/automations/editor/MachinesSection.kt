package cx.lpm.mobile.feature.automations.editor

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.ListHeaderStyle
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.component.ListSection
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.feature.automations.R
import cx.lpm.mobile.feature.automations.format.AutomationMachines

/**
 * Which computers the automation runs on (iOS `AutomationMachinesSection`): one or
 * more of them, best first, or any that's on. Whichever comes first and is on takes
 * each run.
 */
@Composable
internal fun MachinesSection(state: AutomationEditorUiState, onEdit: DraftEdit) {
    val machines = state.draft.machines
    val listed = AutomationMachines.listed(machines)
    val hereId = state.machines.firstOrNull { it.here }?.id ?: listed.firstOrNull().orEmpty()
    val name = { id: String ->
        if (id == hereId) {
            "This Mac"
        } else {
            (
                state.machines.firstOrNull { it.id == id }
                    ?: state.machineNames.firstOrNull { it.id == id }
                )
                ?.name?.ifEmpty { null } ?: "Another Mac"
        }
    }
    val rows =
        state.machines.map { it.id } + listed.filter { id -> state.machines.none { it.id == id } }
    ListSection(
        header = stringResource(R.string.editor_runs_on),
        headerStyle = ListHeaderStyle.Title,
        footer = AutomationMachines.note(machines, name)
    ) {
        rows.forEach { id ->
            // A job from before computers were named runs on every one; picking one
            // starts its list.
            CheckRow(name(id), checked = id in listed) {
                onEdit {
                    it.copy(
                        machines = if (it.machines.isEmpty()) {
                            listOf(id)
                        } else {
                            AutomationMachines.toggle(it.machines, id)
                        }
                    )
                }
            }
        }
        CheckRow(
            stringResource(R.string.editor_any_machine),
            checked = AutomationMachines.runsOnAny(machines)
        ) {
            onEdit { it.copy(machines = AutomationMachines.toggleAny(it.machines, hereId)) }
        }
    }
}

@Composable
private fun CheckRow(title: String, checked: Boolean, onClick: () -> Unit) {
    ListRow(
        onClick = onClick,
        trailing = {
            if (checked) {
                Icon(
                    painter = painterResource(DesignR.drawable.ic_check),
                    contentDescription = null,
                    tint = LpmTheme.colors.tint,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    ) {
        // A button's label takes the tint, as in an iOS form.
        Text(
            text = title,
            style = LpmTheme.typography.body,
            color = LpmTheme.colors.tint,
            modifier = Modifier.weight(1f)
        )
    }
}
