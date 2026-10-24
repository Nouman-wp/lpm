package cx.lpm.mobile.feature.git.review

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.ActivityIndicator
import cx.lpm.mobile.core.designsystem.component.ActivityIndicatorSize
import cx.lpm.mobile.core.designsystem.component.LinkButton
import cx.lpm.mobile.core.designsystem.component.ListLeadingSlot
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.feature.git.R

/**
 * Under the commit message (iOS `CommitDraftRow`): "Generate message", its spinner
 * while the Mac writes one, or — while the message is the one it drafted — "Drafted
 * from the diff" with a small Regenerate.
 */
@Composable
internal fun CommitDraftRow(
    generating: Boolean,
    drafted: Boolean,
    canGenerate: Boolean,
    onGenerate: () -> Unit
) {
    val colors = LpmTheme.colors
    if (drafted && !generating) {
        ListRow(
            leadingSlot = ListLeadingSlot(width = 20.dp, spacing = 8.dp),
            leading = {
                Icon(
                    painter = painterResource(DesignR.drawable.ic_auto_awesome),
                    contentDescription = null,
                    tint = colors.secondaryLabel,
                    modifier = Modifier.size(18.dp)
                )
            },
            trailing = {
                LinkButton(
                    text = stringResource(R.string.git_commit_regenerate),
                    onClick = onGenerate,
                    enabled = canGenerate,
                    textStyle = LpmTheme.typography.subheadline.copy(
                        fontWeight = FontWeight.SemiBold
                    )
                )
            }
        ) {
            Text(
                text = stringResource(R.string.git_commit_drafted),
                style = LpmTheme.typography.subheadline,
                color = colors.secondaryLabel,
                modifier = Modifier.weight(1f)
            )
        }
        return
    }
    val enabled = !generating && canGenerate
    ListRow(
        onClick = onGenerate,
        enabled = enabled,
        leadingSlot = ListLeadingSlot(width = 20.dp, spacing = 8.dp),
        leading = {
            if (generating) {
                ActivityIndicator(size = ActivityIndicatorSize.Small)
            } else {
                Icon(
                    painter = painterResource(DesignR.drawable.ic_auto_awesome),
                    contentDescription = null,
                    tint = if (enabled) colors.tint else colors.tertiaryLabel,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    ) {
        val label = if (generating) {
            R.string.git_commit_generating
        } else {
            R.string.git_commit_generate_message
        }
        Text(
            text = stringResource(label),
            style = LpmTheme.typography.body,
            color = if (enabled) colors.tint else colors.tertiaryLabel
        )
    }
}
