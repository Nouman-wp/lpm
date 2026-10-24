package cx.lpm.mobile.feature.git.review

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.component.ActivityIndicator
import cx.lpm.mobile.core.designsystem.component.ActivityIndicatorSize
import cx.lpm.mobile.core.designsystem.theme.LpmTheme

/**
 * iOS's large `.borderedProminent` button across the width: a tinted capsule with
 * [icon] before its label, or a spinner while [busy].
 */
@Composable
internal fun ProminentButton(
    text: String,
    icon: Painter,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LpmTheme.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val content = if (enabled) Color.White else colors.tertiaryLabel
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp)
            .alpha(if (pressed) 0.75f else 1f)
            .clip(CircleShape)
            .background(if (enabled) colors.tint else colors.tertiarySystemFill)
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                role = Role.Button,
                onClick = onClick
            )
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (busy) {
            ActivityIndicator(size = ActivityIndicatorSize.Small, color = Color.White)
        } else {
            Icon(
                painter = icon,
                contentDescription = null,
                tint = content,
                modifier = Modifier.size(22.dp)
            )
        }
        Text(
            text = text,
            style = LpmTheme.typography.body.copy(fontWeight = FontWeight.SemiBold),
            color = content
        )
    }
}

/** iOS's `.bar` material under a pinned button, with nothing scrolled beneath it. */
@Composable
internal fun Modifier.barBackground(): Modifier {
    val colors = LpmTheme.colors
    return background(
        colors.systemBackground.copy(
            alpha = BAR_ALPHA
        ).compositeOver(colors.secondarySystemBackground)
    )
}

private const val BAR_ALPHA = 0.6f
