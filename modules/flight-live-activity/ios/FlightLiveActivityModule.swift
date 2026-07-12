// FlightLiveActivityModule.swift — Expo module bridging ActivityKit to JS.
// Faithful port of the iOS FlightLiveActivityService (one activity at a time,
// same-flight dedup, staleDate = arrival+45m or departure+4h, terminal-status
// end-after-15m, auto-end fallback).
//
// Requires FlightActivityAttributes.swift to be a member of this target too
// (see docs/native/live-activity.md). Scaffold — compiles on macOS/Xcode.
import ActivityKit
import ExpoModulesCore
import Foundation

public class FlightLiveActivityModule: Module {
    private var current: Any? // Activity<FlightActivityAttributes> on iOS 16.1+
    private var autoEndTask: Task<Void, Never>?
    private let postArrivalGrace: TimeInterval = 45 * 60

    public func definition() -> ModuleDefinition {
        Name("FlightLiveActivity")

        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        AsyncFunction("startActivity") { (content: [String: Any]) -> String in
            guard #available(iOS 16.1, *) else { return "" }
            return try self.start(content)
        }

        AsyncFunction("updateActivity") { (id: String, content: [String: Any]) in
            guard #available(iOS 16.1, *) else { return }
            await self.update(id: id, content: content)
        }

        AsyncFunction("endActivity") { (id: String) in
            guard #available(iOS 16.1, *) else { return }
            await self.end()
        }
    }

    @available(iOS 16.1, *)
    private func start(_ c: [String: Any]) throws -> String {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "" }
        let flightNumber = c["flightNumber"] as? String ?? ""

        if let existing = current as? Activity<FlightActivityAttributes>,
           existing.attributes.flightNumber == flightNumber {
            return existing.id
        }
        if let existing = current as? Activity<FlightActivityAttributes> {
            Task { await existing.end(nil, dismissalPolicy: .immediate) }
        }

        let depart = Self.date(c["departISO"]) ?? Date()
        let arrive = Self.date(c["arriveISO"])
        let attributes = FlightActivityAttributes(
            flightNumber: flightNumber,
            airlineName: c["airlineName"] as? String ?? "",
            originIATA: c["origin"] as? String ?? "",
            destinationIATA: c["destination"] as? String ?? "",
            scheduledDeparture: depart
        )
        let state = FlightActivityState(
            gate: c["gate"] as? String,
            terminal: c["terminal"] as? String,
            status: Self.status(c["status"]),
            estimatedDeparture: depart,
            delayMinutes: nil
        )
        let staleDate = (arrive.map { $0.addingTimeInterval(self.postArrivalGrace) })
            ?? depart.addingTimeInterval(4 * 3600)

        let activity = try Activity.request(
            attributes: attributes,
            content: .init(state: state, staleDate: staleDate)
        )
        current = activity
        scheduleAutoEnd(at: staleDate)
        return activity.id
    }

    @available(iOS 16.1, *)
    private func update(id: String, content c: [String: Any]) async {
        guard let activity = current as? Activity<FlightActivityAttributes> else { return }
        let est = Self.date(c["departISO"]) ?? activity.content.state.estimatedDeparture
        let status = Self.status(c["status"])
        let state = FlightActivityState(
            gate: c["gate"] as? String ?? activity.content.state.gate,
            terminal: c["terminal"] as? String ?? activity.content.state.terminal,
            status: status,
            estimatedDeparture: est,
            delayMinutes: c["delayMinutes"] as? Int
        )
        let staleDate = max(Date(), est).addingTimeInterval(4 * 3600)
        let newContent = ActivityContent(state: state, staleDate: staleDate)

        if status == .departed || status == .cancelled {
            await activity.update(newContent)
            await activity.end(newContent, dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
            autoEndTask?.cancel()
            current = nil
        } else {
            await activity.update(newContent)
        }
    }

    @available(iOS 16.1, *)
    private func end() async {
        autoEndTask?.cancel()
        if let activity = current as? Activity<FlightActivityAttributes> {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        current = nil
    }

    @available(iOS 16.1, *)
    private func scheduleAutoEnd(at deadline: Date) {
        autoEndTask?.cancel()
        autoEndTask = Task { [weak self] in
            let delay = deadline.timeIntervalSinceNow
            if delay > 0 { try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000)) }
            await self?.end()
        }
    }

    private static func date(_ v: Any?) -> Date? {
        guard let s = v as? String else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }

    @available(iOS 16.1, *)
    private static func status(_ v: Any?) -> FlightStatus {
        guard let s = v as? String else { return .scheduled }
        switch s.lowercased() {
        case "on time", "ontime": return .onTime
        case "boarding": return .boarding
        case "final call", "finalcall": return .finalCall
        case "delayed": return .delayed
        case "departed": return .departed
        case "cancelled", "canceled": return .cancelled
        default: return .scheduled
        }
    }
}
