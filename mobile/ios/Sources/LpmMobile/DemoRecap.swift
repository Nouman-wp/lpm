import Foundation

/// Demo handler for the weekly recap: the desktop demo's sample week
/// (desktop/frontend/src/demo/seed/sample/recap.ts), so both draw the same card.
extension DemoServer {
    func registerRecapHandlers() {
        register("weeklyRecap") { [weak self] o in
            let thisWeek = o["week"] as? String == "this"
            self?.pushAfter(0.6) {
                ["t": "weeklyRecap", "ok": true, "week": thisWeek ? "this" : "last",
                 "recap": Self.sampleRecap(thisWeek: thisWeek)]
            }
        }
    }

    private static func sampleRecap(thisWeek: Bool) -> [String: Any] {
        let minute = 60_000
        // Agent minutes and prompts per day, Monday first; Sunday off.
        let week = [(352, 38), (418, 41), (296, 33), (389, 36), (241, 29), (184, 37), (0, 0)]
        let projects = [("saas-app", 0.41), ("auth-service", 0.24), ("docs-site", 0.16),
                        ("ml-pipeline", 0.12), ("mobile-app", 0.07)]
        let cal = Calendar(identifier: .gregorian)
        let today = cal.startOfDay(for: Date())
        let sinceMonday = (cal.component(.weekday, from: today) + 5) % 7
        let monday = cal.date(byAdding: .day, value: -sinceMonday - (thisWeek ? 0 : 7), to: today) ?? today
        let ymd = { (date: Date) -> String in
            let c = cal.dateComponents([.year, .month, .day], from: date)
            return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        }
        let total = week.reduce(0) { $0 + $1.0 } * minute
        let share = { (part: Double) in Int((Double(total) * part).rounded()) }
        return [
            "week": ymd(monday),
            // This week so far: nothing yet on the days still to come.
            "days": week.enumerated().map { i, day -> [String: Any] in
                let date = cal.date(byAdding: .day, value: i, to: monday) ?? monday
                let future = date > today
                return ["date": ymd(date), "agentMs": future ? 0 : day.0 * minute, "prompts": future ? 0 : day.1]
            },
            "previousAgentMs": total - 7 * 60 * minute,
            "sessions": 58,
            "projects": projects.map { ["name": $0.0, "agentMs": share($0.1)] },
            "agents": [["name": "claude", "agentMs": share(0.64)], ["name": "codex", "agentMs": share(0.36)]],
            "workedRepos": ["github.com/acme/auth-service", "github.com/acme/ml-pipeline",
                            "github.com/acme/mobile-app", "github.com/acme/saas-app"],
            "linesAdded": 6_120,
            "linesRemoved": 2_407,
        ]
    }
}
