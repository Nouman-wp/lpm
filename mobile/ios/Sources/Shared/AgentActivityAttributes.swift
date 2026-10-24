import ActivityKit
import Foundation

/// One Mac's Live Activity. Its content stays sealed under the push key end to
/// end — the relay forwards Mac updates it can't read — and the widget opens it.
struct AgentActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var blob: String
    }

    /// The Mac's server id, or its local id for a Mac too old to send one.
    var serverId: String
    var macName: String
}
