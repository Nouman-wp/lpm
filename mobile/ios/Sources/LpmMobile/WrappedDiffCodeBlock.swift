import SwiftUI

/// A block's code wrapped to the screen width (the file header's "Wrap"): each
/// line's number on its deeper tint, its +/- marker, then the code, whose
/// continuation rows hang under the code rather than under the gutter.
struct WrappedDiffCodeBlock: View {
    let block: DiffBlock

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(block.lines) { line in
                HStack(alignment: .top, spacing: 0) {
                    Text(line.number)
                        .foregroundStyle(Color(uiColor: .secondaryLabel))
                        .frame(maxHeight: .infinity, alignment: .top)
                        .background(Color(uiColor: DiffPalette.gutterUI(line.kind)))
                    Text(line.kind.marker)
                    Text(line.code)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.trailing, 12)
                }
                .font(Font(DiffTypography.codeFont))
                .background(DiffPalette.rowUI(line.kind).map { Color(uiColor: $0) } ?? .clear)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
