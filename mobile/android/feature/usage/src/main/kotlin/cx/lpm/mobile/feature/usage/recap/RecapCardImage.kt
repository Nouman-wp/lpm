package cx.lpm.mobile.feature.usage.recap

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density

/** The card laid out at 600 design units and scaled to the width it's given. */
@Composable
internal fun ScaledRecapCard(view: RecapView, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val unit = constraints.maxWidth.toFloat() / RECAP_WIDTH
        CompositionLocalProvider(LocalDensity provides Density(unit, fontScale = 1f)) {
            WeeklyRecapCard(view)
        }
    }
}

/**
 * The same card unframed at twice its design size (1200 px wide), recorded into [layer]
 * for the share image and never drawn: it takes no room and has nothing for accessibility.
 */
@Composable
internal fun RecapCardSnapshot(view: RecapView, layer: GraphicsLayer) {
    Box(
        Modifier
            .clearAndSetSemantics {}
            .layout { measurable, _ ->
                val placeable = measurable.measure(Constraints())
                layout(0, 0) { placeable.place(0, 0) }
            }
    ) {
        CompositionLocalProvider(
            LocalDensity provides Density(RECAP_IMAGE_SCALE, fontScale = 1f)
        ) {
            WeeklyRecapCard(
                view,
                Modifier.drawWithContent { layer.record { this@drawWithContent.drawContent() } },
                framed = false
            )
        }
    }
}
