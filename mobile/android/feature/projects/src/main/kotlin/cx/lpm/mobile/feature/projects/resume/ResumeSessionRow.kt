package cx.lpm.mobile.feature.projects.resume

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.CapsuleTag
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.component.StatusDot
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.ui.providerMeta
import cx.lpm.mobile.core.ui.tint
import cx.lpm.mobile.feature.projects.R

/**
 * One past conversation (iOS `ResumeSessionRow`): its title, marked when a tab already
 * holds it, over the agent, account, branch, when it last ran and how it opened.
 */
@Composable
internal fun ResumeSessionRow(row: ResumeRow, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val session = row.session
    val colors = LpmTheme.colors
    ListRow(modifier = modifier, onClick = onOpen, verticalPadding = 9.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = session.title,
                    style = LpmTheme.typography.body,
                    color = colors.label,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (session.openIn != null) {
                    CapsuleTag(
                        text = stringResource(R.string.resume_in_tab),
                        contentColor = colors.green,
                        containerColor = colors.green.copy(alpha = IN_TAB_WASH),
                        textStyle = LpmTheme.typography.caption2.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.padding(vertical = 1.dp)
                    )
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusDot(color = providerMeta(session.provider).tint, size = 7.dp)
                Details(row)
            }
        }
    }
}

/** One line of text, so it truncates at its end rather than piece by piece. */
@Composable
private fun Details(row: ResumeRow) {
    val session = row.session
    val text = buildAnnotatedString {
        append(providerMeta(session.provider).short)
        session.account?.let { append(" · $it") }
        session.gitBranch?.let {
            append(" · ")
            appendInlineContent(BRANCH, "⑂")
            append(" $it")
        }
        row.time?.let { append(" · $it") }
        if (session.preview.isNotEmpty()) append(" · ${session.preview}")
    }
    val color = LpmTheme.colors.secondaryLabel
    Text(
        text = text,
        style = LpmTheme.typography.footnote,
        color = color,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        inlineContent = mapOf(
            BRANCH to InlineTextContent(
                Placeholder(1.em, 1.em, PlaceholderVerticalAlign.TextCenter)
            ) {
                Icon(
                    painter = painterResource(DesignR.drawable.ic_call_split),
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.fillMaxSize()
                )
            }
        )
    )
}

private const val BRANCH = "branch"
private const val IN_TAB_WASH = 0.15f
