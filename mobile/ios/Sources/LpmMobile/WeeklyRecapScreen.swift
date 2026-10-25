import SwiftUI

/// The weekly recap, the desktop's "My week in lpm" card: last week or this one
/// so far, ready to share as an image. Pushed from the Stats screen.
struct WeeklyRecapScreen: View {
    @Environment(AppModel.self) private var model

    private var store: WeeklyRecapStore { model.weeklyRecap }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Your agents' week, ready to share.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                weekPicker
                content
                footnote
            }
            // On an iPad the card stays at its own size rather than filling the screen.
            .frame(maxWidth: RecapCardStyle.width)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Weekly recap")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.refresh() }
        .task { store.screenDidOpen() }
        .onDisappear { store.screenDidClose() }
    }

    private var weekPicker: some View {
        Picker("Week", selection: Binding(get: { store.week }, set: { store.show($0) })) {
            Text("Last week").tag(RecapWeek.last)
            Text("This week").tag(RecapWeek.this)
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var content: some View {
        let week = store.week
        if let error = store.errors[week] {
            RecapErrorCard(message: error) { store.load(week) }
        } else if let recap = store.recaps[week] {
            let card = RecapCardModel(recap)
            if card.empty {
                RecapEmptyCard(week: week) { store.show(.this) }
            } else {
                RecapCardShare(card: card)
                    .opacity(store.loading.contains(week) ? 0.6 : 1)
                    .animation(.easeOut(duration: 0.2), value: store.loading.contains(week))
            }
        } else {
            RecapLoadingCard()
        }
    }

    private var footnote: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Names no projects, and nothing is uploaded: you add the card to the post yourself.")
            if let missing = store.recaps[store.week]?.missing, !missing.isEmpty {
                Text(Self.missingNote(missing))
            }
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func missingNote(_ names: [String]) -> String {
        let list = names.formatted(.list(type: .and).locale(Locale(identifier: "en_US")))
        return "Not counted: \(list), which couldn't send \(names.count == 1 ? "its" : "their") week."
    }
}

/// The card, then the button that shares it.
private struct RecapCardShare: View {
    let card: RecapCardModel

    @State private var image: RecapShareImage?

    var body: some View {
        VStack(spacing: 16) {
            RecapCardFit(card: card)
            if let image {
                ShareLink(item: image, message: Text(card.caption),
                          preview: SharePreview(RecapCardStyle.title, image: image.preview)) {
                    shareLabel
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            } else {
                Button {} label: { shareLabel }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(true)
            }
        }
        .task(id: card) { image = RecapShareImage(card) }
    }

    private var shareLabel: some View {
        Label("Share", systemImage: "square.and.arrow.up")
            .frame(maxWidth: .infinity)
    }
}

/// A card-shaped placeholder while the Mac reads the week.
private struct RecapLoadingCard: View {
    private typealias S = RecapCardStyle

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        VStack(spacing: 12) {
            Capsule()
                .fill(S.border)
                .frame(width: 120, height: 6)
                .shimmer()
            Text("Reading your agents' history…")
                .font(.footnote)
                .foregroundStyle(S.muted)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(S.width / 322, contentMode: .fit)
        .background(S.ground, in: shape)
        .overlay(shape.strokeBorder(S.border, lineWidth: 1))
        .transition(.opacity)
    }
}

private struct RecapEmptyCard: View {
    let week: RecapWeek
    let seeThisWeek: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar")
                .font(.system(size: 32))
                .foregroundStyle(.secondary)
            Text(week == .last ? "No agent work last week" : "No agent work this week yet")
                .font(.headline)
            Text("The recap counts Claude Code and Codex sessions run in your projects.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if week == .last {
                Button("See this week so far", action: seeThisWeek)
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 20)
        .background(Color(.secondarySystemGroupedBackground),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct RecapErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(.orange)
            Text("Couldn't read the week: \(message)")
                .font(.subheadline)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 20)
        .background(Color(.secondarySystemGroupedBackground),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
