import SwiftUI
import UIKit

enum DiffLineKind {
    case added, removed, hunk, context

    /// The diff's own prefix: "+", "-", or a space for context.
    var marker: String {
        switch self {
        case .added: return "+"
        case .removed: return "-"
        default: return " "
        }
    }
}

struct DiffLine: Identifiable {
    let id: Int
    // Rendered code with the diff prefix stripped and the hunk's common indent
    // trimmed; for a hunk line, the trailing context snippet.
    let text: String
    let kind: DiffLineKind
    // Hunk line only: the compact "@@ <new-start>" label and the number of shared
    // leading whitespace columns trimmed from this hunk's code (0 = none).
    let hunkLabel: String
    let indentHint: Int
    // Gutter line numbers: old-file number for removed + context, new-file number
    // for added + context.
    let oldNumber: Int?
    let newNumber: Int?
}

enum DiffBlockKind { case hunk, code }

/// One render unit: a hunk separator, or a run of code lines merged into a single
/// gutter attributed string (line numbers, deeper tint) and a single code
/// attributed string (leading +/- marker, syntax highlighting, word-level
/// emphasis), plus each line's kind for the row tint drawn behind it, and the same
/// lines one by one for the wrapped layout. A long code run is split into several
/// consecutive blocks of at most `chunkLimit` lines so no single Text has to lay
/// out thousands of lines at once. The SwiftUI `AttributedString`s are converted
/// once here, off the main thread, so the view just renders them.
struct DiffBlock: Identifiable {
    let id: Int
    let kind: DiffBlockKind
    let hunkLabel: String
    let hunkContext: String
    let indentHint: Int
    let gutter: AttributedString
    let code: AttributedString
    let rows: [DiffLineKind]
    let lineCount: Int
    let lines: [DiffCodeLine]
}

/// One code line for the wrapped layout: its gutter number, and its highlighted
/// code with the word emphasis, without the marker or the run's padding.
struct DiffCodeLine: Identifiable {
    let id: Int
    let kind: DiffLineKind
    let number: String
    let code: AttributedString
}

/// A diff parsed into per-hunk merged blocks (for horizontal-scroll rendering with
/// a pinned gutter) plus a flat line list for counts/stats. Common indentation is
/// trimmed per hunk, file headers dropped, and marker + syntax highlighting +
/// word-level emphasis baked in — all off the main thread, cached per diffKey.
struct ParsedDiff {
    let lines: [DiffLine]
    let blocks: [DiffBlock]
    let addedCount: Int
    let removedCount: Int

    init(_ diff: String, ext: String) {
        let base = Self.parse(diff)
        let emphasis = WordDiff.emphasis(base)
        var highlighter = DiffHighlighter(ext: ext)
        var fg: [NSAttributedString?] = Array(repeating: nil, count: base.count)
        for (idx, line) in base.enumerated() where line.kind != .hunk {
            fg[idx] = highlighter.highlight(line.text)
        }
        lines = base
        let maxNumber = base.map { max($0.oldNumber ?? 0, $0.newNumber ?? 0) }.max() ?? 0
        let digits = max(2, String(maxNumber).count)
        addedCount = base.filter { $0.kind == .added }.count
        removedCount = base.filter { $0.kind == .removed }.count
        blocks = Self.buildBlocks(base: base, fg: fg, emphasis: emphasis, digits: digits)
    }

    /// Parses hunk by hunk so each hunk's common leading indentation is trimmed and
    /// old/new line numbers are assigned by walking from the header's start lines.
    static func parse(_ diff: String) -> [DiffLine] {
        // "\r\n" is a single Character in Swift, so split a CRLF diff only after
        // normalizing its line endings.
        var raw = diff.replacingOccurrences(of: "\r\n", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        // The newline ending the diff's last line leaves one empty piece behind;
        // kept, it would render as a phantom numbered context line.
        if raw.last == "" { raw.removeLast() }
        var out: [DiffLine] = []
        var i = 0
        let n = raw.count
        while i < n {
            let line = raw[i]
            if isFileHeader(line) || line.hasPrefix("\\") { i += 1; continue }
            guard line.hasPrefix("@@") else { i += 1; continue }

            let header = parseHunkHeader(line)
            var codes: [(DiffLineKind, String)] = []
            var j = i + 1
            while j < n {
                let l = raw[j]
                if l.hasPrefix("@@") { break }
                if isFileHeader(l) || l.hasPrefix("\\") { j += 1; continue }
                codes.append(classify(l))
                j += 1
            }

            let indent = commonIndent(codes.compactMap { isBlank($0.1) ? nil : $0.1 })
            out.append(DiffLine(id: out.count, text: header.context, kind: .hunk,
                                hunkLabel: header.newStart > 0 ? "@@ \(header.newStart)" : "@@",
                                indentHint: indent.count, oldNumber: nil, newNumber: nil))
            var oldNo = header.oldStart
            var newNo = header.newStart
            for (kind, content) in codes {
                let trimmed = stripIndent(content, indent: indent)
                var oldN: Int?
                var newN: Int?
                switch kind {
                case .added: newN = newNo; newNo += 1
                case .removed: oldN = oldNo; oldNo += 1
                case .context: oldN = oldNo; newN = newNo; oldNo += 1; newNo += 1
                case .hunk: break
                }
                out.append(DiffLine(id: out.count, text: trimmed, kind: kind, hunkLabel: "",
                                    indentHint: 0, oldNumber: oldN, newNumber: newN))
            }
            i = j
        }
        return out
    }

    // MARK: line classification + indentation

    private static func classify(_ line: String) -> (DiffLineKind, String) {
        guard let first = line.first else { return (.context, "") }
        switch first {
        case "+": return (.added, String(line.dropFirst()))
        case "-": return (.removed, String(line.dropFirst()))
        default: return (.context, line.hasPrefix(" ") ? String(line.dropFirst()) : line)
        }
    }

    private static func isBlank(_ s: String) -> Bool { s.allSatisfy { $0 == " " || $0 == "\t" } }

    private static func leadingWhitespace(_ s: String) -> String {
        String(s.prefix { $0 == " " || $0 == "\t" })
    }

    private static func commonIndent(_ lines: [String]) -> String {
        guard var prefix = lines.first.map(leadingWhitespace) else { return "" }
        for line in lines.dropFirst() {
            let ac = Array(prefix), bc = Array(leadingWhitespace(line))
            var k = 0
            while k < ac.count && k < bc.count && ac[k] == bc[k] { k += 1 }
            prefix = String(ac[0..<k])
            if prefix.isEmpty { break }
        }
        return prefix
    }

    private static func stripIndent(_ content: String, indent: String) -> String {
        guard !indent.isEmpty else { return content }
        if content.hasPrefix(indent) { return String(content.dropFirst(indent.count)) }
        return isBlank(content) ? "" : content
    }

    private static func isFileHeader(_ line: String) -> Bool {
        line.hasPrefix("diff --git") || line.hasPrefix("index ")
            || line.hasPrefix("--- ") || line.hasPrefix("+++ ")
            || line.hasPrefix("new file") || line.hasPrefix("deleted file")
            || line.hasPrefix("rename ") || line.hasPrefix("copy ")
            || line.hasPrefix("similarity ") || line.hasPrefix("dissimilarity ")
            || line.hasPrefix("old mode") || line.hasPrefix("new mode")
    }

    /// The diff reduced to hunk headers and their +/- lines (file-header metadata
    /// dropped), for pasting into an agent prompt as a ```diff block.
    static func promptDiff(_ diff: String) -> String {
        diff.replacingOccurrences(of: "\r\n", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
            .filter { !isFileHeader($0) && !$0.hasPrefix("\\") }
            .joined(separator: "\n")
    }

    private static func parseHunkHeader(_ line: String) -> (oldStart: Int, newStart: Int, context: String) {
        guard let open = line.range(of: "@@"),
              let close = line.range(of: "@@", range: open.upperBound..<line.endIndex) else {
            return (0, 0, "")
        }
        let middle = line[open.upperBound..<close.lowerBound]
        let context = String(line[close.upperBound...]).trimmingCharacters(in: .whitespaces)
        func number(after sign: Character) -> Int {
            guard let r = middle.range(of: String(sign)) else { return 0 }
            return Int(middle[r.upperBound...].prefix { $0.isNumber }) ?? 0
        }
        return (number(after: "-"), number(after: "+"), context)
    }

    // MARK: per-hunk merged blocks

    /// The largest number of code lines packed into one DiffBlock. A long run is
    /// split into several consecutive chunks so each Text lays out a bounded number
    /// of lines — one huge hunk no longer becomes one enormous Text whose main-thread
    /// layout blocks scrolling when it enters the viewport.
    private static let chunkLimit = 48

    private static func buildBlocks(base: [DiffLine], fg: [NSAttributedString?],
                                    emphasis: [Int: [NSRange]], digits: Int) -> [DiffBlock] {
        var blocks: [DiffBlock] = []
        let empty = AttributedString()
        var id = 0
        var i = 0
        let n = base.count
        while i < n {
            let line = base[i]
            if line.kind == .hunk {
                blocks.append(DiffBlock(id: id, kind: .hunk, hunkLabel: line.hunkLabel,
                                        hunkContext: line.text, indentHint: line.indentHint,
                                        gutter: empty, code: empty, rows: [], lineCount: 0, lines: []))
                id += 1; i += 1
                continue
            }
            var j = i
            while j < n && base[j].kind != .hunk { j += 1 }
            // Measure the whole run once so every chunk of it scrolls the same width.
            let runWidth = runCodeWidth(range: i..<j, base: base, fg: fg)
            var c = i
            while c < j {
                let end = min(c + chunkLimit, j)
                let code = buildCodeBlock(range: c..<end, base: base, fg: fg, emphasis: emphasis, maxLen: runWidth)
                let gutter = buildGutterBlock(range: c..<end, base: base, digits: digits)
                let lines = (c..<end).map { codeLine($0, base: base, fg: fg, emphasis: emphasis, digits: digits) }
                blocks.append(DiffBlock(id: id, kind: .code, hunkLabel: "", hunkContext: "",
                                        indentHint: 0, gutter: AttributedString(gutter),
                                        code: AttributedString(code),
                                        rows: base[c..<end].map(\.kind), lineCount: end - c,
                                        lines: lines))
                id += 1; c = end
            }
            i = j
        }
        return blocks
    }

    /// The longest marker+code line length (UTF-16) across a run, used to pad every
    /// chunk of that run to the same width.
    private static func runCodeWidth(range: Range<Int>, base: [DiffLine], fg: [NSAttributedString?]) -> Int {
        var maxLen = 0
        for idx in range {
            let codeLen = fg[idx]?.length ?? (base[idx].text as NSString).length
            maxLen = max(maxLen, 1 + codeLen)
        }
        return maxLen
    }

    /// One attributed string for a chunk of code lines: leading +/- marker, the
    /// syntax-highlighted code with its word emphasis tint, right-padded with spaces
    /// to `maxLen` (the run's longest line), joined by newlines.
    private static func buildCodeBlock(range: Range<Int>, base: [DiffLine], fg: [NSAttributedString?],
                                       emphasis: [Int: [NSRange]], maxLen: Int) -> NSAttributedString {
        let plain: [NSAttributedString.Key: Any] = [.font: DiffTypography.codeFont, .foregroundColor: UIColor.label]
        let out = NSMutableAttributedString()
        for idx in range {
            let line = NSMutableAttributedString(string: base[idx].kind.marker, attributes: plain)
            line.append(fg[idx] ?? NSAttributedString(string: base[idx].text, attributes: plain))
            let padCount = maxLen - line.length
            if padCount > 0 {
                line.append(NSAttributedString(string: String(repeating: " ", count: padCount), attributes: plain))
            }
            let emColor = base[idx].kind == .added ? DiffPalette.addWord : DiffPalette.delWord
            for r in emphasis[idx] ?? [] {
                let shifted = NSRange(location: r.location + 1, length: r.length)
                if shifted.location + shifted.length <= line.length {
                    line.addAttribute(.backgroundColor, value: emColor, range: shifted)
                }
            }
            out.append(line)
            if idx != range.upperBound - 1 { out.append(NSAttributedString(string: "\n", attributes: plain)) }
        }
        return out
    }

    /// One line of a chunk on its own: the code a wrapped row shows (a space when
    /// the line is empty, so the row keeps its height) with its emphasis tint.
    private static func codeLine(_ idx: Int, base: [DiffLine], fg: [NSAttributedString?],
                                 emphasis: [Int: [NSRange]], digits: Int) -> DiffCodeLine {
        let line = base[idx]
        let plain: [NSAttributedString.Key: Any] = [.font: DiffTypography.codeFont, .foregroundColor: UIColor.label]
        let code = NSMutableAttributedString(attributedString: fg[idx] ?? NSAttributedString(string: line.text, attributes: plain))
        if code.length == 0 { code.append(NSAttributedString(string: " ", attributes: plain)) }
        let emColor = line.kind == .added ? DiffPalette.addWord : DiffPalette.delWord
        for r in emphasis[idx] ?? [] where r.location + r.length <= code.length {
            code.addAttribute(.backgroundColor, value: emColor, range: r)
        }
        return DiffCodeLine(id: line.id, kind: line.kind, number: gutterText(line, digits: digits),
                            code: AttributedString(code))
    }

    private static func gutterText(_ line: DiffLine, digits: Int) -> String {
        let number = line.kind == .removed ? line.oldNumber : line.newNumber
        return (number.map(String.init) ?? "").leftPadded(digits) + "  "
    }

    private static func buildGutterBlock(range: Range<Int>, base: [DiffLine], digits: Int) -> NSAttributedString {
        let out = NSMutableAttributedString()
        for idx in range {
            let line = base[idx]
            let text = gutterText(line, digits: digits)
            let piece = NSMutableAttributedString(string: text, attributes: [
                .font: DiffTypography.codeFont, .foregroundColor: UIColor.secondaryLabel,
            ])
            piece.addAttribute(.backgroundColor, value: DiffPalette.gutterUI(line.kind),
                               range: NSRange(location: 0, length: piece.length))
            out.append(piece)
            if idx != range.upperBound - 1 { out.append(NSAttributedString(string: "\n")) }
        }
        return out
    }
}

/// GitHub-style opaque pastel diff colors, dynamic for light/dark. Row backgrounds
/// go behind the code, gutter is a deeper shade, and word (emphasis) tints layer
/// on top of the row background — all baked into the block attributed strings.
enum DiffPalette {
    static func rowUI(_ kind: DiffLineKind) -> UIColor? {
        switch kind {
        case .added: return addRow
        case .removed: return delRow
        default: return nil
        }
    }

    static func gutterUI(_ kind: DiffLineKind) -> UIColor {
        switch kind {
        case .added: return addGutter
        case .removed: return delGutter
        default: return contextGutter
        }
    }

    static let addWord = dynamic(light: 0xABF2BC, dark: 0x2A6435)
    static let delWord = dynamic(light: 0xFDB8C0, dark: 0x78353B)

    private static let addRow = dynamic(light: 0xE6FFEC, dark: 0x12261E)
    private static let delRow = dynamic(light: 0xFFEBE9, dark: 0x25171C)
    private static let addGutter = dynamic(light: 0xCCFFD8, dark: 0x03351A)
    private static let delGutter = dynamic(light: 0xFFD7D5, dark: 0x4A1418)
    private static let contextGutter = dynamic(light: 0xF6F8FA, dark: 0x161B22)

    private static func dynamic(light: Int, dark: Int) -> UIColor {
        UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light) }
    }
}

private extension String {
    func leftPadded(_ width: Int) -> String {
        count >= width ? self : String(repeating: " ", count: width - count) + self
    }
}

private extension UIColor {
    convenience init(rgb: Int) {
        self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255,
                  green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255,
                  alpha: 1)
    }
}
