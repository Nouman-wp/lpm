import SwiftUI
import WidgetKit

/// The Usage widget: a header, then up to three usage rows as the projects list
/// draws them — the tool's dot, the account's name and tag, when its window comes
/// back and how much of it is gone, over a bar with its pace tick. Small keeps
/// the name and the share.
struct UsageWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsageEntry

    private var small: Bool { family == .systemSmall }
    private var now: Double { entry.date.timeIntervalSince1970 * 1000 }

    var body: some View {
        Group {
            if let mac = entry.mac, !mac.rows.isEmpty {
                VStack(alignment: .leading, spacing: small ? 11 : 10) {
                    header(mac.seenAt)
                    ForEach(UsageWidgetLine.lines(mac.rows, now: now, shown: 3)) { line in
                        UsageWidgetLineView(line: line, small: small)
                    }
                }
            } else {
                WidgetEmptyState(
                    symbol: "gauge.with.dots.needle.33percent", tone: .action, title: "No usage yet",
                    message: small ? "Open lpm to load it."
                        : "Open lpm while your Mac is connected to load your plan usage.",
                    hint: "Open lpm", small: small
                ) {
                    title
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(.background, for: .widget)
    }

    private var title: some View {
        Text("Usage").font(.system(size: 13, weight: .semibold))
    }

    private func header(_ seenAt: Int?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            title
            Spacer(minLength: 0)
            if let seenAt {
                Text(asOf(seenAt))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }

    /// "as of 9:24" today and the day before that; small has room for the time alone.
    private func asOf(_ seenAt: Int) -> String {
        let seen = Date(timeIntervalSince1970: Double(seenAt) / 1000)
        let when = Calendar.current.isDate(seen, inSameDayAs: entry.date)
            ? seen.formatted(date: .omitted, time: .shortened)
            : seen.formatted(.dateTime.month(.abbreviated).day())
        return small ? when : "as of \(when)"
    }
}

/// One usage row as of the entry's moment — the projects list's `UsageRow`.
struct UsageWidgetLine: Identifiable {
    let id: String
    let label: String
    let mark: UsageWidgetMark?
    let color: Color
    let fill: Color
    let fraction: Double
    let pace: Double?
    /// When the window resets, today's spend without a window, or a dash.
    let detail: String
    let percentText: String
    let windowLabel: String
    /// "5h" beside the reset for the 5-hour window; empty for the weekly one.
    let windowShort: String
    let stale: Bool

    /// The rows the widget has room for: the account in use, then the fullest,
    /// in the order the app lists them so a row keeps its place.
    static func lines(_ rows: [UsageWidgetRow], now: Double, shown: Int) -> [UsageWidgetLine] {
        let readings = rows.map { $0.reading(now: now) }
        // Rows without a window are measured against each other, as on the projects list.
        let peak = zip(rows, readings).filter { !$1.hasWindow }.map(\.0.tokens).max() ?? 0
        let lines = zip(rows, readings).map { line($0, $1, peak: peak, now: now) }
        guard lines.count > shown else { return lines }
        let kept = Set(lines.sorted { a, b in
            if (a.mark == .current) != (b.mark == .current) { return a.mark == .current }
            return a.fraction > b.fraction
        }.prefix(shown).map(\.id))
        return lines.filter { kept.contains($0.id) }
    }

    private static func line(_ row: UsageWidgetRow, _ reading: UsageReading, peak: Int,
                             now: Double) -> UsageWidgetLine {
        let windowed = reading.hasWindow
        let color: Color = row.provider == "codex" ? .codex : .claude
        let detail = windowed ? reading.reset : row.tokens > 0 ? "\(formatTokenCount(row.tokens)) today" : "—"
        return UsageWidgetLine(
            id: row.id,
            label: row.label,
            mark: row.mark,
            color: color,
            fill: windowed ? .usageFill : color,
            fraction: reading.fraction ?? (peak > 0 ? Double(row.tokens) / Double(peak) : 0),
            pace: reading.pace,
            detail: detail,
            percentText: reading.percentText,
            windowLabel: windowed ? reading.main.label : "",
            windowShort: windowed ? reading.main.short : "",
            stale: row.stale(now: now)
        )
    }
}

private struct UsageWidgetLineView: View {
    let line: UsageWidgetLine
    let small: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: small ? 5 : 6) {
            HStack(spacing: 6) {
                Circle()
                    .fill(line.color)
                    .frame(width: small ? 6 : 7, height: small ? 6 : 7)
                    .opacity(line.stale ? 0.5 : 1)
                Text(line.label)
                    .font(.system(size: small ? 12 : 13, weight: .medium))
                    .lineLimit(1)
                if !small, let mark = line.mark {
                    UsageWidgetTag(mark: mark)
                }
                Spacer(minLength: 4)
                if !small {
                    if !line.windowShort.isEmpty { secondary(line.windowShort) }
                    secondary(line.detail)
                }
                if !line.percentText.isEmpty {
                    Text(line.percentText)
                        .font(.system(size: 13, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(line.stale ? Color.secondary : Color.primary)
                        .frame(minWidth: small ? 0 : 34, alignment: .trailing)
                } else if small {
                    secondary(line.detail)
                }
            }
            UsageWidgetBar(fraction: line.fraction, fill: line.fill, pace: line.pace, dim: line.stale)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(accessibilityValue)
    }

    private func secondary(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }

    private var accessibilityLabel: String {
        let tag: String? = switch line.mark {
        case .current: "in use"
        case .standby: "pool"
        case nil: nil
        }
        return [line.label, tag].compactMap { $0 }.joined(separator: ", ")
    }

    private var accessibilityValue: String {
        guard !line.percentText.isEmpty else { return line.detail }
        return "\(line.percentText) of the \(line.windowLabel) window used, resets in \(line.detail)"
    }
}

/// The projects list's "in use" / "pool" tag, at the widget's size.
private struct UsageWidgetTag: View {
    let mark: UsageWidgetMark

    var body: some View {
        switch mark {
        case .current:
            Text("in use")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.inUseInk)
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(Color.inUseWash.opacity(0.16), in: RoundedRectangle(cornerRadius: 4, style: .continuous))
        case .standby:
            Text("pool")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .overlay(
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.2), lineWidth: 1)
                )
        }
    }
}

/// A usage row's bar, turning red from its pace tick on, with the tick standing
/// proud of it — the projects list's bar held still.
private struct UsageWidgetBar: View {
    let fraction: Double
    let fill: Color
    let pace: Double?
    let dim: Bool

    private let height: CGFloat = 5

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            // Any use at all shows as a sliver, so 1% never reads as nothing.
            let filled = fraction > 0 ? width * max(0.02, min(1, fraction)) : 0
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.tertiarySystemFill))
                Rectangle()
                    .fill(fill)
                    .frame(width: filled)
                    .overlay(alignment: .leading) {
                        if let pace, pace * width < filled {
                            Rectangle()
                                .fill(Color.usageAhead)
                                .frame(width: filled - pace * width)
                                .offset(x: pace * width)
                        }
                    }
                    .clipShape(Capsule())
                    .opacity(dim ? 0.4 : 1)
                    .widgetAccentable()
            }
            .overlay(alignment: .leading) {
                if let pace {
                    Capsule()
                        .fill(Color.primary)
                        .frame(width: 2, height: height + 4)
                        .offset(x: max(0, min(width - 2, pace * width - 1)))
                        .opacity(dim ? 0.4 : 1)
                }
            }
        }
        .frame(height: height)
    }
}
