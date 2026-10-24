import Foundation

/// Word-level emphasis for modified lines. Each run of removed lines is paired
/// with the added lines after it: every removed line with the first added line,
/// a few past the previous pair, that is similar enough for a word diff to mean
/// something. Each pair is split into word, whitespace and punctuation tokens and
/// diffed, and only the tokens that differ are marked for the deeper tint.
enum WordDiff {
    /// Lines longer than this many characters are never word-diffed.
    static let maxLineLength = 500
    /// The largest grid of differing tokens (old × new) the diff walks; past it the
    /// whole differing middle counts as changed.
    static let maxCells = 4096
    /// How many added lines past the previous pair a removed line looks through.
    static let pairWindow = 8

    struct Token {
        // Every whitespace run shares one key: a change in spacing alone isn't one.
        let key: String
        let utf16Start: Int
        let utf16Length: Int
        // Characters that aren't whitespace; zero for a whitespace run.
        let solid: Int
    }

    /// Emphasis ranges (UTF-16, into each line's text) keyed by line index.
    static func emphasis(_ lines: [DiffLine]) -> [Int: [NSRange]] {
        var result: [Int: [NSRange]] = [:]
        var i = 0
        let n = lines.count
        while i < n {
            guard lines[i].kind == .removed else { i += 1; continue }
            var r = i
            while r < n && lines[r].kind == .removed { r += 1 }
            var a = r
            while a < n && lines[a].kind == .added { a += 1 }
            let old = lines[i..<r].map { tokens($0.text) }
            let new = lines[r..<a].map { tokens($0.text) }
            var next = 0
            for (x, oldTokens) in old.enumerated() {
                guard let oldTokens else { continue }
                for y in next..<min(new.count, next + pairWindow) {
                    guard let newTokens = new[y], let pair = diff(oldTokens, newTokens) else { continue }
                    if !pair.old.isEmpty { result[i + x] = pair.old }
                    if !pair.new.isEmpty { result[r + y] = pair.new }
                    next = y + 1
                    break
                }
            }
            i = a
        }
        return result
    }

    /// Runs of word characters, runs of spaces and tabs, and single punctuation
    /// characters after the line's indentation, which is left out so a re-indented
    /// line isn't a change; nil for a line too long to diff.
    static func tokens(_ line: String) -> [Token]? {
        let chars = Array(line)
        guard chars.count <= maxLineLength else { return nil }
        var out: [Token] = []
        var i = 0
        while i < chars.count && isSpace(chars[i]) { i += 1 }
        var utf16 = i
        while i < chars.count {
            let c = chars[i]
            var j = i + 1
            if isWordChar(c) {
                while j < chars.count && isWordChar(chars[j]) { j += 1 }
            } else if isSpace(c) {
                while j < chars.count && isSpace(chars[j]) { j += 1 }
            }
            let text = String(chars[i..<j])
            let length = text.utf16.count
            let space = isSpace(c)
            out.append(Token(key: space ? " " : text, utf16Start: utf16, utf16Length: length,
                             solid: space ? 0 : j - i))
            utf16 += length
            i = j
        }
        return out
    }

    /// The tokens that differ between a removed line and an added one, or nil when
    /// the two share too little: kept non-whitespace characters must be at least
    /// 40% of both lines' (a Dice similarity of 0.4).
    static func diff(_ a: [Token], _ b: [Token]) -> (old: [NSRange], new: [NSRange])? {
        if a.isEmpty || b.isEmpty { return nil }
        var keepA = [Bool](repeating: false, count: a.count)
        var keepB = [Bool](repeating: false, count: b.count)
        var p = 0
        while p < a.count && p < b.count && a[p].key == b[p].key {
            keepA[p] = true; keepB[p] = true; p += 1
        }
        var s = 0
        while s < a.count - p && s < b.count - p && a[a.count - 1 - s].key == b[b.count - 1 - s].key {
            keepA[a.count - 1 - s] = true; keepB[b.count - 1 - s] = true; s += 1
        }
        let n = a.count - p - s
        let m = b.count - p - s
        if n > 0 && m > 0 && n * m <= maxCells {
            keepCommon(a, b, from: p, n, m, &keepA, &keepB)
        }
        let solidA = a.reduce(0) { $0 + $1.solid }
        let solidB = b.reduce(0) { $0 + $1.solid }
        var common = 0
        for k in a.indices where keepA[k] { common += a[k].solid }
        guard solidA > 0, solidB > 0, 5 * common >= solidA + solidB else { return nil }
        return (spans(a, keepA), spans(b, keepB))
    }

    /// Marks a longest common subsequence of the two middles `[p, p+n)` and
    /// `[p, p+m)` as kept, taking a match whenever the heads are equal and otherwise
    /// dropping the old token on a tie.
    private static func keepCommon(_ a: [Token], _ b: [Token], from p: Int, _ n: Int, _ m: Int,
                                   _ keepA: inout [Bool], _ keepB: inout [Bool]) {
        let width = m + 1
        var table = [Int](repeating: 0, count: (n + 1) * width)
        for i in stride(from: n - 1, through: 0, by: -1) {
            for j in stride(from: m - 1, through: 0, by: -1) {
                table[i * width + j] = a[p + i].key == b[p + j].key
                    ? table[(i + 1) * width + j + 1] + 1
                    : max(table[(i + 1) * width + j], table[i * width + j + 1])
            }
        }
        var i = 0
        var j = 0
        while i < n && j < m {
            if a[p + i].key == b[p + j].key {
                keepA[p + i] = true; keepB[p + j] = true; i += 1; j += 1
            } else if table[(i + 1) * width + j] >= table[i * width + j + 1] {
                i += 1
            } else {
                j += 1
            }
        }
    }

    /// Each run of changed tokens as one range; a kept whitespace run between two
    /// changed tokens joins them, so a changed phrase reads as one highlight.
    private static func spans(_ tokens: [Token], _ keep: [Bool]) -> [NSRange] {
        var out: [NSRange] = []
        var k = 0
        while k < tokens.count {
            guard !keep[k] else { k += 1; continue }
            var end = k + 1
            while end < tokens.count {
                if !keep[end] {
                    end += 1
                } else if tokens[end].solid == 0 && end + 1 < tokens.count && !keep[end + 1] {
                    end += 2
                } else {
                    break
                }
            }
            let last = tokens[end - 1]
            let start = tokens[k].utf16Start
            out.append(NSRange(location: start, length: last.utf16Start + last.utf16Length - start))
            k = end
        }
        return out
    }

    private static func isWordChar(_ c: Character) -> Bool { c.isLetter || c.isNumber || c == "_" }

    private static func isSpace(_ c: Character) -> Bool { c == " " || c == "\t" }
}
