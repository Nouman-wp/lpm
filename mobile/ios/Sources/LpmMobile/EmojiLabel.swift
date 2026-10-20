import SwiftUI

/// An action's or tab's emoji before its label, as the desktop's EmojiLabel draws
/// it: an agent's glyph becomes that agent's mark, `markSide` points square, and
/// any other emoji stays text. `title` draws the words — with the emoji, as
/// `plain`, when it stays text — so a row can style them without touching the mark.
struct EmojiLabel<Title: View>: View {
    let emoji: String
    let label: String
    let markSide: CGFloat
    /// What shows when the emoji isn't an agent's: "emoji label" unless given.
    var plain: String? = nil
    @ViewBuilder let title: (String) -> Title

    var body: some View {
        if let mark = AgentMark.ofEmoji(emoji) {
            HStack(spacing: markSide / 4) {
                mark
                    .frame(width: markSide, height: markSide)
                    .accessibilityHidden(true)
                title(label)
            }
        } else {
            title(plain ?? (emoji.isEmpty ? label : "\(emoji) \(label)"))
        }
    }
}

extension EmojiLabel where Title == Text {
    init(emoji: String, label: String, markSide: CGFloat, plain: String? = nil) {
        self.init(emoji: emoji, label: label, markSide: markSide, plain: plain) { Text($0) }
    }
}
