package cx.lpm.mobile.feature.files.browser

import cx.lpm.mobile.core.model.MentionEntry
import org.junit.Assert.assertEquals
import org.junit.Test

class GoToFileTest {
    private fun file(path: String, changed: Boolean = false) =
        MentionEntry(path, dir = false, changed = changed)

    private val index = listOf(
        MentionEntry("src/app/checkout", dir = true, changed = true),
        file("src/app/checkout/page.tsx"),
        file("src/lib/tax.ts"),
        file("components/CheckoutButton.tsx", changed = true),
        file("components/Cart.tsx"),
        file("README.md")
    )

    @Test
    fun `names come before folder paths, changed files first, folders never`() {
        assertEquals(
            listOf("components/CheckoutButton.tsx", "src/app/checkout/page.tsx"),
            goToFileMatches(index, "checkout").map { it.path }
        )
    }

    @Test
    fun `the match ignores case and stops at the limit`() {
        assertEquals(listOf("README.md"), goToFileMatches(index, "readme").map { it.path })
        assertEquals(2, goToFileMatches(index, "s", limit = 2).size)
    }

    @Test
    fun `a path splits into its name and folder`() {
        assertEquals("page.tsx", fileName("src/app/page.tsx"))
        assertEquals("src/app", folderOf("src/app/page.tsx"))
        assertEquals("", folderOf("README.md"))
        assertEquals("app", fileName("src/app"))
    }
}
