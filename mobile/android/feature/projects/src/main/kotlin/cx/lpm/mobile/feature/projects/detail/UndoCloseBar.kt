package cx.lpm.mobile.feature.projects.detail

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.data.terminals.PendingTabClose
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.feature.projects.R

/**
 * The bar a closed tab leaves for a few seconds, as on the desktop: "<tab> closed"
 * and Undo, which puts the tab back as it was. It holds still — a countdown that
 * moves the whole time would keep UI tests from tapping Undo.
 */
@Composable
fun UndoCloseBar(pending: PendingTabClose?, onUndo: () -> Unit, modifier: Modifier = Modifier) {
    AnimatedVisibility(
        visible = pending != null,
        modifier = modifier,
        enter = slideInVertically { it } + fadeIn(),
        exit = slideOutVertically { it } + fadeOut()
    ) {
        val tab = pending?.tab ?: return@AnimatedVisibility
        Row(
            modifier = Modifier
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .fillMaxWidth()
                .shadow(12.dp, CircleShape)
                .background(Color(0xFF1F1F1F), CircleShape)
                .padding(start = 18.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.tab_closed, tab.title),
                style = LpmTheme.typography.subheadline.copy(fontWeight = FontWeight.Medium),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            TextButton(
                onClick = onUndo,
                shape = CircleShape,
                modifier = Modifier.background(Color.White, CircleShape)
            ) {
                Text(
                    text = stringResource(R.string.tab_undo),
                    style = LpmTheme.typography.subheadline.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.Black
                )
            }
        }
    }
}
