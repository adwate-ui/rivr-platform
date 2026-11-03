import ActivityKit
import SwiftUI
import WidgetKit

/// The RivrLiveStatus widget extension: the lock-screen live status as a Live Activity (decision 0323), drawn as the
/// prototype's Lock screen states have it. Its target also compiles ../App/RivrLiveAttributes.swift and the tokens'
/// generated RivrColors.swift (packages/tokens/generated/ios). Every word comes from the server.
@main
struct RivrLiveStatusBundle: WidgetBundle {
    var body: some Widget {
        RivrLiveStatusWidget()
    }
}

struct RivrLiveStatusWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RivrLiveAttributes.self) { context in
            LockScreenStatus(state: context.state)
                .activityBackgroundTint(RivrColors.colorRaised)
                .activitySystemActionForegroundColor(RivrColors.colorContent)
                .widgetURL(RivrLiveAttributes.ContentState.link(to: "/"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text(context.state.label).font(.caption) }
                DynamicIslandExpandedRegion(.trailing) { StatusFigure(state: context.state).font(.title2) }
                DynamicIslandExpandedRegion(.bottom) { StatusAction(state: context.state) }
            } compactLeading: {
                Text("\u{2660}").foregroundColor(RivrColors.colorGold)
            } compactTrailing: {
                StatusFigure(state: context.state).font(.caption2)
            } minimal: {
                Text("\u{2660}").foregroundColor(RivrColors.colorGold)
            }
            .widgetURL(RivrLiveAttributes.ContentState.link(to: "/"))
        }
    }
}

/// The lock screen: the app and the game or seat, the line above the figure, the figure, its one button, and the bar.
struct LockScreenStatus: View {
    let state: RivrLiveAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "").font(.footnote.weight(.semibold))
                Spacer()
                Text(state.meta).font(.footnote).foregroundColor(RivrColors.colorContentMuted)
            }
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading) {
                    Text(state.label).font(.footnote).foregroundColor(RivrColors.colorContentMuted)
                    StatusFigure(state: state).font(.system(.largeTitle, design: .serif))
                }
                Spacer()
                StatusAction(state: state)
            }
            StatusBar(state: state)
        }
        .foregroundColor(RivrColors.colorContent)
        .padding()
    }
}

/// The figure: a countdown iOS draws by itself to the hold's or the call time's end, or the place in words.
struct StatusFigure: View {
    let state: RivrLiveAttributes.ContentState

    var body: some View {
        if let countdown = state.countdown {
            Text(timerInterval: countdown, countsDown: true).monospacedDigit()
        } else {
            Text(state.value ?? "")
        }
    }
}

/// The one button, "I'm on my way" or "Order": it opens the app on its page.
struct StatusAction: View {
    let state: RivrLiveAttributes.ContentState

    var body: some View {
        if let title = state.actionTitle, let path = state.actionUrl, let url = RivrLiveAttributes.ContentState.link(to: path) {
            Link(destination: url) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundColor(RivrColors.colorGold)
            }
        }
    }
}

/// The bar: what is left of the countdown, drawn down by iOS; full while waiting.
struct StatusBar: View {
    let state: RivrLiveAttributes.ContentState

    var body: some View {
        if let countdown = state.countdown {
            ProgressView(timerInterval: countdown, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                .tint(RivrColors.colorGold)
        } else {
            ProgressView(value: 1).tint(RivrColors.colorGold)
        }
    }
}
