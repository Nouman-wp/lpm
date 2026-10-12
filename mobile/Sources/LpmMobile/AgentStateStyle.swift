import SwiftUI

extension View {
    /// Colors a tab's name, or a state's word, by what its agent is doing, as the
    /// desktop does: a sweep through the working colors, an orange pulse while it
    /// needs you, red for a problem, blue once done. Idle leaves the style alone.
    @ViewBuilder
    func agentTone(_ state: AgentState?) -> some View {
        switch state {
        case .working: modifier(WorkingSweep())
        case .needsYou: foregroundStyle(AgentState.needsYou.tint).modifier(AgentPulse())
        case .error, .done: foregroundStyle(state?.tint ?? .primary)
        case .idle, nil: self
        }
    }
}

/// The desktop's working shimmer: its five colors scroll through the view twice
/// every four seconds, easing in and out, under a slow glow.
private struct WorkingSweep: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let palette: [Color] = [
        Color(red: 0.231, green: 0.510, blue: 0.965),
        Color(red: 0.545, green: 0.361, blue: 0.965),
        Color(red: 0.925, green: 0.282, blue: 0.600),
        Color(red: 0.024, green: 0.714, blue: 0.831),
        Color(red: 0.388, green: 0.400, blue: 0.945),
    ]
    // Two laps of the palette, closed on its first color, so the view (a third of
    // a lap wide) always sits inside the gradient wherever the lap starts.
    private static let stops = palette + palette + [palette[0]]

    func body(content: Content) -> some View {
        if reduceMotion {
            content.foregroundStyle(gradient(offset: 0))
        } else {
            TimelineView(.animation) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                let p = t.truncatingRemainder(dividingBy: 4) / 4
                let eased = p * p * (3 - 2 * p)
                content
                    .foregroundStyle(gradient(offset: (6 * eased).truncatingRemainder(dividingBy: 3)))
                    .brightness(0.12 * (1 - cos(t * .pi)) / 2)
            }
        }
    }

    private func gradient(offset: Double) -> LinearGradient {
        LinearGradient(colors: Self.stops,
                       startPoint: UnitPoint(x: -offset, y: 0.5),
                       endPoint: UnitPoint(x: 6 - offset, y: 0.5))
    }
}

/// The desktop's "needs you" pulse: down to half strength and back every two seconds.
private struct AgentPulse: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            TimelineView(.animation) { context in
                content.opacity(0.75 + 0.25 * cos(context.date.timeIntervalSinceReferenceDate * .pi))
            }
        }
    }
}

/// The mark a tab's row ends with: a bell while the agent waits on you, an alert
/// for a problem, a check once the turn lands. Working and idle say so through
/// the name alone, and their slot keeps its width so the clocks line up.
struct AgentStateMark: View {
    let state: AgentState

    var body: some View {
        switch state {
        case .needsYou: symbol("bell.fill").agentTone(state)
        case .error: symbol("exclamationmark.circle.fill").agentTone(state)
        case .done: symbol("checkmark").agentTone(state)
        case .working, .idle: symbol("checkmark").hidden()
        }
    }

    private func symbol(_ name: String) -> some View {
        Image(systemName: name)
            .fontWeight(.semibold)
            .frame(width: 18)
    }
}

/// The end of a tab's row, as the desktop sidebar ends one: the state's mark,
/// then how long the agent has been at it, or how long the finished turn took.
struct AgentStatusTrail: View {
    let agent: ProjectAgentRow

    var body: some View {
        HStack(spacing: 4) {
            AgentStateMark(state: agent.state)
            if let since = agent.since {
                ElapsedText(since: since, until: agent.until)
                    .foregroundStyle(.secondary)
            }
        }
        .lineLimit(1)
    }
}
