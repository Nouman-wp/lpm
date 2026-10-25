import Foundation

extension AppModel {
    /// The Mac answers `weeklyRecap`.
    var canShowWeeklyRecap: Bool {
        client?.hostFeatures.contains(LpmClient.weeklyRecapFeature) == true
    }

    func wireWeeklyRecap(_ c: LpmClient) {
        c.onWeeklyRecap = { [weak self] week, recap, error in
            self?.weeklyRecap.apply(week: week, recap: recap, error: error)
        }
    }
}
