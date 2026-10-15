import SwiftUI

extension View {
    /// Keeps `gap` at whatever lifts a list's last section to rest on the bottom
    /// edge while everything fits on screen, and at zero once the list scrolls —
    /// so the usage rows sit at the foot of a short list and follow a long one.
    /// The measured content already holds the current gap, so the next one is
    /// the old gap plus whatever room is still free. iOS 17 can't read a list's
    /// scroll geometry, so there the rows simply follow the list.
    func restsAtBottom(gap: Binding<CGFloat>) -> some View {
        modifier(RestsAtBottom(gap: gap))
    }

    /// Reads the meters, today's spend and the Claude accounts the usage rows
    /// need while this list is on screen, again whenever the link comes back,
    /// and refreshes the spend every three minutes as the desktop does.
    func feedsUsageRows() -> some View {
        modifier(FeedsUsageRows())
    }
}

private struct RestsAtBottom: ViewModifier {
    @Binding var gap: CGFloat

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.containerSize.height - geo.contentInsets.top - geo.contentInsets.bottom
                    - geo.contentSize.height
            } action: { _, free in
                let next = max(0, (gap + free).rounded(.down))
                if abs(next - gap) >= 1 { gap = next }
            }
        } else {
            content
        }
    }
}

private struct FeedsUsageRows: ViewModifier {
    @Environment(AppModel.self) private var model

    private struct Feed: Hashable {
        let ready: Bool
        let store: ObjectIdentifier
    }

    func body(content: Content) -> some View {
        content.task(id: Feed(ready: model.link.isReady, store: ObjectIdentifier(model.usage))) {
            guard model.link.isReady else { return }
            let usage = model.usage
            usage.rowsDidAppear()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 180_000_000_000)
                if !Task.isCancelled { usage.refreshExtras() }
            }
            usage.rowsDidDisappear()
        }
    }
}
