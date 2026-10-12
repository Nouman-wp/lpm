import SwiftUI

/// Every project action as the desktop shows them: the header row, the footer
/// row and the menu-only list, each as desktop buttons. Picking one hands it back
/// to the host, which runs it once the sheet is gone.
struct ProjectActionsSheet: View {
    let project: Project
    let onPick: (Action) -> Void
    @Environment(\.dismiss) private var dismiss

    private var header: [Action] { project.actions.filter { $0.display != "footer" && $0.display != "menu" } }
    private var footer: [Action] { project.actions.filter { $0.display == "footer" } }
    private var menuOnly: [Action] { project.actions.filter { $0.display == "menu" } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    section("Header", header, compact: false)
                    section("Footer", footer, compact: true)
                    section("Menu", menuOnly, compact: false)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Actions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private func section(_ title: String, _ actions: [Action], compact: Bool) -> some View {
        if !actions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .textCase(.uppercase)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                FlowLayout(spacing: 8) {
                    ForEach(actions) { action in
                        DesktopActionButton(action: action, project: project.name,
                                            compact: compact, onRun: onPick)
                    }
                }
            }
        }
    }
}

/// Lays its children out left to right, wrapping onto a new row when one runs out
/// of width.
private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.replacingUnspecifiedDimensions().width
        return CGSize(width: width, height: frames(for: subviews, width: width).map(\.maxY).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (view, frame) in zip(subviews, frames(for: subviews, width: bounds.width)) {
            view.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                       proposal: ProposedViewSize(frame.size))
        }
    }

    private func frames(for subviews: Subviews, width: CGFloat) -> [CGRect] {
        var frames: [CGRect] = []
        var origin = CGPoint.zero
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if origin.x > 0 && origin.x + size.width > width {
                origin = CGPoint(x: 0, y: origin.y + rowHeight + spacing)
                rowHeight = 0
            }
            frames.append(CGRect(origin: origin, size: size))
            origin.x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return frames
    }
}
