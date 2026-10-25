package cx.lpm.mobile.feature.usage.recap

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

// lpm's app icon in its own units: one lit dot and two rings in a 720-unit square at 180.
private const val MARK_ORIGIN = 180f
private const val MARK_SIZE = 720f
private val MarkDot = Triple(349f, 349f, 159f)
private val MarkRings = listOf(Triple(734f, 452f, 140f), Triple(452f, 733f, 140f))
private const val MARK_STROKE = 44f

/** lpm's mark and address, the card's signature. */
@Composable
internal fun RecapMark(modifier: Modifier = Modifier) {
    val box = RoundedCornerShape(7.dp)
    Row(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(29.dp)
                .background(RecapColors.markGround, box)
                .border(1.dp, RecapColors.markBorder, box),
            contentAlignment = Alignment.Center
        ) {
            Canvas(Modifier.size(17.dp)) {
                val scale = size.width / MARK_SIZE
                fun at(x: Float, y: Float) = Offset(
                    (x - MARK_ORIGIN) * scale,
                    (y - MARK_ORIGIN) * scale
                )
                drawCircle(
                    RecapColors.markDot,
                    MarkDot.third * scale,
                    at(MarkDot.first, MarkDot.second)
                )
                MarkRings.forEach { (x, y, r) ->
                    drawCircle(
                        RecapColors.markRing,
                        r * scale,
                        at(x, y),
                        style = Stroke(MARK_STROKE * scale)
                    )
                }
            }
        }
        Text("lpm.cx", style = recapText(14, bodyLine(14), RecapColors.muted))
    }
}
