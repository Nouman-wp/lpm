import SwiftUI
import UIKit

/// What a widget shows with nothing to list: a badge, what's missing and what to do
/// about it, under the widget's own header. Medium adds a button-like hint for the
/// tap that opens the app, or a footnote.
struct WidgetEmptyState<Header: View>: View {
    enum Tone {
        case action, quiet
    }

    private let symbol: String
    private let tone: Tone
    private let title: String
    private let message: String
    private let hint: String?
    private let footnote: String?
    private let small: Bool
    private let header: Header

    init(symbol: String, tone: Tone, title: String, message: String, hint: String? = nil,
         footnote: String? = nil, small: Bool = false, @ViewBuilder header: () -> Header) {
        self.symbol = symbol
        self.tone = tone
        self.title = title
        self.message = message
        self.hint = hint
        self.footnote = footnote
        self.small = small
        self.header = header()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer(minLength: 0)
            if small {
                badge(size: 32)
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.top, 10)
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            } else {
                HStack(spacing: 12) {
                    badge(size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.system(size: 15, weight: .semibold))
                        Text(message)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if let hint {
                    Text(hint)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.widgetActionInk)
                        .padding(.horizontal, 14)
                        .frame(height: 28)
                        .background(Capsule().fill(Color.widgetActionFill))
                } else if let footnote {
                    Text(footnote)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .lineLimit(2)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func badge(size: CGFloat) -> some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.45, weight: .semibold))
            .foregroundStyle(tone == .action ? Color.widgetActionInk : Color.secondary)
            .frame(width: size, height: size)
            .background(Circle().fill(tone == .action ? Color.widgetActionFill : Color.widgetQuietFill))
            .accessibilityHidden(true)
    }
}

private extension Color {
    static let widgetActionFill = dynamic(light: (230, 238, 253), dark: (29, 42, 69))
    static let widgetActionInk = dynamic(light: (29, 78, 216), dark: (138, 184, 255))
    static let widgetQuietFill = dynamic(light: (240, 240, 243), dark: (44, 44, 46))

    static func dynamic(light: (CGFloat, CGFloat, CGFloat), dark: (CGFloat, CGFloat, CGFloat)) -> Color {
        Color(UIColor { traits in
            let (r, g, b) = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: 1)
        })
    }
}
