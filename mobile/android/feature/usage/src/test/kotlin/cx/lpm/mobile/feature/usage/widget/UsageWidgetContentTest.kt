package cx.lpm.mobile.feature.usage.widget

import android.content.Context
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasText
import androidx.glance.testing.unit.hasTextEqualTo
import androidx.test.core.app.ApplicationProvider
import cx.lpm.mobile.feature.usage.rows.UsageAccountMark
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class UsageWidgetContentTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val now = 1_792_000_000_000L
    private val hour = 3_600L

    private fun window(used: Double, resetsIn: Long) =
        UsageWidgetWindow(used, now / 1000 + resetsIn)

    private val mac = UsageWidgetMac(
        "mac",
        listOf(
            UsageWidgetRow(
                "claude:two",
                "claude",
                "Claude 2",
                UsageAccountMark.Current,
                weekly = window(96.0, 10 * hour + 35 * 60),
                updatedAt = now
            ),
            UsageWidgetRow(
                "claude:default",
                "claude",
                "Claude",
                UsageAccountMark.Standby,
                weekly = window(44.0, 91 * hour),
                updatedAt = now
            ),
            UsageWidgetRow(
                "codex",
                "codex",
                "Codex",
                weekly = window(11.0, 136 * hour),
                updatedAt = now
            )
        ),
        seenAt = now
    )

    @Test
    fun `medium shows each row's name, tag, reset and share`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(340.dp, 160.dp))
        setContext(context)
        provideComposable { UsageWidgetContent(mac, now, launch = null) }

        onNode(hasText("Usage")).assertExists()
        onNode(hasText("Claude 2")).assertExists()
        onNode(hasText("in use")).assertExists()
        onNode(hasText("pool")).assertExists()
        onNode(hasText("10h 35m")).assertExists()
        onNode(hasText("96%")).assertExists()
        onNode(hasText("5d 16h")).assertExists()
        onNode(hasText("11%")).assertExists()
    }

    @Test
    fun `small keeps the name and the share`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(160.dp, 160.dp))
        setContext(context)
        provideComposable { UsageWidgetContent(mac, now, launch = null) }

        onNode(hasText("Claude 2")).assertExists()
        onNode(hasText("96%")).assertExists()
        onNode(hasText("in use")).assertDoesNotExist()
        onNode(hasText("10h 35m")).assertDoesNotExist()
    }

    @Test
    fun `with nothing saved it asks to open the app`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(340.dp, 160.dp))
        setContext(context)
        provideComposable { UsageWidgetContent(null, now, launch = null) }

        onNode(hasText("No usage yet")).assertExists()
        onNode(hasTextEqualTo("Open lpm")).assertExists()
    }
}
