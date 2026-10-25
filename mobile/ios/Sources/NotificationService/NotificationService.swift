import UserNotifications

/// Decrypts an lpm push payload and rewrites the notification with the real
/// project / terminal / status. The payload is sealed with the phone's shared push
/// key (AES-256-GCM, `nonce || ciphertext || tag` base64). On any failure we
/// deliver the untouched generic content, so a notification still shows and nothing
/// sensitive leaks.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var fallback: UNNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        self.fallback = request.content
        contentHandler(rewritten(request.content) ?? request.content)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let fallback { contentHandler(fallback) }
    }

    private func rewritten(_ original: UNNotificationContent) -> UNNotificationContent? {
        guard let blob = original.userInfo["blob"] as? String,
              let payload = PushPayload.open(blob: blob),
              let mutable = original.mutableCopy() as? UNMutableNotificationContent
        else { return nil }
        if payload["target"] as? String == "recap" { return recap(payload, into: mutable) }
        guard let project = payload["project"] as? String, !project.isEmpty else { return nil }
        AgentWidgetStore.apply(push: payload)

        let terminal = payload["terminal"] as? String ?? ""
        let status = payload["status"] as? String ?? ""
        let statusKey = payload["key"] as? String ?? ""
        // The Mac names the project the way its sidebar does; `project` itself is
        // the file name (an id for a duplicate) and absent-label Macs predate it.
        let label = payload["projectLabel"] as? String ?? ""

        mutable.title = label.isEmpty ? project : label
        mutable.body = body(terminal: terminal, status: status)
        // Group notifications per project in Notification Center.
        mutable.threadIdentifier = project
        var info = mutable.userInfo
        info["project"] = project
        for key in ["target", "terminalId", "automationId"] {
            if let value = payload[key] as? String, !value.isEmpty {
                info[key] = value
            }
        }
        // Carry the status entry key so a later background clear / foreground
        // reconcile can find and withdraw exactly this notification, and the status
        // it announced so one that has moved on is withdrawn too.
        info["statusKey"] = statusKey
        if !status.isEmpty {
            info["status"] = status
        }
        // Carry the sending Mac's id (absent on old Macs) so a clear/reconcile from
        // one Mac never withdraws a same-named project's notification from another.
        if let serverId = payload["serverId"] as? String, !serverId.isEmpty {
            info["serverId"] = serverId
        }
        // The answers the Mac takes back from here, and the report they answer:
        // it types one in only while that same report still stands.
        if let category = AgentAnswerAction.category(for: payload["actions"] as? [String] ?? []) {
            mutable.categoryIdentifier = category
            if let ts = payload["ts"] as? Int { info["ts"] = ts }
            info["projectLabel"] = label
            info["terminal"] = terminal
        }
        mutable.userInfo = info
        return mutable
    }

    /// Monday's weekly recap: the Mac writes the words, and a tap opens the recap
    /// of the week it names on that Mac.
    private func recap(_ payload: [String: Any], into mutable: UNMutableNotificationContent) -> UNNotificationContent? {
        guard let title = payload["title"] as? String, !title.isEmpty else { return nil }
        mutable.title = title
        mutable.body = payload["body"] as? String ?? ""
        mutable.threadIdentifier = "recap"
        var info = mutable.userInfo
        info["target"] = "recap"
        for key in ["week", "serverId"] {
            if let value = payload[key] as? String, !value.isEmpty { info[key] = value }
        }
        mutable.userInfo = info
        return mutable
    }

    private func body(terminal: String, status: String) -> String {
        let phrase: String
        switch status {
        case "Waiting": phrase = "Agent is waiting for you"
        case "Done": phrase = "Agent finished"
        case "Error": phrase = "Agent hit an error"
        default: phrase = status
        }
        return terminal.isEmpty ? phrase : "\(terminal) — \(phrase)"
    }
}
