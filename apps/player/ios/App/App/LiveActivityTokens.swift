import ActivityKit
import Foundation
import Security

/// The phone's tokens for the lock-screen live status (decision 0361). Started by the AppDelegate at every launch,
/// including the background launch iOS gives the app after Apple starts a Live Activity by push, when the web view and
/// its session are not running. So it reports a new token itself, with the phone's own key, to the live-status-token
/// function, never to the database directly; and it keeps one Live Activity, ending any older one.
final class LiveActivityTokens {
    static let shared = LiveActivityTokens()

    private let startTokenDefaultsKey = "rivr.liveStatus.startToken"
    private let keychainService = "club.rivr.player.liveStatus"
    private let keychainAccount = "deviceKey"

    /// The phone's push-to-start token, as last given.
    var startToken: String? { UserDefaults.standard.string(forKey: startTokenDefaultsKey) }

    /// Watches for new tokens and new Live Activities for as long as the app runs.
    func start() {
        guard #available(iOS 17.2, *) else { return }
        Task {
            for await data in Activity<RivrLiveAttributes>.pushToStartTokenUpdates {
                let token = Self.hex(data)
                let isNew = token != startToken
                UserDefaults.standard.set(token, forKey: startTokenDefaultsKey)
                if isNew { await report(["push_token": token]) }
            }
        }
        Task {
            for await activity in Activity<RivrLiveAttributes>.activityUpdates {
                await endOthers(than: activity)
                Task {
                    for await data in activity.pushTokenUpdates { await report(["activity_push_token": Self.hex(data)]) }
                }
            }
        }
    }

    /// The first push-to-start token, waiting up to ten seconds for iOS to give one.
    @available(iOS 17.2, *)
    func firstStartToken() async -> String? {
        if let startToken { return startToken }
        return await withTaskGroup(of: String?.self) { group in
            group.addTask {
                for await data in Activity<RivrLiveAttributes>.pushToStartTokenUpdates { return Self.hex(data) }
                return nil
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: 10_000_000_000)
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            if let first { UserDefaults.standard.set(first, forKey: startTokenDefaultsKey) }
            return first
        }
    }

    /// Ends every Live Activity at once: the member turned the live status off, or signed out.
    func endAll() async {
        guard #available(iOS 16.2, *) else { return }
        for activity in Activity<RivrLiveAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    }

    @available(iOS 16.2, *)
    private func endOthers(than kept: Activity<RivrLiveAttributes>) async {
        for activity in Activity<RivrLiveAttributes>.activities where activity.id != kept.id {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// Sends a token with the phone's key; nothing while the member has the live status off (no key).
    private func report(_ tokens: [String: String]) async {
        guard let deviceKey = deviceKey(),
              let address = Bundle.main.object(forInfoDictionaryKey: "RivrLiveStatusTokenUrl") as? String,
              let url = URL(string: address), url.scheme == "https" else { return }
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: tokens.merging(["device_key": deviceKey]) { kept, _ in kept })
        _ = try? await URLSession.shared.data(for: request)
    }

    // MARK: The phone's key, in the keychain, readable after the phone's first unlock (a push can come while it is locked).

    func deviceKey() -> String? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        var found: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess, let data = found as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func keepDeviceKey(_ deviceKey: String) {
        forgetDeviceKey()
        var item = keychainQuery()
        item[kSecValueData as String] = Data(deviceKey.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    func forgetDeviceKey() {
        SecItemDelete(keychainQuery() as CFDictionary)
    }

    private func keychainQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: keychainAccount]
    }

    private static func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
}
