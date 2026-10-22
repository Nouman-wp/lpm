import SwiftUI

/// Monospaced command output of any length. A single `Text` stops drawing once
/// it grows a few thousand lines tall (a long build's log goes blank mid-run),
/// so the output is laid out as a stack of short slices, split on line breaks.
struct LogText: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(Self.slices(text).enumerated()), id: \.offset) { _, slice in
                Text(slice)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .textSelection(.enabled)
    }

    /// `text` cut into slices of at most `maxLines` lines and about `maxLength`
    /// characters; a line longer than that is cut into slices of its own.
    static func slices(_ text: String, maxLines: Int = 100, maxLength: Int = 4_000) -> [String] {
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        if lines.last?.isEmpty == true { lines.removeLast() }
        var slices: [String] = []
        var pending: [Substring] = []
        var length = 0
        for line in lines {
            var rest = line
            repeat {
                let piece = rest.prefix(maxLength)
                rest = rest.dropFirst(piece.count)
                if !pending.isEmpty, pending.count == maxLines || length + piece.count > maxLength {
                    slices.append(pending.joined(separator: "\n"))
                    pending = []
                    length = 0
                }
                pending.append(piece)
                length += piece.count + 1
            } while !rest.isEmpty
        }
        if !pending.isEmpty { slices.append(pending.joined(separator: "\n")) }
        return slices
    }
}
