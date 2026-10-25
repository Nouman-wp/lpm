import Foundation

/// The weekly recap ("My week in lpm"): last week's and this week's numbers from
/// the Mac, which the phone draws into the desktop's card. Owned by `AppModel`
/// and reached as `model.weeklyRecap`.
///
/// The Mac reads the agents' history and asks GitHub off its socket, so a reply
/// takes seconds and names the week it answers.
@Observable @MainActor
final class WeeklyRecapStore {
    @ObservationIgnored weak var model: AppModel?
    private var client: LpmClient? { model?.client }

    var week: RecapWeek = .last
    private(set) var recaps: [RecapWeek: WeeklyRecap] = [:]
    private(set) var loading: Set<RecapWeek> = []
    private(set) var errors: [RecapWeek: String] = [:]

    @ObservationIgnored private var active = false
    @ObservationIgnored private let timeout = GenerationTimeout<RecapWeek>()

    static let noAnswerError = "The Mac didn't answer."

    /// The screen opens on last week, the one that's over.
    func screenDidOpen() {
        active = true
        show(.last)
    }

    func screenDidClose() { active = false }

    func show(_ week: RecapWeek) {
        self.week = week
        load(week)
    }

    /// `fresh` reads the week again instead of taking the Mac's read from the
    /// last ten minutes.
    func load(_ week: RecapWeek, fresh: Bool = false) {
        loading.insert(week)
        errors[week] = nil
        client?.requestWeeklyRecap(week: week, fresh: fresh)
        // A reload that never answers keeps the card already on screen.
        timeout.arm(week, seconds: 30) { [weak self] in
            guard let self, self.loading.contains(week) else { return }
            self.loading.remove(week)
            if self.recaps[week] == nil { self.errors[week] = Self.noAnswerError }
        }
    }

    /// Pull to refresh: read the week again when live, else nudge the link back up.
    func refresh() async {
        if case .ready = model?.connection { load(week, fresh: true) }
        else { model?.reconnectIfNeeded() }
        try? await Task.sleep(nanoseconds: 500_000_000)
    }

    func apply(week: RecapWeek, recap: WeeklyRecap?, error: String?) {
        timeout.cancel(week)
        loading.remove(week)
        if let recap {
            recaps[week] = recap
            errors[week] = nil
        } else {
            errors[week] = error ?? "Couldn't read the week."
        }
    }

    /// The socket was replaced: nothing in flight can still answer, so ask again
    /// while the screen is open.
    func handleConnectionReset() {
        timeout.cancelAll()
        loading = []
        if active { load(week) }
    }
}
