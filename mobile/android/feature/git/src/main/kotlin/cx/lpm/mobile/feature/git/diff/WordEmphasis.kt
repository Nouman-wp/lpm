package cx.lpm.mobile.feature.git.diff

import cx.lpm.mobile.core.designsystem.code.graphemes
import cx.lpm.mobile.core.designsystem.code.isLetter
import cx.lpm.mobile.core.designsystem.code.isNumber
import cx.lpm.mobile.core.designsystem.code.utf16Length
import java.text.Normalizer

/** A word-level change inside a line: UTF-16 offset and length into its text. */
internal data class WordEmphasis(val location: Int, val length: Int)

/**
 * One token of a line: a run of word characters, a run of spaces and tabs, or one
 * punctuation character. Every whitespace run shares one [key], so a change in
 * spacing alone isn't one; [solid] counts the characters that aren't whitespace.
 */
internal class WordToken(val key: String, val utf16Start: Int, val utf16Length: Int, val solid: Int)

/**
 * Word-level emphasis for modified lines (iOS `WordDiff`), keyed by line index. Each
 * run of removed lines is paired with the added lines after it: every removed line
 * with the first added line, a few past the previous pair, similar enough for a word
 * diff to mean something. Only the tokens that differ are marked.
 */
internal fun computeEmphasis(lines: List<DiffLine>): Map<Int, List<WordEmphasis>> {
    val result = mutableMapOf<Int, List<WordEmphasis>>()
    var i = 0
    val n = lines.size
    while (i < n) {
        if (lines[i].kind != DiffLineKind.Removed) {
            i += 1
            continue
        }
        var r = i
        while (r < n && lines[r].kind == DiffLineKind.Removed) r += 1
        var a = r
        while (a < n && lines[a].kind == DiffLineKind.Added) a += 1
        val old = (i until r).map { wordTokens(lines[it].text) }
        val new = (r until a).map { wordTokens(lines[it].text) }
        var next = 0
        for ((x, oldTokens) in old.withIndex()) {
            if (oldTokens == null) continue
            for (y in next until minOf(new.size, next + PAIR_WINDOW)) {
                val newTokens = new[y] ?: continue
                val (oldMarks, newMarks) = wordDiff(oldTokens, newTokens) ?: continue
                if (oldMarks.isNotEmpty()) result[i + x] = oldMarks
                if (newMarks.isNotEmpty()) result[r + y] = newMarks
                next = y + 1
                break
            }
        }
        i = a
    }
    return result
}

/**
 * The line's tokens after its indentation, which is left out so a re-indented line
 * isn't a change; null for a line too long to diff.
 */
internal fun wordTokens(line: String): List<WordToken>? {
    val chars = graphemes(line)
    if (chars.size > MAX_LINE_LENGTH) return null
    val out = mutableListOf<WordToken>()
    var i = 0
    while (i < chars.size && isSpace(chars[i])) i += 1
    var utf16 = i
    while (i < chars.size) {
        val c = chars[i]
        var j = i + 1
        if (isWordChar(c)) {
            while (j < chars.size && isWordChar(chars[j])) j += 1
        } else if (isSpace(c)) {
            while (j < chars.size && isSpace(chars[j])) j += 1
        }
        val length = chars.utf16Length(i, j)
        val space = isSpace(c)
        val key = if (space) " " else canonical(chars.subList(i, j).joinToString(""))
        out += WordToken(key, utf16, length, if (space) 0 else j - i)
        utf16 += length
        i = j
    }
    return out
}

/**
 * The tokens that differ between a removed line and an added one, or null when the
 * two share too little: kept non-whitespace characters must be at least 40% of both
 * lines' (a Dice similarity of 0.4).
 */
internal fun wordDiff(
    a: List<WordToken>,
    b: List<WordToken>
): Pair<List<WordEmphasis>, List<WordEmphasis>>? {
    if (a.isEmpty() || b.isEmpty()) return null
    val keepA = BooleanArray(a.size)
    val keepB = BooleanArray(b.size)
    var p = 0
    while (p < a.size && p < b.size && a[p].key == b[p].key) {
        keepA[p] = true
        keepB[p] = true
        p += 1
    }
    var s = 0
    while (s < a.size - p && s < b.size - p && a[a.size - 1 - s].key == b[b.size - 1 - s].key) {
        keepA[a.size - 1 - s] = true
        keepB[b.size - 1 - s] = true
        s += 1
    }
    val n = a.size - p - s
    val m = b.size - p - s
    if (n > 0 && m > 0 && n * m <= MAX_CELLS) keepCommon(a, b, p, n, m, keepA, keepB)
    val solidA = a.sumOf { it.solid }
    val solidB = b.sumOf { it.solid }
    val common = a.indices.sumOf { if (keepA[it]) a[it].solid else 0 }
    if (solidA == 0 || solidB == 0 || 5 * common < solidA + solidB) return null
    return spans(a, keepA) to spans(b, keepB)
}

/**
 * Marks a longest common subsequence of the middles `[p, p+n)` and `[p, p+m)` as
 * kept, taking a match whenever the heads are equal and otherwise dropping the old
 * token on a tie.
 */
private fun keepCommon(
    a: List<WordToken>,
    b: List<WordToken>,
    p: Int,
    n: Int,
    m: Int,
    keepA: BooleanArray,
    keepB: BooleanArray
) {
    val width = m + 1
    val table = IntArray((n + 1) * width)
    for (i in n - 1 downTo 0) {
        for (j in m - 1 downTo 0) {
            table[i * width + j] = if (a[p + i].key == b[p + j].key) {
                table[(i + 1) * width + j + 1] + 1
            } else {
                maxOf(table[(i + 1) * width + j], table[i * width + j + 1])
            }
        }
    }
    var i = 0
    var j = 0
    while (i < n && j < m) {
        if (a[p + i].key == b[p + j].key) {
            keepA[p + i] = true
            keepB[p + j] = true
            i += 1
            j += 1
        } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
            i += 1
        } else {
            j += 1
        }
    }
}

/**
 * Each run of changed tokens as one range; a kept whitespace run between two changed
 * tokens joins them, so a changed phrase reads as one highlight.
 */
private fun spans(tokens: List<WordToken>, keep: BooleanArray): List<WordEmphasis> {
    val out = mutableListOf<WordEmphasis>()
    var k = 0
    while (k < tokens.size) {
        if (keep[k]) {
            k += 1
            continue
        }
        var end = k + 1
        while (end < tokens.size) {
            if (!keep[end]) {
                end += 1
            } else if (tokens[end].solid == 0 && end + 1 < tokens.size && !keep[end + 1]) {
                end += 2
            } else {
                break
            }
        }
        val last = tokens[end - 1]
        val start = tokens[k].utf16Start
        out += WordEmphasis(start, last.utf16Start + last.utf16Length - start)
        k = end
    }
    return out
}

// Swift compares strings by canonical equivalence: "é" is "é".
private fun canonical(s: String): String =
    if (s.all { it.code < ASCII_END }) s else Normalizer.normalize(s, Normalizer.Form.NFC)

private fun isWordChar(c: String) = c.isLetter() || c.isNumber() || c == "_"

private fun isSpace(c: String) = c == " " || c == "\t"

private const val ASCII_END = 0x80

// Lines longer than this many characters are never word-diffed.
private const val MAX_LINE_LENGTH = 500

// The largest grid of differing tokens the diff walks; past it the whole middle counts as changed.
private const val MAX_CELLS = 4096

// How many added lines past the previous pair a removed line looks through.
private const val PAIR_WINDOW = 8
