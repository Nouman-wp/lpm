import SwiftUI

extension View {
    /// Keeps a toolbar title on `axis`, the bar's middle in global coordinates.
    /// The bar gives the title the room between its buttons, which leans away from
    /// the side with more of them; the title takes the widest span centered on
    /// `axis` that fits in that room, and moves over onto it.
    func centeredOnBar(_ axis: CGFloat?) -> some View {
        modifier(BarCentered(axis: axis))
    }
}

private struct BarCentered: ViewModifier {
    let axis: CGFloat?
    @State private var room: CGRect = .zero

    func body(content: Content) -> some View {
        let middle = room.width > 0 ? axis : nil
        let half = middle.map { max(0, min($0 - room.minX, room.maxX - $0)) }
        content
            .frame(width: half.map { $0 * 2 })
            .offset(x: middle.map { $0 - room.midX } ?? 0)
            .frame(maxWidth: .infinity)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { room = $0 }
    }
}
