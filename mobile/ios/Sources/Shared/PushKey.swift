import Foundation
import CryptoKit
import Security

/// The single AES-256 push key the phone shares with every paired Mac. It lives in
/// the Keychain access group both the app and the notification service extension
/// can reach, so the extension can decrypt a push payload — even while the phone is
/// locked (hence `kSecAttrAccessibleAfterFirstUnlock`).
///
/// No `kSecAttrAccessGroup` is set on any operation: the shared group is the only
/// entry in each target's `keychain-access-groups` entitlement, which makes it the
/// default group for both, so the app and the extension resolve the same item.
///
/// The widget extension can't read the Keychain while it draws the Live Activity,
/// so whoever can keeps a copy in the app group for it, readable after first
/// unlock like the Keychain item and kept out of backups.
enum PushKey {
    private static let service = "cx.lpm.mobile.push"
    private static let account = "push-key"
    private static let keyLength = 32
    private static let appGroup = "group.cx.lpm.mobile"

    private static var copyURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("push-key")
    }

    /// The push key, generating and persisting a fresh one on first use. The app
    /// uses this to register the key with each Mac.
    static func loadOrCreate() -> Data {
        if let existing = load() { return existing }
        let data = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        save(data)
        keepCopy(data)
        return data
    }

    /// The stored push key, or nil if none exists yet. The extensions use this and
    /// never create a key — the app owns generation.
    static func load() -> Data? {
        if let key = fromKeychain() {
            keepCopy(key)
            return key
        }
        return fromCopy()
    }

    private static func fromKeychain() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, data.count == keyLength
        else { return nil }
        return data
    }

    private static func fromCopy() -> Data? {
        guard let url = copyURL, let data = try? Data(contentsOf: url), data.count == keyLength
        else { return nil }
        return data
    }

    private static func keepCopy(_ key: Data) {
        guard var url = copyURL, fromCopy() != key,
              (try? key.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])) != nil
        else { return }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }

    private static func save(_ data: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }
}
