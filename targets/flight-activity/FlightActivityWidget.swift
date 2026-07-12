// FlightActivityWidget.swift — the Live Activity UI (lock screen + Dynamic
// Island), rendered from FlightActivityAttributes. Scaffold — compiles in an
// Xcode development build on macOS with the widget target.
import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct FlightActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FlightActivityAttributes.self) { context in
            // Lock screen / banner
            LockScreenView(context: context)
                .padding()
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.originIATA, systemImage: "airplane.departure")
                        .font(.caption).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Label(context.attributes.destinationIATA, systemImage: "airplane.arrival")
                        .font(.caption).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.flightNumber).font(.headline).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.status.label)
                            .font(.caption).bold()
                            .foregroundStyle(context.state.status.isUrgent ? .red : .green)
                        Spacer()
                        if let gate = context.state.gate {
                            Text("Gate \(gate)").font(.caption).foregroundStyle(.white)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "airplane").foregroundStyle(.white)
            } compactTrailing: {
                Text(context.state.status.label)
                    .font(.caption2)
                    .foregroundStyle(context.state.status.isUrgent ? .red : .green)
            } minimal: {
                Image(systemName: "airplane").foregroundStyle(.white)
            }
        }
    }
}

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<FlightActivityAttributes>
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(context.attributes.flightNumber).font(.headline).foregroundStyle(.white)
                Spacer()
                Text(context.state.status.label)
                    .font(.subheadline).bold()
                    .foregroundStyle(context.state.status.isUrgent ? .red : .green)
            }
            HStack {
                Text(context.attributes.originIATA)
                Image(systemName: "airplane")
                Text(context.attributes.destinationIATA)
                Spacer()
                if let gate = context.state.gate {
                    Text("Gate \(gate)").bold()
                }
            }
            .font(.subheadline)
            .foregroundStyle(.white)
        }
    }
}
