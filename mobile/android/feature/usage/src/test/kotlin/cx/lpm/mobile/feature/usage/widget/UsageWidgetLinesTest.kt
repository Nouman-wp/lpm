package cx.lpm.mobile.feature.usage.widget

import cx.lpm.mobile.core.model.LimitWindow
import cx.lpm.mobile.feature.usage.rows.UsageAccountMark
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageWidgetLinesTest {
    private val now = 1_792_000_000_000.0
    private val nowSeconds = (now / 1000).toLong()
    private val hour = 3_600L
    private val day = 24 * hour

    private fun window(used: Double, resetsIn: Long) =
        UsageWidgetWindow(used, nowSeconds + resetsIn)

    private fun row(
        id: String,
        weekly: UsageWidgetWindow? = null,
        fiveHour: UsageWidgetWindow? = null,
        mark: UsageAccountMark? = null,
        tokens: Long = 0,
        updatedAt: Long? = now.toLong()
    ) = UsageWidgetRow(id, "claude", id, mark, weekly, fiveHour, tokens, updatedAt)

    @Test
    fun `a row reads its weekly window with the reset and the pace tick`() {
        val line = usageWidgetLines(
            listOf(row("a", weekly = window(96.0, 10 * hour))),
            now,
            3
        ).single()
        assertEquals("96%", line.percentText)
        assertEquals("10h", line.detail)
        assertEquals("", line.windowShort)
        assertEquals("weekly", line.windowLabel)
        assertEquals(0.96, line.fraction, 1e-9)
        assertEquals(1 - 10.0 / (7 * 24), line.pace!!, 1e-9)
    }

    @Test
    fun `a weekly window past its reset gives way to the 5-hour one`() {
        val line = usageWidgetLines(
            listOf(row("a", weekly = window(96.0, -hour), fiveHour = window(38.0, 2 * hour))),
            now,
            3
        ).single()
        assertEquals("38%", line.percentText)
        assertEquals("5h", line.windowShort)
        assertEquals("2h", line.detail)
    }

    @Test
    fun `rows without a window are measured against each other`() {
        val lines = usageWidgetLines(
            listOf(row("a", tokens = 2_000_000), row("b", tokens = 500_000), row("c")),
            now,
            3
        )
        assertEquals(listOf(1.0, 0.25, 0.0), lines.map { it.fraction })
        assertEquals(listOf("2.0M today", "500K today", "—"), lines.map { it.detail })
        assertTrue(lines.all { it.percentText.isEmpty() && it.pace == null && !it.windowed })
    }

    @Test
    fun `a reading older than a quarter hour is stale`() {
        val lines = usageWidgetLines(
            listOf(
                row("fresh", updatedAt = now.toLong() - 14 * 60_000),
                row("old", updatedAt = now.toLong() - 16 * 60_000),
                row("never", updatedAt = null)
            ),
            now,
            3
        )
        assertEquals(listOf(false, true, false), lines.map { it.stale })
    }

    @Test
    fun `past three rows it keeps the account in use and the fullest, in order`() {
        val lines = usageWidgetLines(
            listOf(
                row("low", weekly = window(5.0, day)),
                row("current", weekly = window(10.0, day), mark = UsageAccountMark.Current),
                row("high", weekly = window(90.0, day)),
                row("mid", weekly = window(50.0, day))
            ),
            now,
            3
        )
        assertEquals(listOf("current", "high", "mid"), lines.map { it.id })
    }

    @Test
    fun `a window with no figure saves without one and reads as 0%`() {
        val saved = UsageWidgetWindow.of(LimitWindow(Double.NaN, nowSeconds + hour))
        assertNull(saved.usedPercent)
        val json = Json { ignoreUnknownKeys = true }
        val mac = UsageWidgetMac("mac", listOf(row("a", weekly = saved)))
        val read = json.decodeFromString<UsageWidgetMac>(json.encodeToString(mac))
        assertEquals(mac, read)
        val line = usageWidgetLines(read.rows, now, 3).single()
        assertEquals("0%", line.percentText)
        assertFalse(line.stale)
    }
}
