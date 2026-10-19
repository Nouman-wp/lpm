package cx.lpm.mobile.feature.usage.widget

import androidx.annotation.PluralsRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import cx.lpm.mobile.feature.usage.R
import cx.lpm.mobile.feature.usage.stats.formatTokenCount
import cx.lpm.mobile.feature.usage.stats.formatUsd
import cx.lpm.mobile.feature.usage.stats.shortUsageDate
import kotlin.math.ceil

/** The range's bars, or a note where they would stand when it has no tokens. */
@Composable
internal fun TokenActivityChart(window: TokenActivityWindow, area: Dp, small: Boolean) {
    if (window.tokens > 0) Bars(window.days, area, small) else NoTokens(window, area, small)
}

/**
 * One stacked bar a day, Codex over Claude, scaled to the range's busiest day. A
 * widget row holds ten children at most, so the days are split into even groups.
 */
@Composable
private fun Bars(days: List<TokenActivityDay>, area: Dp, small: Boolean) {
    val peak = maxOf(1L, days.maxOf { it.totalTokens })
    val gap = when {
        days.size > 20 -> if (small) 1.dp else 2.dp
        days.size > 10 -> if (small) 3.dp else 6.dp
        else -> if (small) 6.dp else 16.dp
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
private fun NoTokens(window: TokenActivityWindow, area: Dp, small: Boolean) {
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
                style = TextStyle(
                    Palette.secondary,
                    (if (small) 11 else 12).sp,
                    textAlign = TextAlign.Center
                ),
                maxLines = if (small) 2 else 1
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
private fun plural(@PluralsRes id: Int, count: Int, vararg args: Any): String =
    LocalContext.current.resources.getQuantityString(id, count, *args)

private const val MAX_CHILDREN = 10
