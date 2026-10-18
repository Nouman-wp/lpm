import SwiftUI

/// The bar a closed tab leaves for a few seconds, as on the desktop: "<tab>
/// closed" and Undo, which puts the tab back as it was. It holds still — a
/// countdown that moves the whole time would keep UI tests from tapping Undo.
struct UndoCloseToast: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if let pending = model.pendingTabClose {
                UndoCloseBar(pending: pending) {
                    Haptics.tap()
                    withAnimation { model.undoTabClose() }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .id(pending.tab.id)
            }
        }
        .animation(.spring(duration: 0.3), value: model.pendingTabClose?.tab.id)
    }
}

private struct UndoCloseBar: View {
    let pending: PendingTabClose
    let onUndo: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text("\(pending.tab.title) closed")
                .font(.subheadline.weight(.medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onUndo) {
                Text("Undo")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.white, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(.leading, 18)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .background(Color(white: 0.12), in: Capsule())
        .shadow(color: .black.opacity(0.2), radius: 12, y: 6)
    }
}
