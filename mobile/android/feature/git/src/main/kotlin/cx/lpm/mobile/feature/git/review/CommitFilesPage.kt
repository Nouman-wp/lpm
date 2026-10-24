package cx.lpm.mobile.feature.git.review

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.GlassCapsuleButton
import cx.lpm.mobile.core.designsystem.component.GlassIconButton
import cx.lpm.mobile.core.designsystem.component.ListDefaults
import cx.lpm.mobile.core.designsystem.component.ListLeadingSlot
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.component.ListSection
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.ui.GitStatusBadge
import cx.lpm.mobile.feature.git.R
import cx.lpm.mobile.feature.git.ui.SheetBar

/**
 * Every changed file, to include in the commit or leave out (iOS
 * `GitCommitFilesPage`), pushed from the commit sheet's Files row.
 */
@Composable
internal fun CommitFilesPage(
    files: List<CommitFile>,
    onToggle: (String) -> Unit,
    onSelectAll: (Boolean) -> Unit,
    onBack: () -> Unit
) {
    val allSelected = files.all { it.selected }
    Column(Modifier.fillMaxSize()) {
        SheetBar(
            title = stringResource(R.string.git_commit_files),
            leading = {
                GlassIconButton(
                    icon = painterResource(DesignR.drawable.ic_arrow_back_ios_new),
                    contentDescription = stringResource(R.string.back),
                    onClick = onBack
                )
            },
            trailing = {
                val label = if (allSelected) {
                    R.string.git_commit_deselect_all
                } else {
                    R.string.git_commit_select_all
                }
                GlassCapsuleButton(
                    text = stringResource(label),
                    onClick = { onSelectAll(!allSelected) },
                    enabled = files.isNotEmpty()
                )
            }
        )
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(top = ListDefaults.ContentTopPadding, bottom = 24.dp)
        ) {
            ListSection(footer = stringResource(R.string.git_commit_footer)) {
                files.forEach { file ->
                    CommitFileRow(file, onToggle = { onToggle(file.file.path) })
                }
            }
        }
    }
}

/**
 * A file in the commit list: its checkmark, status letter, name over folder, and
 * +N −M. The whole row includes or leaves it out, and reads as the file's path.
 */
@Composable
private fun CommitFileRow(file: CommitFile, onToggle: () -> Unit) {
    val colors = LpmTheme.colors
    val path = file.file.path
    val value = stringResource(
        if (file.selected) R.string.git_commit_included else R.string.git_commit_excluded
    )
    ListRow(
        onClick = onToggle,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = path
            stateDescription = value
        },
        leadingSlot = ListLeadingSlot(width = 24.dp, spacing = 12.dp),
        leading = {
            Icon(
                painter = painterResource(if (file.selected) CHECKED_ICON else UNCHECKED_ICON),
                contentDescription = null,
                tint = if (file.selected) colors.tint else colors.secondaryLabel,
                modifier = Modifier.size(24.dp)
            )
        },
        trailing = {
            if (file.added != null && file.removed != null) {
                DiffStat(file.added, file.removed, Modifier.padding(start = 8.dp))
            }
        }
    ) {
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            GitStatusBadge(file.file.status)
            FileName(file.file, Modifier.weight(1f))
        }
    }
}

private val CHECKED_ICON = DesignR.drawable.ic_check_circle_fill
private val UNCHECKED_ICON = DesignR.drawable.ic_circle
