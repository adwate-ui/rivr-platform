import ActivityKit
import Foundation

/// The lock-screen live status's Live Activity (decision 0323), shared by the app and the RivrLiveStatus widget
/// extension. Apple's push-to-start names this type (`attributes-type`), and the live-status consumer sends its
/// ContentState (packages/adapters/src/live-status/apns.ts). Every word in it comes from the server (@rivr/i18n).
@available(iOS 16.1, *)
struct RivrLiveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// `waiting`, `seat_ready`, `seated`, or `ended` in an end's last push.
        var kind: String
        /// Top right: the game (`NLH 50/100`) or the seat (`Table 1 · Seat 4`).
        var meta: String
        /// Above the figure: `Waitlist · Table 1`, `Seat ready · held for`, `Call time left`.
        var label: String
        /// The figure in words (`Next in line`); nil when it counts down.
        var value: String?
        /// Seconds since 1970. ActivityKit's own decoder would read a Date as seconds since 2001.
        var startsAt: Double?
        var endsAt: Double?
        /// The one button: its words and the app page it opens (`/?accept=<place>`, `/fnb`).
        var actionTitle: String?
        var actionUrl: String?

        /// What the figure and the bar count down through, or nil when the figure is words.
        var countdown: ClosedRange<Date>? {
            guard let startsAt, let endsAt, endsAt > startsAt else { return nil }
            return Date(timeIntervalSince1970: startsAt)...Date(timeIntervalSince1970: endsAt)
        }

        /// The link that opens the app on `path`, which the app's LiveStatus plugin hands to the web app.
        static func link(to path: String) -> URL? {
            var parts = URLComponents()
            parts.scheme = "club.rivr.player"
            parts.host = "open"
            parts.queryItems = [URLQueryItem(name: "path", value: path)]
            return parts.url
        }
    }
}
