import SwiftUI
import UIKit

/// The app's colors the widgets draw in, light and dark.
extension Color {
    static let claude = Color(red: 217 / 255, green: 119 / 255, blue: 87 / 255)
    static let codex = Color(red: 16 / 255, green: 163 / 255, blue: 127 / 255)
    /// The one tint usage bars are drawn in, however full they get.
    static let usageFill = widget(light: (6, 182, 212), dark: (34, 211, 238))
    /// The use past a bar's pace tick.
    static let usageAhead = widget(light: (239, 68, 68), dark: (248, 113, 113))
    /// The "in use" tag's text, over its own color at 16%.
    static let inUseInk = widget(light: (174, 86, 48), dark: (222, 138, 104))
    static let inUseWash = widget(light: (217, 119, 87), dark: (222, 138, 104))

    static func widget(light: (CGFloat, CGFloat, CGFloat), dark: (CGFloat, CGFloat, CGFloat)) -> Color {
        Color(UIColor { traits in
            let (r, g, b) = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: 1)
        })
    }
}
