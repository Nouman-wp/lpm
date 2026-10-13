import SwiftUI

/// Keeps its content at the height it has with the keyboard closed, pinned to
/// the bottom edge and clipped at the top, so the keyboard slides the content up
/// instead of resizing it every animation frame. The content is handed the
/// height of its top that sits out of sight, which grows only once the keyboard
/// has settled and drops as soon as it starts closing — one reflow each way.
struct KeyboardSteadyFrame<Content: View>: View {
    @ObservedObject var keyboard: KeyboardObserver
    @ViewBuilder let content: (_ hiddenTop: CGFloat) -> Content
    @State private var height: CGFloat = 0
    @State private var restHeight: CGFloat = 0
    @State private var hiddenTop: CGFloat = 0

    var body: some View {
        Color.clear
            .overlay(alignment: .bottom) {
                content(hiddenTop)
                    .frame(height: restHeight > 0 ? restHeight : nil)
            }
            .clipped()
            .onGeometryChange(for: CGFloat.self, of: { $0.size.height }) { newHeight in
                height = newHeight
                restHeight = max(restHeight, newHeight)
                hiddenTop = min(hiddenTop, restHeight - newHeight)
                // SwiftUI lays out for the keyboard before the keyboard
                // notification reaches the observer, so the rest waits for it.
                DispatchQueue.main.async(execute: settle)
            }
            .onChange(of: keyboard.settledHeight) { settle() }
            .onChange(of: keyboard.isShown) { settle() }
    }

    private func settle() {
        if !keyboard.isShown { restHeight = height }
        if keyboard.height == keyboard.settledHeight { hiddenTop = restHeight - height }
    }
}
