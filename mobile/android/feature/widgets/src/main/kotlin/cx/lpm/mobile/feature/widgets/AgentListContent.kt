package cx.lpm.mobile.feature.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
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
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import cx.lpm.mobile.core.data.push.NotificationOpenTarget
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.theme.DarkLpmColors
import cx.lpm.mobile.core.designsystem.theme.LightLpmColors
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.AgentWidgetItem
import cx.lpm.mobile.core.model.AgentWidgetMac
import cx.lpm.mobile.core.model.agentWidgetItems
import cx.lpm.mobile.core.push.PushNotifier

private const val PADDING_DP = 16f
private const val MEDIUM_MIN_WIDTH_DP = 200f
private const val SHOWN = 4

/**
 * The Agents widget: a header, then up to four agent tabs, most urgent first. Small
 * opens the top agent's terminal; medium opens whichever row is tapped. With no
 * agent to list, either size opens the app.
 */
@Composable
internal fun AgentListContent(macs: List<AgentWidgetMac>, now: Long) {
    val context = LocalContext.current
    val small = LocalSize.current.width.value < MEDIUM_MIN_WIDTH_DP
    val items = agentWidgetItems(macs)
    val shown = items.take(SHOWN)
    val rowWidth = LocalSize.current.width.value - 2 * PADDING_DP
    val open = if (small || items.isEmpty()) open(context, shown.firstOrNull()) else null
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(Palette.background)
            .then(
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    GlanceModifier.cornerRadius(android.R.dimen.system_app_widget_background_radius)
                } else {
                    GlanceModifier
                }
            )
            .padding(PADDING_DP.dp)
            .then(open?.let { GlanceModifier.clickable(it) } ?: GlanceModifier)
    ) {
        if (items.isEmpty()) {
            AgentListEmpty(macs, now, small)
        } else {
            Header(items, small)
            Spacer(GlanceModifier.height(if (small) 8.dp else 6.dp))
            shown.forEachIndexed { index, item ->
                if (!small && index > 0) {
                    Box(
                        GlanceModifier.fillMaxWidth().height(0.5.dp).background(Palette.separator)
                    ) {
                    }
                }
                AgentLine(item, now, small, rowWidth, if (small) null else open(context, item))
            }
        }
    }
}

@Composable
private fun Header(items: List<AgentWidgetItem>, small: Boolean) {
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
        if (small) {
            Text(
                text = "${items.size}",
                style = TextStyle(color = Palette.secondary, fontSize = 12.sp)
            )
        } else {
            Summary(items)
        }
    }
}

/** "3 need you · 4 working · 3 done", each count in its state's color. */
@Composable
private fun Summary(items: List<AgentWidgetItem>) {
    val context = LocalContext.current
    val count = { state: AgentState -> items.count { it.row.state == state } }
    val parts = listOfNotNull(
        count(AgentState.NeedsYou).takeIf { it > 0 }?.let {
            context.resources.getQuantityString(R.plurals.widget_agents_need_you, it, it) to
                AgentState.NeedsYou
        },
        count(AgentState.Error).takeIf { it > 0 }?.let {
            context.resources.getQuantityString(R.plurals.widget_agents_problems, it, it) to
                AgentState.Error
        },
        count(AgentState.Working).takeIf { it > 0 }?.let {
            context.resources.getQuantityString(R.plurals.widget_agents_working, it, it) to
                AgentState.Working
        },
        count(AgentState.Done).takeIf { it > 0 }?.let {
            context.resources.getQuantityString(R.plurals.widget_agents_done, it, it) to
                AgentState.Done
        }
    )
    val text = WidgetText(context, sizeSp = 12f, medium = true)
    Row(verticalAlignment = Alignment.CenterVertically) {
        parts.forEachIndexed { index, (words, state) ->
            if (index > 0) {
                Text(
                    text = context.getString(R.string.widget_agents_separator),
                    style = TextStyle(color = Palette.secondary, fontSize = 12.sp)
                )
            }
            ToneText(words, state, text, sizeSp = 12f)
        }
    }
}

/**
 * One agent tab, as the projects list draws it: the tab's name in its state's
 * color, then the state's mark and how long the agent has been at it.
 */
@Composable
private fun AgentLine(
    item: AgentWidgetItem,
    now: Long,
    small: Boolean,
    widthDp: Float,
    open: Action?
) {
    val context = LocalContext.current
    val sizeSp = if (small) 12f else 14f
    val title = WidgetText(context, sizeSp, medium = true)
    val elapsed = item.row.elapsed(now)
    val markDp = if (small) 13f else 18f
    val trailGap = if (small) 3f else 4f
    val trail =
        markDp +
            (
                elapsed?.let { trailGap + WidgetText(context, sizeSp, medium = false).widthDp(it) }
                    ?: 0f
                )
    val gap = if (small) 6f else 10f
    val fitted = title.fit(item.row.title, widthDp - trail - gap)
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .height(if (small) 24.dp else 26.dp)
            .then(open?.let { GlanceModifier.clickable(it) } ?: GlanceModifier),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ToneText(fitted, item.row.state, title, sizeSp)
        Spacer(GlanceModifier.defaultWeight())
        Box(modifier = GlanceModifier.width(markDp.dp), contentAlignment = Alignment.Center) {
            Mark(item.row.state, small)
        }
        if (elapsed != null) {
            Spacer(GlanceModifier.width(trailGap.dp))
            Text(text = elapsed, style = TextStyle(color = Palette.secondary, fontSize = sizeSp.sp))
        }
    }
}

/**
 * The app's tones held still, as a widget can't animate: the working sweep at its
 * start, orange for a wait, red for a problem, blue once done.
 */
@Composable
private fun ToneText(text: String, state: AgentState, measure: WidgetText, sizeSp: Float) {
    if (state == AgentState.Working) {
        val swept = measure.sweep(text)
        Image(
            provider = ImageProvider(swept.bitmap),
            contentDescription = text,
            modifier = GlanceModifier.size(swept.widthDp.dp, swept.heightDp.dp)
        )
    } else {
        Text(
            text = text,
            maxLines = 1,
            style = TextStyle(
                color = state.tone,
                fontSize = sizeSp.sp,
                fontWeight = FontWeight.Medium
            )
        )
    }
}

/**
 * A bell while it waits on you, an alert for a problem, a check once done. Working
 * says so through the name alone, and keeps the slot so times line up.
 */
@Composable
private fun Mark(state: AgentState, small: Boolean) {
    val icon = when (state) {
        AgentState.NeedsYou -> DesignR.drawable.ic_notifications_fill
        AgentState.Error -> DesignR.drawable.ic_error_fill
        AgentState.Done -> DesignR.drawable.ic_check
        AgentState.Working, AgentState.Idle -> return
    }
    val size = if (small) 12.dp else 14.dp
    Image(
        provider = ImageProvider(icon),
        contentDescription = null,
        colorFilter = ColorFilter.tint(state.tone),
        modifier = GlanceModifier.size(size)
    )
}

/** The agent's terminal on its Mac, opened the way a notification tap opens it. */
private fun open(context: Context, item: AgentWidgetItem?): Action {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    intent.action = PushNotifier.ACTION_OPEN
    intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
            Intent.FLAG_ACTIVITY_SINGLE_TOP
    )
    if (item != null) {
        val terminal = item.row.terminalId
        // Each row's own address, so the rows' taps are told apart.
        intent.data = Uri.Builder()
            .scheme("lpmlink")
            .authority("agent")
            .appendQueryParameter("mac", item.macId)
            .appendQueryParameter("project", item.row.project)
            .apply { terminal?.let { appendQueryParameter("terminal", it) } }
            .build()
        intent.putExtra(NotificationOpenTarget.SERVER_ID, item.macId)
        intent.putExtra(NotificationOpenTarget.PROJECT, item.row.project)
        if (terminal != null) {
            intent.putExtra(NotificationOpenTarget.TARGET, "terminal")
            intent.putExtra(NotificationOpenTarget.TERMINAL_ID, terminal)
        }
    }
    return actionStartActivity(intent)
}

private val AgentState.tone: ColorProvider
    get() = when (this) {
        AgentState.NeedsYou -> Palette.orange
        AgentState.Error -> Palette.red
        AgentState.Working, AgentState.Done -> Palette.blue
        AgentState.Idle -> Palette.label
    }

/** The app's palette, light and dark; the widget sits on the system background, as on iOS. */
internal object Palette {
    val background =
        ColorProvider(
            day = LightLpmColors.systemBackground,
            night = DarkLpmColors.systemBackground
        )
    val label = ColorProvider(day = LightLpmColors.label, night = DarkLpmColors.label)
    val secondary =
        ColorProvider(day = LightLpmColors.secondaryLabel, night = DarkLpmColors.secondaryLabel)
    val separator = ColorProvider(day = LightLpmColors.separator, night = DarkLpmColors.separator)
    val orange = ColorProvider(day = LightLpmColors.orange, night = DarkLpmColors.orange)
    val red = ColorProvider(day = LightLpmColors.red, night = DarkLpmColors.red)
    val blue = ColorProvider(day = LightLpmColors.blue, night = DarkLpmColors.blue)
}
