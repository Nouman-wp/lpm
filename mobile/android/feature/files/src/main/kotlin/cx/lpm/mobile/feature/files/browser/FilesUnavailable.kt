package cx.lpm.mobile.feature.files.browser

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.text.style.TextAlign
import cx.lpm.mobile.core.designsystem.component.CapsuleButton
import cx.lpm.mobile.core.designsystem.component.EmptyState
import cx.lpm.mobile.core.designsystem.theme.LpmTheme

/** Files' `ContentUnavailableView`, centered over the list: a folder that's empty or failed, or no results. */
@Composable
internal fun FilesUnavailable(
    title: String,
    icon: Painter,
    modifier: Modifier = Modifier,
    description: String? = null,
    action: String? = null,
    onAction: () -> Unit = {}
) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        EmptyState(
            title = title,
            icon = icon,
            description = description?.let {
                {
                    Text(
                        text = it,
                        style = LpmTheme.typography.body,
                        color = LpmTheme.colors.secondaryLabel,
                        textAlign = TextAlign.Center
                    )
                }
            },
            actions = action?.let {
                {
                    CapsuleButton(
                        text = it,
                        onClick = onAction,
                        prominent = true,
                        textStyle = LpmTheme.typography.headline
                    )
                }
            }
        )
    }
}
