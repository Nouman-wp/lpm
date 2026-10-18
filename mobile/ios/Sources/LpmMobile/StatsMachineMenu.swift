import SwiftUI

/// The Stats screen's pick of whose usage to show: one computer, or all of them
/// added together, as the desktop Stats page's computer menu. Shown only when
/// the Mac pairs with another computer.
struct StatsMachineMenu: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let machines = model.statsMachines
        let current = machines.first { $0.id == model.statsMachine }
        Menu {
            Button {
                model.loadStats(days: model.statsDays, machine: StatsMachines.all)
            } label: {
                Text(StatsMachines.allLabel(machines))
                Text(StatsMachines.allDetail(machines))
                Image(systemName: current == nil ? "checkmark" : StatsMachines.allIcon)
            }
            Divider()
            ForEach(machines) { machine in
                Button {
                    model.loadStats(days: model.statsDays, machine: machine.id)
                } label: {
                    Text(machine.name)
                    Text(StatsMachines.detail(machine))
                    Image(systemName: machine.id == model.statsMachine ? "checkmark" : StatsMachines.icon(machine))
                }
                .disabled(!machine.connected)
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: current.map(StatsMachines.icon) ?? StatsMachines.allIcon)
                Text(current?.name ?? StatsMachines.allLabel(machines))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
        }
    }
}

/// Copy for the computers the Stats screen can show.
enum StatsMachines {
    static let all = "all"
    static let allIcon = "square.stack.3d.up"

    static func icon(_ machine: UsageMachine) -> String {
        machine.isLinuxHost ? "server.rack" : "desktopcomputer"
    }

    /// "Macs" when every computer listed is one, "computers" otherwise.
    static func noun(_ machines: [UsageMachine]) -> (one: String, many: String) {
        let macs = machines.allSatisfy { !$0.isLinuxHost && ($0.platform.isEmpty || $0.platform == "macos") }
        return macs ? ("Mac", "Macs") : ("computer", "computers")
    }

    static func allLabel(_ machines: [UsageMachine]) -> String {
        "All \(noun(machines).many)"
    }

    static func allDetail(_ machines: [UsageMachine]) -> String {
        let counted = machines.filter(\.isCounted)
        let what = counted.count == machines.count
            ? "Added together"
            : "\(counted.count) of \(machines.count) added together"
        let totals = counted.compactMap(\.totalTokens)
        guard totals.count == counted.count else { return what }
        return "\(what) · \(formatTokenCount(totals.reduce(0, +)))"
    }

    static func detail(_ machine: UsageMachine) -> String {
        if !machine.connected { return "Offline" }
        if machine.error != nil { return "Couldn't read its stats" }
        guard let total = machine.totalTokens else { return "Online" }
        return "Online · \(formatTokenCount(total))"
    }
}
