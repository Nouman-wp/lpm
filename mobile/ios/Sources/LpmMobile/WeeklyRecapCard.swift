import SwiftUI

/// "My week in lpm", the desktop's WeeklyRecapCard in its default theme, laid
/// out 600 design units wide. Shown scaled to fit (`RecapCardFit`) and drawn into
/// the shared image unscaled; nothing on it names a project.
struct WeeklyRecapCard: View {
    private typealias S = RecapCardStyle

    let card: RecapCardModel
    /// Off for the shared image: the card's rectangle without the rounded frame,
    /// as the desktop draws its image.
    var framed = true

    var body: some View {
        VStack(alignment: .leading, spacing: S.gap) {
            header
            hero
            tiles
            if !card.mix.isEmpty {
                Text(card.mixText)
                    .font(.system(size: S.rowSize))
                    .foregroundStyle(S.soft)
                    .lineLimit(1)
                    .frame(height: S.rowLine)
            }
            RecapMark()
                .frame(maxWidth: .infinity, alignment: .trailing)
                .frame(height: S.footerLine)
        }
        .padding(EdgeInsets(top: S.padTop, leading: S.padX, bottom: S.padBottom, trailing: S.padX))
        .frame(width: S.width, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .background(RecapGlow())
        .clipShape(RoundedRectangle(cornerRadius: framed ? S.radius : 0, style: .continuous))
        .overlay {
            if framed {
                RoundedRectangle(cornerRadius: S.radius, style: .continuous).strokeBorder(S.border, lineWidth: 1)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(S.title)
                .font(.system(size: S.titleSize, weight: .bold))
                .foregroundStyle(S.text)
            Spacer(minLength: 0)
            Text(card.range)
                .font(.system(size: S.bodySize))
                .foregroundStyle(S.muted)
        }
        .lineLimit(1)
        .frame(height: S.headerLine)
    }

    /// The hours, what they mean and the gain on one line; the gain wraps
    /// under them when it doesn't fit.
    private var hero: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                hours
                hoursLabel
                gain
            }
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    hours
                    hoursLabel
                }
                gain
            }
            VStack(alignment: .leading, spacing: 0) {
                hours
                hoursLabel
                gain
            }
        }
    }

    private var hours: some View {
        Text(card.hours)
            .font(.system(size: S.heroSize, weight: .heavy))
            .tracking(S.heroSize * S.heroTracking)
            .foregroundStyle(S.strong)
            .fixedSize()
            .frame(height: S.heroSize)
    }

    private var hoursLabel: some View {
        Text(S.hoursLabel)
            .font(.system(size: S.bodySize))
            .foregroundStyle(S.soft)
            .fixedSize()
    }

    @ViewBuilder
    private var gain: some View {
        if let gain = card.gain {
            Text(gain)
                .font(.system(size: S.bodySize, weight: .semibold))
                .foregroundStyle(S.green)
                .fixedSize()
        }
    }

    private var tiles: some View {
        HStack(spacing: S.tileGap) {
            ForEach(card.tiles, id: \.id) { tile in
                tileBox {
                    Text(tile.value)
                        .font(.system(size: 24, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(S.strong)
                        .frame(height: S.tileValueLine)
                    tileLabel(Text(tile.label).foregroundColor(S.muted))
                }
            }
            tileBox {
                Text(card.linesAdded)
                    .font(.system(size: 20, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(S.green)
                    .frame(height: S.tileValueLine)
                tileLabel(Text(card.linesRemoved).foregroundColor(S.red) + Text(" lines").foregroundColor(S.muted))
            }
        }
    }

    private func tileBox<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .lineLimit(1)
            .padding(.horizontal, S.tilePadX + 1)
            .padding(.vertical, S.tilePadY + 1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(S.tile, in: RoundedRectangle(cornerRadius: S.tileRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: S.tileRadius, style: .continuous).strokeBorder(S.border, lineWidth: 1))
    }

    private func tileLabel(_ text: Text) -> some View {
        text.font(.system(size: 13)).frame(height: S.tileLabelLine)
    }
}

/// The card's green glow, drawn as CSS draws `linear-gradient(150deg, …)`: a
/// line through the middle at that angle, just long enough to reach the corners.
private struct RecapGlow: View {
    private typealias S = RecapCardStyle

    var body: some View {
        GeometryReader { geo in
            let w = max(1, geo.size.width)
            let h = max(1, geo.size.height)
            let angle = S.glowDegrees * .pi / 180
            let dx = sin(angle)
            let dy = -cos(angle)
            let length = abs(w * dx) + abs(h * dy)
            LinearGradient(
                stops: [.init(color: S.glow, location: 0), .init(color: S.ground, location: 0.55)],
                startPoint: UnitPoint(x: 0.5 - dx * length / (2 * w), y: 0.5 - dy * length / (2 * h)),
                endPoint: UnitPoint(x: 0.5 + dx * length / (2 * w), y: 0.5 + dy * length / (2 * h))
            )
        }
    }
}
