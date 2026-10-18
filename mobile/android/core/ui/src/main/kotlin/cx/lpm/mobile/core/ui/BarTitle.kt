package cx.lpm.mobile.core.ui

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import cx.lpm.mobile.core.model.GitSnapshot

private val BarTitleLineHeight = 12.dp

/**
 * A title in the bar, read alike on a project's screen and its terminals': [top]
 * above the [name], and the project's uncommitted changes below. A line with nothing
 * to say keeps its room, so the name stays in the middle of the bar. [stale] fades
 * the changes while the Mac is away, as the tree may have moved on since.
 */
@Composable
fun BarTitle(
    name: String,
    git: GitSnapshot?,
    gitLoading: Boolean,
    stale: Boolean,
    modifier: Modifier = Modifier,
    top: @Composable () -> Unit
) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.height(BarTitleLineHeight), contentAlignment = Alignment.Center) {
            top()
        }
        Box(Modifier.height(20.dp), contentAlignment = Alignment.Center) {
            Text(
                text = name,
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
        Box(Modifier.height(BarTitleLineHeight), contentAlignment = Alignment.Center) {
            ChangesLine(git = git, loading = gitLoading, stale = stale)
        }
    }
}

/** The text of a bar title's top and bottom lines. */
@Composable
fun barTitleLineStyle(weight: FontWeight): TextStyle = TextStyle(
    fontSize = fixedSp(10f),
    lineHeight = fixedSp(12f),
    fontWeight = weight,
    fontFeatureSettings = "tnum"
)

/** The bar's text keeps its size at every font scale, as the iOS bar does. */
@Composable
private fun fixedSp(points: Float): TextUnit = (points / LocalDensity.current.fontScale).sp

/** Why the Mac isn't connected, on a bar title's top line. */
@Composable
fun BarConnectionLine(line: LinkStatusLine, modifier: Modifier = Modifier) {
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
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(10.dp).alpha(if (line.pulse) pulse else 1f)
        )
        Text(
            text = line.text,
            style = barTitleLineStyle(FontWeight.SemiBold),
            color = tint,
            maxLines = 1
        )
    }
}

private const val PULSE_MS = 800
