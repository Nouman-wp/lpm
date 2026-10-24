package cx.lpm.mobile.feature.git.diff

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WordEmphasisTest {
    /** Each changed line of a one-hunk diff with the text its emphasis covers. */
    private fun marks(vararg lines: String): List<Pair<String, List<String>>> {
        val parsed = parseDiffLines("@@ -1 +1 @@\n" + lines.joinToString("\n") + "\n")
        val emphasis = computeEmphasis(parsed)
        return parsed.filter { it.kind == DiffLineKind.Removed || it.kind == DiffLineKind.Added }
            .map { line ->
                line.kind.marker + line.text to emphasis[line.id].orEmpty().map {
                    line.text.substring(it.location, it.location + it.length)
                }
            }
    }

    private fun highlighted(vararg lines: String) = marks(*lines).map { it.second }

    @Test
    fun `an inserted argument is the only highlight`() {
        assertEquals(
            listOf(
                "-await submitOrder({ email, items: cart.items })" to emptyList(),
                "+await submitOrder({ email, intent, items: cart.items })" to listOf("intent, ")
            ),
            marks(
                "-await submitOrder({ email, items: cart.items })",
                "+await submitOrder({ email, intent, items: cart.items })"
            )
        )
    }

    @Test
    fun `a removed line pairs with its counterpart past unrelated added lines`() {
        assertEquals(
            listOf(
                emptyList(),
                emptyList(),
                emptyList(),
                emptyList(),
                listOf("intent, "),
                emptyList(),
                emptyList()
            ),
            highlighted(
                "-    await submitOrder({ email, items: cart.items })",
                "-    onComplete()",
                "+    setError(null)",
                "+    try {",
                "+      await submitOrder({ email, intent, items: cart.items })",
                "+      onComplete()",
                "+    } catch {"
            )
        )
    }

    @Test
    fun `lines with too little in common get no highlight`() {
        assertEquals(
            List(6) { emptyList<String>() },
            highlighted(
                "-abc",
                "-completely different line",
                "-removeOnly(1)",
                "+xyz",
                "+another thing entirely here",
                "+addOnly(1)"
            )
        )
    }

    @Test
    fun `a changed indent alone isn't highlighted`() {
        assertEquals(
            listOf(emptyList<String>(), emptyList()),
            highlighted("-  <h1>Checkout</h1>", "+      <h1>Checkout</h1>")
        )
    }

    @Test
    fun `changed words a space apart read as one highlight`() {
        assertEquals(
            listOf(listOf("first second"), listOf("other words")),
            highlighted("-let label = first second + tail", "+let label = other words + tail")
        )
    }

    @Test
    fun `tokens are words, whitespace runs and single punctuation after the indent`() {
        assertEquals(
            listOf("a_b1", " ", "(", "x", ")", "-", ">", "é"),
            wordTokens("\t  a_b1  (x)->é")?.map { it.key }
        )
        assertEquals(
            listOf(3, 7, 9, 10, 11, 12, 13, 14),
            wordTokens("\t  a_b1  (x)->é")?.map {
                it.utf16Start
            }
        )
    }

    @Test
    fun `a counterpart more than eight added lines on is left unpaired`() {
        val far = arrayOf("-target(1)") + Array(8) { "+inserted($it)" } + "+target(2)"
        assertEquals(List(10) { emptyList<String>() }, highlighted(*far))
        val near = arrayOf("-target(1)") + Array(7) { "+inserted($it)" } + "+target(2)"
        assertEquals(
            listOf(listOf("1")) + List(7) {
                emptyList()
            } + listOf(listOf("2")),
            highlighted(*near)
        )
    }

    @Test
    fun `a line over 500 characters isn't word-diffed`() {
        val long = "x".repeat(490)
        assertEquals(
            List(2) { emptyList<String>() },
            highlighted("-s = \"$long\" // old", "+s = \"$long\" // new")
        )
        val short = "x".repeat(470)
        assertEquals(
            listOf(listOf("old"), listOf("new")),
            highlighted("-s = \"$short\" // old", "+s = \"$short\" // new")
        )
    }

    @Test
    fun `a middle too big to walk counts as changed whole`() {
        val ends = "k ".repeat(60)
        val old = ends + (0 until 35).joinToString(" ") { "a$it" } + ends.reversed()
        val new = ends + (0 until 35).joinToString(" ") {
            if (it == 0 || it == 34) "b$it" else "a$it"
        } + ends.reversed()
        val (removed, added) = highlighted("-$old", "+$new")
        assertEquals(listOf((0 until 35).joinToString(" ") { "a$it" }), removed)
        assertEquals(1, added.size)
        assertTrue(added[0].startsWith("b0 a1") && added[0].endsWith("a33 b34"))
    }

    @Test
    fun `characters match by canonical equivalence and ranges count UTF-16`() {
        assertEquals(
            listOf(listOf("1"), listOf("2")),
            highlighted("-const café = 1", "+const café = 2")
        )
        assertEquals(
            listOf(listOf("👋"), listOf("👋🏽")),
            highlighted("-x = \"hi 👋 there\"", "+x = \"hi 👋🏽 there\"")
        )
    }
}
