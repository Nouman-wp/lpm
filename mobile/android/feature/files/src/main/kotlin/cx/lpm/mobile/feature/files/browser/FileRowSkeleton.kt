package cx.lpm.mobile.feature.files.browser

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.component.ListRow
import cx.lpm.mobile.core.designsystem.component.Shimmer
import cx.lpm.mobile.core.designsystem.component.SkeletonBar
import cx.lpm.mobile.core.designsystem.theme.LpmTheme

/** Ghost of a file or folder row, while a folder or Go to File's index loads. */
@Composable
internal fun FileRowSkeleton(width: Dp, modifier: Modifier = Modifier) {
    ListRow(
        modifier = modifier.clearAndSetSemantics {},
        leading = {
            Shimmer {
                Box(
                    Modifier
                        .size(width = 22.dp, height = 18.dp)
                        .background(LpmTheme.colors.tertiarySystemFill, RoundedCornerShape(4.dp))
                )
            }
        },
        leadingSlot = FileIconSlot
    ) {
        Shimmer { SkeletonBar(width) }
    }
}

/** The widths of a loading list's ghost rows, so they read as names of different lengths. */
internal val FolderSkeletonWidths = listOf(120.dp, 150.dp, 96.dp, 170.dp, 132.dp)
internal val SearchSkeletonWidths = listOf(150.dp, 110.dp, 170.dp)
