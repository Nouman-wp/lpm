import Foundation

/// The answers a notification can send back to the agent it is about, as the Mac
/// offers them in the alert's `actions` (PROTOCOL.md, Answering from a
/// notification), and the notification category that shows each set.
enum AgentAnswerAction: String, CaseIterable {
    case allow, deny, reply

    static let permissionCategory = "lpm.agent.permission"
    static let replyCategory = "lpm.agent.reply"

    var identifier: String { "lpm.answer.\(rawValue)" }

    init?(identifier: String) {
        guard let action = Self.allCases.first(where: { $0.identifier == identifier }) else { return nil }
        self = action
    }

    /// The category for the actions a payload offers; nil shows the plain notification.
    static func category(for actions: [String]) -> String? {
        let offered = Set(actions.compactMap(AgentAnswerAction.init(rawValue:)))
        if offered.isSuperset(of: [.allow, .deny]) { return permissionCategory }
        if offered.contains(.reply) { return replyCategory }
        return nil
    }
}
