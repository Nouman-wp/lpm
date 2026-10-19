package cx.lpm.mobile.feature.usage.widget

import android.content.Intent
import android.text.format.DateUtils
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
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
import cx.lpm.mobile.core.designsystem.widget.WidgetText
import cx.lpm.mobile.feature.usage.R
import cx.lpm.mobile.feature.usage.rows.UsageAccountMark
import java.time.Instant
import java.time.ZoneId

private const val PADDING_DP = 16f
private const val MEDIUM_MIN_WIDTH_DP = 200f
private const val SHOWN = 3
private const val BAR_DP = 5f
private const val TICK_DP = 9f

/**
 * The Usage widget (iOS `UsageWidgetView`): a header, then up to three usage rows as
 * the projects list draws them — the tool's dot, the account's name and tag, when its
 * window comes back and how much of it is gone, over a bar with its pace tick. Small
 * keeps the name and the share. Either size opens the app.
 */
@Composable
internal fun UsageWidgetContent(mac: UsageWidgetMac?, now: Long, launch: Intent?) {
    val size = LocalSize.current
    val small = size.width.value < MEDIUM_MIN_WIDTH_DP
    val root = GlanceModifier.fillMaxSize()
        .appWidgetBackground()
        .cornerRadius(16.dp)
        .background(Tints.background.provider())
        .padding(PADDING_DP.dp)
    Column(if (launch != null) root.clickable(actionStartActivity(launch)) else root) {
        if (mac == null || mac.rows.isEmpty()) {
            WidgetEmptyState(
                icon = DesignR.drawable.ic_speed,
                tone = WidgetEmptyTone.Action,
                title = string(R.string.usage_widget_empty_title),
                message = string(
                    if (small) {
                        R.string.usage_widget_empty_body_small
                    } else {
                        R.string.usage_widget_empty_body
                    }
                ),
                small = small,
                hint = string(R.string.usage_widget_empty_action)
            ) {
                Header(seenAt = null, now = now, small = small)
            }
        } else {
            val gap = if (small) 11f else 10f
            Header(mac.seenAt, now, small)
            usageWidgetLines(mac.rows, now.toDouble(), SHOWN).forEachIndexed { index, line ->
                // A bar's box reaches 2dp past it on each side, for the tick.
                Spacer(GlanceModifier.height((if (index == 0) gap else gap - 2).dp))
                Line(line, small, size.width.value - 2 * PADDING_DP)
            }
        }
    }
}

@Composable
private fun Header(seenAt: Long?, now: Long, small: Boolean) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            string(R.string.usage_widget_title),
            style = TextStyle(Tints.primary.provider(), 13.sp, FontWeight.Medium),
            maxLines = 1
        )
        if (seenAt != null) {
            Spacer(GlanceModifier.defaultWeight())
            Text(
                asOf(seenAt, now, small),
                style = TextStyle(Tints.secondary.provider(), 11.sp),
                maxLines = 1
            )
        }
    }
}

/** "as of 9:24" today and the day before that; small has room for the time alone. */
@Composable
private fun asOf(seenAt: Long, now: Long, small: Boolean): String {
    val context = LocalContext.current
    val zone = ZoneId.systemDefault()
    val today = Instant.ofEpochMilli(seenAt).atZone(zone).toLocalDate() ==
        Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
    val flags = if (today) {
        DateUtils.FORMAT_SHOW_TIME
    } else {
        DateUtils.FORMAT_SHOW_DATE or DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_NO_YEAR
    }
    val time = DateUtils.formatDateTime(context, seenAt, flags)
    return if (small) time else string(R.string.usage_widget_as_of, time)
}

@Composable
private fun Line(line: UsageWidgetLine, small: Boolean, widthDp: Float) {
    val context = LocalContext.current
    val nameSize = if (small) 12f else 13f
    val name = WidgetText(context, nameSize, medium = true)
    val note = WidgetText(context, 11f, medium = false)
    val share = WidgetText(context, 13f, medium = true)
    val dotDp = if (small) 6f else 7f
    val tag = line.mark.takeIf { !small }?.let { tagLabel(it) }
    val tagDp = tag?.let { (text, bold) ->
        6f + WidgetText(context, 10f, medium = bold).widthDp(text) + 10f
    } ?: 0f
    val percentDp = when {
        line.percentText.isEmpty() -> 0f
        else -> 6f + maxOf(if (small) 0f else 34f, share.widthDp(line.percentText) + 2f)
    }
    val resetDp = when {
        small -> if (line.percentText.isEmpty()) note.widthDp(line.detail) + 6f else 0f
        line.windowShort.isEmpty() -> note.widthDp(line.detail)
        else -> note.widthDp(line.windowShort) + 4f + note.widthDp(line.detail)
    }
    val fixedDp = dotDp + 6f + 4f + resetDp + percentDp
    // A name too long for its row ends in "…"; one that leaves the tag no room drops it.
    val shownTag = tag?.takeIf { widthDp - fixedDp - tagDp >= MIN_NAME_DP }
    val label = name.fit(line.label, widthDp - fixedDp - (if (shownTag != null) tagDp else 0f))
    val spoken = description(line)
    val shareTone = if (line.stale) Tints.secondary else Tints.primary
    Column(GlanceModifier.fillMaxWidth().semantics { contentDescription = spoken }) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Image(
                provider = ImageProvider(R.drawable.usage_widget_dot),
                contentDescription = null,
                colorFilter = ColorFilter.tint(
                    dotTone(line.provider).provider(if (line.stale) 0.5f else 1f)
                ),
                modifier = GlanceModifier.size(dotDp.dp)
            )
            Text(
                label,
                modifier = GlanceModifier.padding(start = 6.dp),
                style = TextStyle(Tints.primary.provider(), nameSize.sp, FontWeight.Medium),
                maxLines = 1
            )
            if (shownTag != null && line.mark != null) Tag(line.mark, shownTag.first)
            Spacer(GlanceModifier.defaultWeight())
            if (!small && line.windowShort.isNotEmpty()) Note(line.windowShort, startDp = 0f)
            if (!small) Note(line.detail, startDp = if (line.windowShort.isEmpty()) 0f else 4f)
            if (line.percentText.isNotEmpty()) {
                Text(
                    line.percentText,
                    modifier = GlanceModifier.padding(start = 6.dp).width(percentDp.dp),
                    style = TextStyle(
                        shareTone.provider(),
                        13.sp,
                        FontWeight.Bold,
                        textAlign = TextAlign.End
                    ),
                    maxLines = 1
                )
            } else if (small) {
                Note(line.detail, startDp = 6f)
            }
        }
        Spacer(GlanceModifier.height((if (small) 3f else 4f).dp))
        Bar(line, widthDp)
    }
}

@Composable
private fun Note(text: String, startDp: Float) {
    Text(
        text,
        modifier = GlanceModifier.padding(start = startDp.dp),
        style = TextStyle(Tints.secondary.provider(), 11.sp),
        maxLines = 1
    )
}

/** The projects list's "in use" / "pool" tag, at the widget's size. */
@Composable
private fun Tag(mark: UsageAccountMark, text: String) {
    val current = mark == UsageAccountMark.Current
    Box(GlanceModifier.padding(start = 6.dp)) {
        Box(
            GlanceModifier
                .cornerRadius(4.dp)
                .then(
                    if (current) {
                        GlanceModifier.background(Tints.inUseWash.provider(0.16f))
                    } else {
                        GlanceModifier.background(ImageProvider(R.drawable.usage_widget_pool_tag))
                    }
                )
                .padding(horizontal = 5.dp, vertical = 1.dp)
        ) {
            Text(
                text,
                style = TextStyle(
                    (if (current) Tints.inUseInk else Tints.secondary).provider(),
                    10.sp,
                    if (current) FontWeight.Bold else FontWeight.Normal
                ),
                maxLines = 1
            )
        }
    }
}

/**
 * A usage row's bar, turning red from its pace tick on, with the tick standing proud
 * of it — the projects list's bar held still.
 */
@Composable
private fun Bar(line: UsageWidgetLine, widthDp: Float) {
    val alpha = if (line.stale) 0.4f else 1f
    // Any use at all shows as a sliver, so 1% never reads as nothing.
    val filled = if (line.fraction >
        0
    ) {
        widthDp * line.fraction.coerceIn(0.02, 1.0).toFloat()
    } else {
        0f
    }
    val paceDp = line.pace?.let { (it * widthDp).toFloat() }
    val ahead = paceDp?.takeIf { it < filled }
    val fill = if (line.windowed) Tints.fill else dotTone(line.provider)
    Box(
        GlanceModifier.fillMaxWidth().height(TICK_DP.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Box(
            GlanceModifier.fillMaxWidth().height(BAR_DP.dp).cornerRadius((BAR_DP / 2).dp)
                .background(Tints.track.provider())
        ) {}
        if (filled > 0) {
            Row(GlanceModifier.width(filled.dp).height(BAR_DP.dp).cornerRadius((BAR_DP / 2).dp)) {
                Box(
                    GlanceModifier.width((ahead ?: filled).dp).height(BAR_DP.dp)
                        .background(fill.provider(alpha))
                ) {}
                if (ahead != null) {
                    Box(
                        GlanceModifier.width((filled - ahead).dp).height(BAR_DP.dp)
                            .background(Tints.ahead.provider(alpha))
                    ) {}
                }
            }
        }
        if (paceDp != null) {
            Row(GlanceModifier.fillMaxWidth().height(TICK_DP.dp)) {
                Spacer(GlanceModifier.width((paceDp - 1).coerceIn(0f, widthDp - 2).dp))
                Box(
                    GlanceModifier.width(2.dp).height(TICK_DP.dp).cornerRadius(1.dp)
                        .background(Tints.primary.provider(alpha))
                ) {}
            }
        }
    }
}

/** The tag's words, and whether they're drawn bold. */
@Composable
private fun tagLabel(mark: UsageAccountMark): Pair<String, Boolean> = when (mark) {
    UsageAccountMark.Current -> string(R.string.rows_in_use) to true
    UsageAccountMark.Standby -> string(R.string.rows_pool) to false
}

/** "Claude 2, in use: 96% of the weekly window used, resets in 10h 35m". */
@Composable
private fun description(line: UsageWidgetLine): String {
    val tag = line.mark?.let { tagLabel(it).first }
    val label = listOfNotNull(line.label, tag).joinToString(", ")
    val value = if (line.percentText.isEmpty()) {
        line.detail
    } else {
        string(R.string.rows_value, line.percentText, line.windowLabel, line.detail)
    }
    return "$label: $value"
}

private fun dotTone(provider: String): Tone = if (provider ==
    "codex"
) {
    Tints.codex
} else {
    Tints.claude
}

@Composable
private fun string(@StringRes id: Int, vararg args: Any): String =
    LocalContext.current.getString(id, *args)

/** A color in each appearance, with any dimming applied to both. */
private class Tone(val day: Color, val night: Color = day) {
    fun provider(alpha: Float = 1f) = ColorProvider(
        day = day.copy(alpha = day.alpha * alpha),
        night = night.copy(alpha = night.alpha * alpha)
    )
}

/** iOS's widget colors: the system background and labels and the usage tints, light and dark. */
private object Tints {
    val background = Tone(Color.White, Color(0xFF1C1C1E))
    val primary = Tone(Color.Black, Color.White)
    val secondary = Tone(Color(0xFF8A8A8E), Color(0xFF98989F))
    val track = Tone(Color(0xFFEEEEF0), Color(0xFF2E2E32))
    val fill = Tone(Color(0xFF06B6D4), Color(0xFF22D3EE))
    val ahead = Tone(Color(0xFFEF4444), Color(0xFFF87171))
    val inUseInk = Tone(Color(0xFFAE5630), Color(0xFFDE8A68))
    val inUseWash = Tone(Color(0xFFD97757), Color(0xFFDE8A68))
    val claude = Tone(Color(0xFFD97757))
    val codex = Tone(Color(0xFF10A37F))
}

private const val MIN_NAME_DP = 24f
