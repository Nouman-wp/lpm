package cx.lpm.mobile.feature.git.review

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.feature.git.R

/** A file bar capsule, "Wrap" or "Viewed" (iOS `TogglePill`): tinted while on, plain while off. */
@Composable
internal fun TogglePill(
    on: Boolean,
    onToggle: () -> Unit,
    label: String,
    tint: Color,
    role: Role,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null
) {
    val colors = LpmTheme.colors
    val color = if (on) tint else colors.secondaryLabel
    val value = stringResource(if (on) R.string.git_file_on else R.string.git_file_off)
    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(if (on) tint.copy(alpha = PILL_ALPHA) else colors.tertiarySystemFill)
            .toggleable(
                value = on,
                interactionSource = null,
                indication = null,
                role = role,
                onValueChange = { onToggle() }
            )
            .semantics(mergeDescendants = true) {
                contentDescription = label
                stateDescription = value
            }
            .padding(horizontal = 9.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(14.dp)
            )
        }
        Text(
            text = label,
            style = LpmTheme.typography.caption1.copy(fontWeight = FontWeight.SemiBold),
            color = color,
            maxLines = 1
        )
    }
}

private const val PILL_ALPHA = 0.15f
