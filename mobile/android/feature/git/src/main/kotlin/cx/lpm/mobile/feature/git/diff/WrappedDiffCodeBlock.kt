package cx.lpm.mobile.feature.git.diff

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.unit.dp

/**
 * A block's code wrapped to the screen width (iOS `WrappedDiffCodeBlock`, the file
 * bar's "Wrap"): each line's number on its deeper tint, its +/- marker, then the
 * code, whose continuation rows hang under the code rather than under the gutter.
 */
@Composable
internal fun WrappedDiffCodeBlock(
    block: DiffBlock,
    colors: DiffColors,
    modifier: Modifier = Modifier
) {
    Column(modifier) {
        block.lines.forEach { line ->
            key(line.id) {
                val code = remember(line, colors) { lineText(line, colors) }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(IntrinsicSize.Min)
                        .background(colors.row(line.kind) ?: Color.Transparent)
                ) {
                    Text(
                        text = line.number,
                        style = DiffCodeStyle,
                        color = colors.gutterText,
                        softWrap = false,
                        modifier = Modifier
                            .fillMaxHeight()
                            .background(colors.gutter(line.kind))
                    )
                    Text(
                        text = line.kind.marker,
                        style = DiffCodeStyle,
                        color = colors.label,
                        softWrap = false
                    )
                    Text(
                        text = code,
                        style = DiffCodeStyle,
                        color = colors.label,
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 12.dp)
                    )
                }
            }
        }
    }
}

private fun lineText(line: DiffCodeLine, colors: DiffColors): AnnotatedString =
    buildAnnotatedString {
        append(line.code)
        line.tokens.forEach {
            addStyle(SpanStyle(color = colors.token(it.token)), it.start, it.end)
        }
        line.emphasis.forEach {
            val tint = if (it.added) colors.addWord else colors.delWord
            addStyle(SpanStyle(background = tint), it.start, it.end)
        }
    }
