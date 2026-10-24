import SwiftUI

/// The added/removed row bands behind a code block. Every line has the same
/// monospaced height, so each row is an equal slice of the block.
struct DiffRowTints: View {
    let rows: [DiffLineKind]

    var body: some View {
        Canvas { context, size in
            guard !rows.isEmpty else { return }
            let height = size.height / CGFloat(rows.count)
            for (index, kind) in rows.enumerated() {
                guard let tint = DiffPalette.rowUI(kind) else { continue }
                let rect = CGRect(x: 0, y: CGFloat(index) * height, width: size.width, height: height)
                context.fill(Path(rect), with: .color(Color(uiColor: tint)))
            }
        }
    }
}
