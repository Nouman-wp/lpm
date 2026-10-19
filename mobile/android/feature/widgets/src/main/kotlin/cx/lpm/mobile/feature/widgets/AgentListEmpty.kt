package cx.lpm.mobile.feature.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.layout.Alignment
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.widget.WidgetEmptyState
import cx.lpm.mobile.core.designsystem.widget.WidgetEmptyTone
import cx.lpm.mobile.core.model.AgentWidgetMac

private const val MINUTE_MS = 60_000L

/**
 * The Agents widget with no agent to list (iOS `AgentListEmpty`): no Mac to hear
 * from yet, or Macs with nothing running, and when the phone last heard from them.
 */
@Composable
internal fun AgentListEmpty(macs: List<AgentWidgetMac>, now: Long, small: Boolean) {
    val context = LocalContext.current
    if (macs.isEmpty()) {
        WidgetEmptyState(
            icon = DesignR.drawable.ic_desktop_mac,
            tone = WidgetEmptyTone.Action,
            title = context.getString(R.string.widget_agents_pair_title),
            message = if (small) {
                context.getString(R.string.widget_agents_pair_body_short)
            } else {
                context.getString(R.string.widget_agents_pair_body)
            },
            small = small,
            hint = context.getString(R.string.widget_agents_pair_action),
            dark = true
        ) {
            Header(null)
        }
    } else {
        val place = if (macs.size > 1) {
            context.getString(R.string.widget_agents_place_all)
        } else {
            macs.first().name ?: context.getString(R.string.widget_agents_place_one)
        }
        val label = if (macs.size > 1) {
            context.resources.getQuantityString(R.plurals.widget_agents_macs, macs.size, macs.size)
        } else {
            macs.first().name
        }
        WidgetEmptyState(
            icon = DesignR.drawable.ic_bedtime,
            tone = WidgetEmptyTone.Quiet,
            title = context.getString(R.string.widget_agents_quiet_title),
            message = if (small) {
                context.getString(R.string.widget_agents_quiet_body_short, place)
            } else {
                context.getString(R.string.widget_agents_quiet_body)
            },
            small = small,
            footnote = macs.mapNotNull { it.seenAt }.maxOrNull()?.let { updated(context, it, now) },
            dark = true
        ) {
            Header(if (small) null else label)
        }
    }
}

@Composable
private fun Header(note: String?) {
    val context = LocalContext.current
    Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = context.getString(R.string.widget_agents_title),
            style = TextStyle(
                color = Palette.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
        )
        Spacer(GlanceModifier.defaultWeight())
        if (note != null) {
            Text(
                text = note,
                style = TextStyle(color = Palette.secondary, fontSize = 12.sp),
                maxLines = 1
            )
        }
    }
}

/** "Updated just now", "Updated 4m ago", "Updated 2h ago", "Updated 3d ago". */
private fun updated(context: Context, seenAt: Long, now: Long): String {
    val minutes = ((now - seenAt).coerceAtLeast(0) / MINUTE_MS).toInt()
    return when {
        minutes < 1 -> context.getString(R.string.widget_agents_updated_now)
        minutes < 60 -> context.getString(R.string.widget_agents_updated_minutes, minutes)
        minutes < 24 * 60 -> context.getString(R.string.widget_agents_updated_hours, minutes / 60)
        else -> context.getString(R.string.widget_agents_updated_days, minutes / (24 * 60))
    }
}
