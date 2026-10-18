package cx.lpm.mobile.feature.usage.widget

import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenActivitySnapshotTest {
    private val zone = ZoneOffset.UTC
    private val oct18 = LocalDate.of(2026, 10, 18)
    private val noonOct18 = oct18.atTime(12, 0).toInstant(zone).toEpochMilli()

    private val snapshot = TokenActivitySnapshot(
        generatedAt = noonOct18,
        days = listOf(
            TokenActivityDay("2026-10-10", 9_600_000, 1_200_000, 11.52),
            TokenActivityDay("2026-10-16", 44_800_000, 14_600_000, 49.52),
            TokenActivityDay("2026-10-18", 15_100_000, 3_700_000, 17.31)
        )
    )

    @Test
    fun `a window ends on the read's day and fills the quiet days`() {
        val week = snapshot.window(7, today = oct18, zone = zone)
        assertEquals(
            listOf(
                "2026-10-12",
                "2026-10-13",
                "2026-10-14",
                "2026-10-15",
                "2026-10-16",
                "2026-10-17",
                "2026-10-18"
            ),
            week.days.map { it.date }
        )
        assertEquals(0L, week.days[5].totalTokens)
        assertEquals(78_200_000L, week.tokens)
        assertEquals(66.83, week.cost, 1e-9)
        assertTrue(week.endsToday)
    }

    @Test
    fun `a longer range reaches older days`() {
        val fortnight = snapshot.window(14, today = oct18, zone = zone)
        assertEquals("2026-10-05", fortnight.days.first().date)
        assertEquals(89_000_000L, fortnight.tokens)
    }

    @Test
    fun `a read from yesterday no longer ends today`() {
        assertFalse(snapshot.window(7, today = oct18.plusDays(1), zone = zone).endsToday)
    }
}
