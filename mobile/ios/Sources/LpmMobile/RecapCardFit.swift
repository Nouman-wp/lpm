import SwiftUI

/// The recap card at the width it's given: laid out at its 600 design units,
/// then scaled down (or up) as a whole, so it looks exactly like the image it
/// shares.
struct RecapCardFit: View {
    let card: RecapCardModel

    @State private var width: CGFloat = 0
    @State private var height: CGFloat = 0

    private var scale: CGFloat { width / RecapCardStyle.width }

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: height * scale)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .overlay(alignment: .topLeading) {
                WeeklyRecapCard(card: card)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
                    .scaleEffect(scale, anchor: .topLeading)
            }
    }
}
