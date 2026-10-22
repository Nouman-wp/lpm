import SwiftUI

/// An automation's `machines:` list — hostIds, best first, with "any" last for
/// any other computer that's on — and the words for it, as the desktop's
/// jobsMachines.ts has them.
enum AutomationMachines {
    static let any = "any"

    static func read(_ value: Any?) -> [String] {
        let raw: [Any] = (value as? [Any]) ?? (value.map { [$0] } ?? [])
        var ids: [String] = []
        for item in raw {
            let text = String(describing: item).trimmingCharacters(in: .whitespacesAndNewlines)
            let id = text.lowercased() == any ? any : text
            if !id.isEmpty, !ids.contains(id) { ids.append(id) }
        }
        return ids.contains(any) ? listed(ids) + [any] : ids
    }

    static func listed(_ ids: [String]) -> [String] { ids.filter { $0 != any } }

    static func runsOnAny(_ ids: [String]) -> Bool { ids.contains(any) }

    /// A computer joins after the ones listed; the last can go only while any
    /// other one may still run it.
    static func toggle(_ ids: [String], _ id: String) -> [String] {
        var next = listed(ids)
        if next.contains(id) { next.removeAll { $0 == id } } else { next.append(id) }
        if next.isEmpty, !runsOnAny(ids) { return ids }
        return runsOnAny(ids) ? next + [any] : next
    }

    static func toggleAny(_ ids: [String], fallback: String) -> [String] {
        let kept = listed(ids).isEmpty ? [fallback] : listed(ids)
        return runsOnAny(ids) ? kept : kept + [any]
    }

    static func note(_ ids: [String], name: (String) -> String) -> String {
        let names = listed(ids).map(name)
        if ids.isEmpty { return "Every Mac that has it runs it, each on its own." }
        if runsOnAny(ids) {
            return names.isEmpty
                ? "One Mac that has it and is on runs it."
                : "\(names.joined(separator: ", then ")) runs it when it's on, otherwise another Mac that has it."
        }
        if names.count == 1 { return "Only \(names[0]) runs it." }
        return "\(names[0]) runs it when it's on, otherwise \(names.dropFirst().joined(separator: ", then "))."
    }

    static func summary(_ ids: [String], name: (String) -> String) -> String {
        if ids.isEmpty { return "Every Mac" }
        if runsOnAny(ids) { return "Any Mac" }
        let names = listed(ids).map(name)
        switch names.count {
        case 1: return names[0]
        case 2: return "\(names[0]) or \(names[1])"
        default: return "\(names.count) Macs"
        }
    }
}

extension AutomationMachines {
    /// Where a listed automation runs, as the desktop's list says it: nil for one
    /// every computer runs, or while this Mac has no other computer to name.
    static func label(_ job: AutomationJob, choices: [AutomationMachine]) -> String? {
        guard !job.machines.isEmpty || job.anyMachine else { return nil }
        guard choices.count > 1 || job.machines.contains(where: { !$0.here }) else { return nil }
        let ids = job.machines.map(\.id) + (job.anyMachine ? [any] : [])
        return summary(ids) { id in
            guard let m = job.machines.first(where: { $0.id == id }) else { return "Another Mac" }
            if m.here { return "This Mac" }
            return m.name.isEmpty ? "Another Mac" : m.name
        }
    }
}

/// Which computers an automation runs on: one or more of them, best first, or
/// any that's on. Whichever comes first and is on takes each run.
struct AutomationMachinesSection: View {
    /// Empty for a job every computer that has it runs.
    @Binding var machines: [String]
    /// This Mac first, then the computers paired with it.
    let choices: [AutomationMachine]
    /// How the job names the computers it lists, for any not among `choices`.
    let names: [AutomationMachine]

    var body: some View {
        Section {
            ForEach(rows, id: \.self) { id in
                Button { pick(id) } label: { row(name(id), on: listed.contains(id)) }
            }
            Button {
                machines = AutomationMachines.toggleAny(machines, fallback: hereId)
            } label: {
                row("Any available Mac", on: AutomationMachines.runsOnAny(machines))
            }
        } header: {
            Text("Runs on")
        } footer: {
            Text(AutomationMachines.note(machines, name: name))
        }
    }

    private var listed: [String] { AutomationMachines.listed(machines) }
    private var hereId: String { choices.first { $0.here }?.id ?? listed.first ?? "" }
    private var rows: [String] {
        choices.map(\.id) + listed.filter { id in !choices.contains { $0.id == id } }
    }

    private func name(_ id: String) -> String {
        if id == hereId { return "This Mac" }
        let known = choices.first { $0.id == id }?.name ?? names.first { $0.id == id }?.name
        return known.flatMap { $0.isEmpty ? nil : $0 } ?? "Another Mac"
    }

    /// A job from before computers were named runs on every one; picking one
    /// starts its list.
    private func pick(_ id: String) {
        machines = machines.isEmpty ? [id] : AutomationMachines.toggle(machines, id)
    }

    private func row(_ title: String, on: Bool) -> some View {
        HStack {
            Text(title).foregroundStyle(.primary)
            Spacer()
            if on { Image(systemName: "checkmark").foregroundStyle(.tint) }
        }
    }
}
