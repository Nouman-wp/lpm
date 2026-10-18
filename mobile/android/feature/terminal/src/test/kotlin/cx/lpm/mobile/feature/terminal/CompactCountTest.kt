package cx.lpm.mobile.feature.terminal

import org.junit.Assert.assertEquals
import org.junit.Test

class CompactCountTest {
    @Test
    fun `small counts read in full`() {
        assertEquals("0", compactCount(0))
        assertEquals("656", compactCount(656))
        assertEquals("9999", compactCount(9_999))
    }

    @Test
    fun `large counts shorten to a tenth, then whole units`() {
        assertEquals("10k", compactCount(10_000))
        assertEquals("12.4k", compactCount(12_400))
        assertEquals("12.5k", compactCount(12_450))
        assertEquals("100k", compactCount(99_960))
        assertEquals("214k", compactCount(214_300))
        assertEquals("1.2M", compactCount(1_234_567))
    }
}
