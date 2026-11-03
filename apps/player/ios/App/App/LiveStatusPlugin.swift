import ActivityKit
import Capacitor
import Foundation
import UIKit
import UserNotifications

/// The app's own LiveStatus plugin (decision 0361), as the player app calls it (src/features/profile/nativePhone.ts):
/// asks leave to notify, gives the phone's ActivityKit push-to-start token, keeps the key the database gave the phone,
/// ends the Live Activity when the member turns the live status off or signs out, and tells the app which page a tapped
/// Live Activity opens. The Android twin is LiveStatusPlugin.java.
@objc(LiveStatusPlugin)
public class LiveStatusPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveStatusPlugin"
    public let jsName = "LiveStatus"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepDeviceKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(opened(_:)), name: .capacitorOpenURL, object: nil)
    }

    /// A Live Activity's link (RivrLiveAttributes.ContentState.link): the page is kept for the app until it listens.
    @objc private func opened(_ notification: Notification) {
        guard let object = notification.object as? [String: Any], let url = object["url"] as? URL,
              url.scheme == "club.rivr.player", url.host == "open",
              let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "path" })?.value
        else { return }
        notifyListeners("opened", data: ["path": path], retainUntilConsumed: true)
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let isOn = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
            let state: String
            if #available(iOS 16.1, *), isOn, !ActivityAuthorizationInfo().areActivitiesEnabled {
                state = "denied"
            } else {
                state = isOn ? "granted" : settings.authorizationStatus == .denied ? "denied" : "prompt"
            }
            call.resolve(["notifications": state])
        }
    }

    @objc func register(_ call: CAPPluginCall) {
        guard #available(iOS 17.2, *) else {
            call.reject("Live Activities started by push need iOS 17.2", "not_configured")
            return
        }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted, ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.reject("Notifications or Live Activities are off for RIVR", "denied")
                return
            }
            DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
            Task {
                guard let token = await LiveActivityTokens.shared.firstStartToken() else {
                    call.reject("iOS gave no push-to-start token", "unavailable")
                    return
                }
                call.resolve(["platform": "ios", "token": token])
            }
        }
    }

    @objc func current(_ call: CAPPluginCall) {
        let tokens = LiveActivityTokens.shared
        call.resolve(["token": tokens.startToken ?? NSNull(), "deviceKey": tokens.deviceKey() ?? NSNull()])
    }

    @objc func keepDeviceKey(_ call: CAPPluginCall) {
        guard let deviceKey = call.getString("deviceKey"), deviceKey.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else {
            call.reject("Not a device key")
            return
        }
        LiveActivityTokens.shared.keepDeviceKey(deviceKey)
        call.resolve()
    }

    @objc func unregister(_ call: CAPPluginCall) {
        let tokens = LiveActivityTokens.shared
        let wasOn = tokens.deviceKey() != nil
        tokens.forgetDeviceKey()
        Task {
            await tokens.endAll()
            call.resolve(["token": wasOn ? (tokens.startToken ?? NSNull()) : NSNull()])
        }
    }
}
