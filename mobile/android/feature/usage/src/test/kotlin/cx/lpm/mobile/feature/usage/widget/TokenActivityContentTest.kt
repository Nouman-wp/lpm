package cx.lpm.mobile.feature.usage.widget

import android.content.Context
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasText
import androidx.glance.testing.unit.hasTextEqualTo
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TokenActivityContentTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    private val week = TokenActivityWindow(
        listOf(
            TokenActivityDay("2026-10-12", 9_600_000, 1_200_000, 11.52),
            TokenActivityDay("2026-10-13", 0, 0, 0.0),
            TokenActivityDay("2026-10-14", 24_600_000, 6_800_000, 27.15),
            TokenActivityDay("2026-10-15", 31_400_000, 9_200_000, 33.70),
            TokenActivityDay("2026-10-16", 44_800_000, 14_600_000, 49.52),
            TokenActivityDay("2026-10-17", 12_400_000, 2_900_000, 17.23),
            TokenActivityDay("2026-10-18", 15_100_000, 3_700_000, 17.31)
        ),
        endsToday = true
    )

    @Test
    fun `medium shows the totals, the price per million and the axis`() =
        runGlanceAppWidgetUnitTest {
            setAppWidgetSize(DpSize(340.dp, 160.dp))
            setContext(context)
            provideComposable { TokenActivityContent(7, week, launch = null) }

            onNode(hasText("Token activity")).assertExists()
            onNode(hasTextEqualTo("176M")).assertExists()
            onNode(hasTextEqualTo("$156")).assertExists()
            onNode(hasText("/ 1M")).assertExists()
            onNode(hasTextEqualTo("Today")).assertExists()
            onNode(hasTextEqualTo("30D")).assertExists()
        }

    @Test
    fun `small keeps the totals and the pills`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(160.dp, 180.dp))
        setContext(context)
        provideComposable { TokenActivityContent(7, week, launch = null) }

        onNode(hasText("Token activity")).assertExists()
        onNode(hasTextEqualTo("176M")).assertExists()
        onNode(hasTextEqualTo("$156")).assertExists()
        onNode(hasTextEqualTo("7D")).assertExists()
        onNode(hasTextEqualTo("30D")).assertExists()
        onNode(hasText("/ 1M")).assertDoesNotExist()
        onNode(hasTextEqualTo("Today")).assertDoesNotExist()
    }

    @Test
    fun `small with nothing saved asks to open the app`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(160.dp, 180.dp))
        setContext(context)
        provideComposable { TokenActivityContent(7, null, launch = null) }

        onNode(hasText("No numbers yet")).assertExists()
        onNode(hasTextEqualTo("Open lpm to load it.")).assertExists()
    }
}
