package cx.lpm.mobile.feature.projects.detail

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.ui.BarConnectionLine
import cx.lpm.mobile.core.ui.BarTitle
import cx.lpm.mobile.core.ui.barTitleLineStyle
import cx.lpm.mobile.feature.projects.R

/**
 * A project screen's title, read the way its terminals' are: the project's state
 * above its name, and its uncommitted changes below. The connection's status takes
 * the top line whenever the Mac isn't connected.
 */
@Composable
internal fun ProjectTitle(state: ProjectDetailUiState, modifier: Modifier = Modifier) {
    val subtitle = state.subtitle
    BarTitle(
        name = state.title,
        git = state.git,
        gitLoading = state.gitLoading,
        stale = subtitle is DetailSubtitle.Link,
        modifier = modifier
    ) {
        when (subtitle) {
            is DetailSubtitle.Link -> BarConnectionLine(subtitle.line)

            null -> Unit

            else -> Text(
                text = statusText(subtitle),
                style = barTitleLineStyle(FontWeight.SemiBold),
                color = LpmTheme.colors.secondaryLabel,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun statusText(subtitle: DetailSubtitle): String = when (subtitle) {
    DetailSubtitle.Running -> stringResource(R.string.detail_running)
    DetailSubtitle.Stopped -> stringResource(R.string.detail_stopped)
    DetailSubtitle.InvalidConfiguration -> stringResource(R.string.detail_invalid_config)
    is DetailSubtitle.Crashed -> crashSummaryText(subtitle.services)
    is DetailSubtitle.Link -> subtitle.line.text
}
