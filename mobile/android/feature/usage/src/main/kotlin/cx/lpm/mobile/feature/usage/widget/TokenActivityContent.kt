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
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
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
 * cost, a stacked bar per day, and 7D / 14D / 30D pills.
 */
@Composable
internal fun TokenActivityContent(range: Int, window: TokenActivityWindow?, launch: Intent?) {
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
                message = string(R.string.token_activity_empty_body),
                hint = string(R.string.token_activity_empty_action)
            ) {
                Header(range, pills = false)
            }
        } else {
            Header(range, pills = true)
            Totals(window)
            Spacer(GlanceModifier.defaultWeight())
            if (window.tokens > 0) Bars(window.days, barArea()) else NoTokens(window, barArea())
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
            TokenActivityRepository.RANGES.forEach { days -> Pill(days, picked = days == range) }
        }
    }
}

@Composable
private fun Pill(days: Int, picked: Boolean) {
    val label = plural(R.plurals.token_activity_range_label, days, days)
    Box(
        GlanceModifier.padding(start = 4.dp)
            .clickable(
                actionRunCallback<PickTokenRangeAction>(
                    actionParametersOf(PickTokenRangeAction.DaysKey to days)
                )
            )
            .semantics { contentDescription = label }
    ) {
        Box(
            GlanceModifier.height(22.dp)
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
    val none = window.tokens == 0L
    Row(GlanceModifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.Bottom) {
        Text(
            formatTokenCount(window.tokens),
            style = TextStyle(
                if (none) Palette.secondary else Palette.primary,
                22.sp,
                FontWeight.Bold
            ),
            maxLines = 1
        )
        Caption(string(R.string.token_activity_tokens))
        Text(
            formatUsd(window.cost),
            modifier = GlanceModifier.padding(start = 12.dp),
            style = TextStyle(
                if (none) Palette.secondary else Palette.cost,
                22.sp,
                FontWeight.Bold
            ),
            maxLines = 1
        )
        Caption(string(R.string.token_activity_estimated))
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

@Composable
private fun Caption(text: String) {
    Text(
        text,
        modifier = GlanceModifier.padding(start = 4.dp, bottom = 4.dp),
        style = TextStyle(Palette.secondary, 11.sp),
        maxLines = 1
    )
}

/** What's left of the widget's height for the bars, up to iOS's 58 points. */
@Composable
private fun barArea(): Dp = (LocalSize.current.height - CHROME_HEIGHT).coerceIn(MIN_BARS, MAX_BARS)

/**
 * One stacked bar a day, Codex over Claude, scaled to the range's busiest day. A
 * widget row holds ten children at most, so the days are split into even groups.
 */
@Composable
private fun Bars(days: List<TokenActivityDay>, area: Dp) {
    val peak = maxOf(1L, days.maxOf { it.totalTokens })
    val gap = when {
        days.size > 20 -> 2.dp
        days.size > 10 -> 6.dp
        else -> 16.dp
    }
    val groups = ceil(days.size / MAX_CHILDREN.toDouble()).toInt()
    val chunk = ceil(days.size / groups.toDouble()).toInt()
    val summary = barsSummary(days)
    Column {
        Row(
            GlanceModifier.fillMaxWidth().height(area - 1.dp).semantics {
                contentDescription =
                    summary
            },
            verticalAlignment = Alignment.Bottom
        ) {
            days.chunked(chunk).forEach { group ->
                Row(
                    GlanceModifier.defaultWeight().fillMaxHeight(),
                    verticalAlignment = Alignment.Bottom
                ) {
                    group.forEach { day ->
                        Column(
                            GlanceModifier.defaultWeight().fillMaxHeight().padding(
                                horizontal =
                                    gap / 2
                            ),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            val codex = (area - 1.dp) * (day.codexTokens.toFloat() / peak)
                            val claude = (area - 1.dp) * (day.claudeTokens.toFloat() / peak)
                            if (codex >
                                0.dp
                            ) {
                                Box(
                                    GlanceModifier.fillMaxWidth().height(
                                        codex
                                    ).background(Palette.codex)
                                ) {
                                }
                            }
                            if (codex > 0.dp && claude > 0.dp) Spacer(GlanceModifier.height(1.dp))
                            if (claude >
                                0.dp
                            ) {
                                Box(
                                    GlanceModifier.fillMaxWidth().height(
                                        claude
                                    ).background(Palette.claude)
                                ) {
                                }
                            }
                        }
                    }
                }
            }
        }
        Box(GlanceModifier.fillMaxWidth().height(1.dp).background(Palette.baseline)) {}
    }
}

/** A range without a token: says so where the bars would stand, over a dashed baseline. */
@Composable
private fun NoTokens(window: TokenActivityWindow, area: Dp) {
    val days = window.days.size
    Column {
        Box(
            GlanceModifier.fillMaxWidth().height(area - 1.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                plural(
                    if (window.endsToday) {
                        R.plurals.token_activity_none_recent
                    } else {
                        R.plurals.token_activity_bars_empty
                    },
                    days,
                    days
                ),
                style = TextStyle(Palette.secondary, 12.sp),
                maxLines = 1
            )
        }
        Image(
            provider = ImageProvider(R.drawable.token_activity_dashed_line),
            contentDescription = null,
            colorFilter = ColorFilter.tint(Palette.dash),
            contentScale = ContentScale.FillBounds,
            modifier = GlanceModifier.fillMaxWidth().height(1.dp)
        )
    }
}

@Composable
private fun barsSummary(days: List<TokenActivityDay>): String {
    val busiest = days.maxBy { it.totalTokens }
    return if (busiest.totalTokens == 0L) {
        plural(R.plurals.token_activity_bars_empty, days.size, days.size)
    } else {
        plural(
            R.plurals.token_activity_bars,
            days.size,
            days.size,
            shortUsageDate(busiest.date),
            formatTokenCount(busiest.totalTokens),
            formatUsd(busiest.cost)
        )
    }
}

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

/** iOS's widget colors: the system background and labels, light and dark. */
private object Palette {
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

private val CHROME_HEIGHT = 112.dp
private val MIN_BARS = 24.dp
private val MAX_BARS = 58.dp
private const val MAX_CHILDREN = 10
