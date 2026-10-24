import SwiftUI

/// Under the commit message: "Generate message", its spinner while the Mac writes
/// one, or — while the message is the one it drafted — "Drafted from the diff" with
/// a small Regenerate.
struct CommitDraftRow: View {
    let generating: Bool
    let drafted: Bool
    let canGenerate: Bool
    let generate: () -> Void

    var body: some View {
        if drafted && !generating {
            HStack(spacing: 8) {
                Group {
                    Image(systemName: "sparkles")
                    Text("Drafted from the diff")
                }
                .foregroundStyle(.secondary)
                Spacer(minLength: 8)
                Button("Regenerate", action: generate)
                    .fontWeight(.semibold)
                    .buttonStyle(.borderless)
                    .disabled(!canGenerate)
            }
            .font(.subheadline)
        } else {
            Button(action: generate) {
                HStack(spacing: 8) {
                    if generating {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(generating ? "Generating…" : "Generate message")
                }
            }
            .disabled(generating || !canGenerate)
        }
    }
}
