import SwiftUI

/// One hunk's merged code beside its pinned gutter: the gutter (line numbers,
/// deeper tint) stays fixed at the left while the code column scrolls horizontally.
struct DiffCodeBlock: View {
    let block: DiffBlock

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            Text(block.gutter)
                .fixedSize()
            ScrollView(.horizontal, showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    // At least the visible width, so a row's tint reaches the edge
                    // of the screen when every line is shorter than it.
                    Color.clear.frame(height: 0).containerRelativeFrame(.horizontal)
                    Text(block.code)
                        .fixedSize()
                        .padding(.trailing, 12)
                }
                .background { DiffRowTints(rows: block.rows) }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}
