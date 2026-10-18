import Foundation

// The usage numbers the Stats screen and the Token activity widget both print,
// ported from the desktop's `agentUsageFormat.ts` and `statsCost.ts` so they read
// the same everywhere.

/// Compact token count: `<1K` grouped, then `K` / `M` / `B` with one decimal
/// while the mantissa is small (matches `formatTokenCount` in the desktop).
func formatTokenCount(_ value: Int) -> String {
    let v = Double(value)
    if value < 1_000 { return value.formatted() }
    if value < 1_000_000 {
        return String(format: value < 10_000 ? "%.1fK" : "%.0fK", v / 1_000)
    }
    if value < 1_000_000_000 {
        return String(format: value < 10_000_000 ? "%.1fM" : "%.0fM", v / 1_000_000)
    }
    return String(format: value < 10_000_000_000 ? "%.1fB" : "%.0fB", v / 1_000_000_000)
}

/// USD for display: `$0` at or below zero, two decimals under $10, else a rounded
/// grouped integer (matches `formatUsd` in statsCost.ts).
func formatUsd(_ value: Double) -> String {
    if value <= 0 { return "$0" }
    if value < 10 { return String(format: "$%.2f", value) }
    return "$" + Int(value.rounded()).formatted()
}

/// A "YYYY-MM-DD" bucket rendered as e.g. "Jul 15" in the viewer's locale. The
/// desktop pins the instant to local noon to dodge timezone date-rollover.
func shortUsageDate(_ date: String) -> String {
    guard let parsed = parseUsageDate(date) else { return date }
    return parsed.formatted(.dateTime.month(.abbreviated).day())
}

/// Parse a "YYYY-MM-DD" bucket to a local-noon `Date` (nil on malformed input).
func parseUsageDate(_ date: String) -> Date? {
    let parts = date.split(separator: "-")
    guard parts.count == 3,
          let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2])
    else { return nil }
    var comps = DateComponents()
    comps.year = year
    comps.month = month
    comps.day = day
    comps.hour = 12
    return Calendar.current.date(from: comps)
}

/// A day as a "YYYY-MM-DD" bucket, the inverse of `parseUsageDate`.
func usageDateKey(_ date: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}
