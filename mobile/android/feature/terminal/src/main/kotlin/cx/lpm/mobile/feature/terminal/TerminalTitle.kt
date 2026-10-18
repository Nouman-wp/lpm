package cx.lpm.mobile.feature.terminal

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cx.lpm.mobile.core.data.link.LinkStatusLine
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.GitSnapshot
import kotlinx.coroutines.delay

internal val TitleLineHeight = 12.dp

/**
 * A terminal screen's title: the tab's name, how long its agent has been at it
 * above, and the project's uncommitted changes below. The connection's status
 * takes the top line whenever the Mac isn't connected. A line with nothing to say
 * keeps its room, so the name stays in the middle of the bar.
 */
@Composable
internal fun TerminalTitle(
    label: String,
    statusLine: LinkStatusLine?,
    agent: AgentTiming?,
    git: GitSnapshot?,
    gitLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.height(TitleLineHeight), contentAlignment = Alignment.Center) {
            when {
                statusLine != null -> ConnectionLine(statusLine)
                agent != null -> AgentLine(agent)
            }
        }
        Box(Modifier.height(20.dp), contentAlignment = Alignment.Center) {
            Text(
                text = label,
                style = TextStyle(
                    fontSize = fixedSp(15f),
                    lineHeight = fixedSp(20f),
                    fontWeight = FontWeight.SemiBold
                ),
                color = LpmTheme.colors.label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Box(Modifier.height(TitleLineHeight), contentAlignment = Alignment.Center) {
            TerminalChangesLine(git = git, loading = gitLoading, stale = statusLine != null)
        }
    }
}

/** The bar's text keeps its size at every font scale, as the iOS bar does. */
@Composable
internal fun fixedSp(points: Float): TextUnit = (points / LocalDensity.current.fontScale).sp

@Composable
internal fun titleLineStyle(weight: FontWeight): TextStyle = TextStyle(
    fontSize = fixedSp(10f),
    lineHeight = fixedSp(12f),
    fontWeight = weight,
    fontFeatureSettings = "tnum"
)

/**
 * How long the agent has been at it, with its state named when that isn't plain
 * work, in the state's color when it wants a look.
 */
@Composable
private fun AgentLine(agent: AgentTiming) {
    val colors = LpmTheme.colors
    val textColor = when (agent.state) {
        AgentState.NeedsYou -> colors.orange
        AgentState.Error -> colors.red
        else -> colors.secondaryLabel
    }
    val word = agent.state.label.takeUnless { agent.state == AgentState.Working }
    val now by produceState(agent.until ?: System.currentTimeMillis(), agent) {
        if (agent.until != null) return@produceState
        while (true) {
            delay(nextTick(value - agent.since))
            value = System.currentTimeMillis()
        }
    }
    val elapsed = preciseDuration((now - agent.since).coerceAtLeast(0) / MILLIS_PER_SECOND)
    Text(
        text = if (word != null) "$word · $elapsed" else elapsed,
        style = titleLineStyle(FontWeight.SemiBold),
        color = textColor,
        maxLines = 1
    )
}

/** Why the Mac isn't connected, in place of the agent's line. */
@Composable
private fun ConnectionLine(line: LinkStatusLine) {
    val colors = LpmTheme.colors
    val tint = if (line.tone == LinkStatusLine.Tone.Problem) colors.red else colors.orange
    val icon = when {
        line.pulse -> DesignR.drawable.ic_sync
        line.tone == LinkStatusLine.Tone.Problem -> DesignR.drawable.ic_error
        else -> DesignR.drawable.ic_bedtime
    }
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 1f,
        targetValue = 0.3f,
        animationSpec = infiniteRepeatable(tween(PULSE_MS), RepeatMode.Reverse),
        label = "icon"
    )
    LineRow(
        icon = icon,
        iconTint = tint,
        text = line.text,
        textColor = tint,
        iconAlpha = if (line.pulse) pulse else 1f
    )
}

@Composable
private fun LineRow(
    icon: Int,
    iconTint: Color,
    text: String,
    textColor: Color,
    iconAlpha: Float = 1f
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(10.dp).alpha(iconAlpha)
        )
        Text(
            text = text,
            style = titleLineStyle(FontWeight.SemiBold),
            color = textColor,
            maxLines = 1
        )
    }
}

private const val PULSE_MS = 800
private const val MILLIS_PER_SECOND = 1_000L
private const val SECONDS_PER_MINUTE = 60L
private const val PRECISE_FOR_MILLIS = 3_600_000L

/** Ticks each second while the reading shows seconds (its first hour), then each minute. */
private fun nextTick(elapsed: Long): Long {
    val step = if (elapsed < PRECISE_FOR_MILLIS) {
        MILLIS_PER_SECOND
    } else {
        MILLIS_PER_SECOND * SECONDS_PER_MINUTE
    }
    return step - ((elapsed % step) + step) % step
}

/** "45s", "4m 30s", "2h 5m". */
private fun preciseDuration(secs: Long): String {
    if (secs < SECONDS_PER_MINUTE) return "${secs}s"
    val mins = secs / SECONDS_PER_MINUTE
    if (mins < SECONDS_PER_MINUTE) {
        val rest = secs % SECONDS_PER_MINUTE
        return if (rest > 0) "${mins}m ${rest}s" else "${mins}m"
    }
    val rest = mins % SECONDS_PER_MINUTE
    val hours = mins / SECONDS_PER_MINUTE
    return if (rest > 0) "${hours}h ${rest}m" else "${hours}h"
}
