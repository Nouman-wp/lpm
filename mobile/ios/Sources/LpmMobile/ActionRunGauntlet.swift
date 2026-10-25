import SwiftUI

/// What the desktop asks for before it runs an action: its inputs (if any), then
/// its confirmation (if flagged). `begin` starts it on a view that presents it
/// with `actionRunGauntlet`.
struct ActionRunGauntlet {
    fileprivate var inputsFor: Action?
    fileprivate var confirming: Confirming?

    fileprivate struct Confirming {
        let action: Action
        let values: [String: String]
    }

    /// Asks for the action's inputs or confirmation; false when it needs neither
    /// and runs now.
    mutating func begin(_ action: Action) -> Bool {
        if !action.inputs.isEmpty {
            inputsFor = action
        } else if action.confirm {
            confirming = Confirming(action: action, values: [:])
        } else {
            return false
        }
        return true
    }
}

extension View {
    /// Presents what `gauntlet` asks for, then hands `onRun` the action and its
    /// input values, as the sheet or alert that asked goes away.
    func actionRunGauntlet(_ gauntlet: Binding<ActionRunGauntlet>,
                           onRun: @escaping (Action, [String: String]) -> Void) -> some View {
        modifier(ActionRunGauntletHost(gauntlet: gauntlet, onRun: onRun))
    }
}

private struct ActionRunGauntletHost: ViewModifier {
    @Binding var gauntlet: ActionRunGauntlet
    let onRun: (Action, [String: String]) -> Void

    func body(content: Content) -> some View {
        content
            .sheet(item: $gauntlet.inputsFor) { action in
                ActionInputsSheet(action: action) { values in afterInputs(action, values) }
            }
            .alert(
                gauntlet.confirming.map { "Run \($0.action.label)?" } ?? "Run action?",
                isPresented: Binding(
                    get: { gauntlet.confirming != nil },
                    set: { if !$0 { gauntlet.confirming = nil } }
                ),
                presenting: gauntlet.confirming
            ) { confirming in
                Button("Run") { onRun(confirming.action, confirming.values) }
                Button("Cancel", role: .cancel) {}
            }
    }

    private func afterInputs(_ action: Action, _ values: [String: String]) {
        guard action.confirm else { return onRun(action, values) }
        // The inputs sheet is dismissing in this same update; presenting the
        // alert now can be swallowed (one presentation at a time), so let the
        // sheet settle first.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            gauntlet.confirming = .init(action: action, values: values)
        }
    }
}
