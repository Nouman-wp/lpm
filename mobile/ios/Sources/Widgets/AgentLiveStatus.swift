import SwiftUI

/// How long an agent has been at it: a running clock while it works or waits —
/// the only reading that stays current between updates — and, once it stopped,
/// the time it took in the widget's short form.
struct AgentLiveElapsed: View {
    let agent: LiveSnapshot.Agent

    var body: some View {
        if let start = agent.startedAt {
            switch agent.agentState {
            case .working, .needsYou:
                Text(timerInterval: start...Date.distantFuture, countsDown: false)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
            case .done, .error, .idle:
                let end = agent.finishedAt ?? Date()
                Text(shortDuration(millis: Int(end.timeIntervalSince(start) * 1000)))
                    .monospacedDigit()
            }
        }
    }
}
