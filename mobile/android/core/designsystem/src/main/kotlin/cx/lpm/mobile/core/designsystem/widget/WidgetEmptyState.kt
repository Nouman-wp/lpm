package cx.lpm.mobile.core.designsystem.widget

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import cx.lpm.mobile.core.designsystem.theme.DarkLpmColors
import cx.lpm.mobile.core.designsystem.theme.LightLpmColors

/** A call to act (pair, open the app) in blue, or a resting state in grey. */
enum class WidgetEmptyTone { Action, Quiet }

/**
 * What a widget shows with nothing to list (iOS `WidgetEmptyState`): a badge, what's
 * missing and what to do about it, under the widget's own header. Medium adds a
 * button-like hint for the tap that opens the app, or a footnote. [dark] keeps the
 * dark colors in a light theme, for a widget that's always a dark card.
 */
@Composable
fun WidgetEmptyState(
    @DrawableRes icon: Int,
    tone: WidgetEmptyTone,
    title: String,
    message: String,
    modifier: GlanceModifier = GlanceModifier,
    small: Boolean = false,
    hint: String? = null,
    footnote: String? = null,
    dark: Boolean = false,
    header: @Composable () -> Unit
) {
    val palette = Palette(dark)
    Column(modifier.fillMaxSize()) {
        header()
        Spacer(GlanceModifier.defaultWeight())
        if (small) {
            Badge(icon, tone, 32.dp, palette)
            Text(
                title,
                modifier = GlanceModifier.padding(top = 10.dp),
                style = TextStyle(palette.label, 14.sp, FontWeight.Medium),
                maxLines = 2
            )
            Text(
                message,
                modifier = GlanceModifier.padding(top = 2.dp),
                style = TextStyle(palette.secondary, 12.sp),
                maxLines = 2
            )
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Badge(icon, tone, 40.dp, palette)
                Column(GlanceModifier.padding(start = 12.dp)) {
                    Text(
                        title,
                        style = TextStyle(palette.label, 15.sp, FontWeight.Medium),
                        maxLines = 2
                    )
                    Text(
                        message,
                        modifier = GlanceModifier.padding(top = 2.dp),
                        style = TextStyle(palette.secondary, 12.sp),
                        maxLines = 2
                    )
                }
            }
            Spacer(GlanceModifier.defaultWeight())
            if (hint != null) {
                Box(
                    GlanceModifier.height(28.dp)
                        .cornerRadius(14.dp)
                        .background(palette.actionFill)
                        .padding(horizontal = 14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(hint, style = TextStyle(palette.actionInk, 12.sp, FontWeight.Medium))
                }
            } else if (footnote != null) {
                Text(footnote, style = TextStyle(palette.secondary, 11.sp), maxLines = 1)
            }
        }
    }
}

@Composable
private fun Badge(@DrawableRes icon: Int, tone: WidgetEmptyTone, size: Dp, palette: Palette) {
    val action = tone == WidgetEmptyTone.Action
    Box(
        GlanceModifier.size(size)
            .cornerRadius(size / 2)
            .background(if (action) palette.actionFill else palette.quietFill),
        contentAlignment = Alignment.Center
    ) {
        Image(
            provider = ImageProvider(icon),
            contentDescription = null,
            colorFilter = ColorFilter.tint(if (action) palette.actionInk else palette.secondary),
            modifier = GlanceModifier.size(size * 0.5f)
        )
    }
}

/** iOS's widget colors, light and dark, or dark alone. */
private class Palette(private val dark: Boolean) {
    val label = pick(LightLpmColors.label, DarkLpmColors.label)
    val secondary = pick(LightLpmColors.secondaryLabel, DarkLpmColors.secondaryLabel)
    val actionFill = pick(Color(0xFFE6EEFD), Color(0xFF1D2A45))
    val actionInk = pick(Color(0xFF1D4ED8), Color(0xFF8AB8FF))
    val quietFill = pick(Color(0xFFF0F0F3), Color(0xFF2C2C2E))

    private fun pick(day: Color, night: Color): ColorProvider =
        if (dark) ColorProvider(night) else ColorProvider(day = day, night = night)
}
