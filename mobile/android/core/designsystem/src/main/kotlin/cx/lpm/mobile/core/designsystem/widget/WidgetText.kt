package cx.lpm.mobile.core.designsystem.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.text.TextPaint
import android.text.TextUtils
import android.util.TypedValue
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.createBitmap
import cx.lpm.mobile.core.designsystem.theme.AgentWorkingSweep
import kotlin.math.ceil

/**
 * Widget text measured the way the widget lays it out, so a title too long for its
 * row ends in "…" as on iOS, and the working sweep — which a widget's text can't
 * take — can be drawn as an image.
 */
class WidgetText(context: Context, sizeSp: Float, medium: Boolean) {
    private val density = context.resources.displayMetrics.density
    private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP,
            sizeSp,
            context.resources.displayMetrics
        )
        typeface =
            if (medium) Typeface.create("sans-serif-medium", Typeface.NORMAL) else Typeface.DEFAULT
    }

    fun widthDp(text: String): Float = paint.measureText(text) / density

    fun fit(text: String, widthDp: Float): String =
        TextUtils.ellipsize(text, paint, widthDp * density, TextUtils.TruncateAt.END).toString()

    /** `text` in the working sweep held at its start, as iOS draws it where it can't move. */
    fun sweep(text: String): SweptText {
        val width = ceil(paint.measureText(text)).toInt().coerceAtLeast(1)
        val metrics = paint.fontMetricsInt
        val height = (metrics.descent - metrics.ascent).coerceAtLeast(1)
        val bitmap = createBitmap(width, height)
        paint.shader = LinearGradient(0f, 0f, width * LAPS, 0f, Strip, null, Shader.TileMode.CLAMP)
        Canvas(bitmap).drawText(text, 0f, -metrics.ascent.toFloat(), paint)
        paint.shader = null
        return SweptText(bitmap, width / density, height / density)
    }

    private companion object {
        // The strip spans nine widths of the text, as iOS's `AgentSweep.still`.
        const val LAPS = 9f
    }
}

// A lap of the palette spans three widths of the text; the strip holds three laps
// closed on its first color, as iOS's `AgentSweep.strip`.
private val Strip = (
    AgentWorkingSweep + AgentWorkingSweep + AgentWorkingSweep +
        AgentWorkingSweep[0]
    )
    .map { it.toArgb() }
    .toIntArray()

class SweptText(val bitmap: Bitmap, val widthDp: Float, val heightDp: Float)
