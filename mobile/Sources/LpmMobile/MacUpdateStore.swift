import Foundation

/// lpm on the live Mac: the release it runs, a newer one when there is one, and
/// an install of it there — started from this iPhone, another phone, or the Mac
/// itself. The Mac owns the install; this mirrors what it reports.
@Observable @MainActor
final class MacUpdateStore {
    enum State: Equatable {
        case checking
        /// Whole percent; -1 until the size is known.
        case downloading(Int)
        /// Replacing the app, past the point it can be cancelled.
        case installing
        /// The connection dropped mid-install: lpm is restarting there.
        case restarting
        /// Back on the new release.
        case updated(String)

        var inProgress: Bool {
            if case .updated = self { return false }
            return true
        }

        var cancellable: Bool {
            switch self {
            case .checking, .downloading: return true
            default: return false
            }
        }
    }

    @ObservationIgnored weak var model: AppModel?

    private(set) var version: String?
    private(set) var canUpdate = false
    /// The release the Mac could move to; nil while it is up to date.
    private(set) var newer: String?
    private(set) var state: State?
    private(set) var cancelling = false
    /// The bar was closed for this release, so it stays away until the next one.
    private(set) var dismissed: String?
    var error: String?

    /// What the Mac ran when the install began. Coming back on anything else is
    /// the update having landed.
    @ObservationIgnored private var from: String?
    @ObservationIgnored private var giveUp: DispatchWorkItem?
    @ObservationIgnored private var fade: DispatchWorkItem?

    /// How long a Mac restarting lpm has to come back before the bar stops
    /// saying so; the connection status explains the rest.
    private static let restartGrace: TimeInterval = 180
    private static let updatedFor: TimeInterval = 8

    var canInstall: Bool {
        guard canUpdate, newer != nil else { return false }
        return state?.inProgress != true
    }

    var showsBar: Bool {
        if state != nil || error != nil { return true }
        guard canUpdate, let newer else { return false }
        return newer != dismissed
    }

    var busyPlaces: [BusyAgentPlace] { busyAgentPlaces(model?.projects ?? []) }

    // MARK: from the Mac

    func noteBuild(_ build: MacBuild?) {
        if let current = build?.version, let from, current != from, state?.inProgress == true {
            land(on: current)
        }
        version = build?.version
        canUpdate = build?.selfUpdate ?? false
        dismissed = UserDefaults.standard.string(forKey: dismissKey)
        if canUpdate {
            model?.client?.updateCheck()
        } else {
            newer = nil
        }
    }

    func apply(_ check: MacUpdateCheck) {
        if let current = check.currentVersion { version = current }
        newer = check.updateAvailable ? check.latestVersion : nil
        apply(check.step, caughtUp: true)
    }

    /// `caughtUp` is the Mac answering a reconnect: idle then means an install
    /// this phone was following ended while it was away.
    func apply(_ step: MacUpdateStep, caughtUp: Bool = false) {
        switch step.phase {
        case .checking: follow(.checking)
        case .downloading: follow(.downloading(step.progress))
        case .installing:
            cancelling = false
            follow(.installing)
        case .idle:
            guard let state, state.inProgress else { return }
            if caughtUp && (state == .installing || state == .restarting) {
                error = "The update didn't finish on \(model?.link.macLabel ?? "your Mac"). Try again."
            }
            settle()
        }
    }

    func finished(cancelled: Bool, error: String?) {
        if let error { self.error = error }
        if state?.inProgress == true { settle() }
    }

    func cancelAnswered(stopping: Bool) {
        if !stopping { cancelling = false }
    }

    func handleConnectionReset() {
        cancelling = false
        guard state == .installing else { return }
        state = .restarting
        giveUp?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.state == .restarting else { return }
            self.settle()
        }
        giveUp = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.restartGrace, execute: work)
    }

    // MARK: from this iPhone

    func install() {
        guard canInstall, let client = model?.client else { return }
        error = nil
        from = version
        cancelling = false
        state = .checking
        client.updateInstall()
    }

    func cancel() {
        guard state?.cancellable == true, !cancelling else { return }
        cancelling = true
        model?.client?.updateCancel()
    }

    func dismiss() {
        if error != nil {
            error = nil
            return
        }
        dismissed = newer
        UserDefaults.standard.set(newer, forKey: dismissKey)
    }

    // MARK: -

    private var dismissKey: String {
        let id = model?.activeRecord?.serverId ?? model?.activeMacId?.uuidString ?? ""
        return "macUpdate.dismissed.\(id)"
    }

    private func follow(_ next: State) {
        if from == nil { from = version }
        giveUp?.cancel()
        fade?.cancel()
        state = next
    }

    private func settle() {
        giveUp?.cancel()
        state = nil
        cancelling = false
        from = nil
    }

    private func land(on release: String) {
        settle()
        newer = nil
        error = nil
        state = .updated(release)
        Haptics.success()
        let work = DispatchWorkItem { [weak self] in
            guard let self, case .updated = self.state else { return }
            self.state = nil
        }
        fade = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.updatedFor, execute: work)
    }
}
