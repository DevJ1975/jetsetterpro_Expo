// FlightActivityAttributes.swift — the ONLY type shared between the app (native
// module) and the Widget Extension. Add this file's target membership to BOTH
// the app target and the `flight-activity` widget target. Faithful port of the
// iOS app's FlightActivityAttributes.
//
// (Scaffold — compiles in an Xcode development build on macOS.)
import ActivityKit
import Foundation

public enum FlightStatus: String, Codable, CaseIterable {
    case scheduled, onTime, boarding, finalCall, delayed, departed, cancelled

    public var label: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .onTime: return "On Time"
        case .boarding: return "Boarding"
        case .finalCall: return "Final Call"
        case .delayed: return "Delayed"
        case .departed: return "Departed"
        case .cancelled: return "Cancelled"
        }
    }

    public var isUrgent: Bool { self == .finalCall || self == .delayed || self == .cancelled }
}

public struct FlightActivityAttributes: ActivityAttributes {
    public typealias ContentState = FlightActivityState

    // Static — set once at creation.
    public let flightNumber: String
    public let airlineName: String
    public let originIATA: String
    public let destinationIATA: String
    public let scheduledDeparture: Date

    public init(flightNumber: String, airlineName: String, originIATA: String,
                destinationIATA: String, scheduledDeparture: Date) {
        self.flightNumber = flightNumber
        self.airlineName = airlineName
        self.originIATA = originIATA
        self.destinationIATA = destinationIATA
        self.scheduledDeparture = scheduledDeparture
    }
}

public struct FlightActivityState: Codable, Hashable {
    public var gate: String?
    public var terminal: String?
    public var status: FlightStatus
    public var estimatedDeparture: Date
    public var delayMinutes: Int?

    public init(gate: String? = nil, terminal: String? = nil, status: FlightStatus,
                estimatedDeparture: Date, delayMinutes: Int? = nil) {
        self.gate = gate
        self.terminal = terminal
        self.status = status
        self.estimatedDeparture = estimatedDeparture
        self.delayMinutes = delayMinutes
    }
}
