package cx.lpm.mobile.feature.projects.resume

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.component.Shimmer
import cx.lpm.mobile.core.designsystem.component.SkeletonBar

/** Ghost of a two-line row (a title over its details), while the Resume Session list loads. */
@Composable
internal fun TwoLineRowSkeleton(titleWidth: Dp, detailWidth: Dp, modifier: Modifier = Modifier) {
    ListRow(modifier = modifier.clearAndSetSemantics {}) {
        Shimmer {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SkeletonBar(titleWidth)
                SkeletonBar(detailWidth, height = 10.dp)
            }
        }
    }
}
