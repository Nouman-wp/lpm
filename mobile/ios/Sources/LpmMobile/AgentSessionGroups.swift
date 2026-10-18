import Foundation

/// A run of consecutive sessions under one day heading.
struct AgentSessionGroup: Identifiable {
    let id: Int
    let label: String
    var rows: [AgentSession]
}

/// Sessions bucketed by day as the desktop's Resume session list buckets them:
/// relative labels for the recent past, then month and year, keeping the list's
/// order.
func agentSessionGroups(_ rows: [AgentSession], now: Date = Date(),
                        calendar: Calendar = .current) -> [AgentSessionGroup] {
    let startOfToday = calendar.startOfDay(for: now)
    var groups: [AgentSessionGroup] = []
    for row in rows {
        let label = agentSessionDayLabel(row.updatedAt, startOfToday: startOfToday, calendar: calendar)
        if groups.last?.label == label {
            groups[groups.count - 1].rows.append(row)
        } else {
            groups.append(AgentSessionGroup(id: groups.count, label: label, rows: [row]))
        }
    }
    return groups
}

func agentSessionDayLabel(_ updatedAt: Int, startOfToday: Date, calendar: Calendar = .current) -> String {
    guard updatedAt > 0 else { return "Older" }
    let date = Date(timeIntervalSince1970: Double(updatedAt) / 1000)
    func daysBack(_ n: Int) -> Date { calendar.date(byAdding: .day, value: -n, to: startOfToday) ?? startOfToday }
    if date >= startOfToday { return "Today" }
    if date >= daysBack(1) { return "Yesterday" }
    if date >= daysBack(6) { return "Earlier this week" }
    if date >= daysBack(29) { return "Earlier this month" }
    return date.formatted(dateStyle(calendar).month(.wide).year())
}

/// When a session last ran: the time of day for today and yesterday, the date
/// before that; nil when unknown.
func agentSessionTime(_ updatedAt: Int, now: Date = Date(), calendar: Calendar = .current) -> String? {
    guard updatedAt > 0 else { return nil }
    let date = Date(timeIntervalSince1970: Double(updatedAt) / 1000)
    let startOfToday = calendar.startOfDay(for: now)
    let startOfYesterday = calendar.date(byAdding: .day, value: -1, to: startOfToday) ?? startOfToday
    if date >= startOfYesterday { return date.formatted(dateStyle(calendar).hour().minute()) }
    return date.formatted(dateStyle(calendar).month(.abbreviated).day())
}

private func dateStyle(_ calendar: Calendar) -> Date.FormatStyle {
    Date.FormatStyle(calendar: calendar, timeZone: calendar.timeZone)
}
