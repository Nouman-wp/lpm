package cx.lpm.mobile.feature.usage.widget

import android.content.Intent
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.widget.WidgetEmptyState
import cx.lpm.mobile.core.designsystem.widget.WidgetEmptyTone
import cx.lpm.mobile.feature.usage.R
import cx.lpm.mobile.feature.usage.stats.formatTokenCount
import cx.lpm.mobile.feature.usage.stats.formatUsd
import cx.lpm.mobile.feature.usage.stats.shortUsageDate
import kotlin.math.ceil

/**
 * The Token activity widget (iOS `TokenActivityView`): the range's tokens and estimated
 * cost, a stacked bar per day, and 7D / 14D / 30D pills. Small stacks the totals and
 * moves the pills under the bars.
 */
@Composable
internal fun TokenActivityContent(range: Int, window: TokenActivityWindow?, launch: Intent?) {
    val small = LocalSize.current.width < MEDIUM_MIN_WIDTH
    val root = GlanceModifier.fillMaxSize()
        .appWidgetBackground()
        .cornerRadius(16.dp)
        .background(Palette.background)
        .padding(16.dp)
    Column(if (launch != null) root.clickable(actionStartActivity(launch)) else root) {
        if (window == null) {
            WidgetEmptyState(
                icon = DesignR.drawable.ic_bar_chart,
                tone = WidgetEmptyTone.Action,
                title = string(R.string.token_activity_empty_title),
                message = string(
                    if (small) {
                        R.string.token_activity_empty_body_small
                    } else {
                        R.string.token_activity_empty_body
                    }
                ),
                small = small,
                hint = string(R.string.token_activity_empty_action)
            ) {
                Header(range, pills = false)
            }
        } else if (small) {
            val area = smallBarArea()
            Header(range, pills = false)
            Spacer(GlanceModifier.height(4.dp))
            Figure(
                formatTokenCount(window.tokens),
                string(R.string.token_activity_tokens),
                window,
                Palette.primary,
                small = true
            )
            Figure(
                formatUsd(window.cost),
                string(R.string.token_activity_estimated),
                window,
                Palette.cost,
                small = true
            )
            Spacer(GlanceModifier.height(8.dp))
            TokenActivityChart(window, area, small)
            Spacer(GlanceModifier.height(8.dp))
            // Whatever the chrome estimate leaves over, so the pills keep to the bottom.
            Spacer(GlanceModifier.defaultWeight())
            Row(GlanceModifier.fillMaxWidth()) { Pills(range, fill = true) }
        } else {
            val area = barArea()
            Header(range, pills = true)
            Totals(window)
            Spacer(GlanceModifier.defaultWeight())
            TokenActivityChart(window, area, small)
            Axis(window)
        }
    }
}

@Composable
private fun Header(range: Int, pills: Boolean) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            string(R.string.token_activity_title),
            style = TextStyle(Palette.primary, 13.sp, FontWeight.Medium),
            maxLines = 1
        )
        if (pills) {
            Spacer(GlanceModifier.defaultWeight())
            Pills(range, fill = false)
        }
    }
}

/** The range pills; small spreads them across the widget's width. */
@Composable
private fun RowScope.Pills(range: Int, fill: Boolean) {
    TokenActivityRepository.RANGES.forEachIndexed { index, days ->
        val gap = GlanceModifier.padding(start = if (fill && index == 0) 0.dp else 4.dp)
        Pill(days, picked = days == range, fill, if (fill) gap.defaultWeight() else gap)
    }
}

@Composable
private fun Pill(
    days: Int,
    picked: Boolean,
    fill: Boolean,
    modifier: GlanceModifier = GlanceModifier
) {
    val label = plural(R.plurals.token_activity_range_label, days, days)
    Box(
        modifier
            .clickable(
                actionRunCallback<PickTokenRangeAction>(
                    actionParametersOf(PickTokenRangeAction.DaysKey to days)
                )
            )
            .semantics { contentDescription = label }
    ) {
        Box(
            (if (fill) GlanceModifier.fillMaxWidth() else GlanceModifier).height(22.dp)
                .cornerRadius(11.dp)
                .background(if (picked) Palette.primary else Palette.pill)
                .padding(horizontal = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                string(R.string.token_activity_range, days),
                style = TextStyle(
                    if (picked) Palette.background else Palette.secondary,
                    11.sp,
                    FontWeight.Medium
                )
            )
        }
    }
}

/** The range's totals, held back to grey when it has none. */
@Composable
private fun Totals(window: TokenActivityWindow) {
    Row(GlanceModifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.Bottom) {
        Figure(
            formatTokenCount(window.tokens),
            string(R.string.token_activity_tokens),
            window,
            Palette.primary,
            small = false
        )
        Spacer(GlanceModifier.width(12.dp))
        Figure(
            formatUsd(window.cost),
            string(R.string.token_activity_estimated),
            window,
            Palette.cost,
            small = false
        )
        Spacer(GlanceModifier.defaultWeight())
        if (window.tokens > 0 && window.cost > 0) {
            Caption(
                string(
                    R.string.token_activity_per_million,
                    formatUsd(window.cost * 1_000_000 / window.tokens)
                )
            )
        }
    }
}

/** A total and its unit, held back to grey when the range has no tokens. */
@Composable
private fun Figure(
    value: String,
    unit: String,
    window: TokenActivityWindow,
    tint: ColorProvider,
    small: Boolean
) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(
            value,
            style = TextStyle(
                if (window.tokens == 0L) Palette.secondary else tint,
                (if (small) 18 else 22).sp,
                FontWeight.Bold
            ),
            maxLines = 1
        )
        Caption(unit, bottom = if (small) 3.dp else 4.dp)
    }
}

@Composable
private fun Caption(text: String, bottom: Dp = 4.dp) {
    Text(
        text,
        modifier = GlanceModifier.padding(start = 4.dp, bottom = bottom),
        style = TextStyle(Palette.secondary, 11.sp),
        maxLines = 1
    )
}

/** What's left of the widget's height for the bars, up to iOS's 58 points. */
@Composable
private fun barArea(): Dp = (LocalSize.current.height - CHROME_HEIGHT).coerceIn(MIN_BARS, MAX_BARS)

/** Small's bars take whatever height the totals and the pills leave. */
@Composable
private fun smallBarArea(): Dp =
    (LocalSize.current.height - SMALL_CHROME_HEIGHT).coerceAtLeast(MIN_BARS)

@Composable
private fun Axis(window: TokenActivityWindow) {
    val today = window.endsToday
    Row(GlanceModifier.fillMaxWidth().padding(top = 4.dp)) {
        Text(
            window.days.first().date.let(::shortUsageDate),
            style = TextStyle(Palette.secondary, 10.sp)
        )
        Spacer(GlanceModifier.defaultWeight())
        Text(
            if (today) {
                string(
                    R.string.token_activity_today
                )
            } else {
                shortUsageDate(window.days.last().date)
            },
            style = TextStyle(
                if (today) Palette.primary else Palette.secondary,
                10.sp,
                if (today) FontWeight.Medium else FontWeight.Normal
            )
        )
    }
}

@Composable
private fun string(@StringRes id: Int, vararg args: Any): String =
    LocalContext.current.getString(id, *args)

@Composable
private fun plural(@PluralsRes id: Int, count: Int, vararg args: Any): String =
    LocalContext.current.resources.getQuantityString(id, count, *args)

/** The Token activity widget's colors: iOS's system background and labels, light and dark. */
internal object Palette {
    val background = ColorProvider(day = Color.White, night = Color(0xFF1C1C1E))
    val primary = ColorProvider(day = Color.Black, night = Color.White)
    val secondary = ColorProvider(day = Color(0xFF8A8A8E), night = Color(0xFF98989F))
    val pill = ColorProvider(day = Color(0xFFEBEBEB), night = Color(0xFF313133))
    val baseline = ColorProvider(day = Color(0xFFE3E3E8), night = Color(0xFF3A3A3C))
    val dash = ColorProvider(day = Color(0xFFC7C7CC), night = Color(0xFF545457))
    val cost = ColorProvider(day = Color(0xFF1F6FD1), night = Color(0xFF7DB7FF))
    val claude = ColorProvider(Color(0xFFD97757))
    val codex = ColorProvider(Color(0xFF10A37F))
}

private val MEDIUM_MIN_WIDTH = 200.dp
private val CHROME_HEIGHT = 112.dp
private val SMALL_CHROME_HEIGHT = 146.dp
private val MIN_BARS = 24.dp
private val MAX_BARS = 58.dp
