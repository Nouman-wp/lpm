import SwiftUI

/// The commit sheet's bottom: "Commit and Push" across the width, "Commit only"
/// under it. Both wait while either runs, and the one tapped shows its progress.
struct CommitButtons: View {
    enum Busy { case committing, pushing, committingOnly }

    let busy: Busy?
    let enabled: Bool
    let commitAndPush: () -> Void
    let commitOnly: () -> Void

    private var pushTitle: String {
        switch busy {
        case .committing: "Committing…"
        case .pushing: "Pushing…"
        default: "Commit and Push"
        }
    }

    var body: some View {
        VStack(spacing: 2) {
            Button(action: commitAndPush) {
                HStack(spacing: 8) {
                    if busy == .committing || busy == .pushing {
                        ProgressView().controlSize(.small).tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                    }
                    Text(pushTitle).fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            Button(action: commitOnly) {
                HStack(spacing: 8) {
                    if busy == .committingOnly {
                        ProgressView().controlSize(.small)
                    }
                    Text(busy == .committingOnly ? "Committing…" : "Commit only")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderless)
        }
        .disabled(!enabled)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.bar)
    }
}
