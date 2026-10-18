import SwiftUI

/// The Agents widget with no agent to list: no Mac to hear from yet, or Macs with
/// nothing running, and when the phone last heard from them.
struct AgentListEmpty: View {
    let macs: [AgentWidgetMac]
    let now: Int
    let small: Bool

    var body: some View {
        if macs.isEmpty {
            WidgetEmptyState(
                symbol: "desktopcomputer", tone: .action, title: "Pair your Mac",
                message: small ? "Your agents show up here."
                    : "Scan the code in lpm on your Mac to follow your agents from here.",
                hint: "Pair Mac", small: small
            ) {
                header(nil)
            }
        } else {
            WidgetEmptyState(
                symbol: "moon", tone: .quiet, title: "All quiet",
                message: small ? "Nothing running on \(place)"
                    : "Agents you start show up here, with who needs you and for how long.",
                footnote: macs.compactMap(\.seenAt).max().map { updated(seenAt: $0) }, small: small
            ) {
                header(small ? nil : macsLabel)
            }
        }
    }

    private func header(_ note: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Agents").font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 0)
            if let note {
                Text(note)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
        }
        .lineLimit(1)
    }

    /// Where nothing is running: the one Mac by name, or all of them.
    private var place: String {
        macs.count > 1 ? "your Macs" : macs.first?.name ?? "your Mac"
    }

    private var macsLabel: String? {
        macs.count > 1 ? "\(macs.count) Macs" : macs.first?.name
    }

    /// "Updated just now", "Updated 4m ago", "Updated 2h ago", "Updated 3d ago".
    private func updated(seenAt: Int) -> String {
        let minutes = max(0, now - seenAt) / 60_000
        if minutes < 1 { return "Updated just now" }
        if minutes < 60 { return "Updated \(minutes)m ago" }
        if minutes < 24 * 60 { return "Updated \(minutes / 60)h ago" }
        return "Updated \(minutes / (24 * 60))d ago"
    }
}
