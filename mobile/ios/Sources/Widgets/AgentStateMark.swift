import SwiftUI

/// A state's mark after a tab's name, in the widget and the Live Activity alike: a
/// bell while it waits on you, an alert for a problem, a check once done. Working
/// says so through the name alone, and keeps the slot so times line up.
struct AgentStateMark: View {
    let state: AgentState
    let size: CGFloat

    var body: some View {
        if let symbol {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(state.tint)
        }
    }

    private var symbol: String? {
        switch state {
        case .needsYou: "bell.fill"
        case .error: "exclamationmark.circle.fill"
        case .done: "checkmark"
        case .working, .idle: nil
        }
    }
}

extension View {
    /// The app's tones held still, as a widget can't animate: the working sweep at
    /// its start, orange for a wait, red for a problem, blue once done.
    @ViewBuilder
    func agentWidgetTone(_ state: AgentState) -> some View {
        switch state {
        case .working: foregroundStyle(AgentSweep.still)
        case .needsYou, .error, .done: foregroundStyle(state.tint)
        case .idle: self
        }
    }
}
